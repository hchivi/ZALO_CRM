// Pure message media & sticker extraction utilities shared by MessageThread, ChatMessageItem, and ForwardMessageModal.

export interface MediaMessageLike {
  id?: string;
  content?: string | null;
  contentType?: string | null;
  attachments?: any;
  metadata?: any;
  isDeleted?: boolean;
}

export interface VideoInfo {
  url: string;
  thumb: string;
  caption: string;
}

export interface FileCardInfo {
  name: string;
  size: string;
  href: string;
  ext: string;
  isViewable: boolean;
}

export interface VoiceInfo {
  url: string;
  duration: number;
  durationText: string;
  fileSize?: string;
}

const IGNORED_PLACEHOLDER_CAPTIONS = new Set([
  '[hình ảnh]',
  '[video]',
  '[tài liệu]',
  '[tin nhắn thoại]',
  '[nhãn dán]',
  '[sticker]',
  '[image]',
  '[document]',
  '[file]',
  '[tệp đính kèm]',
]);

const NON_MEDIA_ATT_TYPES = new Set(['zalo_meta', 'reaction', 'quote', 'forwarded']);

function parseAttachmentList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
  }
  return [];
}

const SAFE_DATA_IMAGE_URI_RE = /^data:image\/(?:png|jpe?g|webp|gif|bmp);base64,[A-Za-z0-9+/=]+$/i;
const AUDIO_EXT_RE = /\.(?:aac|mp3|m4a|wav|ogg|opus)(?:\?|$)/i;
const VOICE_MARKER_RE = /(?:^|[\/._-])voice(?:[\/._-]|$)|(?:voice_record|voice-message)/i;

export function hasExplicitVoiceMarker(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return AUDIO_EXT_RE.test(trimmed) || VOICE_MARKER_RE.test(trimmed);
}

export function isValidMediaUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const u = url.trim();
  if (!u) return false;
  if (/^(?:javascript|vbscript|file):/i.test(u)) return false;
  if (u.toLowerCase().startsWith('data:')) {
    return SAFE_DATA_IMAGE_URI_RE.test(u);
  }
  return (
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('blob:') ||
    u.startsWith('/uploads/') ||
    u.startsWith('/storage/') ||
    u.startsWith('/api/')
  );
}

export function sanitizeMediaCaption(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (IGNORED_PLACEHOLDER_CAPTIONS.has(trimmed.toLowerCase())) return null;
  if (/^\[(?:gửi\s+file|tệp)\s*:/i.test(trimmed)) return null;

  if (
    trimmed.startsWith('/9j/') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('iVBORw0K') ||
    trimmed.startsWith('UklGR')
  ) {
    return null;
  }

  if (
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/storage/') ||
    trimmed.startsWith('/api/') ||
    /^https?:\/\/\S+$/i.test(trimmed)
  ) {
    return null;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return null;
      }
    } catch {
      if (trimmed.startsWith('{"')) return null;
    }
  }

  if (trimmed.length > 200 && !/\s/.test(trimmed) && /^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 64))) {
    return null;
  }

  return trimmed;
}

export function isZaloStickerUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  return url.includes('emoticon/sticker') || url.includes('/sticker/webpc');
}

function isLocalCrmAssetUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const u = url.trim();
  return (
    u.startsWith('/uploads/') ||
    u.startsWith('/storage/') ||
    u.startsWith('/api/zalo-assets/') ||
    u.startsWith('/api/zalo/files/')
  );
}

function messageHasLocalAsset(msg: MediaMessageLike): boolean {
  const attList = parseAttachmentList(msg.attachments);
  for (const att of attList) {
    if (!att) continue;
    if (typeof att === 'string' && isLocalCrmAssetUrl(att)) return true;
    if (typeof att === 'object' && !NON_MEDIA_ATT_TYPES.has(String(att.type || ''))) {
      if (
        isLocalCrmAssetUrl(att.localUrl) ||
        isLocalCrmAssetUrl(att.url) ||
        isLocalCrmAssetUrl(att.href) ||
        isLocalCrmAssetUrl(att.stickerUrl)
      ) {
        return true;
      }
    }
  }
  const c = typeof msg.content === 'string' ? msg.content.trim() : '';
  if (isLocalCrmAssetUrl(c)) return true;
  if (c.startsWith('{')) {
    try {
      const p = JSON.parse(c);
      if (
        isLocalCrmAssetUrl(p.localUrl) ||
        isLocalCrmAssetUrl(p.url) ||
        isLocalCrmAssetUrl(p.href) ||
        isLocalCrmAssetUrl(p.hdUrl) ||
        isLocalCrmAssetUrl(p.thumb) ||
        isLocalCrmAssetUrl(p.stickerUrl)
      ) {
        return true;
      }
    } catch {}
  }
  return false;
}

export function getVoiceInfo(msg: MediaMessageLike | null | undefined): VoiceInfo | null {
  if (!msg) return null;
  const attList = parseAttachmentList(msg.attachments);
  const content = typeof msg.content === 'string' ? msg.content.trim() : '';

  let parsedContent: any = null;
  let parsedParams: any = null;
  if (content.startsWith('{')) {
    try {
      parsedContent = JSON.parse(content);
      parsedParams = parsedContent.params;
      if (typeof parsedParams === 'string') {
        try { parsedParams = JSON.parse(parsedParams); } catch {}
      }
    } catch {}
  }

  const hasJsonVoice = Boolean(
    parsedContent &&
    (
      hasExplicitVoiceMarker(parsedContent.action) ||
      Boolean(parsedContent.voiceUrl) ||
      Boolean(parsedParams?.waveformSamples) ||
      Boolean(parsedParams?.m4a) ||
      hasExplicitVoiceMarker(parsedContent.localUrl) ||
      hasExplicitVoiceMarker(parsedContent.href) ||
      hasExplicitVoiceMarker(parsedContent.url)
    )
  );
  const isAudioDirectUrl = Boolean(!content.startsWith('{') && isValidMediaUrl(content) && hasExplicitVoiceMarker(content));
  const hasVoiceAtt = attList.some((a: any) => a?.type === 'voice' || a?.type === 'audio' || hasExplicitVoiceMarker(a?.localUrl || a?.url || a?.href));

  if (
    msg.contentType === 'voice' ||
    hasJsonVoice ||
    isAudioDirectUrl ||
    hasVoiceAtt ||
    content === '[Tin nhắn thoại]'
  ) {
    try {
      if (parsedContent) {
        const url =
          parsedContent.localUrl ||
          parsedContent.href ||
          parsedContent.voiceUrl ||
          parsedParams?.m4a ||
          parsedParams?.href ||
          parsedParams?.url ||
          parsedContent.url ||
          '';
        const durMs = Number(parsedParams?.duration || parsedContent.duration || 0);
        const duration = durMs > 0 ? (durMs > 1000 ? Math.round(durMs / 1000) : Math.round(durMs)) : 0;
        const m = Math.floor(duration / 60);
        const s = duration % 60;
        const durationText = `${m}:${s < 10 ? '0' : ''}${s}`;
        const bytes = Number(parsedParams?.fileSize || parsedContent.fileSize || 0);
        const fileSize = bytes > 0 ? (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`) : undefined;
        if (isValidMediaUrl(url)) return { url, duration, durationText, fileSize };
      } else if (content && isValidMediaUrl(content)) {
        if (isAudioDirectUrl || msg.contentType === 'voice') {
          return { url: content, duration: 0, durationText: '0:00' };
        }
      }
      if (attList.length > 0) {
        const att = attList.find((a: any) => a && !NON_MEDIA_ATT_TYPES.has(String(a.type || '')) && (a.type === 'voice' || a.type === 'audio' || a.url || a.href || a.localUrl));
        const attUrl = att?.localUrl || att?.url || att?.href;
        if (isValidMediaUrl(attUrl)) {
          return { url: attUrl, duration: att.duration || 0, durationText: att.durationText || '0:00' };
        }
      }
      if (msg.id && (msg.contentType === 'voice' || content === '[Tin nhắn thoại]')) {
        return { url: `/api/zalo/files/message-file/${msg.id}`, duration: 0, durationText: '0:00' };
      }
    } catch {}
  }
  return null;
}

export function getStickerUrl(msg: MediaMessageLike | null | undefined): string | null {
  if (!msg) return null;
  if (msg.contentType === 'image' || msg.contentType === 'chat.photo' || msg.contentType === 'file' || msg.contentType === 'voice' || msg.contentType === 'video') {
    return null;
  }

  // WhatsApp WebP stickers always render as full-size borderless images via getImageUrl()
  // rather than 130x130 Zalo sticker cards.
  const meta = msg.metadata && typeof msg.metadata === 'object' ? (msg.metadata as any) : null;
  if (meta?.channel === 'whatsapp' || meta?.whatsappType === 'sticker') {
    return null;
  }

  // WhatsApp WebP stickers live on local /uploads/media/, /storage/, or /api/zalo-assets/;
  // route them through full-size borderless Image UI instead of 130x130 Zalo sticker UI.
  if (messageHasLocalAsset(msg)) {
    return null;
  }

  const attList = parseAttachmentList(msg.attachments);
  if (attList.length > 0) {
    for (const att of attList) {
      if (!att || NON_MEDIA_ATT_TYPES.has(String(att.type || ''))) continue;
      if (typeof att === 'string' && isZaloStickerUrl(att)) return att;
      if (typeof att === 'object') {
        if (isZaloStickerUrl(att.url)) return att.url;
        if (isZaloStickerUrl(att.stickerUrl)) return att.stickerUrl;
        if (att.stickerUrl && isValidMediaUrl(att.stickerUrl) && !isLocalCrmAssetUrl(att.stickerUrl)) {
          return att.stickerUrl;
        }
        const attId = att.id || att.stickerId || att.eid || att.sid;
        if (attId && (msg.contentType === 'sticker' || msg.contentType === 'chat.sticker') && /^\d+$/.test(String(attId))) {
          return `https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=${attId}&size=200`;
        }
      }
    }
  }

  if (!msg.content) return null;
  const content = msg.content.trim();

  if (isZaloStickerUrl(content) && content.startsWith('http')) {
    return content;
  }

  if (content.startsWith('{')) {
    try {
      const data = JSON.parse(content);
      if (isZaloStickerUrl(data.url) || isZaloStickerUrl(data.stickerUrl)) {
        return data.stickerUrl || data.url;
      }
      if (data.stickerUrl && isValidMediaUrl(data.stickerUrl) && !isLocalCrmAssetUrl(data.stickerUrl)) {
        return data.stickerUrl;
      }
      const id = data.id || data.stickerId || data.eid || data.sid;
      if (id && (data.catId || data.type === 7 || ((msg.contentType === 'sticker' || msg.contentType === 'chat.sticker') && /^\d+$/.test(String(id))))) {
        return `https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=${id}&size=200`;
      }
    } catch {}
  }

  if (msg.contentType === 'sticker' || msg.contentType === 'chat.sticker') {
    if (content.startsWith('http')) return content;
    if (/^\d+$/.test(content)) {
      return `https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=${content}&size=200`;
    }
  }

  return null;
}

export function getVideoInfo(msg: MediaMessageLike | null | undefined): VideoInfo | null {
  if (!msg) return null;
  if (msg.contentType === 'voice' || msg.contentType === 'call' || msg.contentType === 'file') return null;
  if (getVoiceInfo(msg) !== null) return null;

  if (msg.contentType === 'video' && msg.content && isValidMediaUrl(msg.content)) {
    return { url: msg.content.trim(), thumb: '', caption: '' };
  }

  if (msg.content?.startsWith('{')) {
    try {
      const p = JSON.parse(msg.content);
      let params = p.params;
      if (typeof params === 'string') { try { params = JSON.parse(params); } catch {} }
      const videoUrl = p.videoUrl || params?.videoUrl || params?.streamUrl || '';
      const href = p.localUrl || p.href || params?.rawUrl || '';
      const isVid =
        msg.contentType === 'video' ||
        p.type === 'video' ||
        Boolean(videoUrl) ||
        /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(href) ||
        params?.extention === 'mp4' ||
        params?.fType === 2;
      if (isVid) {
        const chosenUrl = isValidMediaUrl(videoUrl)
          ? videoUrl
          : (/\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(href) && isValidMediaUrl(href) ? href : '');
        const thumbCandidate = p.thumb || p.thumbnailUrl || params?.thumbUrl || '';
        return {
          url: chosenUrl,
          thumb: isValidMediaUrl(thumbCandidate) ? thumbCandidate : '',
          caption: sanitizeMediaCaption(p.caption || p.title || p.description) || '',
        };
      }
    } catch {}
  }

  const vidAttList = parseAttachmentList(msg.attachments);
  if (vidAttList.length > 0) {
    const att = vidAttList.find((a: any) => a && typeof a === 'object' && !NON_MEDIA_ATT_TYPES.has(String(a.type || '')) && (a.type === 'video' || a.videoUrl || a.fileType === 'video'));
    if (att) {
      const vUrl = att.videoUrl || att.localUrl || att.fileUrl || att.url || '';
      return {
        url: isValidMediaUrl(vUrl) ? vUrl : '',
        thumb: isValidMediaUrl(att.thumbUrl || att.thumb) ? (att.thumbUrl || att.thumb) : '',
        caption: sanitizeMediaCaption(att.caption || att.title) || '',
      };
    }
  }

  return null;
}

function firstValidUrl(candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (isValidMediaUrl(c)) {
      return c.trim();
    }
  }
  return null;
}

function isAudioOrDocUrl(u: string): boolean {
  return (
    hasExplicitVoiceMarker(u) ||
    /\.(aac|mp3|m4a|wav|ogg|opus|pdf|docx?|xlsx?|pptx?|zip|rar)(\?|$)/i.test(u)
  );
}

export function getImageFallbackUrl(msg: MediaMessageLike | null | undefined): string | null {
  if (!msg?.id || msg.isDeleted) return null;
  return `/api/zalo/files/message-file/${msg.id}?mode=view`;
}

export function getImageUrl(msg: MediaMessageLike | null | undefined): string | null {
  if (!msg) return null;
  if (getStickerUrl(msg) !== null) return null;
  if (msg.contentType === 'voice' || msg.contentType === 'call' || msg.contentType === 'file') return null;
  if (getVoiceInfo(msg) !== null) return null;
  if (getVideoInfo(msg) !== null) return null;

  const content = typeof msg.content === 'string' ? msg.content.trim() : '';

  if (/^(?:javascript|vbscript|file|data:text\/html):/i.test(content)) {
    return null;
  }

  if (content && content.startsWith('/9j/') && /^\/9j\/[A-Za-z0-9+/=]+$/.test(content)) {
    return `data:image/jpeg;base64,${content}`;
  }
  if (content && content.toLowerCase().startsWith('data:') && isValidMediaUrl(content)) {
    return content;
  }

  if (
    (msg.contentType === 'image' || msg.contentType === 'chat.photo' || msg.contentType === 'sticker') &&
    content &&
    !content.startsWith('{') &&
    isValidMediaUrl(content)
  ) {
    return content;
  }

  if (content.startsWith('{')) {
    try {
      const p = JSON.parse(content);
      let params = p.params;
      if (typeof params === 'string') { try { params = JSON.parse(params); } catch {} }

      if (hasExplicitVoiceMarker(p.action) || params?.waveformSamples || params?.fType === 1) {
        return null;
      }

      const candidate = firstValidUrl([
        p.localUrl,
        p.normalUrl,
        p.href,
        p.hdUrl,
        p.url,
        p.stickerUrl,
        params?.rawUrl,
        params?.hd,
        p.thumb,
      ]);

      if (candidate && !isAudioOrDocUrl(candidate)) {
        const isImgType =
          msg.contentType === 'image' ||
          msg.contentType === 'chat.photo' ||
          msg.contentType === 'sticker';
        if (
          isImgType ||
          candidate.startsWith('data:') ||
          candidate.startsWith('blob:') ||
          candidate.startsWith('/uploads/') ||
          candidate.startsWith('/storage/') ||
          candidate.startsWith('/api/') ||
          /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)(\?|$)/i.test(candidate) ||
          p.childnumber !== undefined ||
          params?.convertible === 'jxl' ||
          (candidate.includes('zdn.vn') && !params?.fileExt)
        ) {
          return candidate;
        }
      }
    } catch {}
  }

  const imgAttList = parseAttachmentList(msg.attachments);
  if (imgAttList.length > 0) {
    for (const att of imgAttList) {
      if (!att) continue;
      if (typeof att === 'string' && isValidMediaUrl(att) && !isAudioOrDocUrl(att)) {
        return att.trim();
      }
      if (typeof att === 'object') {
        if (NON_MEDIA_ATT_TYPES.has(String(att.type || ''))) continue;
        const attUrl = firstValidUrl([att.localUrl, att.hdUrl, att.url, att.href, att.stickerUrl]);
        if (attUrl && !isAudioOrDocUrl(attUrl)) {
          return attUrl;
        }
      }
    }
  }

  if (content) {
    const rawMatch =
      content.match(/(https?:\/\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp|gif|bmp|heic|heif)(?:\?[^\s"'<>\\]*)?)/i) ||
      content.match(/(https?:\/\/[^\s"'<>\\]*?zdn\.vn[^\s"'<>\\]*)/i);
    if (rawMatch && isValidMediaUrl(rawMatch[1]) && !isAudioOrDocUrl(rawMatch[1])) {
      return rawMatch[1];
    }
  }

  // Fallback to server-side proxy recovery when an image/WA sticker payload has empty/placeholder content
  if ((msg.contentType === 'image' || msg.contentType === 'chat.photo' || msg.contentType === 'sticker') && msg.id && !msg.isDeleted) {
    return getImageFallbackUrl(msg);
  }

  return null;
}

export function getImageFullUrl(msg: MediaMessageLike | null | undefined): string | null {
  if (!msg) return null;
  const content = typeof msg.content === 'string' ? msg.content.trim() : '';

  if (content && content.startsWith('/9j/') && /^\/9j\/[A-Za-z0-9+/=]+$/.test(content)) {
    return `data:image/jpeg;base64,${content}`;
  }
  if (content && content.toLowerCase().startsWith('data:') && isValidMediaUrl(content)) {
    return content;
  }

  if (
    (msg.contentType === 'image' || msg.contentType === 'chat.photo' || msg.contentType === 'sticker') &&
    content &&
    !content.startsWith('{') &&
    isValidMediaUrl(content)
  ) {
    return content;
  }

  if (content.startsWith('{')) {
    try {
      const p = JSON.parse(content);
      let params = p.params;
      if (typeof params === 'string') { try { params = JSON.parse(params); } catch {} }
      const bestUrl = firstValidUrl([
        p.hdUrl,
        p.localUrl,
        p.normalUrl,
        p.href,
        p.url,
        p.stickerUrl,
        params?.hd,
        params?.rawUrl,
        p.thumb,
      ]);
      if (bestUrl && !isAudioOrDocUrl(bestUrl)) {
        return bestUrl;
      }
    } catch {}
  }

  return getImageUrl(msg);
}

export function formatFileSize(rawSize: unknown): string {
  if (rawSize === null || rawSize === undefined || rawSize === '') return '';
  if (typeof rawSize === 'string') {
    const trimmed = rawSize.trim();
    if (/^\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB)$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
  }
  const bytes = Number(rawSize);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes)} B`;
}

const DOC_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'rar', '7z', 'tar', 'gz', 'txt', 'csv', 'rtf', 'json',
]);

export function getFileInfo(msg: MediaMessageLike | null | undefined): FileCardInfo | null {
  if (!msg) return null;
  if (msg.contentType === 'voice' || msg.contentType === 'call' || msg.contentType === 'sticker' || msg.contentType === 'chat.sticker') {
    return null;
  }
  if (getVoiceInfo(msg) !== null || getStickerUrl(msg) !== null) {
    return null;
  }

  const content = typeof msg.content === 'string' ? msg.content.trim() : '';
  let p: any = null;
  if (content.startsWith('{')) {
    try {
      p = JSON.parse(content);
      if (typeof p.params === 'string') {
        try { p.params = JSON.parse(p.params); } catch {}
      }
    } catch {}
  }

  if (
    p?.params?.waveformSamples ||
    hasExplicitVoiceMarker(p?.action) ||
    hasExplicitVoiceMarker(p?.localUrl) ||
    hasExplicitVoiceMarker(p?.href) ||
    hasExplicitVoiceMarker(p?.url)
  ) {
    return null;
  }

  const attList = parseAttachmentList(msg.attachments);
  const attObj =
    attList.find(
      (a: any) =>
        a &&
        typeof a === 'object' &&
        !NON_MEDIA_ATT_TYPES.has(String(a.type || '')) &&
        (a.fileUrl || a.url || a.localUrl || a.href || a.fileName || a.name)
    ) || null;

  const rawTitle =
    sanitizeMediaCaption(p?.title) ||
    sanitizeMediaCaption(p?.fileName) ||
    sanitizeMediaCaption(attObj?.fileName) ||
    sanitizeMediaCaption(attObj?.title) ||
    sanitizeMediaCaption(attObj?.name) ||
    '';

  let rawHref = firstValidUrl([
    p?.localUrl,
    p?.href,
    attObj?.localUrl,
    attObj?.fileUrl,
    attObj?.href,
    attObj?.url,
    content && !content.startsWith('{') ? content : null,
  ]) || '';

  if (!rawHref && msg.id && msg.contentType === 'file') {
    rawHref = `/api/zalo/files/message-file/${msg.id}`;
  }
  const fileExtFromParam = p?.params?.fileExt || attObj?.fileExt || '';

  let ext = String(fileExtFromParam || '').toLowerCase().replace(/^\./, '');
  if (!ext && rawTitle) {
    const extMatch = rawTitle.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
    if (extMatch) ext = extMatch[1].toLowerCase();
  }
  if (!ext && rawHref) {
    const cleanPath = rawHref.split('?')[0];
    const extMatch = cleanPath.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) ext = extMatch[1].toLowerCase();
  }

  const isDocFile =
    msg.contentType === 'file' ||
    p?.params?.fType === 1 ||
    Boolean(ext && DOC_EXTENSIONS.has(ext));

  if (isDocFile || (msg.contentType === 'file' && (rawTitle || rawHref || content))) {
    if (!rawHref && msg.id) {
      rawHref = `/api/zalo/files/message-file/${msg.id}`;
    }
    const rawSize = p?.params?.fileSize ?? attObj?.fileSize ?? attObj?.totalSize ?? attObj?.size;
    const size = formatFileSize(rawSize);

    let name = rawTitle;
    if (!name && content && !content.startsWith('{')) {
      const matchBracket = content.match(/\[(?:Gửi\s+file|Tệp):\s*(.+?)\]/i);
      if (matchBracket) {
        name = matchBracket[1].trim();
      } else if (!isValidMediaUrl(content)) {
        name = content;
      }
    }
    if (!name && rawHref) {
      const base = rawHref.split('?')[0].split('/').pop() || '';
      const cleanBase = base.replace(/^wa_doc_\d+_/, '').replace(/^\d+_[a-f0-9]+_/, '');
      if (cleanBase && cleanBase.includes('.')) name = decodeURIComponentSafe(cleanBase);
    }
    if (!name) {
      name = ext ? `Tài liệu.${ext}` : 'Tài liệu đính kèm';
    }
    if (ext && ext !== 'file' && !name.toLowerCase().endsWith('.' + ext)) {
      name = `${name}.${ext}`;
    }

    const isViewable = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt'].includes(ext);

    return {
      name,
      size,
      href: rawHref,
      ext: ext || 'file',
      isViewable,
    };
  }

  return null;
}

function decodeURIComponentSafe(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

export function getImageCaption(msg: MediaMessageLike | null | undefined): string | null {
  if (!msg?.content) return null;
  const content = msg.content.trim();
  if (!content.startsWith('{')) {
    return null;
  }
  try {
    const p = JSON.parse(content);
    return sanitizeMediaCaption(p.caption) ?? sanitizeMediaCaption(p.title) ?? sanitizeMediaCaption(p.description) ?? sanitizeMediaCaption(p.msg);
  } catch {}
  return null;
}

export function isEmptyMediaJson(msg: MediaMessageLike | null | undefined): boolean {
  if (!msg?.content || !msg.content.trim().startsWith('{')) return false;
  if (
    msg.contentType === 'voice' ||
    msg.contentType === 'call' ||
    msg.contentType === 'bank_card' ||
    msg.contentType === 'reminder' ||
    msg.contentType === 'video' ||
    msg.contentType === 'sticker' ||
    msg.contentType === 'chat.sticker' ||
    msg.contentType === 'file'
  ) {
    return false;
  }
  if (getVoiceInfo(msg) !== null || getStickerUrl(msg) !== null || getVideoInfo(msg) !== null) {
    return false;
  }
  try {
    const p = JSON.parse(msg.content);
    if (
      p.action === 'msginfo.actionlist' ||
      p.actionlist !== undefined ||
      hasExplicitVoiceMarker(p.action) ||
      p.bankName ||
      p.numAccBank ||
      p.videoUrl
    ) {
      return false;
    }
    if ('href' in p && 'thumb' in p && 'hdUrl' in p) {
      if (!p.href && !p.thumb && !p.hdUrl && !p.localUrl && !p.url && !sanitizeMediaCaption(p.title) && !sanitizeMediaCaption(p.caption)) {
        if ((msg.contentType === 'image' || msg.contentType === 'chat.photo') && msg.id && !msg.isDeleted) {
          return false;
        }
        return true;
      }
    }
  } catch {}
  return false;
}
