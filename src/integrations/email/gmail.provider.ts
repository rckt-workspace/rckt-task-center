import { Buffer } from "node:buffer";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./email-provider";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GmailSendResponse {
  id?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    refresh_token: requiredEnv("GOOGLE_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || `HTTP ${response.status}`;
    throw new Error(`Google OAuth token exchange failed: ${detail}`);
  }

  return payload.access_token;
}

export class GmailProvider implements EmailProvider {
  readonly name = "gmail";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const sender = requiredEnv("GMAIL_SENDER_EMAIL");
      const accessToken = await getAccessToken();
      const headers = [
        `From: RCKT Task Center <${sender}>`,
        `To: ${message.to}`,
        `Subject: ${encodeHeader(message.subject)}`,
        ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
      ];
      const raw = toBase64Url(`${headers.join("\r\n")}\r\n\r\n${message.html}`);

      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });

      const body = await response.text();
      if (!response.ok) {
        return {
          sent: false,
          provider: this.name,
          error: `Gmail API request failed [${response.status}]: ${body}`,
        };
      }

      const payload = JSON.parse(body) as GmailSendResponse;
      return { sent: true, provider: this.name, messageId: payload.id ?? null };
    } catch (error) {
      return {
        sent: false,
        provider: this.name,
        error: error instanceof Error ? error.message : "Unknown Gmail provider error",
      };
    }
  }
}
