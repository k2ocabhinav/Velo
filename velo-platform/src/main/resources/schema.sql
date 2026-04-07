-- Local-only PostGIS support for nearby-driver matching.
-- The app bootstrap already ensures PostGIS exists; this index keeps SRID 4326 lookups meter-correct and fast.
CREATE INDEX IF NOT EXISTS idx_driver_current_location_geography
    ON driver
    USING GIST ((current_location::geography));
