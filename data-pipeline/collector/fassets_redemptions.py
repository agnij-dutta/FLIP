"""FAssets redemption history collector - Real implementation.

Collects FAssets redemption events from Flare networks.
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
import pandas as pd

# Flare network RPC endpoints
FLARE_MAINNET_RPC = "https://flare-api.flare.network/ext/C/rpc"
FLARE_COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc"
FLARE_SONGBIRD_RPC = "https://songbird-api.flare.network/ext/C/rpc"

# Flare Contract Registry - same address across all networks
FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019"

# Contract Registry ABI
CONTRACT_REGISTRY_ABI = [
    {
        "name": "getContractAddressByName",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_name", "type": "string"}],
        "outputs": [{"name": "", "type": "address"}],
    },
]

# Asset Manager ABI (to get fAsset token address)
ASSET_MANAGER_ABI = [
    {
        "name": "fAsset",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "address"}],
    },
]

# FAssets contract addresses
# These are the FAsset TOKEN contract addresses (not Asset Managers)
# Events are emitted from the token contracts
# Mainnet FAsset addresses (queried from Contract Registry)
# FXRP Token: 0xAd552A648C74D49E10027AB8a618A3ad4901c5bE (from Asset Manager query)
FASSETS_MAINNET = {
    "FXRP": "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE",  # From Asset Manager query
    "FBTC": None,  # Will be queried dynamically from Contract Registry if needed
    "FDOGE": None,  # Will be queried dynamically from Contract Registry if needed
}

# Coston2 testnet addresses (queried from Contract Registry)
# FXRP Token: 0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3 (from docs)
# FXRP Token from Asset Manager: 0x0b6A3645c240605887a5532109323A3E12273dc7
# Using the one from Asset Manager (official way)
FASSETS_COSTON2 = {
    "FXRP": "0x0b6A3645c240605887a5532109323A3E12273dc7",  # From Asset Manager query
    "FBTC": None,  # Will be queried dynamically if needed
    "FDOGE": None,  # Will be queried dynamically if needed
}

# FAsset ABI (minimal for redemption events)
FASSET_ABI = [
    {
        "name": "RedemptionRequested",
        "type": "event",
    "inputs": [
        {"indexed": True, "name": "user", "type": "address"},
        {"indexed": False, "name": "amount", "type": "uint256"},
        {"indexed": True, "name": "redemptionId", "type": "uint256"},
    ],
    },
    {
        "name": "RedemptionCompleted",
    "type": "event",
    "inputs": [
        {"indexed": True, "name": "user", "type": "address"},
        {"indexed": False, "name": "amount", "type": "uint256"},
        {"indexed": True, "name": "redemptionId", "type": "uint256"},
    ],
    },
    {
        "name": "RedemptionFailed",
    "type": "event",
    "inputs": [
        {"indexed": True, "name": "user", "type": "address"},
        {"indexed": False, "name": "amount", "type": "uint256"},
        {"indexed": True, "name": "redemptionId", "type": "uint256"},
    ],
    },
    {
        "name": "getRedemption",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_redemptionId", "type": "uint256"}],
        "outputs": [
            {"name": "_agent", "type": "address"},
            {"name": "_amount", "type": "uint256"},
            {"name": "_startTime", "type": "uint256"},
        ],
    },
]


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


def get_fasset_address(asset: str, network: str = "coston2") -> Optional[str]:
    """Get FAsset contract address.
    
    First checks hardcoded addresses, then queries Contract Registry if needed.
    """
    addresses = {
        "mainnet": FASSETS_MAINNET,
        "coston2": FASSETS_COSTON2,
    }
    network_addrs = addresses.get(network, {})
    addr = network_addrs.get(asset)
    
    # If address is configured, validate and return it
    if addr is not None and addr != "0x..." and addr.startswith("0x") and len(addr) >= 42:
        try:
            return Web3.to_checksum_address(addr)
        except Exception:
            pass
    
    # Try to query from Contract Registry
    try:
        rpc_url = get_rpc_url(network)
        w3 = get_web3(rpc_url)
        registry_addr = Web3.to_checksum_address(FLARE_CONTRACT_REGISTRY)
        registry = w3.eth.contract(address=registry_addr, abi=CONTRACT_REGISTRY_ABI)
        
        # Try different naming conventions for Asset Manager
        asset_manager_names = [
            f"AssetManager{asset}",
            f"{asset}AssetManager",
            f"FAsset{asset}",
            f"{asset}Manager",
        ]
        
        for name in asset_manager_names:
            try:
                manager_addr = registry.functions.getContractAddressByName(name).call()
                if manager_addr and manager_addr != "0x0000000000000000000000000000000000000000":
                    # Get the fAsset token address from the Asset Manager
                    manager = w3.eth.contract(address=manager_addr, abi=ASSET_MANAGER_ABI)
                    fasset_addr = manager.functions.fAsset().call()
                    if fasset_addr and fasset_addr != "0x0000000000000000000000000000000000000000":
                        # Cache it for future use
                        network_addrs[asset] = fasset_addr
                        return Web3.to_checksum_address(fasset_addr)
            except Exception:
                continue
    except Exception as e:
        # Silently fail - will return None and use synthetic data
        pass
    
    return None


def get_rpc_url(network: str = "coston2") -> str:
    """Get RPC URL for network."""
    urls = {
        "mainnet": FLARE_MAINNET_RPC,
        "coston2": FLARE_COSTON2_RPC,
        "songbird": FLARE_SONGBIRD_RPC,
    }
    return urls.get(network, FLARE_COSTON2_RPC)


def fetch_redemption_events(
    asset: str,
    from_block: int,
    to_block: int,
    network: str = "coston2",
) -> List[Dict[str, Any]]:
    """Fetch redemption events for an FAsset."""
    rpc_url = get_rpc_url(network)
    fasset_addr = get_fasset_address(asset, network)
    
    if not fasset_addr:
        print(f"Warning: FAsset address not configured for {asset} on {network}")
        print("Please configure FASSETS_COSTON2 or FASSETS_MAINNET with actual contract addresses")
        print("ℹ️  Note: FAssets may not be deployed on Coston2 testnet, or addresses may differ")
        print("   Synthetic data will be used for demonstration")
        return []
    
    w3 = get_web3(rpc_url)
    try:
        fasset = w3.eth.contract(address=fasset_addr, abi=FASSET_ABI)
    except Exception as e:
        print(f"Error creating FAsset contract for {asset}: {e}")
        return []
    
    redemptions = []
    
    # RPC block range limit (conservative - most nodes allow 30-1000)
    MAX_BLOCKS_PER_QUERY = 30
    
    # Fetch RedemptionRequested events
    try:
        # Get event signature using keccak256 hash
        from eth_utils import keccak, to_bytes, text_if_str
        event_signature_text = "RedemptionRequested(address,uint256,uint256)"
        event_signature = keccak(text_if_str(to_bytes, event_signature_text))
        
        # Chunk the block range into smaller queries
        total_blocks = to_block - from_block + 1
        num_chunks = (total_blocks + MAX_BLOCKS_PER_QUERY - 1) // MAX_BLOCKS_PER_QUERY
        
        all_logs = []
        for chunk_idx in range(num_chunks):
            chunk_from = from_block + (chunk_idx * MAX_BLOCKS_PER_QUERY)
            chunk_to = min(chunk_from + MAX_BLOCKS_PER_QUERY - 1, to_block)
            
            try:
                logs = w3.eth.get_logs({
                    'fromBlock': chunk_from,
                    'toBlock': chunk_to,
                    'address': fasset_addr,
                    'topics': [event_signature]
                })
                all_logs.extend(logs)
                if chunk_idx < num_chunks - 1:
                    time.sleep(0.1)  # Rate limiting
            except Exception as chunk_error:
                print(f"Error fetching RedemptionRequested chunk {chunk_idx + 1}/{num_chunks}: {chunk_error}")
                continue
        
        logs = all_logs
        
        for log in logs:
            try:
                decoded = fasset.events.RedemptionRequested().process_log(log)
                redemptions.append({
                    "redemption_id": decoded.args.redemptionId,
                    "user": decoded.args.user,
                    "amount": decoded.args.amount,
                    "status": "requested",
                    "block_number": log.blockNumber,
                    "transaction_hash": log.transactionHash.hex(),
                    "asset": asset,
                    "network": network,
                })
            except Exception as decode_error:
                print(f"Error decoding RedemptionRequested event: {decode_error}")
                continue
    except Exception as e:
        print(f"Error fetching RedemptionRequested events: {e}")
    
    # Fetch RedemptionCompleted events
    try:
        # Get event signature using keccak256 hash
        from eth_utils import keccak, to_bytes, text_if_str
        event_signature_text = "RedemptionCompleted(address,uint256,uint256)"
        event_signature = keccak(text_if_str(to_bytes, event_signature_text))
        
        # Chunk the block range into smaller queries
        total_blocks = to_block - from_block + 1
        num_chunks = (total_blocks + MAX_BLOCKS_PER_QUERY - 1) // MAX_BLOCKS_PER_QUERY
        
        all_logs = []
        for chunk_idx in range(num_chunks):
            chunk_from = from_block + (chunk_idx * MAX_BLOCKS_PER_QUERY)
            chunk_to = min(chunk_from + MAX_BLOCKS_PER_QUERY - 1, to_block)
            
            try:
                logs = w3.eth.get_logs({
                    'fromBlock': chunk_from,
                    'toBlock': chunk_to,
                    'address': fasset_addr,
                    'topics': [event_signature]
                })
                all_logs.extend(logs)
                if chunk_idx < num_chunks - 1:
                    time.sleep(0.1)  # Rate limiting
            except Exception as chunk_error:
                print(f"Error fetching RedemptionCompleted chunk {chunk_idx + 1}/{num_chunks}: {chunk_error}")
                continue
        
        logs = all_logs
        
        for log in logs:
            try:
                decoded = fasset.events.RedemptionCompleted().process_log(log)
                redemption_id = decoded.args.redemptionId
                existing = next(
                    (r for r in redemptions if r["redemption_id"] == redemption_id),
                    None
                )
                if existing:
                    existing["status"] = "completed"
                else:
                    redemptions.append({
                        "redemption_id": redemption_id,
                        "user": decoded.args.user,
                        "amount": decoded.args.amount,
                        "status": "completed",
                        "block_number": log.blockNumber,
                        "transaction_hash": log.transactionHash.hex(),
                        "asset": asset,
                        "network": network,
                    })
            except Exception as decode_error:
                print(f"Error decoding RedemptionCompleted event: {decode_error}")
                continue
    except Exception as e:
        print(f"Error fetching RedemptionCompleted events: {e}")
    
    # Fetch RedemptionFailed events
    try:
        # Get event signature using keccak256 hash
        from eth_utils import keccak, to_bytes, text_if_str
        event_signature_text = "RedemptionFailed(address,uint256,uint256)"
        event_signature = keccak(text_if_str(to_bytes, event_signature_text))
        
        # Chunk the block range into smaller queries
        total_blocks = to_block - from_block + 1
        num_chunks = (total_blocks + MAX_BLOCKS_PER_QUERY - 1) // MAX_BLOCKS_PER_QUERY
        
        all_logs = []
        for chunk_idx in range(num_chunks):
            chunk_from = from_block + (chunk_idx * MAX_BLOCKS_PER_QUERY)
            chunk_to = min(chunk_from + MAX_BLOCKS_PER_QUERY - 1, to_block)
            
            try:
                logs = w3.eth.get_logs({
                    'fromBlock': chunk_from,
                    'toBlock': chunk_to,
                    'address': fasset_addr,
                    'topics': [event_signature]
                })
                all_logs.extend(logs)
                if chunk_idx < num_chunks - 1:
                    time.sleep(0.1)  # Rate limiting
            except Exception as chunk_error:
                print(f"Error fetching RedemptionFailed chunk {chunk_idx + 1}/{num_chunks}: {chunk_error}")
                continue
        
        logs = all_logs
        
        for log in logs:
            try:
                decoded = fasset.events.RedemptionFailed().process_log(log)
                redemption_id = decoded.args.redemptionId
                existing = next(
                    (r for r in redemptions if r["redemption_id"] == redemption_id),
                    None
                )
                if existing:
                    existing["status"] = "failed"
                else:
                    redemptions.append({
                        "redemption_id": redemption_id,
                        "user": decoded.args.user,
                        "amount": decoded.args.amount,
                        "status": "failed",
                        "block_number": log.blockNumber,
                        "transaction_hash": log.transactionHash.hex(),
                        "asset": asset,
                        "network": network,
                    })
            except Exception as decode_error:
                print(f"Error decoding RedemptionFailed event: {decode_error}")
                continue
    except Exception as e:
        print(f"Error fetching RedemptionFailed events: {e}")
    
    return redemptions


def get_recent_redemptions(
    asset: str,
    hours: int = 24,
    network: str = "coston2",
) -> pd.DataFrame:
    """Get recent redemption events."""
    rpc_url = get_rpc_url(network)
    w3 = get_web3(rpc_url)
    
    current_block = w3.eth.block_number
    blocks_per_hour = 2000
    from_block = max(0, current_block - (hours * blocks_per_hour))
    
    redemptions = fetch_redemption_events(asset, from_block, current_block, network)
    
    if not redemptions:
        return pd.DataFrame()
    
    df = pd.DataFrame(redemptions)
    df = df.sort_values('block_number')
    
    return df


def get_redemption_details(redemption_id: int, asset: str, network: str = "coston2") -> Optional[Dict[str, Any]]:
    """Get detailed redemption information."""
    rpc_url = get_rpc_url(network)
    fasset_addr = get_fasset_address(asset, network)
    
    if not fasset_addr:
        return None
    
    w3 = get_web3(rpc_url)
    fasset = w3.eth.contract(address=fasset_addr, abi=FASSET_ABI)
    
    try:
        agent, amount, start_time = fasset.functions.getRedemption(redemption_id).call()
        return {
            "redemption_id": redemption_id,
            "agent": agent,
            "amount": amount,
            "start_time": start_time,
            "asset": asset,
            "network": network,
        }
    except Exception as e:
        print(f"Error getting redemption details: {e}")
        return None


if __name__ == "__main__":
    network = os.getenv("FLARE_NETWORK", "coston2")
    asset = os.getenv("FASSET", "FXRP")
    
    print(f"Fetching {asset} redemptions on {network}...")
    
    df = get_recent_redemptions(asset, hours=24, network=network)
    if not df.empty:
        print(f"\nCollected {len(df)} redemption events")
        print(df.head())
        print(f"\nStatus distribution:")
        print(df['status'].value_counts())
    else:
        print("No redemption events found")
