import type { EmailPayload, EmailResponse } from "./index";
import type { IEmailProvider } from "./providers/base";

// Server-only: email provider
let emailProvider: IEmailProvider | null = null;

async function initializeEmailService(): Promise<void> {
  if (emailProvider) return;

  const refreshToken = process.env["GMAIL_REFRESH_TOKEN"];
  const clientId = process.env["GMAIL_CLIENT_ID"];
  const clientSecret = process.env["GMAIL_CLIENT_SECRET"];
  const senderEmail = process.env["GMAIL_SENDER_EMAIL"];

  if (!refreshToken || !clientId || !clientSecret || !senderEmail) {
    throw new Error("Gmail environment variables not configured");
  }

  const { GmailProvider } = await import("./providers/gmail.server");
  emailProvider = new GmailProvider(refreshToken, clientId, clientSecret, senderEmail);
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResponse> {
  try {
    await initializeEmailService();
    if (!emailProvider) {
      return {
        sent: false,
        provider: "gmail",
        error: "Email service not initialized",
      };
    }
    return emailProvider.send(payload);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Email service initialization failed";
    return {
      sent: false,
      provider: "gmail",
      error: errorMsg,
    };
  }
}

export async function sendTaskAssignedEmail(params: {
  to: string;
  name: string;
  taskName: string;
  client: string;
  area: string;
  status: string;
  dueDate: string | null;
  authorName?: string;
  details?: string;
  audioLinks?: Array<{ name: string; url: string }>;
}): Promise<EmailResponse> {
  const { buildTaskAssignedHtml } = await import("./templates/task-assigned");
  const html = buildTaskAssignedHtml({
    assigneeName: params.name,
    assigneeEmail: params.to,
    taskName: params.taskName,
    client: params.client,
    area: params.area,
    status: params.status,
    dueDate: params.dueDate,
    authorName: params.authorName,
    details: params.details,
    audioLinks: params.audioLinks,
  });

  return sendEmail({
    to: [params.to],
    subject: `Nueva tarea asignada: ${params.taskName}`,
    html,
  });
}

export async function sendTaskReassignedEmail(params: {
  to: string;
  name: string;
  taskName: string;
  client: string;
  area: string;
  status: string;
  dueDate: string | null;
  previousAssignee?: string;
  authorName?: string;
  details?: string;
}): Promise<EmailResponse> {
  const { buildTaskReassignedHtml } = await import("./templates/task-reassigned");
  const html = buildTaskReassignedHtml({
    assigneeName: params.name,
    assigneeEmail: params.to,
    taskName: params.taskName,
    client: params.client,
    area: params.area,
    status: params.status,
    dueDate: params.dueDate,
    previousAssignee: params.previousAssignee,
    authorName: params.authorName,
    details: params.details,
  });

  return sendEmail({
    to: [params.to],
    subject: `Tarea reasignada: ${params.taskName}`,
    html,
  });
}

export async function sendTaskDueTodayEmail(params: {
  to: string;
  name: string;
  taskName: string;
  client: string;
  area: string;
  status: string;
  dueDate: string;
  details?: string;
}): Promise<EmailResponse> {
  const { buildTaskDueTodayHtml } = await import("./templates/task-due-today");
  const html = buildTaskDueTodayHtml({
    assigneeName: params.name,
    assigneeEmail: params.to,
    taskName: params.taskName,
    client: params.client,
    area: params.area,
    status: params.status,
    dueDate: params.dueDate,
    details: params.details,
  });

  return sendEmail({
    to: [params.to],
    subject: `Recordatorio: tu tarea ${params.taskName} vence hoy`,
    html,
  });
}
