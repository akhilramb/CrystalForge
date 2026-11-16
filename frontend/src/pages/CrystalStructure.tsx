import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heading, State } from "../components/UI";
import { api, fmt } from "../services/api";
import "./crystal-lab.css";
import type { StructureResponse } from "../services/contracts";

const Viewer = lazy(() => import("../components/CrystalViewer"));

function Workspace({ id }: { id: string }) {
  const [data, setData] = useState<StructureResponse>();
  const [error, setError] = useState("");
  const [selectedSite, setSelectedSite] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<StructureResponse>("/materials/" + encodeURIComponent(id) + "/structure", undefined, "GET", controller.signal)
      .then(setData)
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [id, attempt]);

  function retry() {
    setData(undefined);
    setSelectedSite(null);
    setError("");
    setAttempt((value) => value + 1);
  }

  const site = data?.available && selectedSite !== null
    ? data.sites[selectedSite]
    : undefined;

  return (
    <div className="container crystal-lab">
      <Link className="breadcrumb" to={"/materials/" + encodeURIComponent(id)}>Material details / {id}</Link>
      <Heading eyebrow={id + " / CRYSTAL STRUCTURE WORKSPACE"} title="Crystal Lab">
        {data?.available ? data.formula + " · " + data.material_id : "Atomic coordinates for the catalog structure"}
      </Heading>
      <State loading={!data && !error} error={error} />
      {(error || data?.available === false) && (
        <section className="panel">
          <h2>Structure unavailable</h2>
          {data?.available === false && <p>{data.message}</p>}
          <button className="button outline" onClick={retry}>Retry</button>
        </section>
      )}
      {data?.available && (
        <div className="crystal-workspace">
          <section className="panel lab-stage" aria-label="Unit cell viewer">
            <Suspense fallback={<State loading />}>
              <Viewer structure={data} lab selectedSite={selectedSite} onSelectSite={setSelectedSite} />
            </Suspense>
          </section>
          <aside className="panel lab-inspector">
            <h2>Structure inspector</h2>
            <section>
              <h3>Atomic sites</h3>
              <label htmlFor="lab-site">Click an atom in the viewer or choose a site</label>
              <select id="lab-site" value={selectedSite ?? ""} onChange={(event) =>
                setSelectedSite(event.target.value === "" ? null : Number(event.target.value))
              }>
                <option value="">No site selected</option>
                {data.sites.map((atom, index) => (
                  <option key={index} value={index}>{index + 1} · {atom.element}</option>
                ))}
              </select>
              {site && <p role="status">
                {site.element} · Cartesian x / y / z (Å)<br />
                <strong>{site.position.map((coordinate) => fmt(coordinate, 3)).join(" / ")}</strong>
              </p>}
            </section>
            <h3>Lattice and symmetry</h3>
            <dl>
              <dt>Formula</dt><dd>{data.formula}</dd>
              <dt>Materials Project mapping</dt><dd>{data.material_id}</dd>
              <dt>Crystal system</dt><dd>{data.symmetry?.crystal_system ?? "Unavailable"}</dd>
              <dt>Computed space group</dt><dd>{data.symmetry ? data.symmetry.space_group + " (" + data.symmetry.space_group_number + ")" : "Unavailable"}</dd>
              <dt>a, b, c (Å)</dt><dd>{data.lengths.map((n) => fmt(n, 3)).join(" / ")}</dd>
              <dt>α, β, γ (°)</dt><dd>{data.angles.map((n) => fmt(n)).join(" / ")}</dd>
              <dt>Volume (Å³)</dt><dd>{fmt(data.volume)}</dd>
              <dt>Sites</dt><dd>{data.sites.length}</dd>
            </dl>
            <h3>Provenance</h3>
            <dl>
              <dt>Source</dt><dd>{data.provenance.source}</dd>
              <dt>Delivery</dt><dd>{{ local_cif: "Supplied CIF", cache: "Cached Materials Project CIF", api: "Materials Project API" }[data.provenance.method]}</dd>
              <dt>Retrieved at (UTC)</dt><dd><time dateTime={data.provenance.retrieved_at ?? undefined}>{data.provenance.retrieved_at ?? "Unavailable"}</time></dd>
            </dl>
            <p className="muted">The coordinates represent the catalog-linked structure. Experimental verification has not been established here.</p>
            <a href={data.source_url} target="_blank" rel="noreferrer">View Materials Project record</a>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function CrystalStructure() {
  const { id } = useParams();
  return id ? <Workspace key={id} id={id} /> : <State error="Material ID is required." />;
}
