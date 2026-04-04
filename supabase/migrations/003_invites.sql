-- Invite links for onboarding new team members into an existing org.
-- Managers/team leads generate a token-based URL; the recipient clicks it,
-- logs in (or signs up), and accepts the invite — which adds them to the org.

CREATE TABLE IF NOT EXISTS invites (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  invited_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         user_role NOT NULL DEFAULT 'sales_rep',
  team_id      uuid REFERENCES teams(id) ON DELETE SET NULL,
  token        text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invites_org_idx   ON invites(org_id);
CREATE INDEX IF NOT EXISTS invites_token_idx ON invites(token);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read invites for their own org (for listing pending invites)
CREATE POLICY "invites: org members read" ON invites
  FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1));

-- Anon can read a single invite by token (for the public landing page)
-- We restrict this to the service_role in the API via admin client — no anon policy needed.

GRANT SELECT ON invites TO authenticated;
