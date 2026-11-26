import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { prisma } from '../src/shared/database/prisma-client.js';
import { customerNeedRoutes } from '../src/modules/customer-needs/customer-need-routes.js';

test('sending persists a frozen payload and retries without duplicate or changed content', async () => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-auth-secret-that-is-only-for-tests' });
  const orgId = 'fc5cc08f-f1c9-48af-b8d3-58dc7f174909';
  const id = 'c975ba1f-f8fb-47c9-aafd-43e152b244be';
  const conversationId = '26f98f7f-ddf5-47a5-b8d8-8f19f55f031a';
  const delegates = prisma as any;
  const originals: Array<() => void> = [];
  const mock = (delegate: any, method: string, value: any) => { const prev = delegate[method]; originals.push(() => { delegate[method] = prev; }); delegate[method] = value; };
  let saved: any = null;
  mock(delegates.conversation, 'findFirst', async () => ({ id: conversationId, orgId, contact: { status: 'converted' }, contactId: null, zaloAccountId: '8934a2ac-1c0b-4394-a224-f699feb9efa3' }));
  mock(delegates.organization, 'findUnique', async () => ({ name: 'Brand A' }));
  mock(delegates.user, 'findUnique', async () => ({ fullName: 'Sales An', email: 'an@example.com' }));
  mock(delegates.appSetting, 'findUnique', async () => saved ? { ...saved } : null);
  mock(delegates.appSetting, 'create', async ({ data }: any) => { saved = { id: 'row-1', ...data }; return saved; });
  mock(delegates.appSetting, 'updateMany', async ({ where, data }: any) => {
    if (!saved || (where.valuePlain !== undefined && where.valuePlain !== saved.valuePlain)) return { count: 0 };
    saved = { ...saved, ...data }; return { count: 1 };
  });
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.PORTAL_HANDOFF_URL, originalToken = process.env.PORTAL_HANDOFF_TOKEN;
  process.env.PORTAL_HANDOFF_URL = 'https://portal.example.com'; process.env.PORTAL_HANDOFF_TOKEN = 'test-token';
  let deliveries = 0;
  globalThis.fetch = (async (_url, options) => {
    ++deliveries;
    const sent = JSON.parse(options?.body as string);
    assert.equal(sent.customerName, 'Khách A');
    assert.equal(JSON.parse(saved.valuePlain).status, 'pending_delivery');
    if (deliveries === 1) throw new Error('simulated timeout');
    return Response.json({ need: { id: 7, sourceId: id, sourceOrgId: orgId, status: 'pending', depositStatus: 'unverified' } });
  }) as typeof fetch;
  try {
    await app.register(customerNeedRoutes);
    const authorization = `Bearer ${app.jwt.sign({ id: 'a0e9ce17-f98b-4d6a-b39b-53bc6bb02126', orgId, role: 'owner' })}`;
    const url = `/api/v1/conversations/${conversationId}/customer-needs`;
    const payload: any = { id, version: 0, intent: 'send', customerName: 'Khách A', phone: '0900000000', closedDate: '2026-10-20', depositDate: '2026-10-20', requirement: 'Đồng phục', items: [{ name: 'Áo polo', quantity: 10, unitPrice: 100000 }], depositAmount: 300000, extraCharges: 0, discount: 0, paymentMethod: 'Chuyển khoản' };
    const first = await app.inject({ method: 'POST', url, headers: { authorization }, payload });
    assert.equal(first.statusCode, 502);
    assert.equal(first.json().need.status, 'pending_delivery');
    const draft = await app.inject({ method: 'POST', url, headers: { authorization }, payload: { ...payload, intent: 'draft' } });
    assert.equal(draft.statusCode, 409);
    const retry = await app.inject({ method: 'POST', url, headers: { authorization }, payload: { ...payload, customerName: 'Changed after timeout' } });
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.json().need.status, 'sent');
    assert.equal(retry.json().need.customerName, 'Khách A');
    assert.equal(JSON.parse(saved.valuePlain).portalId, 7);
    const repeated = await app.inject({ method: 'POST', url, headers: { authorization }, payload });
    assert.equal(repeated.statusCode, 200);
    assert.equal(deliveries, 2);
  } finally {
    for (const restore of originals.reverse()) restore();
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.PORTAL_HANDOFF_URL; else process.env.PORTAL_HANDOFF_URL = originalUrl;
    if (originalToken === undefined) delete process.env.PORTAL_HANDOFF_TOKEN; else process.env.PORTAL_HANDOFF_TOKEN = originalToken;
    await app.close();
  }
});
