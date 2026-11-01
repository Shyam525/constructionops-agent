import { Router } from "express";
import { issueReportSchema } from "../domain/issue.js";
import { triageIssue } from "../agent/triage-issue.js";

export const agentRouter = Router();

agentRouter.post("/triage", async (req, res) => {
  const parsed = issueReportSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid issue report",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const result = await triageIssue(parsed.data);
    res.status(200).json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message.startsWith("Unknown project/site pair") ? 404 : 500;
    res.status(status).json({ error: message });
  }
});
