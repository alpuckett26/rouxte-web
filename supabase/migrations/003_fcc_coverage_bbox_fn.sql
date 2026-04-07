-- Bounding-box query for the map coverage heatmap layer.
-- Returns up to 8000 AT&T fiber locations within the viewport.
CREATE OR REPLACE FUNCTION fcc_att_coverage_bbox(
  p_west  DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east  DOUBLE PRECISION,
  p_north DOUBLE PRECISION
)
RETURNS TABLE(location_id TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    location_id,
    ST_Y(geom::geometry) AS lat,
    ST_X(geom::geometry) AS lng
  FROM fcc_att_locations
  WHERE ST_Intersects(
    geom::geometry,
    ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
  )
  LIMIT 8000;
$$;

GRANT EXECUTE ON FUNCTION fcc_att_coverage_bbox(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;
