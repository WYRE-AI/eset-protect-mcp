import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getCredentials,
  listDeviceOsVulnerabilities,
  listDeviceVulnerabilities,
  listRecentScans,
  listVulnerableDevices,
} from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const VULNERABILITY_TOOLS: Tool[] = [
  {
    name: 'esetprotect_list_device_os_vulnerabilities',
    description: 'List operating-system vulnerabilities found on devices.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUuid: { type: 'string' },
        deviceGroupUuid: { type: 'string' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_list_device_vulnerabilities',
    description: 'List vulnerabilities found on devices (application, OS, or package scope).',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUuid: { type: 'string' },
        deviceGroupUuid: { type: 'string' },
        vulnerabilityScope: {
          type: 'string',
          enum: [
            'VULNERABILITY_SCOPE_UNSPECIFIED',
            'VULNERABILITY_SCOPE_APPLICATION',
            'VULNERABILITY_SCOPE_OPERATING_SYSTEM',
            'VULNERABILITY_SCOPE_PACKAGE',
          ],
        },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_list_recent_scans',
    description: 'List details of recent vulnerability scans.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUuid: { type: 'string' },
        deviceGroupUuid: { type: 'string' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_list_vulnerable_devices',
    description: 'List devices that currently have one or more known vulnerabilities.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceGroupUuid: { type: 'string' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
];

export async function handleVulnerabilityTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'esetprotect_list_device_os_vulnerabilities') {
      const result = await listDeviceOsVulnerabilities(creds!, {
        deviceUuid: args.deviceUuid as string | undefined,
        deviceGroupUuid: args.deviceGroupUuid as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_list_device_vulnerabilities') {
      const result = await listDeviceVulnerabilities(creds!, {
        deviceUuid: args.deviceUuid as string | undefined,
        deviceGroupUuid: args.deviceGroupUuid as string | undefined,
        vulnerabilityScope: args.vulnerabilityScope as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_list_recent_scans') {
      const result = await listRecentScans(creds!, {
        deviceUuid: args.deviceUuid as string | undefined,
        deviceGroupUuid: args.deviceGroupUuid as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_list_vulnerable_devices') {
      const result = await listVulnerableDevices(creds!, {
        deviceGroupUuid: args.deviceGroupUuid as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    return errorResult(`Unknown vulnerability tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
