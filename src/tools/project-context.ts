import { normalizeActor, type AuthenticatedActor } from "../auth.js";
import type { ProjectContext, ProjectContextProvider } from "../domain/project-context.js";
import { createPostgresDatabase } from "../adapters/postgres/database.js";
import { PostgresProjectContextProvider } from "../adapters/postgres/project-context-provider.js";

export type { ProjectContext, ProjectContextProvider } from "../domain/project-context.js";

export const demoContexts: ProjectContext[] = [
  {
    projectId: "demo-project",
    projectName: "Demo Commercial Tower",
    siteId: "demo-site",
    siteName: "Ahmedabad Demo Site",
    availableOwnerRoles: [
      "safety_officer",
      "quality_manager",
      "site_manager",
      "procurement_manager",
      "equipment_manager"
    ]
  }
];

export class DemoProjectContextProvider implements ProjectContextProvider {
  async getProjectContext(
    actor: AuthenticatedActor,
    projectId: string,
    siteId: string
  ): Promise<ProjectContext | null> {
    const authenticatedActor = normalizeActor(actor);
    if (!authenticatedActor) {
      return null;
    }

    return (
      demoContexts.find(
        (context) => context.projectId === projectId && context.siteId === siteId
      ) ?? null
    );
  }
}

export function createDefaultProjectContextProvider(): ProjectContextProvider {
  const db = createPostgresDatabase();
  if (db) {
    return new PostgresProjectContextProvider(db);
  }
  return new DemoProjectContextProvider();
}

export const defaultProjectContextProvider: ProjectContextProvider =
  createDefaultProjectContextProvider();

export async function getProjectContext(
  projectId: string,
  siteId: string,
  actor: AuthenticatedActor,
  provider: ProjectContextProvider = defaultProjectContextProvider
): Promise<ProjectContext | null> {
  const authenticatedActor = normalizeActor(actor);
  if (!authenticatedActor) {
    return null;
  }
  return provider.getProjectContext(authenticatedActor, projectId, siteId);
}
