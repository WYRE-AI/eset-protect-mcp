import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { batchGetUsers, getCredentials, getUser, listUsers } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const USER_TOOLS: Tool[] = [
  {
    name: 'esetprotect_list_users',
    description: 'List ESET Business Account users provisioned into this ESET PROTECT tenant, with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        displayName: { type: 'string' },
        protectionStatus: {
          type: 'string',
          enum: [
            'PROTECTION_STATUS_UNSPECIFIED',
            'PROTECTION_STATUS_UNPROTECTED',
            'PROTECTION_STATUS_PENDING',
            'PROTECTION_STATUS_PARTIALLY_PROTECTED',
            'PROTECTION_STATUS_FULLY_PROTECTED',
          ],
        },
        userGroupUuid: { type: 'string' },
        cloudOfficeTenantReference: { type: 'string' },
        hasCloudOfficeMsLicense: { type: 'boolean' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_get_user',
    description: 'Get a single user by UUID.',
    inputSchema: {
      type: 'object',
      properties: { userUuid: { type: 'string' } },
      required: ['userUuid'],
    },
  },
  {
    name: 'esetprotect_batch_get_users',
    description: 'Get multiple users by UUID in one call. Atomic: every requested user is returned or none.',
    inputSchema: {
      type: 'object',
      properties: {
        usersUuids: { type: 'array', items: { type: 'string' } },
      },
      required: ['usersUuids'],
    },
  },
];

export async function handleUserTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'esetprotect_list_users') {
      const result = await listUsers(creds!, {
        email: args.email as string | undefined,
        displayName: args.displayName as string | undefined,
        protectionStatus: args.protectionStatus as string | undefined,
        userGroupUuid: args.userGroupUuid as string | undefined,
        cloudOfficeTenantReference: args.cloudOfficeTenantReference as string | undefined,
        hasCloudOfficeMsLicense: args.hasCloudOfficeMsLicense as boolean | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_get_user') {
      const userUuid = args.userUuid as string;
      if (!userUuid) return errorResult('userUuid is required.');
      const result = await getUser(creds!, userUuid);
      return textResult(result);
    }

    if (name === 'esetprotect_batch_get_users') {
      const usersUuids = args.usersUuids as string[];
      if (!usersUuids || usersUuids.length === 0) return errorResult('usersUuids is required and must be non-empty.');
      const result = await batchGetUsers(creds!, usersUuids);
      return textResult(result);
    }

    return errorResult(`Unknown user tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
