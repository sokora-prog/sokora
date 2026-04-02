-- Migration : SOKORA Black — table loyalty_transactions
-- Date : 2026-04-02

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id               SERIAL PRIMARY KEY,
    client_id        INTEGER NOT NULL REFERENCES client_accounts(id),
    establishment_id INTEGER REFERENCES establishments(id),
    order_id         INTEGER REFERENCES orders(id),
    points           INTEGER NOT NULL,
    tx_type          VARCHAR DEFAULT 'earn',   -- earn / redeem / bonus
    description      VARCHAR,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_loyalty_client ON loyalty_transactions(client_id);
CREATE INDEX IF NOT EXISTS ix_loyalty_est    ON loyalty_transactions(establishment_id);
