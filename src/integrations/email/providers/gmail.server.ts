import nodemailer from "nodemailer";
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

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: this.senderEmail,
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          refreshToken: this.refreshToken,
          accessToken,
        },
      });

      const mailOptions = {
        from: payload.from || this.senderEmail,
        to: payload.to.join(","),
        subject: payload.subject,
        html: payload.html,
      };

      const result = await transporter.sendMail(mailOptions);

      return {
        sent: true,
        provider: "gmail",
        messageId: String(result.messageId || result.response || ""),
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
