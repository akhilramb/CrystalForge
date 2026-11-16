"""Evaluate voltage models on a held-out set of unseen framework formulas.

Run from the repository root with: python -m ml.evaluate_framework_disjoint
This benchmark does not alter the production model or its existing evaluation.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.kernel_ridge import KernelRidge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVR

from ml.feature_builder import build_frame

ROOT = Path(__file__).resolve().parents[1]
SEED = 42


def regression_metrics(actual, predicted):
    return {
        "mae_volts": float(mean_absolute_error(actual, predicted)),
        "rmse_volts": float(np.sqrt(mean_squared_error(actual, predicted))),
        "r2": float(r2_score(actual, predicted)),
    }


def main():
    dataset = pd.read_csv(ROOT / "data/crystalforge_dataset_enriched.csv")
    if dataset["framework_formula"].isna().any():
        raise ValueError("Framework grouping contains missing values.")

    features = build_frame(dataset)
    target = dataset["target_voltage"].to_numpy()
    groups = dataset["framework_formula"].astype(str).to_numpy()
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    train_indices, test_indices = next(splitter.split(features, target, groups))
    train_groups = set(groups[train_indices])
    test_groups = set(groups[test_indices])
    if train_groups & test_groups:
        raise ValueError("Framework formulas overlap between benchmark partitions.")

    categories = ["working_ion", "crystal_system"]
    numeric = [column for column in features if column not in categories]
    preprocess = ColumnTransformer(
        [
            (
                "numeric",
                Pipeline(
                    [
                        ("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
                        ("scale", StandardScaler()),
                    ]
                ),
                numeric,
            ),
            (
                "category",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categories,
            ),
        ]
    )
    models = {
        "Baseline": DummyRegressor(),
        "Random Forest": RandomForestRegressor(
            n_estimators=160,
            min_samples_leaf=2,
            max_features=0.8,
            n_jobs=-1,
            random_state=SEED,
        ),
        "SVR": SVR(C=10, epsilon=0.1),
        "Kernel Ridge": KernelRidge(alpha=1, kernel="rbf", gamma=0.01),
        "Gradient Boosting": HistGradientBoostingRegressor(
            max_iter=180, l2_regularization=1, random_state=SEED
        ),
    }

    results = []
    for name, estimator in models.items():
        pipeline = Pipeline(
            [("preprocessor", preprocess), ("model", estimator)]
        )
        pipeline.fit(features.iloc[train_indices], target[train_indices])
        prediction = pipeline.predict(features.iloc[test_indices])
        result = {
            "name": name,
            "test": regression_metrics(target[test_indices], prediction),
        }
        results.append(result)
        print(name, result["test"], flush=True)

    report = {
        "protocol": (
            "Single seeded 80/20 GroupShuffleSplit by framework_formula. "
            "Every framework formula is held out as a group. Models use the "
            "same feature builder and estimator settings as ml.train. This is "
            "an exploratory benchmark, not a repeated nested validation."
        ),
        "seed": SEED,
        "dataset_rows": int(len(dataset)),
        "framework_groups": int(len(set(groups))),
        "train_rows": int(len(train_indices)),
        "test_rows": int(len(test_indices)),
        "train_framework_groups": int(len(train_groups)),
        "test_framework_groups": int(len(test_groups)),
        "framework_overlap": int(len(train_groups & test_groups)),
        "target_summary_volts": {
            "minimum": float(np.min(target)),
            "median": float(np.median(target)),
            "maximum": float(np.max(target)),
        },
        "models": results,
        "limitations": [
            "One random seed gives a single estimate with split sensitivity.",
            "Framework formula is a coarse grouping and does not guarantee all related chemistries are separated.",
            "Dataset provenance and target measurement status have not been independently verified.",
            "Outlier targets can strongly affect RMSE and should be checked against source records.",
            "This benchmark does not select or replace the deployed production model.",
        ],
    }
    encoded = json.dumps(report, indent=2) + "\n"
    destinations = [
        ROOT / "reports/framework_disjoint_evaluation.json",
        ROOT / "models/framework_disjoint_evaluation.json",
    ]
    for destination in destinations:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(encoded, encoding="utf-8")
    print("Saved reports/framework_disjoint_evaluation.json", flush=True)


if __name__ == "__main__":
    main()
