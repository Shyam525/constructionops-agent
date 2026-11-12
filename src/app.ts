import express, { type Express, type Request, type RequestHandler } from "express";
import { clerkMiddleware } from "@clerk/express";
import { createPostgresDatabase, type PostgresDatabase } from "./adapters/postgres/database.js";
import { PostgresUserRepository } from "./adapters/postgres/user-repository.js";
import { PostgresProjectContextProvider } from "./adapters/postgres/project-context-provider.js";
import type { UserRepository } from "./domain/user-repository.js";
import type { ProjectContextProvider } from "./domain/project-context.js";
import { createAuthenticateMiddleware } from "./middleware/authenticate.js";
import { createAgentRouter } from "./routes/agent.routes.js";
import { defaultProjectContextProvider } from "./tools/project-context.js";

export interface AppDependencies {
  db?: PostgresDatabase | null;
  userRepository?: UserRepository;
  projectContextProvider?: ProjectContextProvider;
  clerkMiddlewareHandler?: RequestHandler;
  getAuthFn?: (req: Request) => { userId?: string | null } | null | undefined;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();

  // 1. Register Clerk middleware first as required by Clerk Express documentation
  if (deps.clerkMiddlewareHandler) {
    app.use(deps.clerkMiddlewareHandler);
  } else if (process.env.CLERK_SECRET_KEY) {
    app.use(clerkMiddleware());
  } else {
    // Pass-through when Clerk keys are not set in the environment
    app.use((_req, _res, next) => next());
  }

  // 2. Standard body parser
  app.use(express.json({ limit: "1mb" }));

  // 3. Public health check endpoint
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "constructionops-agent" });
  });

  // 4. Resolve shared database pool and adapters
  const db = deps.db !== undefined ? deps.db : createPostgresDatabase();

  const userRepository: UserRepository =
    deps.userRepository ??
    (db
      ? new PostgresUserRepository(db)
      : {
          // If no database is configured, reject user lookups securely
          async findActorByClerkUserId() {
            return null;
          }
        });

  const projectContextProvider: ProjectContextProvider =
    deps.projectContextProvider ??
    (db ? new PostgresProjectContextProvider(db) : defaultProjectContextProvider);

  // 5. Authentication middleware and protected agent routes
  const authenticateMiddleware = createAuthenticateMiddleware({
    userRepository,
    getAuthFn: deps.getAuthFn
  });

  const agentRouter = createAgentRouter({
    projectContextProvider
  });

  app.use("/api/agent", authenticateMiddleware, agentRouter);

  // 6. Catch-all 404
  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  return app;
}

export const app = createApp();
