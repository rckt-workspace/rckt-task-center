import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMMessage } from "./llm-types";
import { initializeLLMProvider } from "./openrouter.provider.server";
import {
  EstimationResultSchema,
  type EstimationResult,
  type TeamMemberContext,
  type MemberWorkload,
} from "@/types/team-member-context";

export interface EstimationRequest {
  member_id: string;
  member_name: string;
  original_message: string;
  task_description?: string;
  task_client?: string;
  task_area?: string;
  context: TeamMemberContext | null;
  workload: MemberWorkload | null;
  conversation_history?: LLMMessage[] | undefined;
}

export async function estimateTaskForMember(
  request: EstimationRequest,
): Promise<EstimationResult> {
  console.log("[Estimation] starting estimation for member:", request.member_id);

  const llmProvider = await initializeLLMProvider();
  const model = process.env["CHAT_PRIMARY_LLM"] || "openrouter/free";

  // Build estimation prompt
  const prompt = buildEstimationPrompt(request);

  // Request JSON response from LLM
  const messages: LLMMessage[] = [
    ...(request.conversation_history || []),
    {
      role: "user",
      content: prompt,
    },
  ];

  console.log("[Estimation] calling LLM for estimation");

  try {
    const response = await llmProvider.chat({
      model,
      messages,
      temperature: 0.3, // Lower temperature for consistency
      max_tokens: 1500,
    });

    console.log("[Estimation] LLM response received");

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Estimation] no JSON found in response");
      throw new Error("LLM did not return valid JSON");
    }

    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Validate with Zod
    const validated = EstimationResultSchema.parse(parsed);
    console.log("[Estimation] estimation validated successfully");

    return validated;
  } catch (error) {
    console.error("[Estimation] LLM call failed:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function buildEstimationPrompt(request: EstimationRequest): string {
  const lines: string[] = [
    "Eres un experto en estimación técnica de tareas de software.",
    "Tu tarea es estimar cuánto tiempo debería tomar una tarea para un integrante específico del equipo.",
    "",
    "IMPORTANTE:",
    "- NO inventar datos. Si no hay información, reportar en missing_information.",
    "- Diferenciar ESFUERZO (horas reales de trabajo) vs VENTANA (días hábiles para planificación).",
    "- Considerar carga actual, deadlines próximos y bloqueos.",
    "- Si capacity_hours_per_week es null, NO asumir 40 horas.",
    "- Responder ÚNICAMENTE con JSON válido, sin texto adicional.",
    "",
    "CONTEXTO DEL INTEGRANTE:",
  ];

  if (request.context) {
    lines.push(`Nombre: ${request.member_name}`);
    lines.push(`Rol: ${request.context.role_title || "no especificado"}`);
    lines.push(
      `Especialidades: ${request.context.specialties?.join(", ") || "no especificadas"}`,
    );
    lines.push(
      `Responsabilidades: ${request.context.responsibilities?.join(", ") || "no especificadas"}`,
    );
    lines.push(
      `Fortalezas: ${request.context.strengths?.join(", ") || "no especificadas"}`,
    );
    lines.push(
      `Tipo de trabajo habitual: ${request.context.typical_work?.join(", ") || "no especificado"}`,
    );

    if (request.context.capacity_hours_per_week !== null) {
      lines.push(`Capacidad declarada: ${request.context.capacity_hours_per_week} horas/semana`);
    } else {
      lines.push("Capacidad declarada: NO DEFINIDA");
    }

    if (request.context.estimation_notes) {
      lines.push(`Notas para estimación: ${request.context.estimation_notes}`);
    }
  } else {
    lines.push("NO HAY CONTEXTO DISPONIBLE");
  }

  lines.push("");
  lines.push("CARGA ACTUAL:");

  if (request.workload) {
    lines.push(`Tareas activas: ${request.workload.active_task_count}`);
    lines.push(`  - Pendientes: ${request.workload.pending_task_count}`);
    lines.push(`  - En curso: ${request.workload.in_progress_task_count}`);
    lines.push(`  - Atrasadas: ${request.workload.overdue_task_count}`);

    if (request.workload.upcoming_deadlines && request.workload.upcoming_deadlines.length > 0) {
      lines.push(
        `Próximos vencimientos: ${request.workload.upcoming_deadlines.slice(0, 3).join(", ")}`,
      );
    }

    if (request.workload.nearest_deadline) {
      lines.push(`Próximo vencimiento más cercano: ${request.workload.nearest_deadline}`);
    }

    if (request.workload.is_blocked) {
      lines.push("⚠️ BLOQUEADO: Usuario está en período de bloqueo/vacaciones");
    }
  } else {
    lines.push("NO HAY INFORMACIÓN DE CARGA DISPONIBLE");
  }

  lines.push("");
  lines.push("SOLICITUD ORIGINAL:");
  lines.push(`"${request.original_message}"`);

  lines.push("");
  lines.push("NUEVA TAREA:");
  if (request.task_description) {
    lines.push(`Descripción extraída: ${request.task_description}`);
  }

  if (request.task_client) {
    lines.push(`Cliente: ${request.task_client}`);
  }

  if (request.task_area) {
    lines.push(`Área: ${request.task_area}`);
  }

  lines.push("");
  lines.push("ESTIMACIÓN REQUERIDA:");
  lines.push("Responde con un JSON válido (y SOLO JSON, sin markdown ni texto adicional):");
  lines.push("");
  lines.push("```json");
  lines.push("{");
  lines.push('  "effort_hours_min": number | null,');
  lines.push('  "effort_hours_max": number | null,');
  lines.push('  "recommended_days_min": number (días hábiles, mínimo 1),');
  lines.push('  "recommended_days_max": number (días hábiles),');
  lines.push('  "confidence": "high" | "medium" | "low",');
  lines.push('  "reasons": ["razón 1", "razón 2", ...],');
  lines.push('  "risks": ["riesgo 1", "riesgo 2", ...],');
  lines.push('  "missing_information": ["info faltante 1", ...]');
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("DIFERENCIA CRÍTICA:");
  lines.push("- ESFUERZO: horas reales de trabajo efectivo");
  lines.push("- VENTANA: días hábiles de calendario recomendados para planificación");
  lines.push("- NO son equivalentes (8 horas ≠ 1 día automáticamente)");
  lines.push("");
  lines.push("IMPORTANTE:");
  lines.push("- Si capacity_hours_per_week es NULL → incluir 'Capacidad semanal no definida' en missing_information");
  lines.push("- Considerar carga actual y próximos vencimientos");
  lines.push("- NO asumir capacidad si es NULL");
  lines.push("- Aumentar incertidumbre (confidence: medium/low) si faltan datos críticos");
  lines.push("- NO dejes reasons vacío - siempre explicar por qué ese rango");

  return lines.join("\n");
}
