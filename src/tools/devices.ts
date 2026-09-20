import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { batchGetDevices, getCredentials, getDevice, listDeviceGroups, listDevices, listGroupDevices } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const DEVICE_TOOLS: Tool[] = [
  {
    name: 'esetprotect_list_device_groups',
    description: 'List ESET PROTECT device (static/dynamic) groups.',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: { type: 'number', description: 'Max results per page.' },
        pageToken: { type: 'string', description: 'Page token from a previous response.' },
      },
    },
  },
  {
    name: 'esetprotect_list_group_devices',
    description: 'List the devices that are members of a given device group.',
    inputSchema: {
      type: 'object',
      properties: {
        groupUuid: { type: 'string', description: 'UUID of the device group.' },
        recurseSubgroups: { type: 'boolean', description: 'Include devices from subgroups. Default false.' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
      required: ['groupUuid'],
    },
  },
  {
    name: 'esetprotect_list_devices',
    description: 'List managed devices (endpoints), optionally filtered by display name, functionality status, or mute state.',
    inputSchema: {
      type: 'object',
      properties: {
        displayNames: { type: 'array', items: { type: 'string' }, description: 'Filter to these exact display names.' },
        functionalityStatus: {
          type: 'string',
          enum: [
            'DEVICE_FUNCTIONALITY_STATUS_UNSPECIFIED',
            'DEVICE_FUNCTIONALITY_STATUS_OK',
            'DEVICE_FUNCTIONALITY_STATUS_ATTENTION_RECOMMENDED',
            'DEVICE_FUNCTIONALITY_STATUS_ATTENTION_REQUIRED',
          ],
        },
        isMuted: { type: 'boolean' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_get_device',
    description: 'Get a single managed device by UUID.',
    inputSchema: {
      type: 'object',
      properties: { deviceUuid: { type: 'string' } },
      required: ['deviceUuid'],
    },
  },
  {
    name: 'esetprotect_batch_get_devices',
    description: 'Get multiple managed devices by UUID in one call (max recommended 100, hard limit 1000).',
    inputSchema: {
      type: 'object',
      properties: {
        devicesUuids: { type: 'array', items: { type: 'string' }, description: 'Device UUIDs to fetch.' },
      },
      required: ['devicesUuids'],
    },
  },
];

export async function handleDeviceTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'esetprotect_list_device_groups') {
      const result = await listDeviceGroups(creds!, {
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_list_group_devices') {
      const groupUuid = args.groupUuid as string;
      if (!groupUuid) return errorResult('groupUuid is required.');
      const result = await listGroupDevices(creds!, groupUuid, {
        recurseSubgroups: args.recurseSubgroups as boolean | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_list_devices') {
      const result = await listDevices(creds!, {
        displayNames: args.displayNames as string[] | undefined,
        functionalityStatus: args.functionalityStatus as string | undefined,
        isMuted: args.isMuted as boolean | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_get_device') {
      const deviceUuid = args.deviceUuid as string;
      if (!deviceUuid) return errorResult('deviceUuid is required.');
      const result = await getDevice(creds!, deviceUuid);
      return textResult(result);
    }

    if (name === 'esetprotect_batch_get_devices') {
      const devicesUuids = args.devicesUuids as string[];
      if (!devicesUuids || devicesUuids.length === 0) return errorResult('devicesUuids is required and must be non-empty.');
      const result = await batchGetDevices(creds!, devicesUuids);
      return textResult(result);
    }

    return errorResult(`Unknown device tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
