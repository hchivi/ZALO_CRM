/**
 * Zalo access middleware — checks if user has sufficient permission on a Zalo account.
 * Permission hierarchy: admin > chat > read.
 * Owner/admin roles bypass the check (they have access to all accounts in their org).
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';

type Permission = 'read' | 'chat' | 'admin';

const hierarchy: Record<Permission, number> = { read: 1, chat: 2, admin: 3 };

// Factory: returns a preHandler that checks the user has at least minPermission on the Zalo account
export function requireZaloAccess(minPermission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;

    // Owner and admin have full access to all accounts in their org
    if (['owner', 'admin'].includes(user.role)) return;

    // Accountant access rules
    if (user.role === 'accountant') {
      // 1. Read-only is always permitted across the entire organization
      if (minPermission === 'read') return;

      // 2. Admin actions are strictly reserved for owner/admin
      if (minPermission === 'admin') {
        return reply.status(403).send({ error: 'Kế toán không có quyền quản trị tài khoản Zalo.' });
      }

      // 3. For 'chat' permission (sending messages, media, reminders, bank cards, etc.)
      const params = request.params as Record<string, string>;
      const conversationId = params.id;

      if (conversationId && !params.zaloAccountId) {
        try {
          const conv = await prisma.conversation.findFirst({
            where: { id: conversationId, orgId: user.orgId },
            include: { contact: true },
          });

          if (!conv) return reply.status(404).send({ error: 'Conversation not found' });

          // Case A: Group chat -> Accountant is ALLOWED to chat!
          if (conv.threadType === 'group') {
            return;
          }

          // Case B: Conversation / Contact is assigned or handed off to Accountant
          const contact = conv.contact;
          const isAssigned = contact?.assignedUserId === user.id;
          const isHandedOff = Boolean(
            contact?.notes?.includes('[Chuyển cho Kế toán]') ||
            (contact?.metadata && typeof contact.metadata === 'object' &&
              ((contact.metadata as any).handedOffToAccountant || (contact.metadata as any).customerNeed))
          );

          if (isAssigned || isHandedOff) {
            return;
          }

          // For unassigned 1-1 conversations: Accountant is strictly read-only to prevent interference with sales
          return reply.status(403).send({
            error: 'Hội thoại 1-1 với khách hàng do Sales phụ trách (Kế toán chỉ tra cứu). Kế toán được phép chat trong Nhóm chat (Group) hoặc khi khách hàng được bàn giao/phân công xử lý.',
          });
        } catch {
          return reply.status(500).send({ error: 'Internal error checking access' });
        }
      }

      // If action is on account directly (e.g. create group, etc.)
      const zaloAccountId = params.zaloAccountId || params.id;
      if (zaloAccountId) {
        const explicitAccess = await prisma.zaloAccountAccess.findFirst({
          where: { zaloAccountId, userId: user.id },
        });
        if (explicitAccess && ['chat', 'admin'].includes(explicitAccess.permission)) {
          return;
        }
      }

      return reply.status(403).send({
        error: 'Kế toán chỉ được phép chat trong Nhóm chat (Group), hội thoại được phân công xử lý, hoặc khi được Brand Admin cấp quyền Chat.',
      });
    }

    const params = request.params as Record<string, string>;
    let zaloAccountId = params.zaloAccountId || params.id;

    // If accessing via conversation, look up the Zalo account from the conversation
    if (params.id && !params.zaloAccountId) {
      try {
        const conv = await prisma.conversation.findFirst({
          where: { id: params.id, orgId: user.orgId },
          select: { zaloAccountId: true },
        });
        if (conv) zaloAccountId = conv.zaloAccountId;
      } catch {
        return reply.status(500).send({ error: 'Internal error checking access' });
      }
    }

    if (!zaloAccountId) return reply.status(404).send({ error: 'Not found' });

    try {
      const userAccessCount = await prisma.zaloAccountAccess.count({ where: { userId: user.id } });
      if (userAccessCount > 0) {
        const access = await prisma.zaloAccountAccess.findFirst({
          where: { zaloAccountId, userId: user.id },
        });

        if (!access) {
          return reply.status(403).send({ error: 'Không có quyền truy cập tài khoản Zalo này' });
        }

        const userLevel = hierarchy[access.permission as Permission] ?? 0;
        if (userLevel < hierarchy[minPermission]) {
          return reply.status(403).send({ error: 'Không đủ quyền' });
        }
      }
    } catch {
      return reply.status(500).send({ error: 'Internal error checking access' });
    }
  };
}
