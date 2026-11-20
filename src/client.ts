import type {
  CatalogResponse,
  DatasetMetadata,
  GroupCountResult,
  ODSQueryParams,
  ODSResponse,
  RecordObject,
} from './types.js';
import { search } from './utils/odsql.js';
import { SERVER_NAME, VERSION } from './version.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ERROR_BODY = 500;

/**
 * HTTP client for the OpenDataSoft Explore v2.1 API of data.gouv.nc (no auth).
 */
export class NewCaledoniaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly metadataCache = new Map<string, Promise<DatasetMetadata>>();

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://data.gouv.nc/api/explore/v2.1/';
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 250;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getRecords<T extends RecordObject = RecordObject>(
    datasetId: string,
    params: ODSQueryParams = {},
  ): Promise<ODSResponse<T>> {
    return this.fetchJson<ODSResponse<T>>(
      this.buildUrl(`catalog/datasets/${encodeURIComponent(datasetId)}/records`, params),
    );
  }

  /**
   * Count records per group (the v2.1 replacement for the removed /aggregates endpoint).
   * `groupBy` accepts plain fields or expressions such as `year(date) as annee`.
   */
  async groupCount(
    datasetId: string,
    options: {
      groupBy: string;
      where?: string;
      /** null = no ordering (required for computed groups such as range()). */
      orderBy?: string | null;
      limit?: number;
    },
  ): Promise<GroupCountResult> {
    const limit = options.limit ?? 100;
    const data = await this.getRecords(datasetId, {
      select: 'count(*) as count',
      group_by: options.groupBy,
      where: options.where,
      order_by: options.orderBy === null ? undefined : (options.orderBy ?? 'count desc'),
      limit: limit + 1,
    });
    return {
      rows: data.results.slice(0, limit),
      truncated: data.results.length > limit,
    };
  }

  async searchDatasets(query: string | undefined, limit: number): Promise<CatalogResponse> {
    return this.fetchJson<CatalogResponse>(
      this.buildUrl('catalog/datasets', {
        where: query ? search(query) : undefined,
        order_by: 'modified desc',
        limit,
      }),
    );
  }

  /** Dataset metadata; throws ApiError(404) when the dataset does not exist. Successes are cached. */
  async getDatasetMetadata(datasetId: string): Promise<DatasetMetadata> {
    const cached = this.metadataCache.get(datasetId);
    if (cached) return cached;

    const promise = this.fetchJson<DatasetMetadata>(
      this.buildUrl(`catalog/datasets/${encodeURIComponent(datasetId)}`, {}),
    );
    this.metadataCache.set(datasetId, promise);
    // Never keep a failed lookup: a transient error must not poison the process.
    promise.catch(() => this.metadataCache.delete(datasetId));
    return promise;
  }

  private buildUrl(path: string, params: ODSQueryParams): string {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async fetchJson<T>(url: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < this.maxRetries;
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': `${SERVER_NAME}/${VERSION}`,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        if (canRetry) {
          await this.backoff(attempt);
          continue;
        }
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new Error(`Request timed out after ${this.timeoutMs}ms: ${url}`);
        }
        throw error;
      }

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (RETRYABLE_STATUS.has(response.status) && canRetry) {
        await response.body?.cancel();
        await this.backoff(attempt);
        continue;
      }

      throw new ApiError(response.status, await this.describeError(response));
    }
  }

  private async describeError(response: Response): Promise<string> {
    const body = await response.text();
    try {
      const parsed: unknown = JSON.parse(body);
      if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) {
        const code = 'error_code' in parsed ? ` ${String(parsed.error_code)}` : '';
        return `data.gouv.nc API error ${response.status}${code}: ${String(parsed.message)}`;
      }
    } catch {
      // Non-JSON body: fall through to the raw excerpt.
    }
    return `data.gouv.nc API error ${response.status}: ${body.slice(0, MAX_ERROR_BODY)}`;
  }

  private backoff(attempt: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * 2 ** attempt));
  }
}

export const client = new NewCaledoniaClient();
