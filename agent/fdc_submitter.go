package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"
)

// FDCProof represents an FDC proof
type FDCProof struct {
	MerkleProof []string `json:"merkleProof"`
	Data        string   `json:"data"`
	RoundID     uint64   `json:"roundId"`
}

// FDCSubmitter handles FDC proof fetching and submission
type FDCSubmitter struct {
	client      *ethclient.Client
	flipCore    common.Address
	verifierURL string
	daLayerURL  string
	apiKey      string
	timeout     time.Duration
}

// NewFDCSubmitter creates a new FDC submitter
func NewFDCSubmitter(config *Config) (*FDCSubmitter, error) {
	client, err := ethclient.Dial(config.Flare.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Flare RPC: %w", err)
	}

	return &FDCSubmitter{
		client:      client,
		flipCore:    common.HexToAddress(config.Flare.FLIPCoreAddress),
		verifierURL: config.FDC.VerifierURL,
		daLayerURL:  config.FDC.DALayerURL,
		apiKey:      config.FDC.APIKey,
		timeout:     time.Duration(config.Agent.FDCTimeout) * time.Second,
	}, nil
}

// GetFDCProof fetches FDC proof for an XRPL transaction
func (fs *FDCSubmitter) GetFDCProof(ctx context.Context, xrplTxHash string) (*FDCProof, error) {
	// Step 1: Prepare attestation request
	requestBytes, roundID, err := fs.prepareAttestationRequest(ctx, xrplTxHash)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare attestation request: %w", err)
	}

	log.Info().
		Uint64("round_id", roundID).
		Msg("FDC attestation request prepared, waiting for round confirmation")

	// Step 2: Wait for FDC round confirmation (3-5 minutes)
	// In production, poll for round availability
	time.Sleep(3 * time.Minute) // Placeholder

	// Step 3: Fetch proof from Data Availability Layer
	proof, err := fs.fetchProofFromDALayer(ctx, roundID, requestBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch proof: %w", err)
	}

	return proof, nil
}

// encodeToHex32 encodes a string to a 32-byte hex string (UTF8 padded)
func encodeToHex32(s string) string {
	b := make([]byte, 32)
	copy(b, []byte(s))
	return "0x" + fmt.Sprintf("%x", b)
}

// prepareAttestationRequest prepares an FDC attestation request
func (fs *FDCSubmitter) prepareAttestationRequest(ctx context.Context, txHash string) (string, uint64, error) {
	url := fmt.Sprintf("%s/verifier/xrp/Payment/prepareRequest", fs.verifierURL)

	// FDC requires the full attestation structure:
	// - attestationType: "Payment" encoded as 32-byte hex
	// - sourceId: "testXRP" for XRPL testnet encoded as 32-byte hex
	// - requestBody: transaction details
	requestBody := map[string]interface{}{
		"attestationType": encodeToHex32("Payment"),
		"sourceId":        encodeToHex32("testXRP"),
		"requestBody": map[string]interface{}{
			"transactionId": txHash,
			"inUtxo":        "0",
			"utxo":          "0",
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", 0, err
	}

	log.Debug().
		Str("url", url).
		Str("request", string(jsonData)).
		Msg("Sending FDC attestation request")

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", 0, err
	}

	req.Header.Set("Content-Type", "application/json")
	if fs.apiKey != "" {
		req.Header.Set("X-API-KEY", fs.apiKey)
	}

	client := &http.Client{Timeout: fs.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Read response body for error details
		var errBody []byte
		errBody, _ = io.ReadAll(resp.Body)
		log.Debug().
			Int("status", resp.StatusCode).
			Str("body", string(errBody)).
			Str("url", url).
			Msg("FDC verifier error response")
		return "", 0, fmt.Errorf("verifier returned status %d: %s", resp.StatusCode, string(errBody))
	}

	// Read full response body for debugging
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("failed to read response: %w", err)
	}

	log.Debug().
		Str("response", string(respBody)).
		Msg("FDC verifier response")

	var result struct {
		Status            string `json:"status"`
		AbiEncodedRequest string `json:"abiEncodedRequest"`
		RoundID           uint64 `json:"roundId"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", 0, fmt.Errorf("failed to decode response: %w", err)
	}

	// Check status
	if result.Status != "" && result.Status != "VALID" {
		return "", 0, fmt.Errorf("verifier returned status: %s", result.Status)
	}

	if result.AbiEncodedRequest == "" {
		return "", 0, fmt.Errorf("verifier returned empty abiEncodedRequest")
	}

	return result.AbiEncodedRequest, result.RoundID, nil
}

// fetchProofFromDALayer fetches FDC proof from Data Availability Layer
func (fs *FDCSubmitter) fetchProofFromDALayer(ctx context.Context, roundID uint64, requestBytes string) (*FDCProof, error) {
	// Correct endpoint: /api/v1/fdc/proof-by-request-round
	url := fmt.Sprintf("%s/api/v1/fdc/proof-by-request-round", fs.daLayerURL)

	requestBody := map[string]interface{}{
		"votingRoundId": roundID,
		"requestBytes":  requestBytes,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if fs.apiKey != "" {
		req.Header.Set("X-API-KEY", fs.apiKey)
	}

	client := &http.Client{Timeout: fs.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DA layer returned status %d", resp.StatusCode)
	}

	var result struct {
		Proof   []string `json:"proof"`
		Response string  `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &FDCProof{
		MerkleProof: result.Proof,
		Data:        result.Response,
		RoundID:     roundID,
	}, nil
}

// SubmitProof submits FDC proof to FLIPCore
func (fs *FDCSubmitter) SubmitProof(ctx context.Context, redemptionID *big.Int, proof *FDCProof) error {
	// FLIPCore.handleFDCAttestation(uint256 _redemptionId, uint256 _requestId, bool _success)
	// We need to:
	// 1. Parse the FDC response to determine success/failure
	// 2. Extract request ID from response
	// 3. Call handleFDCAttestation

	// TODO: Parse FDC response to get success status and request ID
	// For now, assume success and use a placeholder request ID
	success := true // Parse from proof.Data
	requestID := big.NewInt(0) // Extract from proof.Data

	// Get FLIPCore ABI
	// In production, load from contract artifacts
	abiJSON := `[{"inputs":[{"name":"_redemptionId","type":"uint256"},{"name":"_requestId","type":"uint256"},{"name":"_success","type":"bool"}],"name":"handleFDCAttestation","outputs":[],"stateMutability":"nonpayable","type":"function"}]`

	contractABI, err := abi.JSON(bytes.NewReader([]byte(abiJSON)))
	if err != nil {
		return fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Encode function call
	_, err = contractABI.Pack("handleFDCAttestation", redemptionID, requestID, success)
	if err != nil {
		return fmt.Errorf("failed to encode function call: %w", err)
	}

	// TODO: Send transaction to FLIPCore
	// In production, use a wallet to sign and send transaction
	log.Info().
		Uint64("redemption_id", redemptionID.Uint64()).
		Bool("success", success).
		Msg("FDC proof ready to submit (transaction sending not implemented)")

	return nil
}

