import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';
import type { RecordObject } from '../types.js';
import { daysBetween, isoDay, todayInNewCaledonia } from '../utils/dates.js';
import { and, dateLiteral, isValidIsoDate, likePrefix } from '../utils/odsql.js';
import { num, str } from '../utils/records.js';

const DATASET_HOLIDAYS = 'jours-feries-en-nc';
const DATASET_DIGITAL_INDEX = 'data_ifn_nc';

const PROVINCES = ['Sud', 'Nord', 'Iles'] as const;

function mapHoliday(row: RecordObject) {
  const date = str(row, 'jour_ferie');
  if (date === null) throw new Error('Holiday record without date');
  return {
    date,
    name: str(row, 'nom_jour_ferie'),
    type: str(row, 'type'),
    zone: str(row, 'zone'),
  };
}

async function holidayCoverage(): Promise<{ from: string; to: string }> {
  const data = await client.getRecords(DATASET_HOLIDAYS, {
    select: 'min(jour_ferie) as from_date, max(jour_ferie) as to_date',
    limit: 1,
  });
  const row = data.results[0];
  const from = row ? str(row, 'from_date') : null;
  const to = row ? str(row, 'to_date') : null;
  if (from === null || to === null) throw new Error('Holiday dataset is empty');
  return { from: isoDay(from), to: isoDay(to) };
}

export function registerAdministrationTools(server: McpServer): void {
  server.registerTool(
    'nc_get_public_holidays',
    {
      annotations: READ_ONLY,
      title: 'Public holidays by year',
      description:
        'List public holidays in New Caledonia for a year (they differ from mainland France, e.g. 24 September). The dataset only covers a limited range of years; an empty list means the year is not published.',
      inputSchema: {
        year: z
          .number()
          .int()
          .min(2000)
          .max(2100)
          .optional()
          .describe('Year (default: current year in New Caledonia)'),
      },
    },
    safe(async ({ year }) => {
      const targetYear = year ?? Number(todayInNewCaledonia().slice(0, 4));
      const data = await client.getRecords(DATASET_HOLIDAYS, {
        where: `jour_ferie >= ${dateLiteral(`${targetYear}-01-01`)} AND jour_ferie <= ${dateLiteral(`${targetYear}-12-31`)}`,
        order_by: 'jour_ferie asc',
        limit: 100,
      });
      return {
        year: targetYear,
        total_holidays: data.total_count,
        holidays: data.results.map(mapHoliday),
      };
    }),
  );

  server.registerTool(
    'nc_is_public_holiday',
    {
      annotations: READ_ONLY,
      title: 'Is this date a public holiday?',
      description:
        'Check whether a date is a public holiday in New Caledonia. Fails if the date is outside the years covered by the dataset.',
      inputSchema: {
        date: z
          .string()
          .refine(isValidIsoDate, 'Expected a valid date in YYYY-MM-DD format')
          .describe('Date to check (YYYY-MM-DD)'),
      },
    },
    safe(async ({ date }) => {
      const coverage = await holidayCoverage();
      if (
        date.slice(0, 4) < coverage.from.slice(0, 4) ||
        date.slice(0, 4) > coverage.to.slice(0, 4)
      ) {
        throw new Error(
          `Date ${date} is outside the dataset coverage (${coverage.from} → ${coverage.to}); cannot tell.`,
        );
      }
      const data = await client.getRecords(DATASET_HOLIDAYS, {
        where: `jour_ferie = ${dateLiteral(date)}`,
        limit: 1,
      });
      const row = data.results[0];
      return {
        date,
        is_public_holiday: row !== undefined,
        holiday: row === undefined ? null : mapHoliday(row),
      };
    }),
  );

  server.registerTool(
    'nc_get_upcoming_holidays',
    {
      annotations: READ_ONLY,
      title: 'Upcoming public holidays',
      description: 'Next public holidays in New Caledonia from today (New Caledonia time, UTC+11).',
      inputSchema: {
        limit: z.number().int().min(1).max(20).default(5).describe('Number of holidays to return'),
      },
    },
    safe(async ({ limit }) => {
      const today = todayInNewCaledonia();
      const data = await client.getRecords(DATASET_HOLIDAYS, {
        where: `jour_ferie >= ${dateLiteral(today)}`,
        order_by: 'jour_ferie asc',
        limit,
      });
      return {
        from_date: today,
        upcoming_holidays: data.results.map((row) => {
          const holiday = mapHoliday(row);
          return { ...holiday, days_until: daysBetween(today, holiday.date) };
        }),
      };
    }),
  );

  server.registerTool(
    'nc_get_digital_fragility_index',
    {
      annotations: READ_ONLY,
      title: 'Digital fragility index by commune',
      description:
        'Digital fragility index (IFN) of the 33 communes of New Caledonia, sorted by contextualized score (higher = higher risk of digital exclusion), with coverage and socio-economic indicators.',
      inputSchema: {
        commune: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .optional()
          .describe('Commune name prefix (case/accent-insensitive)'),
        province: z.enum(PROVINCES).optional().describe('Province'),
      },
    },
    safe(async ({ commune, province }) => {
      const data = await client.getRecords(DATASET_DIGITAL_INDEX, {
        where: and([
          commune === undefined ? undefined : likePrefix('nom_com', commune),
          province === undefined ? undefined : likePrefix('province', province),
        ]),
        order_by: 'ifn_contextualise desc',
        limit: 100,
      });
      return {
        total_communes: data.total_count,
        results: data.results.map((row) => ({
          commune: str(row, 'nom_com'),
          province: str(row, 'province'),
          area: str(row, 'eth'),
          score_contextualized: num(row, 'ifn_contextualise'),
          score_raw: num(row, 'ifn'),
          population: num(row, 'population_legale'),
          density_per_km2: num(row, 'densite'),
          no_very_high_speed_coverage_rate: num(row, 'taux_de_non_couverture_thd'),
          no_4g_coverage_rate: num(row, 'taux_de_non_couverture_mobile_4g'),
          poverty_rate: num(row, 'taux_de_pauvrete'),
        })),
      };
    }),
  );
}
