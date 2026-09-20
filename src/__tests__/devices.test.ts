import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDeviceTool } from '../tools/devices.js';
import { jsonResponse, textOf, tokenResponse } from './test-helpers.js';

const ENV_KEYS = ['ESETPROTECT_CLIENT_ID', 'ESETPROTECT_CLIENT_SECRET', 'ESETPROTECT_REGION'] as const;

describe('handleDeviceTool', () => {
  const fetchMock = vi.fn();
  let credCounter = 0;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    // A unique clientId per test keeps client.ts's module-scoped token cache
    // from bleeding between tests (it is keyed on the full credential set,
    // so a fresh id forces a real token exchange every time).
    credCounter += 1;
    process.env.ESETPROTECT_CLIENT_ID = `api-user-${credCounter}@example.com`;
    process.env.ESETPROTECT_CLIENT_SECRET = 'pw';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('errors when credentials are missing', async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const result = await handleDeviceTool('esetprotect_list_device_groups', {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/No ESET PROTECT credentials/);
  });

  it('esetprotect_list_device_groups fetches groups and passes pagination through', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ deviceGroups: [{ uuid: 'g-1', displayName: 'All' }] }));

    const result = await handleDeviceTool('esetprotect_list_device_groups', { pageSize: 50 });
    expect(JSON.parse(textOf(result)).deviceGroups[0].uuid).toBe('g-1');
    const [url] = fetchMock.mock.calls[1];
    expect(url).toBe('https://us.device-management.eset.systems/v1/device_groups?pageSize=50');
  });

  it('esetprotect_list_group_devices requires groupUuid', async () => {
    const result = await handleDeviceTool('esetprotect_list_group_devices', {});
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/groupUuid is required/);
  });

  it('esetprotect_list_group_devices fetches member devices for a group', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ devices: [{ uuid: 'd-1' }], totalSize: 1 }));

    const result = await handleDeviceTool('esetprotect_list_group_devices', {
      groupUuid: 'g-1',
      recurseSubgroups: true,
    });
    expect(JSON.parse(textOf(result)).totalSize).toBe(1);
    const [url] = fetchMock.mock.calls[1];
    expect(url).toBe('https://us.device-management.eset.systems/v1/device_groups/g-1/devices?recurseSubgroups=true');
  });

  it('esetprotect_list_devices filters by functionalityStatus and isMuted', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ devices: [] }));

    await handleDeviceTool('esetprotect_list_devices', {
      functionalityStatus: 'DEVICE_FUNCTIONALITY_STATUS_ATTENTION_REQUIRED',
      isMuted: false,
    });
    const [url] = fetchMock.mock.calls[1];
    expect(url).toContain('functionalityStatus=DEVICE_FUNCTIONALITY_STATUS_ATTENTION_REQUIRED');
    expect(url).toContain('isMuted=false');
  });

  it('esetprotect_get_device requires deviceUuid and fetches the device', async () => {
    const missing = await handleDeviceTool('esetprotect_get_device', {});
    expect(missing.isError).toBe(true);

    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ device: { uuid: 'd-1', displayName: 'Laptop' } }));
    const result = await handleDeviceTool('esetprotect_get_device', { deviceUuid: 'd-1' });
    expect(JSON.parse(textOf(result)).device.displayName).toBe('Laptop');
  });

  it('esetprotect_batch_get_devices requires a non-empty devicesUuids array', async () => {
    const result = await handleDeviceTool('esetprotect_batch_get_devices', { devicesUuids: [] });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/devicesUuids is required/);
  });

  it('esetprotect_batch_get_devices fetches multiple devices via the :batchGet query form', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ devices: [{ uuid: 'd-1' }, { uuid: 'd-2' }] }));

    const result = await handleDeviceTool('esetprotect_batch_get_devices', { devicesUuids: ['d-1', 'd-2'] });
    expect(JSON.parse(textOf(result)).devices).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://us.device-management.eset.systems/v1/devices:batchGet?devicesUuids=d-1&devicesUuids=d-2');
    expect(init.method).toBe('GET');
  });
});
