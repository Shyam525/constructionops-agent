import type { IssueRepository } from "../../domain/issue-repository.js";
import type { IssueReport, IssueTriage } from "../../domain/issue.js";

export class PostgresIssueRepository implements IssueRepository {
  async saveIssue(_report: IssueReport, triage: IssueTriage): Promise<IssueTriage> {
    return triage;
  }
}
