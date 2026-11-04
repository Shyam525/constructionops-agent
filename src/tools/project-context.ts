import { demoActor, normalizeActor, type AuthenticatedActor } from "../auth.js";
import type { ProjectContext, ProjectContextProvider } from "../domain/project-context.js";

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

export const defaultProjectContextProvider = new DemoProjectContextProvider();

export async function getProjectContextForActor(
  actor: Partial<AuthenticatedActor> | null | undefined,
  projectId: string,
  siteId: string
): Promise<ProjectContext | null> {
  const authenticatedActor = normalizeActor(actor) ?? demoActor;
  return defaultProjectContextProvider.getProjectContext(authenticatedActor, projectId, siteId);
}

export async function getProjectContext(
  projectId: string,
  siteId: string,
  actor: Partial<AuthenticatedActor> | null | undefined = demoActor
): Promise<ProjectContext | null> {
  return getProjectContextForActor(actor, projectId, siteId);
}
