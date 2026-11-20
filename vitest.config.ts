import { configDefaults, defineConfig } from 'vitest/config';

// Live tests hit data.gouv.nc: opt-in with `npm run test:live`.
const live = process.env.LIVE === '1';

export default defineConfig({
  test: {
    include: live ? ['tests/live/**/*.test.ts'] : ['tests/**/*.test.ts'],
    exclude: live ? configDefaults.exclude : [...configDefaults.exclude, 'tests/live/**'],
    testTimeout: live ? 60_000 : 5_000,
  },
});
