-- ── POS / Petits commerces — migration v1 ───────────────────────────────────
-- Ajouter payment_method et note à la table sales

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS note VARCHAR;
