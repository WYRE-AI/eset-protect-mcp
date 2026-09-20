import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleEdrTool } from '../tools/edr.js';
import { jsonResponse, textOf, tokenResponse } from './test-helpers.js';

const ENV_KEYS = ['ESETPROTECT_CLIENT_ID', 'ESETPROTECT_CLIENT_SECRET'] as const;

describe('handleEdrTool', () => {
  const fetchMock = vi.fn();
  let credCounter = 0;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    credCounter += 1;
    process.env.ESETPROTECT_CLIENT_ID = `edr-user-${credCounter}`;
    process.env.ESETPROTECT_CLIENT_SECRET = 'pw';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('esetprotect_list_edr_rules fetches from /v2/edr-rules', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ edrRules: [{ uuid: 'rule-1' }] }));
    const result = await handleEdrTool('esetprotect_list_edr_rules', { includeTotalSize: true });
    expect(JSON.parse(textOf(result)).edrRules[0].uuid).toBe('rule-1');
    expect(fetchMock.mock.calls[1][0]).toBe('https://us.incident-management.eset.systems/v2/edr-rules?includeTotalSize=true');
  });

  it('esetprotect_get_edr_rule requires ruleUuid and fetches it', async () => {
    const missing = await handleEdrTool('esetprotect_get_edr_rule', {});
    expect(missing.isError).toBe(true);

    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ rule: { uuid: 'rule-1' } }));
    const result = await handleEdrTool('esetprotect_get_edr_rule', { ruleUuid: 'rule-1' });
    expect(JSON.parse(textOf(result)).rule.uuid).toBe('rule-1');
  });

  it('esetprotect_list_edr_rule_exclusions fetches from /v2/edr-rule-exclusions', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({ edrRuleExclusions: [] }));
    await handleEdrTool('esetprotect_list_edr_rule_exclusions', {});
    expect(fetchMock.mock.calls[1][0]).toBe('https://us.incident-management.eset.systems/v2/edr-rule-exclusions');
  });

  it('esetprotect_get_edr_rule_exclusion requires exclusionUuid and fetches it', async () => {
    const missing = await handleEdrTool('esetprotect_get_edr_rule_exclusion', {});
    expect(missing.isError).toBe(true);

    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ exclusion: { uuid: 'excl-1' } }));
    const result = await handleEdrTool('esetprotect_get_edr_rule_exclusion', { exclusionUuid: 'excl-1' });
    expect(JSON.parse(textOf(result)).exclusion.uuid).toBe('excl-1');
  });
});
