from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get("CRYSTALFORGE_DB", str(ROOT / "data/application.db")))
