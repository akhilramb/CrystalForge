import math
import pandas as pd
from ml.feature_builder import composition
from pymatgen.core import Element
from backend.config import ROOT

REFERENCE = (
    pd.read_csv(ROOT / "data/crystalforge_element_reference.csv")
    .set_index("element_symbol")
    .to_dict("index")
)


def economics(formula):
    c = composition(formula)
    parts = []
    missing_price = []
    missing_abundance = []
    score = 0
    critical = []
    for el, amount in c.get_el_amt_dict().items():
        r = REFERENCE.get(el, {})
        mass = float(amount) * float(Element(el).atomic_mass) / float(c.weight)
        atomic = float(c.get_atomic_fraction(el))
        price = r.get("indicative_price_usd_per_kg")
        abundance = r.get("crust_abundance_mg_per_kg")
        has_price = price is not None and math.isfinite(price)
        has_ab = abundance is not None and math.isfinite(abundance) and abundance > 0
        is_critical = str(r.get("criticality_status_2025", "")).startswith("USGS_2025")
        if is_critical:
            critical.append(el)
        if not has_price:
            missing_price.append(el)
        if not has_ab:
            missing_abundance.append(el)
        if has_ab:
            score += atomic * (
                max(0, min(100, (math.log10(abundance) + 6) / 12 * 100))
                * (0.75 if is_critical else 1)
            )
        parts.append(
            {
                "element": el,
                "mass_fraction": mass,
                "atomic_fraction": atomic,
                "price": price if has_price else None,
                "contribution": mass * price if has_price else None,
                "price_status": r.get("price_status", "Unavailable"),
                "source": r.get("price_abundance_source"),
                "abundance": abundance if has_ab else None,
                "criticality": r.get("criticality_status_2025", "Unknown"),
                "criticality_source": r.get("criticality_source"),
            }
        )
    total = None if missing_price else sum(p["contribution"] for p in parts)
    sustainability = None if missing_abundance else round(score, 1)
    return {
        "cost": round(total, 3) if total is not None else None,
        "sustainability": sustainability,
        "critical_elements": critical,
        "scarcity_risk": None
        if sustainability is None
        else "Low"
        if sustainability >= 65
        else "Medium"
        if sustainability >= 40
        else "High",
        "breakdown": parts,
        "missing_prices": missing_price,
        "missing_abundance": missing_abundance,
        "cost_method": "Sum of elemental mass fraction × supplied historical indicative price (USD/kg). Not manufacturing cost or current market pricing.",
        "sustainability_method": "Atomic-fraction weighted score: clip((log10(abundance in mg/kg)+6)/12 × 100, 0, 100); multiply critical-element contributions by 0.75. CrystalForge screening indicator, not environmental certification.",
    }
