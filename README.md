# CrystalForge

A local, full-stack battery-material screening application built with React, TypeScript, Vite and FastAPI. It includes a trained voltage model, the supplied 6,185-record dataset, reference-based elemental economics, discovery ranking, comparison, SQLite history and bookmarks, and PDF/CSV reports.

## Run on Windows (PowerShell)

Install **Python 3.11 or 3.12**, **Node.js 22 LTS or newer**, and Git. Python 3.14 is not the tested environment.

```powershell
git clone https://github.com/akhilramb/CrystalForge.git
cd CrystalForge
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cd frontend
npm.cmd ci
npm.cmd run build
cd ..
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

If using Python 3.11, substitute `py -3.11` in the venv command. If PowerShell blocks activation, run `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` and use that same Python executable for Uvicorn instead of activation. Use the repository root for all Python commands.

Open **http://127.0.0.1:8000**. API documentation: **http://127.0.0.1:8000/docs**.

The trained model is included; training is not needed for the first run. Prediction and catalog browsing require no external API key. Live crystal retrieval requires the backend Materials Project key described below. These instructions run the application locally.

## Development

Run FastAPI as above. In a second terminal:

```powershell
cd CrystalForge\frontend
npm.cmd run dev
```

Open the Vite URL printed in the terminal. Vite proxies `/api` to port 8000. To refresh the single-server version, run `npm.cmd run build` again.

## Included workflows

- **Home:** spacious light/olive scientific landing page.
- **Predict Material:** formula inputs or exact catalog record; real model inference; 90% marginal calibrated interval; analogous materials; elemental economics. Run again to see a what-if comparison.
- **Discovery Studio:** ion, voltage window, optional structure/cost constraints, adjustable cost/sustainability/performance priorities. Ranks existing records, with numeric score contributions.
- **Materials:** server-side search, filters, sorting, pagination, card/table views.
- **Material profile:** electrochemistry, source metadata, real-CIF viewer or honest unavailable state, economics, similar materials.
- **Comparison:** 2–4 catalog candidates; voltage chart, property table and criterion-specific highlights.
- **Analytics / Model Information:** dataset distributions, five evaluated regressors, test scatterplot, residual distribution, uncertainty and split disclosure.
- **History:** automatic persistence, open, rerun, compare catalog predictions and delete.
- **Saved materials:** persistent bookmarks and editable research notes.
- **Reports:** PDF and CSV downloads for catalog profiles and saved predictions.

## Scientific interpretation

Only **electrode voltage** is model-predicted. Capacity, band gap, formation energy, energy above hull and source structure metadata are dataset values. Cost, sustainability and ranking are calculated. CIF coordinates must come from actual supplied structures.

The dataset describes charged and discharged states. The model uses the **discharged formula**, working ion, discharge fraction and available crystal metadata. It predicts the supplied target voltage and does not resolve a full voltage profile or all possible intercalation steps from a formula alone. Use catalog mode to identify a specific record. Distinct records can share formulas and battery IDs; stable `cf-00001` style row IDs distinguish them.

For novel formula inputs, dataset-only properties are unavailable rather than borrowed from unrelated compounds. The formula, working ion and space group are checked, but these checks do not prove synthesizability or stability. What-if results are hypothetical research screening only. Structure space group consistency is checked against crystal system ranges.

### Model training

```powershell
python -m ml.train
python -m pytest tests -q
```

Training recomputes consistent elemental composition descriptors; it does **not** ingest historical prediction columns, target-derived labels, split labels, cost or sustainability as input features. The supplied Magpie features are not mixed with a different live featurizer. The exact feature names are recorded in model metadata.

The supplied battery-group split and fold IDs are used and checked for group crossing. Training folds 1–3 fit five candidates; fold 0 selects by validation MAE. Each model is refit on folds 0–3 for final evaluation. Fold 4 calibrates split-conformal absolute residual intervals; test data is not used in training, selection or calibration. No claim of hyperparameter-optimal models is made.

**Selected:** Gradient Boosting. **Test MAE:** 0.530 V. **RMSE:** 0.897 V. **R²:** 0.664. **90% marginal interval radius:** approximately 0.993 V. Bundled metrics: `models/model_metadata.json`.

**Important limitation:** 433 framework formulas appear across the supplied train/test partitions. These scores describe the supplied battery-group holdout, not a chemically disjoint benchmark or proven performance on new chemical families. Intervals assume sufficiently exchangeable data and are not guarantees for individual compounds or underrepresented ions. The supplied source provenance has not been independently verified. Existing target values are not presented as experimentally verified measurements.

### Cost and sustainability

Cost is `sum(element mass fraction × reference elemental USD/kg)`. Reference prices are **historical indicative values**, not live commodity quotes or manufacturing costs. Missing prices prevent a complete cost total. Per-element amounts, reference URLs and statuses are visible.

Sustainability is a transparent **heuristic screening indicator**, not a lifecycle assessment: compute `clip((log10(crust abundance in mg/kg) + 6) / 12 × 100, 0, 100)` per element, apply a 0.75 multiplier to reference-flagged critical elements, then take the composition's atomic-fraction-weighted mean. Missing abundance prevents a complete score. It does not measure emissions, toxicity, recyclability or ethical sourcing.

Ranking normalizes explicit criterion contributions and discloses its formula. Missing cost/sustainability excludes a candidate when that criterion has positive priority; missing capacity/stability contributes zero. The score is not a probability of success.

### Actual crystal structures

The catalog contains Materials Project IDs for the discharged state. Open a
material's **Structure** tab and select **Open Dedicated Structure Workspace**.
The workspace shows source, retrieval time when available, computed symmetry,
lattice parameters and Cartesian site coordinates in the Three.js viewer.

1. Obtain an API key from the [Materials Project dashboard](https://materialsproject.org/dashboard).
2. In Render, open the `crystalforge` service, select **Environment**, and add `MP_API_KEY` with the key as its value.
3. Save the change and wait for Render to redeploy. Keep the key in Render's environment settings and out of source code.

`GET /api/materials/{id}/structure` accepts a CrystalForge catalog ID. It checks
for a supplied CIF at `data/structures/<mp-id>.cif`, then a cached CIF, then
requests the catalog-linked structure through `mp-api`. Cached CIFs are
validated with Pymatgen and include the original retrieval timestamp. Supplied
CIFs have no inferred retrieval date. Match supplied files to the exact source
ID and discharged composition. The viewer draws distance contacts within the
displayed cell as a visual guide. Structure retrieval and symmetry calculation
do not establish experimental verification or electrode suitability.

Set `CRYSTALFORGE_STRUCTURE_CACHE` to a writable directory to override the
default `data/structure-cache`. On Render Free, the filesystem is temporary,
so SQLite records and cached CIFs may be lost when the service restarts or
spins down. Cached structures are snapshots. Remove the relevant cached CIF
to request a fresh copy.

## Project layout

```text
frontend/src/      React routes, components, API client, responsive styles
backend/           FastAPI routes, data validation and static build serving
backend/services/  Catalog, economics, discovery, SQLite persistence, exports
ml/                Shared feature builder and offline training/evaluation
models/            Trusted trained model, transformed catalog, metadata
reports/           Reproducible evaluation results
data/             Supplied CSVs; local SQLite database; optional CIFs
tests/             API workflows, scientific validation, economics and leakage checks
docs/              Supplied product specification
```

`data/application.db` is created on use and ignored by Git. Set `CRYSTALFORGE_DB` to use a separate database. History currently displays the latest 200 runs; older rows remain stored. Notes and history are isolated by an anonymous browser-session cookie. This is not an account login system; clearing cookies loses access to that session. Keep the default loopback host for local use. A public deployment needs an authentication and hosting configuration appropriate for its users.

Model artifacts are pickle-based trusted local assets: never replace them with untrusted downloaded joblib files. Use the pinned Python dependencies or retrain in your environment. Dataset changes require `python -m ml.train` to regenerate the model and catalog caches together. Dataset licensing and provenance follow the supplied source; no independent laboratory certification is implied.

## Browser verification

CI is configured to build the app and run Playwright desktop workflows and mobile overflow checks. To run locally after building:

```powershell
cd frontend
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Stop any existing server on port 8000 first. The browser-test runner starts its own backend. Browser tests start the built application and check prediction, discovery, comparison, reports, mobile layouts and the structure workspace’s unavailable and retry states. Live authenticated Materials Project retrieval must be checked with a configured server key.

## Deploy the full website on Render

The repository includes a Dockerfile and `render.yaml`. The existing Render
web service uses the Free instance type. In its dashboard, open **Settings**
and set the deploy branch to the Git branch containing these changes. In
**Environment**, set `MP_API_KEY` using a value from the Materials Project
dashboard. Render builds and deploys when you push a new commit to that branch.

Free web services spin down after 15 minutes without incoming traffic and can
take about a minute to wake on the next request. The Free plan does not offer
always-on instances. Free service files are temporary, so SQLite history,
saved notes and downloaded CIF cache files may be lost after restart, spin-down
or redeploy. The deployed code uses the existing anonymous browser-session
model; Render's hostname also starts a different browser session from any
earlier host.
