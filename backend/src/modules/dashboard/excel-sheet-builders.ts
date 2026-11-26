/**
 * excel-sheet-builders.ts — ExcelJS worksheet builders for each report type.
 * Each function adds a worksheet to the provided workbook and populates it with data.
 */
import ExcelJS from 'exceljs';
import { prisma } from '../../shared/database/prisma-client.js';

export async function buildMessagesSheet(
  workbook: ExcelJS.Workbook,
  orgId: string,
  from: string,
  to: string,
): Promise<void> {
  const sheet = workbook.addWorksheet('Tin nhắn');
  sheet.columns = [
    { header: 'Ngày', key: 'date', width: 15 },
    { header: 'Đã gửi', key: 'sent', width: 12 },
    { header: 'Đã nhận', key: 'received', width: 12 },
    { header: 'Tổng', key: 'total', width: 12 },
  ];

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

  for (const r of rows) {
    sheet.addRow({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      sent: Number(r.sent),
      received: Number(r.received),
      total: Number(r.total),
    });
  }
}

export function cleanMessageContent(raw: string | null | undefined): string {
  if (!raw) return '—';
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.title) return String(parsed.title);
      if (parsed.catId || parsed.type === 7) return '[Sticker]';
      if (parsed.url || parsed.href) return parsed.url || parsed.href;
      if (parsed.text) return String(parsed.text);
    } catch {
      // not json
    }
  }
  return trimmed;
}

export async function buildContactsSheet(
  workbook: ExcelJS.Workbook,
  orgId: string,
  from: string,
  to: string,
): Promise<void> {
  const sheet = workbook.addWorksheet('Khách hàng mới');
  sheet.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Tên khách hàng', key: 'customerName', width: 28 },
    { header: 'Số điện thoại', key: 'phone', width: 18 },
    { header: 'Thương hiệu / Tài khoản', key: 'accountName', width: 26 },
    { header: 'Kênh', key: 'channel', width: 12 },
    { header: 'Thời gian nhắn đầu tiên', key: 'firstMessageAt', width: 24 },
    { header: 'Tổng tin nhắn', key: 'totalMessages', width: 14 },
    { header: 'Nội dung tin nhắn đầu', key: 'firstMessageContent', width: 45 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF004526' }, // Brand green
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  const rows = await prisma.$queryRaw<
    Array<{
      customerName: string;
      phone: string | null;
      accountName: string;
      channel: string;
      firstMessageAt: Date;
      totalMessages: bigint;
      firstMessageContent: string | null;
    }>
  >`
    WITH contact_first_message AS (
      SELECT 
        conv.id as conv_id,
        za.display_name as account_name,
        za.channel,
        COALESCE(NULLIF(c.full_name, ''), NULLIF(c.phone, ''), NULLIF(c.zalo_uid, ''), 'Khách hàng') as customer_name,
        c.phone,
        MIN(m.sent_at) FILTER (WHERE m.sender_type = 'contact') as first_contact_message_at,
        COUNT(m.id) as total_messages
      FROM conversations conv
      JOIN zalo_accounts za ON za.id = conv.zalo_account_id
      LEFT JOIN contacts c ON c.id = conv.contact_id
      JOIN messages m ON m.conversation_id = conv.id
      WHERE conv.org_id = ${orgId}
        AND conv."threadType" = 'user'
      GROUP BY conv.id, za.display_name, za.channel, c.id, c.full_name, c.phone, c.zalo_uid
    ),
    new_customers AS (
      SELECT *
      FROM contact_first_message
      WHERE first_contact_message_at >= ${from}::date
        AND first_contact_message_at < (${to}::date + interval '1 day')
    )
    SELECT 
      nc.customer_name as "customerName",
      nc.phone,
      nc.account_name as "accountName",
      nc.channel,
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

  let stt = 1;
  for (const r of rows) {
    const d = r.firstMessageAt instanceof Date ? r.firstMessageAt : new Date(r.firstMessageAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formattedDate = isNaN(d.getTime())
      ? String(r.firstMessageAt)
      : `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

    sheet.addRow({
      stt: stt++,
      customerName: r.customerName,
      phone: r.phone || '—',
      accountName: r.accountName,
      channel: (r.channel || 'zalo').toUpperCase(),
      firstMessageAt: formattedDate,
      totalMessages: Number(r.totalMessages),
      firstMessageContent: cleanMessageContent(r.firstMessageContent),
    });
  }
}

export async function buildAppointmentsSheet(
  workbook: ExcelJS.Workbook,
  orgId: string,
  from: string,
  to: string,
): Promise<void> {
  const sheet = workbook.addWorksheet('Lịch hẹn');
  sheet.columns = [
    { header: 'Trạng thái', key: 'status', width: 20 },
    { header: 'Số lượng', key: 'count', width: 12 },
  ];

  const dateFilter = { gte: new Date(from), lte: new Date(to) };
  const stats = await prisma.appointment.groupBy({
    by: ['status'],
    where: { orgId, appointmentDate: dateFilter },
    _count: true,
  });

  for (const s of stats) {
    sheet.addRow({ status: s.status, count: s._count });
  }
}
