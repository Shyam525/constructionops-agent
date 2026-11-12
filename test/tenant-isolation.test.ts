import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp } from "../src/app.js";
import type { UserRepository } from "../src/domain/user-repository.js";
import type { ProjectContextProvider, ProjectContext } from "../src/domain/project-context.js";
import type { AuthenticatedActor } from "../src/auth.js";

interface RunningServer {
  server: Server;
  url: string;
}

async function startServer(app: ReturnType<typeof createApp>): Promise<RunningServer> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to obtain port for test server");
  }
  return {
    server,
    url: `http://localhost:${address.port}`
  };
}

describe("Tenant Isolation and API Security", () => {
  let activeServer: RunningServer | null = null;

  afterEach(async () => {
    if (activeServer) {
      await new Promise<void>((resolve, reject) => {
        activeServer!.server.close((err) => (err ? reject(err) : resolve()));
      });
      activeServer = null;
    }
  });

  it("permits public access to /health without credentials", async () => {
    const app = createApp();
    activeServer = await startServer(app);

    const res = await fetch(`${activeServer.url}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "constructionops-agent" });
  });

  it("returns 401 when calling /api/agent/triage without authentication", async () => {
    const app = createApp({
      getAuthFn: () => ({ userId: null })
    });
    activeServer = await startServer(app);

    const res = await fetch(`${activeServer.url}/api/agent/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        siteId: "site-1",
        title: "Broken ladder on east scaffold",
        description: "Workers noticed broken rungs on the main scaffold ladder.",
        location: "East Wing",
        reporterName: "Site Engineer"
      })
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
  });

  it("returns 403 when an authenticated Clerk user has no internal tenant mapping", async () => {
    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(null)
    };
    const app = createApp({
      userRepository,
      getAuthFn: () => ({ userId: "clerk_unknown_user" })
    });
    activeServer = await startServer(app);

    const res = await fetch(`${activeServer.url}/api/agent/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        siteId: "site-1",
        title: "Delayed cement mixer",
        description: "The concrete mixer broke down this morning.",
        location: "Foundation",
        reporterName: "Site Engineer"
      })
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Forbidden/i);
  });

  it("allows triage when user has verified project membership in their tenant", async () => {
    const tenantUser: AuthenticatedActor = {
      userId: "user_alice",
      tenantId: "tenant_alpha"
    };

    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(tenantUser)
    };

    const projectContextProvider: ProjectContextProvider = {
      getProjectContext: vi.fn().mockImplementation(async (actor, projectId, siteId) => {
        if (
          actor.tenantId === "tenant_alpha" &&
          actor.userId === "user_alice" &&
          projectId === "project_alpha_tower" &&
          siteId === "site_north"
        ) {
          return {
            projectId: "project_alpha_tower",
            projectName: "Alpha Commercial Tower",
            siteId: "site_north",
            siteName: "North Foundation",
            availableOwnerRoles: ["safety_officer", "quality_manager", "procurement_manager", "site_manager"]
          };
        }
        return null;
      })
    };

    const app = createApp({
      userRepository,
      projectContextProvider,
      getAuthFn: () => ({ userId: "clerk_alice" })
    });
    activeServer = await startServer(app);

    const res = await fetch(`${activeServer.url}/api/agent/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project_alpha_tower",
        siteId: "site_north",
        title: "Material shortage on site",
        description: "The cement shipment was not delivered and workers are waiting.",
        location: "Level 1",
        reporterName: "Alice Site Engineer"
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.category).toBe("materials");
    expect(data.data.suggestedOwnerRole).toBe("procurement_manager");
    expect(data.data.humanReviewRequired).toBe(true);
  });

  it("denies access (404 concealed) when user is not a member of the requested project", async () => {
    const tenantUser: AuthenticatedActor = {
      userId: "user_alice",
      tenantId: "tenant_alpha"
    };

    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(tenantUser)
    };

    const projectContextProvider: ProjectContextProvider = {
      // Alice is not a member of project_beta_bridge, so provider returns null
      getProjectContext: vi.fn().mockResolvedValue(null)
    };

    const app = createApp({
      userRepository,
      projectContextProvider,
      getAuthFn: () => ({ userId: "clerk_alice" })
    });
    activeServer = await startServer(app);

    const res = await fetch(`${activeServer.url}/api/agent/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project_beta_bridge",
        siteId: "site_south",
        title: "Steel reinforcement issue",
        description: "Rebar spacing does not conform to drawings.",
        location: "Pier 4",
        reporterName: "Alice Site Engineer"
      })
    });

    // Concealed 404 to avoid exposing project existence to non-members
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/Unknown project\/site pair or access denied/i);
  });

  it("denies access (404 concealed) when attempting cross-tenant project access", async () => {
    const tenantUser: AuthenticatedActor = {
      userId: "user_alice",
      tenantId: "tenant_alpha"
    };

    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(tenantUser)
    };

    const projectContextProvider: ProjectContextProvider = {
      getProjectContext: vi.fn().mockImplementation(async (actor, projectId) => {
        // Project belongs to tenant_omega, user is in tenant_alpha -> denied
        if (projectId === "project_omega" && actor.tenantId !== "tenant_omega") {
          return null;
        }
        return null;
      })
    };

    const app = createApp({
      userRepository,
      projectContextProvider,
      getAuthFn: () => ({ userId: "clerk_alice" })
    });
    activeServer = await startServer(app);

    const res = await fetch(`${activeServer.url}/api/agent/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project_omega",
        siteId: "site_omega_main",
        title: "Excavator breakdown",
        description: "Hydraulic hose burst on main excavator.",
        location: "Pit 2",
        reporterName: "Alice Site Engineer"
      })
    });

    expect(res.status).toBe(404);
  });

  it("returns a controlled 500 without leaking error details when project context fails", async () => {
    const tenantUser: AuthenticatedActor = {
      userId: "user_alice",
      tenantId: "tenant_alpha"
    };

    const userRepository: UserRepository = {
      findActorByClerkUserId: vi.fn().mockResolvedValue(tenantUser)
    };

    const projectContextProvider: ProjectContextProvider = {
      getProjectContext: vi.fn().mockRejectedValue(new Error("FATAL: relation 'projects' does not exist"))
    };

    const app = createApp({
      userRepository,
      projectContextProvider,
      getAuthFn: () => ({ userId: "clerk_alice" })
    });
    activeServer = await startServer(app);

    const res = await fetch(`${activeServer.url}/api/agent/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project_alpha_tower",
        siteId: "site_north",
        title: "Crane wire fraying",
        description: "Suspended crane load wire shows visible fraying.",
        location: "Tower Crane 1",
        reporterName: "Alice Site Engineer"
      })
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    // Verify database error was NOT leaked
    expect(data.error).toBe("Internal server error while triaging issue.");
    expect(JSON.stringify(data)).not.toContain("relation 'projects'");
  });
});
