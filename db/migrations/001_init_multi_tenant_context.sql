CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_memberships (
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  role_name TEXT,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS project_roles (
  project_id TEXT NOT NULL REFERENCES projects(id),
  role_name TEXT NOT NULL,
  PRIMARY KEY (project_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_sites_project ON sites(project_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_project ON project_memberships(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
