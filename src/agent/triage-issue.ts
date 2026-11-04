import { randomUUID } from "node:crypto";
import { demoActor, normalizeActor, type AuthenticatedActor } from "../auth.js";
import type { IssueReport, IssueTriage } from "../domain/issue.js";
import { getProjectContext } from "../tools/project-context.js";

const safetySignals = [
  /injur(y|ed)/i,
  /fall(ing|en)?/i,
  /fire|smoke|explosion/i,
  /electric shock|exposed wire|live wire/i,
  /gas leak/i,
  /collapse|structural failure/i,
  /near miss/i,
  /unsafe condition/i,
  /crane.*(swing|load|failure)|suspended load/i
];

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function classify(report: IssueReport): Pick<
  IssueTriage,
  "category" | "priority" | "suggestedOwnerRole" | "reason" | "recommendedActions" | "escalationRequired"
> {
  const text = `${report.title}\n${report.description}`;

  // Safety signals take precedence. This is conservative routing, not a safety assessment.
  if (containsAny(text, safetySignals)) {
    return {
      category: "safety",
      priority: "critical",
      suggestedOwnerRole: "safety_officer",
      reason: "The report contains a potential life-safety signal and requires immediate review by qualified site personnel.",
      recommendedActions: [
        "Follow the site's emergency and stop-work procedures where applicable.",
        "Notify the designated site safety officer immediately.",
        "Keep people away from the reported hazard until qualified personnel assess it.",
        "Record the assessment and corrective action in the site's official system."
      ],
      escalationRequired: true
    };
  }

  if (containsAny(text, [/crack|dimension|measurement|rework|defect|poor finish|out of tolerance/i])) {
    return {
      category: "quality",
      priority: "high",
      suggestedOwnerRole: "quality_manager",
      reason: "The report appears to describe a workmanship, defect, or specification issue.",
      recommendedActions: [
        "Have the quality team inspect the exact location.",
        "Compare the observed condition with the approved drawings and acceptance criteria.",
        "Record evidence and agree on corrective work before closing the issue."
      ],
      escalationRequired: false
    };
  }

  if (containsAny(text, [/delay|behind schedule|blocked|critical path|missed milestone/i])) {
    return {
      category: "schedule",
      priority: "high",
      suggestedOwnerRole: "site_manager",
      reason: "The report appears to describe a schedule constraint or blocked activity.",
      recommendedActions: [
        "Identify the affected activity and its dependency.",
        "Ask the site manager to confirm the schedule impact.",
        "Record the recovery action and owner in the project schedule."
      ],
      escalationRequired: false
    };
  }

  if (containsAny(text, [/shortage|out of stock|not delivered|missing material|material supply/i])) {
    return {
      category: "materials",
      priority: "medium",
      suggestedOwnerRole: "procurement_manager",
      reason: "The report appears to describe a material availability or delivery problem.",
      recommendedActions: [
        "Confirm the required material, quantity, and need-by date.",
        "Check the purchase order and supplier delivery status.",
        "Tell the site manager whether the issue affects planned work."
      ],
      escalationRequired: false
    };
  }

  if (containsAny(text, [/machine|equipment|excavator|crane|generator|pump|vehicle|breakdown/i])) {
    return {
      category: "equipment",
      priority: "medium",
      suggestedOwnerRole: "equipment_manager",
      reason: "The report appears to describe an equipment availability or maintenance problem.",
      recommendedActions: [
        "Confirm the equipment ID and current operating status.",
        "Ask the responsible equipment person to inspect it.",
        "Record the repair or replacement plan and expected return-to-service time."
      ],
      escalationRequired: false
    };
  }

  return {
    category: "other",
    priority: "low",
    suggestedOwnerRole: "site_manager",
    reason: "There is not enough structured evidence to confidently classify this report.",
    recommendedActions: [
      "Ask the reporter for missing details, photos, and the exact affected location.",
      "Have the site manager review and assign the issue to the correct discipline."
    ],
    escalationRequired: false
  };
}

export async function triageIssue(
  report: IssueReport,
  actor: Partial<AuthenticatedActor> | null | undefined = demoActor
): Promise<IssueTriage> {
  const authenticatedActor = normalizeActor(actor) ?? demoActor;
  const context = await getProjectContext(report.projectId, report.siteId, authenticatedActor);
  if (!context) {
    throw new Error("Unknown project/site pair. Add the project to the context adapter first.");
  }

  const classification = classify(report);
  if (!context.availableOwnerRoles.includes(classification.suggestedOwnerRole)) {
    throw new Error(`Suggested owner role is not configured for ${context.projectName}.`);
  }

  return {
    issueId: randomUUID(),
    projectId: report.projectId,
    siteId: report.siteId,
    ...classification,
    humanReviewRequired: true,
    limitations:
      "This starter uses transparent keyword rules, not an LLM or a certified safety process. It does not create work orders, contact people, stop equipment, or replace the site's approved procedures. A qualified human must review every recommendation."
  };
}
