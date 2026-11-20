export type RecordObject = Record<string, unknown>;

export interface ODSResponse<T extends RecordObject = RecordObject> {
  total_count: number;
  results: T[];
}

export interface ODSQueryParams {
  select?: string;
  where?: string;
  group_by?: string;
  order_by?: string;
  limit?: number;
  offset?: number;
}

export interface CatalogField {
  name: string;
  type?: string;
  label?: string;
  description?: string | null;
}

export interface DatasetMetadata {
  dataset_id: string;
  has_records?: boolean;
  features?: string[];
  fields: CatalogField[];
  metas?: {
    default?: {
      title?: string;
      description?: string | null;
      records_count?: number;
      modified?: string;
      publisher?: string;
      theme?: string[] | null;
      keyword?: string[] | null;
    };
  };
}

export interface CatalogResponse {
  total_count: number;
  results: DatasetMetadata[];
}

export interface GroupCountResult {
  rows: RecordObject[];
  /** True when more groups exist than the requested limit. */
  truncated: boolean;
}
