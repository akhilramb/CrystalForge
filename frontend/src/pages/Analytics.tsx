import { Heading, useData, State, Metric } from "../components/UI";
import { Distribution, Predictions } from "../components/Charts";
import { fmt } from "../services/api";
export function ModelInfo() {
  const { data: m, error, loading } = useData("/model/metrics");
  return (
    <div className="container">
      <Heading
        eyebrow="VALIDATION / TRANSPARENCY"
        title="Know the model behind the number."
      >
        Model selection, test performance, uncertainty, and the limits of this
        dataset.
      </Heading>
      <State loading={loading} error={error} />
      {m && (
        <>
          <section className="panel">
            <span className="eyebrow">SELECTED REGRESSOR</span>
            <h2>{m.selected_model}</h2>
            <p>{m.selection}</p>
            <p className="muted">
              {m.version} · scikit-learn {m.sklearn}
            </p>
          </section>
          <div className="metric-grid">
            {Object.entries(m.counts).map(([k, v]) => (
              <Metric
                key={k}
                label={k[0].toUpperCase() + k.slice(1) + " records"}
                value={v}
              />
            ))}
          </div>
          <section className="panel">
            <h3>Evaluated models</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Validation MAE (V)</th>
                    <th>Test MAE (V)</th>
                    <th>Test RMSE (V)</th>
                    <th>Test R²</th>
                  </tr>
                </thead>
                <tbody>
                  {m.models.map((r: any) => (
                    <tr
                      key={r.name}
                      className={
                        r.name === m.selected_model ? "selected-row" : ""
                      }
                    >
                      <td>
                        {r.name}
                        {r.name === m.selected_model ? " · Selected" : ""}
                      </td>
                      <td>{fmt(r.validation.mae, 3)}</td>
                      <td>{fmt(r.test.mae, 3)}</td>
                      <td>{fmt(r.test.rmse, 3)}</td>
                      <td>{fmt(r.test.r2, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <Predictions points={m.test_points} />
          <Distribution
            title="Held-out residual distribution (actual − predicted, V)"
            data={Array.from({ length: 16 }, (_, i) => {
              const low = -4 + i * 0.5;
              return {
                name: low.toFixed(1),
                value: m.test_points.filter(
                  (p: any) => p.residual >= low && p.residual < low + 0.5,
                ).length,
              };
            })}
          />
          <section className="panel">
            <h2>Uncertainty & split information</h2>
            <p>
              {m.interval.method}. Nominal coverage: 90%. Calibration radius: ±
              {fmt(m.interval.radius_volts)} V. Observed test coverage:{" "}
              {fmt(m.interval.test_coverage * 100, 1)}%.
            </p>
            <p>
              Training folds 1–3 fit candidate models; fold 0 selects the model.
              The selected model is refit on folds 0–3. Fold 4 calibrates the
              interval. The supplied test split is untouched until final
              evaluation.
            </p>
            <p className="muted">
              Split method: {m.split_method}. Related frameworks appearing
              across partitions: {m.framework_overlap_count}.
            </p>
            <h3>Limitations</h3>
            <ul>
              {m.limitations.map((x: string) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <details>
              <summary>Model feature list</summary>
              <p className="muted">{m.features.join(" · ")}</p>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
export default function Analytics() {
  const { data: d, error, loading } = useData("/analytics");
  return (
    <div className="container">
      <Heading eyebrow="DATASET / ANALYTICS" title="The bigger picture.">
        Explore the composition and coverage of the supplied material dataset.
      </Heading>
      <State loading={loading} error={error} />
      {d && (
        <>
          <div className="metric-grid">
            <Metric
              label="Material records"
              value={d.total}
              kind="Supplied dataset"
            />
            <Metric
              label="Complete cost estimates"
              value={d.cost_available}
              kind="Calculated from reference prices"
            />
            <Metric
              label="Sustainability coverage"
              value={d.sustainability_available}
              kind="Records with complete abundance values"
            />
          </div>
          <div className="two-col">
            <Distribution title="Working ion distribution" data={d.ions} />
            <Distribution
              title="Crystal system distribution"
              data={d.systems}
              color="#7395ac"
            />
          </div>
          <Distribution title="Dataset target voltage (V)" data={d.voltage} />
          <div className="two-col">
            <Distribution
              title="Gravimetric capacity (mAh/g)"
              data={d.capacity}
              color="#7395ac"
            />
            <Distribution
              title="Energy above hull (eV/atom)"
              data={d.stability}
            />
            <Distribution
              title="Estimated elemental cost (USD/kg)"
              data={d.cost}
            />
            <Distribution
              title="Sustainability screening score"
              data={d.sustainability}
              color="#7395ac"
            />
          </div>
          <p className="muted">
            Distributions exclude missing values. Cost references are historical
            and indicative; they are not current procurement quotes.
          </p>
        </>
      )}
    </div>
  );
}
