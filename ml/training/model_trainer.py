"""
Model training for FLIP prediction engine.

Supports:
- XGBoost model training
- Neural network training (alternative)
- Ensemble method implementation
- Model serialization and versioning
"""
import pickle
import json
import os
from datetime import datetime
from typing import Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import xgboost as xgb
try:
    import tensorflow as tf
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False


class ModelTrainer:
    """Train and manage ML models for redemption success prediction."""
    
    def __init__(self, model_dir: str = "ml/models"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        self.models = {}
        self.model_metadata = {}
    
    def train_xgboost(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        test_size: float = 0.2,
        params: Optional[Dict[str, Any]] = None,
    ) -> Tuple[xgb.XGBClassifier, Dict[str, float]]:
        """
        Train XGBoost classifier.
        
        Args:
            X: Feature matrix
            y: Target labels (1 = success, 0 = failure)
            test_size: Test set fraction
            params: XGBoost parameters
        
        Returns:
            Trained model and metrics
        """
        if params is None:
            params = {
                "max_depth": 6,
                "learning_rate": 0.1,
                "n_estimators": 100,
                "objective": "binary:logistic",
                "eval_metric": "logloss",
            }
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        model = xgb.XGBClassifier(**params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False
        )
        
        # Evaluate
        y_pred = model.predict(X_test)
        metrics = {
            "accuracy": accuracy_score(y_test, y_pred),
            "precision": precision_score(y_test, y_pred, zero_division=0),
            "recall": recall_score(y_test, y_pred, zero_division=0),
            "f1": f1_score(y_test, y_pred, zero_division=0),
        }
        
        return model, metrics
    
    def train_neural_network(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        test_size: float = 0.2,
        hidden_layers: Tuple[int, ...] = (64, 32),
    ) -> Tuple[Any, Dict[str, float]]:
        """
        Train neural network classifier.
        
        Args:
            X: Feature matrix
            y: Target labels
            test_size: Test set fraction
            hidden_layers: Hidden layer sizes
        
        Returns:
            Trained model and metrics
        """
        if not TENSORFLOW_AVAILABLE:
            raise ImportError("TensorFlow not available")
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        model = tf.keras.Sequential([
            tf.keras.layers.Dense(hidden_layers[0], activation='relu', input_shape=(X.shape[1],)),
            *[tf.keras.layers.Dense(size, activation='relu') for size in hidden_layers[1:]],
            tf.keras.layers.Dense(1, activation='sigmoid')
        ])
        
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy']
        )
        
        model.fit(
            X_train, y_train,
            epochs=50,
            batch_size=32,
            validation_data=(X_test, y_test),
            verbose=0
        )
        
        y_pred = (model.predict(X_test) > 0.5).astype(int).flatten()
        metrics = {
            "accuracy": accuracy_score(y_test, y_pred),
            "precision": precision_score(y_test, y_pred, zero_division=0),
            "recall": recall_score(y_test, y_pred, zero_division=0),
            "f1": f1_score(y_test, y_pred, zero_division=0),
        }
        
        return model, metrics
    
    def train_ensemble(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        models: list,
    ) -> Tuple[Any, Dict[str, float]]:
        """
        Train ensemble of models.
        
        Args:
            X: Feature matrix
            y: Target labels
            models: List of (model_type, params) tuples
        
        Returns:
            Ensemble model and metrics
        """
        # Simple voting ensemble
        predictions = []
        for model_type, params in models:
            if model_type == "xgboost":
                model, _ = self.train_xgboost(X, y, params=params)
                pred = model.predict_proba(X)[:, 1]
                predictions.append(pred)
            # Add other model types as needed
        
        # Average predictions
        ensemble_pred = np.mean(predictions, axis=0)
        ensemble_pred_binary = (ensemble_pred > 0.5).astype(int)
        
        metrics = {
            "accuracy": accuracy_score(y, ensemble_pred_binary),
            "precision": precision_score(y, ensemble_pred_binary, zero_division=0),
            "recall": recall_score(y, ensemble_pred_binary, zero_division=0),
            "f1": f1_score(y, ensemble_pred_binary, zero_division=0),
        }
        
        return {"predictions": ensemble_pred, "models": models}, metrics
    
    def save_model(
        self,
        model: Any,
        model_name: str,
        metadata: Dict[str, Any],
    ) -> str:
        """
        Save model with versioning.
        
        Args:
            model: Trained model
            model_name: Model name
            metadata: Model metadata (metrics, features, etc.)
        
        Returns:
            Path to saved model
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        version = f"{model_name}_{timestamp}"
        model_path = os.path.join(self.model_dir, f"{version}.pkl")
        metadata_path = os.path.join(self.model_dir, f"{version}_metadata.json")
        
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        
        metadata['version'] = version
        metadata['saved_at'] = timestamp
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        self.models[version] = model_path
        self.model_metadata[version] = metadata
        
        return model_path
    
    def load_model(self, version: str) -> Tuple[Any, Dict[str, Any]]:
        """Load model by version."""
        model_path = self.models.get(version)
        if not model_path or not os.path.exists(model_path):
            raise FileNotFoundError(f"Model {version} not found")
        
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        metadata_path = os.path.join(self.model_dir, f"{version}_metadata.json")
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        return model, metadata



