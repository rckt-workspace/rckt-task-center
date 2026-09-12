import type { EmailPayload, EmailResponse } from "../index";

export interface IEmailProvider {
  send(payload: EmailPayload): Promise<EmailResponse>;
}
