/**
 * Auth middleware — verifies JWT on protected routes.
 * JWT user shape is defined in shared/types/fastify-jwt-user.d.ts.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../shared/utils/logger.js';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Bypass global header authentication for proxy file downloads
  // We verify it manually inside the route handler using the token in query parameter
  if (
    request.url.startsWith('/api/v1/files/download') ||
    request.url.startsWith('/api/v1/files/message-file') ||
    request.url.startsWith('/api/v1/public/brand')
  ) {
    return;
  }

  try {
    await request.jwtVerify();
    if (process.env.PORTAL_MANAGED === 'true') {
      const { prisma } = await import('../../shared/database/prisma-client.js');
      const user = request.user;
      if (!(user as any).portal || !await prisma.user.findFirst({where:{id:user.id,orgId:user.orgId,isActive:true}})) return void reply.code(401).send({error:'Phiên portal không hợp lệ'});
      const pathname = request.url.split('?')[0];
      const routeId = /^\/api\/v1\/(conversations|contacts|orders|zalo-accounts)\/([0-9a-f-]{36})(?:\/|$)/i.exec(pathname);
      if (routeId) {
        const table:any = ({conversations:prisma.conversation,contacts:prisma.contact,orders:prisma.order,'zalo-accounts':prisma.zaloAccount} as any)[routeId[1]];
        const record = await table.findFirst({where:{id:routeId[2],orgId:user.orgId}});
        if (!record) return void reply.code(404).send({error:'Không tìm thấy dữ liệu trong thương hiệu hiện tại'});
        const accountId = routeId[1] === 'zalo-accounts' ? record.id : record.zaloAccountId;
        if (accountId && !['owner','admin'].includes(user.role)) {
          const userAccessCount = await prisma.zaloAccountAccess.count({ where: { userId: user.id } });
          if (userAccessCount > 0) {
            const access = await prisma.zaloAccountAccess.findFirst({where:{zaloAccountId:accountId,userId:user.id}});
            if (!access) return void reply.code(403).send({error:'Chưa được phân quyền tài khoản Zalo này'});
          }
        }
        if (routeId[1] === 'zalo-accounts' && /\/(login|reconnect|disconnect|access)(?:\/|$)/.test(pathname) && !['owner','admin'].includes(user.role)) return void reply.code(403).send({error:'Chỉ quản trị viên quản lý kết nối Zalo'});
      }
      const body=request.body as any;
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const [field,table] of [['contactId',prisma.contact],['conversationId',prisma.conversation],['zaloAccountId',prisma.zaloAccount],['assignedUserId',prisma.user],['userId',prisma.user],['teamId',prisma.team]] as const) {
          if (typeof body[field] === 'string' && body[field] && !await (table as any).findFirst({where:{id:body[field],orgId:user.orgId}})) return void reply.code(403).send({error:'Tham chiếu ngoài phạm vi thương hiệu'});
        }
      }
    }
  } catch (err: any) {
    logger.warn('[auth-middleware] failed:', err?.message || err);
    reply.status(401).send({ error: 'Unauthorized' });
  }
}
