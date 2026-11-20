import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';
import type { RecordObject } from '../types.js';
import { and, eq, likePrefix, search } from '../utils/odsql.js';
import { geoPoint, str } from '../utils/records.js';

const DATASET_FACILITIES = 'atlas-equipements-publics-serail';
const DATASET_VEHICLES = 'vehicules-immatricules-nc';

/** Tool enum → exact `theme1` value in the SERAIL atlas. */
const FACILITY_THEMES = {
  Enseignement: 'ENSEIGNEMENT ET FORMATION',
  Sport: 'EQUIPEMENT SPORTIF',
  Administration: 'ADMINISTRATION ET ORGANISME',
  'Justice et Sécurité': 'JUSTICE SECURITE SECOURS FORCE ARMEE',
  'Culture et Socio-éducatif': 'CULTUREL ET SOCIO EDUCATIF',
  'Sanitaire et Social': 'SANITAIRE ET SOCIAL',
  'Transport et Déchet': 'TRANSPORT ET DECHET',
  Culte: 'CULTE',
  'Parcs et loisirs': 'PARC ESPACE PUBLIC ET LOISIR',
} as const;

type FacilityType = keyof typeof FACILITY_THEMES;
const FACILITY_TYPES = Object.keys(FACILITY_THEMES) as [FacilityType, ...FacilityType[]];

const VEHICLE_DATE = 'date_1ere_mise_en_circulation';
const VEHICLE_GROUPS = {
  type: 'genre',
  marque: 'marque',
  energie: 'energie',
  annee: `year(${VEHICLE_DATE}) as annee`,
  commune: 'commune_proprietaire',
} as const;

/** The atlas stores communes upper-case without accents or separators ("MONTDORE"). */
function atlasCommune(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function mapFacility(row: RecordObject) {
  return {
    name: str(row, 'lib_norme'),
    type: str(row, 'lib_court'),
    category: str(row, 'theme1'),
    subcategory: str(row, 'theme2'),
    commune: str(row, 'apparten'),
    district: str(row, 'quartier'),
    address: str(row, 'libadrs'),
    manager: str(row, 'gest_eq'),
    coordinates: geoPoint(row),
  };
}

export function registerGeographyTools(server: McpServer): void {
  server.registerTool(
    'nc_get_public_facilities',
    {
      annotations: READ_ONLY,
      title: 'Public facilities (SERAIL atlas)',
      description:
        'Public facilities from the SERAIL atlas (schools, sports, health, administration…). Covers Nouméa, Dumbéa, Mont-Dore, Païta, Boulouparis, Bourail, Koné, Koumac, Voh, Kaala-Gomen and Pouembout.',
      inputSchema: {
        type: z.enum(FACILITY_TYPES).optional().describe('Facility category'),
        commune: z.string().trim().min(1).max(80).optional().describe('Commune name'),
        limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
      },
    },
    safe(async ({ type, commune, limit }) => {
      const data = await client.getRecords(DATASET_FACILITIES, {
        where: and([
          type === undefined ? undefined : eq('theme1', FACILITY_THEMES[type]),
          commune === undefined ? undefined : likePrefix('apparten', atlasCommune(commune)),
        ]),
        order_by: 'lib_norme asc',
        limit,
      });
      return {
        total_facilities: data.total_count,
        facilities: data.results.map(mapFacility),
      };
    }),
  );

  server.registerTool(
    'nc_search_facilities',
    {
      annotations: READ_ONLY,
      title: 'Search public facilities',
      description:
        'Full-text search of public facilities in the SERAIL atlas (e.g. "piscine", "collège").',
      inputSchema: {
        query: z.string().trim().min(2).max(200).describe('Search terms'),
        limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
      },
    },
    safe(async ({ query, limit }) => {
      const data = await client.getRecords(DATASET_FACILITIES, {
        where: search(query),
        limit,
      });
      return {
        query,
        total_found: data.total_count,
        facilities: data.results.map(mapFacility),
      };
    }),
  );

  server.registerTool(
    'nc_get_vehicle_stats',
    {
      annotations: READ_ONLY,
      title: 'Registered vehicle statistics',
      description:
        'Number of registered vehicles grouped by type (genre), make, energy, first-registration year or owner commune. Includes every registration in the dataset. Top 100 groups by count.',
      inputSchema: {
        group_by: z
          .enum(['type', 'marque', 'energie', 'annee', 'commune'])
          .default('type')
          .describe('Grouping dimension'),
        vehicle_type: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .optional()
          .describe('Vehicle type (genre) prefix, e.g. "VOITURE PARTICULIERE", "CAMIONNETTE"'),
        year: z.number().int().min(1900).max(2100).optional().describe('First registration year'),
      },
    },
    safe(async ({ group_by, vehicle_type, year }) => {
      const result = await client.groupCount(DATASET_VEHICLES, {
        groupBy: VEHICLE_GROUPS[group_by],
        where: and([
          vehicle_type === undefined ? undefined : likePrefix('genre', vehicle_type),
          year === undefined ? undefined : `year(${VEHICLE_DATE}) = ${year}`,
        ]),
        orderBy: group_by === 'annee' ? 'annee desc' : 'count desc',
      });
      return {
        grouped_by: group_by,
        truncated: result.truncated,
        statistics: result.rows,
      };
    }),
  );
}
