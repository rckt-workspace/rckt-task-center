import { z } from "zod";

export const EstimationResultSchema = z
  .object({
    effort_hours_min: z.number().nullable(),
    effort_hours_max: z.number().nullable(),
    recommended_days_min: z.number().int().min(1),
    recommended_days_max: z.number().int().min(1),
    confidence: z.enum(["high", "medium", "low"]),
    reasons: z.array(z.string()).min(1),
    risks: z.array(z.string()),
    missing_information: z.array(z.string()),
  })
  .refine(
    (data) => data.recommended_days_min <= data.recommended_days_max,
    {
      message: "recommended_days_min must be <= recommended_days_max",
      path: ["recommended_days_min"],
    },
  )
  .refine(
    (data) => {
      // If both hours are defined, validate range
      if (data.effort_hours_min !== null && data.effort_hours_max !== null) {
        return (
          data.effort_hours_min >= 0 &&
          data.effort_hours_max >= 0 &&
          data.effort_hours_min <= data.effort_hours_max
        );
      }
      // If only one is defined, validate >= 0
      if (data.effort_hours_min !== null) {
        return data.effort_hours_min >= 0;
      }
      if (data.effort_hours_max !== null) {
        return data.effort_hours_max >= 0;
      }
      return true;
    },
    {
      message: "effort_hours must be non-negative and in valid range",
      path: ["effort_hours_min"],
    },
  );

export type EstimationResult = z.infer<typeof EstimationResultSchema>;

export const TeamMemberContextSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  role_title: z.string().nullable(),
  role_summary: z.string().nullable(),
  specialties: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  typical_work: z.array(z.string()).default([]),
  capacity_hours_per_week: z.number().nullable(),
  blocked_dates: z.array(z.string()).default([]),
  estimation_notes: z.string().nullable(),
  collaboration_notes: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TeamMemberContext = z.infer<typeof TeamMemberContextSchema>;

export const MemberWorkloadSchema = z.object({
  member_id: z.string().uuid(),
  active_task_count: z.number(),
  pending_task_count: z.number(),
  in_progress_task_count: z.number(),
  overdue_task_count: z.number(),
  upcoming_deadlines: z.array(z.string()),
  nearest_deadline: z.string().nullable(),
  is_blocked: z.boolean(),
});

export type MemberWorkload = z.infer<typeof MemberWorkloadSchema>;
