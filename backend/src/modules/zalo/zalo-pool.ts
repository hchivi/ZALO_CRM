/**
 * ZaloAccountPool — singleton that manages live Zalo SDK instances.
 * Handles QR login, session reconnect, message listener lifecycle,
 * and credential persistence to the database.
 *
 * Note: zca-js is imported via createRequire because its TypeScript
 * declarations don't expose named exports in ESM mode.
 */
import { createRequire } from 'module';
import type { Server } from 'socket.io';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { attachZaloListener, type UserInfoCacheEntry } from './zalo-listener-factory.js';
import { emitWebhook } from '../api/webhook-service.js';
import { encryptData, decryptData } from '../../utils/crypto.js';
import {
  sendTelegramDisconnectionAlert,
  sendTelegramReconnectedAlert,
  scanAndNotifyUnsentCustomerMessages,
} from '../../shared/services/telegram-notification.js';

// zca-js has no reliable ESM type exports — load via CJS interop
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Zalo } = require('zca-js') as { Zalo: new (opts: { logging: boolean; selfListen?: boolean }) => any };

interface ZaloCredentials {
  cookie: any;
  imei: string;
  userAgent: string;
}

interface ZaloInstance {
  zalo: any;
  api: any;
  status: 'connected' | 'disconnected' | 'qr_pending' | 'connecting' | 'reconnecting';
  displayName?: string;
  zaloUid?: string;
  lastActivity: Date;
}

class ZaloAccountPool {
  private instances = new Map<string, ZaloInstance>();
  private io: Server | null = null;
  // Shared user-info cache passed into each listener context
  private userInfoCache = new Map<string, UserInfoCacheEntry>();
  // Circuit breaker: track disconnect timestamps per account
  private disconnectHistory = new Map<string, number[]>();
  // Grace period timer before declaring an account disconnected to the UI/DB
  private disconnectGraceTimers = new Map<string, NodeJS.Timeout>();
  // Active retry timers for background auto-reconnect
  private reconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.startKeepAlive();
  }

  // Periodic Keep-Alive heartbeat (every 2 minutes) to prevent idle timeouts
  private startKeepAlive(): void {
    setInterval(async () => {
      for (const [accountId, instance] of this.instances.entries()) {
        if (instance.status === 'connected' && instance.api) {
          try {
            if (typeof instance.api.keepAlive === 'function') {
              await instance.api.keepAlive();
            } else if (instance.zaloUid && typeof instance.api.getUserInfo === 'function') {
              await instance.api.getUserInfo(instance.zaloUid);
            }
            instance.lastActivity = new Date();
          } catch (e: any) {
            logger.debug(`[zalo:${accountId}] Keep-alive heartbeat:`, e?.message || e);
          }
        }
      }
    }, 2 * 60 * 1000);
  }

  private clearTimers(accountId: string): void {
    const grace = this.disconnectGraceTimers.get(accountId);
    if (grace) {
      clearTimeout(grace);
      this.disconnectGraceTimers.delete(accountId);
    }
    const retry = this.reconnectTimers.get(accountId);
    if (retry) {
      clearTimeout(retry);
      this.reconnectTimers.delete(accountId);
    }
  }

  // Actively sync recent messages from Zalo server for an account via native WebSocket catch-up
  async syncMessages(accountId: string): Promise<boolean> {
    const inst = this.instances.get(accountId);
    if (!inst?.api || inst.status !== 'connected' || !inst.api.listener) {
      return false;
    }
    try {
      if (typeof inst.api.listener.requestOldMessages === 'function') {
        inst.api.listener.requestOldMessages(0); // User threads
        inst.api.listener.requestOldMessages(1); // Group threads
      }
      if (typeof inst.api.listener.requestOldReactions === 'function') {
        inst.api.listener.requestOldReactions(0);
        inst.api.listener.requestOldReactions(1);
      }
      if (typeof inst.api.getAllGroups === 'function' && typeof inst.api.getGroupChatHistory === 'function') {
        inst.api.getAllGroups().then(async (groupsRes: any) => {
          const groupList = Array.isArray(groupsRes?.data) ? groupsRes.data : (typeof groupsRes === 'object' ? Object.values(groupsRes) : []);
          for (const grp of groupList.slice(0, 20)) {
            const gid = grp.groupId || grp.grid || grp.id;
            if (gid) {
              await inst.api.getGroupChatHistory(gid, 50).catch(() => {});
            }
          }
        }).catch(() => {});
      }

      // Emit sync-completed event to all connected clients
      this.io?.emit('zalo:sync-completed', { accountId });
      return true;
    } catch (e: any) {
      logger.warn(`[zalo:${accountId}] syncMessages failed:`, e?.message || e);
    }
    return false;
  }

  setIO(io: Server): void {
    this.io = io;
  }

  getIO(): Server | null {
    return this.io;
  }

  // Initiate QR-based login; emits QR events to frontend via Socket.IO
  async loginQR(accountId: string): Promise<void> {
    const zalo = new Zalo({ logging: false, selfListen: true });
    this.instances.set(accountId, { zalo, api: null, status: 'qr_pending', lastActivity: new Date() });

    try {
      const api = await zalo.loginQR({}, (event: any) => {
        switch (event.type) {
          case 0: // QRCodeGenerated
            this.io?.to(`account:${accountId}`).emit('zalo:qr', { accountId, qrImage: event.data.image });
            break;
          case 1: // QRCodeExpired
            this.io?.to(`account:${accountId}`).emit('zalo:qr-expired', { accountId });
            event.actions?.retry();
            break;
          case 2: // QRCodeScanned
            this.io?.to(`account:${accountId}`).emit('zalo:scanned', {
              accountId,
              displayName: event.data.display_name,
              avatar: event.data.avatar,
            });
            break;
          case 4: // GotLoginInfo
            this.saveCredentials(accountId, {
              cookie: event.data.cookie,
              imei: event.data.imei,
              userAgent: event.data.userAgent,
            });
            break;
        }
      });

      this.clearTimers(accountId);
      const instance = this.instances.get(accountId);
      if (!instance) {
        try { api.listener?.stop(); } catch {}
        return;
      }
      instance.api = api;
      instance.status = 'connected';
      instance.lastActivity = new Date();

      const ownId = await api.getOwnId();
      instance.zaloUid = ownId;

      // Fetch own profile info for avatar
      try {
        const userInfo = await api.getUserInfo(ownId);
        const profiles = userInfo?.changed_profiles || {};
        const profile = profiles[ownId] || profiles[`${ownId}_0`];
        if (profile?.avatar) {
          await prisma.zaloAccount.update({
            where: { id: accountId },
            data: { avatarUrl: profile.avatar, displayName: profile.zaloName || profile.zalo_name || profile.displayName || instance.displayName },
          });
        }
      } catch {}

      await this.attachListener(accountId, api);
      this.io?.emit('zalo:connected', { accountId, zaloUid: ownId });
      await this.updateAccountDB(accountId, 'connected', ownId);

      prisma.zaloAccount.findUnique({ where: { id: accountId }, select: { orgId: true, displayName: true } })
        .then((rec) => {
          if (rec) {
            sendTelegramReconnectedAlert({
              accountId,
              accountName: rec.displayName || instance.displayName || accountId,
              channel: 'Zalo',
              orgId: rec.orgId,
            });
            scanAndNotifyUnsentCustomerMessages();
          }
        })
        .catch(() => {});

      // Emit webhook (orgId lookup is async, fire-and-forget)
      prisma.zaloAccount.findUnique({ where: { id: accountId }, select: { orgId: true, displayName: true } })
        .then((rec) => {
          if (rec) {
            emitWebhook(rec.orgId, 'zalo.connected', { accountId });
            sendTelegramReconnectedAlert({
              accountId,
              accountName: rec.displayName || instance.displayName || accountId,
              channel: 'Zalo',
              orgId: rec.orgId,
            });
            scanAndNotifyUnsentCustomerMessages();
          }
        })
        .catch(() => {});
    } catch (err) {
      const instance = this.instances.get(accountId);
      if (instance) instance.status = 'disconnected';
      this.io?.emit('zalo:error', { accountId, error: String(err) });
      throw err;
    }
  }

  // Reconnect using previously saved session credentials
  async reconnect(accountId: string, credentials: ZaloCredentials): Promise<void> {
    const inst = this.instances.get(accountId);
    if (inst?.status === 'connected' || inst?.status === 'connecting') {
      logger.info(`[zalo:${accountId}] Reconnect skipped: already ${inst.status}`);
      return;
    }

    // Safely stop any previous listener if still active
    if (inst?.api?.listener) {
      try {
        inst.api.listener.stop();
      } catch (err) {
        logger.debug(`[zalo:${accountId}] Error stopping previous listener:`, err);
      }
    }

    const zalo = new Zalo({ logging: false, selfListen: true });
    this.instances.set(accountId, { zalo, api: null, status: 'connecting', lastActivity: new Date() });

    try {
      const api = await zalo.login({
        cookie: credentials.cookie,
        imei: credentials.imei,
        userAgent: credentials.userAgent,
      });

      const instance = this.instances.get(accountId);
      if (!instance) {
        try { api.listener?.stop(); } catch {}
        return;
      }
      instance.api = api;
      instance.status = 'connected';
      instance.lastActivity = new Date();

      // Successfully connected: cancel any pending disconnect grace timer and retry timers!
      this.clearTimers(accountId);

      const ownId = await api.getOwnId();
      instance.zaloUid = ownId;

      // Fetch own profile info for avatar
      try {
        const userInfo = await api.getUserInfo(ownId);
        const profiles = userInfo?.changed_profiles || {};
        const profile = profiles[ownId] || profiles[`${ownId}_0`];
        if (profile?.avatar) {
          await prisma.zaloAccount.update({
            where: { id: accountId },
            data: { avatarUrl: profile.avatar, displayName: profile.zaloName || profile.zalo_name || profile.displayName || instance.displayName },
          });
        }
      } catch {}

      await this.attachListener(accountId, api);
      await this.updateAccountDB(accountId, 'connected', ownId);
      this.io?.emit('zalo:connected', { accountId, zaloUid: ownId });

      prisma.zaloAccount.findUnique({ where: { id: accountId }, select: { orgId: true, displayName: true } })
        .then((rec) => {
          if (rec) {
            emitWebhook(rec.orgId, 'zalo.connected', { accountId });
            sendTelegramReconnectedAlert({
              accountId,
              accountName: rec.displayName || instance.displayName || accountId,
              channel: 'Zalo',
              orgId: rec.orgId,
            });
            scanAndNotifyUnsentCustomerMessages();
          }
        })
        .catch(() => {});
    } catch (err: any) {
      const errStr = String(err).toLowerCase();
      const isAuthError =
        errStr.includes('cookie') ||
        errStr.includes('session') ||
        errStr.includes('expired') ||
        errStr.includes('invalid_credential') ||
        errStr.includes('1000') ||
        errStr.includes('kickconnection') ||
        errStr.includes('unauthorized');

      const instance = this.instances.get(accountId);
      if (isAuthError) {
        logger.error(`[zalo:${accountId}] Reconnect authentication error, requiring QR login:`, err);
        this.clearTimers(accountId);
        if (instance) instance.status = 'qr_pending';
        await this.updateAccountDB(accountId, 'qr_pending', null);
        this.io?.emit('zalo:reconnect-failed', { accountId, error: 'Phiên đăng nhập hết hạn, cần quét QR lại' });
      } else {
        logger.warn(`[zalo:${accountId}] Reconnect network error, will keep trying:`, err?.message || err);
        if (instance && instance.status !== 'reconnecting') {
          instance.status = 'reconnecting';
        }
        throw err;
      }
    }
  }

  // Delegate listener setup to zalo-listener-factory
  private async attachListener(accountId: string, api: any): Promise<void> {
    const rec = await prisma.zaloAccount.findUnique({ where: { id: accountId }, select: { orgId: true, zaloUid: true } });
    const orgId = rec?.orgId || '';

    attachZaloListener({
      accountId,
      orgId,
      accountUid: rec?.zaloUid || '',
      api,
      io: this.io,
      userInfoCache: this.userInfoCache,
      onDisconnected: (id, code, reason) => {
        this.handleSocketClosed(id, code, reason);
      },
    });
  }

  // Gracefully handle socket closed event without spamming UI
  private handleSocketClosed(accountId: string, code?: number, reason?: string): void {
    const inst = this.instances.get(accountId);
    if (!inst) return;

    // If the account was already explicitly logged out or in qr_pending, do nothing
    if (inst.status === 'disconnected' || inst.status === 'qr_pending') {
      return;
    }

    inst.status = 'reconnecting';
    logger.warn(`[zalo:${accountId}] Socket closed (code=${code ?? 'n/a'}, reason="${reason || 'closed'}"). Starting background auto-reconnect (grace period 25s)...`);

    // Only start a grace period timer if not already running
    if (!this.disconnectGraceTimers.has(accountId)) {
      const graceTimer = setTimeout(async () => {
        this.disconnectGraceTimers.delete(accountId);
        const cur = this.instances.get(accountId);
        if (cur && cur.status !== 'connected') {
          logger.warn(`[zalo:${accountId}] Auto-reconnect grace period expired. Marking account as disconnected.`);
          cur.status = 'disconnected';
          await this.updateAccountDB(accountId, 'disconnected', null);
          this.io?.emit('zalo:disconnected', { accountId, code, reason });
          prisma.zaloAccount.findUnique({ where: { id: accountId }, select: { orgId: true, displayName: true } })
            .then((rec) => {
              if (rec) {
                emitWebhook(rec.orgId, 'zalo.disconnected', { accountId });
                sendTelegramDisconnectionAlert({
                  accountId,
                  accountName: rec.displayName || cur.displayName || accountId,
                  channel: 'Zalo',
                  reason: reason || 'Mất kết nối mạng hoặc phiên Zalo hết hạn',
                  orgId: rec.orgId,
                });
              }
            })
            .catch(() => {});
        }
      }, 25_000);
      this.disconnectGraceTimers.set(accountId, graceTimer);
    }

    // Exponential backoff for retrying
    const now = Date.now();
    const key = `dc_${accountId}`;
    const history = (this.disconnectHistory.get(key) || []).filter((t) => now - t < 5 * 60_000);
    history.push(now);
    this.disconnectHistory.set(key, history);

    const retryDelay = Math.min(2000 * Math.pow(1.5, Math.max(0, history.length - 1)), 15000);
    logger.info(`[zalo:${accountId}] Scheduling auto-reconnect attempt #${history.length} in ${(retryDelay / 1000).toFixed(1)}s`);

    const existingRetry = this.reconnectTimers.get(accountId);
    if (existingRetry) clearTimeout(existingRetry);

    const t = setTimeout(() => {
      this.reconnectTimers.delete(accountId);
      this.autoReconnect(accountId);
    }, retryDelay);
    this.reconnectTimers.set(accountId, t);
  }

  // Persist session credentials to DB (encrypted)
  private saveCredentials(accountId: string, credentials: ZaloCredentials): void {
    const encrypted = encryptData(credentials);
    prisma.zaloAccount
      .update({ where: { id: accountId }, data: { sessionData: encrypted as any } })
      .catch((err) => logger.error(`[zalo:${accountId}] saveCredentials error:`, err));
  }

  // Sync account status and zaloUid to DB
  private async updateAccountDB(accountId: string, status: string, zaloUid: string | null): Promise<void> {
    try {
      await prisma.zaloAccount.update({
        where: { id: accountId },
        data: {
          status,
          ...(zaloUid !== null ? { zaloUid } : {}),
          ...(status === 'connected' ? { lastConnectedAt: new Date() } : {}),
        },
      });
    } catch (err) {
      logger.error(`[zalo:${accountId}] updateAccountDB error:`, err);
    }
  }

  // Auto-reconnect using saved session from DB
  private async autoReconnect(accountId: string): Promise<void> {
    const inst = this.instances.get(accountId);
    if (inst?.status === 'connected') return;

    try {
      const account = await prisma.zaloAccount.findUnique({
        where: { id: accountId },
        select: { sessionData: true },
      });
      const session = decryptData<ZaloCredentials>(account?.sessionData);
      if (session?.imei) {
        logger.info(`[zalo:${accountId}] Auto-reconnecting...`);
        await this.reconnect(accountId, session);
      } else {
        logger.warn(`[zalo:${accountId}] No saved session, cannot auto-reconnect`);
        this.clearTimers(accountId);
        if (inst) inst.status = 'qr_pending';
        await this.updateAccountDB(accountId, 'qr_pending', null);
        this.io?.emit('zalo:reconnect-failed', { accountId, error: 'No saved session' });
      }
    } catch (err: any) {
      logger.warn(`[zalo:${accountId}] Auto-reconnect attempt failed:`, err?.message || err);
      const current = this.instances.get(accountId);
      if (current && current.status !== 'disconnected' && current.status !== 'qr_pending') {
        const nextDelay = 8000;
        const existingRetry = this.reconnectTimers.get(accountId);
        if (existingRetry) clearTimeout(existingRetry);
        const t = setTimeout(() => this.autoReconnect(accountId), nextDelay);
        this.reconnectTimers.set(accountId, t);
      }
    }
  }

  // Stop listener and remove from pool
  disconnect(accountId: string): void {
    this.clearTimers(accountId);
    const instance = this.instances.get(accountId);
    if (instance?.api?.listener) {
      try { instance.api.listener.stop(); } catch (err) {
        logger.warn(`[zalo:${accountId}] Error stopping listener:`, err);
      }
    }
    this.instances.delete(accountId);
  }

  // External status reported to UI and API callers:
  // Returns 'connected' during temporary background reconnecting (within grace period) to eliminate UI alarm flashing
  getStatus(accountId: string): string {
    const inst = this.instances.get(accountId);
    if (!inst) return 'disconnected';
    if (inst.status === 'reconnecting') {
      return 'connected';
    }
    return inst.status;
  }

  // True internal status (used by health check)
  getRawStatus(accountId: string): string {
    return this.instances.get(accountId)?.status ?? 'disconnected';
  }

  getAllStatuses(): Record<string, string> {
    const statuses: Record<string, string> = {};
    for (const [id, inst] of this.instances) {
      statuses[id] = inst.status === 'reconnecting' ? 'connected' : inst.status;
    }
    return statuses;
  }

  // Return raw API instance for direct SDK calls (e.g. public API send message)
  getApi(accountId: string): any | null {
    const inst = this.instances.get(accountId);
    return (inst?.status === 'connected' || inst?.status === 'reconnecting') ? inst.api : null;
  }

  getAnyActiveApi(): any | null {
    for (const inst of this.instances.values()) {
      if ((inst.status === 'connected' || inst.status === 'reconnecting') && inst.api) {
        return inst.api;
      }
    }
    return null;
  }

  getInstance(accountId: string): ZaloInstance | undefined {
    return this.instances.get(accountId);
  }
}

export const zaloPool = new ZaloAccountPool();
