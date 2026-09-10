-- ── SOKORA SPORT — Analyse des matchs sportifs, migration v1 ────────────────
-- Idempotent : rejouable sans risque.
-- SQLAlchemy crée ces tables automatiquement au démarrage de l'API ; ce script
-- sert aux bases existantes (production) où l'on préfère migrer explicitement.

CREATE TABLE IF NOT EXISTS sport_competitions (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  sport       VARCHAR(40)  NOT NULL DEFAULT 'football',
  country     VARCHAR(80),
  season      VARCHAR(20),
  is_active   BOOLEAN DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_sport_competition_season UNIQUE (name, season)
);

CREATE TABLE IF NOT EXISTS sport_teams (
  id             SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES sport_competitions(id) ON DELETE CASCADE,
  name           VARCHAR(120) NOT NULL,
  short_name     VARCHAR(20),
  country        VARCHAR(80),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_sport_team_per_competition UNIQUE (competition_id, name)
);
CREATE INDEX IF NOT EXISTS ix_sport_teams_name ON sport_teams (name);

CREATE TABLE IF NOT EXISTS sport_matches (
  id             SERIAL PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES sport_competitions(id) ON DELETE CASCADE,
  home_team_id   INTEGER NOT NULL REFERENCES sport_teams(id) ON DELETE CASCADE,
  away_team_id   INTEGER NOT NULL REFERENCES sport_teams(id) ON DELETE CASCADE,
  kickoff        TIMESTAMPTZ,
  matchday       INTEGER,
  status         VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',

  home_goals     INTEGER,
  away_goals     INTEGER,
  home_ht_goals  INTEGER,
  away_ht_goals  INTEGER,

  home_xg              DOUBLE PRECISION,
  away_xg              DOUBLE PRECISION,
  home_shots           INTEGER,
  away_shots           INTEGER,
  home_shots_on_target INTEGER,
  away_shots_on_target INTEGER,
  home_corners         INTEGER,
  away_corners         INTEGER,
  home_possession      DOUBLE PRECISION,
  away_possession      DOUBLE PRECISION,
  home_yellow_cards    INTEGER,
  away_yellow_cards    INTEGER,
  home_red_cards       INTEGER,
  away_red_cards       INTEGER,

  context_note   TEXT,
  home_boost     DOUBLE PRECISION DEFAULT 1.0,
  away_boost     DOUBLE PRECISION DEFAULT 1.0,

  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_sport_matches_kickoff ON sport_matches (kickoff);
CREATE INDEX IF NOT EXISTS ix_sport_matches_status  ON sport_matches (status);
CREATE INDEX IF NOT EXISTS ix_sport_match_teams     ON sport_matches (home_team_id, away_team_id);

CREATE TABLE IF NOT EXISTS sport_odds_quotes (
  id          SERIAL PRIMARY KEY,
  match_id    INTEGER NOT NULL REFERENCES sport_matches(id) ON DELETE CASCADE,
  bookmaker   VARCHAR(80),
  market      VARCHAR(40) NOT NULL,
  selection   VARCHAR(40) NOT NULL,
  odds        DOUBLE PRECISION NOT NULL,
  is_closing  BOOLEAN DEFAULT FALSE,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_sport_odds_market ON sport_odds_quotes (match_id, market, selection);

CREATE TABLE IF NOT EXISTS sport_bets (
  id                SERIAL PRIMARY KEY,
  match_id          INTEGER REFERENCES sport_matches(id) ON DELETE SET NULL,
  label             VARCHAR(160),
  market            VARCHAR(40) NOT NULL,
  selection         VARCHAR(40) NOT NULL,
  odds              DOUBLE PRECISION NOT NULL,
  stake             DOUBLE PRECISION NOT NULL,
  bookmaker         VARCHAR(80),
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  profit            DOUBLE PRECISION,
  model_probability DOUBLE PRECISION,
  edge              DOUBLE PRECISION,
  kelly_stake_pct   DOUBLE PRECISION,
  closing_odds      DOUBLE PRECISION,
  notes             TEXT,
  placed_at         TIMESTAMPTZ DEFAULT NOW(),
  settled_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_sport_bets_status    ON sport_bets (status);
CREATE INDEX IF NOT EXISTS ix_sport_bets_placed_at ON sport_bets (placed_at);

CREATE TABLE IF NOT EXISTS sport_bankroll_transactions (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(20) NOT NULL,
  amount     DOUBLE PRECISION NOT NULL,
  currency   VARCHAR(10) DEFAULT 'EUR',
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_sport_bankroll_created_at ON sport_bankroll_transactions (created_at);

-- ── Journal de prévisions gelées (v1.1) ────────────────────────────────────
-- Une prévision enregistrée avant le coup d'envoi ne peut plus être modifiée :
-- c'est ce qui la rend probante, contrairement à un rejeu rétrospectif dont les
-- réglages ont été choisis en connaissant les données.

CREATE TABLE IF NOT EXISTS sport_forecasts (
  id                 SERIAL PRIMARY KEY,
  match_id           INTEGER NOT NULL REFERENCES sport_matches(id) ON DELETE CASCADE,
  market             VARCHAR(40) NOT NULL,
  selection          VARCHAR(40) NOT NULL,
  model_probability  DOUBLE PRECISION NOT NULL,
  market_probability DOUBLE PRECISION,
  best_odds          DOUBLE PRECISION,
  reference_odds     DOUBLE PRECISION,
  signal             VARCHAR(20) DEFAULT 'goals',
  market_weight      DOUBLE PRECISION,
  kickoff            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  outcome            VARCHAR(10),
  closing_odds       DOUBLE PRECISION,
  resolved_at        TIMESTAMPTZ,
  CONSTRAINT uq_sport_forecast UNIQUE (match_id, market, selection)
);
CREATE INDEX IF NOT EXISTS ix_sport_forecasts_kickoff    ON sport_forecasts (kickoff);
CREATE INDEX IF NOT EXISTS ix_sport_forecasts_created_at ON sport_forecasts (created_at);
CREATE INDEX IF NOT EXISTS ix_sport_forecast_market      ON sport_forecasts (market, outcome);
