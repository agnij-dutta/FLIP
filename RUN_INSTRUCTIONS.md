# Step-by-Step Execution Guide

## Prerequisites

1. **Activate Python virtual environment:**
   ```bash
   cd /home/agnij/Desktop/FLIP
   source .venv/bin/activate
   ```

2. **Verify dependencies are installed:**
   ```bash
   python3 -c "import pandas, numpy, matplotlib, seaborn, xgboost, tensorflow, web3; print('✅ All dependencies OK')"
   ```

---

## Execution Order

### Step 1: Feature Exploration Notebook
**File:** `ml/research/feature_exploration.ipynb`

**Purpose:** Explore FTSO volatility, FDC latency, and redemption patterns

**How to run:**
1. Open Jupyter:
   ```bash
   cd /home/agnij/Desktop/FLIP
   jupyter notebook ml/research/feature_exploration.ipynb
   ```
   OR if using VS Code/Cursor: Open the notebook file directly

2. **Restart kernel** (important after code changes):
   - In Jupyter: `Kernel → Restart Kernel and Clear Outputs`
   - In VS Code: Click the restart button in the notebook toolbar

3. **Run all cells:**
   - In Jupyter: `Cell → Run All`
   - In VS Code: Click "Run All" button or press `Shift+Enter` on each cell

**Expected output:**
- ✅ FTSO price volatility charts
- ✅ FDC attestation latency distribution
- ✅ Redemption success rate analysis
- ✅ Feature correlation matrix
- ✅ Time-of-day patterns

**Time:** ~15-30 seconds (queries 2 hours of data)

**If errors occur:**
- Check that the kernel is using the `.venv` Python environment
- Verify RPC connection to Coston2 testnet
- If no real data, synthetic data will be generated automatically

---

### Step 2: Model Prototyping Notebook
**File:** `ml/research/model_prototyping.ipynb`

**Purpose:** Test XGBoost, Neural Networks, and Ensemble models

**How to run:**
1. Open the notebook:
   ```bash
   jupyter notebook ml/research/model_prototyping.ipynb
   ```

2. **Restart kernel** (if coming from previous notebook)

3. **Run all cells**

**Expected output:**
- ✅ Synthetic data generation
- ✅ XGBoost model training and metrics
- ✅ Neural Network model training and metrics
- ✅ Ensemble model comparison
- ✅ Model performance visualizations

**Time:** ~1-2 minutes (trains 3 models on synthetic data)

**Dependencies:** None (uses synthetic data, doesn't need Step 1)

---

### Step 3: Conformal Calibration Notebook
**File:** `ml/research/conformal_calibration.ipynb`

**Purpose:** Validate confidence intervals using conformal prediction

**How to run:**
1. Open the notebook:
   ```bash
   jupyter notebook ml/research/conformal_calibration.ipynb
   ```

2. **Restart kernel**

3. **Run all cells**

**Expected output:**
- ✅ Base model training
- ✅ Split conformal prediction intervals
- ✅ Cross-conformal prediction intervals
- ✅ Coverage validation (should be ~95% for 95% confidence)
- ✅ Prediction interval visualizations

**Time:** ~1-2 minutes

**Dependencies:** None (uses synthetic data)

---

### Step 4: Backtest Framework Notebook
**File:** `ml/research/backtest_framework.ipynb`

**Purpose:** Historical simulation and performance validation

**How to run:**
1. Open the notebook:
   ```bash
   jupyter notebook ml/research/backtest_framework.ipynb
   ```

2. **Restart kernel**

3. **Run all cells**

**Expected output:**
- ✅ Historical redemption data generation
- ✅ FLIP decision logic simulation
- ✅ Performance metrics (accuracy, precision, recall, F1)
- ✅ Insurance pool utilization analysis
- ✅ Profit/loss charts

**Time:** ~1-2 minutes

**Dependencies:** None (uses synthetic historical data)

---

## Quick Run (All Notebooks)

If you want to run all notebooks in sequence:

```bash
cd /home/agnij/Desktop/FLIP
source .venv/bin/activate

# Option 1: Run via Jupyter
jupyter notebook ml/research/

# Option 2: Run via command line (if you have nbconvert)
jupyter nbconvert --to notebook --execute ml/research/feature_exploration.ipynb --inplace
jupyter nbconvert --to notebook --execute ml/research/model_prototyping.ipynb --inplace
jupyter nbconvert --to notebook --execute ml/research/conformal_calibration.ipynb --inplace
jupyter nbconvert --to notebook --execute ml/research/backtest_framework.ipynb --inplace
```

---

## Standalone Python Scripts (Optional)

After notebooks, you can run training scripts:

### Step 5: Train Full Model
**File:** `ml/training/train_model.py`

**Purpose:** Train production-ready models with real data

**How to run:**
```bash
cd /home/agnij/Desktop/FLIP
source .venv/bin/activate
python3 ml/training/train_model.py
```

**Expected output:**
- Collects data from Flare networks
- Trains XGBoost, Neural Network, and Ensemble models
- Saves models to `ml/models/`
- Generates training reports

**Time:** ~5-10 minutes (depends on data collection)

---

## Troubleshooting

### "Module not found" errors
```bash
# Make sure virtual environment is activated
source .venv/bin/activate

# Reinstall dependencies
pip install -r ml/requirements.txt
```

### "RPC connection failed" errors
- Check internet connection
- Verify RPC endpoints in `data-pipeline/collector/ftso_history.py`
- The notebooks will fall back to synthetic data automatically

### "Kernel keeps crashing"
- Restart kernel: `Kernel → Restart Kernel`
- Check Python version: `python3 --version` (should be 3.10+)
- Verify memory: `free -h`

### "Notebook not executing"
- Make sure kernel is selected (top right of notebook)
- Check kernel is using `.venv` Python: `import sys; print(sys.executable)`

---

## Summary

**Recommended order:**
1. ✅ `feature_exploration.ipynb` (15-30 sec)
2. ✅ `model_prototyping.ipynb` (1-2 min)
3. ✅ `conformal_calibration.ipynb` (1-2 min)
4. ✅ `backtest_framework.ipynb` (1-2 min)
5. ⚙️ `ml/training/train_model.py` (optional, 5-10 min)

**Total time:** ~5-10 minutes for all notebooks

**Note:** Each notebook is independent and can be run in any order, but the above order follows the logical ML development workflow.

