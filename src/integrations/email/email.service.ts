import type { EmailMessage, EmailSendResult } from "./email-provider";
import { GmailProvider } from "./gmail.provider";

const provider = new GmailProvider();

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  return provider.send(message);
}
