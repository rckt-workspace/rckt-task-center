import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chatSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    try {
      const response = await processChat(supabase, userId, {
        message: data.message,
        conversationHistory: (data.conversationHistory as LLMMessage[]) || [],
      });

      return {
        ok: true,
        reply: response.reply,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`Chat error for user ${userId}: ${errorMsg}`);

      return {
        ok: false,
        error: "No se pudo procesar tu mensaje. Por favor intenta de nuevo.",
      };
    }
  });
