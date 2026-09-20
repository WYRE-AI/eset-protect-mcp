import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getCredentials,
  listDevicePatches,
  listPatchingProcessDetails,
  listRecentApplicationPatchingDetails,
} from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const PATCH_TOOLS: Tool[] = [
  {
    name: 'esetprotect_list_recent_application_patching_details',
    description: 'List details of the most recent application-patching processes across the fleet.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'esetprotect_list_device_patches',
    description: 'List patches (available/applied) for devices, optionally filtered by device, group, or patch type.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUuid: { type: 'string' },
        deviceGroupUuid: { type: 'string' },
        patchType: {
          type: 'string',
          enum: ['PATCH_TYPE_UNSPECIFIED', 'PATCH_TYPE_APPLICATION', 'PATCH_TYPE_OPERATING_SYSTEM', 'PATCH_TYPE_PACKAGE'],
        },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_list_patching_process_details',
    description: 'List detailed patching-process history for devices within an optional time window.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUuid: { type: 'string' },
        deviceGroupUuid: { type: 'string' },
        startTime: { type: 'string', description: 'RFC3339 timestamp, inclusive start of the time period.' },
        endTime: { type: 'string', description: 'RFC3339 timestamp, exclusive end of the time period.' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
];

export async function handlePatchTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'esetprotect_list_recent_application_patching_details') {
      const result = await listRecentApplicationPatchingDetails(creds!);
      return textResult(result);
    }

    if (name === 'esetprotect_list_device_patches') {
      const result = await listDevicePatches(creds!, {
        deviceUuid: args.deviceUuid as string | undefined,
        deviceGroupUuid: args.deviceGroupUuid as string | undefined,
        patchType: args.patchType as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_list_patching_process_details') {
      const result = await listPatchingProcessDetails(creds!, {
        deviceUuid: args.deviceUuid as string | undefined,
        deviceGroupUuid: args.deviceGroupUuid as string | undefined,
        startTime: args.startTime as string | undefined,
        endTime: args.endTime as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    return errorResult(`Unknown patch tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
