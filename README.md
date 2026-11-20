# mcp-new-caledonia

[![CI](https://img.shields.io/github/actions/workflow/status/lacausecrypto/mcp-new-caledonia/ci.yml?branch=main&style=flat&label=CI)](https://github.com/lacausecrypto/mcp-new-caledonia/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/mcp-new-caledonia?style=flat)](https://www.npmjs.com/package/mcp-new-caledonia)
[![npm total downloads](https://img.shields.io/npm/dt/mcp-new-caledonia?style=flat)](https://www.npmjs.com/package/mcp-new-caledonia)
[![node version](https://img.shields.io/node/v/mcp-new-caledonia?style=flat)](https://www.npmjs.com/package/mcp-new-caledonia)
[![license](https://img.shields.io/github/license/lacausecrypto/mcp-new-caledonia?style=flat)](https://github.com/lacausecrypto/mcp-new-caledonia/blob/main/LICENSE)

MCP server for New Caledonia open data ([data.gouv.nc](https://data.gouv.nc/)): RIDET companies, job offers, public holidays, the 2019 census, nickel production and the Tanéo GTFS feed, plus ODSQL queries over the whole catalog. Read-only, no API key, `stdio` for Claude Code, Claude Desktop and any MCP client.

## What It Covers

| Group | Tools |
|---|---|
| Administration | `nc_get_public_holidays`, `nc_is_public_holiday`, `nc_get_upcoming_holidays`, `nc_get_digital_fragility_index` |
| Companies (RIDET) | `nc_search_companies`, `nc_get_company`, `nc_get_companies_by_sector`, `nc_get_company_statistics` |
| Employment | `nc_search_job_offers`, `nc_get_job_seeker_stats`, `nc_get_partial_unemployment` |
| Mining | `nc_get_metal_production` |
| Geography | `nc_get_public_facilities`, `nc_search_facilities`, `nc_get_vehicle_stats` |
| 2019 census | `nc_get_population_stats`, `nc_get_demographics_by_age`, `nc_get_transport_modes` |
| Tourism & transport | `nc_get_gr_trail`, `nc_get_taneo_info` (GTFS download links) |
| Whole catalog | `nc_search_datasets`, `nc_get_dataset_schema`, `nc_query_dataset` (raw ODSQL) |

**23 tools**, all read-only (`readOnlyHint`). The catalog tools reach any queryable dataset of data.gouv.nc that has no dedicated tool.

## Why This Package

- No API key required
- Official OpenDataSoft Explore v2.1 API
- Every tool is covered by a live end-to-end test against the real API
- Failures are reported to the model as `isError` results with the upstream ODSQL error, never as empty data
- User input is escaped for ODSQL (quotes, backslashes, LIKE wildcards)

## Install

```bash
npm install -g mcp-new-caledonia
```

Or run directly with:

```bash
npx mcp-new-caledonia
```

## Claude Code

```bash
claude mcp add new-caledonia -- npx -y mcp-new-caledonia
```

## Claude Desktop

```json
{
  "mcpServers": {
    "new-caledonia": {
      "command": "npx",
      "args": ["mcp-new-caledonia"]
    }
  }
}
```

## Local Development

```bash
npm install
npm run check      # lint (Biome) + typecheck + unit tests + build
npm run test:live  # end-to-end test of every tool against data.gouv.nc
npm run dev
```

## Release

1. Bump the version in `package.json` and `server.json` (they must match), update `CHANGELOG.md`.
2. Publish to npm manually: `npm publish` (runs the build through `prepack`).
3. Push the `vX.Y.Z` tag: the `Publish MCP Registry` workflow checks the versions match, runs the gate, checks the version is on npm and publishes `server.json` to the MCP Registry.

## Production Notes

- Runtime: Node.js 22+
- Transport: `stdio`
- Upstream API: `https://data.gouv.nc/api/explore/v2.1`
- Authentication: none
- Source data is mostly in French; census values are raw ISEE codes

## License

MIT
