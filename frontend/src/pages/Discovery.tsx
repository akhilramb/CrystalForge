import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api, ions, systems } from "../services/api";
import { Heading, State, MaterialCard } from "../components/UI";
export default function Discovery() {
  const [form, setForm] = useState<any>({
    working_ion: "Li",
    voltage_min: 2.5,
    voltage_max: 4.5,
    cost_priority: 50,
    sustainability_priority: 50,
    performance_priority: 70,
  });
  const [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (k: string, v: any) => setForm({ ...form, [k]: v });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(await api("/discover", form));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container">
      <Heading eyebrow="DISCOVERY STUDIO" title="Find your next candidate.">
        Set your research priorities. Screen existing materials with an
        explainable ranking.
      </Heading>
      <div className="workspace-grid">
        <form className="panel input-panel" onSubmit={submit}>
          <h3>Define your search</h3>
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
          <fieldset>
            <legend>Target voltage range · V</legend>
            <div className="two-col">
              <label className="compact-label">
                Minimum
                <input
                  aria-label="Minimum voltage"
                  type="number"
                  step=".1"
                  min="-10"
                  max="15"
                  value={form.voltage_min}
                  onChange={(e) =>
                    change("voltage_min", Number(e.target.value))
                  }
                />
              </label>
              <label className="compact-label">
                Maximum
                <input
                  aria-label="Maximum voltage"
                  type="number"
                  step=".1"
                  min="-10"
                  max="15"
                  value={form.voltage_max}
                  onChange={(e) =>
                    change("voltage_max", Number(e.target.value))
                  }
                />
              </label>
            </div>
          </fieldset>
          <label>
            Crystal system
            <select
              onChange={(e) => change("crystal_system", e.target.value || null)}
            >
              <option value="">Any crystal system</option>
              {systems.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <details>
            <summary>Additional constraints</summary>
            <label>
              Space group
              <input
                type="number"
                min="1"
                max="230"
                onChange={(e) =>
                  change(
                    "space_group_number",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </label>
            <label>
              Maximum cost · USD/kg
              <input
                type="number"
                min="0"
                step=".1"
                placeholder="No limit"
                onChange={(e) =>
                  change(
                    "cost_max",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </label>
          </details>
          <div className="priority-heading">
            <h3>Your priorities</h3>
            <small>Low to high</small>
          </div>
          {["cost", "sustainability", "performance"].map((x) => (
            <label className="range-label" key={x}>
              <span>
                {x[0].toUpperCase() + x.slice(1)}
                <b>{form[x + "_priority"]}</b>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={form[x + "_priority"]}
                onChange={(e) =>
                  change(x + "_priority", Number(e.target.value))
                }
              />
            </label>
          ))}
          <button className="button full" disabled={busy}>
            <Sparkles size={17} />
            {busy ? "Ranking candidates…" : "Discover materials"}
          </button>
          <State error={error} />
        </form>
        <div>
          {busy ? (
            <State loading />
          ) : result ? (
            <>
              <div className="results-heading">
                <h2>Your candidate shortlist</h2>
                <span>
                  {result.total} matches · showing {result.items.length}
                </span>
              </div>
              {result.items.length === 0 ? (
                <div className="empty panel">
                  <h3>No candidates meet these constraints.</h3>
                  <p>
                    Widen the voltage range or relax the cost and structure
                    filters. No values have been fabricated to fill the results.
                  </p>
                </div>
              ) : (
                result.items.map((m: any, i: number) => (
                  <MaterialCard key={m.id} m={m} rank={i + 1} />
                ))
              )}
              <details className="panel">
                <summary>How the ranking works</summary>
                <p>{result.method}</p>
                <p>
                  Weights:{" "}
                  {Object.entries(result.weights)
                    .map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`)
                    .join(" · ")}
                </p>
              </details>
            </>
          ) : (
            <section className="prediction-empty">
              <span className="empty-symbol">
                <Sparkles size={44} strokeWidth={1} />
              </span>
              <span className="eyebrow">
                LESS SEARCHING. MORE UNDERSTANDING.
              </span>
              <h2>
                The right material
                <br />
                starts with your priorities.
              </h2>
              <p>
                Screen the existing catalog by voltage, cost,
                <br />
                sustainability, capacity and stability.
              </p>
              <p className="muted">
                This tool ranks known records.
                <br />
                It does not generate new compounds.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
