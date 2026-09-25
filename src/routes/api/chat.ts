import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createAuthenticatedSupabaseClient } from "@/integrations/supabase/auth-client.server";
import { processChat } from "@/server/chat/chat.service.server";
import type { LLMMessage } from "@/server/llm/types";

const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .optional(),
});

type ChatRequest = z.infer<typeof chatRequestSchema>;

interface ChatResponse {
  ok: boolean;
  reply?: string;
  error?: string;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        console.log("[API Chat] request received");

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          console.warn("[API Chat] missing or invalid authorization header");
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const token = authHeader.slice(7);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          console.warn("[API Chat] invalid JSON body");
          return new Response(JSON.stringify({ ok: false, error: "Invalid request" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let data: ChatRequest;
        try {
          data = chatRequestSchema.parse(body);
        } catch (error) {
          console.warn("[API Chat] validation error:", {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response(JSON.stringify({ ok: false, error: "Invalid request" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { client: supabase, userId } = await createAuthenticatedSupabaseClient(token);

          console.log(`[API Chat] authenticated user: ${userId}`);
          console.log("[API Chat] processing chat");

          const response = await processChat(supabase, userId, {
            message: data.message,
            conversationHistory: (data.conversationHistory as LLMMessage[]) || [],
          });

          const result: ChatResponse = {
            ok: true,
            reply: response.reply,
          };

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          console.error("[API Chat] processing error:", {
            name: error instanceof Error ? error.name : "Unknown",
            message: errorMsg,
          });

          const result: ChatResponse = {
            ok: false,
            error: "No se pudo procesar tu mensaje",
          };

          return new Response(JSON.stringify(result), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
