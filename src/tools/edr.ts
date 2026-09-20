import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getEdrRule, getEdrRuleExclusion, listEdrRuleExclusions, listEdrRules } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const EDR_TOOLS: Tool[] = [
  {
    name: 'esetprotect_list_edr_rules',
    description: 'List EDR (Endpoint Detection & Response) detection rules.',
    inputSchema: {
      type: 'object',
      properties: {
        includeTotalSize: { type: 'boolean', description: 'Include totalSize in the response (costs an extra count query).' },
        severityLevel: { type: 'string', description: 'Filter by rule severity level.' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_get_edr_rule',
    description: 'Get a single EDR rule by UUID.',
    inputSchema: {
      type: 'object',
      properties: { ruleUuid: { type: 'string' } },
      required: ['ruleUuid'],
    },
  },
  {
    name: 'esetprotect_list_edr_rule_exclusions',
    description: 'List EDR rule exclusions.',
    inputSchema: {
      type: 'object',
      properties: {
        includeTotalSize: { type: 'boolean' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_get_edr_rule_exclusion',
    description: 'Get a single EDR rule exclusion by UUID.',
    inputSchema: {
      type: 'object',
      properties: { exclusionUuid: { type: 'string' } },
      required: ['exclusionUuid'],
    },
  },
];

export async function handleEdrTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'esetprotect_list_edr_rules') {
      const result = await listEdrRules(creds!, {
        includeTotalSize: args.includeTotalSize as boolean | undefined,
        severityLevel: args.severityLevel as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_get_edr_rule') {
      const ruleUuid = args.ruleUuid as string;
      if (!ruleUuid) return errorResult('ruleUuid is required.');
      const result = await getEdrRule(creds!, ruleUuid);
      return textResult(result);
    }

    if (name === 'esetprotect_list_edr_rule_exclusions') {
      const result = await listEdrRuleExclusions(creds!, {
        includeTotalSize: args.includeTotalSize as boolean | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_get_edr_rule_exclusion') {
      const exclusionUuid = args.exclusionUuid as string;
      if (!exclusionUuid) return errorResult('exclusionUuid is required.');
      const result = await getEdrRuleExclusion(creds!, exclusionUuid);
      return textResult(result);
    }

    return errorResult(`Unknown EDR tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
