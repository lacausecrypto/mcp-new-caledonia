import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './modules/index.js';
import { SERVER_NAME, VERSION } from './version.js';

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  registerAllTools(server);
  return server;
}
