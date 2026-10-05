import { Link } from "react-router-dom";
import { Zap, Orbit, Leaf, Box } from "lucide-react";
import { useData } from "../components/UI";
export default function Home() {
  const { data } = useData("/analytics");
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <span className="pill">
            <span className="tiny-square" />
            AI-POWERED MATERIAL DISCOVERY
          </span>
          <h1>
            Discover better
            <br />
            battery materials.
            <br />
            <span>With intelligence.</span>
          </h1>
          <p>
            Predict electrode voltage, understand material properties,
            <br className="desktop" /> and find promising candidates for your
            next discovery.
          </p>
          <div className="actions center">
            <Link className="button" to="/discover">
              Start exploring
            </Link>
            <Link className="button outline" to="/materials">
              View materials
            </Link>
          </div>
          <div className="hero-foot">
            <span>COMPOSITION → PREDICTION → DISCOVERY</span>
            <span>Built for curious minds.</span>
          </div>
        </div>
      </section>
      <section className="home-section">
        <div className="section-head">
          <span className="eyebrow">FROM POSSIBILITIES TO EVIDENCE</span>
          <h2>
            A clearer view of
            <br />
            what comes next.
          </h2>
          <p>
            One workspace for the science, the economics,
            <br />
            and the decisions behind battery materials.
          </p>
        </div>
        <div className="feature-grid">
          {[
            [
              Zap,
              "01",
              "Voltage prediction",
              "Screen electrode candidates with an evaluated regression model and calibrated uncertainty.",
              "/predict",
            ],
            [
              Orbit,
              "02",
              "Material intelligence",
              "Explore electrochemical and structural properties with their original data provenance.",
              "/materials",
            ],
            [
              Leaf,
              "03",
              "Cost & sustainability",
              "Understand elemental cost contributions and composition-based scarcity indicators.",
              "/discover",
            ],
            [
              Box,
              "04",
              "Crystal structure",
              "Inspect actual atomic structures when a source CIF is available.",
              "/materials",
            ],
          ].map(([Icon, n, title, copy, to]: any) => (
            <Link to={to} className="feature" key={n}>
              <div className="feature-top">
                <Icon size={28} strokeWidth={1.4} />
                <span>{n}</span>
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="dark-band">
        <div>
          <span className="eyebrow">A DATASET. MANY POSSIBILITIES.</span>
          <h2>
            Explore the chemistry.
            <br />
            Keep the evidence.
          </h2>
          <p>
            Compare candidates, trace every estimate, and carry your findings
            into a research-ready report.
          </p>
          <Link className="button lime" to="/analytics">
            Explore the data
          </Link>
        </div>
        <div className="data-numbers">
          <div>
            <strong>{data ? data.total.toLocaleString() : "—"}</strong>
            <span>material records</span>
          </div>
          <div>
            <strong>06</strong>
            <span>working ions · Li / Mg / Ca / Zn / Y / Al</span>
          </div>
          <div className="ion-row">
            {["Li", "Mg", "Ca", "Zn", "Y", "Al"].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </section>
      <section className="home-section end-note">
        <span className="eyebrow">SCIENTIFIC CLARITY, BY DESIGN</span>
        <h2>
          Predicted. Retrieved. Calculated.
          <br />
          Always clearly distinguished.
        </h2>
        <Link className="button outline" to="/model">
          Read the model information
        </Link>
      </section>
    </>
  );
}
