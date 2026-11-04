import { normalizeActor, type AuthenticatedActor } from "../../auth.js";
import type { ProjectContext, ProjectContextProvider } from "../../domain/project-context.js";

export interface PostgresLikeClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export function createPostgresClientFromEnv(): PostgresLikeClient | null {
  const connectionUrl = process.env.POSTGRES_URL;

  if (!connectionUrl) {
    return null;
  }

  return {
    async query<T = Record<string, unknown>>(_sql: string, _params?: unknown[]) {
      return { rows: [] as T[] };
    }
  };
}

export class PostgresProjectContextProvider implements ProjectContextProvider {
  constructor(private readonly client: PostgresLikeClient | null = createPostgresClientFromEnv()) {}

  async getProjectContext(
    actor: AuthenticatedActor,
    projectId: string,
    siteId: string
  ): Promise<ProjectContext | null> {
    const authenticatedActor = normalizeActor(actor);
    if (!authenticatedActor) {
      return null;
    }

    if (!this.client) {
      return null;
    }

    const sql = `
      SELECT
        p.id AS "projectId",
        p.name AS "projectName",
        s.id AS "siteId",
        s.name AS "siteName",
        COALESCE(
          ARRAY_AGG(DISTINCT pm.role_name) FILTER (WHERE pm.role_name IS NOT NULL),
          ARRAY[]::text[]
        ) AS "availableOwnerRoles"
      FROM projects p
      INNER JOIN tenants t
        ON t.id = p.tenant_id
      INNER JOIN sites s
        ON s.project_id = p.id
      INNER JOIN users u
        ON u.id = $4
       AND u.tenant_id = $3
       AND u.is_active = TRUE
      INNER JOIN project_memberships pm
        ON pm.project_id = p.id
       AND pm.user_id = u.id
       AND pm.active = TRUE
      WHERE p.id = $1
        AND s.id = $2
        AND p.tenant_id = $3
        AND t.is_active = TRUE
        AND p.is_active = TRUE
        AND s.is_active = TRUE
      GROUP BY p.id, p.name, s.id, s.name;
    `;

    const { rows } = await this.client.query<ProjectContext & { availableOwnerRoles?: string[] }>(sql, [
      projectId,
      siteId,
      authenticatedActor.tenantId,
      authenticatedActor.userId
    ]);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      projectId: row.projectId,
      projectName: row.projectName,
      siteId: row.siteId,
      siteName: row.siteName,
      availableOwnerRoles: Array.isArray(row.availableOwnerRoles) ? row.availableOwnerRoles : []
    };
  }
}
