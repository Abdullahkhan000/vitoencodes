CREATE TABLE IF NOT EXISTS newsletter_subscribers (
 id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,state TEXT NOT NULL,
 confirm_hash TEXT,confirm_until BIGINT NOT NULL DEFAULT 0,
 unsubscribe_token TEXT NOT NULL UNIQUE,created_at BIGINT NOT NULL,confirmed_at BIGINT
);
CREATE TABLE IF NOT EXISTS newsletter_releases (release_id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS newsletter_deliveries (
 id TEXT PRIMARY KEY,subscriber_id TEXT NOT NULL,release_id TEXT NOT NULL,
 subject TEXT NOT NULL,body TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,next_at BIGINT NOT NULL,created_at BIGINT NOT NULL,
 UNIQUE(subscriber_id,release_id)
);
CREATE INDEX IF NOT EXISTS newsletter_pending ON newsletter_deliveries(state,next_at);
