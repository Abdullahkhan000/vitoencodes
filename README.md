# VITOENCODES

Next.js cinema catalog with responsive dark UI, search, category/resolution filters, encode details, download mirrors, an authenticated admin API, persistent Neon Postgres catalog (local SQLite fallback) and Google Shared Drive metadata import.

## Run locally

Requires Node.js 22.18+ and npm.

This workspace already has dependencies installed and a generated `.env.local` with a random ADMIN_TOKEN. Run `npm.cmd run dev` to open it. Read the local ADMIN_TOKEN value in your editor and enter it at /admin/login. The commands below are for a fresh checkout; do not overwrite an existing configured `.env.local`.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Put that generated value into ADMIN_TOKEN in .env.local.
npm.cmd run dev
```

Open http://localhost:3000 for the public collection. Sign in privately at http://localhost:3000/admin/login using ADMIN_TOKEN from your local environment. The key is exchanged for an 8-hour signed HttpOnly, SameSite=Strict session cookie (Secure over production HTTPS). No default credential is shipped. Anonymous requests to /admin return 404; private APIs require authentication. Public navigation contains no admin links. Google/Gmail login is not connected yet; the admin email will be configured later. Login attempts are limited to 10 failures per 15 minutes per running app instance. The bearer-token API remains available for the sync worker.

## Connect Drive

1. Enable Google Drive API in your Google Cloud project.
2. Create an OAuth client and obtain a refresh token using the `https://www.googleapis.com/auth/drive.metadata.readonly` scope. The Google account must have access to each selected Shared Drive folder. Complete Google's OAuth consent configuration for your intended use; testing-mode refresh tokens can expire.
3. Put GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN in .env.local on the server. Keep secrets out of chat, source control and browser code.
4. Set DRIVE_FOLDER_IDS to comma-separated folder IDs. A folder ID is the part after `/folders/` in its Google Drive URL.
5. Restart the app, open Studio and run Scan allowed folders.

The scanner paginates and supports Shared Drives. It scans the configured root folders and **all nested subfolders**. Shortcuts are skipped so their targets are not followed outside the allowed trees. Overlapping roots and repeated folder IDs are visited once per scan. It ignores non-video files and names without VITOENCODES, deduplicates on Drive file ID and creates drafts. It imports metadata only, never downloads video bytes or changes Drive sharing. Repeated scans preserve your edits. Review drafts and paste existing HubCloud, Drive HTTPS mirrors or torrent magnets before publishing.

Official Drive reference: https://developers.google.com/workspace/drive/api/guides/search-files

## Publish a release

Load the collection in Studio, or add an encode manually. Enter one mirror per line:

```text
HubCloud | https://your-actual-mirror-url
Torrent | magnet:?xt=urn:btih:YOUR_HASH
```

Select Published and save. Public catalog responses include published releases only. Publishing requires at least one mirror. Until the first release is published the homepage shows clearly labelled sample entries with illustrative specifications and no download links. Posters and the hero load from TMDB's image CDN; production should replace these with your chosen licensed assets. Imported releases support persistent posters, curated clean movie titles, release years and exact Drive byte sizes (displayed as GiB/MiB). The current 21 encodes have been matched to 19 films; poster sources are stored with each record. Unknown films keep placeholders until reviewed. Admin-only POST /api/admin/artwork enriches the reviewed title mappings and caches artwork under public/posters/imported, taking a catalog snapshot in the private data directory first. Drive rescans refresh sizes without overwriting curated titles, posters, mirrors or publication status.

## Optional scheduled scanning

`node --env-file=.env.local scripts/sync-worker.mjs` polls the authenticated scan endpoint every 15 minutes (override SYNC_INTERVAL_SECONDS). Keep one worker running. It waits for a completed scan before starting another and logs errors without secrets. On Docker Compose the worker starts with the web app. Scheduled scans still create drafts for review.

## Production: VPS / Docker

```powershell
docker compose up -d --build
```

Use HTTPS via a reverse proxy and keep .env.local on the server. The catalog volume persists SQLite data. Back up that volume regularly, including SQLite WAL files or use SQLite's backup API. This deployment is designed for one app instance with a persistent disk. **Do not deploy this SQLite version to ephemeral Vercel functions or Cloudflare Workers.** A PostgreSQL repository adapter is needed before running multiple replicas or Vercel hosting. No public deployment or domain has been provisioned.

## Verification

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Tests cover branded media filtering, admin authentication, session expiry/tampering, same-origin cookie mutations, draft visibility, duplicate imports, nested traversal, pagination, shortcuts, overlapping roots and scan errors.

## Connection limits

HubCloud automatic upload and 1337x scraping are not implemented: a supported upload contract and account access must be verified first. Existing mirror links and magnet links work through Studio. The scanner does not transfer files, proxy downloads or automatically publish. Use it for media you have permission to distribute.

## HubDrive bulk batches

In the private Studio sidebar, open **Bulk links**. Paste up to five filename/size and HubDrive URL pairs, preview, then save. Each filename line uses `Movie.2024.ViTO.mkv - 4.5 GB`, followed by `https://hubdrive.bar/file/FILE_ID` on the next line. VITO and VITOENCODES brands are supported for explicitly supplied batches. Matching uses exact filenames (case-insensitive), never just movie titles. Existing metadata and sizes are preserved; only missing mirrors are added. New records are drafts. The batch is atomic, repeat submissions are idempotent, and each encode supports up to five mirrors. User-provided GB sizes remain as supplied, without guessing exact bytes. The Drive scanner retains its existing VITOENCODES-only selection.

## Linkify movie information

Set `LINKIFY_MEDIA_API_KEY` and `LINKIFY_MEDIA_API_BASE` on the server. The key is sent only in the `X-API-Key` header; no public browser request needs it. In **Admin ? Encode library**, use **Import missing movie info**, or select releases and use **Refresh selected movie info**.

The importer uses the documented `/api/v1/search/results/` and `/api/v1/media/movie/{id}/` endpoints. It requires one exact normalized title and release year match. Ambiguous matches are left unchanged. Imports run in batches of up to five; successful results persist in SQLite and later imports skip them unless selected for refresh. Provider failures or rate limits stop the import with a message, and completed records remain saved.

Synopsis, genres, runtime, director, cast, IMDb ID and a clearly labelled **TMDB** rating are mapped when returned. YouTube trailers and movie stills are imported only if the detail response includes `videos.results` and `images.backdrops`; the locally available Linkify API implementation does not currently include those resources. Its backdrop image may be used for the detail hero. Movie stills are labelled separately from screenshots of an actual encode. Existing custom synopsis, trailer, screenshots, mirrors, sizes and visibility are preserved. Use the release editor to add missing media manually.

A configured key does not guarantee service availability. A failed connection does not write metadata or change publication status. The live provider connection must succeed before real movie enrichment can be verified.

## Source sections

The public library and admin support **Blu-Ray**, **HDTV** and **WEB-DL** source filters. Sources are derived from each release's filename for both existing records and future imports; IMAX/Open Matte/35mm remain independent format filters. BluRay/Blu-Ray tags take precedence, then HDTV. WEBRip and WEB-DL tags both belong to WEB-DL. Files without a recognized source stay Unknown and remain available under All sources. This classification preserves all titles, posters, mirrors and publishing decisions. Public API filtering is available through `/api/catalog?source=Blu-Ray`, `HDTV` or `WEB-DL`; drafts remain private.

Manual and bulk imports accept video filenames without VITO/VITOENCODES tags. These releases are labelled **Unknown encoder** in the preview, library and movie details; original filenames remain unchanged. A leading "Copy of" is removed only from the parsed display title. Drive scans retain their existing VITOENCODES-only selection rule.

## Automatic bulk movie enrichment and discovery

Bulk **Preview batch** now requests Linkify movie information and displays a poster, short overview, genres and import status. **Save releases** imports the filenames/mirrors as drafts and automatically persists the same provider metadata, including the Linkify poster as the release poster. Positive lookups are cached for seven days in SQLite so preview followed by save does not consume the API twice. Existing custom text, mirrors, file sizes and publication decisions are preserved.

A provider error does not prevent saving valid drafts: missing movie information is labelled pending and can be retried from the library. The metadata importer stops making further provider calls in the batch after a connection/quota failure. In this restricted workspace, the live Linkify connection currently fails with `EACCES` (outbound network permission denied). Automated tests cover the provider-success path using verified response-shaped fixtures; actual live enrichment still requires running the server in an environment with outbound HTTPS access.

Movie collections use Linkify�s `belongs_to_collection` metadata and appear on `/collections/{slug}`, the homepage and movie detail pages. The requested Dune (2021) / Dune: Part Two (2024) pairing also has an explicit year-bound fallback. Collections only contain published movies; multiple encodes of one movie appear as versions on its detail page. Other franchises are never guessed from a shared title prefix.

Genres come from imported or manually entered movie details. Public genre links and the library genre filter use those values. Recommendations require a shared genre, rank movies by genre overlap, exclude the current movie and duplicate editions, and never expose drafts. Same-series movies have their own collection section. When no genre match exists, no unrelated recommendations are inserted.

## TMDB as the primary provider

`METADATA_PROVIDER=tmdb` selects direct TMDB movie metadata. Set `TMDB_API_KEY` (v3 key) or `TMDB_READ_ACCESS_TOKEN` (Bearer token) in the server environment. The supplied key is configured locally in `.env.local`; no credential is published to browser code. Requests go to `https://api.themoviedb.org/3/search/movie` and `/3/movie/{id}?append_to_response=credits,external_ids,videos,images`. Matching still requires a unique title and release year. Images, YouTube trailers, IMDb IDs and collection metadata flow through bulk preview/save and library imports automatically.

Cache keys include the provider so old Linkify responses do not suppress the TMDB import. A provider change also marks older movie records for enrichment. Existing manual synopsis, trailer, screenshots, download mirrors and visibility are preserved. TMDB photos are movie stills, not encode screenshots. API key authentication is only present in server-to-TMDB requests and sanitized errors never include request URLs or secrets.

The About & credits page links to TMDB and carries its attribution notice. Obtain and use the approved TMDB logo asset from https://www.themoviedb.org/about/logos-attribution before public release; that asset page was not accessible in this environment. API references: https://developer.themoviedb.org/docs/authentication-application and https://developer.themoviedb.org/docs/append-to-response.

## Resolve local Codex network-disabled startup

The agent's current managed sandbox sets `CODEX_SANDBOX_NETWORK_DISABLED=1`, and outbound sockets fail with `EACCES`. Changing API keys, retries, DNS or app code does not grant that sandbox a network permission. The launcher respects that restriction and refuses to start inside that sandbox; it does not change sandbox settings, remove the marker, edit firewall rules or create a proxy.

Open **Start VITOENCODES.cmd** yourself from Windows File Explorer to run the app in your normal Windows terminal. Alternatively, from a normal PowerShell window in this project run `npm.cmd run start:local`. It verifies the TMDB credential using a real request, snapshots the private catalog, imports missing movie metadata, then starts the site on the first available port from 3000 to 3010. Keep the terminal open and use the URL it prints. `npm.cmd run check:tmdb` checks only the live credential and connection without importing or starting a server.

A real connection/key validation result is still required from that normal terminal. If the normal terminal also reports a connection error, the problem is outside this app and needs that error's diagnosis. Do not disable TLS verification or publish API credentials to browser code to work around it.

## Skip existing metadata on launcher startup

The normal CMD launcher no longer performs a Dune API preflight on every start. It first checks saved movie information, skips completed/provider-processed records, and starts without any TMDB calls if nothing needs importing. Existing posters are preserved when filling missing about/genres. Additional encodes of the same title and year reuse saved film metadata or the persistent cache; encode-specific screenshots are not copied between encodes. An explicit **Refresh selected movie info** or `npm.cmd run check:tmdb` remains an intentional fresh request.

## One movie, multiple releases

Public cards and recent/search results are grouped by TMDB movie ID. Without an ID, only exact normalized title/year matches are grouped, and an unidentified row is not attached when multiple known IDs share that title/year. The homepage shows a release count. Each canonical `/movies/tmdb-{id}` page contains every published encode, filename, source, format, encoder, size and mirror. Old per-release URLs redirect to the movie page with that release selected; the original records and download URLs are preserved. Genre/source/resolution filters still consider each release inside its movie group.

TMDB matching now supports unique high-confidence partial titles and small typos, with year checks and sequel-number checks. It tries up to four bounded query variants only when needed and never selects the first ambiguous result automatically. Imported official titles are used for movie display. Ambiguous results can be reviewed through **Edit ? Find TMDB matches**; each candidate shows its title, year, language, poster, description and TMDB ID. The selected ID must be in the release's matching candidate list and its year is revalidated before saving. Verified choices are cached, so the CMD launcher can reuse them.

### HubDrive domain updates

Open `/admin?view=domains` while signed in. Enter `hubdrive.pw` or `.pw`, preview affected links, then apply. Published releases and drafts update together in one SQLite transaction. File paths, IDs, other providers, release metadata and publication status are preserved. Previous links and settings are retained in the private `download_domain_history` table. Future bulk imports and manual edits normalize recognized old domains to the saved domain; repasting an old link does not add a duplicate mirror. Only configured HubDrive domains are rewritten.

### Library search and pagination

The public movie library and admin release library default to 8 results per page, with 6/8 options and numbered navigation. Search examines the entire matching library before pagination. Combine unordered words such as `Dune 2024 IMAX`, `4K HEVC`, or genre/director/cast/IMDb terms. Filename punctuation, accents, partial words and small spelling mistakes are supported; numeric years stay exact. Common source/codec aliases match (4K/UHD/2160p, x265/HEVC, WEBRip/WEB-DL). Search results rank exact title matches first unless the public library has an explicit title/year sort. Filters continue to apply; alternate movie releases stay grouped. Changing search, filters, sort or page size resets to page one.

### Collections and release dates

Movie collections have their own `/collections` directory (with collection-name search); the home page links to it instead of displaying collection cards. Individual franchise pages remain at `/collections/[slug]`. Home orders grouped movies by their newest published encode, so a newly added version promotes its existing movie without duplicating it. Detail pages select the newest version by default, while explicit release URLs still select that version. Home refreshes published data on window focus and every 60 seconds while visible.

Added dates record when an encode entered this catalog, not when it was uploaded to an external host. Dates render in PKT on home cards, collection movie cards and version/download details. The database tracks actual content changes in `updated_at` across editor, metadata, publishing, mirrors and domain updates, preserving `created_at`. Re-saving unchanged values does not change the update date. Existing records have no known historical update timestamp and show Not recorded until their next change.

### About, FAQ and contact

Public `/about`, `/faq` and `/contact` pages are linked from the archive, movie and collection footers. Movie downloads include Report a problem, which prefills the title and (on normal click) movie URL. The contact form stores a private report with a reference in the configured database; no email service is required and no email notification is sent. Name and reply email are optional. Studio -> Contact inbox (`/admin?view=support`) shows the latest 200 reports, with New/Closed/All filters, resolve/reopen and refresh. Reply email links open the admin's email client. No inbox content is publicly accessible. Reports use input limits, same-origin submission, a honeypot, and persisted request limits (5 per client/hour and 100 total/day). Raw IP addresses are not stored; the rate-limit identifier is hashed.

FAQ now includes a format guide with source-linked Open Matte, IMAX and 35mm explanations; an illustrative fixed-width aspect-ratio comparison; custom-edition terminology; and searchable, categorized questions with expand/collapse controls. The custom section explains possible processing and a typical workflow, without asserting undocumented VITOENCODES tools or production steps. Technical references: Film Atlas https://www.filmatlas.com/entry/161 , IMAX https://www.imax.com/news/IMAX-Presents-Avengers-Infinity-War-the-Russo-Brothers , Kodak https://www.kodak.com/en/motion/page/kodak-film-labs/ .

### Public UI polish

On mobile, a fixed Home/Collections/Search/Saved bar includes safe-area spacing and stays hidden on admin routes. Search opens the existing archive search dialog; saved navigation reads the browser's local bookmarks. Movie cards show actual size and release count together, with consistent specification/date spacing and normal links that support opening in a new tab. Poster/still images use a local fallback on failure and a reduced-motion-aware loading treatment. Route loading skeletons, a recovery page and a custom 404 keep navigation legible when content is loading or unavailable.

Download pages highlight the selected release and each mirror's provider hostname. Choosing a version updates the current URL's release parameter, so refresh/share retains the selection. Hero specifications follow the selected encode. Download links still open the external provider; the site does not check a mirror's live availability or proxy the file.

### Updated releases, saved shelf and requests

`/recently-updated` groups published movies whose encodes have a real recorded update after their addition timestamp, sorted newest update first. Unknown historical timestamps and untouched new inserts are excluded. Cards open the changed release directly. `/saved` reads existing canonical and legacy bookmarks from this browser, groups alternate encodes and allows removing a saved movie without dropping unrelated bookmarks. Both shelves have search and 6/8 per-page pagination. Footer, desktop sidebar and mobile Saved navigation link to the new pages.

`/request` submits a Release request through the existing private contact inbox, using the same validation/rate limits and returning a reference. The form asks for a movie/year, desired edition/format/audio and optional title link/contact details. Studio -> Contact inbox has a Message type filter separating requests from contact/issues. Requests are not published and do not send automatic email.

Home filter chips show the active search, source, genre, collection, format, resolution, codec, year, saved-only view and sort; each can be removed individually, or reset with Clear all. Initial query/source/genre/collection URL filters are rendered on the server to avoid showing an unfiltered library first.

### GDFlix packs

Studio -> Bulk links now has separate HubDrive and GDFlix tabs. GDFlix accepts up to five individual file URLs, one per line, without filenames or sizes. Preview resolves file details from previously saved source listings or the public file page, then uses the existing TMDB enrichment for posters, descriptions, IMDb, trailers, genres and collections. Review the preview and save drafts yourself. Unreadable/private pages return an error instead of guessing. The optional pack importer is collapsed below the main importer. Source-detail caching does not create releases; repeated exact filenames can add separate mirrors to the same encode.

The supplied saved Pack 1 HTML populated source details for 100 links (99 distinct filenames). No movies were added or published by this cache operation. New uncached links require the application server to reach a readable GDFlix file page; new TMDB lookups likewise require outbound access.

Studio -> Bulk links includes GDFlix pack preview/import. Paste a supported HTTPS gdflix.io pack URL, read its individual entries, review filenames/sizes, then import readable entries. The UI sends batches of up to five through the normal bulk-import path, with metadata enrichment. Existing exact filenames retain curated content and publication status; new file records are drafts. Already-linked entries are skipped. Incomplete/unreadable rows are flagged rather than guessed. Retry after a partial failure is idempotent. Pack reading requires the app server to reach GDFlix and a public readable listing; authentication/challenge pages are not bypassed. Redirects and non-GDFlix hosts are not followed. Individual HubDrive and GDFlix file links are supported in the existing five-entry text importer. Pack import adds catalog records and mirror links; it does not transfer video files between hosts.

### Neon Postgres setup

The Node/Docker server uses a shared node-postgres pool with TLS and a pooled application URL. Catalog records, metadata and GDFlix caches, domain settings/history, and the support inbox use Postgres whenever database URLs are configured. Without database URLs, local development and unit tests use SQLite. A failed Postgres connection never silently falls back to SQLite.

Keep URLs server-only in .env.local (or .env). For manually supplied credentials, set a direct DATABASE_URL and pooled DATABASE_URL_POOLED. The Neon CLI convention is also supported: pooled DATABASE_URL and direct DATABASE_URL_UNPOOLED. Migrations and imports always use the direct connection. The app reads the pooled URL. Never use NEXT_PUBLIC_ for database credentials.

On Windows, close running app/server windows and double-click Setup Neon.cmd after signing in. If provisioning has already succeeded and a dependency installation failed, use Finish Neon Setup.cmd to repair dependencies and resume schema/data/build/live checks without provisioning again. It installs dependencies, links project dawn-glitter-86894411 / production in org-still-firefly-07850187, applies neon.ts, migrates the schema, imports the existing SQLite catalog, builds, and runs the live verification. Existing env files are backed up into ignored data/ files. It stops on the first failed step.

To finish using already configured URLs:

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run db:import
npm.cmd run build
npm.cmd run test:neon
npm.cmd run start:local
```

Skip db:import for a fresh database with no SQLite catalog. The importer opens SQLite read-only, copies all six application tables in a transaction, preserves timestamps and IDs, and skips keys already in Postgres. It never overwrites cloud edits or deletes local data. Re-running it is safe. Schema changes are versioned in migrations/ and applied transactionally with checksums and a migration lock. Run migrations before starting the app after a schema change.

Unit tests run with disposable SQLite files and explicitly clear database URLs. The live test starts the production app, checks Postgres persistence, draft privacy, publishing, movie rendering, caches/settings, and contact/inbox resolution. It creates uniquely named temporary records and removes only those records when finished. The live test requires an applied schema and outbound database access.

Current validation: 74 unit tests and the production build passed. The production server starts. Live migration and verification are blocked in the agent terminal by outbound EACCES; browser authentication does not lift that restriction. Remote provisioning, schema application, data import, and full Neon verification are not yet confirmed. Run the launcher from a normal Windows terminal with network access to finish.
