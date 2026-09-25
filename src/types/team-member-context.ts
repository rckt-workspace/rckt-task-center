import { z } from "zod";

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
