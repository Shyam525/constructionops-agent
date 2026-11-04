import { describe, expect, it } from "vitest";
import { triageIssue } from "../src/agent/triage-issue.js";
import type { IssueReport } from "../src/domain/issue.js";

const baseReport: IssueReport = {
  projectId: "demo-project",
  siteId: "demo-site",
  title: "Material shortage on floor 3",
  description: "The planned cement delivery has not arrived and the team is waiting.",
  location: "Floor 3, east wing",
  reporterName: "Site engineer"
};

describe("triageIssue", () => {
  it("routes a potential safety incident to the safety officer as critical", async () => {
    const result = await triageIssue({
      ...baseReport,
      title: "Near miss beside crane",
      description: "A suspended load passed close to workers. No injury reported."
    });

    expect(result.category).toBe("safety");
    expect(result.priority).toBe("critical");
    expect(result.suggestedOwnerRole).toBe("safety_officer");
    expect(result.escalationRequired).toBe(true);
    expect(result.humanReviewRequired).toBe(true);
  });

  it("routes material problems to procurement", async () => {
    const result = await triageIssue(baseReport);

    expect(result.category).toBe("materials");
    expect(result.suggestedOwnerRole).toBe("procurement_manager");
    expect(result.escalationRequired).toBe(false);
  });

  it("accepts the report reporter field used by the example payload", async () => {
    const result = await triageIssue({
      ...baseReport,
      reporter: "Field engineer"
    } as any);

    expect(result.category).toBe("materials");
    expect(result.suggestedOwnerRole).toBe("procurement_manager");
  });

  it("rejects an unknown project/site pair", async () => {
    await expect(
      triageIssue({ ...baseReport, projectId: "unknown-project" })
    ).rejects.toThrow("Unknown project/site pair");
  });
});
