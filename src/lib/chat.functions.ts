import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LLMMessage } from "@/lib/chat-core/llm-types";

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .optional(),
  accessToken: z.string().min(1),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => chatSchema.parse(data))
  .handler(async ({ data: { message, conversationHistory, accessToken } }) => {
    try {
      const { createAuthenticatedSupabaseClient } = await import(
        "@/integrations/supabase/auth-client.server"
      );
      const { processChat } = await import("@/lib/chat-core/chat.service.server");
      const { client: supabase, userId } = await createAuthenticatedSupabaseClient(accessToken);
      const response = await processChat(supabase, userId, {
        message,
        conversationHistory: (conversationHistory as LLMMessage[]) || [],
      });
      return { ok: true as const, reply: response.reply };
    } catch (error) {
      console.error("[Chat] Error:", error);
      return {
        ok: false as const,
        error: "No se pudo procesar tu mensaje. Por favor intenta de nuevo.",
      };
    }
  });
