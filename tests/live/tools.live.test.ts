/**
 * End-to-end smoke test of every tool against the live data.gouv.nc API.
 * Run with `npm run test:live`. Each case asserts real data, not just "no error":
 * an empty result where data exists is the failure mode this suite guards against.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../../src/server.js';

let mcp: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  mcp = new Client({ name: 'live-test', version: '0' });
  await mcp.connect(clientTransport);
});

type Json = Record<string, unknown>;

async function call(name: string, args: Json = {}): Promise<Json> {
  const result = await mcp.callTool({ name, arguments: args });
  const content = result.content;
  if (!Array.isArray(content) || content[0]?.type !== 'text') throw new Error('no text content');
  const text = String(content[0].text);
  if (result.isError) throw new Error(`${name} returned isError: ${text}`);
  return JSON.parse(text) as Json;
}

function list(value: unknown): Json[] {
  if (!Array.isArray(value)) throw new Error(`expected array, got ${JSON.stringify(value)}`);
  return value as Json[];
}

describe('administration', () => {
  it('nc_get_public_holidays', async () => {
    const r = await call('nc_get_public_holidays', { year: 2026 });
    const holidays = list(r.holidays);
    expect(holidays.length).toBeGreaterThanOrEqual(10);
    expect(holidays.map((h) => h.date)).toContain('2026-09-24');
  });

  it('nc_is_public_holiday (24 September)', async () => {
    const r = await call('nc_is_public_holiday', { date: '2026-09-24' });
    expect(r.is_public_holiday).toBe(true);
    const r2 = await call('nc_is_public_holiday', { date: '2026-09-23' });
    expect(r2.is_public_holiday).toBe(false);
  });

  it('nc_get_upcoming_holidays', async () => {
    const r = await call('nc_get_upcoming_holidays', { limit: 3 });
    const items = list(r.upcoming_holidays);
    expect(items).toHaveLength(3);
    expect(Number(items[0]?.days_until)).toBeGreaterThanOrEqual(0);
  });

  it('nc_get_digital_fragility_index', async () => {
    const all = await call('nc_get_digital_fragility_index');
    expect(all.total_communes).toBe(33);
    for (const row of list(all.results)) expect(typeof row.population).toBe('number');
    const iles = await call('nc_get_digital_fragility_index', { province: 'Iles' });
    expect(iles.total_communes).toBe(3);
    const kou = await call('nc_get_digital_fragility_index', { commune: 'kouaoua' });
    expect(kou.total_communes).toBe(1);
  });
});

describe('companies', () => {
  it('nc_search_companies with commune, sector and an apostrophe', async () => {
    const r = await call('nc_search_companies', { query: 'nickel', commune: 'Nouméa', limit: 5 });
    expect(Number(r.total_found)).toBeGreaterThan(0);
    for (const c of list(r.companies)) expect(c.commune).toBe('Nouméa');
    const apostrophe = await call('nc_search_companies', { query: "l'île des pins", limit: 1 });
    expect(Number(apostrophe.total_found)).toBeGreaterThan(0);
  });

  it('nc_get_company', async () => {
    const r = await call('nc_get_company', { ridet: '0649913' });
    expect(r.found).toBe(true);
    const establishments = r.establishments as Json;
    expect(Number(establishments.total)).toBeGreaterThan(0);
    expect(list(establishments.list)[0]?.ridet).toMatch(/^0649913\d{3}$/);
    const missing = await call('nc_get_company', { ridet: '0000000' });
    expect(missing.found).toBe(false);
  });

  it('nc_get_companies_by_sector', async () => {
    const division = await call('nc_get_companies_by_sector', { sector_code: '07', limit: 5 });
    expect(Number(division.total_companies)).toBeGreaterThan(0);
    const ape = await call('nc_get_companies_by_sector', { sector_code: '4711', limit: 5 });
    for (const c of list(ape.companies)) expect(String(c.activity_code)).toMatch(/^4711/);
  });

  it('nc_get_company_statistics', async () => {
    const r = await call('nc_get_company_statistics', { group_by: 'province' });
    expect(list(r.statistics).length).toBeGreaterThanOrEqual(3);
    const ape = await call('nc_get_company_statistics', { group_by: 'ape' });
    expect(list(ape.statistics)[0]).toHaveProperty('libelle_division_naf');
  });
});

describe('employment', () => {
  it('nc_search_job_offers with commune and contract filters', async () => {
    const r = await call('nc_search_job_offers', {
      commune: 'Nouméa',
      contract_type: 'CDD',
      limit: 5,
    });
    expect(Number(r.total_offers)).toBeGreaterThan(0);
    for (const o of list(r.job_offers)) {
      expect(o.contract).toBe('CDD');
      expect(o.commune).toBe('NOUMEA');
    }
  });

  it('nc_get_job_seeker_stats', async () => {
    const r = await call('nc_get_job_seeker_stats', { group_by: 'genre' });
    expect(list(r.statistics).length).toBeGreaterThanOrEqual(2);
    const y = await call('nc_get_job_seeker_stats', { group_by: 'niveau', year: 2020 });
    expect(list(y.statistics).length).toBeGreaterThan(0);
  });

  it('nc_get_partial_unemployment for every scheme', async () => {
    for (const scheme of ['commun', 'nickel', 'evenements_mai_2024', 'renouvellement_2024']) {
      const r = await call('nc_get_partial_unemployment', { scheme, limit: 1 });
      expect(Number(r.total_records), scheme).toBeGreaterThan(0);
    }
  });
});

describe('mining', () => {
  it('nc_get_metal_production', async () => {
    const r = await call('nc_get_metal_production', { product: 'FERRONICKELS', limit: 3 });
    const rows = list(r.production);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.product).toBe('FERRONICKELS');
  });
});

describe('geography', () => {
  it('nc_get_public_facilities for every category and a hyphenated commune', async () => {
    for (const type of [
      'Enseignement',
      'Sport',
      'Administration',
      'Justice et Sécurité',
      'Culture et Socio-éducatif',
      'Sanitaire et Social',
      'Transport et Déchet',
      'Culte',
      'Parcs et loisirs',
    ]) {
      const r = await call('nc_get_public_facilities', { type, limit: 1 });
      expect(Number(r.total_facilities), type).toBeGreaterThan(0);
    }
    const md = await call('nc_get_public_facilities', { commune: 'Mont-Dore', limit: 1 });
    expect(Number(md.total_facilities)).toBeGreaterThan(0);
  });

  it('nc_search_facilities', async () => {
    const r = await call('nc_search_facilities', { query: 'piscine', limit: 3 });
    expect(Number(r.total_found)).toBeGreaterThan(0);
  });

  it('nc_get_vehicle_stats', async () => {
    const r = await call('nc_get_vehicle_stats', { group_by: 'type', year: 2020 });
    expect(list(r.statistics).length).toBeGreaterThan(0);
    const years = await call('nc_get_vehicle_stats', { group_by: 'annee' });
    expect(list(years.statistics)[0]).toHaveProperty('annee');
  });
});

describe('population', () => {
  it('nc_get_population_stats', async () => {
    const r = await call('nc_get_population_stats', { group_by: 'province' });
    const total = list(r.statistics).reduce((sum, row) => sum + Number(row.count), 0);
    expect(total).toBe(271407);
    const dipl = await call('nc_get_population_stats', { group_by: 'diplome' });
    expect(list(dipl.statistics).length).toBeGreaterThan(10);
  });

  it('nc_get_demographics_by_age', async () => {
    const r = await call('nc_get_demographics_by_age', { province: 'Sud' });
    const groups = list(r.age_groups);
    expect(groups.map((g) => g.age_range)).toEqual([
      '0-14',
      '15-24',
      '25-39',
      '40-59',
      '60-74',
      '75+',
    ]);
  });

  it('nc_get_transport_modes', async () => {
    const r = await call('nc_get_transport_modes');
    expect(list(r.transport_modes).length).toBeGreaterThan(1);
  });
});

describe('tourism & transport', () => {
  it('nc_get_gr_trail', async () => {
    const r = await call('nc_get_gr_trail');
    expect(list(r.segments).length).toBeGreaterThan(0);
    expect(Number(r.total_length_km)).toBeGreaterThan(0);
  });

  it('nc_get_taneo_info', async () => {
    const r = await call('nc_get_taneo_info');
    const files = list(r.gtfs_files).map((f) => f.filename);
    expect(files).toContain('stops.txt');
  });
});

describe('catalog', () => {
  it('nc_search_datasets', async () => {
    const r = await call('nc_search_datasets', { query: 'emploi', limit: 5 });
    expect(list(r.datasets).length).toBeGreaterThan(0);
  });

  it('nc_get_dataset_schema', async () => {
    const r = await call('nc_get_dataset_schema', { dataset_id: 'jours-feries-en-nc' });
    expect(list(r.fields).map((f) => f.name)).toContain('jour_ferie');
  });

  it('nc_query_dataset', async () => {
    const r = await call('nc_query_dataset', {
      dataset_id: 'jours-feries-en-nc',
      select: 'count(*) as n',
      where: 'year(jour_ferie) = 2026',
    });
    expect(Number(list(r.results)[0]?.n)).toBeGreaterThan(0);
  });

  it('nc_query_dataset surfaces ODSQL errors', async () => {
    const result = await mcp.callTool({
      name: 'nc_query_dataset',
      arguments: { dataset_id: 'jours-feries-en-nc', where: 'nope ===' },
    });
    expect(result.isError).toBe(true);
  });
});
