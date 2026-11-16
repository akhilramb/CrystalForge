# CrystalForge technical audit

Baseline: `66e55e7`. The public /reports URL returned HTTP 200 before changes. Source-level inventory follows.

| Area | Existing behavior | Gap |
| --- | --- | --- |
| Routing and deployment | Vite builds a React SPA served by FastAPI from a multi-stage Docker image. API uses the same origin. | The health endpoint returns HTTP 200 even when model loading fails. Render config uses temporary SQLite. |
| Catalog and details | CSV-backed filters, pagination, composition, electrochemistry, economics and provenance tabs. | IDs derive from CSV row order, so reordering would change the meaning of saved IDs. Preserve row order. |
| Crystal structures | 6,185 mapped rows. A local CIF reader and lazy Three.js preview exist. | No CIFs ship. No upstream retrieval, dedicated workspace, or retrieval provenance. The distance threshold can imply misleading bonds. |
| Prediction and discovery | Catalog and formula predictions, what-if comparison, ranked filtering, cost and sustainability heuristics. | Prediction covers voltage only. Novel formulas have no dataset-only properties. Discovery does not currently apply element inclusion/exclusion. |
| Comparison and analytics | Compare 2–4 catalog records; dataset histograms and model evaluation charts. | Audit property comparability and subgroup coverage before adding scientific claims. |
| History, saved and reports | Cookie-scoped SQLite history and bookmarks; PDF/CSV exports. Queries use bound SQL parameters. | Anonymous session ownership; storage is ephemeral on current Render configuration. Legacy migrations run at connection time. Reports do not export retrieved structure provenance. |
| Model | HistGradientBoosting selected by validation MAE against dummy, random forest, SVR and kernel ridge. Fold 4 calibrates intervals. | Battery groups are separated, but 433 framework formulas cross train/test. Add a framework-disjoint benchmark before making novel-chemistry claims. Dataset origin and measurement status need independent verification. |
| Security and testing | Same-origin API, resolved static paths, backend workflow tests and Playwright configuration. | Structure IDs need strict validation before file/API access. Public request limits, dependency advisories and migration concurrency require review. |

Keep the existing React/FastAPI application, model artifacts, API contracts, dataset order and anonymous session behavior. First implement and validate structure retrieval, cache and viewer. Then refine existing workflows, benchmark framework-disjoint ML performance, harden storage and API limits, expand test coverage, verify Render and update documentation. Preserve existing data during persistence changes.
