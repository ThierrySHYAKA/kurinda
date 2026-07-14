/**
 * Kurinda - District Officer action report export.
 *
 * Client-side PDF generation (jsPDF + autoTable) - no backend endpoint
 * needed, since everything it needs (sectors, interventions) is already
 * loaded in the dashboard for the map and detail panel.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SectorProps } from "@/app/dashboard/MapView";
import type { Intervention } from "./interventions";

function sourceLabel(source: string): string {
  if (source === "dhs_measurement_2019_20") return "Measured (DHS)";
  if (source === "model_prediction") return "Predicted";
  return source;
}

// The "reasoning" column: for measured sectors there's no model driver to
// cite, so the honest answer is that it's a direct survey reading.
function reasoning(sector: SectorProps): string {
  if (sector.source === "dhs_measurement_2019_20") {
    return "Direct DHS measurement (2019-20)";
  }
  return sector.risk_driver_1 ?? "Model prediction";
}

export function exportPriorityReport({
  district,
  sectors,
  interventions,
  officerName,
}: {
  district: string;
  sectors: SectorProps[];
  interventions: Intervention[];
  officerName: string;
}) {
  const top = [...sectors]
    .sort((a, b) => (b.risk_value ?? 0) - (a.risk_value ?? 0))
    .slice(0, 10);

  // Most recent logged intervention per sector, if any (interventions is
  // already newest-first from the backend).
  const lastVisit: Record<string, string> = {};
  for (const i of interventions) {
    if (!lastVisit[i.sector]) {
      lastVisit[i.sector] = new Date(i.created_at).toLocaleDateString();
    }
  }

  const doc = new jsPDF();
  const generated = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.setFontSize(16);
  doc.text("Kurinda — District Action Report", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `${district} District  ·  Generated ${generated} by ${officerName}`,
    14,
    25
  );

  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(
    `Top ${top.length} priority sectors for the next intervention cycle, ranked by predicted chronic stunting risk.`,
    14,
    33
  );

  autoTable(doc, {
    startY: 38,
    head: [["#", "Sector", "Risk", "Source", "Reasoning", "Last visit"]],
    body: top.map((s, i) => [
      String(i + 1),
      s.NAME_3,
      s.risk_value != null ? `${(s.risk_value * 100).toFixed(1)}%` : "n/a",
      sourceLabel(s.source),
      reasoning(s),
      lastVisit[s.NAME_3] ?? "None logged",
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [16, 78, 60] },
    columnStyles: { 0: { cellWidth: 8 } },
  });

  // jspdf-autotable still attaches this to the doc instance for chaining,
  // even though the function itself returns void - the package's own
  // types leave `doc` as `any`, so this cast just documents that.
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 40;

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Kurinda is a screening tool: a sector-level LightGBM classifier (test AUC 0.70) trained on DHS survey data. " +
      "Predictions should inform, not replace, field judgement.",
    14,
    finalY + 10,
    { maxWidth: 180 }
  );

  doc.save(
    `kurinda-${district.toLowerCase().replace(/\s+/g, "-")}-priority-report.pdf`
  );
}
