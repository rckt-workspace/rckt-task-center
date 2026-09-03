import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCO, sundayOfISO, toISO, weekLabel } from "@/lib/rckt/dates";
import type { Task } from "@/lib/rckt/types";

const NAVY: [number, number, number] = [55, 42, 110]; // #372A6E
const IVORY: [number, number, number] = [250, 247, 240]; // #FAF7F0
const INK: [number, number, number] = [17, 18, 20]; // #111214

const HEADERS = ["Tarea", "Colaborador", "Cliente", "Área", "Fecha límite", "Estado"];

function rows(tasks: Task[]): string[][] {
  return tasks.map((t) => [
    t.tarea,
    t.colaborador,
    t.cliente,
    t.area,
    formatCO(t.fechaLimite),
    t.estado,
  ]);
}

/** Rango de archivo: "2026-08-31_2026-09-06" o "historico". */
function rangeSlug(mondayIso: string | null): string {
  if (!mondayIso) return "historico";
  return `${mondayIso}_${toISO(sundayOfISO(mondayIso))}`;
}

function title(mondayIso: string | null): string {
  return mondayIso
    ? `RCKT — Tareas semana del ${weekLabel(mondayIso)}`
    : "RCKT — Histórico de tareas";
}

export function exportTasksPDF(tasks: Task[], mondayIso: string | null): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title(mondayIso), 14, 13);

  autoTable(doc, {
    startY: 26,
    head: [HEADERS],
    body: rows(tasks),
    styles: { fontSize: 9, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: IVORY },
    margin: { left: 14, right: 14 },
  });

  doc.save(`tareas_rckt_${rangeSlug(mondayIso)}.pdf`);
}

export function exportTasksExcel(tasks: Task[], mondayIso: string | null): void {
  const data = tasks.map((t) => ({
    Tarea: t.tarea,
    Colaborador: t.colaborador,
    Cliente: t.cliente,
    "Área": t.area,
    "Fecha límite": t.fechaLimite,
    Estado: t.estado,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 40 }, { wch: 20 }, { wch: 26 }, { wch: 26 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tareas");
  XLSX.writeFile(wb, `tareas_rckt_${rangeSlug(mondayIso)}.xlsx`);
}
