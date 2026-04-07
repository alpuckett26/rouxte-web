-- fcc_att_coverage_bbox_distinct
-- Returns AT&T fiber locations within a bounding box for the map coverage layer.
-- With address-level data (lat/lng format), each location_id is unique so
-- DISTINCT is redundant but kept for safety with legacy H3 centroid imports.
--
-- Called by GET /api/fcc/coverage

CREATE OR REPLACE FUNCTION fcc_att_coverage_bbox_distinct(
  p_west  DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east  DOUBLE PRECISION,
  p_north DOUBLE PRECISION
)
RETURNS TABLE(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT lat, lng
  FROM fcc_att_locations
  WHERE ST_Intersects(
    geom::geometry,
    ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
  )
  LIMIT 6000;
$$;

GRANT EXECUTE ON FUNCTION fcc_att_coverage_bbox_distinct(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;

-- Helper to clear old data before a clean re-import (called by import script --truncate flag)
CREATE OR REPLACE FUNCTION truncate_fcc_locations()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  TRUNCATE TABLE fcc_att_locations;
$$;

GRANT EXECUTE ON FUNCTION truncate_fcc_locations() TO authenticated;
