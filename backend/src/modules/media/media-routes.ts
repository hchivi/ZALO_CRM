import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../shared/database/prisma-client.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { zaloPool } from '../zalo/zalo-pool.js';
import { whatsappPool } from '../whatsapp/whatsapp-pool.js';
import { zaloRateLimiter } from '../zalo/zalo-rate-limiter.js';
import { requireZaloAccess } from '../zalo/zalo-access-middleware.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { optimizeImageForSend } from '../chat/chat-routes.js';

export async function mediaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Ensure media upload directory exists
  const mediaDir = path.join(path.resolve(config.uploadDir), 'media');
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  // ── 1. Danh sách Album / Thư mục ──────────────────────────────────────────
  app.get('/api/v1/media/folders', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const folders = await prisma.mediaFolder.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    const totalUncategorized = await prisma.mediaItem.count({
      where: { orgId: user.orgId, folderId: null },
    });

    const totalAll = await prisma.mediaItem.count({
      where: { orgId: user.orgId },
    });

    return {
      folders,
      totalUncategorized,
      totalAll,
    };
  });

  // ── 2. Tạo Album mới ───────────────────────────────────────────────────────
  app.post('/api/v1/media/folders', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { name, color } = request.body as { name: string; color?: string };

    if (!name?.trim()) {
      return reply.status(400).send({ error: 'Tên thư mục không được để trống' });
    }

    const folder = await prisma.mediaFolder.create({
      data: {
        orgId: user.orgId,
        name: name.trim(),
        color: color || '#00B074',
      },
    });

    return folder;
  });

  // ── 3. Sửa Album ───────────────────────────────────────────────────────────
  app.put('/api/v1/media/folders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { name, color } = request.body as { name?: string; color?: string };

    const folder = await prisma.mediaFolder.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!folder) return reply.status(404).send({ error: 'Không tìm thấy thư mục' });

    const updated = await prisma.mediaFolder.update({
      where: { id },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(color ? { color } : {}),
      },
    });

    return updated;
  });

  // ── 4. Xóa Album ───────────────────────────────────────────────────────────
  app.delete('/api/v1/media/folders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const folder = await prisma.mediaFolder.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!folder) return reply.status(404).send({ error: 'Không tìm thấy thư mục' });

    // Set items in this folder to uncategorized
    await prisma.mediaItem.updateMany({
      where: { folderId: id, orgId: user.orgId },
      data: { folderId: null },
    });

    await prisma.mediaFolder.delete({
      where: { id },
    });

    return { success: true };
  });

  // ── 5. Danh sách Hình ảnh ──────────────────────────────────────────────────
  app.get('/api/v1/media', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const query = request.query as {
      folderId?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '30')));
    const skip = (page - 1) * limit;

    const where: any = {
      orgId: user.orgId,
    };

    if (query.folderId !== undefined) {
      if (query.folderId === 'null' || query.folderId === '') {
        where.folderId = null;
      } else if (query.folderId !== 'all') {
        where.folderId = query.folderId;
      }
    }

    if (query.search?.trim()) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const [items, total] = await Promise.all([
      prisma.mediaItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          folder: {
            select: { id: true, name: true, color: true },
          },
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.mediaItem.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });

  // ── 6. Tải ảnh lên Kho ảnh ─────────────────────────────────────────────────
  app.post('/api/v1/media/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    if (!request.isMultipart()) {
      return reply.status(400).send({ error: 'Multipart form-data required' });
    }

    const uploadedItems: any[] = [];
    const parts = request.files();

    for await (const part of parts) {
      if (part.type !== 'file') continue;

      const buffer = await part.toBuffer();
      const originalName = part.filename;
      const ext = path.extname(originalName).toLowerCase() || '.jpg';
      const cleanName = path.basename(originalName, ext);
      const uniqueFilename = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
      const filePath = path.join(mediaDir, uniqueFilename);

      await fs.promises.writeFile(filePath, buffer);

      // Extract folderId if provided in fields
      const folderId = (part.fields?.folderId as any)?.value || null;

      const mediaItem = await prisma.mediaItem.create({
        data: {
          orgId: user.orgId,
          folderId: folderId && folderId !== 'null' && folderId !== 'all' ? folderId : null,
          name: cleanName || 'Hình ảnh',
          filename: uniqueFilename,
          mimeType: part.mimetype || 'image/jpeg',
          size: buffer.length,
          url: `/uploads/media/${uniqueFilename}`,
          createdById: user.id,
        },
        include: {
          folder: true,
        },
      });

      uploadedItems.push(mediaItem);
    }

    return {
      success: true,
      count: uploadedItems.length,
      items: uploadedItems,
    };
  });

  // ── 7. Cập nhật thông tin ảnh (Tên, Thư mục) ──────────────────────────────
  app.put('/api/v1/media/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { name, folderId } = request.body as { name?: string; folderId?: string | null };

    const item = await prisma.mediaItem.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!item) return reply.status(404).send({ error: 'Không tìm thấy hình ảnh' });

    const updated = await prisma.mediaItem.update({
      where: { id },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(folderId !== undefined ? { folderId: folderId && folderId !== 'null' ? folderId : null } : {}),
      },
      include: {
        folder: true,
      },
    });

    return updated;
  });

  // ── 8. Xóa ảnh khỏi Kho ───────────────────────────────────────────────────
  app.delete('/api/v1/media/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const item = await prisma.mediaItem.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!item) return reply.status(404).send({ error: 'Không tìm thấy hình ảnh' });

    // Remove file from disk
    const filePath = path.join(mediaDir, item.filename);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      logger.warn(`Failed to unlink media file: ${filePath}`);
    }

    await prisma.mediaItem.delete({
      where: { id },
    });

    return { success: true };
  });

  // ── 9. Gửi ảnh từ Kho trực tiếp vào Zalo Chat ─────────────────────────────
  app.post('/api/v1/conversations/:id/send-media', { preHandler: requireZaloAccess('chat') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { mediaItemIds, caption } = request.body as {
      mediaItemIds: string[];
      caption?: string;
    };

    if (!Array.isArray(mediaItemIds) || mediaItemIds.length === 0) {
      return reply.status(400).send({ error: 'Vui lòng chọn ít nhất một hình ảnh' });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId: user.orgId },
      include: { zaloAccount: true, contact: { select: { notes: true } } },
    });
    if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });


    const isWhatsApp = conversation.channel === 'whatsapp' || conversation.zaloAccount?.channel === 'whatsapp';
    let instance: any = null;
    if (!isWhatsApp) {
      instance = zaloPool.getInstance(conversation.zaloAccountId);
      if (!instance?.api) return reply.status(400).send({ error: 'Zalo account not connected' });
    }

    // Fetch media items from local DB
    const localMediaItems = await prisma.mediaItem.findMany({
      where: {
        id: { in: mediaItemIds },
        orgId: user.orgId,
      },
    });

    const localIds = new Set(localMediaItems.map((m) => m.id));
    const itemsToSend: Array<{
      id: string;
      filename: string;
      mimeType: string;
      filePath: string;
      url: string;
      isTemp?: boolean;
    }> = localMediaItems.map((item) => ({
      id: item.id,
      filename: item.filename,
      mimeType: item.mimeType,
      filePath: path.join(mediaDir, item.filename),
      url: item.url,
      isTemp: false,
    }));

    // Any ID not in local DB is treated as a Google Drive item from Portal Photo Library
    const missingIds = mediaItemIds.filter((id) => !localIds.has(id));
    if (missingIds.length > 0) {
      const portalBaseUrl = (process.env.PORTAL_HANDOFF_URL || process.env.APP_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const bridgeToken = process.env.PORTAL_BRIDGE_TOKEN || '';

      for (const driveFileId of missingIds) {
        try {
          const downloadUrl = `${portalBaseUrl}/internal/portal/photo-library/download/${driveFileId}`;
          const res = await fetch(downloadUrl, {
            headers: { 'X-Portal-Bridge-Token': bridgeToken },
            signal: AbortSignal.timeout(30000),
          });

          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const cType = res.headers.get('content-type') || 'image/jpeg';
            const ext = cType.includes('png') ? '.png' : cType.includes('webp') ? '.webp' : '.jpg';
            const tempFilename = `drive_${driveFileId}_${Date.now()}${ext}`;
            const tempFilePath = path.join(mediaDir, tempFilename);
            fs.writeFileSync(tempFilePath, buffer);
            itemsToSend.push({
              id: driveFileId,
              filename: tempFilename,
              mimeType: cType,
              filePath: tempFilePath,
              url: `/photo-library/files/${driveFileId}/preview`,
              isTemp: true,
            });
          } else {
            logger.warn(`Failed to fetch Drive image ${driveFileId} from Portal, status: ${res.status}`);
          }
        } catch (err: any) {
          logger.warn(`Failed to download Drive image ${driveFileId} from Portal:`, err?.message || err);
        }
      }
    }

    if (itemsToSend.length === 0) {
      return reply.status(400).send({ error: 'Không tìm thấy hình ảnh hợp lệ' });
    }

    const threadId = conversation.externalThreadId || '';
    const threadType = conversation.threadType === 'group' ? 1 : 0;
    const sentMessages: any[] = [];

    // Send each selected image to Zalo or WhatsApp
    for (let i = 0; i < itemsToSend.length; i++) {
      const item = itemsToSend[i];
      const filePath = item.filePath;

      if (!fs.existsSync(filePath)) {
        logger.warn(`Media file not found on disk: ${filePath}`);
        continue;
      }

      const isFirstItem = i === 0;
      const msgText = isFirstItem && caption?.trim() ? caption.trim() : '';

      if (isWhatsApp) {
        try {
          const res = await whatsappPool.sendMedia(
            conversation.zaloAccountId,
            threadId,
            filePath,
            item.filename,
            item.mimeType,
            msgText
          );

          const finalContent = JSON.stringify({
            href: item.url,
            thumb: item.url,
            hdUrl: item.url,
            localUrl: item.url,
            ...(msgText ? { title: msgText, caption: msgText } : {}),
          });

          const newMsg = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              zaloMsgId: res.id,
              senderType: 'self',
              senderName: (user as any).fullName || 'Nhân viên',
              content: finalContent,
              contentType: 'image',
              sentAt: new Date(),
              attachments: [{ type: 'image', url: item.url, href: item.url, localUrl: item.url }],
            },
          });

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              lastMessageAt: new Date(),
              isReplied: true,
              unreadCount: 0,
            },
          });

          sentMessages.push(newMsg);

          const io = (app as any).io;
          if (io) {
            const payload = {
              ...newMsg,
              channel: 'whatsapp',
              conversationId: conversation.id,
            };
            io.to(`org:${user.orgId}`).emit('message:new', payload);
            io.to(`conversation:${conversation.id}`).emit('message:new', payload);
            io.emit('chat:message', {
              accountId: conversation.zaloAccountId,
              message: newMsg,
              conversationId: conversation.id,
            });
            io.to(`org:${user.orgId}`).emit('conversation:updated', {
              id: conversation.id,
              lastMessageAt: new Date(),
              unreadCount: 0,
              channel: 'whatsapp',
            });
          }
        } catch (sendErr: any) {
          logger.error(`Error sending media item ${item.id} to WhatsApp:`, sendErr.message);
        }
        continue;
      }

      const fileBuffer = await fs.promises.readFile(filePath);

      const limits = zaloRateLimiter.checkLimits(conversation.zaloAccountId);
      if (!limits.allowed) {
        return reply.status(429).send({ error: limits.reason });
      }

      zaloRateLimiter.recordSend(conversation.zaloAccountId);

      const ext = path.extname(item.filename).replace('.', '').toLowerCase() || 'jpg';
      let sendBuffer: Buffer = fileBuffer;
      let sendFilename = item.filename;
      let imgWidth = 800;
      let imgHeight = 600;

      try {
        const optimized = await optimizeImageForSend(fileBuffer, item.filename, ext);
        sendBuffer = optimized.buffer;
        sendFilename = optimized.fileName;
        imgWidth = optimized.width;
        imgHeight = optimized.height;
      } catch (optErr) {
        logger.warn('[media-routes] optimizeImageForSend fallback:', optErr);
        try {
          const meta = await sharp(fileBuffer).metadata();
          if (meta.width && meta.height) {
            imgWidth = meta.width;
            imgHeight = meta.height;
          }
        } catch {}
      }

      const attachmentSource: any = {
        data: sendBuffer,
        filename: sendFilename,
        metadata: {
          totalSize: sendBuffer.length,
          width: imgWidth,
          height: imgHeight,
        },
      };

      try {
        const res = await instance.api.sendMessage(
          { msg: msgText, attachments: [attachmentSource] },
          threadId,
          threadType
        );

        let finalContentType = 'image';
        let finalContent = JSON.stringify({
          href: item.url,
          thumb: item.url,
          hdUrl: item.url,
          ...(msgText ? { title: msgText, caption: msgText } : {}),
        });

        if (res?.attachment && res.attachment.length > 0) {
          const att = res.attachment[0];
          finalContent = JSON.stringify({
            href: att.normalUrl || att.fileUrl || item.url,
            thumb: att.thumbUrl || att.fileUrl || item.url,
            hdUrl: att.hdUrl || att.fileUrl || item.url,
            ...(msgText ? { title: msgText, caption: msgText } : {}),
          });
        }

        const newMsg = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'self',
            senderName: (user as any).fullName || 'Nhân viên',
            content: finalContent,
            contentType: finalContentType,
            sentAt: new Date(),
            attachments: res?.attachment ? JSON.stringify(res.attachment) : '[]',
          },
        });

        // Update conversation last message
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
          },
        });

        sentMessages.push(newMsg);

        // Real-time emit to web clients
        const io = (app as any).io;
        io?.emit('chat:message', {
          accountId: conversation.zaloAccountId,
          message: newMsg,
          conversationId: conversation.id,
        });
      } catch (sendErr: any) {
        logger.error(`Error sending media item ${item.id} to Zalo:`, sendErr.message);
      } finally {
        if (item.isTemp) {
          setTimeout(() => fs.unlink(filePath, () => {}), 15000);
        }
      }
    }

    return {
      success: true,
      sentCount: sentMessages.length,
      messages: sentMessages,
    };
  });
}
