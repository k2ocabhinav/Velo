CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS app_user (
    id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    phone_number VARCHAR(255),
    active BOOLEAN,
    referral_code VARCHAR(255) UNIQUE,
    created_time TIMESTAMP,
    version BIGINT
);

CREATE INDEX IF NOT EXISTS idx_user_email ON app_user (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_referral_code ON app_user (referral_code);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    roles VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, roles),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE TABLE IF NOT EXISTS rider (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE,
    rating DOUBLE PRECISION,
    version BIGINT,
    CONSTRAINT fk_rider_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE INDEX IF NOT EXISTS idx_rider_rating ON rider (rating);

CREATE TABLE IF NOT EXISTS driver (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE,
    vehicle_id VARCHAR(255),
    rating DOUBLE PRECISION,
    available BOOLEAN,
    onboarding_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    current_location geometry(Point, 4326),
    created_at TIMESTAMP,
    version BIGINT,
    CONSTRAINT fk_driver_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE INDEX IF NOT EXISTS idx_driver_vehicle_id ON driver (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driver_available ON driver (available);
CREATE INDEX IF NOT EXISTS idx_driver_rating ON driver (rating);
CREATE INDEX IF NOT EXISTS idx_driver_onboarding_status ON driver (onboarding_status);

CREATE TABLE IF NOT EXISTS ride_request (
    id BIGSERIAL PRIMARY KEY,
    pickup_location geometry(Point, 4326),
    drop_off_location geometry(Point, 4326),
    requested_time TIMESTAMP,
    scheduled_time TIMESTAMP,
    rider_id BIGINT,
    payment_method VARCHAR(255),
    ride_request_status VARCHAR(255),
    fare NUMERIC(10, 2),
    promo_code VARCHAR(255),
    discount_amount NUMERIC(10, 2),
    version BIGINT,
    CONSTRAINT fk_ride_request_rider FOREIGN KEY (rider_id) REFERENCES rider (id)
);

CREATE INDEX IF NOT EXISTS idx_ride_request_rider ON ride_request (rider_id);
CREATE INDEX IF NOT EXISTS idx_ride_request_status ON ride_request (ride_request_status);
CREATE INDEX IF NOT EXISTS idx_ride_request_scheduled ON ride_request (scheduled_time);
CREATE INDEX IF NOT EXISTS idx_ride_request_rider_status_scheduled ON ride_request (rider_id, ride_request_status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_ride_request_status_scheduled ON ride_request (ride_request_status, scheduled_time);

CREATE TABLE IF NOT EXISTS ride (
    id BIGSERIAL PRIMARY KEY,
    pickup_location geometry(Point, 4326),
    drop_off_location geometry(Point, 4326),
    created_time TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    rider_id BIGINT,
    driver_id BIGINT,
    payment_method VARCHAR(255),
    ride_status VARCHAR(255),
    fare NUMERIC(10, 2),
    promo_code VARCHAR(255),
    discount_amount NUMERIC(10, 2),
    otp VARCHAR(255),
    version BIGINT,
    CONSTRAINT fk_ride_rider FOREIGN KEY (rider_id) REFERENCES rider (id),
    CONSTRAINT fk_ride_driver FOREIGN KEY (driver_id) REFERENCES driver (id)
);

CREATE INDEX IF NOT EXISTS idx_ride_rider ON ride (rider_id);
CREATE INDEX IF NOT EXISTS idx_ride_driver ON ride (driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_status ON ride (ride_status);
CREATE INDEX IF NOT EXISTS idx_ride_created ON ride (created_time);

CREATE TABLE IF NOT EXISTS payment (
    id BIGSERIAL PRIMARY KEY,
    payment_method VARCHAR(255),
    user_id BIGINT UNIQUE,
    ride_id BIGINT UNIQUE,
    amount NUMERIC(10, 2),
    payment_status VARCHAR(255),
    payment_time TIMESTAMP,
    version BIGINT,
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_payment_ride FOREIGN KEY (ride_id) REFERENCES ride (id)
);

CREATE INDEX IF NOT EXISTS idx_payment_ride ON payment (ride_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment (payment_status);

CREATE TABLE IF NOT EXISTS rating (
    id BIGSERIAL PRIMARY KEY,
    ride_id BIGINT UNIQUE,
    rider_id BIGINT,
    driver_id BIGINT,
    driver_rating INTEGER,
    rider_rating INTEGER,
    version BIGINT,
    CONSTRAINT fk_rating_ride FOREIGN KEY (ride_id) REFERENCES ride (id),
    CONSTRAINT fk_rating_rider FOREIGN KEY (rider_id) REFERENCES rider (id),
    CONSTRAINT fk_rating_driver FOREIGN KEY (driver_id) REFERENCES driver (id)
);

CREATE INDEX IF NOT EXISTS idx_rating_rider ON rating (rider_id);
CREATE INDEX IF NOT EXISTS idx_rating_driver ON rating (driver_id);
CREATE INDEX IF NOT EXISTS idx_rating_ride ON rating (ride_id);

CREATE TABLE IF NOT EXISTS wallet (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    balance NUMERIC(10, 2),
    version BIGINT,
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet (user_id);

CREATE TABLE IF NOT EXISTS wallet_transaction (
    id BIGSERIAL PRIMARY KEY,
    amount NUMERIC(10, 2),
    transaction_type INTEGER,
    transaction_method INTEGER,
    transaction_id VARCHAR(255),
    ride_id BIGINT,
    wallet_id BIGINT,
    "timestamp" TIMESTAMP,
    version BIGINT,
    CONSTRAINT fk_wallet_transaction_ride FOREIGN KEY (ride_id) REFERENCES ride (id),
    CONSTRAINT fk_wallet_transaction_wallet FOREIGN KEY (wallet_id) REFERENCES wallet (id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_transaction_wallet ON wallet_transaction (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transaction_ride ON wallet_transaction (ride_id);

CREATE TABLE IF NOT EXISTS promo_code (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(255) NOT NULL UNIQUE,
    discount_type VARCHAR(255) NOT NULL,
    discount_value NUMERIC(38, 2) NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER,
    start_date DATE,
    end_date DATE,
    min_ride_fare NUMERIC(38, 2),
    active BOOLEAN,
    description VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_active ON promo_code (active);

CREATE TABLE IF NOT EXISTS promo_code_usage (
    id BIGSERIAL PRIMARY KEY,
    promo_code_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    ride_id BIGINT,
    discount_applied NUMERIC(38, 2) NOT NULL,
    used_at TIMESTAMP NOT NULL,
    CONSTRAINT uq_promo_code_usage UNIQUE (promo_code_id, user_id),
    CONSTRAINT fk_promo_code_usage_promo FOREIGN KEY (promo_code_id) REFERENCES promo_code (id),
    CONSTRAINT fk_promo_code_usage_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_promo_code_usage_ride FOREIGN KEY (ride_id) REFERENCES ride (id)
);

CREATE TABLE IF NOT EXISTS driver_earning (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT NOT NULL,
    ride_id BIGINT NOT NULL UNIQUE,
    gross_fare NUMERIC(10, 2) NOT NULL,
    platform_commission NUMERIC(10, 2) NOT NULL,
    net_earning NUMERIC(10, 2) NOT NULL,
    created_time TIMESTAMP,
    version BIGINT,
    CONSTRAINT fk_driver_earning_driver FOREIGN KEY (driver_id) REFERENCES driver (id),
    CONSTRAINT fk_driver_earning_ride FOREIGN KEY (ride_id) REFERENCES ride (id)
);

CREATE INDEX IF NOT EXISTS idx_earning_driver ON driver_earning (driver_id);
CREATE INDEX IF NOT EXISTS idx_earning_created ON driver_earning (created_time);

CREATE TABLE IF NOT EXISTS payout_request (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP,
    processed_at TIMESTAMP,
    admin_note VARCHAR(255),
    version BIGINT,
    CONSTRAINT fk_payout_driver FOREIGN KEY (driver_id) REFERENCES driver (id)
);

CREATE INDEX IF NOT EXISTS idx_payout_driver ON payout_request (driver_id);
CREATE INDEX IF NOT EXISTS idx_payout_status ON payout_request (status);
CREATE INDEX IF NOT EXISTS idx_payout_driver_requested ON payout_request (driver_id, requested_at);
CREATE INDEX IF NOT EXISTS idx_payout_status_requested ON payout_request (status, requested_at);

CREATE TABLE IF NOT EXISTS payment_method (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    last_four_digits VARCHAR(255),
    expiry_date VARCHAR(255),
    is_default BOOLEAN NOT NULL,
    user_id BIGINT NOT NULL,
    created_time TIMESTAMP,
    updated_time TIMESTAMP,
    version BIGINT,
    CONSTRAINT fk_payment_method_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE INDEX IF NOT EXISTS idx_payment_method_user ON payment_method (user_id);

CREATE TABLE IF NOT EXISTS password_reset_token (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL,
    version BIGINT,
    CONSTRAINT fk_password_reset_token_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE TABLE IF NOT EXISTS notification (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    reference_id BIGINT,
    read BOOLEAN,
    created_time TIMESTAMP,
    version BIGINT,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE INDEX IF NOT EXISTS idx_notification_user_created ON notification (user_id, created_time);
CREATE INDEX IF NOT EXISTS idx_notification_user_read ON notification (user_id, read);

CREATE TABLE IF NOT EXISTS ride_offer (
    id BIGSERIAL PRIMARY KEY,
    ride_request_id BIGINT NOT NULL,
    driver_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    offered_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_reason VARCHAR(255),
    version BIGINT,
    CONSTRAINT fk_ride_offer_request FOREIGN KEY (ride_request_id) REFERENCES ride_request (id),
    CONSTRAINT fk_ride_offer_driver FOREIGN KEY (driver_id) REFERENCES driver (id)
);

CREATE INDEX IF NOT EXISTS idx_ride_offer_request_status ON ride_offer (ride_request_id, status);
CREATE INDEX IF NOT EXISTS idx_ride_offer_driver_status ON ride_offer (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_ride_offer_status_expiry ON ride_offer (status, expires_at);

CREATE TABLE IF NOT EXISTS admin_dispatch_audit (
    id BIGSERIAL PRIMARY KEY,
    action_type VARCHAR(64) NOT NULL,
    actor_user_id BIGINT NOT NULL,
    ride_request_id BIGINT,
    ride_id BIGINT,
    previous_driver_id BIGINT,
    next_driver_id BIGINT,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_dispatch_audit_request FOREIGN KEY (ride_request_id) REFERENCES ride_request (id),
    CONSTRAINT fk_dispatch_audit_ride FOREIGN KEY (ride_id) REFERENCES ride (id),
    CONSTRAINT fk_dispatch_audit_previous_driver FOREIGN KEY (previous_driver_id) REFERENCES driver (id),
    CONSTRAINT fk_dispatch_audit_next_driver FOREIGN KEY (next_driver_id) REFERENCES driver (id)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_audit_request_created ON admin_dispatch_audit (ride_request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_audit_ride_created ON admin_dispatch_audit (ride_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_audit_created ON admin_dispatch_audit (created_at);
