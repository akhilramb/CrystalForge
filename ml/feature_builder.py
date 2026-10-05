"""Identical, formula-derived descriptors for training and live inference."""

import warnings
import numpy as np
import pandas as pd
from pymatgen.core import Composition, Element

IONS = ["Li", "Mg", "Ca", "Zn", "Y", "Al"]
SYSTEMS = [
    "Triclinic",
    "Monoclinic",
    "Orthorhombic",
    "Tetragonal",
    "Trigonal",
    "Hexagonal",
    "Cubic",
]


def composition(formula):
    try:
        c = Composition(formula, strict=True)
        if not c.valid or c.num_atoms <= 0 or any(v <= 0 for v in c.values()):
            raise ValueError()
        return c
    except Exception as exc:
        raise ValueError("Enter a valid chemical formula, such as LiFePO4.") from exc


def build_one(
    formula,
    working_ion,
    crystal_system="Unknown",
    space_group_number=None,
    frac_discharge=None,
):
    c = composition(formula)
    if working_ion not in IONS:
        raise ValueError("Unsupported working ion.")
    elements = list(c.elements)
    weights = np.array([c.get_atomic_fraction(e) for e in elements])
    features = {
        f"fraction_{Element.from_Z(z).symbol}": float(
            c.get_atomic_fraction(Element.from_Z(z))
        )
        for z in range(1, 95)
    }
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for name, getter in [
            ("number", lambda e: e.Z),
            ("mass", lambda e: float(e.atomic_mass)),
            ("electronegativity", lambda e: e.X),
            ("row", lambda e: e.row),
            ("group", lambda e: e.group),
        ]:
            values = np.array([getter(e) for e in elements], dtype=float)
            valid = np.isfinite(values)
            if valid.any():
                w = weights[valid] / weights[valid].sum()
                v = values[valid]
                features.update(
                    {
                        f"{name}_mean": float(np.dot(w, v)),
                        f"{name}_min": float(v.min()),
                        f"{name}_max": float(v.max()),
                        f"{name}_std": float(
                            np.sqrt(np.dot(w, (v - np.dot(w, v)) ** 2))
                        ),
                    }
                )
            else:
                features.update(
                    {f"{name}_{s}": np.nan for s in ["mean", "min", "max", "std"]}
                )
    features.update(
        n_elements=len(elements),
        working_ion=working_ion,
        crystal_system=crystal_system or "Unknown",
        space_group_number=space_group_number
        if space_group_number is not None
        else np.nan,
        frac_discharge=frac_discharge
        if frac_discharge is not None
        else float(c.get_atomic_fraction(working_ion)),
    )
    return features


def build_frame(df):
    return pd.DataFrame(
        [
            build_one(
                r.formula_discharge,
                r.working_ion,
                r.crystal_system,
                r.space_group_number,
                r.frac_discharge,
            )
            for r in df.itertuples()
        ]
    )
