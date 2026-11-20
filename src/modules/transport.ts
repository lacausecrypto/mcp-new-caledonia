import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';

const DATASET_TANEO = 'offre-de-transport-du-reseau-taneo';

function fileEntry(value: unknown): { filename: string; url: string } {
  if (
    typeof value === 'object' &&
    value !== null &&
    'filename' in value &&
    'url' in value &&
    typeof value.filename === 'string' &&
    typeof value.url === 'string'
  ) {
    return { filename: value.filename, url: value.url };
  }
  throw new Error('Unexpected file record in the Tanéo dataset');
}

export function registerTransportTools(server: McpServer): void {
  server.registerTool(
    'nc_get_taneo_info',
    {
      annotations: READ_ONLY,
      title: 'Tanéo network GTFS feed',
      description:
        'Tanéo public transport network of Greater Nouméa: publisher, last update and direct download links of the GTFS files (stops, routes, trips, stop_times…).',
      inputSchema: {},
    },
    safe(async () => {
      const [metadata, records] = await Promise.all([
        client.getDatasetMetadata(DATASET_TANEO),
        client.getRecords(DATASET_TANEO, { limit: 100 }),
      ]);
      return {
        network_name: 'Tanéo',
        dataset_title: metadata.metas?.default?.title ?? null,
        publisher: metadata.metas?.default?.publisher ?? null,
        last_modified: metadata.metas?.default?.modified ?? null,
        format: 'GTFS',
        dataset_url: `https://data.gouv.nc/explore/dataset/${DATASET_TANEO}/`,
        gtfs_files: records.results.map((row) => fileEntry(row.file)),
      };
    }),
  );
}
