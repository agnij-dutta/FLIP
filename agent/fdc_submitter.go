package main

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"
)

// FDC constants for Coston2
const (
	// FdcHub contract on Coston2
	FdcHubAddress = "0x48aC463d7975828989331F4De43341627b9c5f1D"
	// FdcRequestFeeConfigurations on Coston2
	FdcFeeConfigAddress = "0x191a1282Ac700edE65c5B0AaF313BAcC3eA7fC7e"
	// DA Layer for Coston2
	DALayerBaseURL = "https://ctn2-data-availability.flare.network"
	// Voting round epoch parameters
	firstVotingRoundStartTs    = uint64(1658430000)
	votingEpochDurationSeconds = uint64(90)
)

// FDCProof represents an FDC proof with Merkle verification
type FDCProof struct {
	MerkleProof []string    `json:"proof"`
	Response    interface{} `json:"response"`
	RoundID     uint64      `json:"roundId"`
}

// FDCSubmitter handles the complete FDC attestation lifecycle
type FDCSubmitter struct {
	client      *ethclient.Client
	flipCore    common.Address
	escrowVault common.Address
	verifierURL string
	apiKey      string
	privateKey  string
	chainID     int64
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
		escrowVault: common.HexToAddress(config.Flare.EscrowVaultAddress),
		verifierURL: config.FDC.VerifierURL,
		apiKey:      config.FDC.APIKey,
		privateKey:  config.Flare.PrivateKey,
		chainID:     int64(config.Flare.ChainID),
		timeout:     time.Duration(config.Agent.FDCTimeout) * time.Second,
	}, nil
}

// GetFDCProof executes the complete FDC flow for an XRPL payment
func (fs *FDCSubmitter) GetFDCProof(ctx context.Context, xrplTxHash string) (*FDCProof, error) {
	// Step 1: Prepare attestation request via verifier
	abiEncodedRequest, err := fs.prepareAttestationRequest(ctx, xrplTxHash)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare attestation request: %w", err)
	}

	log.Info().
		Str("xrpl_tx", xrplTxHash).
		Msg("FDC attestation request prepared")

	// Step 2: Submit on-chain to FdcHub
	submissionTimestamp, err := fs.submitOnChain(ctx, abiEncodedRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to submit FDC request on-chain: %w", err)
	}

	// Step 3: Calculate voting round ID
	roundID := (submissionTimestamp - firstVotingRoundStartTs) / votingEpochDurationSeconds

	log.Info().
		Uint64("round_id", roundID).
		Uint64("submission_ts", submissionTimestamp).
		Msg("FDC request submitted, waiting for round finalization")

	// Step 4: Wait for round finalization
	err = fs.waitForRoundFinalization(ctx, roundID)
	if err != nil {
		return nil, fmt.Errorf("failed waiting for round finalization: %w", err)
	}

	// Step 5: Fetch proof from DA layer
	proof, err := fs.fetchProofFromDALayer(ctx, roundID, abiEncodedRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch proof from DA layer: %w", err)
	}

	proof.RoundID = roundID
	return proof, nil
}

// encodeToHex32 encodes a string to a 32-byte hex string (UTF8 zero-padded)
func encodeToHex32(s string) string {
	b := make([]byte, 32)
	copy(b, []byte(s))
	return "0x" + hex.EncodeToString(b)
}

// prepareAttestationRequest calls the FDC verifier to get the abiEncodedRequest
func (fs *FDCSubmitter) prepareAttestationRequest(ctx context.Context, txHash string) (string, error) {
	url := fmt.Sprintf("%s/verifier/xrp/Payment/prepareRequest", fs.verifierURL)

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
		return "", err
	}

	log.Debug().
		Str("url", url).
		Str("request", string(jsonData)).
		Msg("Sending FDC attestation request to verifier")

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	if fs.apiKey != "" {
		req.Header.Set("X-API-KEY", fs.apiKey)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Error().
			Int("status", resp.StatusCode).
			Str("body", string(respBody)).
			Msg("FDC verifier error")
		return "", fmt.Errorf("verifier returned status %d: %s", resp.StatusCode, string(respBody))
	}

	log.Debug().
		Str("response", string(respBody)).
		Msg("FDC verifier response")

	var result struct {
		AbiEncodedRequest string `json:"abiEncodedRequest"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if result.AbiEncodedRequest == "" {
		return "", fmt.Errorf("verifier returned empty abiEncodedRequest (tx may not be indexed yet)")
	}

	return result.AbiEncodedRequest, nil
}

// submitOnChain submits the attestation request to FdcHub on-chain
func (fs *FDCSubmitter) submitOnChain(ctx context.Context, abiEncodedRequest string) (uint64, error) {
	// Get the fee required for attestation
	fee, err := fs.getAttestationFee(ctx, abiEncodedRequest)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to get attestation fee, using default 1 FLR")
		fee = big.NewInt(1e18) // Default 1 FLR if fee query fails
	}

	log.Debug().
		Str("fee", fee.String()).
		Msg("FDC attestation fee")

	// FdcHub ABI - requestAttestation(bytes)
	const fdcHubABI = `[{
		"inputs": [{"name": "_data", "type": "bytes"}],
		"name": "requestAttestation",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	}]`

	parsed, err := abi.JSON(strings.NewReader(fdcHubABI))
	if err != nil {
		return 0, fmt.Errorf("failed to parse FdcHub ABI: %w", err)
	}

	// Decode the hex-encoded request to bytes
	requestBytes, err := hex.DecodeString(strings.TrimPrefix(abiEncodedRequest, "0x"))
	if err != nil {
		return 0, fmt.Errorf("failed to decode abiEncodedRequest: %w", err)
	}

	// Create transactor
	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(fs.privateKey, "0x"))
	if err != nil {
		return 0, fmt.Errorf("failed to parse private key: %w", err)
	}

	chainID := big.NewInt(fs.chainID)
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return 0, fmt.Errorf("failed to create transactor: %w", err)
	}

	nonce, err := fs.client.PendingNonceAt(ctx, auth.From)
	if err != nil {
		return 0, fmt.Errorf("failed to get nonce: %w", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))

	gasPrice, err := fs.client.SuggestGasPrice(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to get gas price: %w", err)
	}
	auth.GasPrice = gasPrice
	auth.GasLimit = uint64(300000)
	auth.Value = fee

	// Submit to FdcHub
	fdcHubAddr := common.HexToAddress(FdcHubAddress)
	contract := bind.NewBoundContract(fdcHubAddr, parsed, fs.client, fs.client, fs.client)

	tx, err := contract.Transact(auth, "requestAttestation", requestBytes)
	if err != nil {
		return 0, fmt.Errorf("failed to submit attestation: %w", err)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Msg("FDC attestation request submitted on-chain")

	// Wait for confirmation
	receipt, err := bind.WaitMined(ctx, fs.client, tx)
	if err != nil {
		return 0, fmt.Errorf("failed to wait for FDC tx: %w", err)
	}

	if receipt.Status != 1 {
		return 0, fmt.Errorf("FDC attestation tx failed with status %d", receipt.Status)
	}

	// Get block timestamp for voting round calculation
	block, err := fs.client.BlockByNumber(ctx, receipt.BlockNumber)
	if err != nil {
		return 0, fmt.Errorf("failed to get block: %w", err)
	}

	timestamp := block.Time()
	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Uint64("block_number", receipt.BlockNumber.Uint64()).
		Uint64("timestamp", timestamp).
		Msg("FDC attestation tx confirmed")

	return timestamp, nil
}

// getAttestationFee queries the FdcRequestFeeConfigurations contract for the fee
func (fs *FDCSubmitter) getAttestationFee(ctx context.Context, abiEncodedRequest string) (*big.Int, error) {
	const feeConfigABI = `[{
		"inputs": [{"name": "_data", "type": "bytes"}],
		"name": "getRequestFee",
		"outputs": [{"name": "", "type": "uint256"}],
		"stateMutability": "view",
		"type": "function"
	}]`

	parsed, err := abi.JSON(strings.NewReader(feeConfigABI))
	if err != nil {
		return nil, err
	}

	requestBytes, err := hex.DecodeString(strings.TrimPrefix(abiEncodedRequest, "0x"))
	if err != nil {
		return nil, err
	}

	feeConfigAddr := common.HexToAddress(FdcFeeConfigAddress)
	contract := bind.NewBoundContract(feeConfigAddr, parsed, fs.client, fs.client, fs.client)

	var result []interface{}
	err = contract.Call(&bind.CallOpts{Context: ctx}, &result, "getRequestFee", requestBytes)
	if err != nil {
		return nil, err
	}

	return result[0].(*big.Int), nil
}

// waitForRoundFinalization polls the DA layer until the voting round is finalized
func (fs *FDCSubmitter) waitForRoundFinalization(ctx context.Context, roundID uint64) error {
	statusURL := fmt.Sprintf("%s/api/v0/fsp/status", DALayerBaseURL)
	maxWait := 5 * time.Minute
	pollInterval := 10 * time.Second
	deadline := time.Now().Add(maxWait)

	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting for round %d finalization", roundID)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(pollInterval):
		}

		req, err := http.NewRequestWithContext(ctx, "GET", statusURL, nil)
		if err != nil {
			continue
		}
		if fs.apiKey != "" {
			req.Header.Set("X-API-KEY", fs.apiKey)
		}

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Debug().Err(err).Msg("Failed to check FDC status, retrying")
			continue
		}

		var status struct {
			LatestFDC struct {
				VotingRoundID uint64 `json:"voting_round_id"`
			} `json:"latest_fdc"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
			resp.Body.Close()
			continue
		}
		resp.Body.Close()

		log.Debug().
			Uint64("target_round", roundID).
			Uint64("latest_fdc_round", status.LatestFDC.VotingRoundID).
			Msg("Checking FDC round finalization")

		if status.LatestFDC.VotingRoundID >= roundID {
			log.Info().
				Uint64("round_id", roundID).
				Msg("FDC round finalized")
			return nil
		}
	}
}

// fetchProofFromDALayer fetches the proof from the Data Availability Layer
func (fs *FDCSubmitter) fetchProofFromDALayer(ctx context.Context, roundID uint64, requestBytes string) (*FDCProof, error) {
	url := fmt.Sprintf("%s/api/v1/fdc/proof-by-request-round", DALayerBaseURL)

	requestBody := map[string]interface{}{
		"votingRoundId": roundID,
		"requestBytes":  requestBytes,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	log.Debug().
		Str("url", url).
		Uint64("round_id", roundID).
		Msg("Fetching proof from DA layer")

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if fs.apiKey != "" {
		req.Header.Set("x-api-key", fs.apiKey)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read DA response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DA layer returned status %d: %s", resp.StatusCode, string(respBody))
	}

	log.Debug().
		Str("response", string(respBody)).
		Msg("DA layer proof response")

	var result struct {
		Proof    []string    `json:"proof"`
		Response interface{} `json:"response"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode DA response: %w", err)
	}

	if len(result.Proof) == 0 {
		return nil, fmt.Errorf("DA layer returned empty proof (request may not have been included in round)")
	}

	return &FDCProof{
		MerkleProof: result.Proof,
		Response:    result.Response,
		RoundID:     roundID,
	}, nil
}

// fundEscrowForRedemption sends the required amount to the EscrowVault so releaseOnFDC can transfer funds
func (fs *FDCSubmitter) fundEscrowForRedemption(ctx context.Context, redemptionID *big.Int) error {
	// Query escrow amount from the vault
	const escrowABI = `[{
		"inputs": [{"name": "", "type": "uint256"}],
		"name": "escrows",
		"outputs": [
			{"name": "redemptionId", "type": "uint256"},
			{"name": "user", "type": "address"},
			{"name": "lp", "type": "address"},
			{"name": "asset", "type": "address"},
			{"name": "amount", "type": "uint256"},
			{"name": "createdAt", "type": "uint256"},
			{"name": "fdcRoundId", "type": "uint256"},
			{"name": "status", "type": "uint8"},
			{"name": "lpFunded", "type": "bool"}
		],
		"stateMutability": "view",
		"type": "function"
	}]`

	parsed, err := abi.JSON(strings.NewReader(escrowABI))
	if err != nil {
		return fmt.Errorf("failed to parse escrow ABI: %w", err)
	}

	contract := bind.NewBoundContract(fs.escrowVault, parsed, fs.client, fs.client, fs.client)
	var result []interface{}
	err = contract.Call(&bind.CallOpts{Context: ctx}, &result, "escrows", redemptionID)
	if err != nil {
		return fmt.Errorf("failed to query escrow: %w", err)
	}

	// amount is the 5th field (index 4)
	amount := result[4].(*big.Int)
	if amount.Sign() == 0 {
		return nil // No funding needed
	}

	// Check if vault already has sufficient balance
	vaultBalance, err := fs.client.BalanceAt(ctx, fs.escrowVault, nil)
	if err != nil {
		return fmt.Errorf("failed to check vault balance: %w", err)
	}
	if vaultBalance.Cmp(amount) >= 0 {
		log.Debug().
			Str("vault_balance", vaultBalance.String()).
			Str("required", amount.String()).
			Msg("EscrowVault already has sufficient balance")
		return nil
	}

	// Send the required amount to the escrow vault
	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(fs.privateKey, "0x"))
	if err != nil {
		return fmt.Errorf("failed to parse private key: %w", err)
	}

	chainID := big.NewInt(fs.chainID)
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return fmt.Errorf("failed to create transactor: %w", err)
	}

	nonce, err := fs.client.PendingNonceAt(ctx, auth.From)
	if err != nil {
		return fmt.Errorf("failed to get nonce: %w", err)
	}

	gasPrice, err := fs.client.SuggestGasPrice(ctx)
	if err != nil {
		return fmt.Errorf("failed to get gas price: %w", err)
	}

	escrowAddr := fs.escrowVault
	tx := types.NewTx(&types.LegacyTx{
		Nonce:    nonce,
		To:       &escrowAddr,
		Value:    amount,
		Gas:      21000,
		GasPrice: gasPrice,
	})
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		return fmt.Errorf("failed to sign funding tx: %w", err)
	}

	err = fs.client.SendTransaction(ctx, signedTx)
	if err != nil {
		return fmt.Errorf("failed to send funding tx: %w", err)
	}

	log.Info().
		Str("tx_hash", signedTx.Hash().Hex()).
		Str("amount", amount.String()).
		Msg("Funding EscrowVault for redemption release")

	receipt, err := bind.WaitMined(ctx, fs.client, signedTx)
	if err != nil {
		return fmt.Errorf("failed to wait for funding tx: %w", err)
	}

	if receipt.Status != 1 {
		return fmt.Errorf("funding tx failed with status %d", receipt.Status)
	}

	return nil
}

// SubmitProof submits the FDC proof to FLIPCore to finalize the redemption
func (fs *FDCSubmitter) SubmitProof(ctx context.Context, redemptionID *big.Int, proof *FDCProof) error {
	// Parse the FDC response to determine payment success
	// The Payment response includes status: 0=SUCCESS, 1=SENDER_FAILURE, 2=RECEIVER_FAILURE
	success := true // Default to success if we got a valid proof
	requestID := big.NewInt(int64(proof.RoundID))

	// Try to extract status from response if it's a map
	if respMap, ok := proof.Response.(map[string]interface{}); ok {
		if responseBody, ok := respMap["responseBody"].(map[string]interface{}); ok {
			if status, ok := responseBody["status"]; ok {
				statusFloat, _ := status.(float64)
				success = int(statusFloat) == 0 // 0 = SUCCESS
			}
		}
	}

	// Fund the EscrowVault so releaseOnFDC can transfer funds to the user
	if success {
		if err := fs.fundEscrowForRedemption(ctx, redemptionID); err != nil {
			return fmt.Errorf("failed to fund escrow vault: %w", err)
		}
	}

	const handleFDCABI = `[{
		"inputs": [
			{"name": "_redemptionId", "type": "uint256"},
			{"name": "_requestId", "type": "uint256"},
			{"name": "_success", "type": "bool"}
		],
		"name": "handleFDCAttestation",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}]`

	parsed, err := abi.JSON(strings.NewReader(handleFDCABI))
	if err != nil {
		return fmt.Errorf("failed to parse ABI: %w", err)
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(fs.privateKey, "0x"))
	if err != nil {
		return fmt.Errorf("failed to parse private key: %w", err)
	}

	chainID := big.NewInt(fs.chainID)
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return fmt.Errorf("failed to create transactor: %w", err)
	}

	nonce, err := fs.client.PendingNonceAt(ctx, auth.From)
	if err != nil {
		return fmt.Errorf("failed to get nonce: %w", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))

	gasPrice, err := fs.client.SuggestGasPrice(ctx)
	if err != nil {
		return fmt.Errorf("failed to get gas price: %w", err)
	}
	auth.GasPrice = gasPrice
	auth.GasLimit = uint64(200000)

	contract := bind.NewBoundContract(fs.flipCore, parsed, fs.client, fs.client, fs.client)

	tx, err := contract.Transact(auth, "handleFDCAttestation", redemptionID, requestID, success)
	if err != nil {
		return fmt.Errorf("failed to send handleFDCAttestation tx: %w", err)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Uint64("redemption_id", redemptionID.Uint64()).
		Bool("success", success).
		Msg("Submitted FDC attestation to FLIPCore")

	receipt, err := bind.WaitMined(ctx, fs.client, tx)
	if err != nil {
		return fmt.Errorf("failed to wait for handleFDCAttestation tx: %w", err)
	}

	if receipt.Status != 1 {
		return fmt.Errorf("handleFDCAttestation tx failed with status %d", receipt.Status)
	}

	log.Info().
		Str("tx_hash", tx.Hash().Hex()).
		Uint64("redemption_id", redemptionID.Uint64()).
		Bool("success", success).
		Msg("FDC attestation finalized on FLIPCore")

	return nil
}
