import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heading, State } from "../components/UI";
import { api, fmt } from "../services/api";
import type { CrystalGeometry } from "../components/CrystalViewer";

const Viewer = lazy(() => import("../components/CrystalViewer"));

type StructureResponse =
  | { available: false; message: string; source_url?: string }
  | (CrystalGeometry & {
      available: true;
      material_id: string;
      formula: string;
      lengths: number[];
      angles: number[];
      volume: number;
      symmetry: {
        crystal_system: string;
        space_group: string;
        space_group_number: number;
      } | null;
      source_url: string;
      provenance: { source: string; method: "local_cif" | "cache" | "api"; retrieved_at: string | null };
    });

function Workspace({ id }: { id: string }) {
  const [data, setData] = useState<StructureResponse>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api("/materials/" + encodeURIComponent(id) + "/structure", undefined, "GET", controller.signal)
      .then(setData)
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [id, attempt]);

  function retry() {
    setData(undefined);
    setError("");
    setAttempt((value) => value + 1);
  }

  return (
    <div className="container">
      <Link className="breadcrumb" to={"/materials/" + encodeURIComponent(id)}>Material details / {id}</Link>
      <Heading eyebrow={id} title="Crystal structure workspace">
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
          <section className="panel">
            <h2>Unit cell</h2>
            <Suspense fallback={<State loading />}>
              <Viewer structure={data} />
            </Suspense>
          </section>
          <aside className="panel">
            <h2>Structure information</h2>
            <dl>
              <dt>Formula</dt><dd>{data.formula}</dd>
              <dt>Materials Project mapping</dt><dd>{data.material_id}</dd>
              <dt>Crystal system</dt><dd>{data.symmetry?.crystal_system ?? "Unavailable"}</dd>
              <dt>Computed space group</dt><dd>{data.symmetry ? data.symmetry.space_group + " (" + data.symmetry.space_group_number + ")" : "Unavailable"}</dd>
              <dt>a, b, c (Å)</dt><dd>{data.lengths.map((n) => fmt(n, 3)).join(" / ")}</dd>
              <dt>α, β, γ (°)</dt><dd>{data.angles.map((n) => fmt(n)).join(" / ")}</dd>
              <dt>Volume (Å³)</dt><dd>{fmt(data.volume)}</dd>
              <dt>Sites</dt><dd>{data.sites.length}</dd>
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
