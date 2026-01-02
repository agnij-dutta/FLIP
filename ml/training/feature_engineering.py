"""
Feature engineering for FLIP ML model.

Extracts features from on-chain data:
- FTSO price volatility (rolling std dev)
- Recent redemption success rate
- Mempool congestion metrics
- FDC attestation latency history
- Time-of-day patterns
- Operator performance correlation
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from datetime import datetime, timedelta


def compute_ftso_volatility(
    prices: pd.Series, window_1h: int = 2000, window_24h: int = 48000
) -> Dict[str, float]:
    """
    Compute FTSO price volatility over rolling windows.
    
    Args:
        prices: Series of FTSO prices (block-level, ~1.8s cadence)
        window_1h: Number of blocks in 1 hour (~2000 blocks)
        window_24h: Number of blocks in 24 hours (~48000 blocks)
    
    Returns:
        Dict with volatility metrics
    """
    returns = prices.pct_change().dropna()
    
    return {
        "volatility_1h": returns.rolling(window_1h).std().iloc[-1] if len(returns) >= window_1h else 0.0,
        "volatility_24h": returns.rolling(window_24h).std().iloc[-1] if len(returns) >= window_24h else 0.0,
        "volatility_current": returns.iloc[-100:].std() if len(returns) >= 100 else 0.0,
    }


def compute_redemption_success_rate(
    redemptions: pd.DataFrame, window: int = 100
) -> float:
    """
    Compute recent redemption success rate.
    
    Args:
        redemptions: DataFrame with columns ['redemption_id', 'status', 'timestamp']
        window: Number of recent redemptions to consider
    
    Returns:
        Success rate (0.0 to 1.0)
    """
    if len(redemptions) == 0:
        return 1.0  # Default to optimistic if no data
    
    recent = redemptions.tail(window)
    success_count = (recent['status'] == 'completed').sum()
    return success_count / len(recent)


def compute_fdc_latency_stats(
    attestations: pd.DataFrame
) -> Dict[str, float]:
    """
    Compute FDC attestation latency statistics.
    
    Args:
        attestations: DataFrame with columns ['request_id', 'request_time', 'attestation_time']
    
    Returns:
        Dict with latency metrics (mean, p95, p99 in seconds)
    """
    if len(attestations) == 0:
        return {"mean": 180.0, "p95": 300.0, "p99": 360.0}  # Defaults
    
    attestations['latency'] = (
        attestations['attestation_time'] - attestations['request_time']
    ).dt.total_seconds()
    
    latencies = attestations['latency']
    
    return {
        "mean": latencies.mean(),
        "p95": latencies.quantile(0.95),
        "p99": latencies.quantile(0.99),
        "std": latencies.std(),
    }


def extract_time_features(timestamp: datetime) -> Dict[str, float]:
    """
    Extract time-of-day and day-of-week features.
    
    Args:
        timestamp: Datetime object
    
    Returns:
        Dict with time features
    """
    return {
        "hour": timestamp.hour,
        "hour_sin": np.sin(2 * np.pi * timestamp.hour / 24),
        "hour_cos": np.cos(2 * np.pi * timestamp.hour / 24),
        "day_of_week": timestamp.weekday(),
        "day_sin": np.sin(2 * np.pi * timestamp.weekday() / 7),
        "day_cos": np.cos(2 * np.pi * timestamp.weekday() / 7),
        "is_weekend": 1.0 if timestamp.weekday() >= 5 else 0.0,
    }


def compute_agent_performance(
    redemptions: pd.DataFrame, agent_address: str, window: int = 50
) -> Dict[str, float]:
    """
    Compute agent performance metrics.
    
    Args:
        redemptions: DataFrame with agent info
        agent_address: Agent address to analyze
        window: Number of recent redemptions to consider
    
    Returns:
        Dict with agent performance metrics
    """
    agent_redemptions = redemptions[redemptions['agent'] == agent_address]
    
    if len(agent_redemptions) == 0:
        return {"success_rate": 1.0, "avg_latency": 180.0, "total_count": 0}
    
    recent = agent_redemptions.tail(window)
    success_rate = (recent['status'] == 'completed').sum() / len(recent)
    
    return {
        "success_rate": success_rate,
        "avg_latency": recent['latency'].mean() if 'latency' in recent.columns else 180.0,
        "total_count": len(agent_redemptions),
    }


def compute_mempool_metrics(
    block_data: pd.DataFrame, window: int = 100
) -> Dict[str, float]:
    """
    Compute mempool congestion metrics.
    
    Args:
        block_data: DataFrame with block info (gas_used, gas_limit, etc.)
        window: Number of recent blocks to consider
    
    Returns:
        Dict with mempool metrics
    """
    if len(block_data) == 0:
        return {"gas_utilization": 0.5, "pending_txs": 0.0}
    
    recent = block_data.tail(window)
    
    return {
        "gas_utilization": (recent['gas_used'] / recent['gas_limit']).mean() if 'gas_limit' in recent.columns else 0.5,
        "pending_txs": recent['pending_transactions'].mean() if 'pending_transactions' in recent.columns else 0.0,
    }


def extract_all_features(
    redemption_id: int,
    redemption_time: datetime,
    ftso_prices: pd.Series,
    redemptions: pd.DataFrame,
    attestations: pd.DataFrame,
    agent_address: str,
    block_data: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Extract all features for a redemption prediction.
    
    Args:
        redemption_id: Redemption ID
        redemption_time: Timestamp of redemption request
        ftso_prices: Historical FTSO prices
        redemptions: Historical redemption data
        attestations: Historical FDC attestations
        agent_address: Agent handling redemption
        block_data: Recent block data
    
    Returns:
        Dict with all features
    """
    features = {}
    
    # FTSO volatility
    features.update(compute_ftso_volatility(ftso_prices))
    
    # Redemption success rate
    features["redemption_success_rate"] = compute_redemption_success_rate(redemptions)
    
    # FDC latency
    features.update(compute_fdc_latency_stats(attestations))
    
    # Time features
    features.update(extract_time_features(redemption_time))
    
    # Agent performance
    features.update(compute_agent_performance(redemptions, agent_address))
    
    # Mempool metrics
    features.update(compute_mempool_metrics(block_data))
    
    # Redemption-specific
    features["redemption_id"] = redemption_id
    features["redemption_amount"] = redemptions[redemptions['redemption_id'] == redemption_id]['amount'].iloc[0] if len(redemptions[redemptions['redemption_id'] == redemption_id]) > 0 else 0.0
    
    return features


def prepare_feature_matrix(
    redemptions: pd.DataFrame,
    ftso_prices: pd.Series,
    attestations: pd.DataFrame,
    block_data: pd.DataFrame,
) -> pd.DataFrame:
    """
    Prepare feature matrix for all redemptions.
    
    Args:
        redemptions: DataFrame with all redemptions
        ftso_prices: Historical FTSO prices
        attestations: Historical FDC attestations
        block_data: Block data
    
    Returns:
        DataFrame with features for each redemption
    """
    feature_rows = []
    
    for _, redemption in redemptions.iterrows():
        features = extract_all_features(
            redemption['redemption_id'],
            redemption['timestamp'],
            ftso_prices,
            redemptions,
            attestations,
            redemption.get('agent', ''),
            block_data,
        )
        feature_rows.append(features)
    
    return pd.DataFrame(feature_rows)



