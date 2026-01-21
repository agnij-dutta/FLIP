package main

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// XRPLClient handles XRPL connections and operations
type XRPLClient struct {
	rpcURL string
	wallet *XRPLWallet
}

// XRPLWallet represents an XRPL wallet
type XRPLWallet struct {
	Address string
	Seed    string
}

// NewXRPLClient creates a new XRPL client
func NewXRPLClient(config *Config) (*XRPLClient, error) {
	// For now, we'll derive the address from the seed using a simple approach
	// In production, use proper XRPL key derivation
	// For testnet, we can use the seed directly with xrpl.js or similar
	// For MVP, we'll extract address via account_info call
	
	wallet := &XRPLWallet{
		Seed: config.XRPL.WalletSeed,
	}

	// For MVP, address will be derived by Node.js bridge when needed
	// In production, derive address from seed properly using XRPL key derivation
	client := &XRPLClient{
		rpcURL: config.XRPL.TestnetRPC,
		wallet: wallet,
	}

	// Derive address using Node.js (temporary solution)
	// In production, use proper Go XRPL library
	cmd := exec.Command("node", "-e", fmt.Sprintf(`
		const xrpl = require('xrpl');
		const wallet = xrpl.Wallet.fromSeed('%s');
		console.log(wallet.address);
	`, config.XRPL.WalletSeed))
	output, err := cmd.Output()
	if err == nil {
		wallet.Address = strings.TrimSpace(string(output))
		log.Info().
			Str("address", wallet.Address).
			Msg("XRPL wallet address derived")
	} else {
		// Fallback: address will be derived by bridge script
		log.Warn().
			Msg("Could not derive address, will be handled by bridge script")
	}

	return client, nil
}

// GetBalance gets the XRP balance for the wallet
func (c *XRPLClient) GetBalance(ctx context.Context) (string, error) {
	reqBody := map[string]interface{}{
		"method": "account_info",
		"params": []map[string]interface{}{
			{
				"account":      c.wallet.Address,
				"strict":       true,
				"ledger_index": "validated",
			},
		},
	}

	var result struct {
		Result struct {
			AccountData struct {
				Balance string `json:"Balance"`
			} `json:"account_data"`
		} `json:"result"`
	}

	if err := c.callRPC(ctx, reqBody, &result); err != nil {
		return "0", err
	}

	// Convert XRP to drops (1 XRP = 1,000,000 drops)
	balanceFloat, err := strconv.ParseFloat(result.Result.AccountData.Balance, 64)
	if err != nil {
		return "0", fmt.Errorf("failed to parse balance: %w", err)
	}

	drops := int64(balanceFloat * 1_000_000)
	return strconv.FormatInt(drops, 10), nil
}

// SendPayment sends an XRP payment with a memo
func (c *XRPLClient) SendPayment(ctx context.Context, destination string, amountDrops string, memoData string) (string, error) {
	log.Info().
		Str("destination", destination).
		Str("amount", amountDrops).
		Str("memo", memoData).
		Msg("Sending XRP payment")

	// Parse amount from drops string
	amountInt, err := strconv.ParseInt(amountDrops, 10, 64)
	if err != nil {
		return "", fmt.Errorf("invalid amount: %w", err)
	}

	// Convert drops to XRP amount string
	amountXRP := float64(amountInt) / 1_000_000
	amountStr := strconv.FormatFloat(amountXRP, 'f', 6, 64)

	// Get account info for sequence number
	accountInfoReq := map[string]interface{}{
		"method": "account_info",
		"params": []map[string]interface{}{
			{
				"account":      c.wallet.Address,
				"strict":       true,
				"ledger_index": "validated",
			},
		},
	}

	var accountInfo struct {
		Result struct {
			AccountData struct {
				Sequence json.Number `json:"Sequence"`
			} `json:"account_data"`
		} `json:"result"`
	}

	if err := c.callRPC(ctx, accountInfoReq, &accountInfo); err != nil {
		return "", fmt.Errorf("failed to get account info: %w", err)
	}

	// Build payment transaction
	paymentTx := map[string]interface{}{
		"TransactionType": "Payment",
		"Account":         c.wallet.Address,
		"Destination":     destination,
		"Amount":          amountStr,
		"Sequence":        accountInfo.Result.AccountData.Sequence,
		"Fee":             "12", // Minimum fee in drops
	}

	// Add memo if provided
	if memoData != "" {
		memoBytes := []byte(memoData)
		paymentTx["Memos"] = []map[string]interface{}{
			{
				"Memo": map[string]interface{}{
					"MemoData": hex.EncodeToString(memoBytes),
				},
			},
		}
	}

	// Use Node.js bridge script for XRPL payments
	// Get absolute path to bridge script
	bridgePath, err := filepath.Abs("./xrpl_bridge.js")
	if err != nil {
		return "", fmt.Errorf("failed to get bridge script path: %w", err)
	}
	
	cmd := exec.CommandContext(ctx, "node", bridgePath, c.wallet.Seed, destination, amountDrops, memoData)
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to execute XRPL bridge: %w, output: %s", err, string(output))
	}

	var result struct {
		Success bool   `json:"success"`
		TxHash  string `json:"txHash"`
		Error   string `json:"error"`
	}

	if err := json.Unmarshal(output, &result); err != nil {
		return "", fmt.Errorf("failed to parse bridge output: %w, output: %s", err, string(output))
	}

	if !result.Success {
		return "", fmt.Errorf("XRPL payment failed: %s", result.Error)
	}

	txHash := result.TxHash
	log.Info().
		Str("tx_hash", txHash).
		Msg("XRP payment submitted successfully")

	return txHash, nil
}

// WaitForFinalization waits for XRPL transaction finalization
func (c *XRPLClient) WaitForFinalization(ctx context.Context, txHash string) error {
	maxAttempts := 10
	for i := 0; i < maxAttempts; i++ {
		req := map[string]interface{}{
			"method": "tx",
			"params": []map[string]interface{}{
				{
					"transaction": txHash,
					"binary":      false,
				},
			},
		}

		var result struct {
			Result struct {
				Validated bool `json:"validated"`
			} `json:"result"`
		}

		if err := c.callRPC(ctx, req, &result); err == nil && result.Result.Validated {
			log.Info().
				Str("tx_hash", txHash).
				Msg("Transaction finalized")
			return nil
		}
		time.Sleep(1 * time.Second)
	}
	return fmt.Errorf("transaction not finalized after %d attempts", maxAttempts)
}

// callRPC makes an HTTP JSON-RPC call to XRPL
func (c *XRPLClient) callRPC(ctx context.Context, reqBody map[string]interface{}, result interface{}) error {
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.rpcURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if err := json.Unmarshal(body, result); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return nil
}

