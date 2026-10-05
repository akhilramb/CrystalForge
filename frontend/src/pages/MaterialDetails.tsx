import { useState, lazy, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Heading,
  useData,
  State,
  Metric,
  Economics,
  Exports,
  Actions,
  MaterialCard,
} from "../components/UI";
const Viewer = lazy(() => import("../components/CrystalViewer"));
function StructurePanel({ id, m }: { id: string; m: any }) {
  const { data, error, loading } = useData("/materials/" + id + "/structure");
  return (
    <section className="panel">
      <h2>Crystal structure</h2>
      <State loading={loading} error={error} />
      {data?.available ? (
        <Suspense fallback={<State loading />}>
          <Viewer structure={data} />
        </Suspense>
      ) : (
        data && (
          <div className="structure-empty">
            <span className="eyebrow">STRUCTURE UNAVAILABLE</span>
            <h3>Atomic coordinates are not included.</h3>
            <p>{data.message}</p>
            <p>
              {m.crystal_system} · Space group {m.space_group_number} · Bravais
              lattice {m.bravais_lattice}
            </p>
            {data.source_url && (
              <a
                className="button outline"
                href={data.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Open Materials Project
              </a>
            )}
            <p className="muted">
              A material ID is a source link, not a substitute for a verified
              CIF.
            </p>
          </div>
        )
      )}
    </section>
  );
}
function Similar({ id }: { id: string }) {
  const { data, error, loading } = useData("/materials/" + id + "/similar");
  return (
    <section>
      <h2>Similar materials</h2>
      <State loading={loading} error={error} />
      {data?.map((m: any) => (
        <MaterialCard key={m.id} m={m} />
      ))}
    </section>
  );
}
export default function MaterialDetails() {
  const { id } = useParams();
  const { data: m, error, loading } = useData("/materials/" + id);
  const [tab, setTab] = useState("Overview");
  if (!m)
    return (
      <div className="container">
        <State loading={loading} error={error} />
      </div>
    );
  return (
    <div className="container">
      <Link className="breadcrumb" to="/materials">
        Materials / {m.id}
      </Link>
      <Heading
        eyebrow={`${m.working_ion}-ION · ${m.crystal_system}`}
        title={m.formula}
        action={
          <Link className="button" to={"/predict?id=" + id}>
            Run prediction
          </Link>
        }
      >
        {m.preferred_structure_mp_id} · Space group {m.space_group_number} ·{" "}
        {m.bravais_lattice} lattice
      </Heading>
      <div className="detail-toolbar">
        <Actions m={m} />
        <Exports id={id} />
      </div>
      <div className="tabs" role="tablist">
        {[
          "Overview",
          "Electrochemistry",
          "Structure",
          "Economics",
          "Provenance",
          "Similar",
        ].map((x) => (
          <button
            role="tab"
            aria-selected={tab === x}
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <>
          <section className="voltage-result">
            <div>
              <span className="eyebrow">PREDICTED ELECTRODE VOLTAGE</span>
              <h2>
                {m.predicted_voltage?.toFixed(2)} <small>V</small>
              </h2>
              <p>
                90% marginal prediction interval:{" "}
                {m.interval?.map((x: number) => x.toFixed(2)).join(" – ")} V
              </p>
            </div>
            <div className="result-identity">
              <span className="pill">{m.data_split} record</span>
              <h3>Evidence at a glance.</h3>
              <p>
                Predictions and source properties,
                <br />
                clearly distinguished.
              </p>
              <small>{m.model_version}</small>
            </div>
          </section>
          <div className="metric-grid">
            <Metric
              label="Gravimetric capacity"
              value={m.capacity_grav}
              unit="mAh/g"
              kind="Dataset-derived"
            />
            <Metric
              label="Volumetric capacity"
              value={m.capacity_vol}
              unit="mAh/cm³"
              kind="Dataset-derived"
            />
            <Metric
              label="Band gap"
              value={m.band_gap}
              unit="eV"
              kind="Dataset-derived"
            />
          </div>
          <section className="panel">
            <h3>Interpret this result</h3>
            <p>
              This is a screening prediction, not an experimentally validated
              electrode recommendation.{" "}
              {m.data_split === "train"
                ? "This record belongs to the training partition. Its prediction is not an independent test result."
                : "This record belongs to the held-out test partition."}
            </p>
            <Link className="text-link" to="/model">
              Model performance and limitations
            </Link>
          </section>
        </>
      )}
      {tab === "Electrochemistry" && (
        <>
          <div className="metric-grid">
            <Metric
              label="Dataset voltage"
              value={m.target_voltage}
              unit="V"
              kind="Dataset-derived target"
            />
            <Metric
              label="Gravimetric capacity"
              value={m.capacity_grav}
              unit="mAh/g"
              kind="Dataset-derived"
            />
            <Metric
              label="Volumetric capacity"
              value={m.capacity_vol}
              unit="mAh/cm³"
              kind="Dataset-derived"
            />
            <Metric
              label="Formation energy"
              value={m.formation_energy_per_atom}
              unit="eV/atom"
              kind="Dataset-derived"
            />
            <Metric
              label="Energy above hull"
              value={m.e_above_hull}
              unit="eV/atom"
              kind="Dataset-derived"
            />
            <Metric
              label="Maximum volume change"
              value={m.max_delta_volume}
              kind="Dataset value · source unit not verified"
            />
          </div>
          <p className="notice">
            Energy above hull is a thermodynamic screening indicator. Low values
            alone do not establish practical battery performance.
          </p>
        </>
      )}
      {tab === "Structure" && <StructurePanel id={id!} m={m} />}
      {tab === "Economics" && (
        <section className="panel">
          <Economics e={m.economics} />
        </section>
      )}
      {tab === "Provenance" && (
        <section className="panel">
          <h2>Source & provenance</h2>
          <p>{m.source_provenance}</p>
          <dl>
            <dt>Battery record</dt>
            <dd>{m.battery_id}</dd>
            <dt>Charged composition</dt>
            <dd>{m.formula_charge}</dd>
            <dt>Discharged composition</dt>
            <dd>{m.formula_discharge}</dd>
            <dt>Dataset partition</dt>
            <dd>{m.data_split}</dd>
          </dl>
          {m.materials_project_structure_url && (
            <a
              className="text-link"
              href={m.materials_project_structure_url}
              target="_blank"
              rel="noreferrer"
            >
              Materials Project source link
            </a>
          )}
          <p className="notice">
            This provenance text is supplied with the dataset. Its laboratory
            origin and target measurements have not been independently verified.
          </p>
        </section>
      )}
      {tab === "Similar" && <Similar id={id!} />}
    </div>
  );
}
