CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  category TEXT NOT NULL,
  resolution TEXT NOT NULL,
  size TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  links TEXT NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(links::jsonb) = 'array'),
  created_at TEXT NOT NULL DEFAULT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.MS'),
  poster TEXT NOT NULL DEFAULT '',
  metadata_source TEXT NOT NULL DEFAULT '',
  updated_at TEXT,
  size_bytes BIGINT,
  details TEXT NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details::jsonb) = 'object'),
  sort_order BIGSERIAL UNIQUE NOT NULL
);
CREATE INDEX releases_public_order ON releases(status, created_at DESC, sort_order DESC);

CREATE TABLE download_settings (setting_key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE download_domain_history (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.MS'),
  previous_settings TEXT NOT NULL,
  new_domain TEXT NOT NULL,
  previous_links TEXT NOT NULL
);
CREATE TABLE import_file_cache (
  url TEXT PRIMARY KEY,
  entry TEXT NOT NULL,
  source TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.MS'),
  sort_order BIGSERIAL UNIQUE NOT NULL
);
CREATE INDEX import_file_cache_source ON import_file_cache(source,sort_order);
CREATE TABLE movie_metadata_cache (cache_key TEXT PRIMARY KEY, details TEXT NOT NULL, fetched_at BIGINT NOT NULL);
CREATE TABLE support_issues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  page TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','closed')),
  created_at TEXT NOT NULL DEFAULT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.MS'),
  client_hash TEXT NOT NULL,
  sort_order BIGSERIAL UNIQUE NOT NULL
);
CREATE INDEX support_rate ON support_issues(client_hash,created_at);
CREATE INDEX support_recent ON support_issues(created_at);

-- RFC 7396 semantics, matching the previous SQLite json_patch operation.
CREATE FUNCTION vito_json_patch(target JSONB, patch JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item RECORD;
BEGIN
  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' THEN RETURN patch; END IF;
  IF jsonb_typeof(target) IS DISTINCT FROM 'object' THEN target := '{}'::jsonb; END IF;
  FOR item IN SELECT key,value FROM jsonb_each(patch) LOOP
    IF item.value = 'null'::jsonb THEN target := target - item.key;
    ELSE target := jsonb_set(target,ARRAY[item.key],vito_json_patch(target->item.key,item.value),true);
    END IF;
  END LOOP;
  RETURN target;
END;
$$;

CREATE FUNCTION vito_release_dates() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := COALESCE(NEW.updated_at,NEW.created_at);
  ELSIF ROW(OLD.filename,OLD.title,OLD.year,OLD.category,OLD.resolution,OLD.size,OLD.status,OLD.links::jsonb,OLD.poster,OLD.metadata_source,OLD.size_bytes,OLD.details::jsonb)
    IS DISTINCT FROM ROW(NEW.filename,NEW.title,NEW.year,NEW.category,NEW.resolution,NEW.size,NEW.status,NEW.links::jsonb,NEW.poster,NEW.metadata_source,NEW.size_bytes,NEW.details::jsonb) THEN
    NEW.updated_at := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.MS');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER release_dates BEFORE INSERT OR UPDATE ON releases FOR EACH ROW EXECUTE FUNCTION vito_release_dates();
