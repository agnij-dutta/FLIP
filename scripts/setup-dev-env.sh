#!/usr/bin/env bash
set -euo pipefail

# Foundry install (skip if already installed)
if ! command -v forge >/dev/null 2>&1; then
  curl -L https://foundry.paradigm.xyz | bash
  source "$HOME/.foundry/bin"/foundryup
  foundryup
fi

# Node/Hardhat setup (requires npm)
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required for Hardhat. Please install Node.js (>=18)." >&2
fi

# Python virtualenv for ML
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for ML tooling." >&2
fi

# Go toolchain for oracle nodes
if ! command -v go >/dev/null 2>&1; then
  echo "Go toolchain is required for oracle nodes (>=1.21)." >&2
fi

# Network configuration
export FLARE_MAINNET_RPC="https://flare-api.flare.network/ext/C/rpc"
export FLARE_MAINNET_CHAIN_ID=14
export FLARE_COSTON2_RPC="https://coston2-api.flare.network/ext/C/rpc"
export FLARE_COSTON2_CHAIN_ID=114
export FLARE_MAINNET_WSS="wss://flare-api.flare.network/ext/C/ws"
export FLARE_COSTON2_WSS="wss://coston2-api.flare.network/ext/C/ws"

# Testnet faucet info
export FLARE_COSTON2_FAUCET="https://faucet.flare.network/coston2"

cat <<'MSG'
Dev env configured:
- Foundry installed (forge/cast/anvil)
- Hardhat expected via npm (package.json included)
- Python3 virtualenv recommended: python3 -m venv .venv && source .venv/bin/activate && pip install -r ml/requirements.txt
- Go toolchain for oracle nodes (go1.21+)
RPC:
  Mainnet: $FLARE_MAINNET_RPC (chainId 14)
  Coston2: $FLARE_COSTON2_RPC (chainId 114)
WSS:
  Mainnet: $FLARE_MAINNET_WSS
  Coston2: $FLARE_COSTON2_WSS
Faucet:
  Coston2: $FLARE_COSTON2_FAUCET
MSG
