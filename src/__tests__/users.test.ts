import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUserTool } from '../tools/users.js';
import { jsonResponse, textOf, tokenResponse } from './test-helpers.js';

const ENV_KEYS = ['ESETPROTECT_CLIENT_ID', 'ESETPROTECT_CLIENT_SECRET'] as const;

describe('handleUserTool', () => {
  const fetchMock = vi.fn();
  let credCounter = 0;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    credCounter += 1;
    process.env.ESETPROTECT_CLIENT_ID = `users-tester-${credCounter}`;
    process.env.ESETPROTECT_CLIENT_SECRET = 'pw';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('esetprotect_list_users filters by email and protectionStatus', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ users: [{ uuid: 'u-1', email: 'a@b.com' }], totalSize: 1 }));

    const result = await handleUserTool('esetprotect_list_users', {
      email: 'a@b.com',
      protectionStatus: 'PROTECTION_STATUS_FULLY_PROTECTED',
    });
    expect(JSON.parse(textOf(result)).totalSize).toBe(1);
    const [url] = fetchMock.mock.calls[1];
    expect(url).toContain('email=a%40b.com');
    expect(url).toContain('protectionStatus=PROTECTION_STATUS_FULLY_PROTECTED');
  });

  it('esetprotect_get_user requires userUuid and fetches it', async () => {
    const missing = await handleUserTool('esetprotect_get_user', {});
    expect(missing.isError).toBe(true);

    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ user: { uuid: 'u-1', email: 'a@b.com' } }));
    const result = await handleUserTool('esetprotect_get_user', { userUuid: 'u-1' });
    expect(JSON.parse(textOf(result)).user.email).toBe('a@b.com');
  });

  it('esetprotect_batch_get_users requires a non-empty array and POSTs the body', async () => {
    const missing = await handleUserTool('esetprotect_batch_get_users', { usersUuids: [] });
    expect(missing.isError).toBe(true);

    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ users: [{ uuid: 'u-1' }, { uuid: 'u-2' }] }));
    const result = await handleUserTool('esetprotect_batch_get_users', { usersUuids: ['u-1', 'u-2'] });
    expect(JSON.parse(textOf(result)).users).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://us.user-management.eset.systems/v1/users:batchGetUsers');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ usersUuids: ['u-1', 'u-2'] });
  });
});
