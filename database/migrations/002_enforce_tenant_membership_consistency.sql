BEGIN;

ALTER TABLE projects
  ADD CONSTRAINT projects_id_tenant_id_unique UNIQUE (id, tenant_id);

ALTER TABLE users
  ADD CONSTRAINT users_id_tenant_id_unique UNIQUE (id, tenant_id);

ALTER TABLE project_memberships
  ADD COLUMN tenant_id TEXT;

UPDATE project_memberships membership
SET tenant_id = project.tenant_id
FROM projects project
WHERE project.id = membership.project_id;

ALTER TABLE project_memberships
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE project_memberships
  ADD CONSTRAINT project_memberships_user_tenant_fk
    FOREIGN KEY (user_id, tenant_id)
    REFERENCES users (id, tenant_id),
  ADD CONSTRAINT project_memberships_project_tenant_fk
    FOREIGN KEY (project_id, tenant_id)
    REFERENCES projects (id, tenant_id);

CREATE INDEX idx_project_memberships_tenant_active
  ON project_memberships (tenant_id, active, project_id, user_id);

COMMIT;
