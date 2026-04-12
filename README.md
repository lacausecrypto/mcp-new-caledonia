# mcp-new-caledonia

[![CI](https://img.shields.io/github/actions/workflow/status/lacausecrypto/mcp-new-caledonia/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/lacausecrypto/mcp-new-caledonia/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/mcp-new-caledonia?style=flat-square)](https://www.npmjs.com/package/mcp-new-caledonia)
[![npm total downloads](https://img.shields.io/npm/dt/mcp-new-caledonia?style=flat-square)](https://www.npmjs.com/package/mcp-new-caledonia)
[![node version](https://img.shields.io/node/v/mcp-new-caledonia?style=flat-square)](https://www.npmjs.com/package/mcp-new-caledonia)
[![license](https://img.shields.io/github/license/lacausecrypto/mcp-new-caledonia?style=flat-square)](https://github.com/lacausecrypto/mcp-new-caledonia/blob/main/LICENSE)

Compact MCP server for [data.gouv.nc](https://data.gouv.nc/), exposing New Caledonia public datasets over `stdio` for Claude Desktop and other MCP clients.

## What It Covers

- Public holidays
- Digital fragility index
- RIDET companies and establishments
- Employment and job market datasets
- Weather and rain station datasets
- Mining and metallurgical production
- Environment and coral reef monitoring
- Public facilities and vehicle statistics
- 2019 population census
- Tourism trails and Tanéo transport metadata

The server currently registers **29 tools** across **10 modules**.

## Why This Package

- No API key required
- Uses the official OpenDataSoft Explore v2.1 API
- Handles real-world schema drift in live datasets
- Returns explicit notes when a catalog entry exists but exposes no tabular records
- Ships as a simple Node.js CLI for MCP-compatible hosts

## Install

```bash
npm install -g mcp-new-caledonia
```

Or run directly with:

```bash
npx mcp-new-caledonia
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

## Tool Groups

- `administration`: holidays, holiday checks, upcoming holidays, digital fragility
- `companies`: company search, company lookup, sector search, aggregates
- `employment`: job offers, job seeker stats, civil servants, partial unemployment
- `weather`: weather stations, rain stations
- `mining`: mining titles, metal production, Nickel Fund sites
- `environment`: water catchments, dry forest, piezometers, reef stations
- `geography`: public facilities, facility search, vehicle statistics
- `population`: census statistics, age demographics, transport modes
- `tourism`: GR trail data
- `transport`: Tanéo network information

## Local Development

```bash
npm install
npm run build
npm test
npm run dev
```

## Production Notes

- Runtime: Node.js 18+
- Transport: `stdio`
- Upstream API: `https://data.gouv.nc/api/explore/v2.1`
- Authentication: none
- Language of source data: mostly French
- Some datasets in the catalog are metadata-only or attachment-only; the server reports this cleanly instead of failing silently

## License

MIT
