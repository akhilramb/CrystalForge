import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
const colors = [
  "#afc564",
  "#6a9cc7",
  "#d98778",
  "#dccb82",
  "#a3a1c2",
  "#5eab9a",
];
export default function CrystalViewer({ structure }: { structure: any }) {
  const host = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const [atoms, setAtoms] = useState(true),
    [bonds, setBonds] = useState(false),
    [cell, setCell] = useState(true);
  const elements = [
    ...new Set<string>(structure.sites.map((s: any) => s.element)),
  ];
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#202922");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(6, 8, 10);
    scene.add(light, new THREE.AmbientLight(0xffffff, 1.5));
    const group = new THREE.Group();
    scene.add(group);
    const positions = structure.sites.map(
      (s: any) => new THREE.Vector3(...s.position),
    );
    if (atoms)
      structure.sites.forEach((s: any, i: number) => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 24, 16),
          new THREE.MeshStandardMaterial({
            color: colors[elements.indexOf(s.element) % colors.length],
            roughness: 0.55,
          }),
        );
        mesh.position.copy(positions[i]);
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
      const l = structure.lattice.map((x: number[]) => new THREE.Vector3(...x));
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
    const box = new THREE.Box3().setFromPoints(positions);
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
    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      renderer.setSize(w, 400);
      camera.aspect = w / 400;
      camera.updateProjectionMatrix();
    });
    observer.observe(container);
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o: any) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [structure, atoms, bonds, cell]);
  return (
    <div>
      <div className="actions">
        <button className="ghost small" onClick={() => reset.current()}>
          Reset view
        </button>
        {[
          [atoms, setAtoms, "Atoms"],
          [bonds, setBonds, "Bonds"],
          [cell, setCell, "Unit cell"],
        ].map(([v, s, l]: any) => (
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
          onClick={() => host.current?.requestFullscreen()}
        >
          Fullscreen
        </button>
      </div>
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
        Coordinates from the supplied CIF. Bonds are a distance-based visual
        guide (&lt;2.5 Å), not a bond-order calculation. Drag to rotate; scroll
        to zoom.
      </p>
    </div>
  );
}
