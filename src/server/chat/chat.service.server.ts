import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMMessage, LLMRequest } from "../llm/types";
import { initializeLLMProvider } from "../llm/openrouter.provider.server";
import {
  buildUserContext,
  formatTasksForContext,
  formatTeamMemberContextForAgent,
  formatMemberWorkloadForAgent,
  formatTeamContextForAgent,
} from "./context.service.server";
import {
  loadTeamMemberContext,
  loadMemberWorkload,
} from "./team-context.service.server";
import { getSystemPrompt } from "./system.prompt";
import { estimateTaskForMember, type EstimationRequest } from "./estimation.service.server";
import { addBusinessDays, getBogotaToday } from "./business-days.server";
import type { TeamMemberWithProfile } from "@/types/team-member-context";

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

function isEstimationRequest(message: string): boolean {
  // Temporary heuristic for MVP.
  // Future: replace with structured intent classification.
  const keywords = [
    "cuánto tiempo",
    "cuanto tiempo",
    "plazo",
    "estimación",
    "estimacion",
    "estimar",
    "cuántos días",
    "cuantos dias",
    "cuándo terminar",
    "cuando terminar",
    "ventana de tiempo",
    "esfuerzo",
  ];

  const lowerMessage = message.toLowerCase();
  return keywords.some((kw) => lowerMessage.includes(kw));
}

function extractMemberNameFromMessage(message: string, teamMembers: TeamMemberWithProfile[]): TeamMemberWithProfile | null {
  const lowerMessage = message.toLowerCase();

  for (const member of teamMembers) {
    const firstName = member.fullName.split(" ")[0].toLowerCase();
    const fullNameLower = member.fullName.toLowerCase();

    if (lowerMessage.includes(fullNameLower) || lowerMessage.includes(firstName)) {
      return member;
    }
  }

  return null;
}

function formatEstimationResponse(result: any): string {
  const lines: string[] = [];

  lines.push("**ESTIMACIÓN DE TAREA**\n");

  if (result.effort_hours_min !== null && result.effort_hours_max !== null) {
    lines.push(`📊 **Esfuerzo estimado:** ${result.effort_hours_min}-${result.effort_hours_max} horas`);
  } else if (result.effort_hours_min !== null) {
    lines.push(`📊 **Esfuerzo estimado:** ~${result.effort_hours_min} horas`);
  } else {
    lines.push("📊 **Esfuerzo:** No determinado (información insuficiente)");
  }

  lines.push(
    `📅 **Ventana recomendada:** ${result.recommended_days_min}-${result.recommended_days_max} días hábiles`,
  );

  // Calculate suggested deadline using recommended_days_max (safer planning estimate)
  const today = getBogotaToday();
  const suggestedDeadline = addBusinessDays(today, result.recommended_days_max);
  lines.push(`🎯 **Plazo sugerido:** ${suggestedDeadline}`);

  lines.push(`🎯 **Confianza:** ${result.confidence === "high" ? "Alta" : result.confidence === "medium" ? "Media" : "Baja"}`);

  if (result.reasons && result.reasons.length > 0) {
    lines.push("\n**Razones:**");
    result.reasons.forEach((r: string) => {
      lines.push(`- ${r}`);
    });
  }

  if (result.risks && result.risks.length > 0) {
    lines.push("\n**Riesgos identificados:**");
    result.risks.forEach((r: string) => {
      lines.push(`- ⚠️ ${r}`);
    });
  }

  if (result.missing_information && result.missing_information.length > 0) {
    lines.push("\n**Información faltante:**");
    result.missing_information.forEach((m: string) => {
      lines.push(`- ❓ ${m}`);
    });
  }

  return lines.join("\n");
}

export async function processChat(
  supabase: SupabaseClient,
  userId: string,
  request: ChatRequest,
): Promise<ChatResponse> {
  // Build user context with RLS-respecting queries
  const userContext = await buildUserContext(supabase, userId);
  console.log(`[Chat] visible tasks: ${userContext.tasks.length}`);

  // Check if this is an estimation request (only for admin)
  if (isEstimationRequest(request.message) && userContext.isAdmin) {
    console.log("[Chat] estimation request detected");

    const targetMember = extractMemberNameFromMessage(request.message, userContext.teamMembers);

    if (targetMember) {
      console.log("[Chat] target member identified:", targetMember.fullName);

      try {
        // Load context and workload for target member
        const context = await loadTeamMemberContext(supabase, targetMember.context.user_id);
        const workload = await loadMemberWorkload(supabase, targetMember.context.user_id);

        const estimationRequest: EstimationRequest = {
          member_id: targetMember.context.user_id,
          member_name: targetMember.fullName,
          original_message: request.message,
          context,
          workload,
          conversation_history: request.conversationHistory,
        };

        console.log("[Chat] calling estimation service");
        const estimation = await estimateTaskForMember(estimationRequest);

        const formattedEstimation = formatEstimationResponse(estimation);

        return {
          reply: formattedEstimation,
        };
      } catch (error) {
        console.error("[Chat] estimation failed:", {
          message: error instanceof Error ? error.message : String(error),
        });

        return {
          reply: `Hubo un error al estimar la tarea: ${error instanceof Error ? error.message : "Error desconocido"}`,
        };
      }
    } else {
      return {
        reply: "No pude identificar a qué integrante te refieres. Menciona el nombre completo (ej: 'Jaime', 'Sofía').",
      };
    }
  }

  // Initialize LLM provider
  console.log("[Chat] OpenRouter request started");
  const llmProvider = await initializeLLMProvider();

  // Build system prompt
  const systemPrompt = getSystemPrompt(userContext.isAdmin);

  // Format tasks for context window
  const tasksContext = formatTasksForContext(userContext.tasks, userContext.isAdmin);

  // Format team member context
  const teamMemberContext = formatTeamMemberContextForAgent(
    userContext.teamMemberContext,
  );
  const memberWorkload = formatMemberWorkloadForAgent(userContext.memberWorkload);

  // Format team context for admin
  const teamContextSection = userContext.isAdmin
    ? `

CONTEXTO DEL EQUIPO:
${formatTeamContextForAgent(userContext.teamMembers, userContext.teamWorkloads)}`
    : "";

  // Build messages for LLM
  const enrichedSystemPrompt = `${systemPrompt}

CONTEXTO DEL USUARIO:
Nombre: ${userContext.fullName}
Email: ${userContext.email}
Rol: ${userContext.isAdmin ? "Administrador" : "Colaborador"}

CONTEXTO PROFESIONAL:
${teamMemberContext}

CARGA ACTUAL:
${memberWorkload}${teamContextSection}

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
