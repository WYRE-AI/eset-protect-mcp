import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleVulnerabilityTool } from '../tools/vulnerabilities.js';
import { jsonResponse, textOf, tokenResponse } from './test-helpers.js';

const ENV_KEYS = ['ESETPROTECT_CLIENT_ID', 'ESETPROTECT_CLIENT_SECRET'] as const;

describe('handleVulnerabilityTool', () => {
  const fetchMock = vi.fn();
  let credCounter = 0;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    credCounter += 1;
    process.env.ESETPROTECT_CLIENT_ID = `vuln-user-${credCounter}`;
    process.env.ESETPROTECT_CLIENT_SECRET = 'pw';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('esetprotect_list_device_os_vulnerabilities fetches from /v1/device-os-vulnerabilities', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ vulnerabilities: [] }));
    await handleVulnerabilityTool('esetprotect_list_device_os_vulnerabilities', { deviceUuid: 'd-1' });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://us.vulnerability-management.eset.systems/v1/device-os-vulnerabilities?deviceUuid=d-1'
    );
  });

  it('esetprotect_list_device_vulnerabilities filters by vulnerabilityScope', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ vulnerabilities: [] }));
    await handleVulnerabilityTool('esetprotect_list_device_vulnerabilities', {
      vulnerabilityScope: 'VULNERABILITY_SCOPE_APPLICATION',
    });
    expect(fetchMock.mock.calls[1][0]).toContain('vulnerabilityScope=VULNERABILITY_SCOPE_APPLICATION');
  });

  it('esetprotect_list_recent_scans fetches from /v1/scans/recent', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ scanDetails: [{ scanUuid: 's-1' }] }));
    const result = await handleVulnerabilityTool('esetprotect_list_recent_scans', {});
    expect(JSON.parse(textOf(result)).scanDetails[0].scanUuid).toBe('s-1');
    expect(fetchMock.mock.calls[1][0]).toBe('https://us.vulnerability-management.eset.systems/v1/scans/recent');
  });

  it('esetprotect_list_vulnerable_devices fetches from /v1/vulnerable-devices', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ devices: [{ deviceUuid: 'd-1' }] }));
    const result = await handleVulnerabilityTool('esetprotect_list_vulnerable_devices', { deviceGroupUuid: 'g-1' });
    expect(JSON.parse(textOf(result)).devices[0].deviceUuid).toBe('d-1');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://us.vulnerability-management.eset.systems/v1/vulnerable-devices?deviceGroupUuid=g-1'
    );
  });
});
