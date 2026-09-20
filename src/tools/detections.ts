import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  batchGetDetections,
  getCredentials,
  getDetectionGroup,
  getDetectionV1,
  getDetectionV2,
  listDetectionGroups,
  listDetectionsV1,
  listDetectionsV2,
} from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const DETECTION_TOOLS: Tool[] = [
  {
    name: 'esetprotect_list_detections',
    description: 'List detections (v1 - legacy surface, endpoint antivirus/firewall detections only). Prefer esetprotect_list_detections_v2 for new integrations.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceUuid: { type: 'string' },
        startTime: { type: 'string', description: 'RFC3339 timestamp, inclusive lower bound on occurTime.' },
        endTime: { type: 'string', description: 'RFC3339 timestamp, exclusive upper bound on occurTime.' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_get_detection',
    description: 'Get a single detection by UUID (v1 - legacy surface).',
    inputSchema: {
      type: 'object',
      properties: { detectionUuid: { type: 'string' } },
      required: ['detectionUuid'],
    },
  },
  {
    name: 'esetprotect_list_detections_v2',
    description: 'List detections (v2 - covers endpoint, cloud office, and EDR detections).',
    inputSchema: {
      type: 'object',
      properties: {
        cloudOfficeTenantUuid: { type: 'string' },
        startTime: { type: 'string', description: 'RFC3339 timestamp, inclusive lower bound on occurTime.' },
        endTime: { type: 'string', description: 'RFC3339 timestamp, exclusive upper bound on occurTime.' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_get_detection_v2',
    description: 'Get a single detection by UUID (v2).',
    inputSchema: {
      type: 'object',
      properties: { detectionUuid: { type: 'string' } },
      required: ['detectionUuid'],
    },
  },
  {
    name: 'esetprotect_batch_get_detections',
    description: 'Get multiple v2 detections by UUID in one call (max recommended 100, hard limit 1000).',
    inputSchema: {
      type: 'object',
      properties: {
        detectionUuids: { type: 'array', items: { type: 'string' } },
      },
      required: ['detectionUuids'],
    },
  },
  {
    name: 'esetprotect_list_detection_groups',
    description: 'List detection groups - related detections clustered together (e.g. the same malware across many devices).',
    inputSchema: {
      type: 'object',
      properties: {
        cloudOfficeTenantUuid: { type: 'string' },
        deviceUuid: { type: 'string' },
        startTime: { type: 'string' },
        endTime: { type: 'string' },
        pageSize: { type: 'number' },
        pageToken: { type: 'string' },
      },
    },
  },
  {
    name: 'esetprotect_get_detection_group',
    description: 'Get a single detection group by UUID.',
    inputSchema: {
      type: 'object',
      properties: { detectionGroupUuid: { type: 'string' } },
      required: ['detectionGroupUuid'],
    },
  },
];

export async function handleDetectionTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'esetprotect_list_detections') {
      const result = await listDetectionsV1(creds!, {
        deviceUuid: args.deviceUuid as string | undefined,
        startTime: args.startTime as string | undefined,
        endTime: args.endTime as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_get_detection') {
      const detectionUuid = args.detectionUuid as string;
      if (!detectionUuid) return errorResult('detectionUuid is required.');
      const result = await getDetectionV1(creds!, detectionUuid);
      return textResult(result);
    }

    if (name === 'esetprotect_list_detections_v2') {
      const result = await listDetectionsV2(creds!, {
        cloudOfficeTenantUuid: args.cloudOfficeTenantUuid as string | undefined,
        startTime: args.startTime as string | undefined,
        endTime: args.endTime as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_get_detection_v2') {
      const detectionUuid = args.detectionUuid as string;
      if (!detectionUuid) return errorResult('detectionUuid is required.');
      const result = await getDetectionV2(creds!, detectionUuid);
      return textResult(result);
    }

    if (name === 'esetprotect_batch_get_detections') {
      const detectionUuids = args.detectionUuids as string[];
      if (!detectionUuids || detectionUuids.length === 0) {
        return errorResult('detectionUuids is required and must be non-empty.');
      }
      const result = await batchGetDetections(creds!, detectionUuids);
      return textResult(result);
    }

    if (name === 'esetprotect_list_detection_groups') {
      const result = await listDetectionGroups(creds!, {
        cloudOfficeTenantUuid: args.cloudOfficeTenantUuid as string | undefined,
        deviceUuid: args.deviceUuid as string | undefined,
        startTime: args.startTime as string | undefined,
        endTime: args.endTime as string | undefined,
        pageSize: args.pageSize as number | undefined,
        pageToken: args.pageToken as string | undefined,
      });
      return textResult(result);
    }

    if (name === 'esetprotect_get_detection_group') {
      const detectionGroupUuid = args.detectionGroupUuid as string;
      if (!detectionGroupUuid) return errorResult('detectionGroupUuid is required.');
      const result = await getDetectionGroup(creds!, detectionGroupUuid);
      return textResult(result);
    }

    return errorResult(`Unknown detection tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
