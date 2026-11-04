import type { IssueReport, IssueTriage } from "./issue.js";

export interface IssueRepository {
  saveIssue(report: IssueReport, triage: IssueTriage): Promise<IssueTriage>;
}
