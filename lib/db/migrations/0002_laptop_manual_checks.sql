BEGIN;
CREATE TABLE IF NOT EXISTS lw_manual_observations (
 id serial PRIMARY KEY,
 listing text NOT NULL REFERENCES lw_listings(id),
 user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 price_cents integer NOT NULL CHECK(price_cents BETWEEN 10000 AND 2000000),
 stock text NOT NULL CHECK(stock IN ('in_stock','out_of_stock','discontinued','preorder','unknown')),
 seller text NOT NULL CHECK(length(trim(seller)) BETWEEN 1 AND 160),
 condition text NOT NULL CHECK(condition IN ('new','non_new','unknown')),
 observed_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lw_manual_history ON lw_manual_observations(listing,observed_at DESC);
CREATE TABLE IF NOT EXISTS lw_manual_check_limits (
 listing text PRIMARY KEY REFERENCES lw_listings(id),
 user_id integer NOT NULL REFERENCES users(id),
 requested_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
