import { describe, expect, it } from 'vitest';
import { daysBetween, todayInNewCaledonia } from '../src/utils/dates.js';
import {
  and,
  dateLiteral,
  eq,
  isValidIsoDate,
  likePrefix,
  quote,
  search,
} from '../src/utils/odsql.js';
import { geoPoint, num, str } from '../src/utils/records.js';

describe('odsql', () => {
  it('escapes quotes and backslashes with a backslash', () => {
    expect(quote("L'Île-des-Pins")).toBe("'L\\'Île-des-Pins'");
    expect(quote('a\\b')).toBe("'a\\\\b'");
    expect(quote("x\\'")).toBe("'x\\\\\\''");
  });

  it('cannot be broken out of with an injected clause', () => {
    const clause = search("x') OR search('y");
    expect(clause).toBe("search('x\\') OR search(\\'y')");
  });

  it('builds prefix LIKE with the * wildcard', () => {
    expect(likePrefix('ville', ' Nouméa ')).toBe("ville like 'Nouméa*'");
    expect(() => likePrefix('ville', 'No*')).toThrow(/wildcard/);
    expect(() => likePrefix('ville', 'No?')).toThrow(/wildcard/);
    expect(() => likePrefix('ville', '  ')).toThrow(/empty/);
  });

  it('builds equality', () => {
    expect(eq('type_contrat', 'CDD')).toBe("type_contrat = 'CDD'");
  });

  it('validates dates', () => {
    expect(isValidIsoDate('2026-09-24')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-9-24')).toBe(false);
    expect(dateLiteral('2026-09-24')).toBe("date'2026-09-24'");
    expect(() => dateLiteral("2026-01-01' OR 1=1")).toThrow(/Invalid date/);
  });

  it('joins conditions with parenthesised AND', () => {
    expect(and([])).toBeUndefined();
    expect(and([undefined, 'a = 1'])).toBe('a = 1');
    expect(and(['a = 1 OR b = 2', undefined, 'c = 3'])).toBe('(a = 1 OR b = 2) AND (c = 3)');
  });
});

describe('records', () => {
  it('parses numbers published as text', () => {
    expect(num({ v: '3 955' }, 'v')).toBe(3955);
    expect(num({ v: '867.0' }, 'v')).toBe(867);
    expect(num({ v: '1 304' }, 'v')).toBe(1304);
    expect(num({ v: 12.5 }, 'v')).toBe(12.5);
    expect(num({ v: null }, 'v')).toBeNull();
    expect(num({}, 'v')).toBeNull();
    expect(() => num({ v: 'n/a' }, 'v')).toThrow(/non-numeric/);
  });

  it('reads strings and points strictly', () => {
    expect(str({ v: 7 }, 'v')).toBe('7');
    expect(str({}, 'v')).toBeNull();
    expect(() => str({ v: { a: 1 } }, 'v')).toThrow(/scalar/);
    expect(geoPoint({ geo_point_2d: { lat: -22.2, lon: 166.4 } })).toEqual({
      latitude: -22.2,
      longitude: 166.4,
    });
    expect(geoPoint({})).toBeNull();
    expect(() => geoPoint({ geo_point_2d: [1, 2] })).toThrow(/unexpected shape/);
  });
});

describe('dates', () => {
  it('uses New Caledonia time (UTC+11), not the host timezone', () => {
    expect(todayInNewCaledonia(new Date('2026-11-20T12:59:00Z'))).toBe('2026-11-20');
    expect(todayInNewCaledonia(new Date('2026-11-20T13:00:00Z'))).toBe('2026-11-21');
  });

  it('counts whole days', () => {
    expect(daysBetween('2026-11-20', '2026-12-25')).toBe(35);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(() => daysBetween('nope', '2026-01-01')).toThrow(/Invalid date range/);
  });
});
