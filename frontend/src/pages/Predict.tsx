import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, fmt, ions, systems } from "../services/api";
import {
  Heading,
  State,
  Metric,
  Economics,
  Exports,
  MaterialCard,
} from "../components/UI";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { useInView } from "../hooks/useInView";

import type { MaterialPage, MaterialSummary, PredictionInput, PredictionResponse } from "../services/contracts";

export function PredictionResult({ result: r }: { result: PredictionResponse }) {
  const entrance = useInView<HTMLElement>();
  return (
    <div className="result-content">
      <section className="voltage-result" ref={entrance.ref} data-reveal={entrance.visible}>
        <div>
          <span className="eyebrow">MODEL-PREDICTED ELECTRODE VOLTAGE</span>
          <h2>
            <AnimatedNumber value={r.predicted_voltage} /> <small>V</small>
          </h2>
          <p>
            90% marginal prediction interval
            <br />
            <b>
              {fmt(r.interval?.[0])} – {fmt(r.interval?.[1])} V
            </b>
          </p>
        </div>
        <div className="result-identity">
          <span className="pill">{r.working_ion}-ion</span>
          <h3>{r.formula}</h3>
          <p>
            {r.crystal_system || "Structure unspecified"}
            {r.space_group_number ? " · SG " + r.space_group_number : ""}
          </p>
          <small>{r.model_version}</small>
        </div>
      </section>
      <section className="panel" aria-label="Prediction evidence">
        <h3>Prediction evidence</h3>
        <p>
          Model version: {r.model_version ?? "Unavailable"}. The interval
          estimates coverage across comparable records. CrystalForge
          does not assign a reliability rating to an individual chemistry.
        </p>
        <Link className="text-link" to="/model#framework-benchmark">
          View the unseen-framework benchmark
        </Link>
      </section>
      {r.warnings?.map((w: string) => (
        <p key={w} className="notice">
          {w}
        </p>
      ))}
      <Exports id={r.id} history={r.history_id ?? undefined} />
      {r.id && (
        <Link className="text-link" to={"/materials/" + r.id}>
          Open complete material profile
        </Link>
      )}
      <section className="panel">
        <h3>Composition economics</h3>
        <Economics e={r.economics} />
      </section>
      {(r.similar?.length ?? 0) > 0 && (
        <section>
          <h2>Similar known materials</h2>
          <p className="muted">
            Similarity = 100 / (1 + Euclidean distance) in the standardized
            model feature space. It is not a probability.
          </p>
          {r.similar.map((m) => (
            <div key={m.id}>
              <span className="tag">{m.similarity}% feature similarity</span>
              <MaterialCard m={m} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
export default function Predict() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.has("id") ? "catalog" : "formula");
  const [id, setId] = useState(params.get("id") || "");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MaterialSummary[]>([]);
  const [form, setForm] = useState<PredictionInput>({
    formula: "LiFePO4",
    working_ion: "Li",
    crystal_system: "Orthorhombic",
    space_group_number: 62,
  });
  const [result, setResult] = useState<PredictionResponse | null>(null),
    [previous, setPrevious] = useState<PredictionResponse | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<PredictionResponse>(
        "/predict",
        mode === "catalog" ? { material_id: id } : form,
      );
      if (result) setPrevious(result);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  function change<K extends keyof PredictionInput>(key: K, value: PredictionInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  return (
    <div className="container">
      <Heading
        eyebrow="PREDICT / INVESTIGATE"
        title="Every material has potential."
      >
        Start with a composition. Explore its predicted electrode voltage.
      </Heading>
      <div className="workspace-grid">
        <form className="panel input-panel" onSubmit={submit}>
          <div className="segmented">
            <button
              type="button"
              className={mode === "formula" ? "active" : ""}
              onClick={() => setMode("formula")}
            >
              Enter formula
            </button>
            <button
              type="button"
              className={mode === "catalog" ? "active" : ""}
              onClick={() => setMode("catalog")}
            >
              From catalog
            </button>
          </div>
          {mode === "catalog" ? (
            <>
              <label>
                Find a material
                <input
                  placeholder="Formula or material ID"
                  value={query}
                  onChange={async (e) => {
                    setQuery(e.target.value);
                    try {
                      setMatches(
                        (
                          await api<MaterialPage>(
                            "/materials?q=" +
                              encodeURIComponent(e.target.value) +
                              "&page_size=8",
                          )
                        ).items,
                      );
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Request failed.");
                    }
                  }}
                />
              </label>
              <label>
                Catalog record
                <select
                  required
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                >
                  <option value="">Select a material</option>
                  {id && !matches.some((m) => m.id === id) && (
                    <option value={id}>{id}</option>
                  )}
                  {matches.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.formula} · {m.working_ion} · {m.id}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                Retrieves the record’s exact descriptors. Individual catalog
                predictions are not independent test results.
              </p>
            </>
          ) : (
            <>
              <label>
                Material formula
                <input
                  required
                  value={form.formula}
                  onChange={(e) => change("formula", e.target.value)}
                  placeholder="LiFePO4"
                />
              </label>
              <label>
                Working ion
                <select
                  value={form.working_ion}
                  onChange={(e) => change("working_ion", e.target.value)}
                >
                  {ions.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Crystal system
                <select
                  value={form.crystal_system || ""}
                  onChange={(e) =>
                    change("crystal_system", e.target.value || null)
                  }
                >
                  <option value="">Unknown</option>
                  {systems.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Space group number
                <input
                  type="number"
                  min="1"
                  max="230"
                  placeholder="1–230, optional"
                  value={form.space_group_number ?? ""}
                  onChange={(e) =>
                    change(
                      "space_group_number",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
              </label>
              <details>
                <summary>Advanced parameters</summary>
                <label>
                  Working-ion atomic fraction
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    max="0.9999"
                    placeholder="Calculated from formula"
                    value={form.frac_discharge ?? ""}
                    onChange={(e) =>
                      change(
                        "frac_discharge",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                </label>
                <p className="muted">
                  Only override for a supported concentration hypothesis.
                  Structural validity is not established by this prediction.
                </p>
              </details>
            </>
          )}
          <button className="button full" disabled={busy}>
            {busy
              ? "Running prediction…"
              : result
                ? "Run what-if prediction"
                : "Predict voltage"}
          </button>
          <State error={error} />
          <p className="form-foot">
            Formula-derived features. Evaluated regression.
            <br />
            No manually entered descriptors.
          </p>
        </form>
        <div>
          {busy ? (
            <State loading />
          ) : result ? (
            <>
              <PredictionResult result={result} />
              {previous && (
                <section className="panel">
                  <h3>What-if comparison</h3>
                  <div className="two-col">
                    <Metric
                      label={"Original · " + previous.formula}
                      value={previous.predicted_voltage}
                      unit="V"
                    />
                    <Metric
                      label={"Modified · " + result.formula}
                      value={result.predicted_voltage}
                      unit="V"
                    />
                  </div>
                  <p className="muted">
                    Hypothetical changes require independent validation of
                    chemical feasibility.
                  </p>
                </section>
              )}
            </>
          ) : (
            <section className="prediction-empty">
              <div className="empty-symbol">V</div>
              <span className="eyebrow">
                A NEW PERSPECTIVE ON YOUR MATERIAL
              </span>
              <h2>
                From composition
                <br />
                to a clearer direction.
              </h2>
              <p>
                Your voltage prediction, uncertainty interval,
                <br />
                and elemental economics will appear here.
              </p>
              <div className="mini-steps">
                <span>01 · Prepare features</span>
                <span>02 · Predict voltage</span>
                <span>03 · Assess uncertainty</span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
