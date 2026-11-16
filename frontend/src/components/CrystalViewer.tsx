import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CrystalGeometry, Vector } from "../services/contracts";
const colors = [
  "#afc564",
  "#6a9cc7",
  "#d98778",
  "#dccb82",
  "#a3a1c2",
  "#5eab9a",
];

type ViewerProps = {
  structure: CrystalGeometry;
  lab?: boolean;
  selectedSite?: number | null;
  onSelectSite?: (index: number) => void;
};

export default function CrystalViewer({
  structure, lab = false, selectedSite = null, onSelectSite,
}: ViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const highlight = useRef<(index: number | null) => void>(() => {});
  const reset = useRef<() => void>(() => {});
  const [atoms, setAtoms] = useState(true),
    [bonds, setBonds] = useState(false),
    [cell, setCell] = useState(true),
    [labels, setLabels] = useState(false),
    [large, setLarge] = useState(false);
  const [error, setError] = useState("");
  const elements = [
    ...new Set<string>(structure.sites.map((s) => s.element)),
  ];
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(lab ? "#111f2e" : "#202922");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError("3D rendering is unavailable in this browser.");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(6, 8, 10);
    scene.add(light, new THREE.AmbientLight(0xffffff, 1.5));
    const group = new THREE.Group();
    scene.add(group);
    const positions = structure.sites.map(
      (s) => new THREE.Vector3(...s.position),
    );
    const sphere = new THREE.SphereGeometry(large ? 0.46 : 0.28, 16, 12);
    const materials = elements.map((_, index) => new THREE.MeshStandardMaterial({
      color: colors[index % colors.length],
      roughness: 0.55,
    }));
    const labelMaterials = new Map<string, THREE.SpriteMaterial>();
    if (labels) {
      structure.sites.forEach((site, index) => {
        let material = labelMaterials.get(site.element);
        if (!material) {
          const canvas = document.createElement("canvas");
          canvas.width = 256;
          canvas.height = 64;
          const context = canvas.getContext("2d");
          if (!context) return;
          context.font = "bold 36px sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.strokeStyle = "#202922";
          context.lineWidth = 6;
          context.strokeText(site.element, 128, 32, 250);
          context.fillStyle = "#fff";
          context.fillText(site.element, 128, 32, 250);
          material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) });
          labelMaterials.set(site.element, material);
        }
        const label = new THREE.Sprite(material);
        label.position.copy(positions[index]).add(new THREE.Vector3(0, 0.55, 0));
        label.scale.set(2.4, 0.6, 1);
        group.add(label);
      });
    }
    const atomMeshes: THREE.Mesh[] = [];
    if (atoms)
      structure.sites.forEach((s, i) => {
        const mesh = new THREE.Mesh(
          sphere,
          materials[elements.indexOf(s.element)],
        );
        mesh.position.copy(positions[i]);
        mesh.userData.siteIndex = i;
        atomMeshes.push(mesh);
        group.add(mesh);
      });
    if (bonds)
      for (let i = 0; i < positions.length; i++)
        for (let j = i + 1; j < positions.length; j++) {
          const dist = positions[i].distanceTo(positions[j]);
          if (dist > 0.1 && dist < 2.5) {
            group.add(
              new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                  positions[i],
                  positions[j],
                ]),
                new THREE.LineBasicMaterial({ color: "#829385" }),
              ),
            );
          }
        }
    if (cell) {
      const l = structure.lattice.map((x) => new THREE.Vector3(...x));
      const corners: Array<THREE.Vector3> = [];
      for (let i = 0; i < 8; i++)
        corners.push(
          new THREE.Vector3()
            .addScaledVector(l[0], i & 1 ? 1 : 0)
            .addScaledVector(l[1], i & 2 ? 1 : 0)
            .addScaledVector(l[2], i & 4 ? 1 : 0),
        );
      for (let i = 0; i < 8; i++)
        for (const b of [1, 2, 4])
          if (!(i & b))
            group.add(
              new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                  corners[i],
                  corners[i | b],
                ]),
                new THREE.LineBasicMaterial({ color: "#b9c1b5" }),
              ),
            );
    }
    const box = new THREE.Box3().setFromPoints(positions).expandByObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(4, box.getSize(new THREE.Vector3()).length());
    reset.current = () => {
      camera.position
        .copy(center)
        .add(new THREE.Vector3(size, size * 0.6, size));
      controls.target.copy(center);
      controls.update();
    };
    reset.current();
    const render = () => renderer.render(scene, camera);
    const selectionMaterial = new THREE.MeshBasicMaterial({
      color: "#8df1ef", wireframe: true,
    });
    const selection = new THREE.Mesh(sphere, selectionMaterial);
    selection.scale.setScalar(1.22);
    selection.visible = false;
    group.add(selection);
    highlight.current = (index) => {
      selection.visible = atoms && index !== null && !!positions[index];
      if (selection.visible && index !== null) selection.position.copy(positions[index]);
      render();
    };

    const ray = new THREE.Raycaster();
    let start: { x: number; y: number; id: number } | undefined;
    function pointerDown(event: PointerEvent) {
      start = event.isPrimary && event.button === 0
        ? { x: event.clientX, y: event.clientY, id: event.pointerId }
        : undefined;
    }
    function pointerUp(event: PointerEvent) {
      const origin = start;
      start = undefined;
      if (!origin || origin.id !== event.pointerId ||
          Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        1 - ((event.clientY - bounds.top) / bounds.height) * 2,
      ), camera);
      const hit = ray.intersectObjects(atomMeshes, false)[0];
      if (hit) onSelectSite?.(hit.object.userData.siteIndex);
    }
    if (onSelectSite) {
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointerup", pointerUp);
    }
    controls.addEventListener("change", render);
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      highlight.current = () => {};
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      selectionMaterial.dispose();
      controls.removeEventListener("change", render);
      controls.dispose();
      sphere.dispose();
      materials.forEach((material) => material.dispose());
      labelMaterials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
      group.children.forEach((object) => {
        if (object instanceof THREE.Line) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [structure, atoms, bonds, cell, labels, large, lab, onSelectSite]);
  useEffect(() => {
    highlight.current(selectedSite);
  }, [selectedSite, structure, atoms, bonds, cell, labels, large, lab, onSelectSite]);
  return (
    <div className={lab ? "lab-viewer" : undefined}>
      <div className="actions">
        <button className="ghost small" onClick={() => reset.current()}>
          Reset view
        </button>
        {([
          [atoms, setAtoms, "Atoms"],
          [bonds, setBonds, "Distance contacts"],
          [cell, setCell, "Unit cell"],
          [labels, setLabels, "Atom labels"],
          [large, setLarge, "Larger spheres"],
        ] as const).map(([v, s, l]) => (
          <label className="check" key={l}>
            <input
              type="checkbox"
              checked={v}
              onChange={(e) => s(e.target.checked)}
            />
            {l}
          </label>
        ))}
        <button
          className="ghost small"
          onClick={() => {
            void host.current?.requestFullscreen?.().catch(() => setError("Fullscreen is unavailable."));
          }}
        >
          Fullscreen
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div
        ref={host}
        className="viewer"
        aria-label="Interactive crystal structure: drag to rotate, scroll to zoom"
      />
      {elements.map((e, i) => (
        <span
          className="tag"
          key={e}
          style={{ borderLeft: "8px solid " + colors[i % colors.length] }}
        >
          {e}
        </span>
      ))}
      <p className="muted">
        Lines show candidate contacts within the displayed cell (&lt;2.5 Å).
        Drag to rotate, right-drag to pan, and scroll or pinch to zoom.
      </p>
    </div>
  );
}
