# Administrator User & Tenant Provisioning Procedure

ConstructionOps enforces strict multi-tenant boundaries. User identities and tenant memberships are **never** auto-provisioned upon authentication.

Instead, an administrator must explicitly provision or map users in the PostgreSQL database.

## Prerequisites

1. The tenant must exist and be active (`is_active = TRUE`).
2. The project and its associated sites must exist and be active (`is_active = TRUE`).
3. The site engineer must have created an account in Clerk and obtained their Clerk User ID (`user_2...`).

---

## Provisioning Workflow

### Step 1: Provision or Verify Tenant

```sql
INSERT INTO tenants (id, name, is_active)
VALUES ('tenant-commercial-ops', 'Commercial Builders Ltd', TRUE)
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;
```

### Step 2: Provision or Map Internal User to Clerk ID

Map the verified `clerk_user_id` to the internal user record belonging to the tenant:

```sql
INSERT INTO users (id, tenant_id, email, clerk_user_id, is_active)
VALUES (
  'user-site-eng-01',
  'tenant-commercial-ops',
  'engineer@commercialbuilders.example.com',
  'user_2clerk_verified_id_here',
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET clerk_user_id = EXCLUDED.clerk_user_id,
    is_active = TRUE;
```

> **Note:** The unique partial index `idx_users_clerk_user_id_unique` ensures a Clerk User ID cannot be mapped to more than one internal user.

### Step 3: Provision Project and Site

```sql
INSERT INTO projects (id, tenant_id, name, is_active)
VALUES ('project-tower-1', 'tenant-commercial-ops', 'Tower 1 Construction', TRUE)
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

INSERT INTO sites (id, project_id, name, is_active)
VALUES ('site-east-wing', 'project-tower-1', 'East Wing Level 3', TRUE)
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

-- Configure available project owner roles
INSERT INTO project_roles (project_id, role_name)
VALUES
  ('project-tower-1', 'safety_officer'),
  ('project-tower-1', 'quality_manager'),
  ('project-tower-1', 'site_manager'),
  ('project-tower-1', 'procurement_manager'),
  ('project-tower-1', 'equipment_manager')
ON CONFLICT (project_id, role_name) DO NOTHING;
```

### Step 4: Grant Active Project Membership

Enforce tenant consistency through the composite foreign keys:

```sql
INSERT INTO project_memberships (user_id, project_id, tenant_id, active, role_name)
VALUES (
  'user-site-eng-01',
  'project-tower-1',
  'tenant-commercial-ops',
  TRUE,
  'site_engineer'
)
ON CONFLICT (user_id, project_id) DO UPDATE
SET active = TRUE,
    tenant_id = EXCLUDED.tenant_id;
```

---

## Deactivation Procedures

To immediately revoke access:
- **Revoke user access across all projects**:
  ```sql
  UPDATE users SET is_active = FALSE WHERE id = 'user-site-eng-01';
  ```
- **Revoke user access from a specific project**:
  ```sql
  UPDATE project_memberships SET active = FALSE WHERE user_id = 'user-site-eng-01' AND project_id = 'project-tower-1';
  ```
- **Suspend entire tenant**:
  ```sql
  UPDATE tenants SET is_active = FALSE WHERE id = 'tenant-commercial-ops';
  ```

