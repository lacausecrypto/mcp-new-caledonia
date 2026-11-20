import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';
import { and, eq } from '../utils/odsql.js';
import { num, str } from '../utils/records.js';

const DATASET_METAL_PRODUCTION = 'production-metallurgique-depuis-1985';

const PRODUCTS = ['FERRONICKELS', 'MATTE', 'NHC', 'NiO', 'CoCO3'] as const;

export function registerMiningTools(server: McpServer): void {
  server.registerTool(
    'nc_get_metal_production',
    {
      annotations: READ_ONLY,
      title: 'Metallurgical production',
      description:
        'Monthly metallurgical production of New Caledonia since 1985, in tonnes: ferronickel, matte, NHC (nickel hydroxide cake), NiO (nickel oxide), CoCO3 (cobalt carbonate). Most recent first.',
      inputSchema: {
        year: z.number().int().min(1985).max(2100).optional().describe('Year'),
        product: z.enum(PRODUCTS).optional().describe('Product'),
        limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
      },
    },
    safe(async ({ year, product, limit }) => {
      const data = await client.getRecords(DATASET_METAL_PRODUCTION, {
        where: and([
          year === undefined ? undefined : `annee = ${year}`,
          product === undefined ? undefined : eq('type', product),
        ]),
        order_by: 'annee desc, mois desc',
        limit,
      });
      return {
        unit: 'tonnes',
        total_records: data.total_count,
        production: data.results.map((row) => ({
          year: num(row, 'annee'),
          month: num(row, 'mois'),
          product: str(row, 'type'),
          gross_tonnage: num(row, 'tonnage_brut'),
          nickel_content_tonnage: num(row, 'tonnage_nickel_contenu'),
          cobalt_content_tonnage: num(row, 'tonnage_cobalt_contenu'),
        })),
      };
    }),
  );
}
