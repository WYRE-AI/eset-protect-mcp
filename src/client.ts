import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './utils/logger.js';
import type {
  EsetBatchGetDetectionsResponse,
  EsetBatchGetDevicesResponse,
  EsetBatchGetUsersResponse,
  EsetGetDetectionGroupResponse,
  EsetGetDetectionResponse,
  EsetGetDeviceResponse,
  EsetGetEdrRuleExclusionResponse,
  EsetGetEdrRuleResponse,
  EsetGetUserResponse,
  EsetListDetectionGroupsResponse,
  EsetListDetectionsResponse,
  EsetListDeviceGroupsResponse,
  EsetListDeviceOsVulnerabilitiesResponse,
  EsetListDevicePatchesResponse,
  EsetListDevicePatchingDetailsResponse,
  EsetListDeviceVulnerabilitiesResponse,
  EsetListDevicesResponse,
  EsetListEdrRuleExclusionsResponse,
  EsetListEdrRulesResponse,
  EsetListMemberDevicesResponse,
  EsetListRecentApplicationPatchingDetailsResponse,
  EsetListRecentScanDetailsResponse,
  EsetListUsersResponse,
  EsetListVulnerableDevicesResponse,
  EsetOAuthTokenResponse,
  EsetProtectCredentials,
  EsetProtectDomain,
  EsetProtectRegion,
} from './types.js';

const VALID_REGIONS: readonly EsetProtectRegion[] = ['us', 'eu', 'de', 'jpn', 'ca'];

export function isValidRegion(region: string): region is EsetProtectRegion {
  return (VALID_REGIONS as readonly string[]).includes(region);
}

function normalizedRegion(region?: string): EsetProtectRegion {
  if (region && isValidRegion(region)) return region;
  return 'us';
}

/** Auth host for a region, e.g. https://us.business-account.iam.eset.systems */
export function authBaseUrl(region?: string): string {
  return `https://${normalizedRegion(region)}.business-account.iam.eset.systems`;
}

/** Per-domain API host for a region, e.g. https://us.device-management.eset.systems */
export function domainBaseUrl(domain: EsetProtectDomain, region?: string): string {
  return `https://${normalizedRegion(region)}.${domain}.eset.systems`;
}

// Request-scoped credential store. In gateway mode the HTTP layer runs each
// request inside runWithCredentials({clientId, clientSecret, region});
// getCredentials() reads from it. Falls back to process.env for
// stdio/single-tenant mode.
const credStore = new AsyncLocalStorage<EsetProtectCredentials>();

export function runWithCredentials<T>(creds: EsetProtectCredentials, fn: () => T): T {
  return credStore.run(creds, fn);
}

export function getCredentials(): EsetProtectCredentials | null {
  const scoped = credStore.getStore();
  if (scoped?.clientId && scoped?.clientSecret) return scoped;
  const clientId = process.env.ESETPROTECT_CLIENT_ID;
  const clientSecret = process.env.ESETPROTECT_CLIENT_SECRET;
  const region = process.env.ESETPROTECT_REGION;
  if (!clientId || !clientSecret) {
    logger.warn('Missing credentials', { hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    return null;
  }
  return { clientId, clientSecret, region: region ? normalizedRegion(region) : undefined };
}

/** Thrown when ESET Connect rejects the current access token or the underlying credentials (HTTP 401). */
export class EsetProtectAuthError extends Error {}

/** Thrown when ESET Connect rate-limits the request (HTTP 429) - distinct from an auth failure, never retried automatically. */
export class EsetProtectRateLimitError extends Error {
  constructor(message: string, readonly retryAfterSeconds?: number) {
    super(message);
  }
}

/** Thrown for any other non-2xx / unexpected vendor response. */
export class EsetProtectApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

interface TokenState {
  accessToken: string;
  refreshToken?: string;
  expireAt: number; // epoch ms
}

// Refresh this far ahead of the documented 3600s expiry so a slow
// downstream call never races a token that expires mid-request.
const REFRESH_SKEW_MS = 60_000;

// Conservative fallback TTL if a token response is missing/has an
// unparseable `expires_in` - well under the documented 1-hour lifetime.
const FALLBACK_TOKEN_TTL_MS = 10 * 60_000;

// Keyed by JSON.stringify([clientId, clientSecret, region]) - not a
// delimiter-join - so multiple tenants sharing one gateway process
// (AsyncLocalStorage swaps credentials per request) never cross-pollinate
// cached tokens even if a credential value happens to contain whatever
// delimiter a naive join would pick.
const tokenCache = new Map<string, TokenState>();

function cacheKeyFor(creds: EsetProtectCredentials): string {
  return JSON.stringify([creds.clientId, creds.clientSecret, creds.region ?? 'us']);
}

function tokenStateFrom(data: EsetOAuthTokenResponse): TokenState {
  const ttlMs = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in * 1000 : NaN;
  return {
    accessToken: data.access_token!,
    refreshToken: data.refresh_token,
    expireAt: Number.isFinite(ttlMs) ? Date.now() + ttlMs : Date.now() + FALLBACK_TOKEN_TTL_MS,
  };
}

async function postOAuthToken(region: string | undefined, body: URLSearchParams): Promise<TokenState> {
  const res = await fetch(`${authBaseUrl(region)}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after'));
    throw new EsetProtectRateLimitError(
      'ESET Connect rate-limited the token request (HTTP 429)',
      Number.isFinite(retryAfter) ? retryAfter : undefined
    );
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new EsetProtectAuthError(`ESET Connect rejected the credentials (HTTP ${res.status})`);
    }
    throw new EsetProtectApiError(`ESET Connect oauth/token failed: HTTP ${res.status}`, res.status);
  }

  const data = (await res.json()) as EsetOAuthTokenResponse;
  if (!data.access_token) {
    throw new EsetProtectAuthError('ESET Connect returned no access_token for the credentials given');
  }
  return tokenStateFrom(data);
}

/**
 * Exchange the ESET Connect API user's email/password for a bearer token.
 *
 * ESET Connect's own OpenAPI spec documents /oauth/token as a `password`
 * grant (username/password fields, grant_type enum of "password" |
 * "refresh_token" only) - not the client_credentials grant its
 * client_id/client_secret naming would suggest. `clientId` is sent as
 * `username` and `clientSecret` as `password`.
 */
export async function login(creds: EsetProtectCredentials): Promise<TokenState> {
  const body = new URLSearchParams({
    grant_type: 'password',
    username: creds.clientId,
    password: creds.clientSecret,
  });
  return postOAuthToken(creds.region, body);
}

/** Exchange a refresh_token for a new access token, per the same oauth_token_body schema. */
async function refreshAccessToken(creds: EsetProtectCredentials, refreshToken: string): Promise<TokenState> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  return postOAuthToken(creds.region, body);
}

async function getToken(creds: EsetProtectCredentials, forceRefresh = false): Promise<string> {
  const key = cacheKeyFor(creds);
  const cached = tokenCache.get(key);
  if (!forceRefresh && cached && cached.expireAt - REFRESH_SKEW_MS > Date.now()) {
    return cached.accessToken;
  }

  if (cached?.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(creds, cached.refreshToken);
      tokenCache.set(key, refreshed);
      return refreshed.accessToken;
    } catch (err) {
      // The refresh token itself may have expired or been revoked - fall
      // through to a full re-login rather than surfacing this as fatal.
      if (!(err instanceof EsetProtectAuthError)) throw err;
      logger.warn('Refresh token rejected, falling back to full re-login');
    }
  }

  const fresh = await login(creds);
  tokenCache.set(key, fresh);
  return fresh.accessToken;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

/**
 * Runs `fn` with a fresh/cached bearer token, and retries it exactly once
 * with a forced token refresh if `fn` throws EsetProtectAuthError (the
 * vendor rejected the token mid-call - expired or otherwise invalid).
 * A rate-limit (429) is never retried here; it propagates to the caller.
 */
async function withToken<T>(creds: EsetProtectCredentials, fn: (headers: Record<string, string>) => Promise<T>): Promise<T> {
  const token = await getToken(creds);
  try {
    return await fn(authHeaders(token));
  } catch (err) {
    if (err instanceof EsetProtectAuthError) {
      logger.warn('Bearer token rejected mid-call, refreshing and retrying once');
      const refreshed = await getToken(creds, true);
      return await fn(authHeaders(refreshed));
    }
    throw err;
  }
}

function buildQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, String(item));
    } else {
      qs.append(k, String(v));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function doGet<T>(baseUrl: string, path: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers, signal: AbortSignal.timeout(15_000) });
  return handleResponse<T>(res, 'GET', path);
}

async function doPost<T>(baseUrl: string, path: string, headers: Record<string, string>, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(15_000),
  });
  return handleResponse<T>(res, 'POST', path);
}

async function handleResponse<T>(res: Response, method: string, path: string): Promise<T> {
  if (res.status === 401 || res.status === 403) {
    throw new EsetProtectAuthError(`ESET Connect rejected the bearer token (HTTP ${res.status})`);
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after'));
    throw new EsetProtectRateLimitError(
      `ESET Connect rate-limited ${method} ${path} (HTTP 429)`,
      Number.isFinite(retryAfter) ? retryAfter : undefined
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new EsetProtectApiError(
      `ESET Connect ${method} ${path} failed: HTTP ${res.status}${text ? ` - ${text.slice(0, 300)}` : ''}`,
      res.status
    );
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------
// Device Management
// ---------------------------------------------------------------------

export async function listDeviceGroups(
  creds: EsetProtectCredentials,
  opts: { pageSize?: number; pageToken?: string } = {}
): Promise<EsetListDeviceGroupsResponse> {
  const baseUrl = domainBaseUrl('device-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListDeviceGroupsResponse>(baseUrl, `/v1/device_groups${buildQuery(opts)}`, headers)
  );
}

export async function listGroupDevices(
  creds: EsetProtectCredentials,
  groupUuid: string,
  opts: { recurseSubgroups?: boolean; pageSize?: number; pageToken?: string } = {}
): Promise<EsetListMemberDevicesResponse> {
  const baseUrl = domainBaseUrl('device-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListMemberDevicesResponse>(
      baseUrl,
      `/v1/device_groups/${encodeURIComponent(groupUuid)}/devices${buildQuery(opts)}`,
      headers
    )
  );
}

export async function listDevices(
  creds: EsetProtectCredentials,
  opts: {
    displayNames?: string[];
    functionalityStatus?: string;
    isMuted?: boolean;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<EsetListDevicesResponse> {
  const baseUrl = domainBaseUrl('device-management', creds.region);
  return withToken(creds, (headers) => doGet<EsetListDevicesResponse>(baseUrl, `/v1/devices${buildQuery(opts)}`, headers));
}

export async function getDevice(creds: EsetProtectCredentials, deviceUuid: string): Promise<EsetGetDeviceResponse> {
  const baseUrl = domainBaseUrl('device-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetGetDeviceResponse>(baseUrl, `/v1/devices/${encodeURIComponent(deviceUuid)}`, headers)
  );
}

export async function batchGetDevices(
  creds: EsetProtectCredentials,
  devicesUuids: string[]
): Promise<EsetBatchGetDevicesResponse> {
  const baseUrl = domainBaseUrl('device-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetBatchGetDevicesResponse>(baseUrl, `/v1/devices:batchGet${buildQuery({ devicesUuids })}`, headers)
  );
}

// ---------------------------------------------------------------------
// Incident Management - detections (v1), detections (v2), detection-groups,
// edr-rules, edr-rule-exclusions
// ---------------------------------------------------------------------

export async function listDetectionsV1(
  creds: EsetProtectCredentials,
  opts: { deviceUuid?: string; startTime?: string; endTime?: string; pageSize?: number; pageToken?: string } = {}
): Promise<EsetListDetectionsResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListDetectionsResponse>(baseUrl, `/v1/detections${buildQuery(opts)}`, headers)
  );
}

export async function getDetectionV1(
  creds: EsetProtectCredentials,
  detectionUuid: string
): Promise<EsetGetDetectionResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetGetDetectionResponse>(baseUrl, `/v1/detections/${encodeURIComponent(detectionUuid)}`, headers)
  );
}

export async function listDetectionsV2(
  creds: EsetProtectCredentials,
  opts: {
    cloudOfficeTenantUuid?: string;
    startTime?: string;
    endTime?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<EsetListDetectionsResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListDetectionsResponse>(baseUrl, `/v2/detections${buildQuery(opts)}`, headers)
  );
}

export async function getDetectionV2(
  creds: EsetProtectCredentials,
  detectionUuid: string
): Promise<EsetGetDetectionResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetGetDetectionResponse>(baseUrl, `/v2/detections/${encodeURIComponent(detectionUuid)}`, headers)
  );
}

export async function batchGetDetections(
  creds: EsetProtectCredentials,
  detectionUuids: string[]
): Promise<EsetBatchGetDetectionsResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doPost<EsetBatchGetDetectionsResponse>(baseUrl, '/v2/detections:batchGet', headers, { detectionUuids })
  );
}

export async function listDetectionGroups(
  creds: EsetProtectCredentials,
  opts: {
    cloudOfficeTenantUuid?: string;
    deviceUuid?: string;
    startTime?: string;
    endTime?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<EsetListDetectionGroupsResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListDetectionGroupsResponse>(baseUrl, `/v2/detection-groups${buildQuery(opts)}`, headers)
  );
}

export async function getDetectionGroup(
  creds: EsetProtectCredentials,
  detectionGroupUuid: string
): Promise<EsetGetDetectionGroupResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetGetDetectionGroupResponse>(
      baseUrl,
      `/v2/detection-groups/${encodeURIComponent(detectionGroupUuid)}`,
      headers
    )
  );
}

export async function listEdrRules(
  creds: EsetProtectCredentials,
  opts: { includeTotalSize?: boolean; severityLevel?: string; pageSize?: number; pageToken?: string } = {}
): Promise<EsetListEdrRulesResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) => doGet<EsetListEdrRulesResponse>(baseUrl, `/v2/edr-rules${buildQuery(opts)}`, headers));
}

export async function getEdrRule(creds: EsetProtectCredentials, ruleUuid: string): Promise<EsetGetEdrRuleResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetGetEdrRuleResponse>(baseUrl, `/v2/edr-rules/${encodeURIComponent(ruleUuid)}`, headers)
  );
}

export async function listEdrRuleExclusions(
  creds: EsetProtectCredentials,
  opts: { includeTotalSize?: boolean; pageSize?: number; pageToken?: string } = {}
): Promise<EsetListEdrRuleExclusionsResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListEdrRuleExclusionsResponse>(baseUrl, `/v2/edr-rule-exclusions${buildQuery(opts)}`, headers)
  );
}

export async function getEdrRuleExclusion(
  creds: EsetProtectCredentials,
  exclusionUuid: string
): Promise<EsetGetEdrRuleExclusionResponse> {
  const baseUrl = domainBaseUrl('incident-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetGetEdrRuleExclusionResponse>(
      baseUrl,
      `/v2/edr-rule-exclusions/${encodeURIComponent(exclusionUuid)}`,
      headers
    )
  );
}

// ---------------------------------------------------------------------
// Vulnerability Management
// ---------------------------------------------------------------------

export async function listDeviceOsVulnerabilities(
  creds: EsetProtectCredentials,
  opts: { deviceUuid?: string; deviceGroupUuid?: string; pageSize?: number; pageToken?: string } = {}
): Promise<EsetListDeviceOsVulnerabilitiesResponse> {
  const baseUrl = domainBaseUrl('vulnerability-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListDeviceOsVulnerabilitiesResponse>(baseUrl, `/v1/device-os-vulnerabilities${buildQuery(opts)}`, headers)
  );
}

export async function listDeviceVulnerabilities(
  creds: EsetProtectCredentials,
  opts: {
    deviceUuid?: string;
    deviceGroupUuid?: string;
    vulnerabilityScope?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<EsetListDeviceVulnerabilitiesResponse> {
  const baseUrl = domainBaseUrl('vulnerability-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListDeviceVulnerabilitiesResponse>(baseUrl, `/v1/device-vulnerabilities${buildQuery(opts)}`, headers)
  );
}

export async function listRecentScans(
  creds: EsetProtectCredentials,
  opts: { deviceUuid?: string; deviceGroupUuid?: string; pageSize?: number; pageToken?: string } = {}
): Promise<EsetListRecentScanDetailsResponse> {
  const baseUrl = domainBaseUrl('vulnerability-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListRecentScanDetailsResponse>(baseUrl, `/v1/scans/recent${buildQuery(opts)}`, headers)
  );
}

export async function listVulnerableDevices(
  creds: EsetProtectCredentials,
  opts: { deviceGroupUuid?: string; pageSize?: number; pageToken?: string } = {}
): Promise<EsetListVulnerableDevicesResponse> {
  const baseUrl = domainBaseUrl('vulnerability-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListVulnerableDevicesResponse>(baseUrl, `/v1/vulnerable-devices${buildQuery(opts)}`, headers)
  );
}

// ---------------------------------------------------------------------
// Patch Management
// ---------------------------------------------------------------------

export async function listRecentApplicationPatchingDetails(
  creds: EsetProtectCredentials
): Promise<EsetListRecentApplicationPatchingDetailsResponse> {
  const baseUrl = domainBaseUrl('patch-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListRecentApplicationPatchingDetailsResponse>(
      baseUrl,
      '/v1/application-patching-processes/recent/details',
      headers
    )
  );
}

export async function listDevicePatches(
  creds: EsetProtectCredentials,
  opts: {
    deviceUuid?: string;
    deviceGroupUuid?: string;
    patchType?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<EsetListDevicePatchesResponse> {
  const baseUrl = domainBaseUrl('patch-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetListDevicePatchesResponse>(baseUrl, `/v1/device-patches${buildQuery(opts)}`, headers)
  );
}

export async function listPatchingProcessDetails(
  creds: EsetProtectCredentials,
  opts: {
    deviceUuid?: string;
    deviceGroupUuid?: string;
    startTime?: string;
    endTime?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<EsetListDevicePatchingDetailsResponse> {
  const baseUrl = domainBaseUrl('patch-management', creds.region);
  const query = buildQuery({
    'timePeriod.startTime': opts.startTime,
    'timePeriod.endTime': opts.endTime,
    deviceUuid: opts.deviceUuid,
    deviceGroupUuid: opts.deviceGroupUuid,
    pageSize: opts.pageSize,
    pageToken: opts.pageToken,
  });
  return withToken(creds, (headers) =>
    doGet<EsetListDevicePatchingDetailsResponse>(baseUrl, `/v1/patching-process-details${query}`, headers)
  );
}

// ---------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------

export async function listUsers(
  creds: EsetProtectCredentials,
  opts: {
    email?: string;
    displayName?: string;
    protectionStatus?: string;
    userGroupUuid?: string;
    cloudOfficeTenantReference?: string;
    hasCloudOfficeMsLicense?: boolean;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<EsetListUsersResponse> {
  const baseUrl = domainBaseUrl('user-management', creds.region);
  return withToken(creds, (headers) => doGet<EsetListUsersResponse>(baseUrl, `/v1/users${buildQuery(opts)}`, headers));
}

export async function getUser(creds: EsetProtectCredentials, userUuid: string): Promise<EsetGetUserResponse> {
  const baseUrl = domainBaseUrl('user-management', creds.region);
  return withToken(creds, (headers) =>
    doGet<EsetGetUserResponse>(baseUrl, `/v1/users/${encodeURIComponent(userUuid)}`, headers)
  );
}

export async function batchGetUsers(
  creds: EsetProtectCredentials,
  usersUuids: string[]
): Promise<EsetBatchGetUsersResponse> {
  const baseUrl = domainBaseUrl('user-management', creds.region);
  return withToken(creds, (headers) =>
    doPost<EsetBatchGetUsersResponse>(baseUrl, '/v1/users:batchGetUsers', headers, { usersUuids })
  );
}
