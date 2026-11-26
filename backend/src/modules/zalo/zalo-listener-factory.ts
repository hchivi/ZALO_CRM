/**
 * zalo-listener-factory.ts — sets up zca-js listener events for one Zalo account.
 * Handles message routing, user-info caching, group detection, and undo events.
 * Extracted from ZaloAccountPool to keep zalo-pool.ts under 200 lines.
 */
import type { Server } from 'socket.io';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { handleIncomingMessage, handleMessageUndo } from '../chat/message-handler.js';
import { detectContentType, updateContactAvatar } from './zalo-message-helpers.js';
import { sendPushNotificationForMessage } from '../../shared/services/push-notification.js';
import { friendRequestStore } from './friend-request-store.js';

// Cached user info entry with 5-minute TTL
export interface UserInfoCacheEntry {
  zaloName: string;
  avatar: string;
  phone?: string;
  cachedAt: number;
}

const USER_INFO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch zaloName + avatar from API with a per-pool in-memory cache
async function resolveZaloName(
  api: any,
  uid: string,
  cache: Map<string, UserInfoCacheEntry>,
): Promise<{ zaloName: string; avatar: string; phone?: string }> {
  if (!uid || uid === '0') return { zaloName: '', avatar: '' };

  const cached = cache.get(uid);
  if (cached && Date.now() - cached.cachedAt < USER_INFO_CACHE_TTL_MS) {
    return { zaloName: cached.zaloName, avatar: cached.avatar, phone: cached.phone };
  }

  try {
    const result = await api.getUserInfo(uid);
    const profiles = result?.changed_profiles || {};
    const profile = profiles[uid] || profiles[`${uid}_0`] || (Object.keys(profiles).length === 1 ? Object.values(profiles)[0] : null);
    if (profile) {
      const realAvatar = profile.avatar || profile.avatarUrl || profile.avatar_url || profile.avt || '';
      const realName =
        profile.zaloName ||
        profile.zalo_name ||
        profile.displayName ||
        profile.display_name ||
        '';
      const realPhone = profile.phoneNumber || profile.phone || '';

      const entry: UserInfoCacheEntry = {
        zaloName: realName,
        avatar: realAvatar,
        phone: realPhone,
        cachedAt: Date.now(),
      };
      cache.set(uid, entry);

      if (realAvatar) {
        updateContactAvatar(uid, realAvatar);
      }

      return { zaloName: entry.zaloName, avatar: entry.avatar, phone: entry.phone };
    }
  } catch (err) {
    logger.warn(`[zalo] getUserInfo failed for ${uid}:`, err);
  }
  return { zaloName: '', avatar: '' };
}

interface GroupInfoCacheEntry {
  name: string;
  avatar: string;
  members: Map<string, { name: string; avatar: string }>;
  cachedAt: number;
}
const groupInfoCache = new Map<string, GroupInfoCacheEntry>();
const GROUP_INFO_CACHE_TTL_MS = 5 * 60 * 1000;

// Fetch group display name and avatar from the zca-js API
async function resolveGroupInfo(
  api: any,
  groupId: string,
): Promise<{
  name: string;
  avatar: string;
  members: Map<string, { name: string; avatar: string }>;
}> {
  const cached = groupInfoCache.get(groupId);
  if (cached && Date.now() - cached.cachedAt < GROUP_INFO_CACHE_TTL_MS) {
    return cached;
  }
  try {
    const result = await api.getGroupInfo(groupId);
    const info = result?.gridInfoMap?.[groupId];
    const memberMap = new Map<string, { name: string; avatar: string }>();

    if (Array.isArray(info?.currentMems)) {
      for (const m of info.currentMems) {
        if (m && m.id) {
          memberMap.set(String(m.id), {
            name: m.zaloName || m.dName || '',
            avatar: m.avatar || m.avatar_25 || '',
          });
        }
      }
    }

    const avt = info?.avt || info?.fullAvt || '';
    if (avt) {
      updateContactAvatar(groupId, avt);
    }

    const entry: GroupInfoCacheEntry = {
      name: info?.name || '',
      avatar: avt,
      members: memberMap,
      cachedAt: Date.now(),
    };
    groupInfoCache.set(groupId, entry);
    return entry;
  } catch (err) {
    logger.warn(`[zalo] getGroupInfo failed for ${groupId}:`, err);
    return { name: '', avatar: '', members: new Map() };
  }
}

async function resolveGroupName(api: any, groupId: string): Promise<string> {
  const gInfo = await resolveGroupInfo(api, groupId);
  return gInfo.name;
}

export interface ListenerContext {
  accountId: string;
  orgId: string;
  accountUid?: string;
  api: any;
  io: Server | null;
  userInfoCache: Map<string, UserInfoCacheEntry>;
  onDisconnected: (accountId: string, code?: number, reason?: string) => void;
}

function extractQuoteData(data: any): any[] {
  const q = data?.quote;
  if (!q) return [];
  const msgText = typeof q.msg === 'string' ? q.msg : '';
  let attachStr = '';
  if (typeof q.attach === 'string') attachStr = q.attach;
  else if (q.attach) attachStr = JSON.stringify(q.attach);

  return [{
    type: 'quote',
    ownerId: String(q.ownerId || ''),
    fromD: String(q.fromD || ''),
    msg: msgText,
    attach: attachStr,
    cliMsgType: q.cliMsgType,
    globalMsgId: String(q.globalMsgId || q.cliMsgId || ''),
  }];
}

async function processZaloMessage(
  ctx: ListenerContext,
  message: any,
  threadTypeHint?: any,
  options: { isCatchUp?: boolean } = {}
): Promise<any | null> {
  const { accountId, api, io, userInfoCache } = ctx;
  const isGroup = threadTypeHint === 1 || message.type === 1;
  const ownUid = String(ctx.accountUid || api.getContext?.()?.uid || '');
  const senderUid = String(message.data?.uidFrom || '');

  // Determine isSelf accurately:
  const isSelf = Boolean(
    message.isSelf ||
    (ownUid && senderUid === ownUid) ||
    senderUid === '0' ||
    message.data?.uidFrom === '0'
  );

  // Determine threadId accurately:
  let threadId = String(message.threadId || '');
  if (isGroup) {
    threadId = String(message.data?.idTo || message.threadId || '');
  } else {
    if (isSelf) {
      const candIdTo = String(message.data?.idTo || '');
      const candThread = String(message.threadId || '');
      if (candIdTo && candIdTo !== ownUid && candIdTo !== '0') {
        threadId = candIdTo;
      } else if (candThread && candThread !== ownUid && candThread !== '0') {
        threadId = candThread;
      } else {
        threadId = candIdTo || candThread;
      }
    } else {
      threadId = String(message.data?.uidFrom || message.threadId || '');
    }
  }

  // Resolve display name, avatar, and group information
  let senderName: string = message.data?.dName || '';
  let senderAvatar: string = '';
  let senderPhone: string | undefined;
  let customerName: string | undefined;
  let customerAvatar: string | undefined;
  let groupName: string | undefined;
  let groupAvatar: string | undefined;

  if (isGroup && threadId) {
    const groupInfo = await resolveGroupInfo(api, threadId);
    groupName = groupInfo.name;
    groupAvatar = groupInfo.avatar;

    if (!isSelf && senderUid) {
      const member = groupInfo.members.get(senderUid);
      if (member) {
        if (member.name) senderName = member.name;
        if (member.avatar) senderAvatar = member.avatar;
      }
      if (!senderAvatar && api.getUserInfo) {
        const uInfo = await resolveZaloName(api, senderUid, userInfoCache);
        if (uInfo.zaloName && !senderName) senderName = uInfo.zaloName;
        if (uInfo.avatar) senderAvatar = uInfo.avatar;
      }
    }
  } else {
    // 1-on-1 User chat
    const customerUid = isSelf ? threadId : senderUid;
    if (customerUid && customerUid !== ownUid && api.getUserInfo) {
      const userInfo = await resolveZaloName(api, customerUid, userInfoCache);
      if (isSelf) {
        // Staff sending message to customer
        if (userInfo.zaloName) customerName = userInfo.zaloName;
        if (userInfo.avatar) customerAvatar = userInfo.avatar;
      } else {
        // Customer sending message to staff
        if (userInfo.zaloName) senderName = userInfo.zaloName;
        if (userInfo.avatar) senderAvatar = userInfo.avatar;
        if (userInfo.phone) senderPhone = userInfo.phone;
        customerName = senderName;
        customerAvatar = senderAvatar;
      }
    }
  }

  const rawContent = message.data?.content;
  const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent || '');
  const contentType = detectContentType(message.data?.msgType, rawContent);

  const attachments = extractQuoteData(message.data);
  const cliMsgId = message.data?.cliMsgId || message.data?.cmi;
  if (cliMsgId) {
    attachments.push({
      type: 'zalo_meta',
      cliMsgId: String(cliMsgId),
    });
  }
  if (isGroup && !isSelf && senderAvatar) {
    attachments.push({
      type: 'sender_avatar',
      avatar: senderAvatar,
      name: senderName,
    });
  }

  const result = await handleIncomingMessage({
    accountId,
    senderUid,
    senderName,
    content,
    contentType,
    msgId: String(message.data?.msgId || ''),
    timestamp: parseInt(message.data?.ts || String(Date.now())),
    isSelf,
    threadId,
    threadType: isGroup ? 'group' : 'user',
    groupName,
    groupAvatar,
    senderAvatar,
    senderPhone,
    customerName,
    customerAvatar,
    attachments,
  });

  if (result) {
    // Only broadcast to socket if message is genuinely new, or linked to an optimistic send.
    // If it is an old/already-saved message, DO NOT broadcast to avoid reload storms and noise.
    if (result.isNew || result.isLinked) {
      io?.emit('chat:message', {
        accountId,
        message: result.message,
        conversationId: result.conversationId,
        isNew: result.isNew,
        isCatchUp: options.isCatchUp ?? false,
      });
    }
    return result;
  }
  return null;
}

/**
 * Convert Zalo reaction code to Unicode emoji
 */
export function reactionCodeToEmoji(code: string | undefined | null): string | null {
  if (!code) return null;
  const c = code.trim();
  switch (c) {
    case '/-heart':
    case 'heart':
    case 'HEART':
      return '❤️';
    case '/-strong':
    case 'like':
    case 'LIKE':
      return '👍';
    case ':>':
    case 'haha':
    case 'HAHA':
      return '😆';
    case ':o':
    case ':-o':
    case 'wow':
    case 'WOW':
      return '😮';
    case ':-(( ':
    case ':-(':
    case ':-(((':
    case 'cry':
    case 'CRY':
    case 'sad':
    case 'SAD':
      return '😭';
    case ':-h':
    case 'angry':
    case 'ANGRY':
      return '😡';
    case '/-weak':
    case 'dislike':
    case 'DISLIKE':
      return '👎';
    case ':-*':
      return '😘';
    case ":')":
      return '😂';
    case '/-rose':
      return '🌹';
    case '/-break':
      return '💔';
    case '_()_':
      return '🙏';
    case '/-shit':
      return '💩';
    case '/-bd':
      return '🎂';
    case '/-ok':
      return '👌';
    case '/-v':
      return '✌️';
    case '/-thanks':
      return '🙏';
    case ';xx':
      return '🥰';
    case ';-)':
      return '😉';
    case '/-loveu':
      return '🤟';
    case ':))':
      return '😃';
    case ';-d':
      return '😄';
    case 'b-)':
      return '😎';
    case 'x-)':
      return '😏';
    case '':
    case 'NONE':
      return null;
    default:
      return c;
  }
}

export async function processZaloReaction(ctx: ListenerContext, reactionObject: any): Promise<void> {
  const { accountId, io, api } = ctx;
  if (!reactionObject) return;

  const data = reactionObject.data || reactionObject;
  let content = data.content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      content = null;
    }
  }

  const rMsg = Array.isArray(content?.rMsg) ? content.rMsg : [];
  if (rMsg.length === 0) return;

  const rawIcon = content?.rIcon ?? '';
  const emoji = reactionCodeToEmoji(rawIcon);
  const senderUid = String(data.uidFrom || '');
  const isSelf = Boolean(
    reactionObject.isSelf ||
    data.uidFrom === '0' ||
    (api.getContext?.()?.uid && senderUid === String(api.getContext().uid))
  );

  for (const item of rMsg) {
    const gMsgID = String(item.gMsgID || '');
    const cMsgID = String(item.cMsgID || '');
    if (!gMsgID && !cMsgID) continue;

    // Search message in DB for this Zalo account
    const message = await prisma.message.findFirst({
      where: {
        conversation: { zaloAccountId: accountId },
        OR: [
          ...(gMsgID ? [{ zaloMsgId: gMsgID }] : []),
          ...(cMsgID ? [{ zaloMsgId: cMsgID }] : []),
          ...(gMsgID ? [{ id: gMsgID }] : []),
        ],
      },
      include: {
        conversation: { select: { id: true, orgId: true } },
      },
    });

    if (!message) {
      logger.debug(`[zalo:${accountId}] Reaction target msg not found in DB (gMsgID=${gMsgID}, cMsgID=${cMsgID})`);
      continue;
    }

    // Parse existing attachments
    let attList: any[] = [];
    if (message.attachments) {
      if (typeof message.attachments === 'string') {
        try { attList = JSON.parse(message.attachments); } catch { attList = []; }
      } else if (Array.isArray(message.attachments)) {
        attList = [...message.attachments];
      } else if (typeof message.attachments === 'object') {
        attList = [message.attachments];
      }
    }

    // Filter out previous reaction from this sender or general reaction
    attList = attList.filter((att) => {
      if (!att || typeof att !== 'object') return true;
      if (att.type === 'reaction') {
        if (senderUid && att.senderUid) {
          return att.senderUid !== senderUid;
        }
        return false;
      }
      return true;
    });

    if (emoji) {
      attList.push({
        type: 'reaction',
        reaction: emoji,
        icon: rawIcon,
        senderUid,
        isSelf,
        updatedAt: Date.now(),
      });
    }

    await prisma.message.update({
      where: { id: message.id },
      data: {
        attachments: attList as any,
      },
    });

    logger.info(`[zalo:${accountId}] Reaction updated on msg ${message.id} (zaloMsgId=${message.zaloMsgId}): ${emoji || 'REMOVED'} by ${senderUid} (isSelf=${isSelf})`);

    // Broadcast real-time event to connected frontend clients
    io?.emit('chat:reaction', {
      accountId,
      messageId: message.id,
      zaloMsgId: message.zaloMsgId || gMsgID,
      conversationId: message.conversationId,
      reaction: emoji, // emoji string or null
      icon: rawIcon,
      senderUid,
      isSelf,
    });
  }
}

/**
 * Attach all zca-js listener events for the given account.
 * Calls listener.start() with retryOnClose: false at the end.
 */
export function attachZaloListener(ctx: ListenerContext): void {
  const { accountId, orgId, api, io, userInfoCache, onDisconnected } = ctx;
  const listener = api.listener;

  listener.on('connected', () => {
    logger.info(`[zalo:${accountId}] Listener socket connected`);
    io?.emit('zalo:connected', { accountId });
  });

  // Request old messages and reactions once cipher handshake is confirmed
  listener.on('cipher_key', () => {
    logger.info(`[zalo:${accountId}] Listener cipher key established. Requesting catch-up old messages and reactions...`);
    setTimeout(() => {
      try {
        listener.requestOldMessages(0); // User threads
        listener.requestOldMessages(1); // Group threads
        if (typeof listener.requestOldReactions === 'function') {
          listener.requestOldReactions(0);
          listener.requestOldReactions(1);
        }
      } catch (e: any) {
        logger.warn(`[zalo:${accountId}] Failed to request old messages/reactions:`, e.message);
      }
    }, 500);
  });

  listener.on('old_messages', async (oldMsgs: any[], threadType: any) => {
    if (!Array.isArray(oldMsgs) || oldMsgs.length === 0) return;
    logger.info(`[zalo:${accountId}] Catch-up: received ${oldMsgs.length} old messages (threadType: ${threadType})`);

    let newCount = 0;
    for (const m of oldMsgs) {
      try {
        const res = await processZaloMessage(ctx, m, threadType, { isCatchUp: true });
        if (res?.isNew) newCount++;
      } catch (err) {
        logger.error(`[zalo:${accountId}] Error processing catch-up old message:`, err);
      }
    }
    logger.info(`[zalo:${accountId}] Catch-up complete: ${newCount} new messages synced`);
    if (newCount > 0) {
      io?.emit('zalo:sync-completed', { accountId, count: newCount });
    }
  });

  // Catch-up old reactions
  listener.on('old_reactions', async (reactionObjects: any[], isGroup: boolean) => {
    if (!Array.isArray(reactionObjects) || reactionObjects.length === 0) return;
    logger.info(`[zalo:${accountId}] Catch-up: received ${reactionObjects.length} old reactions (isGroup: ${isGroup})`);
    for (const r of reactionObjects) {
      try {
        await processZaloReaction(ctx, r);
      } catch (err) {
        logger.error(`[zalo:${accountId}] Error processing catch-up old reaction:`, err);
      }
    }
  });

  listener.on('message', async (message: any) => {
    try {
      const result = await processZaloMessage(ctx, message);
      // Trigger Web Push Notification ONLY if message is genuinely new and NOT sent by self
      if (result && result.isNew && !result.message.senderType?.includes('self')) {
        sendPushNotificationForMessage(accountId, result.message, result.conversationId).catch((e) => {
          logger.error('[zalo-listener-factory] Failed to dispatch push notification:', e);
        });
      }
    } catch (err) {
      logger.error(`[zalo:${accountId}] Message handler error:`, err);
    }
  });

  // Real-time reactions from đối phương (or self)
  listener.on('reaction', async (reactionObject: any) => {
    try {
      await processZaloReaction(ctx, reactionObject);
    } catch (err) {
      logger.error(`[zalo:${accountId}] Reaction handler error:`, err);
    }
  });

  listener.on('undo', async (data: any) => {
    // In Zalo Undo events, data.data?.content?.globalMsgId is the msgId of the original message that was recalled.
    // data.data?.msgId is the ID of the undo event itself.
    const globalMsgId = data.data?.content?.globalMsgId;
    const cliMsgId = data.data?.content?.cliMsgId;
    const fallbackMsgId = data.data?.msgId || data.msgId;
    const targetMsgId = globalMsgId ? String(globalMsgId) : (cliMsgId ? String(cliMsgId) : String(fallbackMsgId || ''));

    if (targetMsgId) {
      await handleMessageUndo(accountId, targetMsgId, cliMsgId ? String(cliMsgId) : undefined);
      io?.emit('chat:deleted', { accountId, msgId: targetMsgId });
      io?.emit('chat:message-undo', { accountId, zaloMsgId: targetMsgId });
      logger.info(`[zalo:${accountId}] Processed external undo event for msgId=${targetMsgId}`);
    }
  });

  listener.on('closed', (code: number, reason: string) => {
    logger.warn(`[zalo:${accountId}] Listener closed: ${code} ${reason}`);
    onDisconnected(accountId, code, reason);
  });

  listener.on('error', (err: any) => {
    logger.error(`[zalo:${accountId}] Listener error:`, err);
  });

  listener.on('friend_event', async (event: any) => {
    try {
      const eventType = event.type ?? event.eventType;

      // Only handle incoming friend REQUEST (type=2) that are NOT self-sent
      if (eventType !== 2) return;
      if (event.isSelf === true) return; // skip if we sent the request ourselves

      // Sender UID is in event.data.fromUid (confirmed from zca-js source)
      const senderUid = String(event.data?.fromUid || event.actorId || '');
      if (!senderUid) {
        logger.warn(`[zalo:${accountId}] friend_event REQUEST missing fromUid, event keys: ${Object.keys(event || {}).join(',')}, data keys: ${Object.keys(event?.data || {}).join(',')}`);
        return;
      }

      // Message attached to friend request (if any)
      const friendMsg = event.data?.msg || event.data?.content || event.data?.message || '';

      // Sender name/avatar from event data (Zalo sometimes sends displayName directly)
      let senderName = event.data?.displayName || event.data?.dName || event.data?.title || '';
      let senderAvatar = event.data?.avatar || event.data?.avatarUrl || '';

      // Also try getUserInfo for more reliable data
      if (api.getUserInfo) {
        try {
          const info = await resolveZaloName(api, senderUid, userInfoCache);
          if (info.zaloName) senderName = info.zaloName;
          if (info.avatar) senderAvatar = info.avatar;
        } catch (_) {}
      }

      const pending = {
        senderUid,
        senderName: senderName || 'Người dùng Zalo',
        senderAvatar,
        message: typeof friendMsg === 'string' ? friendMsg : (friendMsg ? JSON.stringify(friendMsg) : ''),
        receivedAt: Date.now(),
      };

      // Persist to DB (survives server restarts)
      await friendRequestStore.add(accountId, orgId, pending);
      const count = await friendRequestStore.count(accountId);

      logger.info(`[zalo:${accountId}] ✅ Friend REQUEST from ${senderUid} (${pending.senderName}), total pending: ${count}`);

      io?.emit('zalo:friend_request', {
        accountId,
        ...pending,
        pendingCount: count,
      });
    } catch (err) {
      logger.error(`[zalo:${accountId}] friend_event handler error:`, err);
    }
  });

  listener.start({ retryOnClose: true });
}
