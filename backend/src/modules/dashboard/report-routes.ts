/**
 * report-routes.ts — Detailed reports for messages, contacts, appointments, and Excel export.
 * All routes require JWT auth, scoped to user's orgId.
 * Sheet builders are in excel-sheet-builders.ts.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import ExcelJS from 'exceljs';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import {
  buildMessagesSheet,
  buildContactsSheet,
  buildAppointmentsSheet,
  cleanMessageContent,
} from './excel-sheet-builders.js';

type QueryParams = Record<string, string>;

function defaultDateRange() {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  return { from, to };
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // GET /api/v1/reports/kpi?from=&to= — aggregate staff response times, message count, and conversions
  app.get('/api/v1/reports/kpi', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orgId } = request.user!;
      const query = request.query as QueryParams;
      const { from: defaultFrom, to: defaultTo } = defaultDateRange();
      const from = query.from || defaultFrom;
      const to = query.to || defaultTo;

      // 1. Fetch all users in organization
      const users = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
        orderBy: { fullName: 'asc' },
      });

      // 2. Query sent messages count and average response time per user using LATERAL JOIN
      const msgStats = await prisma.$queryRaw<
        Array<{ userId: string; totalSent: bigint; avgResponseTime: number | null }>
      >`
        WITH replies AS (
          SELECT
            m.replied_by_user_id AS user_id,
            EXTRACT(EPOCH FROM (m.sent_at - prev.sent_at)) AS response_time
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          -- Get the immediate previous message in the same thread
          LEFT JOIN LATERAL (
            SELECT sent_at, sender_type
            FROM messages p
            WHERE p.conversation_id = m.conversation_id
              AND p.sent_at < m.sent_at
            ORDER BY p.sent_at DESC
            LIMIT 1
          ) prev ON true
          WHERE c.org_id = ${orgId}
            AND m.sender_type = 'self'
            AND m.replied_by_user_id IS NOT NULL
            AND prev.sender_type = 'contact'
            AND m.sent_at >= ${from}::date
            AND m.sent_at < (${to}::date + interval '1 day')
        )
        SELECT
          user_id AS "userId",
          COUNT(*) AS "totalSent",
          AVG(response_time)::float AS "avgResponseTime"
        FROM replies
        GROUP BY user_id
      `;

      // 3. Query contacts count by status per assigned user
      const contactStats = await prisma.$queryRaw<
        Array<{ userId: string; status: string; count: bigint }>
      >`
        SELECT
          assigned_user_id AS "userId",
          status,
          COUNT(*) AS count
        FROM contacts
        WHERE org_id = ${orgId}
          AND assigned_user_id IS NOT NULL
        GROUP BY assigned_user_id, status
      `;

      // 4. Query total orders count and total revenue generated per user
      const orderStats = await prisma.$queryRaw<
        Array<{ userId: string; totalOrders: bigint; totalRevenue: number | null }>
      >`
        SELECT
          created_by_user_id AS "userId",
          COUNT(*) AS "totalOrders",
          SUM(total_amount)::float AS "totalRevenue"
        FROM orders
        WHERE org_id = ${orgId}
          AND created_at >= ${from}::date
          AND created_at < (${to}::date + interval '1 day')
        GROUP BY created_by_user_id
      `;

      // 5. Map queries into structured KPI dashboard objects
      const msgStatsMap = new Map(msgStats.map(s => [s.userId, s]));
      
      const contactStatsMap = new Map<string, Record<string, number>>();
      for (const row of contactStats) {
        if (!contactStatsMap.has(row.userId)) {
          contactStatsMap.set(row.userId, {});
        }
        contactStatsMap.get(row.userId)![row.status || 'new'] = Number(row.count);
      }

      const orderStatsMap = new Map(orderStats.map(s => [s.userId, s]));

      const kpiData = users.map((u) => {
        const msg = msgStatsMap.get(u.id);
        const contacts = contactStatsMap.get(u.id) || {};
        const orders = orderStatsMap.get(u.id);

        const totalContacts = Object.values(contacts).reduce((a, b) => a + b, 0);
        const convertedContacts = contacts['converted'] || 0;
        const conversionRate = totalContacts > 0 ? (convertedContacts / totalContacts) * 100 : 0;

        return {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          messagesSent: msg ? Number(msg.totalSent) : 0,
          avgResponseTime: msg ? msg.avgResponseTime : null, // seconds
          totalContacts,
          convertedContacts,
          conversionRate: Number(conversionRate.toFixed(1)),
          totalOrders: orders ? Number(orders.totalOrders) : 0,
          totalRevenue: orders ? Number(orders.totalRevenue || 0) : 0,
          statusDistribution: contacts,
        };
      });

      return { from, to, data: kpiData };
    } catch (err) {
      logger.error('[reports] KPI error:', err);
      return reply.status(500).send({ error: 'Failed to fetch KPI report' });
    }
  });

  // GET /api/v1/reports/messages?from=&to=
  app.get('/api/v1/reports/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orgId } = request.user!;
      const query = request.query as QueryParams;
      const { from: defaultFrom, to: defaultTo } = defaultDateRange();
      const from = query.from || defaultFrom;
      const to = query.to || defaultTo;

      const rows = await prisma.$queryRaw<
        Array<{ date: Date; sent: bigint; received: bigint; total: bigint }>
      >`
        SELECT
          DATE(m.sent_at) AS date,
          COUNT(*) FILTER (WHERE m.sender_type = 'self') AS sent,
          COUNT(*) FILTER (WHERE m.sender_type = 'contact') AS received,
          COUNT(*) AS total
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.org_id = ${orgId}
          AND m.sent_at >= ${from}::date
          AND m.sent_at < (${to}::date + interval '1 day')
        GROUP BY DATE(m.sent_at)
        ORDER BY date DESC
      `;

      const data = rows.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
        sent: Number(r.sent),
        received: Number(r.received),
        total: Number(r.total),
      }));

      return { from, to, data };
    } catch (err) {
      logger.error('[reports] Messages error:', err);
      return reply.status(500).send({ error: 'Failed to fetch message report' });
    }
  });

  // GET /api/v1/reports/contacts?from=&to= — contacts by status distribution and new customer breakdown
  app.get('/api/v1/reports/contacts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orgId } = request.user!;
      const query = request.query as QueryParams;
      const { from: defaultFrom, to: defaultTo } = defaultDateRange();
      const from = query.from || defaultFrom;
      const to = query.to || defaultTo;

      // 1. Query new customers: contacts whose VERY FIRST incoming message falls in [from, to]
      // Any contact who sent a message before "from" is an existing customer and excluded.
      const rawCustomers = await prisma.$queryRaw<
        Array<{
          conversationId: string;
          contactId: string | null;
          zaloAccountId: string;
          accountName: string;
          channel: string;
          customerName: string;
          phone: string | null;
          avatarUrl: string | null;
          status: string | null;
          firstMessageAt: Date;
          totalMessages: bigint;
          firstMessageContent: string | null;
        }>
      >`
        WITH contact_first_message AS (
          SELECT 
            conv.id as conv_id,
            conv.contact_id,
            conv.zalo_account_id,
            za.display_name as account_name,
            za.channel,
            c.id as contact_id,
            COALESCE(NULLIF(c.full_name, ''), NULLIF(c.phone, ''), NULLIF(c.zalo_uid, ''), 'Khách hàng') as customer_name,
            c.phone,
            c.avatar_url,
            c.status as contact_status,
            MIN(m.sent_at) FILTER (WHERE m.sender_type = 'contact') as first_contact_message_at,
            COUNT(m.id) as total_messages
          FROM conversations conv
          JOIN zalo_accounts za ON za.id = conv.zalo_account_id
          LEFT JOIN contacts c ON c.id = conv.contact_id
          JOIN messages m ON m.conversation_id = conv.id
          WHERE conv.org_id = ${orgId}
            AND conv."threadType" = 'user'
          GROUP BY conv.id, conv.contact_id, conv.zalo_account_id, za.display_name, za.channel, c.id, c.full_name, c.phone, c.zalo_uid, c.avatar_url, c.status
        ),
        new_customers AS (
          SELECT *
          FROM contact_first_message
          WHERE first_contact_message_at >= ${from}::date
            AND first_contact_message_at < (${to}::date + interval '1 day')
        )
        SELECT 
          nc.conv_id as "conversationId",
          nc.contact_id as "contactId",
          nc.zalo_account_id as "zaloAccountId",
          nc.account_name as "accountName",
          nc.channel,
          nc.customer_name as "customerName",
          nc.phone,
          nc.avatar_url as "avatarUrl",
          nc.contact_status as "status",
          nc.first_contact_message_at as "firstMessageAt",
          nc.total_messages as "totalMessages",
          fm.content as "firstMessageContent"
        FROM new_customers nc
        LEFT JOIN LATERAL (
          SELECT m.content
          FROM messages m
          WHERE m.conversation_id = nc.conv_id
            AND m.sender_type = 'contact'
          ORDER BY m.sent_at ASC
          LIMIT 1
        ) fm ON true
        ORDER BY nc.first_contact_message_at DESC
      `;

      // 2. Query summary counts per account (including accounts with 0 count)
      const accountSummaries = await prisma.$queryRaw<
        Array<{ zaloName: string; channel: string; count: bigint }>
      >`
        WITH contact_first_message AS (
          SELECT 
            conv.id as conv_id,
            conv.zalo_account_id,
            MIN(m.sent_at) FILTER (WHERE m.sender_type = 'contact') as first_contact_message_at
          FROM conversations conv
          JOIN messages m ON m.conversation_id = conv.id
          WHERE conv.org_id = ${orgId}
            AND conv."threadType" = 'user'
          GROUP BY conv.id, conv.zalo_account_id
        ),
        new_customers AS (
          SELECT conv_id, zalo_account_id
          FROM contact_first_message
          WHERE first_contact_message_at >= ${from}::date
            AND first_contact_message_at < (${to}::date + interval '1 day')
        )
        SELECT 
          za.display_name as "zaloName",
          za.channel,
          COUNT(nc.conv_id)::bigint as count
        FROM zalo_accounts za
        LEFT JOIN new_customers nc ON nc.zalo_account_id = za.id
        WHERE za.org_id = ${orgId}
        GROUP BY za.id, za.display_name, za.channel
        ORDER BY count DESC, za.display_name ASC
      `;

      // 3. Status distribution
      const statusDist = await prisma.contact.groupBy({
        by: ['status'],
        where: { orgId, status: { not: null } },
        _count: true,
      });

      const summaries = accountSummaries.map((r) => ({
        zaloName: r.zaloName || 'Không tên',
        channel: r.channel || 'zalo',
        count: Number(r.count),
      }));

      const customers = rawCustomers.map((c) => ({
        conversationId: c.conversationId,
        contactId: c.contactId,
        customerName: c.customerName,
        phone: c.phone,
        avatarUrl: c.avatarUrl,
        accountName: c.accountName,
        channel: c.channel || 'zalo',
        status: c.status,
        firstMessageAt: c.firstMessageAt instanceof Date ? c.firstMessageAt.toISOString() : String(c.firstMessageAt),
        totalMessages: Number(c.totalMessages),
        firstMessageContent: cleanMessageContent(c.firstMessageContent),
      }));

      return {
        from,
        to,
        summaries,
        customers,
        totalNewContacts: customers.length,
        // Backwards compatibility for older client versions
        newPerDay: summaries.map((s) => ({
          date: to,
          zaloName: s.zaloName,
          count: s.count,
        })),
        byStatus: statusDist.map((s) => ({
          status: s.status,
          count: s._count,
        })),
      };
    } catch (err) {
      logger.error('[reports] Contacts error:', err);
      return reply.status(500).send({ error: 'Failed to fetch contact report' });
    }
  });

  // GET /api/v1/reports/appointments?from=&to=
  app.get('/api/v1/reports/appointments', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orgId } = request.user!;
      const query = request.query as QueryParams;
      const { from: defaultFrom, to: defaultTo } = defaultDateRange();
      const from = query.from || defaultFrom;
      const to = query.to || defaultTo;

      const dateFilter = { gte: new Date(from), lte: new Date(to) };
      const [byStatus, byType] = await Promise.all([
        prisma.appointment.groupBy({
          by: ['status'],
          where: { orgId, appointmentDate: dateFilter },
          _count: true,
        }),
        prisma.appointment.groupBy({
          by: ['type'],
          where: { orgId, appointmentDate: dateFilter },
          _count: true,
        }),
      ]);

      return {
        from,
        to,
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
        byType: byType.map((t) => ({ type: t.type, count: t._count })),
      };
    } catch (err) {
      logger.error('[reports] Appointments error:', err);
      return reply.status(500).send({ error: 'Failed to fetch appointment report' });
    }
  });

  // GET /api/v1/reports/export?type=messages&from=&to=
  app.get('/api/v1/reports/export', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orgId } = request.user!;
      const query = request.query as QueryParams;
      const { from: defaultFrom, to: defaultTo } = defaultDateRange();
      const type = query.type || 'messages';
      const from = query.from || defaultFrom;
      const to = query.to || defaultTo;

      const workbook = new ExcelJS.Workbook();

      if (type === 'messages') {
        await buildMessagesSheet(workbook, orgId, from, to);
      } else if (type === 'contacts') {
        await buildContactsSheet(workbook, orgId, from, to);
      } else if (type === 'appointments') {
        await buildAppointmentsSheet(workbook, orgId, from, to);
      } else {
        return reply.status(400).send({ error: 'Invalid export type. Use: messages, contacts, appointments' });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
      return reply.send(Buffer.from(buffer as ArrayBuffer));
    } catch (err) {
      logger.error('[reports] Export error:', err);
      return reply.status(500).send({ error: 'Failed to export report' });
    }
  });
}
