export interface AuthenticatedActor {
  userId: string;
  tenantId: string;
  roles?: string[];
}

export const demoActor: AuthenticatedActor = {
  userId: "demo-user",
  tenantId: "demo-tenant",
  roles: ["site_manager"]
};

export function normalizeActor(
  actor?: Partial<AuthenticatedActor> | null
): AuthenticatedActor | null {
  if (!actor) {
    return null;
  }

  const userId = typeof actor.userId === "string" ? actor.userId.trim() : "";
  const tenantId = typeof actor.tenantId === "string" ? actor.tenantId.trim() : "";

  if (!userId || !tenantId) {
    return null;
  }

  return {
    userId,
    tenantId,
    roles: Array.isArray(actor.roles) ? actor.roles.filter((role) => typeof role === "string") : undefined
  };
}
