export async function api(path: string, body?: unknown, method?: string) {
  const r = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    let d;
    try {
      d = await r.json();
    } catch {
      throw new Error("The server is unavailable. Please try again.");
    }
    throw new Error(
      Array.isArray(d.detail)
        ? d.detail.map((x: any) => x.msg).join(" ")
        : d.detail || "Request failed.",
    );
  }
  return r.json();
}
export async function downloadReport(
  material_id: string | undefined,
  history_id: number | undefined,
  format: string,
) {
  const r = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ material_id, history_id, format }),
  });
  if (!r.ok) throw new Error("Report could not be generated.");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "crystalforge-report." + format;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const fmt = (v: any, d = 2) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? "Unavailable"
    : Number(v).toLocaleString(undefined, {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
export const ions = ["Li", "Mg", "Ca", "Zn", "Y", "Al"];
export const systems = [
  "Triclinic",
  "Monoclinic",
  "Orthorhombic",
  "Tetragonal",
  "Trigonal",
  "Hexagonal",
  "Cubic",
];
