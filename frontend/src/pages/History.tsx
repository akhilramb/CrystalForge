import { useState, useContext } from "react";
import { Link } from "react-router-dom";
import {
  Heading,
  useData,
  State,
  Context,
  MaterialCard,
  Exports,
} from "../components/UI";
import { api, fmt } from "../services/api";
import { PredictionResult } from "./Predict";
export default function History() {
  const { data, error, loading, setData } = useData("/history");
  const [open, setOpen] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const { notify, toggle } = useContext(Context);
  async function rerun(id: number) {
    setBusy(true);
    try {
      const result = await api("/history/" + id + "/rerun", {});
      const fresh = await api("/history");
      setData(fresh);
      setOpen(fresh.find((x: any) => x.id === result.history_id));
      notify("Run complete");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container">
      <Heading eyebrow="RESEARCH / HISTORY" title="Pick up where you left off.">
        Prediction and discovery runs, with their inputs and model versions
        preserved.
      </Heading>
      <State loading={loading} error={error} />
      {data?.length === 0 && (
        <div className="empty panel">
          <h3>No runs yet.</h3>
          <Link className="button" to="/predict">
            Make your first prediction
          </Link>
        </div>
      )}
      {data?.map((h: any) => (
        <article className="history-row panel" key={h.id}>
          <div>
            <span className="eyebrow">
              {h.kind} · {new Date(h.created).toLocaleString()}
            </span>
            <h3>
              {h.kind === "prediction"
                ? h.result.formula
                : h.inputs.working_ion + " candidate search"}
            </h3>
            <p>
              {h.kind === "prediction"
                ? fmt(h.result.predicted_voltage) +
                  " V · " +
                  h.result.model_version
                : h.result.total + " matching candidates"}
            </p>
          </div>
          <div className="actions">
            <button className="ghost small" onClick={() => setOpen(h)}>
              Open
            </button>
            <button
              className="ghost small"
              disabled={busy}
              onClick={() => rerun(h.id)}
            >
              Re-run
            </button>
            {h.result.id && (
              <button
                className="ghost small"
                onClick={() => toggle(h.result.id)}
              >
                Compare
              </button>
            )}
            <button
              className="ghost small danger"
              onClick={async () => {
                try {
                  await api("/history/" + h.id, undefined, "DELETE");
                  setData(data.filter((x: any) => x.id !== h.id));
                  if (open?.id === h.id) setOpen(null);
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
      {open && (
        <section className="history-open">
          <div className="results-heading">
            <h2>Run #{open.id}</h2>
            <button className="ghost" onClick={() => setOpen(null)}>
              Close result
            </button>
          </div>
          <details className="panel">
            <summary>Saved input parameters</summary>
            <pre>{JSON.stringify(open.inputs, null, 2)}</pre>
          </details>
          {open.kind === "prediction" ? (
            <PredictionResult
              result={{ ...open.result, history_id: open.id }}
            />
          ) : (
            open.result.items.map((m: any, i: number) => (
              <MaterialCard key={m.id} m={m} rank={i + 1} />
            ))
          )}
        </section>
      )}
    </div>
  );
}
export function Saved() {
  const { data, error, loading, setData } = useData("/saved");
  const { notify } = useContext(Context);
  return (
    <div className="container">
      <Heading
        eyebrow="YOUR SHORTLIST"
        title="Promising materials. Kept close."
      >
        Save research notes alongside your candidates.
      </Heading>
      <State loading={loading} error={error} />
      {data?.length === 0 && (
        <div className="empty panel">
          <h3>No saved materials.</h3>
          <Link to="/materials" className="button">
            Explore materials
          </Link>
        </div>
      )}
      {data?.map((s: any) => (
        <section key={s.material_id} className="saved-item">
          <MaterialCard m={s.material} />
          <form
            className="saved-note"
            onSubmit={async (e) => {
              e.preventDefault();
              const note = new FormData(e.currentTarget).get("note");
              try {
                await api("/saved", { material_id: s.material_id, note });
                notify("Note saved");
              } catch (e: any) {
                notify(e.message);
              }
            }}
          >
            <label>
              Research note
              <textarea
                name="note"
                maxLength={2000}
                defaultValue={s.note}
                placeholder="Why is this candidate interesting?"
              />
            </label>
            <div className="actions">
              <button className="ghost small">Save note</button>
              <button
                type="button"
                className="ghost small danger"
                onClick={async () => {
                  try {
                    await api("/saved/" + s.material_id, undefined, "DELETE");
                    setData(
                      data.filter((x: any) => x.material_id !== s.material_id),
                    );
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                Remove bookmark
              </button>
              <span className="muted">
                Saved {new Date(s.created).toLocaleDateString()}
              </span>
            </div>
          </form>
        </section>
      ))}
    </div>
  );
}
export function Reports() {
  const { data, error, loading } = useData("/history");
  return (
    <div className="container">
      <Heading
        eyebrow="EXPORT / REPORTS"
        title="Turn findings into something shareable."
      >
        Export predictions with uncertainty, properties, methodology and
        provenance.
      </Heading>
      <State loading={loading} error={error} />
      {data
        ?.filter((h: any) => h.kind === "prediction")
        .map((h: any) => (
          <article className="panel history-row" key={h.id}>
            <div>
              <span className="eyebrow">
                RUN #{h.id} · {new Date(h.created).toLocaleDateString()}
              </span>
              <h3>{h.result.formula}</h3>
              <p>
                {fmt(h.result.predicted_voltage)} V · {h.result.model_version}
              </p>
            </div>
            <Exports history={h.id} />
          </article>
        ))}
      {data && !data.some((h: any) => h.kind === "prediction") && (
        <div className="empty panel">
          <h3>Your reports begin with a prediction.</h3>
          <Link className="button" to="/predict">
            Predict a material
          </Link>
        </div>
      )}
    </div>
  );
}
