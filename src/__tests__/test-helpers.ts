import type { CallToolResult } from '../tools/types.js';

/** Extracts the text of the first content block, failing loudly if it isn't text. */
export function textOf(result: CallToolResult): string {
  const block = result.content?.[0];
  if (!block || block.type !== 'text') {
    throw new Error(`Expected a text content block, got: ${JSON.stringify(block)}`);
  }
  return block.text;
}

/** A JSON Response, for stubbing fetch. */
export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/** The OAuth token response ESET Connect returns from POST /oauth/token. */
export function tokenResponse(overrides: Partial<{ access_token: string; refresh_token: string; expires_in: number }> = {}) {
  return jsonResponse({
    access_token: 'tok',
    refresh_token: 'refresh-tok',
    token_type: 'Bearer',
    expires_in: 3600,
    ...overrides,
  });
}
