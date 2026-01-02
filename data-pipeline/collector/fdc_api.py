"""FDC Attestation API client - Uses Flare Systems Explorer API and FAsset correlation.

This module provides alternative methods to get FDC attestation data:
1. Flare Systems Explorer API (if available)
2. FAsset redemption correlation (redemptions trigger attestations)
"""
import os
import time
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import pandas as pd

# Flare Systems Explorer API endpoints
FLARE_SYSTEMS_API_BASE = "https://flare-systems-explorer.flare.network"
FLARE_API_PORTAL_BASE = "https://api-portal.flare.network"

# Try to get API key from environment
FLARE_API_KEY = os.getenv("FLARE_API_KEY", None)


def get_attestations_from_api(
    hours: int = 24,
    network: str = "mainnet",
    api_key: Optional[str] = None,
) -> pd.DataFrame:
    """Get attestations from Flare Systems Explorer API.
    
    Note: This requires API access. If not available, returns empty DataFrame.
    """
    api_key = api_key or FLARE_API_KEY
    
    if not api_key:
        print("ℹ️  No API key configured for Flare Systems Explorer")
        print("   Set FLARE_API_KEY environment variable or get key from:")
        print("   https://api-portal.flare.network/")
        return pd.DataFrame()
    
    # API endpoint (this may need adjustment based on actual API structure)
    # Check Flare Systems Explorer documentation for exact endpoint
    url = f"{FLARE_SYSTEMS_API_BASE}/api/attestations"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    # Calculate time range
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    params = {
        "network": network,
        "start_time": int(start_time.timestamp()),
        "end_time": int(end_time.timestamp()),
        "limit": 1000,  # Adjust based on API limits
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if "attestations" in data:
            attestations = data["attestations"]
        elif isinstance(data, list):
            attestations = data
        else:
            print(f"⚠️  Unexpected API response format: {data}")
            return pd.DataFrame()
        
        if not attestations:
            return pd.DataFrame()
        
        df = pd.DataFrame(attestations)
        
        # Normalize column names
        if "timestamp" in df.columns:
            df["datetime"] = pd.to_datetime(df["timestamp"], unit="s")
        elif "time" in df.columns:
            df["datetime"] = pd.to_datetime(df["time"])
        
        if "request_id" not in df.columns and "requestId" in df.columns:
            df["request_id"] = df["requestId"]
        
        if "merkle_root" not in df.columns and "merkleRoot" in df.columns:
            df["merkle_root"] = df["merkleRoot"]
        
        print(f"✅ Retrieved {len(df)} attestations from API")
        return df
        
    except requests.exceptions.RequestException as e:
        print(f"⚠️  API request failed: {e}")
        print("   Falling back to FAsset correlation method")
        return pd.DataFrame()
    except Exception as e:
        print(f"⚠️  Error processing API response: {e}")
        return pd.DataFrame()


def get_attestations_from_redemptions(
    hours: int = 24,
    network: str = "mainnet",
    asset: str = "FXRP",
) -> pd.DataFrame:
    """Derive attestation timing from FAsset redemption events.
    
    FAsset redemptions trigger StateConnector attestations. We can use
    redemption events to estimate attestation timing:
    - RedemptionRequested → triggers FDC request
    - FDC processes request → attestation ~3-5 minutes later
    - RedemptionCompleted/Failed → confirms attestation result
    
    This method provides approximate attestation data based on redemption patterns.
    """
    try:
        from fassets_redemptions import get_recent_redemptions
    except ImportError:
        print("⚠️  Could not import fassets_redemptions")
        return pd.DataFrame()
    
    print(f"📊 Deriving attestations from {asset} redemption events...")
    
    # Get redemption events (need longer window to account for FDC latency)
    redemption_hours = hours + 1  # Add 1 hour buffer for FDC processing
    redemptions_df = get_recent_redemptions(asset, hours=redemption_hours, network=network)
    
    if redemptions_df.empty:
        print("⚠️  No redemption events found")
        return pd.DataFrame()
    
    print(f"   Found {len(redemptions_df)} redemption events")
    
    # Create attestation-like data from redemptions
    attestations = []
    
    for _, redemption in redemptions_df.iterrows():
        # Estimate attestation timing
        # FDC typically processes within 3-5 minutes after redemption request
        redemption_time = redemption.get("datetime")
        if redemption_time is None:
            # Estimate from block number
            current_time = datetime.now().timestamp()
            current_block = redemption.get("block_number", 0)
            # Approximate: 1.8 seconds per block
            redemption_time = datetime.fromtimestamp(
                current_time - (current_block * 1.8)
            )
        else:
            if isinstance(redemption_time, pd.Timestamp):
                redemption_time = redemption_time.to_pydatetime()
            elif isinstance(redemption_time, (int, float)):
                redemption_time = datetime.fromtimestamp(redemption_time)
        
        # FDC attestation happens ~3-5 minutes after redemption
        # Use random variation in 3-5 minute window
        import numpy as np
        fdc_latency = np.random.uniform(180, 300)  # 3-5 minutes in seconds
        attestation_time = redemption_time + timedelta(seconds=fdc_latency)
        
        # Create attestation record
        attestation = {
            "request_id": redemption.get("redemption_id", 0),
            "round_id": None,  # Not available from redemptions
            "merkle_root": f"0x{redemption.get('redemption_id', 0):064x}",  # Placeholder
            "timestamp": int(attestation_time.timestamp()),
            "datetime": attestation_time,
            "block_number": redemption.get("block_number", 0),
            "transaction_hash": redemption.get("transaction_hash", "0x0"),
            "network": network,
            "redemption_id": redemption.get("redemption_id"),
            "redemption_status": redemption.get("status"),
            "source": "redemption_correlation",  # Mark as derived data
        }
        
        attestations.append(attestation)
    
    if not attestations:
        return pd.DataFrame()
    
    df = pd.DataFrame(attestations)
    
    # Filter to requested time window
    cutoff_time = datetime.now() - timedelta(hours=hours)
    df = df[df["datetime"] >= cutoff_time]
    
    # Sort by timestamp
    df = df.sort_values("timestamp")
    
    # Compute latency (time between attestations)
    df["latency"] = df["timestamp"].diff()
    
    print(f"✅ Derived {len(df)} attestations from redemption events")
    print(f"   Time range: {df['datetime'].min()} to {df['datetime'].max()}")
    
    return df


def get_recent_attestations_enhanced(
    hours: int = 24,
    network: str = "mainnet",
    asset: str = "FXRP",
    use_api: bool = True,
    use_redemptions: bool = True,
) -> pd.DataFrame:
    """Get recent attestations using multiple methods.
    
    Tries in order:
    1. Flare Systems Explorer API (if API key available)
    2. FAsset redemption correlation (derives from redemption events)
    3. Returns empty DataFrame if both fail
    
    Args:
        hours: Hours of history to fetch
        network: Network name (mainnet, coston2, etc.)
        asset: FAsset to use for correlation (FXRP, FBTC, etc.)
        use_api: Whether to try API first
        use_redemptions: Whether to fall back to redemption correlation
    
    Returns:
        DataFrame with attestation data
    """
    # Try API first
    if use_api:
        df = get_attestations_from_api(hours=hours, network=network)
        if not df.empty:
            return df
    
    # Fall back to redemption correlation
    if use_redemptions:
        df = get_attestations_from_redemptions(hours=hours, network=network, asset=asset)
        if not df.empty:
            return df
    
    # Both methods failed
    return pd.DataFrame()


if __name__ == "__main__":
    import sys
    
    network = os.getenv("FLARE_NETWORK", "mainnet")
    asset = os.getenv("FASSET", "FXRP")
    
    print(f"Testing FDC attestation collection on {network}...\n")
    
    # Test API method
    print("1. Testing API method...")
    df_api = get_attestations_from_api(hours=24, network=network)
    if not df_api.empty:
        print(f"   ✅ API returned {len(df_api)} attestations")
    else:
        print("   ⚠️  API method unavailable (no key or API down)")
    
    print("\n2. Testing redemption correlation method...")
    df_redemptions = get_attestations_from_redemptions(hours=24, network=network, asset=asset)
    if not df_redemptions.empty:
        print(f"   ✅ Derived {len(df_redemptions)} attestations from redemptions")
        print(f"   Sample:")
        print(df_redemptions.head())
    else:
        print("   ⚠️  No redemption events found")
    
    print("\n3. Testing enhanced method...")
    df_enhanced = get_recent_attestations_enhanced(hours=24, network=network, asset=asset)
    if not df_enhanced.empty:
        print(f"   ✅ Enhanced method returned {len(df_enhanced)} attestations")
    else:
        print("   ⚠️  All methods failed")

