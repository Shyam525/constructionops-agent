import type { AuthenticatedActor } from "../auth.js";

export interface ProjectContext {
  projectId: string;
  projectName: string;
  siteId: string;
  siteName: string;
  availableOwnerRoles: string[];
}

export interface ProjectContextProvider {
  getProjectContext(
    actor: AuthenticatedActor,
    projectId: string,
    siteId: string
  ): Promise<ProjectContext | null>;
}
