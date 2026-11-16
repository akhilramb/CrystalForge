"""Resolve catalog-linked structures and preserve source provenance."""
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from threading import Lock

import numpy as np
from pymatgen.core import Composition, Structure
from pymatgen.io.cif import CifWriter
from pymatgen.symmetry.analyzer import SpacegroupAnalyzer

from backend.config import ROOT

MAX_CIF_BYTES = 2_000_000
MAX_SITES = 1000
LOCKS = tuple(Lock() for _ in range(32))
LOGGER = logging.getLogger(__name__)
STAMP = "# CrystalForge Materials Project retrieval: "


def validate(structure, formula):
    expected = Composition(formula).fractional_composition
    actual = structure.composition.element_composition.fractional_composition
    if (
        not 0 < len(structure) <= MAX_SITES
        or not np.isfinite(structure.cart_coords).all()
        or not np.isfinite(structure.lattice.matrix).all()
        or not np.isfinite(structure.volume)
        or structure.volume <= 0
        or not actual.almost_equals(expected, rtol=1e-3, atol=1e-5)
    ):
        raise ValueError("Structure failed catalog validation")
    return structure


def read_cif(path, formula):
    with path.open("rb") as handle:
        content = handle.read(MAX_CIF_BYTES + 1)
    if len(content) > MAX_CIF_BYTES:
        raise ValueError("CIF exceeds size limit")
    text = content.decode("utf-8")
    return validate(Structure.from_str(text, fmt="cif"), formula), text


def fetch_structure(mp_id, api_key):
    from mp_api.client import MPRester

    with MPRester(api_key, timeout=10, notify_db_version=False) as client:
        return client.get_structure_by_material_id(mp_id)


def write_cif(path, structure, formula, timestamp):
    temporary = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, delete=False
        ) as handle:
            temporary = Path(handle.name)
            handle.write(STAMP + timestamp + "\n" + str(CifWriter(structure)))
        read_cif(temporary, formula)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def serialize(structure, mp_id, source_url, method, timestamp):
    symmetry = None
    try:
        analyzer = SpacegroupAnalyzer(structure, symprec=0.01)
        symmetry = {
            "crystal_system": analyzer.get_crystal_system(),
            "space_group": analyzer.get_space_group_symbol(),
            "space_group_number": analyzer.get_space_group_number(),
            "symprec_angstrom": 0.01,
        }
    except (ValueError, RuntimeError):
        pass
    return {
        "available": True,
        "material_id": mp_id,
        "formula": structure.composition.reduced_formula,
        "source_url": source_url,
        "lattice": structure.lattice.matrix.tolist(),
        "lengths": structure.lattice.abc,
        "angles": structure.lattice.angles,
        "volume": structure.volume,
        "symmetry": symmetry,
        "sites": [
            {"element": site.species_string, "position": site.coords.tolist()}
            for site in structure
        ],
        "provenance": {
            "source": "Local supplied CIF" if method == "local_cif" else "Materials Project",
            "method": method,
            "retrieved_at": timestamp,
        },
    }


def resolve_structure(record):
    mp_id = record.get("preferred_structure_mp_id")
    if not isinstance(mp_id, str) or not re.fullmatch(r"mp-[0-9]{1,16}", mp_id):
        return {"available": False, "reason": "invalid_mapping",
                "message": "This record has no valid Materials Project mapping."}
    source_url = f"https://materialsproject.org/materials/{mp_id}"
    formula = record["formula_discharge"]
    local = ROOT / "data/structures" / f"{mp_id}.cif"
    cache_dir = Path(os.getenv("CRYSTALFORGE_STRUCTURE_CACHE", str(ROOT / "data/structure-cache")))
    cached = cache_dir / f"{mp_id}.cif"
    invalid = False
    with LOCKS[hash(mp_id) % len(LOCKS)]:
        for path, method in ((local, "local_cif"), (cached, "cache")):
            try:
                structure, text = read_cif(path, formula)
                timestamp = None
                if method == "cache":
                    first_line = text.splitlines()[0]
                    if not first_line.startswith(STAMP):
                        raise ValueError("Cache provenance missing")
                    timestamp = first_line.removeprefix(STAMP)
                    if datetime.fromisoformat(timestamp).utcoffset() is None:
                        raise ValueError("Cache timestamp lacks timezone")
                return serialize(structure, mp_id, source_url, method, timestamp)
            except FileNotFoundError:
                continue
            except Exception:
                invalid = True
                LOGGER.warning("Rejected %s CIF for %s", method, mp_id)

        api_key = os.getenv("MP_API_KEY", "").strip()
        if not api_key:
            return {"available": False, "reason": "invalid_cif" if invalid else "missing_api_key",
                    "source_url": source_url,
                    "message": ("The stored CIF failed validation. Configure MP_API_KEY to retrieve it again."
                                if invalid else "The server needs MP_API_KEY to retrieve this structure.")}
        try:
            structure = validate(fetch_structure(mp_id, api_key), formula)
        except Exception as error:
            LOGGER.warning("Materials Project retrieval failed for %s (%s)", mp_id, type(error).__name__)
            return {"available": False, "reason": "retrieval_failed", "source_url": source_url,
                    "message": "Materials Project did not return a usable structure. Please try again."}
        timestamp = datetime.now(timezone.utc).isoformat()
        try:
            write_cif(cached, structure, formula, timestamp)
        except Exception:
            LOGGER.warning("Could not cache CIF for %s", mp_id)
        return serialize(structure, mp_id, source_url, "api", timestamp)
