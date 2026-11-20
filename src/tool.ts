import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/** Every tool only reads the public data.gouv.nc API. */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
  };
}

/**
 * Wrap a tool handler that returns plain data: the value is serialized as JSON,
 * a thrown error becomes an `isError: true` result the model can see.
 */
export function safe<Args extends unknown[]>(
  handler: (...args: Args) => Promise<unknown>,
): (...args: Args) => Promise<CallToolResult> {
  return async (...args) => {
    try {
      return jsonResult(await handler(...args));
    } catch (error) {
      return errorResult(error);
    }
  };
}
