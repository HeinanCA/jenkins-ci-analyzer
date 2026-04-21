import { describe, it, expect } from "vitest";

/**
 * RLS policy verification for jenkins_users table.
 *
 * These tests validate the migration SQL defines correct RLS patterns
 * matching the existing 12-table convention. For live DB verification,
 * see the DO $$ block in rls-setup.sql.
 *
 * Full DB integration tests require testcontainers (TODO).
 */

describe("jenkins_users RLS migration", () => {
  // Read the migration SQL to verify RLS statements are present
  const fs = require("node:fs");
  const path = require("node:path");

  const migrationPath = path.join(
    __dirname,
    "../src/db/migrations/0001_jenkins_users.sql",
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  it("enables ROW LEVEL SECURITY on jenkins_users", () => {
    expect(migrationSql).toContain(
      'ENABLE ROW LEVEL SECURITY',
    );
  });

  it("forces ROW LEVEL SECURITY on jenkins_users", () => {
    expect(migrationSql).toContain(
      'FORCE ROW LEVEL SECURITY',
    );
  });

  it("creates tenant_isolation policy using app.current_org_id", () => {
    expect(migrationSql).toContain("tenant_isolation");
    expect(migrationSql).toContain("app.current_org_id");
    expect(migrationSql).toContain(
      "organization_id",
    );
  });

  it("creates tenant_insert policy for INSERT", () => {
    expect(migrationSql).toContain("tenant_insert");
    expect(migrationSql).toContain("FOR INSERT WITH CHECK");
  });

  it("transfers ownership to pulsci_admin (required for FORCE RLS)", () => {
    expect(migrationSql).toContain("OWNER TO pulsci_admin");
  });

  it("grants access to pulsci_app role", () => {
    expect(migrationSql).toContain("GRANT");
    expect(migrationSql).toContain("pulsci_app");
  });

  it("creates the composite primary key", () => {
    expect(migrationSql).toContain(
      'PRIMARY KEY ("ci_instance_id", "jenkins_user_id")',
    );
  });

  it("creates the org + lower(email) index", () => {
    expect(migrationSql).toContain("jenkins_users_org_email_idx");
    expect(migrationSql).toContain('lower("email")');
  });

  it("creates the organization_id index", () => {
    expect(migrationSql).toContain("jenkins_users_org_id_idx");
  });

  it("uses IF NOT EXISTS for idempotent table creation", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS");
  });

  it("uses IF NOT EXISTS for idempotent index creation", () => {
    expect(migrationSql).toContain("CREATE INDEX IF NOT EXISTS");
  });

  it("policy pattern matches existing tables in rls-setup.sql", () => {
    const rlsSetupPath = path.join(
      __dirname,
      "../src/db/migrations/rls-setup.sql",
    );
    const rlsSetupSql = fs.readFileSync(rlsSetupPath, "utf-8");

    // Verify the USING clause pattern is identical
    const existingPattern =
      "current_setting('app.current_org_id', true)::uuid";
    expect(rlsSetupSql).toContain(existingPattern);
    expect(migrationSql).toContain(existingPattern);

    // Verify DROP POLICY IF EXISTS pattern (idempotent)
    expect(migrationSql).toContain("DROP POLICY IF EXISTS tenant_isolation");
    expect(migrationSql).toContain("DROP POLICY IF EXISTS tenant_insert");
  });
});
