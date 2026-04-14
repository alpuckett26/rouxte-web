-- Migration 023: In-app meetings (powered by Daily.co)

CREATE TABLE IF NOT EXISTS meetings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  created_by    uuid        NOT NULL REFERENCES auth.users(id),
  title         text        NOT NULL,
  room_name     text        NOT NULL UNIQUE,   -- Daily room name (slug)
  room_url      text        NOT NULL,          -- Daily room URL
  meeting_type  text        NOT NULL DEFAULT 'instant', -- 'instant' | 'scheduled'
  scheduled_at  timestamptz,
  ended_at      timestamptz,
  status        text        NOT NULL DEFAULT 'waiting', -- 'waiting' | 'live' | 'ended'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: org members can see their org's meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view meetings"
  ON meetings FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "managers can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    org_id IN (
      SELECT org_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'sales_manager', 'team_lead', 'sales_rep')
    )
  );

CREATE POLICY "creator can update meeting"
  ON meetings FOR UPDATE
  USING (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS meetings_org_status_idx ON meetings(org_id, status, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS meetings_org_created_idx ON meetings(org_id, created_at DESC);
