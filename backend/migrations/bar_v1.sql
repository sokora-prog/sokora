-- ═══════════════════════════════════════════════════════════════
--  SOKORA — Migration: Module Bar/Boîte de nuit
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bar_venues (
    id               SERIAL PRIMARY KEY,
    establishment_id INTEGER REFERENCES establishments(id),
    name             VARCHAR NOT NULL,
    address          VARCHAR,
    phone            VARCHAR,
    cover_charge     FLOAT DEFAULT 0,
    vip_price        FLOAT DEFAULT 0,
    capacity         INTEGER DEFAULT 200,
    is_active        BOOLEAN DEFAULT TRUE,
    logo_url         VARCHAR,
    description      TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE IF NOT EXISTS eventstatus AS ENUM ('UPCOMING','LIVE','ENDED','CANCELLED');

CREATE TABLE IF NOT EXISTS bar_events (
    id           SERIAL PRIMARY KEY,
    venue_id     INTEGER NOT NULL REFERENCES bar_venues(id),
    name         VARCHAR NOT NULL,
    description  TEXT,
    dj_name      VARCHAR,
    poster_url   VARCHAR,
    event_date   TIMESTAMPTZ NOT NULL,
    entry_price  FLOAT DEFAULT 0,
    vip_price    FLOAT DEFAULT 0,
    capacity     INTEGER DEFAULT 200,
    tickets_sold INTEGER DEFAULT 0,
    status       eventstatus DEFAULT 'UPCOMING',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE IF NOT EXISTS bartablestatus AS ENUM ('FREE','RESERVED','OCCUPIED','CLEANING');

CREATE TABLE IF NOT EXISTS bar_tables (
    id         SERIAL PRIMARY KEY,
    venue_id   INTEGER NOT NULL REFERENCES bar_venues(id),
    number     VARCHAR NOT NULL,
    zone       VARCHAR,
    capacity   INTEGER DEFAULT 6,
    min_conso  FLOAT DEFAULT 0,
    status     bartablestatus DEFAULT 'FREE',
    is_active  BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS bar_table_reservations (
    id           SERIAL PRIMARY KEY,
    table_id     INTEGER NOT NULL REFERENCES bar_tables(id),
    event_id     INTEGER REFERENCES bar_events(id),
    client_id    INTEGER REFERENCES client_accounts(id),
    client_name  VARCHAR,
    client_phone VARCHAR,
    guests_count INTEGER DEFAULT 1,
    amount_paid  FLOAT DEFAULT 0,
    wallet_tx_id INTEGER REFERENCES wallet_transactions(id),
    notes        TEXT,
    status       VARCHAR DEFAULT 'confirmed',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bar_tickets (
    id           SERIAL PRIMARY KEY,
    event_id     INTEGER NOT NULL REFERENCES bar_events(id),
    client_id    INTEGER REFERENCES client_accounts(id),
    ticket_type  VARCHAR DEFAULT 'standard',
    price        FLOAT NOT NULL,
    qr_token     VARCHAR,
    wallet_tx_id INTEGER REFERENCES wallet_transactions(id),
    is_used      BOOLEAN DEFAULT FALSE,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_tickets_qr ON bar_tickets(qr_token);

CREATE TYPE IF NOT EXISTS barorderstatus AS ENUM ('PENDING','CONFIRMED','SERVED','PAID','CANCELLED');

CREATE TABLE IF NOT EXISTS bar_orders (
    id             SERIAL PRIMARY KEY,
    venue_id       INTEGER NOT NULL REFERENCES bar_venues(id),
    table_id       INTEGER REFERENCES bar_tables(id),
    client_id      INTEGER REFERENCES client_accounts(id),
    client_name    VARCHAR,
    staff_id       INTEGER REFERENCES users(id),
    status         barorderstatus DEFAULT 'PENDING',
    total_amount   FLOAT DEFAULT 0,
    payment_method VARCHAR,
    wallet_tx_id   INTEGER REFERENCES wallet_transactions(id),
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bar_order_items (
    id         SERIAL PRIMARY KEY,
    order_id   INTEGER NOT NULL REFERENCES bar_orders(id),
    product_id INTEGER REFERENCES products(id),
    name       VARCHAR NOT NULL,
    quantity   INTEGER DEFAULT 1,
    unit_price FLOAT NOT NULL
);

SELECT 'Migration bar_v1 appliquée' AS status;
