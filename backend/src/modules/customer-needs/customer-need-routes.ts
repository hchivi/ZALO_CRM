import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { deliverCustomerNeed } from './customer-need-delivery.js';

const prefix = 'customer_need:';
const clean = (v: unknown, max = 3000) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const date = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const parsed = new Date(v);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v ? v : '';
};
const numberValue = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12 ? v : null;
const money = (v: unknown) => numberValue(v) !== null && /^\d+(?:\.\d{1,2})?$/.test(String(v)) ? Number(v) : null;

export function validateNeed(body: any, submit: boolean) {
  if (!body || typeof body !== 'object') throw new Error('Thông tin phiếu không hợp lệ');
  const vatRate = body.vatRate == null ? null : money(body.vatRate);
  if (body.vatRate != null && (vatRate === null || vatRate > 100)) throw new Error('VAT phải từ 0 đến 100%, tối đa 2 số lẻ');
  const items = Array.isArray(body.items) ? body.items.slice(0, 50).map((i: any) => ({
    name: clean(i?.name, 200), specification: clean(i?.specification, 1000),
    quantity: numberValue(i?.quantity), unit: clean(i?.unit, 30), unitPrice: money(i?.unitPrice) ?? 0,
  })) : [];
  const data = {
    customerType: body.customerType === '02' ? '02' : '01',
    customerName: clean(body.customerName, 200), contactPerson: clean(body.contactPerson, 200),
    phone: clean(body.phone, 50), customerEmail: clean(body.customerEmail, 200), zalo: clean(body.zalo, 100),
    closedDate: date(body.closedDate), depositDate: date(body.depositDate),
    requirement: clean(body.requirement), items, depositAmount: money(body.depositAmount),
    vatRate, extraCharges: money(body.extraCharges), discount: money(body.discount),
    paymentMethod: clean(body.paymentMethod, 100), receivingAccount: clean(body.receivingAccount, 200),
    transactionReference: clean(body.transactionReference, 200), deliveryDate: date(body.deliveryDate),
    recipient: clean(body.recipient, 200), deliveryAddress: clean(body.deliveryAddress, 1000),
    customerNote: clean(body.customerNote), internalNote: clean(body.internalNote),
    referenceLinks: clean(body.referenceLinks), priority: body.priority === 'urgent' ? 'urgent' : 'normal',
    brandId: body.brandId ? Number(body.brandId) : null,
    brandName: clean(body.brandName, 200),
    customerStatus: clean(body.customerStatus, 100),
  };
  if (submit) {
    if (!Array.isArray(body.items) || body.items.length > 50) throw new Error('Mỗi phiếu cần từ 1 đến 50 sản phẩm');
    if (body.deliveryDate && !data.deliveryDate) throw new Error('Ngày giao không hợp lệ');
    if (!data.customerName || !data.closedDate || !data.requirement) throw new Error('Vui lòng điền tên khách hàng, ngày chốt và nhu cầu');
    if (!items.length || items.some((i: any) => !i.name || i.quantity === null || i.quantity <= 0 || i.quantity > 1e6)) throw new Error('Mỗi sản phẩm cần tên và số lượng lớn hơn 0');
    if ([data.depositAmount, data.extraCharges, data.discount].some(v => v !== null && v !== undefined && !Number.isFinite(v))) throw new Error('Số tiền không hợp lệ');
    data.depositAmount = data.depositAmount || 0;
    data.extraCharges = data.extraCharges || 0;
    data.discount = data.discount || 0;
    if (data.deliveryDate && data.deliveryDate < data.closedDate) throw new Error('Ngày giao không thể trước ngày chốt');
  }
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = round(items.reduce((sum: number, i: any) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0));
  const vatAmount = round(Math.max(0, subtotal - (data.discount || 0)) * (vatRate || 0) / 100);
  const totalAmount = round(subtotal + vatAmount + (data.extraCharges || 0) - (data.discount || 0));
  if (submit && (!Number.isFinite(totalAmount) || totalAmount < 0 || totalAmount > 1e14 || ((data.depositAmount || 0) > 0 && (data.depositAmount || 0) > totalAmount))) throw new Error('Tổng tiền hoặc tiền cọc không hợp lệ');
  return { ...data, subtotal, vatAmount, totalAmount, remainingDeclared: round(Math.max(0, totalAmount - (data.depositAmount || 0))) };
}

export async function customerNeedRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  async function access(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!['owner', 'admin', 'member'].includes(user.role)) { reply.code(403).send({ error: 'Chỉ Sales và quản trị viên được tạo phiếu' }); return null; }
    const { id } = request.params as { id: string };
    const conv = await prisma.conversation.findFirst({ where: { id, orgId: user.orgId }, include: { contact: true, zaloAccount: true } });
    if (!conv) { reply.code(404).send({ error: 'Không tìm thấy hội thoại' }); return null; }
    if (user.role === 'member') {
      const userAccessCount = await prisma.zaloAccountAccess.count({ where: { userId: user.id } });
      if (userAccessCount > 0) {
        const permission = await prisma.zaloAccountAccess.findFirst({ where: { userId: user.id, zaloAccountId: conv.zaloAccountId } });
        if (!permission || !['chat', 'admin'].includes(permission.permission)) { reply.code(403).send({ error: 'Không có quyền tạo nhu cầu cho tài khoản này' }); return null; }
      }
    }
    return conv;
  }
  app.get('/api/v1/conversations/:id/customer-needs', async (request, reply) => {
    const conv = await access(request, reply); if (!conv) return;
    const rows = await prisma.appSetting.findMany({ where: { orgId: request.user.orgId, settingKey: { startsWith: `${prefix}${conv.id}:` } }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { needs: rows.map(r => JSON.parse(r.valuePlain || '{}')) };
  });
  app.post('/api/v1/conversations/:id/customer-needs', async (request, reply) => {
    const conv = await access(request, reply); if (!conv) return;
    const body = request.body as any;
    if (!['draft', 'send'].includes(body?.intent)) return reply.code(400).send({ error: 'Thao tác không hợp lệ' });
    const submit = body.intent === 'send';
    const id = clean(body.id, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply.code(400).send({ error: 'Mã phiếu không hợp lệ' });
    const orgId = request.user.orgId;
    const settingKey = `${prefix}${conv.id}:${id}`;
    const unique = { orgId_settingKey: { orgId, settingKey } };
    const existing = await prisma.appSetting.findUnique({ where: unique });
    const previous = existing?.valuePlain ? JSON.parse(existing.valuePlain) : null;
    if (previous?.status === 'sent') return { need: previous, message: 'Phiếu đã được portal tiếp nhận' };
    // Once delivery starts its payload is frozen, including after a timeout with an unknown outcome.
    if (!submit && previous?.status === 'pending_delivery') return reply.code(409).send({ error: 'Phiếu đang chờ gửi lại. Tạo phiếu mới nếu cần thay đổi nội dung.' });
    if (previous?.status !== 'pending_delivery' && (previous?.version || 0) !== (body.version || 0)) return reply.code(409).send({ error: 'Phiếu đã thay đổi. Đóng và mở lại form trước khi lưu.' });
    let data;
    try { data = validateNeed(previous?.status === 'pending_delivery' ? previous : body, submit); }
    catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
    const [org, sales] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: request.user.id }, select: { fullName: true, email: true } }),
    ]);

    let brandId = data.brandId;
    let brandName = data.brandName;
    const accountDisplayName = (conv as any)?.zaloAccount?.displayName || '';

    if (!brandId) {
      const nameLower = accountDisplayName.toLowerCase().replace(/[\s\-_.]/g, '');
      if (nameLower.includes('cgdp') || nameLower.includes('cgd')) {
        brandId = 3;
        brandName = 'CGDP.vn';
      } else if (nameLower.includes('piju')) {
        brandId = 7;
        brandName = 'PIJU.vn';
      } else if (nameLower.includes('chuyengiadongphuc') || nameLower.includes('cgia')) {
        brandId = 2;
        brandName = 'ChuyenGiaDongPhuc.vn';
      } else if (nameLower.includes('adameva') || nameLower.includes('adam')) {
        brandId = 1;
        brandName = 'AdamEva.vn';
      } else if (nameLower.includes('kcn') || nameLower.includes('teamkcn')) {
        brandId = 4;
        brandName = 'Team KCN';
      } else if (nameLower.includes('vinmerica')) {
        brandId = 5;
        brandName = 'VINMERICA';
      } else if (nameLower.includes('robert')) {
        brandId = 6;
        brandName = 'Robert Việt';
      }
    }

    const need: any = previous?.status === 'pending_delivery' ? previous : {
      ...data, id, code: previous?.code || `NC-${id.slice(0, 8).toUpperCase()}`, version: (previous?.version || 0) + 1,
      source: 'ZaloCRM', orgId,
      organizationName: brandName || org?.name,
      brandId: brandId || null,
      brandName: brandName || null,
      accountDisplayName: accountDisplayName || null,
      customerStatus: data.customerStatus || null,
      conversationId: conv.id, contactId: conv.contactId,
      zaloAccountId: conv.zaloAccountId, salesId: request.user.id, salesName: sales?.fullName, salesEmail: sales?.email,
      createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
      status: submit ? 'pending_delivery' : 'draft', depositStatus: 'sales_declared_unverified',
    };
    const valuePlain = JSON.stringify(need);
    if (previous?.status !== 'pending_delivery') {
      if (existing) {
        const saved = await prisma.appSetting.updateMany({ where: { id: existing.id, valuePlain: existing.valuePlain }, data: { valuePlain } });
        if (!saved.count) return reply.code(409).send({ error: 'Phiếu vừa được cập nhật. Vui lòng mở lại.' });
      } else {
        try { await prisma.appSetting.create({ data: { orgId, settingKey, valuePlain } }); }
        catch (error: any) {
          if (error.code === 'P2002') return reply.code(409).send({ error: 'Phiếu vừa được lưu. Vui lòng mở lại.' });
          throw error;
        }
      }
    }
    if (!submit) return { need, message: 'Đã lưu nháp' };
    if (process.env.PORTAL_MANAGED === 'true') return { need, prepared: true };
    try {
      const { receipt, url } = await deliverCustomerNeed(need);
      const sent = { ...need, status: 'sent', portalId: receipt.id, portalStatus: receipt.status, portalUrl: url, sentAt: new Date().toISOString(), deliveryError: null };
      await prisma.appSetting.updateMany({ where: { orgId, settingKey, valuePlain }, data: { valuePlain: JSON.stringify(sent) } });
      return { need: sent, message: 'Portal đã nhận phiếu. Kế toán có thể tiếp nhận tại mục Nhu cầu từ Sales.' };
    } catch (error) {
      const message = (error as Error).message;
      const pending = { ...need, deliveryError: message };
      await prisma.appSetting.updateMany({ where: { orgId, settingKey, valuePlain }, data: { valuePlain: JSON.stringify(pending) } });
      return reply.code(502).send({ need: pending, error: message });
    }
  });
}
