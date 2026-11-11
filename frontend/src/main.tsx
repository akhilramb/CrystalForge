import React, { useState, useRef, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import { Hexagon, Menu, X, Layers, ChevronDown } from "lucide-react";
import Home from "./pages/Home";
import Predict from "./pages/Predict";
import Discovery from "./pages/Discovery";
import Materials from "./pages/Materials";
import MaterialDetails from "./pages/MaterialDetails";
const Analytics = lazy(() => import("./pages/Analytics"));
const ModelInfo = lazy(() =>
  import("./pages/Analytics").then((m) => ({ default: m.ModelInfo })),
);
const Compare = lazy(() => import("./pages/Compare"));
import History, { Saved, Reports } from "./pages/History";
import { Context } from "./components/UI";
import "./styles/index.css";
function App() {
  const [menu, setMenu] = useState(false),
    [more, setMore] = useState(false),
    [toast, setToast] = useState(""),
    [compare, setCompare] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("cf-compare") || "[]").slice(
          0,
          4,
        );
      } catch {
        return [];
      }
    });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const location = useLocation();
  React.useEffect(() => {
    setMenu(false);
    setMore(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  function notify(s: string) {
    setToast(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  }
  function toggle(id: string) {
    if (!compare.includes(id) && compare.length === 4) {
      notify("Compare up to four materials. Remove one to add another.");
      return;
    }
    const c = compare.includes(id)
      ? compare.filter((x) => x !== id)
      : [...compare, id];
    setCompare(c);
    localStorage.setItem("cf-compare", JSON.stringify(c));
    notify(c.includes(id) ? "Added to comparison" : "Removed from comparison");
  }
  return (
    <Context.Provider value={{ compare, toggle, notify }}>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="navbar">
        <Link className="brand" to="/">
          <Hexagon size={27} strokeWidth={2.3} />
          <span>
            Crystal<span className="brand-light">Forge</span>
          </span>
        </Link>
        <button
          className="mobile-menu ghost"
          aria-label="Toggle navigation"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav
          aria-label="Primary navigation"
          className={menu ? "nav-links open" : "nav-links"}
        >
          {[
            ["/", "Home"],
            ["/predict", "Predict Material"],
            ["/discover", "Discovery Studio"],
            ["/materials", "Materials"],
            ["/analytics", "Analytics"],
            ["/history", "History"],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-tools">
          <Link
            to="/compare"
            className="compare-button"
            aria-label={"Compare " + compare.length + " materials"}
          >
            <Layers size={18} />
            <span>{compare.length}</span>
          </Link>
          <div className="more-menu">
            <button
              className="ghost"
              aria-expanded={more}
              onClick={() => setMore(!more)}
            >
              Workspace
              <ChevronDown size={14} />
            </button>
            {more && (
              <div className="dropdown">
                {[
                  ["/saved", "Saved materials"],
                  ["/compare", "Comparison lab"],
                  ["/reports", "Reports"],
                  ["/model", "Model information"],
                ].map(([to, t]) => (
                  <Link to={to} key={to}>
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <main id="content">
        <Suspense fallback={<div className="loading">Loading workspace…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/predict" element={<Predict />} />
            <Route path="/discover" element={<Discovery />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/materials/:id" element={<MaterialDetails />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/model" element={<ModelInfo />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/history" element={<History />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/reports" element={<Reports />} />
            <Route
              path="*"
              element={
                <div className="container empty">
                  <h1>Page not found</h1>
                  <Link to="/">Return home</Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer>
        <Link className="brand" to="/">
          <Hexagon size={20} />
          CrystalForge
        </Link>
        <span>Material intelligence. Grounded in evidence.</span>
        <Link to="/model">Model & methodology</Link>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {compare.length > 0 && location.pathname != "/compare" && (
        <Link className="compare-tray" to="/compare">
          <Layers size={18} />
          Compare shortlist <span>{compare.length}/4</span>
        </Link>
      )}
    </Context.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
