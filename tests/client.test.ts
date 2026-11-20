import { describe, expect, it } from 'vitest';
import { ApiError, NewCaledoniaClient } from '../src/client.js';

type Reply = { status: number; body: unknown } | Error;

function fakeFetch(replies: Reply[]) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    calls.push(String(input));
    const reply = replies.shift();
    if (reply === undefined) throw new Error('unexpected request');
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  };
  return { impl, calls };
}

function makeClient(replies: Reply[]) {
  const fake = fakeFetch(replies);
  const client = new NewCaledoniaClient({
    fetchImpl: fake.impl,
    retryDelayMs: 1,
    baseUrl: 'https://example.test/api/',
  });
  return { client, calls: fake.calls };
}

const OK = { status: 200, body: { total_count: 1, results: [{ a: 1 }] } };

describe('NewCaledoniaClient', () => {
  it('encodes the dataset id and query parameters', async () => {
    const { client, calls } = makeClient([OK]);
    await client.getRecords('a/b', { where: "x = 'é'", limit: 5, select: undefined });
    const url = new URL(calls[0] ?? '');
    expect(url.pathname).toBe('/api/catalog/datasets/a%2Fb/records');
    expect(url.searchParams.get('where')).toBe("x = 'é'");
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.has('select')).toBe(false);
  });

  it('retries 5xx / 429 / network errors, then succeeds', async () => {
    const { client, calls } = makeClient([
      { status: 503, body: {} },
      new TypeError('fetch failed'),
      OK,
    ]);
    const data = await client.getRecords('d');
    expect(data.total_count).toBe(1);
    expect(calls).toHaveLength(3);
  });

  it('gives up after maxRetries', async () => {
    const { client, calls } = makeClient([
      { status: 503, body: {} },
      { status: 503, body: {} },
      { status: 503, body: { error_code: 'Busy', message: 'try later' } },
    ]);
    await expect(client.getRecords('d')).rejects.toThrow('API error 503 Busy: try later');
    expect(calls).toHaveLength(3);
  });

  it('does not retry client errors and surfaces the ODS error', async () => {
    const { client, calls } = makeClient([
      { status: 400, body: { error_code: 'ODSQLSyntaxError', message: 'bad where' } },
    ]);
    const error = await client.getRecords('d').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400 });
    expect(String(error)).toContain('ODSQLSyntaxError: bad where');
    expect(calls).toHaveLength(1);
  });

  it('caches metadata but never caches a failure', async () => {
    const meta = { status: 200, body: { dataset_id: 'd', fields: [] } };
    const { client, calls } = makeClient([{ status: 404, body: { message: 'nope' } }, meta]);
    await expect(client.getDatasetMetadata('d')).rejects.toThrow('404');
    await expect(client.getDatasetMetadata('d')).resolves.toMatchObject({ dataset_id: 'd' });
    await expect(client.getDatasetMetadata('d')).resolves.toMatchObject({ dataset_id: 'd' });
    expect(calls).toHaveLength(2);
  });

  it('groupCount uses records + group_by and detects truncation', async () => {
    const rows = [
      { g: 'a', count: 3 },
      { g: 'b', count: 2 },
      { g: 'c', count: 1 },
    ];
    const { client, calls } = makeClient([
      { status: 200, body: { total_count: 3, results: rows } },
    ]);
    const result = await client.groupCount('d', { groupBy: 'g', limit: 2 });
    expect(result).toEqual({ rows: rows.slice(0, 2), truncated: true });
    const url = new URL(calls[0] ?? '');
    expect(url.pathname).toBe('/api/catalog/datasets/d/records');
    expect(url.searchParams.get('select')).toBe('count(*) as count');
    expect(url.searchParams.get('group_by')).toBe('g');
    expect(url.searchParams.get('order_by')).toBe('count desc');
    expect(url.searchParams.get('limit')).toBe('3');
  });
});
