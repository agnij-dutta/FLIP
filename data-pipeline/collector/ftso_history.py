"""FTSO historical price fetcher - Real implementation connecting to Flare networks.

Fetches historical FTSO prices from Flare networks (Mainnet, Coston2, Songbird).
Uses actual contract addresses and RPC endpoints.
"""
import os
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
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

# FTSOv2 Contract addresses (from Flare documentation)
# Source: https://dev.flare.network/ftso/guides/read-feeds-offchain
# 
# FTSOv2 contract addresses - feeds are served directly on this contract
# Coston2 address confirmed from documentation
FTSOV2_MAINNET = None  # Query from Contract Registry or check Solidity Reference
FTSOV2_COSTON2 = "0x3d893C53D9e8056135C26C8c638B76C8b60Df726"  # From Flare docs
FTSOV2_SONGBIRD = None  # Query from Contract Registry or check Solidity Reference

# Flare Contract Registry - same address across all networks
# Source: https://dev.flare.network/network/guides/flare-contracts-registry/
FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019"

# Feed IDs for common pairs (from Flare documentation)
# These are bytes21 identifiers for each feed (21 bytes = 42 hex chars + "0x" = 44 chars total)
# Full list: https://dev.flare.network/ftso/block-latency-feeds/
FEED_IDS = {
    "FLR/USD": "0x01464c522f55534400000000000000000000000000",  # FLR/USD
    "BTC/USD": "0x014254432f55534400000000000000000000000000",  # BTC/USD
    "ETH/USD": "0x014554482f55534400000000000000000000000000",  # ETH/USD
    "XRP/USD": "0x015852502f55534400000000000000000000000000",  # XRP/USD (derived from pattern)
}

# Flare Contract Registry ABI (for dynamic address lookup)
CONTRACT_REGISTRY_ABI = [
    {
        "name": "getContractAddressByName",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "_name", "type": "string"}],
        "outputs": [{"name": "", "type": "address"}],
    },
]

# FTSOv2 Contract ABI (from Flare documentation)
# Source: https://dev.flare.network/ftso/guides/read-feeds-offchain
# Note: Feed IDs are bytes21, not bytes32
FTSOV2_ABI = [
    {
        "name": "getFeedsById",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [{"name": "_feedIds", "type": "bytes21[]"}],
        "outputs": [
            {"name": "", "type": "uint256[]"},
            {"name": "", "type": "int8[]"},
            {"name": "", "type": "uint64"},
        ],
    },
    {
        "name": "getFeedsByIdInWei",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [{"name": "_feedIds", "type": "bytes21[]"}],
        "outputs": [
            {"name": "_values", "type": "uint256[]"},
            {"name": "_timestamp", "type": "uint64"},
        ],
    },
    {
        "name": "getFeedById",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [{"name": "_feedId", "type": "bytes21"}],
        "outputs": [
            {"name": "", "type": "uint256"},
            {"name": "", "type": "int8"},
            {"name": "", "type": "uint64"},
        ],
    },
    {
        "name": "getFeedByIdInWei",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [{"name": "_feedId", "type": "bytes21"}],
        "outputs": [
            {"name": "_value", "type": "uint256"},
            {"name": "_timestamp", "type": "uint64"},
        ],
    },
]


def get_web3(rpc_url: str) -> Web3:
    """Create Web3 connection to Flare network."""
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


def get_ftso_v2_address(network: str = "coston2") -> Optional[str]:
    """Get FTSOv2 contract address for network.
    
    Tries to get from hardcoded addresses first, then queries Contract Registry.
    """
    # Check hardcoded addresses first
    addresses = {
        "mainnet": FTSOV2_MAINNET,
        "coston2": FTSOV2_COSTON2,
        "songbird": FTSOV2_SONGBIRD,
    }
    
    address = addresses.get(network, FTSOV2_COSTON2)
    
    # If address is None, try to query from Contract Registry
    if address is None:
        try:
            rpc_url = get_rpc_url(network)
            w3 = get_web3(rpc_url)
            registry_addr = Web3.to_checksum_address(FLARE_CONTRACT_REGISTRY)
            registry = w3.eth.contract(address=registry_addr, abi=CONTRACT_REGISTRY_ABI)
            address = registry.functions.getContractAddressByName("FtsoV2").call()
            if address and address != "0x0000000000000000000000000000000000000000":
                return Web3.to_checksum_address(address)
        except Exception as e:
            print(f"Warning: Could not query Contract Registry for FtsoV2 address: {e}")
    
    if address:
        return Web3.to_checksum_address(address)
    return None


def get_rpc_url(network: str = "coston2") -> str:
    """Get RPC URL for network."""
    urls = {
        "mainnet": FLARE_MAINNET_RPC,
        "coston2": FLARE_COSTON2_RPC,
        "songbird": FLARE_SONGBIRD_RPC,
    }
    return urls.get(network, FLARE_COSTON2_RPC)


def get_feed_id(symbol: str) -> Optional[str]:
    """Get feed ID for a symbol.
    
    Note: Feed IDs are bytes21 values (44 characters: "0x" + 42 hex chars).
    For now, we return from FEED_IDS dict.
    In production, you should query the FTSOv2 contract or use a mapping service.
    
    Returns None if feed ID is not configured or is a placeholder.
    """
    feed_id = FEED_IDS.get(symbol)
    # Validate feed ID format (bytes21 = 21 bytes = 42 hex chars + "0x" = 44 chars)
    if feed_id and feed_id != "0x..." and feed_id.startswith("0x") and len(feed_id) == 44:
        return feed_id
    return None


def get_multiple_feeds(symbols: List[str], network: str = "coston2") -> Optional[Dict[str, Any]]:
    """Get current prices for multiple feeds at once using getFeedsById.
    
    This is more efficient than calling getFeed multiple times.
    """
    rpc_url = get_rpc_url(network)
    ftso_v2_addr = get_ftso_v2_address(network)
    
    if ftso_v2_addr is None:
        print(f"Warning: FTSOv2 contract address not available for {network}")
        return None
    
    # Collect feed IDs
    feed_ids_hex = []
    valid_symbols = []
    
    for symbol in symbols:
        feed_id = get_feed_id(symbol)
        if feed_id and feed_id != "0x...":
            # Feed ID is already in correct format (bytes21)
            feed_ids_hex.append(feed_id)
            valid_symbols.append(symbol)
    
    if not feed_ids_hex:
        print("Warning: No valid feed IDs found for the requested symbols")
        return None
    
    try:
        w3 = get_web3(rpc_url)
        ftso_v2 = w3.eth.contract(address=ftso_v2_addr, abi=FTSOV2_ABI)
        
        # Get all feeds at once
        # Returns: (uint256[] values, int8[] decimals, uint64 timestamp)
        feeds, decimals, timestamp = ftso_v2.functions.getFeedsById(feed_ids_hex).call()
        
        # Build result dictionary
        result = {
            "timestamp": timestamp,
            "block_number": w3.eth.block_number,
            "network": network,
            "feeds": {}
        }
        
        for i, symbol in enumerate(valid_symbols):
            result["feeds"][symbol] = {
                "price": feeds[i],
                "decimals": int(decimals[i]),  # int8 to int
            }
        
        return result
    except Exception as e:
        print(f"Error getting multiple feeds: {e}")
        return None


def get_current_price(symbol: str, network: str = "coston2") -> Optional[Dict[str, Any]]:
    """Get current price from FTSOv2 contract using feed ID."""
    rpc_url = get_rpc_url(network)
    ftso_v2_addr = get_ftso_v2_address(network)
    
    if ftso_v2_addr is None:
        print(f"Warning: FTSOv2 contract address not available for {network}")
        return None
    
    feed_id = get_feed_id(symbol)
    if feed_id is None or feed_id == "0x..." or not feed_id.startswith("0x") or len(feed_id) < 4:
        print(f"Warning: Feed ID not configured for {symbol}")
        print("Please configure FEED_IDS dictionary with actual feed IDs from Flare documentation")
        return None
    
    try:
        # Validate feed_id format (bytes21 = 44 chars)
        if len(feed_id) != 44:
            print(f"Warning: Feed ID for {symbol} has invalid length: {len(feed_id)} (expected 44 for bytes21)")
            return None
        
        w3 = get_web3(rpc_url)
        ftso_v2 = w3.eth.contract(address=ftso_v2_addr, abi=FTSOV2_ABI)
        
        # Get feed data - returns (uint256 value, int8 decimals, uint64 timestamp)
        feed, decimals, timestamp = ftso_v2.functions.getFeedById(feed_id).call()
        
        return {
            "symbol": symbol,
            "price": feed,
            "decimals": int(decimals),  # int8 to int
            "timestamp": timestamp,
            "block_number": w3.eth.block_number,
            "network": network,
        }
    except Exception as e:
        print(f"Error getting price for {symbol}: {e}")
        return None


def get_historical_prices(
    symbol: str,
    start_block: int,
    end_block: int,
    network: str = "coston2",
    max_blocks: int = 1000,
) -> List[Dict[str, Any]]:
    """Fetch historical prices by querying blocks.
    
    Note: FTSOv2 provides current feed values. Historical data may require
    querying past blocks or using archive nodes/external providers.
    """
    rpc_url = get_rpc_url(network)
    w3 = get_web3(rpc_url)
    
    ftso_v2_addr = get_ftso_v2_address(network)
    if not ftso_v2_addr:
        print(f"Warning: FTSOv2 contract address not available for {network}")
        return []
    
    feed_id = get_feed_id(symbol)
    if feed_id is None or feed_id == "0x..." or not feed_id.startswith("0x") or len(feed_id) < 4:
        print(f"Warning: Feed ID not configured for {symbol}")
        print("Please configure FEED_IDS dictionary with actual feed IDs from Flare documentation")
        return []
    
    try:
        # Validate feed_id format (bytes21 = 44 chars)
        if len(feed_id) != 44:
            print(f"Warning: Feed ID for {symbol} has invalid length: {len(feed_id)} (expected 44 for bytes21)")
            return []
        
        ftso_v2 = w3.eth.contract(address=ftso_v2_addr, abi=FTSOV2_ABI)
    except Exception as e:
        print(f"Error creating FTSO contract for {symbol}: {e}")
        return []
    
    prices = []
    block_step = max(1, (end_block - start_block) // max_blocks)
    
    for block_num in range(start_block, end_block + 1, block_step):
        try:
            # Get feed data at specific block - returns (uint256 value, int8 decimals, uint64 timestamp)
            feed, decimals, timestamp = ftso_v2.functions.getFeedById(feed_id).call(
                block_identifier=block_num
            )
            
            prices.append({
                "symbol": symbol,
                "price": feed,
                "decimals": int(decimals),  # int8 to int
                "timestamp": timestamp,
                "block_number": block_num,
                "network": network,
            })
            
            time.sleep(0.1)  # Rate limiting
        except Exception as e:
            print(f"Error fetching price at block {block_num}: {e}")
            continue
    
    return prices


def get_recent_prices(
    symbol: str,
    hours: int = 24,
    network: str = "coston2",
) -> pd.DataFrame:
    """Get recent prices by polling current price over time.
    
    Note: FTSOv2 provides current feed values. For historical data,
    we can only get the current value. Historical queries require
    archive nodes or external data providers.
    """
    # Check feed ID first before making any network calls
    feed_id = get_feed_id(symbol)
    if feed_id is None or feed_id == "0x..." or not feed_id.startswith("0x") or len(feed_id) < 4:
        print(f"Warning: Feed ID not configured for {symbol}")
        print("Please configure FEED_IDS dictionary with actual feed IDs from Flare documentation")
        print("See: https://dev.flare.network/ftso/block-latency-feeds/")
        return pd.DataFrame()
    
    # For now, just get current price since FTSOv2 doesn't provide easy historical access
    # In production, you'd want to use archive nodes or external APIs
    current = get_current_price(symbol, network)
    if current is None:
        return pd.DataFrame()
    
    # Return single row DataFrame with current price
    df = pd.DataFrame([{
        "symbol": symbol,
        "price": current["price"],
        "decimals": current["decimals"],
        "timestamp": current["timestamp"],
        "block_number": current["block_number"],
        "network": network,
        "datetime": pd.to_datetime(current["timestamp"], unit='s'),
    }])
    
    return df


def collect_ftso_data(
    symbols: List[str],
    network: str = "coston2",
    hours: int = 24,
) -> pd.DataFrame:
    """Collect FTSO data for multiple symbols."""
    all_data = []
    
    for symbol in symbols:
        print(f"Collecting data for {symbol}...")
        df = get_recent_prices(symbol, hours, network)
        if not df.empty:
            all_data.append(df)
        time.sleep(1)  # Rate limiting
    
    if not all_data:
        return pd.DataFrame()
    
    return pd.concat(all_data, ignore_index=True)


if __name__ == "__main__":
    import sys
    
    network = os.getenv("FLARE_NETWORK", "coston2")
    symbol = os.getenv("FTSO_SYMBOL", "XRP/USD")
    
    print(f"Fetching FTSO data for {symbol} on {network}...")
    
    # Get current price
    current = get_current_price(symbol, network)
    if current:
        print(f"Current price: {current}")
    
    # Get recent prices
    df = get_recent_prices(symbol, hours=24, network=network)
    if not df.empty:
        print(f"\nCollected {len(df)} price points")
        print(df.head())
        print(f"\nPrice statistics:")
        print(df['price'].describe())
    else:
        print("No data collected")
