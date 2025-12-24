"""FDC attestation scraper using StateConnector events.

Requires:
- FLARE_RPC (HTTP/WSS)
- STATE_CONNECTOR_ADDRESS (contract emitting Attestation events)

Outputs attestation metadata for downstream storage.
"""
import os
from typing import List, Dict, Any
from web3 import Web3

FLARE_RPC = os.getenv("FLARE_RPC", "https://coston2-api.flare.network/ext/C/rpc")
STATE_CONNECTOR = os.getenv("STATE_CONNECTOR_ADDRESS")

ATTESTATION_EVENT = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "_requestId", "type": "uint256"},
        {"indexed": False, "name": "_merkleRoot", "type": "bytes32"},
        {"indexed": False, "name": "_timestamp", "type": "uint256"},
    ],
    "name": "Attestation",
    "type": "event",
}

STATE_CONNECTOR_ABI = [ATTESTATION_EVENT]


def get_web3() -> Web3:
    return Web3(Web3.HTTPProvider(FLARE_RPC))


def fetch_attestations(from_block: int, to_block: int) -> List[Dict[str, Any]]:
    w3 = get_web3()
    sc = w3.eth.contract(address=STATE_CONNECTOR, abi=STATE_CONNECTOR_ABI)
    logs = sc.events.Attestation().get_logs(fromBlock=from_block, toBlock=to_block)
    results = []
    for log in logs:
        results.append(
            {
                "requestId": log["args"]["_requestId"],
                "merkleRoot": log["args"]["_merkleRoot"].hex(),
                "timestamp": log["args"]["_timestamp"],
                "blockNumber": log["blockNumber"],
                "txHash": log["transactionHash"].hex(),
            }
        )
    return results


if __name__ == "__main__":
    latest = Web3(Web3.HTTPProvider(FLARE_RPC)).eth.block_number
    start = max(0, latest - 2000)
    print(fetch_attestations(start, latest))
