import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { READ_ONLY, safe } from '../tool.js';

const DESCRIPTION_MAX = 1500;
const datasetIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,200}$/, 'Expected a data.gouv.nc dataset identifier')
  .describe('Dataset identifier (from nc_search_datasets)');

function plainText(html: string | null | undefined): string | null {
  if (html === null || html === undefined) return null;
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX)}…` : text;
}

export function registerCatalogTools(server: McpServer): void {
  server.registerTool(
    'nc_search_datasets',
    {
      annotations: READ_ONLY,
      title: 'Search the data.gouv.nc catalog',
      description:
        'Search all datasets published on data.gouv.nc. Use it to find data not covered by the dedicated tools, then inspect with nc_get_dataset_schema and query with nc_query_dataset. Datasets with has_records=false only publish attachments and cannot be queried.',
      inputSchema: {
        query: z
          .string()
          .trim()
          .min(2)
          .max(200)
          .optional()
          .describe('Search terms (French works best)'),
        limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
      },
    },
    safe(async ({ query, limit }) => {
      const data = await client.searchDatasets(query, limit);
      return {
        total_found: data.total_count,
        datasets: data.results.map((dataset) => ({
          dataset_id: dataset.dataset_id,
          title: dataset.metas?.default?.title ?? null,
          publisher: dataset.metas?.default?.publisher ?? null,
          records_count: dataset.metas?.default?.records_count ?? null,
          has_records: dataset.has_records ?? null,
          modified: dataset.metas?.default?.modified ?? null,
          themes: dataset.metas?.default?.theme ?? [],
        })),
      };
    }),
  );

  server.registerTool(
    'nc_get_dataset_schema',
    {
      annotations: READ_ONLY,
      title: 'Dataset schema and metadata',
      description:
        'Fields (name, type, description), record count and description of a data.gouv.nc dataset.',
      inputSchema: { dataset_id: datasetIdSchema },
    },
    safe(async ({ dataset_id }) => {
      const metadata = await client.getDatasetMetadata(dataset_id);
      return {
        dataset_id: metadata.dataset_id,
        title: metadata.metas?.default?.title ?? null,
        description: plainText(metadata.metas?.default?.description),
        publisher: metadata.metas?.default?.publisher ?? null,
        modified: metadata.metas?.default?.modified ?? null,
        records_count: metadata.metas?.default?.records_count ?? null,
        has_records: metadata.has_records ?? null,
        fields: metadata.fields.map((field) => ({
          name: field.name,
          type: field.type ?? null,
          label: field.label ?? null,
          description: field.description ?? null,
        })),
      };
    }),
  );

  server.registerTool(
    'nc_query_dataset',
    {
      annotations: READ_ONLY,
      title: 'Query any dataset (ODSQL)',
      description: [
        'Run an ODSQL query on the records of any data.gouv.nc dataset (Explore API v2.1).',
        "ODSQL tips: strings in single quotes, escape quotes with a backslash (\\');",
        "LIKE uses * as wildcard and is case/accent-insensitive (commune like 'Noum*');",
        "full-text: search('terms'); dates: field >= date'2024-01-01'; year(field) = 2024;",
        "aggregation: select='count(*) as n', group_by='field', order_by='n desc'.",
      ].join(' '),
      inputSchema: {
        dataset_id: datasetIdSchema,
        select: z.string().max(1000).optional().describe('ODSQL select clause'),
        where: z.string().max(2000).optional().describe('ODSQL where clause'),
        group_by: z.string().max(1000).optional().describe('ODSQL group_by clause'),
        order_by: z.string().max(500).optional().describe('ODSQL order_by clause'),
        limit: z.number().int().min(0).max(100).default(20).describe('Max rows'),
        offset: z
          .number()
          .int()
          .min(0)
          .max(9900)
          .default(0)
          .describe('Rows to skip (offset + limit ≤ 10000)'),
      },
    },
    safe(async ({ dataset_id, select, where, group_by, order_by, limit, offset }) => {
      const data = await client.getRecords(dataset_id, {
        select,
        where,
        group_by,
        order_by,
        limit,
        offset,
      });
      return {
        dataset_id,
        total_count: data.total_count,
        results: data.results,
      };
    }),
  );
}
