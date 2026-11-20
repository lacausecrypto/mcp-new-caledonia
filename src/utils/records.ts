import type { RecordObject } from '../types.js';

export function str(record: RecordObject, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new Error(`Field "${key}" is not a scalar value`);
}

/** Parses numbers published as text too ("3 955", "867.0"). */
export function num(record: RecordObject, key: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[\s  ]/g, '').replace(',', '.');
    if (cleaned === '') return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Field "${key}" has non-numeric value ${JSON.stringify(value)}`);
}

export function geoPoint(record: RecordObject): { latitude: number; longitude: number } | null {
  const point = record.geo_point_2d;
  if (point === undefined || point === null) return null;
  if (
    typeof point === 'object' &&
    'lat' in point &&
    'lon' in point &&
    typeof point.lat === 'number' &&
    typeof point.lon === 'number'
  ) {
    return { latitude: point.lat, longitude: point.lon };
  }
  throw new Error('Field "geo_point_2d" has an unexpected shape');
}
