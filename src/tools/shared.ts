import type { EsetProtectCredentials } from '../types.js';
import type { CallToolResult } from './types.js';

export function textResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

/** Returns an error CallToolResult if credentials are missing, else null. */
export function requireCredentials(creds: EsetProtectCredentials | null): CallToolResult | null {
  if (!creds) {
    return errorResult(
      'No ESET PROTECT credentials configured. Set ESETPROTECT_CLIENT_ID and ESETPROTECT_CLIENT_SECRET.'
    );
  }
  return null;
}
