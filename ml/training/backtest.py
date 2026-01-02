"""
Historical backtesting framework for FLIP logic.

Simulates provisional settlement decisions on historical data:
- Metrics: FPR/FNR, latency reduction, insurance utilization
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta


class BacktestFramework:
    """Backtest FLIP logic on historical redemption data."""
    
    def __init__(
        self,
        confidence_threshold: float = 0.997,
        low_confidence_threshold: float = 0.95,
    ):
        self.confidence_threshold = confidence_threshold
        self.low_confidence_threshold = low_confidence_threshold
    
    def simulate_redemption(
        self,
        redemption_id: int,
        prediction_prob: float,
        confidence_lower: float,
        confidence_upper: float,
        actual_outcome: bool,
    ) -> Dict[str, Any]:
        """
        Simulate a single redemption decision.
        
        Args:
            redemption_id: Redemption ID
            prediction_prob: Predicted success probability
            confidence_lower: Lower confidence bound
            confidence_upper: Upper confidence bound
            actual_outcome: True if redemption actually succeeded
        
        Returns:
            Decision and outcome
        """
        # Decision logic
        if confidence_lower >= self.confidence_threshold:
            decision = "provisional_settle"
        elif confidence_lower < self.low_confidence_threshold:
            decision = "queue_fdc"
        else:
            decision = "buffer_earmark"
        
        # Outcomes
        if decision == "provisional_settle":
            if actual_outcome:
                result = "success"  # Correct prediction
            else:
                result = "false_positive"  # Insurance payout needed
        else:
            result = "queued"  # Waited for FDC
        
        return {
            "redemption_id": redemption_id,
            "decision": decision,
            "result": result,
            "prediction_prob": prediction_prob,
            "confidence_lower": confidence_lower,
            "actual_outcome": actual_outcome,
        }
    
    def backtest_historical(
        self,
        predictions: pd.DataFrame,
        actuals: pd.DataFrame,
    ) -> Dict[str, Any]:
        """
        Backtest on historical data.
        
        Args:
            predictions: DataFrame with columns ['redemption_id', 'probability', 'confidence_lower', 'confidence_upper']
            actuals: DataFrame with columns ['redemption_id', 'success']
        
        Returns:
            Backtest metrics
        """
        merged = predictions.merge(actuals, on='redemption_id', how='inner')
        
        results = []
        for _, row in merged.iterrows():
            result = self.simulate_redemption(
                row['redemption_id'],
                row['probability'],
                row['confidence_lower'],
                row['confidence_upper'],
                row['success'],
            )
            results.append(result)
        
        results_df = pd.DataFrame(results)
        
        # Compute metrics
        total = len(results_df)
        provisional_settled = results_df[results_df['decision'] == 'provisional_settle']
        
        true_positives = len(provisional_settled[provisional_settled['result'] == 'success'])
        false_positives = len(provisional_settled[provisional_settled['result'] == 'false_positive'])
        
        queued = results_df[results_df['decision'] == 'queue_fdc']
        false_negatives = len(queued[queued['actual_outcome'] == True])  # Could have settled but didn't
        
        accuracy = (true_positives + len(queued[queued['actual_outcome'] == False])) / total
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0
        
        # Insurance utilization
        insurance_payouts = false_positives
        insurance_utilization = insurance_payouts / len(provisional_settled) if len(provisional_settled) > 0 else 0.0
        
        # Latency reduction (provisional settlements vs FDC wait)
        provisional_count = len(provisional_settled)
        latency_reduction = provisional_count / total  # Fraction that got instant settlement
        
        return {
            "total_redemptions": total,
            "provisional_settlements": len(provisional_settled),
            "queued_for_fdc": len(queued),
            "true_positives": true_positives,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0,
            "insurance_utilization": insurance_utilization,
            "latency_reduction": latency_reduction,
            "target_accuracy": 0.997,
            "meets_target": accuracy >= 0.997,
        }
    
    def cross_validate(
        self,
        predictions: pd.DataFrame,
        actuals: pd.DataFrame,
        n_splits: int = 5,
    ) -> Dict[str, Any]:
        """
        Cross-validate backtest.
        
        Args:
            predictions: Prediction data
            actuals: Actual outcomes
            n_splits: Number of CV folds
        
        Returns:
            Cross-validation metrics
        """
        from sklearn.model_selection import KFold
        
        merged = predictions.merge(actuals, on='redemption_id', how='inner')
        kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
        
        fold_metrics = []
        
        for train_idx, test_idx in kf.split(merged):
            test_data = merged.iloc[test_idx]
            test_predictions = test_data[['redemption_id', 'probability', 'confidence_lower', 'confidence_upper']]
            test_actuals = test_data[['redemption_id', 'success']]
            
            metrics = self.backtest_historical(test_predictions, test_actuals)
            fold_metrics.append(metrics)
        
        # Aggregate
        return {
            "mean_accuracy": np.mean([m['accuracy'] for m in fold_metrics]),
            "std_accuracy": np.std([m['accuracy'] for m in fold_metrics]),
            "mean_precision": np.mean([m['precision'] for m in fold_metrics]),
            "mean_recall": np.mean([m['recall'] for m in fold_metrics]),
            "mean_insurance_utilization": np.mean([m['insurance_utilization'] for m in fold_metrics]),
            "all_folds": fold_metrics,
        }
    
    def out_of_sample_test(
        self,
        predictions: pd.DataFrame,
        actuals: pd.DataFrame,
        train_end_date: datetime,
    ) -> Dict[str, Any]:
        """
        Out-of-sample test on data after training period.
        
        Args:
            predictions: All predictions
            actuals: All actuals
            train_end_date: End date of training period
        
        Returns:
            Out-of-sample metrics
        """
        # Filter to out-of-sample period
        # Assuming predictions/actuals have timestamp column
        if 'timestamp' in predictions.columns:
            oos_predictions = predictions[predictions['timestamp'] > train_end_date]
            oos_actuals = actuals[actuals['timestamp'] > train_end_date]
        else:
            # If no timestamp, use last 30% as OOS
            split_idx = int(len(predictions) * 0.7)
            oos_predictions = predictions.iloc[split_idx:]
            oos_actuals = actuals.iloc[split_idx:]
        
        return self.backtest_historical(oos_predictions, oos_actuals)



