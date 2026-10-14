CREATE TABLE recurring_trip_template (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    rider_id BIGINT NOT NULL,
    days_of_week VARCHAR(64) NOT NULL,
    local_time TIME NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    pickup_location geometry(Point, 4326) NOT NULL,
    drop_off_location geometry(Point, 4326) NOT NULL,
    pickup_address VARCHAR(1024),
    drop_off_address VARCHAR(1024),
    payment_method VARCHAR(32) NOT NULL,
    notes VARCHAR(1024),
    booking_reference VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT,
    CONSTRAINT fk_recurring_template_tenant FOREIGN KEY (tenant_id) REFERENCES tenant (id),
    CONSTRAINT fk_recurring_template_rider FOREIGN KEY (rider_id) REFERENCES rider (id),
    CONSTRAINT chk_recurring_template_payment_method CHECK (payment_method IN ('CASH', 'WALLET')),
    CONSTRAINT chk_recurring_template_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_recurring_template_tenant_active ON recurring_trip_template (tenant_id, active);
CREATE INDEX idx_recurring_template_rider ON recurring_trip_template (rider_id, tenant_id);

ALTER TABLE ride_request
    ADD COLUMN recurring_template_id BIGINT,
    ADD COLUMN occurrence_date DATE,
    ADD COLUMN reason_code VARCHAR(64),
    ADD COLUMN reason_note VARCHAR(1024),
    ADD COLUMN booking_notes VARCHAR(1024),
    ADD CONSTRAINT fk_ride_request_recurring_template
        FOREIGN KEY (recurring_template_id) REFERENCES recurring_trip_template (id),
    ADD CONSTRAINT uq_ride_request_template_occurrence
        UNIQUE (recurring_template_id, occurrence_date);

CREATE INDEX idx_ride_request_template_occurrence
    ON ride_request (tenant_id, recurring_template_id, occurrence_date);

ALTER TABLE ride
    ADD COLUMN ride_request_id BIGINT UNIQUE,
    ADD CONSTRAINT fk_ride_ride_request FOREIGN KEY (ride_request_id) REFERENCES ride_request (id);

CREATE INDEX idx_ride_request_assignment ON ride_request (tenant_id, scheduled_time, ride_request_status);

CREATE UNIQUE INDEX uq_notification_scheduled_trip_alert
    ON notification (tenant_id, user_id, reference_id)
    WHERE type = 'SCHEDULED_TRIP_UNASSIGNED';
