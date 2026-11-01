import express from "express";
import { agentRouter } from "./routes/agent.routes.js";

export const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "constructionops-agent" });
});

app.use("/api/agent", agentRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});
