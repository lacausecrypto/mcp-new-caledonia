import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';
import type { RecordObject } from '../types.js';
import { and, eq, likePrefix, search } from '../utils/odsql.js';
import { str } from '../utils/records.js';

const DATASET_COMPANIES = 'entreprises-actives-au-ridet';
const DATASET_ESTABLISHMENTS = 'etablissements-actifs-au-ridet';

const GROUP_FIELDS = {
  province: 'province',
  commune: 'libelle_commune',
  forme_juridique: 'libelle_formjur',
  ape: 'division_naf, libelle_division_naf',
  section: 'section_naf, libelle_section_naf',
} as const;

function mapCompany(row: RecordObject) {
  return {
    ridet: str(row, 'rid7'),
    name: str(row, 'denomination'),
    legal_form: str(row, 'libelle_formjur'),
    activity_code: str(row, 'code_ape'),
    activity: str(row, 'libelle_naf'),
    naf_division: str(row, 'libelle_division_naf'),
    commune: str(row, 'libelle_commune'),
    province: str(row, 'province'),
    active_as_of: str(row, 'date_entreprises_actives'),
  };
}

/** "47" → NAF division; "4711" / "4711A" → APE code prefix. */
function sectorCondition(code: string): string {
  return code.length === 2 ? eq('division_naf', code) : likePrefix('code_ape', code);
}

const sectorSchema = z
  .string()
  .regex(/^\d{2}(\d{2}[A-Z]?)?$/, 'Expected a NAF division ("47") or APE code ("4711", "4711A")');

export function registerCompanyTools(server: McpServer): void {
  server.registerTool(
    'nc_search_companies',
    {
      annotations: READ_ONLY,
      title: 'Search companies (RIDET)',
      description:
        'Full-text search of active companies in the RIDET registry (New Caledonia equivalent of SIREN/SIRET).',
      inputSchema: {
        query: z.string().trim().min(2).max(200).describe('Search terms (name, activity…)'),
        commune: z.string().trim().min(1).max(80).optional().describe('Commune name prefix'),
        sector: sectorSchema.optional().describe('NAF division ("47") or APE code ("4711A")'),
        limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
      },
    },
    safe(async ({ query, commune, sector, limit }) => {
      const data = await client.getRecords(DATASET_COMPANIES, {
        where: and([
          search(query),
          commune === undefined ? undefined : likePrefix('libelle_commune', commune),
          sector === undefined ? undefined : sectorCondition(sector),
        ]),
        limit,
      });
      return {
        query,
        total_found: data.total_count,
        companies: data.results.map(mapCompany),
      };
    }),
  );

  server.registerTool(
    'nc_get_company',
    {
      annotations: READ_ONLY,
      title: 'Company by RIDET number',
      description:
        'Company details and its active establishments. Accepts a 7-digit RIDET or a 10-digit RIDET (company + 3-digit establishment number).',
      inputSchema: {
        ridet: z
          .string()
          .regex(/^\d{7}(\d{3})?$/, 'Expected 7 digits (company) or 10 digits (establishment)')
          .describe('RIDET number'),
      },
    },
    safe(async ({ ridet }) => {
      const rid7 = ridet.slice(0, 7);
      const requestedEstablishment = ridet.length === 10 ? ridet.slice(7) : null;

      const [companies, establishments] = await Promise.all([
        client.getRecords(DATASET_COMPANIES, {
          where: eq('rid7', rid7),
          limit: 1,
        }),
        client.getRecords(DATASET_ESTABLISHMENTS, {
          where: eq('rid7', rid7),
          order_by: 'ndegetablissement asc',
          limit: 100,
        }),
      ]);

      const company = companies.results[0];
      if (company === undefined) {
        return { found: false, ridet: rid7 };
      }

      return {
        found: true,
        company: mapCompany(company),
        requested_establishment: requestedEstablishment,
        establishments: {
          total: establishments.total_count,
          list: establishments.results.map((row) => ({
            establishment_number: str(row, 'ndegetablissement'),
            ridet: `${rid7}${str(row, 'ndegetablissement') ?? ''}`,
            sign: str(row, 'enseigne'),
            activity: str(row, 'libelle_naf'),
            commune: str(row, 'libelle_commune'),
            province: str(row, 'province'),
          })),
        },
      };
    }),
  );

  server.registerTool(
    'nc_get_companies_by_sector',
    {
      annotations: READ_ONLY,
      title: 'Companies by activity sector',
      description:
        'List active companies of a NAF division (2 digits, e.g. "07" metal ore mining, "47" retail) or APE code prefix.',
      inputSchema: {
        sector_code: sectorSchema.describe('NAF division ("47") or APE code ("4711A")'),
        commune: z.string().trim().min(1).max(80).optional().describe('Commune name prefix'),
        limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
      },
    },
    safe(async ({ sector_code, commune, limit }) => {
      const data = await client.getRecords(DATASET_COMPANIES, {
        where: and([
          sectorCondition(sector_code),
          commune === undefined ? undefined : likePrefix('libelle_commune', commune),
        ]),
        order_by: 'denomination asc',
        limit,
      });
      return {
        sector_code,
        total_companies: data.total_count,
        companies: data.results.map(mapCompany),
      };
    }),
  );

  server.registerTool(
    'nc_get_company_statistics',
    {
      annotations: READ_ONLY,
      title: 'Company counts by dimension',
      description:
        'Number of active companies grouped by province, commune, legal form, NAF division (ape) or NAF section. Sorted by count, top 100.',
      inputSchema: {
        group_by: z
          .enum(['province', 'commune', 'forme_juridique', 'ape', 'section'])
          .describe('Grouping dimension'),
      },
    },
    safe(async ({ group_by }) => {
      const result = await client.groupCount(DATASET_COMPANIES, {
        groupBy: GROUP_FIELDS[group_by],
      });
      return {
        grouped_by: group_by,
        truncated: result.truncated,
        statistics: result.rows,
      };
    }),
  );
}
