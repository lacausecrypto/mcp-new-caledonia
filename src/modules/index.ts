import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAdministrationTools } from './administration.js';
import { registerCatalogTools } from './catalog.js';
import { registerCompanyTools } from './companies.js';
import { registerEmploymentTools } from './employment.js';
import { registerGeographyTools } from './geography.js';
import { registerMiningTools } from './mining.js';
import { registerPopulationTools } from './population.js';
import { registerTourismTools } from './tourism.js';
import { registerTransportTools } from './transport.js';

export function registerAllTools(server: McpServer): void {
  registerAdministrationTools(server);
  registerCompanyTools(server);
  registerEmploymentTools(server);
  registerMiningTools(server);
  registerGeographyTools(server);
  registerPopulationTools(server);
  registerTourismTools(server);
  registerTransportTools(server);
  registerCatalogTools(server);
}
