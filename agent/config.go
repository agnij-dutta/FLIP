package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Flare FlareConfig `yaml:"flare"`
	XRPL  XRPLConfig  `yaml:"xrpl"`
	FDC   FDCConfig   `yaml:"fdc"`
	Agent AgentConfig `yaml:"agent"`
}

type FlareConfig struct {
	RPCURL             string `yaml:"rpc_url"`
	ChainID            int64  `yaml:"chain_id"`
	FLIPCoreAddress    string `yaml:"flip_core_address"`
	EscrowVaultAddress string `yaml:"escrow_vault_address"`
	PrivateKey         string // Loaded from PRIVATE_KEY env var (not in YAML)
}

type XRPLConfig struct {
	TestnetWS   string `yaml:"testnet_ws"`
	TestnetRPC  string `yaml:"testnet_rpc"`
	WalletSeed  string `yaml:"wallet_seed"`
}

type FDCConfig struct {
	VerifierURL string `yaml:"verifier_url"`
	DALayerURL  string `yaml:"da_layer_url"`
	APIKey      string `yaml:"api_key"`
}

type AgentConfig struct {
	PollingInterval   int    `yaml:"polling_interval"`
	MaxPaymentRetries int    `yaml:"max_payment_retries"`
	PaymentRetryDelay int    `yaml:"payment_retry_delay"`
	FDCTimeout        int    `yaml:"fdc_timeout"`
	MinXRPBalance     uint64 `yaml:"min_xrp_balance"`
}

func LoadConfig(path string) (*Config, error) {
	// Load .env file from project root (one level up from agent directory)
	configDir := filepath.Dir(path)
	envPath := filepath.Join(configDir, "..", ".env")
	if err := godotenv.Load(envPath); err != nil {
		// Try current directory as fallback
		if err := godotenv.Load(".env"); err != nil {
			// Try project root directly
			if err := godotenv.Load("../.env"); err != nil {
				fmt.Printf("Warning: Could not load .env file: %v\n", err)
			}
		}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	// Load private key from environment variable
	config.Flare.PrivateKey = os.Getenv("PRIVATE_KEY")

	// Validate required fields
	if config.Flare.RPCURL == "" {
		return nil, fmt.Errorf("flare.rpc_url is required")
	}
	if config.Flare.FLIPCoreAddress == "" {
		return nil, fmt.Errorf("flare.flip_core_address is required")
	}
	if config.XRPL.WalletSeed == "" || config.XRPL.WalletSeed == "sYOUR_WALLET_SEED_HERE" {
		return nil, fmt.Errorf("xrpl.wallet_seed must be set")
	}
	if config.Flare.PrivateKey == "" {
		fmt.Println("Warning: PRIVATE_KEY not set in .env - automatic redemption processing disabled")
	}

	return &config, nil
}

