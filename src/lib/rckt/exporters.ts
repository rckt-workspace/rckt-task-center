import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
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

// ---- Reporte ejecutivo (PDF de alto nivel para administración) ----

interface SummaryRow {
  key: string;
  completadas: number;
  enCurso: number;
  pendientes: number;
  total: number;
  pct: number;
}

function summaryRows(tasks: Task[], field: "cliente" | "colaborador"): SummaryRow[] {
  const total = tasks.length;
  const map = new Map<string, SummaryRow>();
  for (const t of tasks) {
    const key = t[field];
    const row =
      map.get(key) ?? { key, completadas: 0, enCurso: 0, pendientes: 0, total: 0, pct: 0 };
    if (t.estado === "Completada") row.completadas += 1;
    else if (t.estado === "En curso") row.enCurso += 1;
    else row.pendientes += 1;
    row.total += 1;
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, pct: total === 0 ? 0 : Math.round((r.total / total) * 100) }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

function summaryBody(tasks: Task[], field: "cliente" | "colaborador"): string[][] {
  return summaryRows(tasks, field).map((r) => [
    r.key,
    String(r.completadas),
    String(r.enCurso),
    String(r.pendientes),
    String(r.total),
    `${r.pct}%`,
  ]);
}

const SUMMARY_HEADERS = ["", "Compl.", "En curso", "Pend.", "Total", "% del total"];

/**
 * PDF ejecutivo: indicadores, resúmenes por cliente/colaborador y puntos de
 * atención. NO incluye el detalle de tareas individuales.
 */
export function exportExecutivePDF(
  tasks: Task[],
  puntos: AttentionPoint[],
  mondayIso: string | null,
): void {
  const doc = new jsPDF({ orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title("RCKT — Reporte ejecutivo", mondayIso), 14, 13);

  // Indicadores
  const completadas = tasks.filter((t) => t.estado === "Completada").length;
  const enCurso = tasks.filter((t) => t.estado === "En curso").length;
  const pendientes = tasks.filter((t) => t.estado === "Pendiente").length;
  const vencidas = tasks.filter((t) => isOverdue(t.fechaLimite, t.estado)).length;
  const cumplimiento = tasks.length === 0 ? 0 : Math.round((completadas / tasks.length) * 100);
  const kpis: Array<[string, string]> = [
    ["Total tareas", String(tasks.length)],
    ["Completadas", String(completadas)],
    ["En curso", String(enCurso)],
    ["Pendientes", String(pendientes)],
    ["Cumplimiento", `${cumplimiento}%`],
    ["Vencidas", String(vencidas)],
  ];
  const margin = 14;
  const gap = 4;
  const boxW = (pageW - margin * 2 - gap * 5) / 6;
  const boxY = 26;
  kpis.forEach(([label, value], i) => {
    const x = margin + i * (boxW + gap);
    doc.setFillColor(...IVORY);
    doc.setDrawColor(229, 225, 216);
    doc.roundedRect(x, boxY, boxW, 18, 2, 2, "FD");
    doc.setTextColor(...NAVY);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + boxW / 2, boxY + 9, { align: "center" });
    doc.setTextColor(58, 61, 68);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x + boxW / 2, boxY + 14.5, { align: "center" });
  });

  let y = boxY + 26;

  const section = (label: string) => {
    doc.setTextColor(...NAVY);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    y += 2;
  };

  const tableStyles = {
    fontSize: 8.5,
    textColor: INK,
  } as const;

  section("Resumen por cliente");
  autoTable(doc, {
    startY: y,
    head: [["Cliente", ...SUMMARY_HEADERS.slice(1)]],
    body: summaryBody(tasks, "cliente"),
    styles: tableStyles,
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: IVORY },
    margin: { left: margin, right: margin },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  section("Resumen por colaborador");
  autoTable(doc, {
    startY: y,
    head: [["Colaborador", ...SUMMARY_HEADERS.slice(1)]],
    body: summaryBody(tasks, "colaborador"),
    styles: tableStyles,
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: IVORY },
    margin: { left: margin, right: margin },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  section("Puntos de atención");
  if (puntos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Cliente", "Colaborador", "Tipo", "Motivo"]],
      body: puntos.map((p) => [p.cliente, p.colaborador, p.tipo, p.motivo || "—"]),
      styles: tableStyles,
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: IVORY },
      margin: { left: margin, right: margin },
    });
  } else {
    doc.setTextColor(58, 61, 68);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Sin puntos de atención registrados en este período.", margin, y + 5);
  }

  doc.save(`reporte_ejecutivo_rckt_${rangeSlug(mondayIso)}.pdf`);
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

/** Excel completo de administración: hoja "Tareas" + hoja "Resumen". */
export async function exportAdminWorkbook(
  tasks: Task[],
  puntos: AttentionPoint[],
  mondayIso: string | null,
): Promise<void> {
  const ids = tasks.map((t) => t.id);
  const commentsByTask = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data } = await supabase
      .from("task_comments")
      .select("task_id, author_name, body, created_at")
      .in("task_id", ids)
      .order("created_at", { ascending: true });
    for (const c of data ?? []) {
      const label = `${c.author_name || "—"} (${format(new Date(c.created_at), "dd/MM")}): ${c.body}`;
      const list = commentsByTask.get(c.task_id) ?? [];
      list.push(label);
      commentsByTask.set(c.task_id, list);
    }
  }

  const detalle = tasks.map((t) => ({
    Tarea: t.tarea,
    Colaborador: t.colaborador,
    Cliente: t.cliente,
    "Área": t.area,
    "Fecha límite": formatFechaHora(t.fechaLimite, t.horaLimite),
    Estado: t.estado,
    "Entregable/Observaciones": t.observaciones || "",
    Adjuntos: t.adjuntos.length === 0 ? "" : t.adjuntos.map((a) => a.name).join(", "),
    "N° adjuntos": t.adjuntos.length,
    Enlaces: t.enlaces.join(", "),
    "Nota de voz": t.adjuntos.some((a) => a.mime.startsWith("audio/")) ? "Sí" : "No",
    Comentarios: (commentsByTask.get(t.id) ?? []).join(" | "),
    "Fecha de creación": t.createdAt ? format(new Date(t.createdAt), "dd/MM/yyyy HH:mm") : "",
  }));

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "RCKT";

  const columns = Object.keys(
    detalle[0] ?? {
      Tarea: "",
      Colaborador: "",
      Cliente: "",
      "Área": "",
      "Fecha límite": "",
      Estado: "",
      "Entregable/Observaciones": "",
      Adjuntos: "",
      "N° adjuntos": "",
      Enlaces: "",
      "Nota de voz": "",
      Comentarios: "",
      "Fecha de creación": "",
    },
  );

  const wsTareas = wb.addWorksheet("Tareas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  wsTareas.columns = columns.map((c) => ({ header: c, key: c }));
  for (const row of detalle) wsTareas.addRow(row);

  styleHeaderRow(wsTareas.getRow(1));

  const estadoCol = columns.indexOf("Estado") + 1;
  wsTareas.eachRow((row, i) => {
    if (i === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    if (i % 2 === 0) fill(row, IVORY_HEX);
    const estadoCell = row.getCell(estadoCol);
    const bg = ESTADO_FILL[String(estadoCell.value ?? "")];
    if (bg) {
      estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      estadoCell.font = { bold: true, color: { argb: "FF1B2A4A" } };
      estadoCell.alignment = { vertical: "middle", horizontal: "center" };
    }
  });
  autofit(wsTareas);

  // Hoja resumen
  const completadas = tasks.filter((t) => t.estado === "Completada").length;
  const enCurso = tasks.filter((t) => t.estado === "En curso").length;
  const pendientes = tasks.filter((t) => t.estado === "Pendiente").length;
  const vencidas = tasks.filter((t) => isOverdue(t.fechaLimite, t.estado)).length;
  const cumplimiento = tasks.length === 0 ? 0 : Math.round((completadas / tasks.length) * 100);

  const ws = wb.addWorksheet("Resumen");

  const titleRow = ws.addRow([title("RCKT — Resumen", mondayIso)]);
  titleRow.font = { bold: true, size: 14, color: { argb: NAVY_HEX } };
  titleRow.height = 24;
  ws.addRow([]);

  // Indicadores: número grande arriba, etiqueta debajo
  const kpis: Array<[string, string | number]> = [
    ["TOTAL TAREAS", tasks.length],
    ["COMPLETADAS", completadas],
    ["EN CURSO", enCurso],
    ["PENDIENTES", pendientes],
    ["CUMPLIMIENTO", `${cumplimiento}%`],
    ["VENCIDAS", vencidas],
  ];
  const valueRow = ws.addRow(kpis.map(([, v]) => v));
  const labelRow = ws.addRow(kpis.map(([l]) => l));
  valueRow.height = 26;
  kpis.forEach((_, i) => {
    const vc = valueRow.getCell(i + 1);
    const lc = labelRow.getCell(i + 1);
    vc.font = { bold: true, size: 16, color: { argb: NAVY_HEX } };
    vc.alignment = { horizontal: "center", vertical: "middle" };
    lc.font = { size: 8, color: { argb: "FF3A3D44" } };
    lc.alignment = { horizontal: "center" };
    for (const c of [vc, lc]) {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: IVORY_HEX } };
      c.border = {
        top: { style: "thin", color: { argb: BORDER_HEX } },
        left: { style: "thin", color: { argb: BORDER_HEX } },
        right: { style: "thin", color: { argb: BORDER_HEX } },
        bottom: { style: "thin", color: { argb: BORDER_HEX } },
      };
    }
  });
  ws.addRow([]);

  const sectionTitle = (label: string) => {
    const r = ws.addRow([label]);
    r.font = { bold: true, size: 12, color: { argb: NAVY_HEX } };
  };

  const table = (head: string[], body: (string | number)[][]) => {
    styleHeaderRow(ws.addRow(head));
    body.forEach((b, i) => {
      const r = ws.addRow(b);
      if (i % 2 === 1) fill(r, IVORY_HEX);
    });
    ws.addRow([]);
  };

  sectionTitle("Resumen por cliente");
  table(["Cliente", ...SUMMARY_HEADERS.slice(1)], summaryBody(tasks, "cliente"));

  sectionTitle("Resumen por colaborador");
  table(["Colaborador", ...SUMMARY_HEADERS.slice(1)], summaryBody(tasks, "colaborador"));

  sectionTitle("Puntos de atención");
  if (puntos.length > 0) {
    table(
      ["Cliente", "Colaborador", "Tipo", "Motivo"],
      puntos.map((p) => [p.cliente, p.colaborador, p.tipo, p.motivo || "—"]),
    );
  } else {
    ws.addRow(["Sin puntos de atención registrados en este período."]);
  }
  autofit(ws, 60);

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `tareas_rckt_${rangeSlug(mondayIso)}.xlsx`,
  );
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
