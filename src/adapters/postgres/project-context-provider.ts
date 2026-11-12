import { normalizeActor, type AuthenticatedActor } from "../../auth.js";
import type { ProjectContext, ProjectContextProvider } from "../../domain/project-context.js";
import type { SqlExecutor } from "./database.js";

export class PostgresProjectContextProvider implements ProjectContextProvider {
  constructor(private readonly db: SqlExecutor) {}

  async getProjectContext(
    actor: AuthenticatedActor,
    projectId: string,
    siteId: string
  ): Promise<ProjectContext | null> {
    const authenticatedActor = normalizeActor(actor);
    if (!authenticatedActor) {
      return null;
    }

    const sql = `
      SELECT
        p.id AS "projectId",
        p.name AS "projectName",
        s.id AS "siteId",
        s.name AS "siteName",
        COALESCE(
          ARRAY_AGG(DISTINCT pr.role_name) FILTER (WHERE pr.role_name IS NOT NULL),
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
       AND pm.tenant_id = $3
       AND pm.active = TRUE
      LEFT JOIN project_roles pr
        ON pr.project_id = p.id
      WHERE p.id = $1
        AND s.id = $2
        AND p.tenant_id = $3
        AND t.is_active = TRUE
        AND p.is_active = TRUE
        AND s.is_active = TRUE
      GROUP BY p.id, p.name, s.id, s.name;
    `;

    const { rows } = await this.db.query<ProjectContext & { availableOwnerRoles?: string[] }>(sql, [
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
