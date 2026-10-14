CREATE TABLE rider_saved_place (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenant(id),
    user_id BIGINT NOT NULL REFERENCES app_user(id),
    name VARCHAR(60) NOT NULL,
    label VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
    type VARCHAR(50) NOT NULL DEFAULT 'saved',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rider_saved_place_scope_created
    ON rider_saved_place (tenant_id, user_id, created_at DESC);
