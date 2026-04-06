-- Invitations table for admin-driven user onboarding
-- Tokens are one-time use with 7-day expiry

CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

-- Transfer ownership for RLS enforcement
ALTER TABLE invitations OWNER TO pulsci_admin;

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;

-- Tenant isolation: admins can only see/manage invitations for their org
DROP POLICY IF EXISTS tenant_isolation ON invitations;
CREATE POLICY tenant_isolation ON invitations
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS tenant_insert ON invitations;
CREATE POLICY tenant_insert ON invitations
  FOR INSERT WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- SECURITY DEFINER function to look up invitation by token (bypasses RLS)
-- Needed by the accept endpoint which has no auth context
CREATE OR REPLACE FUNCTION public.lookup_invitation_by_token(invite_token TEXT)
RETURNS TABLE(
  id UUID,
  organization_id UUID,
  email TEXT,
  role TEXT,
  token TEXT,
  invited_by UUID,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT id, organization_id, email, role, token, invited_by, expires_at, accepted_at, created_at
  FROM invitations
  WHERE invitations.token = invite_token
  LIMIT 1
$$;

ALTER FUNCTION public.lookup_invitation_by_token(TEXT) OWNER TO pulsci_admin;

-- Grant execute to app role
GRANT EXECUTE ON FUNCTION public.lookup_invitation_by_token(TEXT) TO pulsci_app;
