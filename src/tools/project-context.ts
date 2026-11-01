/**
 * Read-only project context tool.
 * This fixture keeps the first version runnable without a database.
 * Replace it with a permission-checked database/API adapter later.
 */
export interface ProjectContext {
  projectId: string;
  projectName: string;
  siteId: string;
  siteName: string;
  availableOwnerRoles: string[];
}

const demoContexts: ProjectContext[] = [
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

export async function getProjectContext(
  projectId: string,
  siteId: string
): Promise<ProjectContext | null> {
  return demoContexts.find(
    (context) => context.projectId === projectId && context.siteId === siteId
  ) ?? null;
}
