import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createAuthenticatedSupabaseClient } from "@/integrations/supabase/auth-client.server";
import { processChat } from "@/server/chat/chat.service.server";
import type { LLMMessage } from "@/server/llm/types";

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
  .validator((data: unknown) => chatSchema.parse(data))
  .handler(async ({ data: { message, conversationHistory, accessToken } }) => {
    try {
      console.log("[Chat] request received");

      const { client: supabase, userId } = await createAuthenticatedSupabaseClient(accessToken);

      console.log(`[Chat] authenticated user: ${userId}`);

      const response = await processChat(supabase, userId, {
        message,
        conversationHistory: (conversationHistory as LLMMessage[]) || [],
      });

      console.log("[Chat] response sent successfully");

      return {
        ok: true,
        reply: response.reply,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Chat] Error: ${errorMsg}`);

      return {
        ok: false,
        error: "No se pudo procesar tu mensaje. Por favor intenta de nuevo.",
      };
    }
  });
