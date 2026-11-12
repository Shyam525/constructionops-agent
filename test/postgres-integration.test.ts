import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { PostgresDatabase } from "../src/adapters/postgres/database.js";
import { PostgresUserRepository } from "../src/adapters/postgres/user-repository.js";
import { PostgresProjectContextProvider } from "../src/adapters/postgres/project-context-provider.js";

const testDbUrl = process.env.POSTGRES_TEST_URL;
const describeRealPostgres = testDbUrl ? describe : describe.skip;

function assertSafeIsolatedTestDatabase(connectionUrl: string): void {
  const parsed = new URL(connectionUrl);
  const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();

  const isLocalHost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";

  if (!isLocalHost) {
    throw new Error(
      `SAFETY VIOLATION: Integration tests with schema reset cannot run against remote host '${parsed.hostname}'. Must be localhost or 127.0.0.1.`
    );
  }

  if (!dbName.includes("test")) {
    throw new Error(
      `SAFETY VIOLATION: Database name '${dbName}' does not contain 'test'. Refusing to execute destructive schema reset on non-test database.`
    );
  }
}

describeRealPostgres("Real PostgreSQL Integration Tests (Isolated Database)", () => {
  it("applies migrations and enforces multi-tenant boundaries across real database tables", async () => {
    assertSafeIsolatedTestDatabase(testDbUrl!);
    const pool = new Pool({ connectionString: testDbUrl, max: 2 });
    const db = new PostgresDatabase(pool);
    const userRepo = new PostgresUserRepository(db);
    const contextProvider = new PostgresProjectContextProvider(db);

    try {
      // 0. Reset isolated test schema for clean migration testing
      await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

      // 1. Apply migrations 001, 002, and 003 in order
      const migrationsDir = join(process.cwd(), "db", "migrations");
      const migrationFiles = readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort();

      for (const file of migrationFiles) {
        const sql = readFileSync(join(migrationsDir, file), "utf-8");
        await pool.query(sql);
      }

      // 2. Seed Tenant 1 (Acme) and Tenant 2 (Beta)
      await pool.query(`
        INSERT INTO tenants (id, name, is_active)
        VALUES 
          ('tenant_acme', 'Acme Construction Co', TRUE),
          ('tenant_beta', 'Beta Infrastructure Ltd', TRUE)
        ON CONFLICT (id) DO NOTHING;
      `);

      // 3. Seed Users with verified Clerk IDs
      await pool.query(`
        INSERT INTO users (id, tenant_id, email, clerk_user_id, is_active)
        VALUES 
          ('user_acme_eng', 'tenant_acme', 'alice@acme.example.com', 'clerk_acme_alice', TRUE),
          ('user_beta_eng', 'tenant_beta', 'bob@beta.example.com', 'clerk_beta_bob', TRUE)
        ON CONFLICT (id) DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id, is_active = TRUE;
      `);

      // 4. Seed Projects and Sites
      await pool.query(`
        INSERT INTO projects (id, tenant_id, name, is_active)
        VALUES 
          ('proj_acme_tower', 'tenant_acme', 'Acme Commercial Tower', TRUE),
          ('proj_beta_bridge', 'tenant_beta', 'Beta River Bridge', TRUE)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO sites (id, project_id, name, is_active)
        VALUES 
          ('site_acme_foundation', 'proj_acme_tower', 'Tower Foundation', TRUE),
          ('site_beta_pier', 'proj_beta_bridge', 'North Pier', TRUE)
        ON CONFLICT (id) DO NOTHING;
      `);

      // 5. Seed Project Roles
      await pool.query(`
        INSERT INTO project_roles (project_id, role_name)
        VALUES 
          ('proj_acme_tower', 'safety_officer'),
          ('proj_acme_tower', 'procurement_manager'),
          ('proj_beta_bridge', 'safety_officer'),
          ('proj_beta_bridge', 'equipment_manager')
        ON CONFLICT (project_id, role_name) DO NOTHING;
      `);

      // 6. Seed Project Memberships (enforcing composite foreign keys)
      await pool.query(`
        INSERT INTO project_memberships (user_id, project_id, tenant_id, active, role_name)
        VALUES 
          ('user_acme_eng', 'proj_acme_tower', 'tenant_acme', TRUE, 'site_engineer'),
          ('user_beta_eng', 'proj_beta_bridge', 'tenant_beta', TRUE, 'site_engineer')
        ON CONFLICT (user_id, project_id) DO UPDATE SET active = TRUE, tenant_id = EXCLUDED.tenant_id;
      `);

      // 7. Verify user mapping query resolves internal actor
      const acmeActor = await userRepo.findActorByClerkUserId("clerk_acme_alice");
      expect(acmeActor).toEqual({
        userId: "user_acme_eng",
        tenantId: "tenant_acme"
      });

      const betaActor = await userRepo.findActorByClerkUserId("clerk_beta_bob");
      expect(betaActor).toEqual({
        userId: "user_beta_eng",
        tenantId: "tenant_beta"
      });

      // 8. Authorized access: Acme user accessing Acme project
      const acmeContext = await contextProvider.getProjectContext(
        acmeActor!,
        "proj_acme_tower",
        "site_acme_foundation"
      );
      expect(acmeContext).not.toBeNull();
      expect(acmeContext?.projectName).toBe("Acme Commercial Tower");
      expect(acmeContext?.availableOwnerRoles).toContain("safety_officer");
      expect(acmeContext?.availableOwnerRoles).toContain("procurement_manager");

      // 9. Cross-tenant access: Acme user attempting to access Beta's project
      const crossTenantContext = await contextProvider.getProjectContext(
        acmeActor!,
        "proj_beta_bridge",
        "site_beta_pier"
      );
      expect(crossTenantContext).toBeNull();

      // 10. Non-member access: Beta user attempting to access Acme's project
      const nonMemberContext = await contextProvider.getProjectContext(
        betaActor!,
        "proj_acme_tower",
        "site_acme_foundation"
      );
      expect(nonMemberContext).toBeNull();
    } finally {
      await pool.end();
    }
  });
});
