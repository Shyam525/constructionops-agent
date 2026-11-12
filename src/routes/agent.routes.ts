import { Router } from "express";
import { issueReportSchema } from "../domain/issue.js";
import { triageIssue } from "../agent/triage-issue.js";
import type { ProjectContextProvider } from "../domain/project-context.js";
import { defaultProjectContextProvider } from "../tools/project-context.js";

export interface AgentRouterOptions {
  projectContextProvider?: ProjectContextProvider;
}

export function createAgentRouter(options: AgentRouterOptions = {}): Router {
  const router = Router();
  const contextProvider = options.projectContextProvider ?? defaultProjectContextProvider;

  router.post("/triage", async (req, res) => {
    const actor = req.actor;
    if (!actor) {
      res.status(401).json({ error: "Unauthorized: Missing authenticated actor" });
      return;
    }

    const parsed = issueReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid issue report",
        details: parsed.error.flatten()
      });
      return;
    }

    try {
      const result = await triageIssue(parsed.data, actor, contextProvider);
      res.status(200).json({ data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      if (message.startsWith("Unknown project/site pair") || message.includes("access denied")) {
        res.status(404).json({ error: "Unknown project/site pair or access denied." });
        return;
      }
      if (message.startsWith("Suggested owner role is not configured")) {
        res.status(422).json({ error: message });
        return;
      }
      // Do not expose database exceptions or internal stack traces to clients
      res.status(500).json({ error: "Internal server error while triaging issue." });
    }
  });

  return router;
}

export const agentRouter = createAgentRouter();
