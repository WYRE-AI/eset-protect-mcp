import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EsetProtectApiError,
  EsetProtectAuthError,
  EsetProtectRateLimitError,
  authBaseUrl,
  domainBaseUrl,
  getDevice,
  isValidRegion,
  listDeviceGroups,
  login,
} from '../client.js';
import { jsonResponse, tokenResponse } from './test-helpers.js';
import type { EsetProtectCredentials } from '../types.js';

describe('region/host helpers', () => {
  it('defaults to us for an unset or invalid region', () => {
    expect(authBaseUrl(undefined)).toBe('https://us.business-account.iam.eset.systems');
    expect(authBaseUrl('not-a-region')).toBe('https://us.business-account.iam.eset.systems');
    expect(domainBaseUrl('device-management', undefined)).toBe('https://us.device-management.eset.systems');
  });

  it('honors a valid region for both the auth host and a domain host', () => {
    expect(authBaseUrl('eu')).toBe('https://eu.business-account.iam.eset.systems');
    expect(domainBaseUrl('incident-management', 'jpn')).toBe('https://jpn.incident-management.eset.systems');
  });

  it('validates the five known regions and rejects anything else', () => {
    for (const r of ['us', 'eu', 'de', 'jpn', 'ca']) expect(isValidRegion(r)).toBe(true);
    expect(isValidRegion('emea')).toBe(false);
  });
});

describe('login', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a password grant with clientId as username and clientSecret as password - not client_credentials', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse());
    await login({ clientId: 'api-user@example.com', clientSecret: 'hunter2' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://us.business-account.iam.eset.systems/oauth/token');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('password');
    expect(body.get('username')).toBe('api-user@example.com');
    expect(body.get('password')).toBe('hunter2');
  });

  it('throws EsetProtectAuthError on HTTP 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(login({ clientId: 'a', clientSecret: 'b' })).rejects.toBeInstanceOf(EsetProtectAuthError);
  });

  it('throws EsetProtectRateLimitError (never EsetProtectAuthError) on HTTP 429, capturing Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429, { 'Retry-After': '30' }));
    await expect(login({ clientId: 'a', clientSecret: 'b' })).rejects.toBeInstanceOf(EsetProtectRateLimitError);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429, { 'Retry-After': '30' }));
    try {
      await login({ clientId: 'a', clientSecret: 'b' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EsetProtectRateLimitError);
      expect((err as EsetProtectRateLimitError).retryAfterSeconds).toBe(30);
    }
  });

  it('throws EsetProtectApiError on other non-2xx statuses, distinct from auth/rate-limit errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(login({ clientId: 'a', clientSecret: 'b' })).rejects.toBeInstanceOf(EsetProtectApiError);
  });
});

describe('token caching and refresh (via a real API call)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses a cached token across two calls with the same credentials (one oauth/token call, two API calls)', async () => {
    const creds: EsetProtectCredentials = { clientId: `cache-reuse@example.com`, clientSecret: 'pw' };
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ deviceGroups: [] }))
      .mockResolvedValueOnce(jsonResponse({ deviceGroups: [] }));

    await listDeviceGroups(creds);
    await listDeviceGroups(creds);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('https://us.business-account.iam.eset.systems/oauth/token');
  });

  it('keys the token cache on the full credential set (JSON.stringify, not a delimiter-join) so distinct tenants never share a token', async () => {
    const credsA: EsetProtectCredentials = { clientId: 'tenantA', clientSecret: 'pw' };
    const credsB: EsetProtectCredentials = { clientId: 'tenantB', clientSecret: 'pw' };
    fetchMock
      .mockResolvedValueOnce(tokenResponse({ access_token: 'tok-a' }))
      .mockResolvedValueOnce(jsonResponse({ deviceGroups: [] }))
      .mockResolvedValueOnce(tokenResponse({ access_token: 'tok-b' }))
      .mockResolvedValueOnce(jsonResponse({ deviceGroups: [] }));

    await listDeviceGroups(credsA);
    await listDeviceGroups(credsB);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const secondCallHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    const fourthCallHeaders = fetchMock.mock.calls[3][1].headers as Record<string, string>;
    expect(secondCallHeaders.Authorization).toBe('Bearer tok-a');
    expect(fourthCallHeaders.Authorization).toBe('Bearer tok-b');
  });

  it('retries exactly once with a forced token refresh when the vendor rejects the bearer token mid-call', async () => {
    const creds: EsetProtectCredentials = { clientId: 'retry-user', clientSecret: 'pw' };
    fetchMock
      .mockResolvedValueOnce(tokenResponse({ access_token: 'stale-tok' }))
      .mockResolvedValueOnce(jsonResponse({}, 401)) // vendor rejects the cached token mid-call
      .mockResolvedValueOnce(tokenResponse({ access_token: 'fresh-tok' })) // forced refresh
      .mockResolvedValueOnce(jsonResponse({ device: { uuid: 'd-1' } }));

    const result = await getDevice(creds, 'd-1');
    expect(result.device?.uuid).toBe('d-1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retriedCallHeaders = fetchMock.mock.calls[3][1].headers as Record<string, string>;
    expect(retriedCallHeaders.Authorization).toBe('Bearer fresh-tok');
  });

  it('surfaces a rate-limit error from a data call without retrying', async () => {
    const creds: EsetProtectCredentials = { clientId: 'rl-user', clientSecret: 'pw' };
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({}, 429));

    await expect(listDeviceGroups(creds)).rejects.toBeInstanceOf(EsetProtectRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
