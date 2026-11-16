import os
from pathlib import Path
from tempfile import TemporaryDirectory

database_directory = TemporaryDirectory(prefix="crystalforge-tests-")
os.environ["CRYSTALFORGE_DB"] = str(Path(database_directory.name) / "test.db")
