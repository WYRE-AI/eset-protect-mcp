import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DEVICE_TOOLS, handleDeviceTool } from './devices.js';
import { DETECTION_TOOLS, handleDetectionTool } from './detections.js';
import { EDR_TOOLS, handleEdrTool } from './edr.js';
import { VULNERABILITY_TOOLS, handleVulnerabilityTool } from './vulnerabilities.js';
import { PATCH_TOOLS, handlePatchTool } from './patches.js';
import { USER_TOOLS, handleUserTool } from './users.js';
import type { CallToolResult } from './types.js';

export const ALL_TOOLS: Tool[] = [
  ...DEVICE_TOOLS,
  ...DETECTION_TOOLS,
  ...EDR_TOOLS,
  ...VULNERABILITY_TOOLS,
  ...PATCH_TOOLS,
  ...USER_TOOLS,
];

const DEVICE_NAMES = new Set(DEVICE_TOOLS.map((t) => t.name));
const DETECTION_NAMES = new Set(DETECTION_TOOLS.map((t) => t.name));
const EDR_NAMES = new Set(EDR_TOOLS.map((t) => t.name));
const VULNERABILITY_NAMES = new Set(VULNERABILITY_TOOLS.map((t) => t.name));
const PATCH_NAMES = new Set(PATCH_TOOLS.map((t) => t.name));
const USER_NAMES = new Set(USER_TOOLS.map((t) => t.name));

export async function dispatchToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  if (DEVICE_NAMES.has(name)) return handleDeviceTool(name, args);
  if (DETECTION_NAMES.has(name)) return handleDetectionTool(name, args);
  if (EDR_NAMES.has(name)) return handleEdrTool(name, args);
  if (VULNERABILITY_NAMES.has(name)) return handleVulnerabilityTool(name, args);
  if (PATCH_NAMES.has(name)) return handlePatchTool(name, args);
  if (USER_NAMES.has(name)) return handleUserTool(name, args);
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
}
