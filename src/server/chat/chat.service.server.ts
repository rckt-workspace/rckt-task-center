import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMMessage, LLMRequest } from "../llm/types";
import { initializeLLMProvider } from "../llm/openrouter.provider.server";
import { buildUserContext, formatTasksForContext } from "./context.service.server";
import { getSystemPrompt } from "./system.prompt";

export interface ChatRequest {
  message: string;
  conversationHistory?: LLMMessage[];
}

export interface ChatResponse {
  reply: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
  };
}

export async function processChat(
  supabase: SupabaseClient,
  userId: string,
  request: ChatRequest,
): Promise<ChatResponse> {
  // Build user context with RLS-respecting queries
  const userContext = await buildUserContext(supabase, userId);
  console.log(`[Chat] visible tasks: ${userContext.tasks.length}`);

  // Initialize LLM provider
  console.log("[Chat] OpenRouter request started");
  const llmProvider = await initializeLLMProvider();

  // Build system prompt
  const systemPrompt = getSystemPrompt(userContext.isAdmin);

  // Format tasks for context window
  const tasksContext = formatTasksForContext(userContext.tasks, userContext.isAdmin);

  // Build messages for LLM
  const enrichedSystemPrompt = `${systemPrompt}

CONTEXTO DEL USUARIO:
Nombre: ${userContext.fullName}
Email: ${userContext.email}
Rol: ${userContext.isAdmin ? "Administrador" : "Colaborador"}

TAREAS DISPONIBLES:
${tasksContext}`;

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: enrichedSystemPrompt,
    },
    ...(request.conversationHistory || []),
    {
      role: "user",
      content: request.message,
    },
  ];

  // Prepare LLM request
  const temperature = parseFloat(process.env["CHAT_TEMPERATURE"] || "0.2");
  const model = process.env["CHAT_PRIMARY_LLM"] || "openrouter/free";

  const llmRequest: LLMRequest = {
    model,
    messages,
    temperature,
    max_tokens: 1024,
  };

  // Call LLM
  try {
    const reply = await llmProvider.chat(llmRequest);
    console.log("[Chat] OpenRouter response received");

    return {
      reply,
    };
  } catch (error) {
    console.error("[Chat] OpenRouter failure:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
