/**
 * zalo-health-check.ts — Cron-based health monitor for Zalo account connections.
 * Runs every 5 minutes as a safety net to detect dead accounts and reconnect them.
 */
import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import { zaloPool } from './zalo-pool.js';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { decryptData } from '../../utils/crypto.js';
import { scanAndNotifyUnsentCustomerMessages } from '../../shared/services/telegram-notification.js';
import { whatsappPool } from '../whatsapp/whatsapp-pool.js';

export function startZaloHealthCheck(): void {
  // Initial check on backend startup for any missed messages
  setTimeout(() => {
    scanAndNotifyUnsentCustomerMessages().catch(() => {});
  }, 10_000);

  // Every 2 minutes: sync connected WhatsApp chats (safety net) & scan for unnotified Telegram messages
  cron.schedule('*/2 * * * *', async () => {
    try {
      const waConnected = await prisma.zaloAccount.findMany({
        where: { channel: 'whatsapp', status: 'connected' },
        select: { id: true },
      });
      for (const wa of waConnected) {
        if (whatsappPool.getStatus(wa.id) === 'connected') {
          await whatsappPool.syncRecentMessages(wa.id).catch(() => {});
        }
      }
      await scanAndNotifyUnsentCustomerMessages();
    } catch (err) {
      logger.error('[telegram-recovery] Error during unnotified message check:', err);
    }
  });

  // Every 5 minutes: safety check for accounts that are truly disconnected and idle
  cron.schedule('*/5 * * * *', async () => {
    try {
      const accounts = await prisma.zaloAccount.findMany({
        where: {
          channel: 'zalo',
          sessionData: { not: Prisma.JsonNull },
          status: { not: 'qr_pending' },
        },
        select: { id: true, displayName: true, sessionData: true },
      });

      for (const acc of accounts) {
        const rawStatus = zaloPool.getRawStatus(acc.id);
        // Only trigger reconnect if truly disconnected, NOT in-flight connecting or reconnecting
        if (rawStatus === 'disconnected') {
          const session = decryptData<any>(acc.sessionData);
          if (session?.imei) {
            logger.info(`[health-check] Account ${acc.displayName || acc.id} is disconnected. Triggering auto-reconnect...`);
            zaloPool.reconnect(acc.id, session).catch((err) => {
              logger.warn(`[health-check] Reconnect failed for ${acc.id}:`, err?.message || err);
            });
          }
        }
      }

      // Check WhatsApp accounts that dropped connection
      const waAccounts = await prisma.zaloAccount.findMany({
        where: {
          channel: 'whatsapp',
          status: 'connected',
        },
        select: { id: true, displayName: true, orgId: true, ownerUserId: true },
      });

      for (const wa of waAccounts) {
        const liveStatus = whatsappPool.getStatus(wa.id);
        if (liveStatus === 'disconnected') {
          logger.info(`[health-check] WhatsApp account ${wa.displayName || wa.id} is disconnected. Attempting auto-reconnect...`);
          whatsappPool.initWhatsApp(wa.id, wa.orgId, wa.ownerUserId).catch((err) => {
            logger.warn(`[health-check] WhatsApp reconnect failed for ${wa.id}:`, err?.message || err);
          });
        }
      }
    } catch (err) {
      logger.error('[health-check] Error during health check:', err);
    }
  });

  logger.info('[health-check] Zalo health check started (every 5 min monitor)');
}
