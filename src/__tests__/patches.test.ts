import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePatchTool } from '../tools/patches.js';
import { jsonResponse, textOf, tokenResponse } from './test-helpers.js';

const ENV_KEYS = ['ESETPROTECT_CLIENT_ID', 'ESETPROTECT_CLIENT_SECRET'] as const;

describe('handlePatchTool', () => {
  const fetchMock = vi.fn();
  let credCounter = 0;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    credCounter += 1;
    process.env.ESETPROTECT_CLIENT_ID = `patch-user-${credCounter}`;
    process.env.ESETPROTECT_CLIENT_SECRET = 'pw';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('esetprotect_list_recent_application_patching_details fetches with no query params', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ patchingDetails: [{ deviceUuid: 'd-1' }] }));
    const result = await handlePatchTool('esetprotect_list_recent_application_patching_details', {});
    expect(JSON.parse(textOf(result)).patchingDetails[0].deviceUuid).toBe('d-1');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://us.patch-management.eset.systems/v1/application-patching-processes/recent/details'
    );
  });

  it('esetprotect_list_device_patches filters by patchType', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ devices: [] }));
    await handlePatchTool('esetprotect_list_device_patches', { patchType: 'PATCH_TYPE_OPERATING_SYSTEM' });
    expect(fetchMock.mock.calls[1][0]).toContain('patchType=PATCH_TYPE_OPERATING_SYSTEM');
  });

  it('esetprotect_list_patching_process_details maps startTime/endTime onto the timePeriod.* query params', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ patchingDetails: [] }));
    await handlePatchTool('esetprotect_list_patching_process_details', {
      deviceUuid: 'd-1',
      startTime: '2026-09-01T00:00:00Z',
      endTime: '2026-09-20T00:00:00Z',
    });
    const [url] = fetchMock.mock.calls[1];
    expect(url).toContain('timePeriod.startTime=2026-09-01T00%3A00%3A00Z');
    expect(url).toContain('timePeriod.endTime=2026-09-20T00%3A00%3A00Z');
    expect(url).toContain('deviceUuid=d-1');
  });
});
