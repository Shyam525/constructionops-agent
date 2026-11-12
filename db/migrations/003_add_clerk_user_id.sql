-- Migration 003: Add Clerk User ID to users table with unique partial index
-- Supports mapping verified Clerk identities to internal multi-tenant users.

BEGIN;

ALTER TABLE users
  ADD COLUMN clerk_user_id TEXT;

CREATE UNIQUE INDEX idx_users_clerk_user_id_unique
  ON users (clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;

COMMIT;

/*
================================================================================
ADMINISTRATOR PROVISIONING PROCEDURE (SQL)
================================================================================
To safely map a verified Clerk user to an active tenant without auto-provisioning:

1. Verify tenant exists and is active:
   SELECT id, name, is_active FROM tenants WHERE id = 'tenant_xyz';

2. Create or link user to their tenant and assign the Clerk User ID:
   INSERT INTO users (id, tenant_id, email, clerk_user_id, is_active)
   VALUES (
     'user_internal_001',
     'tenant_xyz',
     'engineer@acmeconstruction.com',
     'user_2clerk_verified_id',
     TRUE
   )
   ON CONFLICT (id) DO UPDATE
   SET clerk_user_id = EXCLUDED.clerk_user_id,
       is_active = TRUE;

3. Assign active project membership:
   INSERT INTO project_memberships (user_id, project_id, tenant_id, active, role_name)
   VALUES (
     'user_internal_001',
     'project_alpha',
     'tenant_xyz',
     TRUE,
     'site_engineer'
   )
   ON CONFLICT (user_id, project_id) DO UPDATE
   SET active = TRUE,
       tenant_id = EXCLUDED.tenant_id;
================================================================================
*/

