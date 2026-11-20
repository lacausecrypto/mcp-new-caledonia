# Changelog

## 1.1.0 — 2026-11-20

Audit of every tool against the live data.gouv.nc API. Before this release, 7 of 29 tools always failed and 9 always returned empty results.

### Fixed
- **Aggregation tools restored**: `nc_get_company_statistics`, `nc_get_job_seeker_stats`, `nc_get_vehicle_stats`, `nc_get_population_stats`, `nc_get_demographics_by_age`, `nc_get_transport_modes` used the `/aggregates` endpoint removed from Explore v2.1 (HTTP 410). They now use `/records` with `group_by`, and report `truncated` past 100 groups.
- **Commune / sector filters** used `%` as the LIKE wildcard; ODSQL uses `*`. These filters silently returned 0 results.
- **ODSQL escaping**: quotes were doubled (`''`), which ODSQL rejects. Any input containing an apostrophe (e.g. "L'Île-des-Pins") failed, and user text could alter the `where` clause. Quotes and backslashes are now backslash-escaped.
- **Errors are flagged**: failures were returned as normal results; they are now `isError: true` with the upstream ODSQL error code.
- `nc_is_public_holiday` always failed (date compared to text). It now also refuses dates outside the dataset coverage instead of answering "false".
- `nc_get_upcoming_holidays` used the UTC date instead of New Caledonia time (UTC+11).
- `nc_get_public_facilities`: "Sport" and "Parcs et loisirs" matched nothing; hyphenated communes ("Mont-Dore") matched nothing.
- `nc_get_partial_unemployment`: two of three schemes matched nothing. Schemes now follow the published values (`commun`, `nickel`, `evenements_mai_2024`, `renouvellement_2024`).
- `nc_search_job_offers`: `Stage` / `Alternance` never matched (case-sensitive). The enum now lists the published contract types.
- `nc_get_company`: `is_headquarters` was always false and `address` always empty (non-existent fields): removed. 10-digit RIDET numbers are accepted.
- `nc_get_digital_fragility_index`: population was missing for most communes (published as text, e.g. "3 955").
- Metadata cache kept failed lookups for the life of the process.
- Server version was hard-coded to 1.0.0.

### Removed
- Tools whose dataset exposes no records (catalog entry with 0 records and 0 attachments): `nc_get_weather_stations`, `nc_get_rain_stations`, `nc_get_mining_titles`, `nc_get_nickel_fund_sites`, `nc_get_water_catchments`, `nc_get_dry_forest_sites`, `nc_get_piezometers`, `nc_get_reef_stations`, and `nc_get_civil_servants` (dataset no longer in the catalog).
- `day_off` in holiday results: the source field `is_chome` is true for a single record (a bridge day), so it did not mean "public holiday is a day off".
- Silent field-name fallbacks (`resolveField`): field names are now fixed and checked by the live tests, so schema drift surfaces as an error.

### Added
- `nc_search_datasets`, `nc_get_dataset_schema`, `nc_query_dataset`: search and query the whole data.gouv.nc catalog with ODSQL.
- `nc_get_taneo_info` now returns the GTFS file download links.
- New fields: job offer positions/diploma/experience, partial unemployment decree, facility sub-category and manager, vehicle grouping by `energie`, company grouping by NAF `section`.
- Tool titles and `readOnlyHint` annotations (`registerTool`).
- Unit tests (escaping, client retries/cache, server wiring) and a live end-to-end test of every tool (`npm run test:live`, weekly in CI).

### Security & tooling
- Dependencies: `@modelcontextprotocol/sdk` 1.32.2, `zod` 4, `vitest` 5, `@types/node` 22. `npm audit`: 18 vulnerabilities → 0.
- Node.js 22+ required (Node 18 and 20 are end-of-life).
- Biome lint/format; TypeScript `noUncheckedIndexedAccess`.
- CI: Node 22 + 24 matrix, `npm audit`, actions pinned by SHA, least-privilege permissions.
- Publish workflow: checks tag = `package.json` = `server.json`, publishes to npm (trusted publishing + provenance), pins `mcp-publisher` and verifies its SHA-256 (it was downloaded as `latest` without verification in a job holding an OIDC token).
- Source maps no longer shipped without their sources.
