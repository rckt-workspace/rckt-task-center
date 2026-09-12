const NAVY = "#1B2A4A";
const IVORY = "#FAF7F0";
const BORDER = "#E5E1D8";
const TEXT = "#3A3D44";
const ALERT = "#B42318";

function esc(v: string) {
  return v.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function fmt(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;color:${TEXT};font-size:13px;width:150px;">${esc(label)}</td>
    <td style="padding:8px 0;color:#111214;font-size:14px;font-weight:600;">${esc(value)}</td>
  </tr>`;
}

export interface TaskDueTodayParams {
  assigneeName: string;
  assigneeEmail: string;
  taskName: string;
  client: string;
  area: string;
  status: string;
  dueDate: string;
  details?: string;
}

export function buildTaskDueTodayHtml(params: TaskDueTodayParams): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:${IVORY};font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF8;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
    <tr><td style="background:${NAVY};padding:20px 24px;">
      <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:2px;">RCKT</div>
      <div style="color:#C9D2E4;font-size:12px;margin-top:4px;">Centro de Control Semanal</div>
    </td></tr>
    <tr><td style="padding:24px;">
      <p style="margin:0 0 4px;color:${TEXT};font-size:13px;">Hola ${esc(params.assigneeName || params.assigneeEmail)},</p>
      <h1 style="margin:0 0 12px;color:#111214;font-size:18px;">Recordatorio: tu tarea vence hoy</h1>
      <div style="display:inline-block;background:#FDECEA;color:${ALERT};border:1px solid #F5C2BD;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;margin-bottom:16px;">VENCE HOY · ${esc(fmt(params.dueDate))}</div>
      <div style="background:${IVORY};border:1px solid ${BORDER};border-radius:10px;padding:16px;">
        <div style="color:#111214;font-size:16px;font-weight:700;margin-bottom:8px;">${esc(params.taskName)}</div>
        <table role="presentation" width="100%">
          ${row("Cliente", params.client)}
          ${row("Área", params.area)}
          ${row("Estado actual", params.status)}
          ${row("Fecha límite", fmt(params.dueDate))}
          ${params.details ? row("Detalle", params.details) : ""}
        </table>
      </div>
      <p style="margin:20px 0 0;color:${TEXT};font-size:12px;">Si ya la terminaste, márcala como <strong>Completada</strong> en el Centro de Control Semanal.</p>
    </td></tr>
  </table>
</body></html>`;
}
