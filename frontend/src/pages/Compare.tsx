import { useContext } from "react";
import { Link } from "react-router-dom";
import { Context, Heading, useData, State } from "../components/UI";
import { fmt } from "../services/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useEffect, useState } from "react";
import { api } from "../services/api";
export default function Compare() {
  const { compare, toggle } = useContext(Context);
  const [data, setData] = useState<any[]>([]),
    [error, setError] = useState("");
  const [target, setTarget] = useState(3.5);
  useEffect(() => {
    setError("");
    if (compare.length >= 2)
      api("/compare", { ids: compare })
        .then(setData)
        .catch((e) => setError(e.message));
    else setData([]);
  }, [compare]);
  const fields = [
    ["Predicted voltage (V)", "predicted_voltage"],
    ["Dataset voltage (V)", "target_voltage"],
    ["Capacity (mAh/g)", "capacity_grav"],
    ["Capacity (mAh/cm³)", "capacity_vol"],
    ["Band gap (eV)", "band_gap"],
    ["Formation energy (eV/atom)", "formation_energy_per_atom"],
    ["Energy above hull (eV/atom)", "e_above_hull"],
    ["Maximum volume change (source value)", "max_delta_volume"],
    ["Raw-material cost (USD/kg)", "cost"],
    ["Sustainability score /100", "sustainability"],
  ];
  const best = (k: string, dir: number) =>
    data.filter((m) => m[k] != null).sort((a, b) => dir * (a[k] - b[k]))[0];
  return (
    <div className="container">
      <Heading eyebrow="COMPARISON LAB" title="A decision in perspective.">
        Compare 2–4 candidates. Choose trade-offs that match your research.
      </Heading>
      <div className="actions">
        {compare.map((id) => (
          <button key={id} className="tag" onClick={() => toggle(id)}>
            {id} · Remove
          </button>
        ))}
        <Link className="button outline small" to="/materials">
          Add materials
        </Link>
      </div>
      <State error={error} />
      {compare.length < 2 ? (
        <div className="empty panel">
          <h2>Your comparison starts with two.</h2>
          <p>
            Select Compare on materials in the catalog or discovery results.
          </p>
        </div>
      ) : (
        data.length > 0 && (
          <>
            <section className="panel">
              <label className="inline-label">
                Target voltage for comparison
                <input
                  type="number"
                  step=".1"
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                />
              </label>
              <div className="three-col comparison-highlights">
                <div>
                  <span>Best voltage match</span>
                  <h3>
                    {
                      [...data].sort(
                        (a, b) =>
                          Math.abs(a.predicted_voltage - target) -
                          Math.abs(b.predicted_voltage - target),
                      )[0]?.formula
                    }
                  </h3>
                </div>
                <div>
                  <span>Lowest estimated cost</span>
                  <h3>{best("cost", 1)?.formula || "Unavailable"}</h3>
                </div>
                <div>
                  <span>Highest sustainability</span>
                  <h3>
                    {best("sustainability", -1)?.formula || "Unavailable"}
                  </h3>
                </div>
              </div>
            </section>
            <section className="panel chart">
              <h3>Predicted electrode voltage · V</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="formula" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="predicted_voltage"
                    name="Predicted voltage"
                    fill="#91a34c"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Property</th>
                    {data.map((m) => (
                      <th key={m.id}>
                        <Link to={"/materials/" + m.id}>{m.formula}</Link>
                        <small className="block">{m.id}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map(([label, key]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      {data.map((m) => (
                        <td key={m.id}>{fmt(m[key], 3)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              Highlights compare only this selection. No candidate is
              universally best. Missing values remain unavailable.
            </p>
          </>
        )
      )}
    </div>
  );
}
