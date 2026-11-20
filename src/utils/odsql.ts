/**
 * ODSQL (OpenDataSoft Explore v2.1) query building.
 * - String literals are escaped with a backslash (not by doubling the quote).
 * - The LIKE wildcard is `*`; LIKE is token-based and case/accent-insensitive.
 * - Date fields must be compared to `date'YYYY-MM-DD'` literals.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIKE_WILDCARDS = /[*?]/;

export function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function search(text: string): string {
  return `search(${quote(text)})`;
}

export function eq(field: string, value: string): string {
  return `${field} = ${quote(value)}`;
}

export function likePrefix(field: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(`Filter on "${field}" must not be empty`);
  }
  if (LIKE_WILDCARDS.test(trimmed)) {
    throw new Error(`Filter on "${field}" must not contain wildcard characters (* or ?)`);
  }
  return `${field} like ${quote(`${trimmed}*`)}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function dateLiteral(value: string): string {
  if (!isValidIsoDate(value)) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return `date'${value}'`;
}

/** Join conditions with AND, each wrapped in parentheses so OR clauses cannot leak. */
export function and(conditions: Array<string | undefined>): string | undefined {
  const valid = conditions.filter((c): c is string => c !== undefined);
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];
  return valid.map((c) => `(${c})`).join(' AND ');
}
