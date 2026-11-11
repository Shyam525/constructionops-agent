export type IssueCategory =
  | "materials"
  | "equipment"
  | "labor"
  | "quality"
  | "safety"
  | "schedule"
  | "other";

export type IssuePriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type OwnerRole =
  | "site_engineer"
  | "procurement_manager"
  | "equipment_manager"
  | "safety_officer"
  | "project_manager"
  | "unknown";

export interface TriageResult {
  category: IssueCategory;

  priority: IssuePriority;

  ownerRole: OwnerRole;

  summary: string;

  rationale: string[];

  recommendedActions: string[];

  missingInformation: string[];

  safetyConcern: boolean;

  requiresHumanReview: true;
}

