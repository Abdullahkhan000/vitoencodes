// Unit tests must never connect to the configured production database.
delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_POOLED;
