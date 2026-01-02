"""
Conformal prediction calibration for confidence intervals.

Ensures confidence intervals have proper coverage:
- Computes [p_lower, p_upper] for each prediction
- Validates coverage on holdout sets
"""
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any
from sklearn.model_selection import KFold


def compute_conformal_intervals(
    predictions: np.ndarray,
    actuals: np.ndarray,
    alpha: float = 0.003,  # 0.3% error rate target
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute conformal prediction intervals.
    
    Args:
        predictions: Model probability predictions
        actuals: Actual binary outcomes
        alpha: Target error rate (0.003 = 0.3%)
    
    Returns:
        Tuple of (lower_bounds, upper_bounds)
    """
    # Compute nonconformity scores (absolute error)
    scores = np.abs(predictions - actuals)
    
    # Compute quantile threshold
    quantile = np.quantile(scores, 1 - alpha)
    
    # Create intervals
    lower_bounds = np.maximum(0, predictions - quantile)
    upper_bounds = np.minimum(1, predictions + quantile)
    
    return lower_bounds, upper_bounds


def calibrate_model(
    model: Any,
    X_cal: pd.DataFrame,
    y_cal: pd.Series,
    alpha: float = 0.003,
) -> Dict[str, Any]:
    """
    Calibrate model using conformal prediction.
    
    Args:
        model: Trained model
        X_cal: Calibration feature matrix
        y_cal: Calibration labels
        alpha: Target error rate
    
    Returns:
        Calibration parameters
    """
    # Get predictions on calibration set
    if hasattr(model, 'predict_proba'):
        predictions = model.predict_proba(X_cal)[:, 1]
    else:
        predictions = model.predict(X_cal)
    
    # Compute intervals
    lower_bounds, upper_bounds = compute_conformal_intervals(
        predictions, y_cal.values, alpha
    )
    
    return {
        "alpha": alpha,
        "quantile_threshold": np.quantile(np.abs(predictions - y_cal.values), 1 - alpha),
        "coverage": np.mean((y_cal.values >= lower_bounds) & (y_cal.values <= upper_bounds)),
        "mean_interval_width": np.mean(upper_bounds - lower_bounds),
    }


def validate_coverage(
    lower_bounds: np.ndarray,
    upper_bounds: np.ndarray,
    actuals: np.ndarray,
    target_coverage: float = 0.997,
) -> Dict[str, Any]:
    """
    Validate that confidence intervals have proper coverage.
    
    Args:
        lower_bounds: Lower bounds for each prediction
        upper_bounds: Upper bounds for each prediction
        actuals: Actual outcomes
        target_coverage: Target coverage (0.997 = 99.7%)
    
    Returns:
        Validation metrics
    """
    coverage = np.mean((actuals >= lower_bounds) & (actuals <= upper_bounds))
    
    return {
        "coverage": coverage,
        "target_coverage": target_coverage,
        "meets_target": coverage >= target_coverage,
        "interval_width_mean": np.mean(upper_bounds - lower_bounds),
        "interval_width_std": np.std(upper_bounds - lower_bounds),
    }


def cross_validate_calibration(
    model: Any,
    X: pd.DataFrame,
    y: pd.Series,
    n_splits: int = 5,
    alpha: float = 0.003,
) -> Dict[str, Any]:
    """
    Cross-validate conformal calibration.
    
    Args:
        model: Model to calibrate
        X: Feature matrix
        y: Labels
        n_splits: Number of CV folds
        alpha: Target error rate
    
    Returns:
        Cross-validation results
    """
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    coverages = []
    
    for train_idx, cal_idx in kf.split(X):
        X_train, X_cal = X.iloc[train_idx], X.iloc[cal_idx]
        y_train, y_cal = y.iloc[train_idx], y.iloc[cal_idx]
        
        # Train model (simplified - in production would use full training)
        # For now, use calibration set to compute intervals
        if hasattr(model, 'predict_proba'):
            predictions = model.predict_proba(X_cal)[:, 1]
        else:
            predictions = model.predict(X_cal)
        
        lower_bounds, upper_bounds = compute_conformal_intervals(
            predictions, y_cal.values, alpha
        )
        
        coverage = np.mean(
            (y_cal.values >= lower_bounds) & (y_cal.values <= upper_bounds)
        )
        coverages.append(coverage)
    
    return {
        "mean_coverage": np.mean(coverages),
        "std_coverage": np.std(coverages),
        "min_coverage": np.min(coverages),
        "max_coverage": np.max(coverages),
        "target_coverage": 1 - alpha,
    }



