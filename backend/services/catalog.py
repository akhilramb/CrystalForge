import hashlib
from functools import lru_cache
import joblib
import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from ml.feature_builder import build_one, composition
from backend.config import ROOT
from backend.services.economics import economics


class Catalog:
    def __init__(self):
        self.df = pd.read_csv(
            ROOT / "data/crystalforge_dataset_enriched.csv"
        ).reset_index(drop=True)
        self.df["record_id"] = [
            "cf-" + str(i + 1).zfill(5) for i in range(len(self.df))
        ]
        self.by_id = {r.record_id: i for i, r in self.df.iterrows()}
        self.bundle = None
        self.error = None
        try:
            self.bundle = joblib.load(ROOT / "models/model.joblib")
            fingerprint = (
                "cf-"
                + hashlib.sha256(
                    (ROOT / "data/crystalforge_dataset_enriched.csv").read_bytes()
                ).hexdigest()[:10]
            )
            if fingerprint != self.bundle["metadata"]["version"]:
                raise ValueError(
                    "Dataset changed. Run python -m ml.train to regenerate model artifacts."
                )
            self.pred = np.load(ROOT / "models/catalog_predictions.npy")
            self.features = joblib.load(ROOT / "models/catalog_features.joblib")
            self.neighbors = NearestNeighbors().fit(self.features)
            if len(self.pred) != len(self.df):
                raise ValueError("Model catalog length mismatch. Retrain the model.")
        except Exception as exc:
            self.error = str(exc)
            self.bundle = None
            self.pred = np.full(len(self.df), np.nan)
        self.economies = [economics(f) for f in self.df.formula_discharge]
        self.df["cost"] = [e["cost"] for e in self.economies]
        self.df["sustainability"] = [e["sustainability"] for e in self.economies]
        self.df["prediction"] = self.pred

    def index(self, id):
        if id not in self.by_id:
            raise KeyError("Material not found.")
        return self.by_id[id]

    def record(self, id, detail=True):
        i = self.index(id)
        r = self.df.iloc[i]
        eco = self.economies[i]
        keys = [
            "battery_id",
            "working_ion",
            "formula_charge",
            "formula_discharge",
            "crystal_system",
            "space_group_number",
            "bravais_lattice",
            "e_above_hull",
            "formation_energy_per_atom",
            "band_gap",
            "max_delta_volume",
            "capacity_grav",
            "capacity_vol",
            "target_voltage",
            "preferred_structure_mp_id",
            "materials_project_structure_url",
            "source_provenance",
            "data_split",
            "frac_discharge",
        ]
        out = {k: (None if pd.isna(r[k]) else r[k]) for k in keys}
        out.update(
            id=id,
            formula=r.formula_discharge,
            predicted_voltage=None if pd.isna(self.pred[i]) else float(self.pred[i]),
            cost=eco["cost"],
            sustainability=eco["sustainability"],
            critical_elements=eco["critical_elements"],
            scarcity_risk=eco["scarcity_risk"],
        )
        if self.bundle:
            m = self.bundle["metadata"]
            q = m["interval"]["radius_volts"]
            out.update(
                interval=[float(self.pred[i] - q), float(self.pred[i] + q)],
                model_version=m["version"],
            )
        if detail:
            out["economics"] = eco
        return out

    def search(
        self,
        q="",
        ion="",
        system="",
        voltage_min=None,
        voltage_max=None,
        cost_max=None,
        stable=False,
        page=1,
        page_size=12,
        sort="formula",
    ):
        d = self.df
        if q:
            d = d[
                d[
                    [
                        "formula_discharge",
                        "battery_id",
                        "record_id",
                        "working_ion",
                        "preferred_structure_mp_id",
                    ]
                ]
                .astype(str)
                .apply(lambda s: s.str.contains(q, case=False, regex=False))
                .any(axis=1)
            ]
        if ion:
            d = d[d.working_ion == ion]
        if system:
            d = d[d.crystal_system == system]
        if voltage_min is not None:
            d = d[d.prediction >= voltage_min]
        if voltage_max is not None:
            d = d[d.prediction <= voltage_max]
        if cost_max is not None:
            d = d[d.cost <= cost_max]
        if stable:
            d = d[d.e_above_hull <= 0.05]
        col = {
            "formula": "formula_discharge",
            "voltage": "prediction",
            "cost": "cost",
            "sustainability": "sustainability",
        }.get(sort, "formula_discharge")
        d = d.sort_values(col, ascending=sort != "sustainability")
        return {
            "total": len(d),
            "page": page,
            "page_size": page_size,
            "items": [
                self.record(id, False)
                for id in d.record_id.iloc[(page - 1) * page_size : page * page_size]
            ],
        }

    def similar(self, vector, exclude=None):
        ds, ids = self.neighbors.kneighbors(vector, n_neighbors=6)
        return [
            dict(
                self.record(self.df.iloc[i].record_id, False),
                similarity=round(100 / (1 + float(d)), 1),
                feature_distance=float(d),
            )
            for d, i in zip(ds[0], ids[0])
            if self.df.iloc[i].record_id != exclude
        ][:5]

    def predict(self, inputs):
        if not self.bundle:
            raise RuntimeError("Model unavailable. Run python -m ml.train.")
        if inputs.get("material_id"):
            out = self.record(inputs["material_id"])
            out["similar"] = self.similar(
                self.features[[self.index(inputs["material_id"])]],
                inputs["material_id"],
            )
            out["warnings"] = [
                "Catalog prediction; this record may have been used in training. See data split."
            ]
            return out
        c = composition(inputs["formula"])
        if float(c.get_atomic_fraction(inputs["working_ion"])) <= 0:
            raise ValueError(
                "The formula must contain the selected working ion. Changing ion also requires a chemically consistent formula."
            )
        f = build_one(
            inputs["formula"],
            inputs["working_ion"],
            inputs.get("crystal_system") or "Unknown",
            inputs.get("space_group_number"),
            inputs.get("frac_discharge"),
        )
        X = pd.DataFrame([f])
        pipe = self.bundle["pipeline"]
        p = float(pipe.predict(X)[0])
        q = self.bundle["metadata"]["interval"]["radius_volts"]
        eco = economics(inputs["formula"])
        out = {
            **inputs,
            "predicted_voltage": p,
            "interval": [p - q, p + q],
            "model_version": self.bundle["metadata"]["version"],
            "economics": eco,
            **{
                k: eco[k]
                for k in [
                    "cost",
                    "sustainability",
                    "critical_elements",
                    "scarcity_risk",
                ]
            },
            "source_provenance": "User-entered formula. Dataset-only properties are unavailable for unverified structures.",
            "similar": self.similar(pipe.named_steps["preprocessor"].transform(X)),
            "warnings": [
                "Hypothetical input: composition and space-group consistency do not establish physical stability.",
                "90% marginal prediction interval; reliability may be lower outside the training domain.",
            ],
        }
        if (
            inputs.get("crystal_system") is None
            or inputs.get("space_group_number") is None
        ):
            out["warnings"].append(
                "Missing structural descriptors use training-only preprocessing defaults."
            )
        return out


@lru_cache
def catalog():
    return Catalog()
