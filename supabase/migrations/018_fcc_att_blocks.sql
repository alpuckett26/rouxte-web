-- AT&T fiber coverage at the census block level.
-- block_geoid = 15-digit FIPS (state + county + tract + block).
-- Geometry comes from Census TIGERweb, loaded by scripts/import-fcc-blocks.ts.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS fcc_att_blocks (
  block_geoid  TEXT PRIMARY KEY,
  state_abbr   CHAR(2) NOT NULL,
  geom         GEOMETRY(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS fcc_att_blocks_geom_idx
  ON fcc_att_blocks USING GIST(geom);

GRANT SELECT ON fcc_att_blocks TO anon, authenticated;

-- Viewport query for the map overlay
CREATE OR REPLACE FUNCTION fcc_att_blocks_bbox(
  p_west  DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east  DOUBLE PRECISION,
  p_north DOUBLE PRECISION
)
RETURNS TABLE(block_geoid TEXT, geom GEOMETRY)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT block_geoid, geom
  FROM fcc_att_blocks
  WHERE geom IS NOT NULL
    AND ST_Intersects(
      geom,
      ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
    )
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION fcc_att_blocks_bbox(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;
