import { z } from "zod";

export const issueReportSchema = z.object({
  projectId: z.string().trim().min(1),
  siteId: z.string().trim().min(1),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  location: z.string().trim().min(1).max(200),
  reporterName: z.string().trim().min(1).max(120),
  reportedAt: z.string().datetime().optional()
});

export type IssueReport = z.infer<typeof issueReportSchema>;

export const issueTriageSchema = z.object({
  issueId: z.string().uuid(),
  projectId: z.string(),
  siteId: z.string(),
  category: z.enum(["safety", "quality", "schedule", "materials", "equipment", "other"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  suggestedOwnerRole: z.enum([
    "safety_officer",
    "quality_manager",
    "site_manager",
    "procurement_manager",
    "equipment_manager"
  ]),
  reason: z.string(),
  recommendedActions: z.array(z.string()).min(1),
  escalationRequired: z.boolean(),
  humanReviewRequired: z.literal(true),
  limitations: z.string()
});

export type IssueTriage = z.infer<typeof issueTriageSchema>;
