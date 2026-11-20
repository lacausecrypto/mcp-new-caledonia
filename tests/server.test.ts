import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { client as apiClient } from '../src/client.js';
import { createServer } from '../src/server.js';
import { VERSION } from '../src/version.js';

const EXPECTED_TOOLS = [
  'nc_get_company',
  'nc_get_company_statistics',
  'nc_get_companies_by_sector',
  'nc_get_dataset_schema',
  'nc_get_demographics_by_age',
  'nc_get_digital_fragility_index',
  'nc_get_gr_trail',
  'nc_get_job_seeker_stats',
  'nc_get_metal_production',
  'nc_get_partial_unemployment',
  'nc_get_population_stats',
  'nc_get_public_facilities',
  'nc_get_public_holidays',
  'nc_get_taneo_info',
  'nc_get_transport_modes',
  'nc_get_upcoming_holidays',
  'nc_get_vehicle_stats',
  'nc_is_public_holiday',
  'nc_query_dataset',
  'nc_search_companies',
  'nc_search_datasets',
  'nc_search_facilities',
  'nc_search_job_offers',
].sort();

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(clientTransport);
  return mcp;
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content;
  if (!Array.isArray(content) || content[0]?.type !== 'text') throw new Error('no text content');
  return String(content[0].text);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MCP server', () => {
  it('reports the package version', async () => {
    const mcp = await connect();
    expect(mcp.getServerVersion()).toMatchObject({ name: 'mcp-new-caledonia', version: VERSION });
  });

  it('registers exactly the expected read-only tools', async () => {
    const mcp = await connect();
    const { tools } = await mcp.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_TOOLS);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.description, tool.name).toBeTruthy();
    }
  });

  it('flags API failures with isError', async () => {
    vi.spyOn(apiClient, 'getRecords').mockRejectedValue(new Error('data.gouv.nc API error 500'));
    const mcp = await connect();
    const result = await mcp.callTool({ name: 'nc_get_gr_trail', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('API error 500');
  });

  it('rejects invalid input before calling the API', async () => {
    const spy = vi.spyOn(apiClient, 'getRecords');
    const mcp = await connect();
    const result = await mcp.callTool({
      name: 'nc_is_public_holiday',
      arguments: { date: '2026-02-30' },
    });
    expect(result.isError).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses to answer outside the holiday dataset coverage', async () => {
    vi.spyOn(apiClient, 'getRecords').mockResolvedValue({
      total_count: 1,
      results: [{ from_date: '2025-01-01T00:00:00+00:00', to_date: '2030-12-25T00:00:00+00:00' }],
    });
    const mcp = await connect();
    const result = await mcp.callTool({
      name: 'nc_is_public_holiday',
      arguments: { date: '2031-01-01' },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('outside the dataset coverage');
  });

  it('maps census age ranges', async () => {
    vi.spyOn(apiClient, 'groupCount').mockResolvedValue({
      truncated: false,
      rows: [
        { age_range: '[75, *]', count: 1 },
        { age_range: '[*, 14]', count: 10 },
        { age_range: '[15, 24]', count: 5 },
      ],
    });
    const mcp = await connect();
    const result = await mcp.callTool({ name: 'nc_get_demographics_by_age', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result)).age_groups).toEqual([
      { age_range: '0-14', count: 10 },
      { age_range: '15-24', count: 5 },
      { age_range: '75+', count: 1 },
    ]);
  });
});
