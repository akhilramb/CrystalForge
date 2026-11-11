import csv, io
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


def generate(record, format):
    fields = [
        ("Formula", record.get("formula")),
        ("Working ion", record.get("working_ion")),
        ("Predicted voltage (V)", record.get("predicted_voltage")),
        ("90% marginal interval (V)", record.get("interval")),
        ("Model version", record.get("model_version")),
        ("Dataset voltage (V)", record.get("target_voltage")),
        ("Crystal system", record.get("crystal_system")),
        ("Space group", record.get("space_group_number")),
        ("Gravimetric capacity (mAh/g)", record.get("capacity_grav")),
        ("Volumetric capacity (mAh/cm3)", record.get("capacity_vol")),
        ("Band gap (eV)", record.get("band_gap")),
        ("Formation energy (eV/atom)", record.get("formation_energy_per_atom")),
        ("Energy above hull (eV/atom)", record.get("e_above_hull")),
        ("Maximum volume change", record.get("max_delta_volume")),
        ("Estimated raw-material cost (USD/kg)", record.get("cost")),
        ("Sustainability screening score", record.get("sustainability")),
        ("Source / provenance", record.get("source_provenance")),
        ("Structure link", record.get("materials_project_structure_url")),
    ]
    if format == "csv":
        s = io.StringIO()
        w = csv.writer(s)
        w.writerow(["Property", "Value", "Type"])
        for k, v in fields:
            w.writerow(
                [
                    k,
                    str(v) if v is not None else "Unavailable",
                    "Predicted"
                    if "Predicted" in k or "interval" in k
                    else "Calculated"
                    if "cost" in k or "score" in k
                    else "Dataset / metadata",
                ]
            )
        return s.getvalue().encode()
    b = io.BytesIO()
    styles = getSampleStyleSheet()
    flow = [
        Paragraph("CRYSTALFORGE", styles["Title"]),
        Paragraph("Material investigation report", styles["Heading2"]),
        Spacer(1, 18),
    ]
    for k, v in fields:
        flow.append(
            Paragraph(
                f"<b>{escape(k)}</b>: {escape(str(v) if v is not None else 'Unavailable')}",
                styles["BodyText"],
            )
        )
        flow.append(Spacer(1, 7))
    for msg in [
        "Voltage is model-predicted; capacity, stability and structural metadata are dataset-derived.",
        "Cost uses supplied historical elemental price references and is not manufacturing cost. Sustainability is a heuristic screening indicator, not certification.",
        "Structure coordinates are only available when an actual CIF is supplied.",
        "Supplied train/test groups can share related frameworks. Reported performance does not establish generalization to new chemical families.",
    ] + record.get("warnings", []):
        flow.append(Paragraph(escape(msg), styles["BodyText"]))
        flow.append(Spacer(1, 10))
    if record.get("economics"):
        for item in record["economics"]["breakdown"]:
            flow.append(
                Paragraph(
                    escape(
                        f"{item['element']}: mass fraction {item['mass_fraction']:.4f}; price {item['price']}; status {item['price_status']}; source {item['source']}"
                    ),
                    styles["BodyText"],
                )
            )
    SimpleDocTemplate(b, title="CrystalForge material report").build(flow)
    return b.getvalue()
