"""FDC (Flare Data Connector) attestation event scraper - Real implementation.

Scrapes StateConnector attestation events from Flare networks.
"""
import os
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from web3 import Web3
try:
    from web3.middleware import geth_poa_middleware
except ImportError:
    # web3.py v6+ compatibility
    try:
        from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware
    except ImportError:
        # If middleware not available, we'll skip it (POA networks may work without it)
        geth_poa_middleware = None
from web3 import types
import pandas as pd

# Flare network RPC endpoints
FLARE_MAINNET_RPC = "https://flare-api.flare.network/ext/C/rpc"
FLARE_COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc"
FLARE_SONGBIRD_RPC = "https://songbird-api.flare.network/ext/C/rpc"

# State Connector addresses
# Mainnet: https://flarescan.com/address/0x1000000000000000000000000000000000000001
STATE_CONNECTOR_MAINNET = "0x1000000000000000000000000000000000000001"
STATE_CONNECTOR_COSTON2 = "0x1000000000000000000000000000000000000001"
STATE_CONNECTOR_SONGBIRD = "0x1000000000000000000000000000000000000001"

# State Connector ABI
STATE_CONNECTOR_ABI = [
    {
        "name": "getStateConnectorRound",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "getAttestation",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_roundId", "type": "uint256"}],
        "outputs": [
            {"name": "_merkleRoot", "type": "bytes32"},
            {"name": "_timestamp", "type": "uint256"},
        ],
    },
    {
        "name": "Attestation",
        "type": "event",
    "inputs": [
        {"indexed": True, "name": "_requestId", "type": "uint256"},
            {"name": "_merkleRoot", "type": "bytes32"},
            {"name": "_timestamp", "type": "uint256"},
    ],
    },
]

# Event signature for filtering
ATTESTATION_EVENT_TOPIC = "0x..."  # keccak256("Attestation(uint256,bytes32,uint256)")


def get_web3(rpc_url: str) -> Web3:
    """Create Web3 connection."""
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    # Flare uses PoA consensus, add middleware if available
    if geth_poa_middleware is not None:
        try:
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        except Exception as e:
            # Middleware injection failed, continue without it
            print(f"Warning: Could not inject POA middleware: {e}")
    
    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to {rpc_url}")
    
    return w3


def get_state_connector_address(network: str = "coston2") -> str:
    """Get State Connector address for network."""
    addresses = {
        "mainnet": STATE_CONNECTOR_MAINNET,
        "coston2": STATE_CONNECTOR_COSTON2,
        "songbird": STATE_CONNECTOR_SONGBIRD,
    }
    return addresses.get(network, STATE_CONNECTOR_COSTON2)


def get_rpc_url(network: str = "coston2") -> str:
    """Get RPC URL for network."""
    urls = {
        "mainnet": FLARE_MAINNET_RPC,
        "coston2": FLARE_COSTON2_RPC,
        "songbird": FLARE_SONGBIRD_RPC,
    }
    return urls.get(network, FLARE_COSTON2_RPC)


def fetch_attestations(
    from_block: int,
    to_block: int,
    network: str = "coston2",
) -> List[Dict[str, Any]]:
    """Fetch Attestation events from State Connector."""
    rpc_url = get_rpc_url(network)
    state_connector_addr = get_state_connector_address(network)
    
    w3 = get_web3(rpc_url)
    state_connector = w3.eth.contract(
        address=state_connector_addr,
        abi=STATE_CONNECTOR_ABI
    )
    
    # Get Attestation events using w3.eth.get_logs (for historical data)
    # Note: RPC nodes have block range limits (typically 30-1000 blocks)
    # We need to chunk large queries into smaller ranges
    attestations = []
    
    # RPC block range limit (conservative - most nodes allow 30-1000)
    MAX_BLOCKS_PER_QUERY = 30
    
    try:
        # Get the event signature/topic using keccak256 hash
        # Event signature: Attestation(uint256,bytes32,uint256)
        from eth_utils import keccak, to_bytes, text_if_str
        event_signature_text = "Attestation(uint256,bytes32,uint256)"
        event_signature = keccak(text_if_str(to_bytes, event_signature_text))
        
        # Chunk the block range into smaller queries
        total_blocks = to_block - from_block + 1
        num_chunks = (total_blocks + MAX_BLOCKS_PER_QUERY - 1) // MAX_BLOCKS_PER_QUERY
        
        if num_chunks > 1:
            print(f"Querying {total_blocks} blocks in {num_chunks} chunks (max {MAX_BLOCKS_PER_QUERY} blocks per chunk)...")
        
        chunks_with_data = 0
        for chunk_idx in range(num_chunks):
            chunk_from = from_block + (chunk_idx * MAX_BLOCKS_PER_QUERY)
            chunk_to = min(chunk_from + MAX_BLOCKS_PER_QUERY - 1, to_block)
            
            try:
                # Use w3.eth.get_logs with filter dict (web3.py v6+ compatible)
                logs = w3.eth.get_logs({
                    'fromBlock': chunk_from,
                    'toBlock': chunk_to,
                    'address': state_connector_addr,
                    'topics': [event_signature]
                })
                
                if logs:
                    chunks_with_data += 1
                
                # Decode each log
                for log in logs:
                    try:
                        decoded = state_connector.events.Attestation().process_log(log)
                        merkle_root = decoded.args._merkleRoot
                        if hasattr(merkle_root, 'hex'):
                            merkle_root_str = merkle_root.hex()
                        elif isinstance(merkle_root, bytes):
                            merkle_root_str = merkle_root.hex()
                        else:
                            merkle_root_str = str(merkle_root)
                        
                        attestations.append({
                            "request_id": decoded.args._requestId,
                            "merkle_root": merkle_root_str,
                            "timestamp": decoded.args._timestamp,
                            "block_number": log.blockNumber,
                            "transaction_hash": log.transactionHash.hex(),
                            "network": network,
                        })
                    except Exception as decode_error:
                        print(f"Error decoding event log: {decode_error}")
                        continue
                
                # Small delay between chunks to avoid rate limiting
                if chunk_idx < num_chunks - 1:
                    time.sleep(0.1)
                    
            except Exception as chunk_error:
                # Check if it's the "too many blocks" error - might need smaller chunks
                if "too many blocks" in str(chunk_error).lower():
                    # Try with even smaller chunks (10 blocks)
                    try:
                        smaller_chunk_from = chunk_from
                        smaller_chunk_to = min(chunk_from + 9, chunk_to)  # 10 blocks max
                        logs = w3.eth.get_logs({
                            'fromBlock': smaller_chunk_from,
                            'toBlock': smaller_chunk_to,
                            'address': state_connector_addr,
                            'topics': [event_signature]
                        })
                        if logs:
                            chunks_with_data += 1
                        for log in logs:
                            try:
                                decoded = state_connector.events.Attestation().process_log(log)
                                merkle_root = decoded.args._merkleRoot
                                if hasattr(merkle_root, 'hex'):
                                    merkle_root_str = merkle_root.hex()
                                elif isinstance(merkle_root, bytes):
                                    merkle_root_str = merkle_root.hex()
                                else:
                                    merkle_root_str = str(merkle_root)
                                attestations.append({
                                    "request_id": decoded.args._requestId,
                                    "merkle_root": merkle_root_str,
                                    "timestamp": decoded.args._timestamp,
                                    "block_number": log.blockNumber,
                                    "transaction_hash": log.transactionHash.hex(),
                                    "network": network,
                                })
                            except Exception:
                                continue
                    except Exception:
                        pass
                print(f"Error fetching chunk {chunk_idx + 1}/{num_chunks} (blocks {chunk_from}-{chunk_to}): {chunk_error}")
                continue
        
        if num_chunks > 1:
            print(f"Completed querying {len(attestations)} attestations from {num_chunks} chunks ({chunks_with_data} chunks had data)")
            if len(attestations) == 0:
                print("ℹ️  Note: StateConnector events are rare on testnet (typically every 3-5 minutes when there's activity)")
                print("   This is normal - synthetic data will be used for demonstration")
            
    except Exception as e:
        print(f"Error fetching attestations: {e}")
        import traceback
        traceback.print_exc()
    
    return attestations


def get_recent_attestations(
    hours: int = 24,
    network: str = "coston2",
    use_enhanced: bool = True,
) -> pd.DataFrame:
    """Get recent attestations using multiple methods.
    
    Tries enhanced methods first (API + FAsset correlation), then falls back
    to event-based queries if enhanced methods are unavailable.
    
    Args:
        hours: Hours of history to fetch
        network: Network name
        use_enhanced: If True, try API and FAsset correlation first
    """
    # Try enhanced methods first (API + redemption correlation)
    if use_enhanced:
        try:
            from fdc_api import get_recent_attestations_enhanced
            df = get_recent_attestations_enhanced(hours=hours, network=network, asset="FXRP")
            if not df.empty:
                return df
        except ImportError:
            # fdc_api module not available, continue with standard method
            pass
        except Exception as e:
            print(f"⚠️  Enhanced method failed: {e}, falling back to standard method")
    
    # Fall back to standard event-based query
    print("Falling back to event-based query...")
    rpc_url = get_rpc_url(network)
    w3 = get_web3(rpc_url)
    current_block = w3.eth.block_number
    blocks_per_hour = 2000
    from_block = max(0, current_block - (hours * blocks_per_hour))
    
    attestations = fetch_attestations(from_block, current_block, network)
    
    if not attestations:
        print(f"ℹ️  No attestations found in last {hours} hours")
        return pd.DataFrame()
    
    df = pd.DataFrame(attestations)
    df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
    df = df.sort_values('block_number')
    
    return df


def get_current_round(network: str = "coston2") -> int:
    """Get current State Connector round ID."""
    rpc_url = get_rpc_url(network)
    state_connector_addr = get_state_connector_address(network)
    
    w3 = get_web3(rpc_url)
    state_connector = w3.eth.contract(
        address=state_connector_addr,
        abi=STATE_CONNECTOR_ABI
    )
    
    try:
        round_id = state_connector.functions.getStateConnectorRound().call()
        return round_id
    except Exception as e:
        print(f"Error getting current round: {e}")
        return 0


def get_attestation_by_round(round_id: int, network: str = "coston2") -> Optional[Dict[str, Any]]:
    """Get attestation data for a specific round."""
    rpc_url = get_rpc_url(network)
    state_connector_addr = get_state_connector_address(network)
    
    w3 = get_web3(rpc_url)
    state_connector = w3.eth.contract(
        address=state_connector_addr,
        abi=STATE_CONNECTOR_ABI
    )
    
    try:
        merkle_root, timestamp = state_connector.functions.getAttestation(round_id).call()
        return {
            "round_id": round_id,
            "merkle_root": merkle_root.hex(),
            "timestamp": timestamp,
            "network": network,
        }
    except Exception as e:
        print(f"Error getting attestation for round {round_id}: {e}")
        return None


if __name__ == "__main__":
    network = os.getenv("FLARE_NETWORK", "coston2")
    
    print(f"Fetching FDC attestations on {network}...")
    
    # Get current round
    current_round = get_current_round(network)
    print(f"Current State Connector round: {current_round}")
    
    # Get recent attestations
    df = get_recent_attestations(hours=24, network=network)
    if not df.empty:
        print(f"\nCollected {len(df)} attestations")
        print(df.head())
        print(f"\nAttestation frequency: {len(df) / 24:.2f} per hour")
    else:
        print("No attestations found")
