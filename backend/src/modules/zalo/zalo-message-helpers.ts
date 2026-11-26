/**
 * zalo-message-helpers.ts — utilities for processing incoming Zalo messages.
 * Detects content type from msgType and updates contact avatars fire-and-forget.
 */
import { prisma } from '../../shared/database/prisma-client.js';

/**
 * Map zca-js msgType string to a normalized content type label.
 * Falls back to 'text' for unrecognised types or plain-string content.
 */
export function detectContentType(msgType: string | undefined, content: any): string {
  const typeLower = (msgType || '').toLowerCase();
  if (typeLower.includes('photo') || typeLower.includes('image')) return 'image';
  if (typeLower.includes('file') || typeLower.includes('doc')) return 'file';
  if (typeLower.includes('sticker')) return 'sticker';
  if (typeLower.includes('video')) return 'video';
  if (typeLower.includes('voice')) return 'voice';
  if (typeLower.includes('gif')) return 'gif';
  if (typeLower.includes('location')) return 'location';

  // Deep inspect object or JSON-string content
  let parsed = content;
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    try { parsed = JSON.parse(content); } catch {}
  }

  if (typeof parsed === 'object' && parsed !== null) {
    let params = parsed.params;
    if (typeof params === 'string') {
      try { params = JSON.parse(params); } catch {}
    }

    // 1. Call detection
    if (parsed.action?.includes('call') || parsed.title === 'sendBubbleMessage' || parsed.description === 'Cuộc gọi' || params?.callId !== undefined) {
      return 'call';
    }

    // 2. Voice detection
    if (
      parsed.action?.includes('voice') ||
      params?.waveformSamples ||
      params?.m4a ||
      (parsed.href && (parsed.href.includes('voice') || parsed.href.includes('.aac') || parsed.href.includes('.m4a') || parsed.href.includes('.mp3')))
    ) {
      return 'voice';
    }

    // 3. Video detection (Must be checked before file & image)
    const videoUrlCandidate = parsed.videoUrl || params?.videoUrl || params?.streamUrl || parsed.href || '';
    const hasVideoExt = /\.(mp4|mov|avi|mkv|webm|m4v)(\?.*)?$/i.test(videoUrlCandidate);
    const isVideoSignature =
      parsed.action?.includes('video') ||
      parsed.type === 'video' ||
      typeLower.includes('video') ||
      params?.extention === 'mp4' ||
      params?.extention === 'mov' ||
      params?.fType === 2 ||
      (params?.duration !== undefined && (params?.videoWidth || params?.videoHeight || params?.width) && !params?.waveformSamples);

    if (hasVideoExt || isVideoSignature) {
      return 'video';
    }

    // 4. File detection
    if (params?.fileExt || params?.fType === 1 || /\.(pdf|xlsx?|docx?|pptx?|zip|rar|tar|gz|7z|txt|csv)$/i.test(parsed.title || parsed.href || '')) {
      return 'file';
    }

    // 5. Image detection (Zalo photo payload detection)
    const href = parsed.href || parsed.thumb || parsed.hdUrl || params?.rawUrl || params?.hd || '';
    const isZaloPhotoSignature =
      parsed.childnumber !== undefined ||
      params?.convertible === 'jxl' ||
      (typeof params?.jcp === 'string' && params.jcp.includes('jxl')) ||
      (typeof href === 'string' && (href.includes('zdn.vn') && !params?.fileExt)) ||
      (typeof href === 'string' && (href.includes('/jpg/') || href.includes('/png/') || href.includes('/webp/')));

    const hasImageExt = /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)(\?.*)?$/i.test(href);

    if ((hasImageExt || isZaloPhotoSignature) && !parsed.action?.includes('link')) {
      return 'image';
    }

    // 6. Link detection
    if (parsed.action?.includes('link') || (href && href.startsWith('http')) || params?.redirect_url || params?.src) {
      return 'link';
    }

    // 7. Contact card
    if (parsed.action?.includes('user') || typeLower.includes('recommended') || typeLower.includes('card')) {
      return 'contact_card';
    }

    return 'rich';
  }

  // Fallback detection if JSON.parse failed due to nested unescaped string params
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    if (content.includes('zdn.vn') || /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)/i.test(content) || content.includes('childnumber')) {
      return 'image';
    }
    if (/\.(mp4|mov|avi|mkv|webm)/i.test(content) || content.includes('videoUrl')) {
      return 'video';
    }
    if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar)/i.test(content) || content.includes('fileExt') || content.includes('fType')) {
      return 'file';
    }
  }

  if (typeLower.includes('link')) return 'link';
  if (typeLower.includes('recommended') || typeLower.includes('card')) return 'contact_card';

  if (typeof content === 'string' && /^https?:\/\/\S+$/i.test(content.trim())) {
    return 'link';
  }

  return 'text';
}

/**
 * Fire-and-forget: fill in a missing avatarUrl on a Contact row.
 * Updates rows where avatarUrl is currently null or empty, and emits socket update.
 */
export function updateContactAvatar(zaloUid: string, avatarUrl: string): void {
  if (!zaloUid || !avatarUrl) return;
  prisma.contact
    .updateMany({
      where: { zaloUid, OR: [{ avatarUrl: null }, { avatarUrl: '' }] },
      data: { avatarUrl },
    })
    .then((res) => {
      if (res.count > 0) {
        import('./zalo-pool.js').then(({ zaloPool }) => {
          zaloPool.getIO()?.emit('contact:updated', { zaloUid, avatarUrl });
        }).catch(() => {});
      }
    })
    .catch(() => {});
}
