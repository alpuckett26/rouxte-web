-- FCC BDC AT&T fiber availability locations
-- Stores address-level records where AT&T reports fiber service (technology code 50)
-- Populated via scripts/import-fcc-bdc.ts

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS fcc_att_locations (
  location_id       TEXT        PRIMARY KEY,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  address_primary   TEXT,
  city              TEXT,
  state_abbr        CHAR(2),
  zip               TEXT,
  max_down_mbps     INTEGER,
  max_up_mbps       INTEGER,
  technology        SMALLINT,   -- 50 = FTTP, 40 = Cable, etc.
  geom              GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
                      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
                    ) STORED
);

CREATE INDEX IF NOT EXISTS fcc_att_locations_geom_idx
  ON fcc_att_locations USING GIST(geom);

CREATE INDEX IF NOT EXISTS fcc_att_locations_state_idx
  ON fcc_att_locations (state_abbr);

-- No RLS needed — this is read-only reference data, not tenant data.
-- Grant read access to the anon and authenticated roles.
GRANT SELECT ON fcc_att_locations TO anon, authenticated;

-- RPC function for spatial proximity check (called from /api/fcc/check)
CREATE OR REPLACE FUNCTION fcc_att_available(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM fcc_att_locations
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      100  -- metres
    )
  );
$$;

GRANT EXECUTE ON FUNCTION fcc_att_available(DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
