/**
 * message-handler.ts — persists incoming Zalo messages to the database.
 * Called from zalo-pool's startListener on every 'message' / 'undo' event.
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { randomUUID } from 'node:crypto';
import { emitWebhook } from '../api/webhook-service.js';
import { zaloPool } from '../zalo/zalo-pool.js';
import {
  buildCandidateSerializedIds,
  mergeOutgoingSelfEcho,
} from '../whatsapp/whatsapp-media-helpers.js';
import { sendTelegramCustomerAlert } from '../../shared/services/telegram-notification.js';

// Cooldown cache to prevent spamming Zalo groups: conversationId -> timestamp of last notification
const alertCooldowns = new Map<string, number>();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// Asynchronously send a notification alert to the designated Zalo group
function triggerGroupAlert(
  orgId: string,
  zaloAccountId: string,
  zaloAccountName: string,
  customerName: string,
  messageContent: string,
  conversationId: string
) {
  // Fire-and-forget, wrapped in try/catch to be 100% resilient
  Promise.resolve().then(async () => {
    try {
      // 1. Fetch group settings
      const alertGroupIdSetting = await prisma.appSetting.findFirst({
        where: { orgId, settingKey: 'ai_alert_group_id' }
      });
      const alertGroupId = alertGroupIdSetting?.valuePlain;

      if (!alertGroupId || !alertGroupId.trim()) {
        return; // No group alert configured
      }

      // 🚀 Smart group routing: Find a connected Zalo account in this org that is actually a member of the alert group
      const groupConversation = await prisma.conversation.findFirst({
        where: {
          orgId,
          externalThreadId: alertGroupId,
          threadType: 'group'
        },
        select: { zaloAccountId: true }
      });

      const senderAccountId = groupConversation?.zaloAccountId || zaloAccountId;

      // 2. Get active Zalo API instance of the member account
      const api = zaloPool.getApi(senderAccountId);
      if (!api) {
        logger.warn(`[group-alert] Zalo account ${senderAccountId} not connected, cannot send alert`);
        return;
      }

      // 3. Construct message
      const snippet = messageContent.length > 150 ? `${messageContent.slice(0, 150)}...` : messageContent;
      const alertMsg = `🔔 [Zalo CRM] Chị ơi, có khách mới "${customerName}" vừa nhắn vào Zalo "${zaloAccountName}":\n"${snippet}"\n👉 Vui lòng vào CRM để xử lý phản hồi nhé!`;

      // 4. Send group message (type = 1 for Group)
      await api.sendMessage({ msg: alertMsg }, alertGroupId, 1);
      logger.info(`[group-alert] Sent customer alert for "${customerName}" to group ${alertGroupId}`);
    } catch (err) {
      logger.error('[group-alert] Error sending notification:', err);
    }
  });
}

export interface IncomingMessage {
  accountId: string;
  senderUid: string;
  senderName: string;       // zaloName (from cache or dName fallback)
  content: string;
  contentType: string;      // text, image, sticker, video, voice, gif, link, file
  msgId: string;
  timestamp: number;        // epoch ms
  isSelf: boolean;
  threadId: string;         // For user: contact UID. For group: group ID
  threadType: 'user' | 'group'; // user or group conversation
  groupName?: string;       // group name if group message
  groupAvatar?: string;     // group avatar if group message
  senderAvatar?: string;    // avatar of the message sender
  customerName?: string;    // customer display name if resolved
  customerAvatar?: string;  // customer avatar if resolved
  attachments?: any[];
  channel?: string;
  senderPhone?: string;
  isEdited?: boolean;
}

export interface HandleMessageResult {
  message: {
    id: string;
    conversationId: string;
    zaloMsgId: string | null;
    senderType: string;
    senderUid: string | null;
    senderName: string | null;
    content: string | null;
    contentType: string;
    attachments: any;
    isDeleted: boolean;
    deletedAt: Date | null;
    sentAt: Date;
    repliedByUserId: string | null;
    createdAt: Date;
  };
  conversationId: string;
  orgId: string;
  contactId: string | null;
  isNew: boolean;
  isLinked: boolean;
  isUpdated?: boolean;
}

export async function handleIncomingMessage(
  msg: IncomingMessage,
): Promise<HandleMessageResult | null> {
  try {
    const account = await prisma.zaloAccount.findUnique({
      where: { id: msg.accountId },
      select: { orgId: true, ownerUserId: true, displayName: true, channel: true, org: { select: { name: true } } },
    });
    if (!account) return null;

    const channel = msg.channel || account.channel || 'zalo';

    // Check if conversation exists and what its isReplied status is before upserting/updating
    let isNewConversation = false;
    let wasReplied = true;
    const existingConversation = await prisma.conversation.findFirst({
      where: { zaloAccountId: msg.accountId, externalThreadId: msg.threadId },
      select: { id: true, isReplied: true },
    });
    if (!existingConversation) {
      isNewConversation = true;
    } else {
      wasReplied = existingConversation.isReplied;
    }

    const contactId = await upsertContact(msg, account.orgId, channel);

    const conversation = await findOrCreateConversation(msg, account.orgId, contactId, channel);

    const sentAt = new Date(msg.timestamp);

    const candidateMsgIds =
      msg.msgId && channel === 'whatsapp'
        ? buildCandidateSerializedIds(msg.msgId, msg.threadId, msg.isSelf)
        : msg.msgId
          ? [msg.msgId]
          : [];

    // Fast path: if msgId already exists in DB, it is an already-synced message.
    // Return immediately with isNew: false, avoiding unnecessary delay and notification spam.
    if (candidateMsgIds.length > 0) {
      const existingByZaloId = await prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          zaloMsgId: candidateMsgIds.length === 1 ? candidateMsgIds[0] : { in: candidateMsgIds },
        },
        include: {
          repliedBy: { select: { id: true, fullName: true, role: true } },
        },
      });
      if (existingByZaloId) {
        let isUpdated = false;
        const isPlaceholder =
          !existingByZaloId.content?.trim() ||
          existingByZaloId.content.trim() === '[Phản hồi từ Meta AI]';
        const isMetaOrBot =
          msg.senderUid?.toLowerCase().includes('meta') ||
          msg.threadId?.toLowerCase().includes('meta') ||
          msg.threadId?.includes('13135550002');
        const needsTextUpdate =
          Boolean(msg.content?.trim()) &&
          msg.content.trim() !== (existingByZaloId.content || '').trim() &&
          (isPlaceholder || msg.isEdited || isMetaOrBot);

        if (channel === 'whatsapp' && (msg.isSelf || existingByZaloId.content?.includes('"href":""') || needsTextUpdate)) {
          const merged = mergeOutgoingSelfEcho(
            {
              zaloMsgId: existingByZaloId.zaloMsgId,
              content: existingByZaloId.content,
              contentType: existingByZaloId.contentType,
              attachments: existingByZaloId.attachments,
            },
            {
              msgId: msg.msgId,
              content: msg.content,
              contentType: msg.contentType,
              attachments: msg.attachments,
            },
          );
          if (needsTextUpdate && msg.content?.trim()) {
            merged.content = msg.content.trim();
          }
          const attChanged = JSON.stringify(merged.attachments) !== JSON.stringify(existingByZaloId.attachments);
          if (
            merged.content !== (existingByZaloId.content || '') ||
            merged.zaloMsgId !== existingByZaloId.zaloMsgId ||
            attChanged
          ) {
            await prisma.message.update({
              where: { id: existingByZaloId.id },
              data: {
                zaloMsgId: merged.zaloMsgId,
                content: merged.content,
                contentType: merged.contentType,
                attachments: merged.attachments as any,
              },
            }).catch(() => {});
            existingByZaloId.zaloMsgId = merged.zaloMsgId;
            existingByZaloId.content = merged.content;
            existingByZaloId.contentType = merged.contentType;
            existingByZaloId.attachments = merged.attachments as any;
            isUpdated = true;
          }
        }
        // Retain and update Zalo metadata (e.g. cliMsgId) from incoming webhook if missing in DB
        if (msg.attachments && msg.attachments.length > 0) {
          const incomingMeta = (msg.attachments as any[]).find((a) => a?.type === 'zalo_meta' || a?.cliMsgId);
          const existingMeta = Array.isArray(existingByZaloId.attachments) && (existingByZaloId.attachments as any[]).find((a) => a?.type === 'zalo_meta' || a?.cliMsgId);
          if (incomingMeta && (!existingMeta || existingMeta.cliMsgId !== incomingMeta.cliMsgId)) {
            const mergedAtts = Array.isArray(existingByZaloId.attachments) ? [...existingByZaloId.attachments] : [];
            const idx = mergedAtts.findIndex((a: any) => a?.type === 'zalo_meta');
            if (idx >= 0) {
              mergedAtts[idx] = incomingMeta;
            } else {
              mergedAtts.push(incomingMeta);
            }
            await prisma.message.update({
              where: { id: existingByZaloId.id },
              data: { attachments: mergedAtts },
            }).catch(() => {});
            existingByZaloId.attachments = mergedAtts as any;
          }
        }
        await updateConversationAfterMessage(conversation.id, sentAt, msg.isSelf, true);
        return {
          message: existingByZaloId,
          conversationId: conversation.id,
          orgId: account.orgId,
          contactId,
          isNew: false,
          isLinked: false,
          isUpdated,
        };
      }
    }

    let message;
    let isLinked = false;
    let isNew = false;

    if (msg.isSelf) {
      // Delay webhook processing by 500ms to allow concurrent DB writes
      // from chat-routes.ts or ai-service.ts to fully commit before checking for existence.
      await new Promise((resolve) => setTimeout(resolve, 500));

      const trimmedContent = msg.content ? msg.content.trim() : '';
      const isMedia = ['image', 'video', 'file', 'voice'].includes(msg.contentType);

      // Find a recently sent message in the database (within last 60 seconds)
      // to link the real zaloMsgId and details to the optimistic/API message sent via CRM
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
      let existingMessage = candidateMsgIds.length > 0
        ? await prisma.message.findFirst({
            where: {
              conversationId: conversation.id,
              senderType: 'self',
              zaloMsgId: candidateMsgIds.length === 1 ? candidateMsgIds[0] : { in: candidateMsgIds },
            },
            orderBy: { sentAt: 'desc' },
          })
        : null;

      if (!existingMessage && trimmedContent) {
        existingMessage = await prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            senderType: 'self',
            content: trimmedContent,
            contentType: msg.contentType,
            sentAt: { gte: sixtySecondsAgo },
          },
          orderBy: { sentAt: 'desc' },
        });
      }

      if (!existingMessage && isMedia) {
        existingMessage = await prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            senderType: 'self',
            contentType: msg.contentType,
            sentAt: { gte: sixtySecondsAgo },
            OR: [
              { zaloMsgId: { startsWith: 'wa_out_' } },
              { content: { contains: '"href":""' } },
            ],
          },
          orderBy: { sentAt: 'asc' },
        });
      }

      if (existingMessage) {
        const merged = mergeOutgoingSelfEcho(
          {
            zaloMsgId: existingMessage.zaloMsgId,
            content: existingMessage.content,
            contentType: existingMessage.contentType,
            attachments: existingMessage.attachments,
          },
          {
            msgId: msg.msgId,
            content: msg.content,
            contentType: msg.contentType,
            attachments: msg.attachments,
          },
        );

        message = await prisma.message.update({
          where: { id: existingMessage.id },
          data: {
            zaloMsgId: merged.zaloMsgId,
            content: merged.content,
            contentType: merged.contentType,
            attachments: merged.attachments as any,
          },
          include: {
            repliedBy: { select: { id: true, fullName: true, role: true } },
          },
        });
        isLinked = true;
        logger.info(`[message-handler] Deduplicated and linked message ${msg.msgId} to existing DB message ${existingMessage.id}`);
      }
    }

    if (!message) {
      const trimmedContent = msg.content ? msg.content.trim() : '';
      message = await prisma.message.create({
        data: {
          id: randomUUID(),
          conversationId: conversation.id,
          zaloMsgId: msg.msgId || null,
          senderType: msg.isSelf ? 'self' : 'contact',
          senderUid: msg.senderUid,
          senderName: msg.senderName || null,
          content: trimmedContent,
          contentType: msg.contentType || 'text',
          attachments: msg.attachments ?? [],
          sentAt,
        },
        include: {
          repliedBy: { select: { id: true, fullName: true, role: true } },
        },
      });
      isNew = true;
    }

    await updateConversationAfterMessage(conversation.id, sentAt, msg.isSelf);

    // Track first outbound contact date — set once when agent sends first message
    if (msg.isSelf && contactId) {
      prisma.contact.updateMany({
        where: { id: contactId, firstContactDate: null },
        data: { firstContactDate: new Date(msg.timestamp) },
      }).catch(() => {});
    }

    // Emit webhook for message event (fire-and-forget)
    emitWebhook(account.orgId, msg.isSelf ? 'message.sent' : 'message.received', {
      messageId: message.id,
      conversationId: conversation.id,
      senderUid: msg.senderUid,
      content: msg.content,
      contentType: msg.contentType,
      sentAt: message.sentAt,
    });

    // Gửi thông báo đến Telegram Bot khi có khách hàng gửi tin nhắn mới (Zalo & WhatsApp CRM)
    if (isNew && !msg.isSelf) {
      const customerDisplayName = msg.threadType === 'group'
        ? (msg.senderName ? `${msg.senderName} (${msg.groupName || 'Nhóm'})` : (msg.groupName || 'Nhóm'))
        : (msg.senderName || msg.customerName || 'Khách hàng');

      sendTelegramCustomerAlert({
        messageId: message.id,
        customerName: customerDisplayName,
        accountDisplayName: account.displayName,
        brandName: account.org?.name,
        content: msg.content,
        contentType: msg.contentType,
        channel: channel,
        orgId: account.orgId,
        attachments: msg.attachments,
      });
    }

    // Trigger Zalo Group Notification Alert in background ONLY if this is a genuine new customer inquiry
    if (isNew && !msg.isSelf && msg.threadType === 'user' && (isNewConversation || wasReplied)) {
      const lastAlertTime = alertCooldowns.get(conversation.id) || 0;
      const now = Date.now();
      if (now - lastAlertTime > ALERT_COOLDOWN_MS) {
        alertCooldowns.set(conversation.id, now);
        triggerGroupAlert(
          account.orgId,
          msg.accountId,
          account.displayName || 'Không rõ',
          msg.senderName || 'Khách hàng',
          msg.content || '[Tin nhắn hình ảnh/tệp đính kèm]',
          conversation.id
        );
      }
    }

    return {
      message,
      conversationId: conversation.id,
      orgId: account.orgId,
      contactId,
      isNew,
      isLinked,
    };
  } catch (err) {
    logger.error('[message-handler] handleIncomingMessage error:', err);
    return null;
  }
}

// Upsert contact — handles both user and group conversations
async function upsertContact(msg: IncomingMessage, orgId: string, channel = 'zalo'): Promise<string | null> {
  // Group messages: create/update a "contact" record representing the group
  if (msg.threadType === 'group') {
    const groupUid = msg.threadId;
    let groupContact = await prisma.contact.findFirst({
      where: { zaloUid: groupUid, orgId },
      select: { id: true, fullName: true, avatarUrl: true },
    });

    if (!groupContact) {
      groupContact = await prisma.contact.create({
        data: {
          id: randomUUID(),
          orgId,
          zaloUid: groupUid,
          channel,
          fullName: msg.groupName || (channel === 'whatsapp' ? 'Nhóm WhatsApp' : 'Nhóm Zalo'),
          avatarUrl: msg.groupAvatar || null,
          metadata: { isGroup: true, channel },
        },
        select: { id: true, fullName: true, avatarUrl: true },
      });
      // Emit webhook for new contact created
      emitWebhook(orgId, 'contact.created', { contactId: groupContact.id, fullName: groupContact.fullName });
      if (groupContact.avatarUrl) {
        zaloPool.getIO()?.emit('contact:updated', {
          id: groupContact.id,
          contactId: groupContact.id,
          zaloUid: groupUid,
          avatarUrl: groupContact.avatarUrl,
          fullName: groupContact.fullName,
        });
      }
    } else {
      const updates: any = {};
      if (msg.groupName && groupContact.fullName !== msg.groupName) {
        updates.fullName = msg.groupName;
      }
      if (msg.groupAvatar && (!groupContact.avatarUrl || groupContact.avatarUrl !== msg.groupAvatar)) {
        updates.avatarUrl = msg.groupAvatar;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.contact.update({
          where: { id: groupContact.id },
          data: updates,
        });
        zaloPool.getIO()?.emit('contact:updated', {
          id: groupContact.id,
          contactId: groupContact.id,
          zaloUid: groupUid,
          avatarUrl: updates.avatarUrl || groupContact.avatarUrl,
          fullName: updates.fullName || groupContact.fullName,
        });
      }
    }
    return groupContact.id;
  }

  // User messages
  const contactUid = msg.isSelf ? msg.threadId : msg.senderUid;
  if (!contactUid) return null;

  const targetName = msg.isSelf ? (msg.customerName || undefined) : (msg.customerName || msg.senderName);
  const targetAvatar = msg.customerAvatar || msg.senderAvatar;

  let contact = await prisma.contact.findFirst({
    where: {
      orgId,
      OR: [
        { zaloUid: contactUid },
        ...(channel === 'whatsapp' ? [{ whatsappJid: contactUid }] : []),
      ],
    },
    select: { id: true, fullName: true, phone: true, avatarUrl: true },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        id: randomUUID(),
        orgId,
        zaloUid: contactUid,
        whatsappJid: channel === 'whatsapp' ? contactUid : undefined,
        channel,
        phone: msg.senderPhone || undefined,
        fullName: targetName || 'Khách hàng',
        avatarUrl: targetAvatar || null,
      },
      select: { id: true, fullName: true, phone: true, avatarUrl: true },
    });
    // Emit webhook for new contact created
    emitWebhook(orgId, 'contact.created', { contactId: contact.id, fullName: contact.fullName });
    if (contact.avatarUrl || (contact.fullName && contact.fullName !== 'Khách hàng')) {
      zaloPool.getIO()?.emit('contact:updated', {
        id: contact.id,
        contactId: contact.id,
        zaloUid: contactUid,
        avatarUrl: contact.avatarUrl,
        fullName: contact.fullName,
        phone: contact.phone,
      });
    }
  } else {
    const updates: any = {};
    if (targetName && targetName !== 'Khách hàng' && (!contact.fullName || contact.fullName === 'Khách hàng' || contact.fullName === 'Unknown' || contact.fullName !== targetName)) {
      updates.fullName = targetName;
    }
    if (targetAvatar && (!contact.avatarUrl || contact.avatarUrl !== targetAvatar)) {
      updates.avatarUrl = targetAvatar;
    }
    if (channel === 'whatsapp' && !contact.phone && msg.senderPhone) {
      updates.phone = msg.senderPhone;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: updates,
      });
      zaloPool.getIO()?.emit('contact:updated', {
        id: contact.id,
        contactId: contact.id,
        zaloUid: contactUid,
        avatarUrl: updates.avatarUrl || contact.avatarUrl,
        fullName: updates.fullName || contact.fullName,
        phone: updates.phone || contact.phone,
      });
    }
  }

  return contact.id;
}

// Find or create conversation — externalThreadId = threadId for both user and group
async function findOrCreateConversation(
  msg: IncomingMessage,
  orgId: string,
  contactId: string | null,
  channel = 'zalo',
) {
  const externalThreadId = msg.threadId;

  // If contactId was not passed, look up if a matching Contact exists by zaloUid or whatsappJid
  if (!contactId && externalThreadId) {
    const matched = await prisma.contact.findFirst({
      where: {
        orgId,
        OR: [
          { zaloUid: externalThreadId },
          ...(channel === 'whatsapp' ? [{ whatsappJid: externalThreadId }] : []),
        ],
      },
      select: { id: true },
    });
    if (matched) contactId = matched.id;
  }

  const existing = await prisma.conversation.findFirst({
    where: { zaloAccountId: msg.accountId, externalThreadId },
    select: { id: true, contactId: true, channel: true },
  });

  if (existing) {
    const updates: any = {};
    if (!existing.contactId && contactId) {
      updates.contactId = contactId;
    }
    if (channel === 'whatsapp' && existing.channel !== 'whatsapp') {
      updates.channel = 'whatsapp';
    }
    if (Object.keys(updates).length > 0) {
      await prisma.conversation.update({
        where: { id: existing.id },
        data: updates,
      });
    }
    return existing;
  }

  return prisma.conversation.create({
    data: {
      id: randomUUID(),
      orgId,
      zaloAccountId: msg.accountId,
      contactId: msg.threadType === 'user' ? contactId : contactId,
      channel,
      threadType: msg.threadType,
      externalThreadId,
      lastMessageAt: new Date(msg.timestamp),
      unreadCount: msg.isSelf ? 0 : 1,
      isReplied: msg.isSelf,
    },
    select: { id: true },
  });
}

// Update conversation metadata after a new message
async function updateConversationAfterMessage(
  conversationId: string,
  sentAt: Date,
  isSelf: boolean,
  isExisting = false
): Promise<void> {
  const currentConv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { lastMessageAt: true },
  });

  const shouldUpdateTimestamp = !currentConv?.lastMessageAt || sentAt.getTime() >= currentConv.lastMessageAt.getTime();

  const updateData: any = {};
  if (shouldUpdateTimestamp) {
    updateData.lastMessageAt = sentAt;
  }

  if (!isExisting) {
    if (isSelf) {
      updateData.isReplied = true;
      updateData.unreadCount = 0;
    } else {
      updateData.unreadCount = { increment: 1 };
      updateData.isReplied = false;
      updateData.quoteCompleted = false;
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.conversation.update({ where: { id: conversationId }, data: updateData });
  }
}

// Soft-delete a message by its Zalo message ID or client message ID
export async function handleMessageUndo(accountId: string, zaloMsgId: string, cliMsgId?: string): Promise<void> {
  try {
    const orConditions: any[] = [{ zaloMsgId: String(zaloMsgId) }];
    if (cliMsgId && cliMsgId !== zaloMsgId) {
      orConditions.push({ zaloMsgId: String(cliMsgId) });
    }
    const result = await prisma.message.updateMany({
      where: {
        OR: orConditions,
      },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    logger.info(`[message-handler] Undo message zaloMsgId=${zaloMsgId}, cliMsgId=${cliMsgId} for account ${accountId} (updated ${result.count} rows)`);
  } catch (err) {
    logger.error('[message-handler] handleMessageUndo error:', err);
  }
}
