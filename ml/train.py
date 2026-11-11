"""Run from project root: python -m ml.train. Test data is never used for selection."""

import hashlib, json, platform
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.kernel_ridge import KernelRidge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from ml.feature_builder import build_frame

ROOT = Path(__file__).resolve().parents[1]


def metrics(y, p):
    return {
        "mae": float(mean_absolute_error(y, p)),
        "rmse": float(np.sqrt(mean_squared_error(y, p))),
        "r2": float(r2_score(y, p)),
    }


def main():
    path = ROOT / "data/crystalforge_dataset_enriched.csv"
    df = pd.read_csv(path)
    assert df.groupby("split_group_id").data_split.nunique().max() == 1, (
        "Groups cross train/test boundary"
    )
    assert (
        df[df.data_split == "train"].groupby("split_group_id").cv_fold_5.nunique().max()
        == 1
    )
    X = build_frame(df)
    y = df.target_voltage.to_numpy()
    assert np.isfinite(y).all()
    train = (df.data_split == "train").to_numpy()
    folds = df.cv_fold_5.to_numpy()
    fit = train & ~np.isin(folds, [0, 4])
    val = train & (folds == 0)
    cal = train & (folds == 4)
    test = (df.data_split == "test").to_numpy()
    cats = ["working_ion", "crystal_system"]
    nums = [c for c in X if c not in cats]
    pre = ColumnTransformer(
        [
            (
                "numeric",
                Pipeline(
                    [
                        (
                            "impute",
                            SimpleImputer(strategy="median", keep_empty_features=True),
                        ),
                        ("scale", StandardScaler()),
                    ]
                ),
                nums,
            ),
            (
                "category",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                cats,
            ),
        ]
    )
    candidates = {
        "Baseline": DummyRegressor(),
        "Random Forest": RandomForestRegressor(
            n_estimators=160,
            min_samples_leaf=2,
            max_features=0.8,
            n_jobs=-1,
            random_state=42,
        ),
        "SVR": SVR(C=10, epsilon=0.1),
        "Kernel Ridge": KernelRidge(alpha=1, kernel="rbf", gamma=0.01),
        "Gradient Boosting": HistGradientBoostingRegressor(
            max_iter=180, l2_regularization=1, random_state=42
        ),
    }
    runs = []
    fitted = {}
    for name, model in candidates.items():
        pipe = Pipeline([("preprocessor", pre), ("model", model)])
        pipe.fit(X[fit], y[fit])
        runs.append({"name": name, "validation": metrics(y[val], pipe.predict(X[val]))})
        fitted[name] = pipe
        print(name, runs[-1]["validation"], flush=True)
    winner = min(runs, key=lambda r: r["validation"]["mae"])["name"]
    # Refit each candidate on fit + validation only. Calibration and test remain held out.
    for run in runs:
        pipe = fitted[run["name"]]
        pipe.fit(X[fit | val], y[fit | val])
        run["test"] = metrics(y[test], pipe.predict(X[test]))
    pipe = fitted[winner]
    residual = np.abs(y[cal] - pipe.predict(X[cal]))
    q = float(
        np.quantile(
            residual,
            min(1, np.ceil((len(residual) + 1) * 0.9) / len(residual)),
            method="higher",
        )
    )
    pred = pipe.predict(X[test])
    overlap = int(df.groupby("framework_formula").data_split.nunique().gt(1).sum())
    version = "cf-" + hashlib.sha256(path.read_bytes()).hexdigest()[:10]
    meta = {
        "version": version,
        "selected_model": winner,
        "selection": "Lowest validation MAE on supplied training fold 0; fold 4 reserved for calibration. No test-driven selection.",
        "models": runs,
        "counts": {
            "fit": int(fit.sum()),
            "validation": int(val.sum()),
            "calibration": int(cal.sum()),
            "test": int(test.sum()),
        },
        "interval": {
            "method": "Split conformal absolute residuals",
            "nominal_coverage": 0.9,
            "radius_volts": q,
            "test_coverage": float(np.mean(np.abs(y[test] - pred) <= q)),
        },
        "split_method": str(df.split_method.iloc[0]),
        "framework_overlap_count": overlap,
        "limitations": [
            "Supplied split is grouped by battery ID, not by material framework. Related frameworks occur in both splits; scores do not establish performance on novel chemistry.",
            "Formula-based descriptors are recomputed consistently; supplied Magpie and historical prediction columns are not used.",
            "Prediction intervals are marginal, not guarantees for each ion or out-of-domain compound.",
            "Dataset provenance is user-supplied and has not been independently verified.",
        ],
        "features": list(X.columns),
        "python": platform.python_version(),
        "sklearn": sklearn.__version__,
        "test_points": [
            {"actual": float(a), "predicted": float(p), "residual": float(a - p)}
            for a, p in zip(y[test], pred)
        ],
    }
    (ROOT / "models").mkdir(exist_ok=True)
    (ROOT / "reports").mkdir(exist_ok=True)
    joblib.dump(
        {"pipeline": pipe, "metadata": meta}, ROOT / "models/model.joblib", compress=3
    )
    (ROOT / "models/model_metadata.json").write_text(json.dumps(meta, indent=2))
    (ROOT / "reports/evaluation.json").write_text(json.dumps(meta, indent=2))
    np.save(ROOT / "models/catalog_predictions.npy", pipe.predict(X))
    joblib.dump(
        pipe.named_steps["preprocessor"].transform(X),
        ROOT / "models/catalog_features.joblib",
        compress=3,
    )
    print("Selected", winner, "interval radius", q, flush=True)


if __name__ == "__main__":
    main()
