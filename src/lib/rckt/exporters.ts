import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatFechaHora, isOverdue, sundayOfISO, toISO, weekLabel } from "@/lib/rckt/dates";
import type { AttentionPoint, Task } from "@/lib/rckt/types";

const NAVY: [number, number, number] = [55, 42, 110]; // #372A6E
const IVORY: [number, number, number] = [250, 247, 240]; // #FAF7F0
const INK: [number, number, number] = [17, 18, 20]; // #111214

const HEADERS_ADMIN = ["Tarea", "Colaborador", "Cliente", "Área", "Fecha límite", "Estado"];
const HEADERS_OWN = ["Tarea", "Cliente", "Área", "Fecha límite", "Estado"];

interface ExportOptions {
  /** Incluir columna de colaborador (vista administradora). */
  includeColaborador: boolean;
  /** Prefijo del título, ej. "RCKT — Tareas" o "RCKT — Mis tareas". */
  titlePrefix: string;
  /** Prefijo del nombre de archivo, ej. "tareas_rckt" o "mis_tareas_anyelyhuelgos". */
  filePrefix: string;
}

function rows(tasks: Task[], includeColaborador: boolean): string[][] {
  return tasks.map((t) => {
    const limite = formatFechaHora(t.fechaLimite, t.horaLimite);
    const base = [t.tarea, t.cliente, t.area, limite, t.estado];
    return includeColaborador ? [t.tarea, t.colaborador, t.cliente, t.area, limite, t.estado] : base;
  });
}

/** Rango de archivo: "2026-08-31_2026-09-06" o "historico". */
function rangeSlug(mondayIso: string | null): string {
  if (!mondayIso) return "historico";
  return `${mondayIso}_${toISO(sundayOfISO(mondayIso))}`;
}

function title(prefix: string, mondayIso: string | null): string {
  return mondayIso
    ? `${prefix} semana del ${weekLabel(mondayIso)}`
    : `${prefix} — histórico`;
}

function exportPDF(tasks: Task[], mondayIso: string | null, opts: ExportOptions): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title(opts.titlePrefix, mondayIso), 14, 13);

  autoTable(doc, {
    startY: 26,
    head: [opts.includeColaborador ? HEADERS_ADMIN : HEADERS_OWN],
    body: rows(tasks, opts.includeColaborador),
    styles: { fontSize: 9, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: IVORY },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${opts.filePrefix}_${rangeSlug(mondayIso)}.pdf`);
}

function exportExcel(tasks: Task[], mondayIso: string | null, opts: ExportOptions): void {
  const data = tasks.map((t) => {
    const base = {
      Tarea: t.tarea,
      Cliente: t.cliente,
      "Área": t.area,
      "Fecha límite": formatFechaHora(t.fechaLimite, t.horaLimite),
      Estado: t.estado,
    };
    return opts.includeColaborador ? { ...base, Colaborador: t.colaborador } : base;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = opts.includeColaborador
    ? [{ wch: 40 }, { wch: 26 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 20 }]
    : [{ wch: 40 }, { wch: 26 }, { wch: 26 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tareas");
  XLSX.writeFile(wb, `${opts.filePrefix}_${rangeSlug(mondayIso)}.xlsx`);
}

// ---- API pública ----

const ADMIN_OPTS: ExportOptions = {
  includeColaborador: true,
  titlePrefix: "RCKT — Tareas",
  filePrefix: "tareas_rckt",
};

export function exportTasksPDF(tasks: Task[], mondayIso: string | null): void {
  exportPDF(tasks, mondayIso, ADMIN_OPTS);
}

export function exportTasksExcel(tasks: Task[], mondayIso: string | null): void {
  exportExcel(tasks, mondayIso, ADMIN_OPTS);
}

/** Slug de nombre de archivo a partir del nombre del colaborador. */
function nameSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function exportMyTasksPDF(tasks: Task[], mondayIso: string | null, nombre: string): void {
  exportPDF(tasks, mondayIso, {
    includeColaborador: false,
    titlePrefix: "RCKT — Mis tareas",
    filePrefix: `mis_tareas_${nameSlug(nombre)}`,
  });
}

export function exportMyTasksExcel(tasks: Task[], mondayIso: string | null, nombre: string): void {
  exportExcel(tasks, mondayIso, {
    includeColaborador: false,
    titlePrefix: "RCKT — Mis tareas",
    filePrefix: `mis_tareas_${nameSlug(nombre)}`,
  });
}
