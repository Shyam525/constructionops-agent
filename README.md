# ConstructionOps Agent (TypeScript)

A standalone backend foundation for a construction-site operations agent. The first vertical slice accepts an issue report and returns a transparent triage recommendation.

> **Important:** v0.1 is not an LLM-powered autonomous agent. It uses explicit keyword rules so the API, domain model, context-tool boundary, and tests work before an LLM is introduced. It never creates work orders or contacts people. Every result requires human review. This is not a certified safety system.

## What works in v0.1

- `GET /health` health check.
- `POST /api/agent/triage` validates and triages an issue report.
- A database-ready project-context provider abstraction with a PostgreSQL adapter shell.
- A demo-backed fallback for local development and tests when no database connection is configured.
- Conservative routing for potential safety signals.
- Unit tests for core routing behavior.

## Requirements

- Node.js 22 or newer
- npm
- Git

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

If PowerShell says that `Copy-Item` cannot find `.env`, confirm that your terminal is open in the repository root (the folder containing `package.json`).

The server starts at `http://localhost:3000`.

## Try the API

Health check:

```bash
curl http://localhost:3000/health
```

Triage an issue (PowerShell):

```powershell
$body = @{
  projectId = "demo-project"
  siteId = "demo-site"
  title = "Material shortage on floor 3"
  description = "The planned cement delivery has not arrived and the team is waiting."
  location = "Floor 3, east wing"
  reporterName = "Site engineer"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/agent/triage" -ContentType "application/json" -Body $body
```

Only the demo pair `demo-project` + `demo-site` is configured. Unknown pairs return HTTP 404.

## Verify the project

```bash
npm run typecheck
npm test
npm run build
```

## Repository structure

```text
src/
  agent/       # orchestration and triage policy
  domain/      # validated request and response contracts
  routes/      # HTTP endpoints
  tools/       # read-only context lookup adapter
  app.ts       # Express application
  server.ts    # process entry point
 test/         # unit tests
```

## Architecture

```text
HTTP request
    -> Zod request validation
    -> triageIssue agent function
        -> ProjectContextProvider interface
            -> demo provider for local use
            -> PostgresProjectContextProvider for tenant-aware access checks
        -> explicit classification rules
        -> human-review-required result
    -> HTTP response
```

## Next engineering steps

1. Replace the demo context fixture with a database/API adapter and enforce tenant + project access at that boundary.
2. Add persistence for issue reports, triage results, and audit events.
3. Add an LLM adapter that proposes structured classifications and actions; keep deterministic policy checks outside the model.
4. Add authentication, authorization, rate limits, request IDs, structured logs, and integration tests before exposing the service publicly.
5. Add human approval and audited execution before connecting any write-capable tools.

Do not connect write-capable construction-site tools until authorization, audit logging, idempotency, and human approval are implemented and tested.
