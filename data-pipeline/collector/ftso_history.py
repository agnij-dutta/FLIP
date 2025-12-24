"""FTSO historical price fetcher (block-latency feeds, ~1.8s cadence).

Notes:
- FTSOv2 exposes on-chain block-latency feeds and scaling feeds.
- Historical on-chain access is ~2 weeks; for longer windows use external archive/provider.
- Requires environment variables for RPC endpoints and target FTSO symbol.
"""
import os
from typing import Optional, Dict, Any
from web3 import Web3

FLARE_RPC = os.getenv("FLARE_RPC", "https://coston2-api.flare.network/ext/C/rpc")
FTSO_REGISTRY = os.getenv("FTSO_REGISTRY_ADDRESS")  # should point to IFtsoRegistry

# Minimal ABI fragments
FTSO_REGISTRY_ABI = [
    {
        "name": "getFtsoBySymbol",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_symbol", "type": "string"}],
        "outputs": [{"name": "", "type": "address"}],
    },
    {
        "name": "getCurrentPriceWithDecimals",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_symbol", "type": "string"}],
        "outputs": [
            {"name": "_price", "type": "uint256"},
            {"name": "_timestamp", "type": "uint256"},
        ],
    },
]

FTSO_ABI = [
    {
        "name": "getPrice",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_epochId", "type": "uint256"}],
        "outputs": [
            {"name": "_price", "type": "uint256"},
            {"name": "_timestamp", "type": "uint256"},
        ],
    }
]


def get_web3() -> Web3:
    return Web3(Web3.HTTPProvider(FLARE_RPC))


def resolve_ftso_address(symbol: str, w3: Web3) -> str:
    registry = w3.eth.contract(address=FTSO_REGISTRY, abi=FTSO_REGISTRY_ABI)
    return registry.functions.getFtsoBySymbol(symbol).call()


def latest_price(symbol: str) -> Dict[str, Any]:
    w3 = get_web3()
    ftso_addr = resolve_ftso_address(symbol, w3)
    registry = w3.eth.contract(address=FTSO_REGISTRY, abi=FTSO_REGISTRY_ABI)
    price, ts = registry.functions.getCurrentPriceWithDecimals(symbol).call()
    return {"symbol": symbol, "price": price, "timestamp": ts, "ftso": ftso_addr}


def historical_price(symbol: str, epoch_id: int) -> Dict[str, Any]:
    w3 = get_web3()
    ftso_addr = resolve_ftso_address(symbol, w3)
    ftso = w3.eth.contract(address=ftso_addr, abi=FTSO_ABI)
    price, ts = ftso.functions.getPrice(epoch_id).call()
    return {"symbol": symbol, "price": price, "timestamp": ts, "epoch": epoch_id}


if __name__ == "__main__":
    symbol = os.getenv("FTSO_SYMBOL", "XRP")
    print(latest_price(symbol))
