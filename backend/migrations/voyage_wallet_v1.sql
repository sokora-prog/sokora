-- ═══════════════════════════════════════════════════════════════
--  SOKORA — Migration: Module Voyage + Wallet service_type
--  Version: 1.0 — 2025
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
--  1. WALLET — Ajout service_type aux transactions
-- ─────────────────────────────────────────
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS service_type VARCHAR DEFAULT 'restaurant';

-- Tagger les transactions existantes selon l'établissement
-- (toutes les transactions existantes sont restaurant par défaut → déjà OK)

-- ─────────────────────────────────────────
--  2. VOYAGE — Compagnies de transport
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voyage_companies (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR NOT NULL,
    phone      VARCHAR,
    address    VARCHAR,
    logo_url   VARCHAR,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  3. VOYAGE — Véhicules
-- ─────────────────────────────────────────
CREATE TYPE IF NOT EXISTS vehicletype AS ENUM ('MINIBUS', 'BUS', 'VAN', 'SHARED');

CREATE TABLE IF NOT EXISTS voyage_vehicles (
    id           SERIAL PRIMARY KEY,
    company_id   INTEGER NOT NULL REFERENCES voyage_companies(id),
    name         VARCHAR NOT NULL,
    plate        VARCHAR,
    vehicle_type vehicletype DEFAULT 'BUS',
    seat_count   INTEGER NOT NULL,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  4. VOYAGE — Chauffeurs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voyage_drivers (
    id            SERIAL PRIMARY KEY,
    company_id    INTEGER NOT NULL REFERENCES voyage_companies(id),
    full_name     VARCHAR NOT NULL,
    phone         VARCHAR UNIQUE,
    license_no    VARCHAR,
    is_active     BOOLEAN DEFAULT TRUE,
    password_hash VARCHAR,
    driver_token  VARCHAR,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voyage_drivers_token ON voyage_drivers(driver_token);

-- ─────────────────────────────────────────
--  5. VOYAGE — Lignes / Routes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voyage_routes (
    id           SERIAL PRIMARY KEY,
    company_id   INTEGER NOT NULL REFERENCES voyage_companies(id),
    origin       VARCHAR NOT NULL,
    destination  VARCHAR NOT NULL,
    distance_km  FLOAT,
    duration_min INTEGER,
    base_price   FLOAT NOT NULL,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  6. VOYAGE — Voyages programmés
-- ─────────────────────────────────────────
CREATE TYPE IF NOT EXISTS tripstatus AS ENUM ('SCHEDULED','BOARDING','IN_PROGRESS','COMPLETED','CANCELLED');

CREATE TABLE IF NOT EXISTS voyage_trips (
    id           SERIAL PRIMARY KEY,
    route_id     INTEGER NOT NULL REFERENCES voyage_routes(id),
    vehicle_id   INTEGER NOT NULL REFERENCES voyage_vehicles(id),
    driver_id    INTEGER REFERENCES voyage_drivers(id),
    departure_at TIMESTAMPTZ NOT NULL,
    price        FLOAT NOT NULL,
    status       tripstatus DEFAULT 'SCHEDULED',
    seats_total  INTEGER NOT NULL,
    seats_booked INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  7. VOYAGE — Réservations passager
-- ─────────────────────────────────────────
CREATE TYPE IF NOT EXISTS bookingstatus AS ENUM ('PENDING','CONFIRMED','BOARDED','COMPLETED','CANCELLED');

CREATE TABLE IF NOT EXISTS voyage_bookings (
    id              SERIAL PRIMARY KEY,
    trip_id         INTEGER NOT NULL REFERENCES voyage_trips(id),
    client_id       INTEGER NOT NULL REFERENCES client_accounts(id),
    seat_number     INTEGER NOT NULL,
    amount_paid     FLOAT NOT NULL,
    status          bookingstatus DEFAULT 'PENDING',
    qr_token        VARCHAR,
    wallet_tx_id    INTEGER REFERENCES wallet_transactions(id),
    passenger_name  VARCHAR,
    passenger_phone VARCHAR,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_voyage_bookings_qr ON voyage_bookings(qr_token);
CREATE INDEX IF NOT EXISTS idx_voyage_bookings_client ON voyage_bookings(client_id);

-- ─────────────────────────────────────────
--  8. VOYAGE — Sièges par voyage
-- ─────────────────────────────────────────
CREATE TYPE IF NOT EXISTS seatstatus AS ENUM ('FREE','BOOKED','BOARDED');

CREATE TABLE IF NOT EXISTS voyage_trip_seats (
    id          SERIAL PRIMARY KEY,
    trip_id     INTEGER NOT NULL REFERENCES voyage_trips(id),
    seat_number INTEGER NOT NULL,
    status      seatstatus DEFAULT 'FREE',
    booking_id  INTEGER REFERENCES voyage_bookings(id),
    CONSTRAINT uq_voyage_trip_seat UNIQUE (trip_id, seat_number)
);

-- ─────────────────────────────────────────
--  9. VOYAGE — Positions GPS véhicules
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voyage_vehicle_locations (
    id          SERIAL PRIMARY KEY,
    trip_id     INTEGER NOT NULL REFERENCES voyage_trips(id),
    latitude    FLOAT NOT NULL,
    longitude   FLOAT NOT NULL,
    speed_kmh   FLOAT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voyage_locations_trip ON voyage_vehicle_locations(trip_id, recorded_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  FIN MIGRATION
-- ═══════════════════════════════════════════════════════════════
SELECT 'Migration voyage_wallet_v1 appliquée avec succès' AS status;
