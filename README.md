# CrystalForge

A full-stack battery-material screening application built with React, TypeScript, Vite and FastAPI. It includes a trained voltage model, the supplied 6,185-record dataset, reference-based elemental economics, discovery ranking, comparison, a Materials Project crystal workspace, an optional catalog-grounded research assistant, and Supabase accounts for private research history and saved materials.

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
- **History:** account-owned prediction and discovery runs, open, rerun, compare catalog predictions and delete (requires sign in).
- **Saved materials:** account-owned bookmarks and research notes (requires sign in).
- **Reports:** PDF and CSV downloads for catalog profiles and saved predictions (requires sign in; downloaded reports are not stored as files on the server).
- **Research Assistant:** optional floating chat panel for product and scientific workflow questions. On material and structure pages it receives the selected catalog record from the backend; it does not invent missing properties or replace DFT/experimental validation. Messages are sent to Gemini for a reply and are not stored in CrystalForge history. Google API quota and any billing depend on the Google project attached to the key.
- **Accounts:** email/password signup and sign-in, email verification, password reset, Google/GitHub OAuth, profile, preferences, login history and account deletion.

## Scientific interpretation

Only **electrode voltage** is model-predicted. Capacity, band gap, formation energy, energy above hull and source structure metadata are dataset values. Cost, sustainability and ranking are calculated. CIF coordinates must come from actual supplied structures.

The dataset describes charged and discharged states. The model uses the **discharged formula**, working ion, discharge fraction and available crystal metadata. It predicts the supplied target voltage and does not resolve a full voltage profile or all possible intercalation steps from a formula alone. Use catalog mode to identify a specific record. Distinct records can share formulas and battery IDs; stable `cf-00001` style row IDs distinguish them.

For novel formula inputs, dataset-only properties are unavailable rather than borrowed from unrelated compounds. The formula, working ion and space group are checked, but these checks do not prove synthesizability or stability. What-if results are hypothetical research screening only. Structure space group consistency is checked against crystal system ranges.

### Model training

```powershell
python -m ml.train
python -m pytest tests -q
```

Training recomputes consistent elemental composition descriptors; it does **not** ingest historical prediction columns, target-derived labels, split labels, cost or sustainability as input features. The supplied Magpie features are not mixed with a different live featurizer. The exact feature names are recorded in model metadata. Run `python -m ml.evaluate_framework_disjoint` to regenerate the separate grouped benchmark. This evaluates all supplied rows using one deterministic 80/20 framework-group split and does not change the deployed model.

The supplied battery-group split and fold IDs are used and checked for group crossing. Training folds 1–3 fit five candidates; fold 0 selects by validation MAE. Each model is refit on folds 0–3 for final evaluation. Fold 4 calibrates split-conformal absolute residual intervals; test data is not used in training, selection or calibration. No claim of hyperparameter-optimal models is made.

**Selected:** Gradient Boosting. **Test MAE:** 0.530 V. **RMSE:** 0.897 V. **R²:** 0.664. **90% marginal interval radius:** approximately 0.993 V. Bundled metrics: `models/model_metadata.json`.

**Important limitation:** 433 framework formulas appear across the supplied train/test partitions. Those scores describe the supplied battery-group holdout, not performance on new chemical families. A separate, single-seed grouped framework benchmark is reported on the Model Information page and in `reports/framework_disjoint_evaluation.json`. It is exploratory, remains sensitive to its split seed, and does not establish generalization to all unseen chemistries. Intervals assume sufficiently exchangeable data and are not guarantees for individual compounds or underrepresented ions. The supplied source provenance has not been independently verified. Existing target values are not presented as experimentally verified measurements.

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
so legacy SQLite records and cached CIFs may be lost when the service restarts
or spins down. Supabase-backed user records are stored separately and persist
according to your Supabase project plan. Cached structures are snapshots.
Remove the relevant cached CIF to request a fresh copy.

## Project layout

```text
frontend/src/      React routes, components, API client, responsive styles
backend/           FastAPI routes, data validation and static build serving
backend/routes/    Catalog, assistant, account, prediction and insight APIs
backend/services/  Catalog, auth token verification, economics, discovery, exports
supabase/          Auth-owned tables, grants and Row Level Security migration
ml/                Shared feature builder and offline training/evaluation
models/            Trusted trained model, transformed catalog, metadata
reports/           Reproducible evaluation results
data/             Supplied CSVs; local SQLite database; optional CIFs
tests/             API workflows, scientific validation, economics and leakage checks
docs/              Supplied product specification
```

`data/application.db` is created on use and ignored by Git. Set `CRYSTALFORGE_DB` to use a separate database. Current signed-in history and saved materials are stored in Supabase Postgres. The previous SQLite anonymous-session records are not automatically assigned to a new account; there is no reliable way to prove which user owned an old browser-only session. Keep the default loopback host for local use.

Model artifacts are pickle-based trusted local assets: never replace them with untrusted downloaded joblib files. Use the pinned Python dependencies or retrain in your environment. Dataset changes require `python -m ml.train` to regenerate the model and catalog caches together. Dataset licensing and provenance follow the supplied source; no independent laboratory certification is implied.

## Browser verification

CI is configured to build the app and run Playwright desktop workflows and mobile overflow checks. To run locally after building:

```powershell
cd frontend
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Stop any existing server on port 8000 first. The browser-test runner starts its own backend. Browser tests start the built application and check prediction, discovery, comparison, login rendering, protected-route redirects, mobile layouts and structure workspace unavailable/retry states. Live Supabase sign-in and authenticated structure retrieval must be checked after configuring those external services.

## Deploy the full website on Render

The repository includes a Dockerfile and `render.yaml`. The existing Render
web service uses the Free instance type. In its dashboard, open **Settings**
and set the deploy branch to the Git branch containing these changes. In
**Environment**, set `MP_API_KEY` using a value from the Materials Project
dashboard. To enable the Research Assistant, add `GEMINI_API_KEY` from Google
AI Studio directly to Render's environment settings. The key stays on the
backend; never use a `VITE_` variable or commit it. `GEMINI_MODEL` is optional
and defaults to `gemini-3.8-flash`. Save the environment and let Render deploy.
Render also builds and deploys when you push a new commit to the configured
branch.

Free web services spin down after 15 minutes without incoming traffic and can
take about a minute to wake on the next request. The Free plan does not offer
always-on instances. Free service files are temporary, so legacy anonymous
records and downloaded CIF cache files may be lost after restart, spin-down or
redeploy. Supabase-backed user records persist in your Supabase project
independently of Render's temporary filesystem.

## Supabase account setup

1. Create or select a Supabase project. In **Project Settings → API**, copy the
   project URL and the **publishable** key. Never put a secret/service-role key
   in frontend code or a `VITE_` variable.
2. In the Supabase SQL Editor, run
   `supabase/migrations/202611160001_auth_and_user_data.sql`. It creates the
   profile, login-history, preference, saved-material, prediction-history and
   activity tables with Row Level Security policies tied to `auth.uid()`.
3. In **Authentication → URL Configuration**, set the site URL to
   `https://crystalforge.onrender.com` and add redirect URLs for
   `https://crystalforge.onrender.com/auth/callback`,
   `https://crystalforge.onrender.com/reset-password`,
   `https://crystalforge.onrender.com/verify-email`, plus equivalent local
   URLs at `http://localhost:8000` while developing.
4. In **Authentication → Providers**, enable email and configure Google and/or
   GitHub credentials. OAuth buttons call Supabase and remain disabled while
   Supabase is unconfigured.
5. In the Render `crystalforge` service **Environment** settings, add
   `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Account deletion additionally
   requires `SUPABASE_SERVICE_ROLE_KEY`, used only by the backend admin delete
   endpoint. Add secrets directly in Render; never commit or share them. Save
   and wait for the redeploy.

Locally, set the same variables in the terminal that starts FastAPI. In
PowerShell:

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "YOUR_PUBLISHABLE_KEY"
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Only set `SUPABASE_SERVICE_ROLE_KEY` locally if you need to test account
deletion. The backend verifies signed access tokens against Supabase JWKS for
asymmetric JWT projects and uses Supabase Auth's user endpoint for legacy
shared-secret JWTs. User-specific REST requests use the caller's token, so
Supabase RLS remains the authorization boundary. Public catalog and prediction
routes remain available without an account; anonymous predictions are not
saved. Private endpoints return HTTP 401 when signed out.

The account preferences page stores theme and crystal-length units. Login
history contains successful sign-ins and sign-outs only; failed password
attempts remain managed by Supabase Auth. Account deletion requires typing
`DELETE`; Auth deletion cascades to the profile and owned records. Reports are
downloaded to the user's device and only the report-creation activity record is
retained. Email delivery and OAuth availability depend on Supabase project and
provider settings. Configure SMTP for dependable production email delivery.

### Verify Supabase bookmark ownership

Use a separate Supabase test project with the migration applied and two
disposable signed-in users. Keep the following environment variables in your
local test shell: `CF_RLS_TEST_URL`, `CF_RLS_TEST_PUBLISHABLE_KEY`,
`CF_RLS_TEST_OWNER_TOKEN`, and `CF_RLS_TEST_OTHER_TOKEN`. Supply short-lived
user access tokens and keep them out of Git and shared logs.

Run `python -m pytest -q tests/test_supabase_rls_live.py`. The test saves a real
catalog material through FastAPI, verifies that the second user cannot read,
update, or delete the row through Supabase, verifies API isolation, and cleans
up the test bookmark. It skips when the test configuration is absent.
