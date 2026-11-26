import net from 'node:net';
import dns from 'node:dns/promises';

const ALLOWED_ZALO_CDN_HOST_RE = /(?:^|\.)(zdn\.vn|zadn\.vn|zalo\.me|zaloapp\.com|dlfl\.vn)$/i;

const DANGEROUS_EXTENSIONS = new Set([
  'php', 'php3', 'php4', 'php5', 'phps', 'phtml', 'phar',
  'html', 'htm', 'xhtml', 'svg', 'svgz',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'jsp', 'asp', 'aspx', 'exe', 'dll', 'so', 'msi',
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'psm1',
  'py', 'rb', 'pl', 'cgi', 'htaccess', 'env', 'sql',
]);

export function sanitizeUploadExtension(originalName: string): {
  ext: string;
  originalExt: string;
  baseName: string;
  wasSanitized: boolean;
} {
  const safeBaseRaw = (originalName || 'file').split(/[\\/]/).pop() || 'file';
  const lastDot = safeBaseRaw.lastIndexOf('.');
  const rawBase = lastDot > 0 ? safeBaseRaw.slice(0, lastDot) : safeBaseRaw;
  const rawExt = lastDot > 0 ? safeBaseRaw.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const baseName = rawBase.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, '_').slice(0, 50) || 'file';

  if (rawExt && DANGEROUS_EXTENSIONS.has(rawExt)) {
    return {
      ext: '.bin',
      originalExt: rawExt,
      baseName,
      wasSanitized: true,
    };
  }

  return {
    ext: rawExt ? `.${rawExt}` : '',
    originalExt: rawExt,
    baseName,
    wasSanitized: false,
  };
}

export function buildContentDisposition(mode: string | undefined, rawFilename: string): string {
  const cleanName = String(rawFilename || 'file')
    .replace(/[\r\n\x00-\x1f\x7f]/g, ' ')
    .replace(/[\\/]/g, '_')
    .trim() || 'file';
  const asciiName = cleanName
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\;]/g, '_')
    .trim() || 'file';
  const ext = cleanName.includes('.') ? cleanName.split('.').pop()?.toLowerCase() || '' : '';
  const forceAttachment = DANGEROUS_EXTENSIONS.has(ext);
  const disposition = mode === 'view' && !forceAttachment ? 'inline' : 'attachment';
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(cleanName)}`;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  let normalized = ip.trim().toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice(7);
  }
  const zoneIdx = normalized.indexOf('%');
  if (zoneIdx >= 0) {
    normalized = normalized.slice(0, zoneIdx);
  }

  const version = net.isIP(normalized);
  if (version === 4) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // Link-local / cloud metadata 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // Multicast / reserved
    return false;
  }

  if (version === 6) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // Unique local fc00::/7
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true; // Link-local fe80::/10
    }
    if (normalized.startsWith('ff')) return true; // Multicast
    return false;
  }

  return true;
}

export async function validateZaloProxyUrl(
  rawUrl: string,
  options?: { allowAnyPublicHttps?: boolean },
): Promise<{ ok: true; url: URL } | { ok: false; reason: string; status: number }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'URL không hợp lệ', status: 400 };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Chỉ cho phép tải tài nguyên qua HTTPS', status: 400 };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL không được chứa thông tin xác thực', status: 400 };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { ok: false, reason: 'Thiếu hostname', status: 400 };
  }

  if (!options?.allowAnyPublicHttps && !ALLOWED_ZALO_CDN_HOST_RE.test(hostname)) {
    return { ok: false, reason: 'Hostname không nằm trong danh sách Zalo CDN hợp lệ', status: 403 };
  }

  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { ok: false, reason: 'Không được phép truy cập địa chỉ nội bộ', status: 403 };
  }

  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      return { ok: false, reason: 'Không được phép truy cập IP nội bộ', status: 403 };
    }
    return { ok: true, url: parsed };
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, reason: 'Không phân giải được DNS cho URL', status: 400 };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return { ok: false, reason: 'Hostname phân giải về địa chỉ IP nội bộ không hợp lệ', status: 403 };
      }
    }
  } catch {
    return { ok: false, reason: 'Không thể xác minh DNS cho URL tải xuống', status: 400 };
  }

  return { ok: true, url: parsed };
}

export function detectUploadMediaKind(
  fileExt: string,
  fileName: string,
  mimeType?: string,
): 'voice' | 'image' | 'video' | 'file' {
  const ext = (fileExt || '').toLowerCase().replace(/^\./, '');
  const lowerMime = (mimeType || '').toLowerCase();
  const isVoice =
    ['ogg', 'opus', 'mp3', 'm4a', 'aac', 'wav'].includes(ext) ||
    (fileName || '').includes('voice_record') ||
    (ext === 'webm' && lowerMime.startsWith('audio/'));
  if (isVoice) return 'voice';

  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'jfif', 'heic', 'heif'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) {
    return 'video';
  }
  return 'file';
}

