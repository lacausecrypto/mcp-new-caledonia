import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';
import { geoPoint, num, str } from '../utils/records.js';

const DATASET_GR_NORTH = 'gr-province-nord';

export function registerTourismTools(server: McpServer): void {
  server.registerTool(
    'nc_get_gr_trail',
    {
      annotations: READ_ONLY,
      title: 'GR Province Nord hiking trail',
      description:
        'Segments of the GR (Grande Randonnée) long-distance hiking trail of the Province Nord, with length and a reference point per segment.',
      inputSchema: {},
    },
    safe(async () => {
      const data = await client.getRecords(DATASET_GR_NORTH, {
        order_by: 'objectid asc',
        limit: 100,
      });
      const segments = data.results.map((row) => {
        const meters = num(row, 'longueur');
        return {
          id: num(row, 'objectid'),
          name: str(row, 'nom'),
          length_km: meters === null ? null : Math.round(meters) / 1000,
          reference_point: geoPoint(row),
        };
      });
      const totalKm = segments.reduce((sum, s) => sum + (s.length_km ?? 0), 0);
      return {
        trail: 'GR Province Nord',
        total_segments: data.total_count,
        total_length_km: Math.round(totalKm * 1000) / 1000,
        segments,
      };
    }),
  );
}
