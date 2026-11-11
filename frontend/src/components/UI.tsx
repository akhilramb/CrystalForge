import { useEffect, useState, createContext, useContext } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Layers, Download, LoaderCircle } from "lucide-react";
import { api, fmt, downloadReport } from "../services/api";
export const Context = createContext<{
  compare: string[];
  toggle: (id: string) => void;
  notify: (s: string) => void;
}>({ compare: [], toggle: () => {}, notify: () => {} });
export function useData(path: string) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api(path)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path]);
  return { data, error, loading, setData };
}
export function State({
  loading,
  error,
}: {
  loading?: boolean;
  error?: string;
}) {
  return error ? (
    <div role="alert" className="error">
      {error}
    </div>
  ) : loading ? (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading material intelligence…
    </div>
  ) : null;
}
export function Heading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">{eyebrow || "CRYSTALFORGE / WORKSPACE"}</span>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </header>
  );
}
export function Metric({
  label,
  value,
  unit,
  kind,
}: {
  label: string;
  value: any;
  unit?: string;
  kind?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {fmt(value)} <small>{value != null ? unit : ""}</small>
      </strong>
      {kind && <em>{kind}</em>}
    </div>
  );
}
export function Actions({ m }: { m: any }) {
  const { compare, toggle, notify } = useContext(Context);
  return (
    <div className="actions">
      <Link className="button small" to={"/materials/" + m.id}>
        View material
      </Link>
      <button
        className="ghost small"
        aria-pressed={compare.includes(m.id)}
        onClick={() => toggle(m.id)}
      >
        <Layers size={16} />
        {compare.includes(m.id) ? "Added" : "Compare"}
      </button>
      <button
        className="ghost small"
        onClick={() =>
          api("/saved", { material_id: m.id })
            .then(() => notify("Material saved"))
            .catch((e) => notify(e.message))
        }
      >
        <Bookmark size={16} />
        Save
      </button>
    </div>
  );
}
export function MaterialCard({ m, rank }: { m: any; rank?: number }) {
  return (
    <article className="material-card">
      {rank && <div className="rank">{String(rank).padStart(2, "0")}</div>}
      <div className="material-main">
        <div className="card-title">
          <div>
            <span className="eyebrow">
              {m.working_ion}-ION · {m.crystal_system || "Structure unknown"}
            </span>
            <h3>{m.formula}</h3>
            <small className="muted">
              {m.id} · {m.preferred_structure_mp_id}
            </small>
          </div>
          {m.score != null && (
            <span className="score">
              {m.score}
              <small>/100 match</small>
            </span>
          )}
        </div>
        <div className="card-metrics">
          <div>
            <small>Predicted voltage</small>
            <strong>
              {fmt(m.predicted_voltage)} <em>V</em>
            </strong>
          </div>
          <div>
            <small>Estimated cost</small>
            <strong>
              {m.cost == null ? "Unavailable" : "$" + fmt(m.cost)}
              <em>{m.cost != null ? "/kg" : ""}</em>
            </strong>
          </div>
          <div>
            <small>Sustainability</small>
            <strong>
              {fmt(m.sustainability, 0)}
              <em>{m.sustainability != null ? "/100" : ""}</em>
            </strong>
          </div>
          <div>
            <small>Above hull</small>
            <strong>
              {fmt(m.e_above_hull, 3)}
              <em>eV/atom</em>
            </strong>
          </div>
        </div>
        {m.contributions && (
          <details>
            <summary>Why ranked #{rank}?</summary>
            <p>Weighted contributions to this score:</p>
            <div className="contributions">
              {Object.entries(m.contributions).map(([k, v]) => (
                <span key={k}>
                  {k.replaceAll("_", " ")} <b>{String(v)}</b>
                </span>
              ))}
            </div>
          </details>
        )}
        <Actions m={m} />
      </div>
    </article>
  );
}
export function Exports({ id, history }: { id?: string; history?: number }) {
  const { notify } = useContext(Context);
  return (
    <div className="actions">
      {["pdf", "csv"].map((f) => (
        <button
          className="ghost small"
          key={f}
          onClick={() =>
            downloadReport(id, history, f).catch((e) => notify(e.message))
          }
        >
          <Download size={15} />
          {f.toUpperCase()} report
        </button>
      ))}
    </div>
  );
}
export function Economics({ e }: { e: any }) {
  return (
    <div className="economics">
      <div className="two-col">
        <Metric
          label="Estimated raw-material cost"
          value={e.cost}
          unit="USD/kg"
          kind="Calculated · historical indicative prices"
        />
        <Metric
          label="Sustainability screening score"
          value={e.sustainability}
          unit="/100"
          kind="Calculated · CrystalForge indicator"
        />
      </div>
      <p className="muted">{e.cost_method}</p>
      <details open>
        <summary>View cost methodology</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Element</th>
                <th>Mass fraction</th>
                <th>Price / kg</th>
                <th>Contribution</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {e.breakdown.map((r: any) => (
                <tr key={r.element}>
                  <td>{r.element}</td>
                  <td>{fmt(r.mass_fraction * 100)}%</td>
                  <td>
                    {r.price == null ? "Unavailable" : "$" + fmt(r.price)}
                  </td>
                  <td>
                    {r.contribution == null
                      ? "Unavailable"
                      : "$" + fmt(r.contribution)}
                  </td>
                  <td>
                    {r.source ? (
                      <a href={r.source} target="_blank" rel="noreferrer">
                        {r.price_status.replaceAll("_", " ")}
                      </a>
                    ) : (
                      "Unavailable"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {e.missing_prices.length > 0 && (
          <p className="notice">
            Missing prices: {e.missing_prices.join(", ")}. A complete total
            cannot be calculated.
          </p>
        )}
      </details>
      <h3>Elemental sustainability</h3>
      <p>
        Critical elements:{" "}
        <b>{e.critical_elements.join(", ") || "None flagged in reference"}</b> ·
        Scarcity risk: <b>{e.scarcity_risk || "Unavailable"}</b>
      </p>
      <p className="muted">{e.sustainability_method}</p>
      {e.missing_abundance.length > 0 && (
        <p className="notice">
          Missing abundance: {e.missing_abundance.join(", ")}
        </p>
      )}
    </div>
  );
}
