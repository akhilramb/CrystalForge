import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
import {
  Heading,
  useData,
  State,
  MaterialCard,
  Actions,
} from "../components/UI";
import { ions, systems, fmt } from "../services/api";
export default function Materials() {
  const [filter, setFilter] = useState<any>({
      q: "",
      ion: "",
      system: "",
      sort: "formula",
    }),
    [page, setPage] = useState(1),
    [view, setView] = useState("cards");
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ ...filter, page: String(page), page_size: "12" })
        .filter(([, v]) => v !== "")
        .map(([k, v]) => [k, String(v)]),
    ),
  );
  const { data, error, loading } = useData("/materials?" + params);
  const change = (k: string, v: any) => {
    setPage(1);
    setFilter({ ...filter, [k]: v });
  };
  return (
    <div className="container">
      <Heading eyebrow="THE MATERIAL CATALOG" title="A world of possibilities.">
        Browse materials, inspect the evidence, and build your shortlist.
      </Heading>
      <section className="filterbar panel">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search materials"
            placeholder="Search formula, material ID or working ion"
            value={filter.q}
            onChange={(e) => change("q", e.target.value)}
          />
        </label>
        <select
          aria-label="Working ion"
          onChange={(e) => change("ion", e.target.value)}
        >
          <option value="">All working ions</option>
          {ions.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Crystal system"
          onChange={(e) => change("system", e.target.value)}
        >
          <option value="">All crystal systems</option>
          {systems.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Sort materials"
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="formula">Sort by formula</option>
          <option value="voltage">Voltage: low to high</option>
          <option value="cost">Cost: low to high</option>
          <option value="sustainability">Sustainability: high to low</option>
        </select>
        <details className="more-filters">
          <summary>More filters</summary>
          <div className="filter-details">
            <label>
              Min voltage
              <input
                type="number"
                step=".1"
                onChange={(e) => change("voltage_min", e.target.value)}
              />
            </label>
            <label>
              Max voltage
              <input
                type="number"
                step=".1"
                onChange={(e) => change("voltage_max", e.target.value)}
              />
            </label>
            <label>
              Max cost / kg
              <input
                type="number"
                min="0"
                onChange={(e) => change("cost_max", e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                onChange={(e) =>
                  change("stable", e.target.checked ? "true" : "false")
                }
              />
              Above hull ≤ 0.05 eV/atom
            </label>
          </div>
        </details>
      </section>
      <div className="results-heading">
        <p>{data?.total.toLocaleString() || 0} material records</p>
        <div className="segmented">
          <button
            className={view === "cards" ? "active" : ""}
            onClick={() => setView("cards")}
          >
            <LayoutGrid size={16} />
            Cards
          </button>
          <button
            className={view === "table" ? "active" : ""}
            onClick={() => setView("table")}
          >
            <List size={16} />
            Table
          </button>
        </div>
      </div>
      <State loading={loading} error={error} />
      {!loading &&
        data &&
        (view === "cards" ? (
          data.items.map((m: any) => <MaterialCard m={m} key={m.id} />)
        ) : (
          <div className="table-scroll panel">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Ion</th>
                  <th>Predicted V</th>
                  <th>Cost / kg</th>
                  <th>Sustainability</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m: any) => (
                  <tr key={m.id}>
                    <td>
                      <Link to={"/materials/" + m.id}>{m.formula}</Link>
                      <small className="block muted">{m.id}</small>
                    </td>
                    <td>{m.working_ion}</td>
                    <td>{fmt(m.predicted_voltage)}</td>
                    <td>
                      {m.cost == null ? "Unavailable" : "$" + fmt(m.cost)}
                    </td>
                    <td>{fmt(m.sustainability, 0)}</td>
                    <td>
                      <Actions m={m} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {!loading && data?.total === 0 && (
        <div className="empty panel">
          No materials found. Try a broader search.
        </div>
      )}
      <div className="pagination">
        <button
          className="ghost"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {Math.max(1, Math.ceil((data?.total || 0) / 12))}
        </span>
        <button
          className="ghost"
          disabled={page * 12 >= (data?.total || 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
