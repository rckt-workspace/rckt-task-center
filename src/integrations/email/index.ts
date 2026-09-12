export type EmailProvider = "gmail";

export interface EmailResponse {
  sent: boolean;
  provider: EmailProvider;
  messageId?: string;
  error?: string;
}

export interface EmailPayload {
  to: string[];
  subject: string;
  html: string;
  from?: string;
}
