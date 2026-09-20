import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDetectionTool } from '../tools/detections.js';
import { jsonResponse, textOf, tokenResponse } from './test-helpers.js';

const ENV_KEYS = ['ESETPROTECT_CLIENT_ID', 'ESETPROTECT_CLIENT_SECRET'] as const;

describe('handleDetectionTool', () => {
  const fetchMock = vi.fn();
  let credCounter = 0;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    credCounter += 1;
    process.env.ESETPROTECT_CLIENT_ID = `detections-user-${credCounter}`;
    process.env.ESETPROTECT_CLIENT_SECRET = 'pw';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('esetprotect_list_detections (v1) fetches from /v1/detections', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ detections: [{ uuid: 'det-1' }] }));

    const result = await handleDetectionTool('esetprotect_list_detections', { deviceUuid: 'd-1' });
    expect(JSON.parse(textOf(result)).detections[0].uuid).toBe('det-1');
    expect(fetchMock.mock.calls[1][0]).toBe('https://us.incident-management.eset.systems/v1/detections?deviceUuid=d-1');
  });

  it('esetprotect_get_detection (v1) requires detectionUuid', async () => {
    const result = await handleDetectionTool('esetprotect_get_detection', {});
    expect(result.isError).toBe(true);
  });

  it('esetprotect_list_detections_v2 fetches from /v2/detections', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ detections: [] }));
    await handleDetectionTool('esetprotect_list_detections_v2', { cloudOfficeTenantUuid: 't-1' });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://us.incident-management.eset.systems/v2/detections?cloudOfficeTenantUuid=t-1'
    );
  });

  it('esetprotect_get_detection_v2 fetches a single v2 detection', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ detection: { uuid: 'det-1' } }));
    const result = await handleDetectionTool('esetprotect_get_detection_v2', { detectionUuid: 'det-1' });
    expect(JSON.parse(textOf(result)).detection.uuid).toBe('det-1');
  });

  it('esetprotect_batch_get_detections requires a non-empty array and POSTs the body', async () => {
    const missing = await handleDetectionTool('esetprotect_batch_get_detections', { detectionUuids: [] });
    expect(missing.isError).toBe(true);

    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ detections: [{ uuid: 'det-1' }, { uuid: 'det-2' }] }));
    const result = await handleDetectionTool('esetprotect_batch_get_detections', {
      detectionUuids: ['det-1', 'det-2'],
    });
    expect(JSON.parse(textOf(result)).detections).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://us.incident-management.eset.systems/v2/detections:batchGet');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ detectionUuids: ['det-1', 'det-2'] });
  });

  it('esetprotect_list_detection_groups fetches from /v2/detection-groups', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ detectionGroups: [] }));
    await handleDetectionTool('esetprotect_list_detection_groups', { deviceUuid: 'd-1' });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://us.incident-management.eset.systems/v2/detection-groups?deviceUuid=d-1'
    );
  });

  it('esetprotect_get_detection_group requires detectionGroupUuid and fetches it', async () => {
    const missing = await handleDetectionTool('esetprotect_get_detection_group', {});
    expect(missing.isError).toBe(true);

    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ detectionGroup: { uuid: 'grp-1' } }));
    const result = await handleDetectionTool('esetprotect_get_detection_group', { detectionGroupUuid: 'grp-1' });
    expect(JSON.parse(textOf(result)).detectionGroup.uuid).toBe('grp-1');
  });
});
