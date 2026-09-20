/**
 * Credentials a Conduit customer enters for the ESET PROTECT connector.
 *
 * ESET Connect's own OpenAPI spec (business-account.json, oauth_token_body)
 * documents its token endpoint as a `password` grant - `username`/`password`
 * fields, grant_type enum of only "password" | "refresh_token" - not a
 * client_credentials grant. In practice `clientId` is the email of a
 * dedicated API user created in ESET Business Account (User Management,
 * with the Integrations toggle enabled) and `clientSecret` is that user's
 * password. The field names below are kept as clientId/clientSecret to
 * match this wave's standard credential shape; client.ts maps them onto the
 * vendor's actual username/password body fields.
 */
export interface EsetProtectCredentials {
  clientId: string;
  clientSecret: string;
  region?: EsetProtectRegion;
}

/** ESET Connect regions - each has its own auth host and its own per-domain API hosts. */
export type EsetProtectRegion = 'us' | 'eu' | 'de' | 'jpn' | 'ca';

/** The five ESET Connect API domains this connector calls, each on its own regional host. */
export type EsetProtectDomain =
  | 'device-management'
  | 'incident-management'
  | 'vulnerability-management'
  | 'patch-management'
  | 'user-management';

/** Response body of POST /oauth/token (business-account.json's Token schema). */
export interface EsetOAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface PageParams {
  pageSize?: number;
  pageToken?: string;
}

// ---------------------------------------------------------------------
// Device Management
// ---------------------------------------------------------------------

export interface EsetDeviceGroup {
  uuid?: string;
  displayName?: string;
  isSecurityGroup?: boolean;
  linkedEntityType?: string;
  parentGroupUuid?: string;
  ownerUuid?: string;
  etag?: string;
}

export interface EsetListDeviceGroupsResponse {
  deviceGroups?: EsetDeviceGroup[];
  nextPageToken?: string;
}

export interface EsetMemberDevice {
  uuid?: string;
  displayName?: string;
  groupUuid?: string;
}

export interface EsetListMemberDevicesResponse {
  devices?: EsetMemberDevice[];
  nextPageToken?: string;
  totalSize?: number;
}

/**
 * ESET Connect's v1Device object. Several fields (activeProducts,
 * deployedComponents, hardwareProfiles, operatingSystem, tags, etc.) are
 * themselves rich nested objects that ESET's own spec leaves loosely typed
 * relative to what a monitoring connector needs - passed through as-is
 * rather than re-modeled field-by-field.
 */
export interface EsetDevice {
  uuid?: string;
  displayName?: string;
  originalDisplayName?: string;
  description?: string;
  deviceType?: string;
  deviceToken?: string;
  enrollmentStatus?: string;
  functionalityStatus?: string;
  functionalityProblemCount?: number;
  isMaster?: boolean;
  isMobile?: boolean;
  isMuted?: boolean;
  lastSyncTime?: string;
  managementDomain?: string;
  parentGroupUuid?: string;
  ownerUuid?: string;
  primaryLocalIpAddress?: string;
  publicIpAddress?: string;
  systemHostname?: string;
  etag?: string;
  [key: string]: unknown;
}

export interface EsetListDevicesResponse {
  devices?: EsetDevice[];
  nextPageToken?: string;
}

export interface EsetGetDeviceResponse {
  device?: EsetDevice;
}

export interface EsetBatchGetDevicesResponse {
  devices?: EsetDevice[];
}

// ---------------------------------------------------------------------
// Incident Management (detections v1/v2, detection-groups, edr-rules,
// edr-rule-exclusions)
// ---------------------------------------------------------------------

export interface EsetDetection {
  uuid?: string;
  displayName?: string;
  typeName?: string;
  category?: string;
  severityLevel?: string;
  occurTime?: string;
  objectName?: string;
  objectTypeName?: string;
  objectUrl?: string;
  objectHashSha1?: string;
  objectHashSha256?: string;
  [key: string]: unknown;
}

export interface EsetListDetectionsResponse {
  detections?: EsetDetection[];
  nextPageToken?: string;
  totalSize?: number;
}

export interface EsetGetDetectionResponse {
  detection?: EsetDetection;
}

export interface EsetBatchGetDetectionsResponse {
  detections?: EsetDetection[];
}

export interface EsetDetectionGroup {
  uuid?: string;
  displayName?: string;
  typeName?: string;
  category?: string;
  severityLevel?: string;
  severityScore?: number;
  resolved?: boolean;
  groupSize?: number;
  resolvedCount?: number;
  occurTime?: string;
  note?: string;
  [key: string]: unknown;
}

export interface EsetListDetectionGroupsResponse {
  detectionGroups?: EsetDetectionGroup[];
  nextPageToken?: string;
}

export interface EsetGetDetectionGroupResponse {
  detectionGroup?: EsetDetectionGroup;
}

export interface EsetEdrRule {
  uuid?: string;
  name?: string;
  enabled?: boolean;
  severityLevel?: string;
  [key: string]: unknown;
}

export interface EsetListEdrRulesResponse {
  edrRules?: EsetEdrRule[];
  nextPageToken?: string;
  totalSize?: number;
}

export interface EsetGetEdrRuleResponse {
  rule?: EsetEdrRule;
}

export interface EsetEdrRuleExclusion {
  uuid?: string;
  ruleUuid?: string;
  note?: string;
  [key: string]: unknown;
}

export interface EsetListEdrRuleExclusionsResponse {
  edrRuleExclusions?: EsetEdrRuleExclusion[];
  nextPageToken?: string;
  totalSize?: number;
}

export interface EsetGetEdrRuleExclusionResponse {
  exclusion?: EsetEdrRuleExclusion;
}

// ---------------------------------------------------------------------
// Vulnerability Management
// ---------------------------------------------------------------------

export interface EsetDeviceOsVulnerability {
  deviceUuid?: string;
  [key: string]: unknown;
}

export interface EsetListDeviceOsVulnerabilitiesResponse {
  vulnerabilities?: EsetDeviceOsVulnerability[];
  nextPageToken?: string;
}

export interface EsetDeviceVulnerability {
  deviceUuid?: string;
  vulnerabilityScope?: string;
  [key: string]: unknown;
}

export interface EsetListDeviceVulnerabilitiesResponse {
  vulnerabilities?: EsetDeviceVulnerability[];
  nextPageToken?: string;
}

export interface EsetScanDetails {
  deviceUuid?: string;
  scanUuid?: string;
  [key: string]: unknown;
}

export interface EsetListRecentScanDetailsResponse {
  scanDetails?: EsetScanDetails[];
  nextPageToken?: string;
}

export interface EsetVulnerableDevice {
  deviceUuid?: string;
  [key: string]: unknown;
}

export interface EsetListVulnerableDevicesResponse {
  devices?: EsetVulnerableDevice[];
  nextPageToken?: string;
}

// ---------------------------------------------------------------------
// Patch Management
// ---------------------------------------------------------------------

export interface EsetPatchingDetails {
  deviceUuid?: string;
  [key: string]: unknown;
}

export interface EsetListRecentApplicationPatchingDetailsResponse {
  patchingDetails?: EsetPatchingDetails[];
}

export interface EsetDevicePatches {
  deviceUuid?: string;
  [key: string]: unknown;
}

export interface EsetListDevicePatchesResponse {
  devices?: EsetDevicePatches[];
  nextPageToken?: string;
}

export interface EsetListDevicePatchingDetailsResponse {
  patchingDetails?: EsetPatchingDetails[];
  nextPageToken?: string;
}

// ---------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------

export interface EsetUser {
  uuid?: string;
  displayName?: string;
  email?: string;
  protectionStatus?: string;
  userGroupUuid?: string;
  cloudOfficeTenantReference?: string;
  hasCloudOfficeMsLicense?: boolean;
  [key: string]: unknown;
}

export interface EsetListUsersResponse {
  users?: EsetUser[];
  nextPageToken?: string;
  totalSize?: number;
}

export interface EsetGetUserResponse {
  user?: EsetUser;
}

export interface EsetBatchGetUsersResponse {
  users?: EsetUser[];
}
