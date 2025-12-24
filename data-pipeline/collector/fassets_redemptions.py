"""FAssets redemption event collector.

Requires:
- FLARE_RPC endpoint
- FASSET_TOKEN_ADDRESS (ERC20/FAsset)
- Optional agent/registry addresses for richer context
"""
import os
from typing import List, Dict, Any
from web3 import Web3

FLARE_RPC = os.getenv("FLARE_RPC", "https://coston2-api.flare.network/ext/C/rpc")
FASSET_TOKEN = os.getenv("FASSET_TOKEN_ADDRESS")

# Simplified events (adjust to actual FAsset ABI)
REDEMPTION_REQUESTED = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "user", "type": "address"},
        {"indexed": False, "name": "amount", "type": "uint256"},
        {"indexed": True, "name": "redemptionId", "type": "uint256"},
    ],
    "name": "RedemptionRequested",
    "type": "event",
}

REDEMPTION_COMPLETED = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "user", "type": "address"},
        {"indexed": False, "name": "amount", "type": "uint256"},
        {"indexed": True, "name": "redemptionId", "type": "uint256"},
    ],
    "name": "RedemptionCompleted",
    "type": "event",
}

REDEMPTION_FAILED = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "user", "type": "address"},
        {"indexed": False, "name": "amount", "type": "uint256"},
        {"indexed": True, "name": "redemptionId", "type": "uint256"},
    ],
    "name": "RedemptionFailed",
    "type": "event",
}

FASSET_ABI = [REDEMPTION_REQUESTED, REDEMPTION_COMPLETED, REDEMPTION_FAILED]


def get_web3() -> Web3:
    return Web3(Web3.HTTPProvider(FLARE_RPC))


def fetch_events(from_block: int, to_block: int) -> Dict[str, List[Dict[str, Any]]]:
    w3 = get_web3()
    token = w3.eth.contract(address=FASSET_TOKEN, abi=FASSET_ABI)
    events = {
        "requested": token.events.RedemptionRequested().get_logs(fromBlock=from_block, toBlock=to_block),
        "completed": token.events.RedemptionCompleted().get_logs(fromBlock=from_block, toBlock=to_block),
        "failed": token.events.RedemptionFailed().get_logs(fromBlock=from_block, toBlock=to_block),
    }
    def normalize(raw):
        return [
            {
                "user": e["args"]["user"],
                "amount": e["args"]["amount"],
                "redemptionId": e["args"]["redemptionId"],
                "txHash": e["transactionHash"].hex(),
                "blockNumber": e["blockNumber"],
            }
            for e in raw
        ]
    return {k: normalize(v) for k, v in events.items()}


if __name__ == "__main__":
    w3 = get_web3()
    latest = w3.eth.block_number
    start = max(0, latest - 2000)
    print(fetch_events(start, latest))
