#!/usr/bin/env python3
"""
Real model training script for FLIP.

Collects data from Flare networks, engineers features, trains models,
and validates performance.
"""
import os
import sys
import argparse
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Add paths
sys.path.append(os.path.join(os.path.dirname(__file__), '../../data-pipeline/collector'))
sys.path.append(os.path.dirname(__file__))

from feature_engineering import prepare_feature_matrix, extract_all_features
from model_trainer import ModelTrainer
from calibration import calibrate_model, validate_coverage
from backtest import BacktestFramework

def collect_training_data(network: str = "coston2", days: int = 30):
    """Collect training data from Flare networks."""
    print(f"Collecting training data from {network} (last {days} days)...")
    
    from ftso_history import collect_ftso_data
    from fdc_attestations import get_recent_attestations
    from fassets_redemptions import get_recent_redemptions
    
    # Collect FTSO data
    print("Collecting FTSO prices...")
    ftso_df = collect_ftso_data(
        ['XRP/USD', 'BTC/USD'],
        network=network,
        hours=days * 24
    )
    
    # Collect FDC attestations
    print("Collecting FDC attestations...")
    fdc_df = get_recent_attestations(hours=days * 24, network=network)
    
    # Collect redemptions
    print("Collecting redemption events...")
    redemption_df = get_recent_redemptions('FXRP', hours=days * 24, network=network)
    
    return ftso_df, fdc_df, redemption_df


def create_training_dataset(ftso_df, fdc_df, redemption_df):
    """Create training dataset from collected data."""
    print("Creating training dataset...")
    
    if redemption_df.empty:
        print("No redemption data - generating synthetic dataset for demonstration")
        # Generate synthetic training data
        n_samples = 10000
        features = pd.DataFrame({
            'volatility_1h': np.random.gamma(2, 0.01, n_samples),
            'volatility_24h': np.random.gamma(2, 0.01, n_samples),
            'redemption_success_rate': np.random.beta(95, 5, n_samples),
            'fdc_latency_mean': np.random.normal(240, 60, n_samples),
            'fdc_latency_p95': np.random.normal(300, 80, n_samples),
            'fdc_latency_p99': np.random.normal(360, 100, n_samples),
            'hour': np.random.randint(0, 24, n_samples),
            'hour_sin': np.sin(2 * np.pi * np.random.randint(0, 24, n_samples) / 24),
            'hour_cos': np.cos(2 * np.pi * np.random.randint(0, 24, n_samples) / 24),
            'day_of_week': np.random.randint(0, 7, n_samples),
            'is_weekend': np.random.choice([0, 1], n_samples, p=[0.7, 0.3]),
            'redemption_amount': np.random.lognormal(10, 1, n_samples),
        })
        
        # Generate labels (high success rate with some failures)
        # Success probability based on features
        success_prob = (
            0.95 + 
            0.02 * (features['redemption_success_rate'] - 0.95) +
            0.01 * (1 - features['volatility_24h'] / 0.1) +
            np.random.normal(0, 0.01, n_samples)
        )
        success_prob = np.clip(success_prob, 0, 1)
        labels = (np.random.random(n_samples) < success_prob).astype(int)
        
        return features, pd.Series(labels, name='success')
    
    # Real data processing
    # Merge datasets and extract features
    features_list = []
    labels_list = []
    
    for _, redemption in redemption_df.iterrows():
        # Extract features for this redemption
        features = extract_all_features(
            redemption.get('redemption_id', 0),
            pd.to_datetime(redemption.get('timestamp', datetime.now())),
            ftso_df['price'] if not ftso_df.empty else pd.Series(),
            redemption_df,
            fdc_df,
            redemption.get('user', ''),
            pd.DataFrame(),  # Block data placeholder
        )
        
        features_list.append(features)
        labels_list.append(1 if redemption.get('status') == 'completed' else 0)
    
    features_df = pd.DataFrame(features_list)
    labels = pd.Series(labels_list, name='success')
    
    return features_df, labels


def main():
    parser = argparse.ArgumentParser(description='Train FLIP ML model')
    parser.add_argument('--network', default='coston2', choices=['mainnet', 'coston2', 'songbird'],
                       help='Flare network to collect data from')
    parser.add_argument('--days', type=int, default=30,
                       help='Number of days of historical data to collect')
    parser.add_argument('--model-type', default='xgboost', choices=['xgboost', 'neural', 'ensemble'],
                       help='Model type to train')
    parser.add_argument('--output-dir', default='ml/models',
                       help='Directory to save trained models')
    
    args = parser.parse_args()
    
    # Collect data
    ftso_df, fdc_df, redemption_df = collect_training_data(args.network, args.days)
    
    # Create training dataset
    X, y = create_training_dataset(ftso_df, fdc_df, redemption_df)
    
    print(f"\nTraining dataset: {len(X)} samples, {len(X.columns)} features")
    print(f"Success rate: {y.mean():.2%}")
    
    # Train model
    trainer = ModelTrainer(model_dir=args.output_dir)
    
    if args.model_type == 'xgboost':
        print("\nTraining XGBoost model...")
        model, metrics = trainer.train_xgboost(X, y)
        print(f"Model metrics: {metrics}")
        
        # Calibrate
        print("\nCalibrating model...")
        X_train, X_cal, y_train, y_cal = train_test_split(X, y, test_size=0.2, random_state=42)
        calibration_params = calibrate_model(model, X_cal, y_cal)
        print(f"Calibration: {calibration_params}")
        
        # Save model
        metadata = {
            'metrics': metrics,
            'calibration': calibration_params,
            'features': list(X.columns),
            'network': args.network,
            'training_samples': len(X),
        }
        model_path = trainer.save_model(model, 'flip_xgboost', metadata)
        print(f"\nModel saved to: {model_path}")
        
    elif args.model_type == 'neural':
        print("\nTraining neural network...")
        model, metrics = trainer.train_neural_network(X, y)
        print(f"Model metrics: {metrics}")
        
        metadata = {
            'metrics': metrics,
            'features': list(X.columns),
            'network': args.network,
        }
        model_path = trainer.save_model(model, 'flip_neural', metadata)
        print(f"\nModel saved to: {model_path}")
    
    # Backtest
    print("\nRunning backtest...")
    backtest = BacktestFramework()
    
    # Create predictions dataframe
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    predictions = model.predict_proba(X_test)[:, 1]
    
    predictions_df = pd.DataFrame({
        'redemption_id': range(len(predictions)),
        'probability': predictions,
        'confidence_lower': predictions - 0.01,  # Simplified
        'confidence_upper': predictions + 0.01,
    })
    
    actuals_df = pd.DataFrame({
        'redemption_id': range(len(y_test)),
        'success': y_test.values,
    })
    
    backtest_results = backtest.backtest_historical(predictions_df, actuals_df)
    print(f"\nBacktest results:")
    print(f"Accuracy: {backtest_results['accuracy']:.4f}")
    print(f"Precision: {backtest_results['precision']:.4f}")
    print(f"Recall: {backtest_results['recall']:.4f}")
    print(f"Insurance utilization: {backtest_results['insurance_utilization']:.4f}")
    print(f"Meets target (>99.7%): {backtest_results['meets_target']}")


if __name__ == "__main__":
    main()

