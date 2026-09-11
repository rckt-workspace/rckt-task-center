export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface EmailSendResult {
  sent: boolean;
  provider: string;
  messageId?: string | null;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
