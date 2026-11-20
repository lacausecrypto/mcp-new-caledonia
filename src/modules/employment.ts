import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';
import { and, dateLiteral, eq, likePrefix, search } from '../utils/odsql.js';
import { num, str } from '../utils/records.js';

const DATASET_JOB_OFFERS = 'offres-d-emploi-deposees-sur-le-site-emploi-nc';
const DATASET_JOB_SEEKERS = 'demandeurs_emploi';
const DATASET_PARTIAL_UNEMPLOYMENT = 'entreprises_chomage_partiel';

const CONTRACT_TYPES = [
  'CDI',
  'CDD',
  'CDIC',
  'INTERIM',
  'ALTERNANCE',
  'STAGE',
  'CONTRAT AIDE',
  'INTERMITTENT/SAISONNIER',
] as const;

const JOB_SEEKER_GROUPS = {
  niveau: 'niveau',
  genre: 'genre',
  metier_recherche: 'code_rome_recherche',
  annee: 'year(annee) as annee',
} as const;

const PARTIAL_UNEMPLOYMENT_SCHEMES = {
  commun: 'CHP COMMUN',
  nickel: 'CHP NICKEL',
  evenements_mai_2024: 'CHP EVENEMENT MAI 2024',
  renouvellement_2024: 'RENOUVELLEMENT EVENEMENTS 2024',
} as const;

type Scheme = keyof typeof PARTIAL_UNEMPLOYMENT_SCHEMES;
const SCHEME_KEYS = Object.keys(PARTIAL_UNEMPLOYMENT_SCHEMES) as [Scheme, ...Scheme[]];

export function registerEmploymentTools(server: McpServer): void {
  server.registerTool(
    'nc_search_job_offers',
    {
      annotations: READ_ONLY,
      title: 'Search job offers',
      description:
        'Job offers posted on emploi.nc, the official New Caledonia employment portal, most recent first.',
      inputSchema: {
        query: z.string().trim().min(2).max(200).optional().describe('Search terms'),
        commune: z.string().trim().min(1).max(80).optional().describe('Commune name prefix'),
        contract_type: z.enum(CONTRACT_TYPES).optional().describe('Contract type'),
        limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
      },
    },
    safe(async ({ query, commune, contract_type, limit }) => {
      const data = await client.getRecords(DATASET_JOB_OFFERS, {
        where: and([
          query === undefined ? undefined : search(query),
          commune === undefined ? undefined : likePrefix('ville', commune),
          contract_type === undefined ? undefined : eq('type_contrat', contract_type),
        ]),
        order_by: 'created_at desc',
        limit,
      });
      return {
        total_offers: data.total_count,
        job_offers: data.results.map((row) => ({
          reference: str(row, 'uuid'),
          title: str(row, 'titre'),
          employer: str(row, 'designation') ?? str(row, 'enseigne'),
          commune: str(row, 'ville'),
          contract: str(row, 'type_contrat'),
          positions: num(row, 'nb_postes'),
          rome_code: str(row, 'rome_code'),
          required_diploma: str(row, 'diplome'),
          experience: str(row, 'experience'),
          status: str(row, 'statut'),
          start_date: str(row, 'date_debut'),
          published: str(row, 'created_at'),
        })),
      };
    }),
  );

  server.registerTool(
    'nc_get_job_seeker_stats',
    {
      annotations: READ_ONLY,
      title: 'Job seeker statistics',
      description:
        'Number of registered job seekers grouped by education level (niveau), gender (genre), sought occupation (ROME code) or registration year (annee). Top 100 groups by count.',
      inputSchema: {
        group_by: z
          .enum(['niveau', 'genre', 'metier_recherche', 'annee'])
          .default('niveau')
          .describe('Grouping dimension'),
        year: z
          .number()
          .int()
          .min(1970)
          .max(2100)
          .optional()
          .describe('Only job seekers registered this year'),
      },
    },
    safe(async ({ group_by, year }) => {
      const result = await client.groupCount(DATASET_JOB_SEEKERS, {
        groupBy: JOB_SEEKER_GROUPS[group_by],
        where:
          year === undefined
            ? undefined
            : `annee >= ${dateLiteral(`${year}-01-01`)} AND annee <= ${dateLiteral(`${year}-12-31`)}`,
        orderBy: group_by === 'annee' ? 'annee asc' : 'count desc',
      });
      return {
        grouped_by: group_by,
        year: year ?? null,
        truncated: result.truncated,
        statistics: result.rows,
      };
    }),
  );

  server.registerTool(
    'nc_get_partial_unemployment',
    {
      annotations: READ_ONLY,
      title: 'Partial unemployment schemes',
      description:
        'Companies benefiting from partial unemployment (chômage partiel) schemes: common law, nickel crisis, May 2024 civil unrest and its renewals. Most recent first.',
      inputSchema: {
        scheme: z.enum(SCHEME_KEYS).optional().describe('Scheme'),
        commune: z.string().trim().min(1).max(80).optional().describe('Commune name prefix'),
        limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
      },
    },
    safe(async ({ scheme, commune, limit }) => {
      const data = await client.getRecords(DATASET_PARTIAL_UNEMPLOYMENT, {
        where: and([
          scheme === undefined
            ? undefined
            : eq('type_de_chp', PARTIAL_UNEMPLOYMENT_SCHEMES[scheme]),
          commune === undefined ? undefined : likePrefix('libelle_commune', commune),
        ]),
        order_by: 'date_debut desc',
        limit,
      });
      return {
        scheme: scheme ?? 'all',
        total_records: data.total_count,
        companies: data.results.map((row) => ({
          ridet: str(row, 'ridet'),
          name: str(row, 'raison_sociale'),
          sign: str(row, 'enseigne'),
          activity: str(row, 'naf_libelle'),
          commune: str(row, 'libelle_commune'),
          province: str(row, 'province'),
          scheme: str(row, 'type_de_chp'),
          employees_concerned: num(row, 'nb_salaries_concernes'),
          start_date: str(row, 'date_debut'),
          end_date: str(row, 'date_fin'),
          decree: str(row, 'numero_arrete'),
          decree_date: str(row, 'date_arrete'),
        })),
      };
    }),
  );
}
