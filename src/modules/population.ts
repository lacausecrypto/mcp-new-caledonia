import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';
import { eq } from '../utils/odsql.js';
import { num, str } from '../utils/records.js';

const DATASET_CENSUS = 'recensement-de-la-population-2019-individus-nc';
const CENSUS_YEAR = 2019;
const CODES_NOTE =
  'Values are raw ISEE census codes (see the dataset documentation on data.gouv.nc for labels); null = not applicable.';

const PROVINCES = ['Sud', 'Nord', 'Iles'] as const;

const GROUP_FIELDS = {
  province: 'prov',
  sexe: 'genre',
  diplome: 'dipl',
  activite: 'empl',
  transport_principal: 'trans',
} as const;

const provinceSchema = z.enum(PROVINCES).optional().describe('Province');

function provinceFilter(province: (typeof PROVINCES)[number] | undefined): string | undefined {
  return province === undefined ? undefined : eq('prov', province);
}

/** "[*, 14]" → 0-14, "[15, 24]" → 15-24, "[75, *]" → 75+ */
function parseAgeRange(range: string): { label: string; low: number } {
  const match = /^\[(\*|\d+), (\*|\d+)\]$/.exec(range);
  if (!match?.[1] || !match[2]) throw new Error(`Unexpected age range "${range}"`);
  const low = match[1] === '*' ? 0 : Number(match[1]);
  const label = match[2] === '*' ? `${low}+` : `${low}-${match[2]}`;
  return { label, low };
}

export function registerPopulationTools(server: McpServer): void {
  server.registerTool(
    'nc_get_population_stats',
    {
      annotations: READ_ONLY,
      title: 'Census 2019 statistics',
      description: `Population counts from the exhaustive 2019 census of New Caledonia (271,407 individuals), grouped by province, sex, diploma, employment condition or main transport mode. ${CODES_NOTE}`,
      inputSchema: {
        province: provinceSchema,
        group_by: z
          .enum(['province', 'sexe', 'diplome', 'activite', 'transport_principal'])
          .default('province')
          .describe('Grouping dimension'),
      },
    },
    safe(async ({ province, group_by }) => {
      const field = GROUP_FIELDS[group_by];
      const result = await client.groupCount(DATASET_CENSUS, {
        groupBy: field,
        where: provinceFilter(province),
        orderBy: `${field} asc`,
      });
      return {
        census_year: CENSUS_YEAR,
        province: province ?? null,
        grouped_by: group_by,
        source_field: field,
        note: group_by === 'province' || group_by === 'sexe' ? undefined : CODES_NOTE,
        statistics: result.rows,
      };
    }),
  );

  server.registerTool(
    'nc_get_demographics_by_age',
    {
      annotations: READ_ONLY,
      title: 'Census 2019 age pyramid',
      description:
        'Population by age group (0-14, 15-24, 25-39, 40-59, 60-74, 75+) from the 2019 census.',
      inputSchema: { province: provinceSchema },
    },
    safe(async ({ province }) => {
      const result = await client.groupCount(DATASET_CENSUS, {
        groupBy: 'range(agea, *, 15, 25, 40, 60, 75, *) as age_range',
        where: provinceFilter(province),
        // ODSQL cannot order on a range() expression: sort by lower bound below.
        orderBy: null,
      });
      const groups = result.rows.map((row) => {
        const range = str(row, 'age_range');
        if (range === null) throw new Error('Census row without age range');
        return { ...parseAgeRange(range), count: num(row, 'count') };
      });
      groups.sort((a, b) => a.low - b.low);
      return {
        census_year: CENSUS_YEAR,
        province: province ?? null,
        age_groups: groups.map(({ label, count }) => ({ age_range: label, count })),
      };
    }),
  );

  server.registerTool(
    'nc_get_transport_modes',
    {
      annotations: READ_ONLY,
      title: 'Census 2019 transport modes',
      description: `Main transport mode used by the population (2019 census). ${CODES_NOTE}`,
      inputSchema: { province: provinceSchema },
    },
    safe(async ({ province }) => {
      const result = await client.groupCount(DATASET_CENSUS, {
        groupBy: 'trans',
        where: provinceFilter(province),
        orderBy: 'trans asc',
      });
      return {
        census_year: CENSUS_YEAR,
        province: province ?? null,
        source_field: 'trans',
        note: CODES_NOTE,
        transport_modes: result.rows,
      };
    }),
  );
}
