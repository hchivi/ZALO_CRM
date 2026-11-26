import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNeed } from '../src/modules/customer-needs/customer-need-routes.js';
import { deliverCustomerNeed } from '../src/modules/customer-needs/customer-need-delivery.js';
import { config } from '../src/config/index.js';

const valid = () => ({
  id: 'c975ba1f-f8fb-47c9-aafd-43e152b244be', orgId: 'fc5cc08f-f1c9-48af-b8d3-58dc7f174909',
  customerName: 'Khách A', phone: '0900000000', closedDate: '2026-10-20', depositDate: '2026-10-20',
  requirement: 'Áo đồng phục', items: [{ name: 'Áo polo', quantity: 100, unitPrice: 120000 }],
  depositAmount: 3000000, extraCharges: 500000, discount: 0, paymentMethod: 'Chuyển khoản',
});

test('handoff validates deposit and recomputes totals', () => {
  const need = validateNeed({ ...valid(), totalAmount: 1 }, true);
  assert.equal(need.totalAmount, 12500000);
  assert.equal(need.remainingDeclared, 9500000);
  assert.throws(() => validateNeed({ ...valid(), depositAmount: 0 }, true), /thanh toán cọc/);
  assert.throws(() => validateNeed({ ...valid(), depositAmount: 13000000 }, true), /tiền cọc/);
  assert.throws(() => validateNeed({ ...valid(), depositDate: '2026-02-30' }, true), /ngày cọc/);
  assert.throws(() => validateNeed({ ...valid(), deliveryDate: '2026-10-19' }, true), /Ngày giao/);
  assert.throws(() => validateNeed({ ...valid(), items: [{ name: 'Áo', quantity: Infinity, unitPrice: 1 }] }, true));
  assert.doesNotThrow(() => validateNeed({ customerName: 'Bản nháp' }, false));
});

test('delivery verifies receipt identity and exposes no token in its portal link', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.PORTAL_HANDOFF_URL, originalToken = process.env.PORTAL_HANDOFF_TOKEN;
  process.env.PORTAL_HANDOFF_URL = 'https://portal.example.com';
  process.env.PORTAL_HANDOFF_TOKEN = 'test-connection-secret';
  try {
    const need = valid();
    globalThis.fetch = (async (url, options) => {
      assert.equal(String(url), 'https://portal.example.com/integrations/zalocrm/customer-needs');
      assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-connection-secret');
      assert.equal(options?.redirect, 'error');
      assert.deepEqual(JSON.parse(options?.body as string), need);
      return Response.json({ need: { id: 5, sourceId: need.id, sourceOrgId: need.orgId, status: 'pending', depositStatus: 'unverified' } }, { status: 201 });
    }) as typeof fetch;
    const result = await deliverCustomerNeed(need);
    assert.equal(result.url, 'https://portal.example.com/crm/accounting/needs?need=5');
    assert.equal(result.receipt.id, 5);
    globalThis.fetch = (async () => Response.json({ need: { id: 5, sourceId: 'another-need', sourceOrgId: need.orgId } })) as typeof fetch;
    await assert.rejects(deliverCustomerNeed(need), /Phản hồi portal không hợp lệ/);
    globalThis.fetch = (async () => { throw new Error('timeout'); }) as typeof fetch;
    await assert.rejects(deliverCustomerNeed(need), /không tạo phiếu trùng/);
    globalThis.fetch = (async () => Response.json({ message: 'Thương hiệu chưa có' }, { status: 422 })) as typeof fetch;
    await assert.rejects(deliverCustomerNeed(need), /Thương hiệu chưa có/);
    const originalProduction = config.isProduction;
    try {
      config.isProduction = true; process.env.PORTAL_HANDOFF_URL = 'http://portal.example.com';
      await assert.rejects(deliverCustomerNeed(need), /HTTPS/);
    } finally { config.isProduction = originalProduction; }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.PORTAL_HANDOFF_URL; else process.env.PORTAL_HANDOFF_URL = originalUrl;
    if (originalToken === undefined) delete process.env.PORTAL_HANDOFF_TOKEN; else process.env.PORTAL_HANDOFF_TOKEN = originalToken;
  }
});
