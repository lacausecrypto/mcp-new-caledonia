#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { VERSION } from './version.js';

async function main(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
  // stdout carries the protocol: logs go to stderr.
  console.error(
    `mcp-new-caledonia ${VERSION} running on stdio (https://data.gouv.nc/api/explore/v2.1)`,
  );
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
