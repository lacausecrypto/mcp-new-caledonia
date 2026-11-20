import { createRequire } from 'node:module';

// Resolves to the package root from both src/ (tsx) and dist/ (build).
const pkg: unknown = createRequire(import.meta.url)('../package.json');

if (
  typeof pkg !== 'object' ||
  pkg === null ||
  !('version' in pkg) ||
  typeof pkg.version !== 'string'
) {
  throw new Error('package.json has no version');
}

export const VERSION: string = pkg.version;
export const SERVER_NAME = 'mcp-new-caledonia';
