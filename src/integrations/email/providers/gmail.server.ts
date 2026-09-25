import type { IEmailProvider } from "./base";
import type { EmailPayload, EmailResponse } from "../index";

async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

function buildMimeMessage(payload: EmailPayload, senderEmail: string): string {
  const from = payload.from || senderEmail;
  const to = payload.to.join(", ");
  const subject = payload.subject;
  const html = payload.html;

  const boundary = "===============" + Math.random().toString(36).substring(2, 15) + "==";

  const mimeMessage = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html.replace(/<[^>]*>/g, "")).toString("base64"),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html).toString("base64"),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(mimeMessage).toString("base64url");
}

export class GmailProvider implements IEmailProvider {
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private senderEmail: string;

  constructor(refreshToken: string, clientId: string, clientSecret: string, senderEmail: string) {
    this.refreshToken = refreshToken;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.senderEmail = senderEmail;
  }

  async send(payload: EmailPayload): Promise<EmailResponse> {
    try {
      const accessToken = await getAccessToken(this.refreshToken, this.clientId, this.clientSecret);

      const mimeMessage = buildMimeMessage(payload, this.senderEmail);

      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: mimeMessage,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gmail API error: ${error}`);
      }

      const data = (await response.json()) as { id: string };
      return {
        sent: true,
        provider: "gmail",
        messageId: data.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error sending email";
      return {
        sent: false,
        provider: "gmail",
        error: errorMessage,
      };
    }
  }
}
