BEGIN;
CREATE TABLE IF NOT EXISTS lw_listings (id text PRIMARY KEY, catalog jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS lw_observations (
 id serial PRIMARY KEY, listing text NOT NULL REFERENCES lw_listings(id), checked_at timestamptz NOT NULL,
 price_cents integer CHECK (price_cents BETWEEN 10000 AND 2000000), stock text NOT NULL CHECK(stock IN ('in_stock','out_of_stock','discontinued','preorder','unknown')),
 seller text NOT NULL, condition text NOT NULL CHECK(condition IN ('new','non_new')), source text NOT NULL, receipt text NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS lw_history ON lw_observations(listing,checked_at DESC);
CREATE TABLE IF NOT EXISTS lw_checks (id serial PRIMARY KEY, listing text NOT NULL REFERENCES lw_listings(id), checked_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL, message text NOT NULL);
CREATE INDEX IF NOT EXISTS lw_latest_check ON lw_checks(listing,checked_at DESC);
CREATE TABLE IF NOT EXISTS lw_runs (id serial PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, status text NOT NULL, failures integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS lw_follows (
 id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, listing text NOT NULL REFERENCES lw_listings(id),
 target_cents integer CHECK(target_cents BETWEEN 10000 AND 2000000), drop_percent integer NOT NULL DEFAULT 3 CHECK(drop_percent BETWEEN 1 AND 100),
 target_alert boolean NOT NULL DEFAULT true, drop_alert boolean NOT NULL DEFAULT true, low_alert boolean NOT NULL DEFAULT true, restock_alert boolean NOT NULL DEFAULT true, push_enabled boolean NOT NULL DEFAULT true,
 UNIQUE(user_id,listing)
);
CREATE TABLE IF NOT EXISTS lw_invites (id serial PRIMARY KEY, token_hash text NOT NULL UNIQUE, created_by integer NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, used_at timestamptz, revoked_at timestamptz);
CREATE TABLE IF NOT EXISTS lw_subscriptions (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint text NOT NULL UNIQUE, keys jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS lw_alerts (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, observation_id integer REFERENCES lw_observations(id), listing text REFERENCES lw_listings(id), message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,observation_id));
CREATE TABLE IF NOT EXISTS lw_deliveries (id serial PRIMARY KEY, alert_id integer NOT NULL REFERENCES lw_alerts(id), subscription_id integer REFERENCES lw_subscriptions(id) ON DELETE SET NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_status integer, UNIQUE(alert_id,subscription_id));
CREATE TABLE IF NOT EXISTS session (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX IF NOT EXISTS session_expire ON session(expire);
COMMIT;
