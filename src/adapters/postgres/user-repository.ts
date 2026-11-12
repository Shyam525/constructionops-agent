import type { AuthenticatedActor } from "../../auth.js";
import type { UserRepository } from "../../domain/user-repository.js";
import type { SqlExecutor } from "./database.js";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: SqlExecutor) {}

  async findActorByClerkUserId(clerkUserId: string): Promise<AuthenticatedActor | null> {
    const cleanId = clerkUserId.trim();
    if (!cleanId) {
      return null;
    }

    const sql = `
      SELECT
        u.id AS "userId",
        u.tenant_id AS "tenantId"
      FROM users u
      INNER JOIN tenants t
        ON t.id = u.tenant_id
      WHERE u.clerk_user_id = $1
        AND u.is_active = TRUE
        AND t.is_active = TRUE
      LIMIT 1;
    `;

    const result = await this.db.query<{ userId: string; tenantId: string }>(sql, [cleanId]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      userId: row.userId,
      tenantId: row.tenantId
    };
  }
}

