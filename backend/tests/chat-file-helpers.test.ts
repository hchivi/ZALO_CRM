import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeUploadExtension,
  buildContentDisposition,
  isPrivateOrReservedIp,
  validateZaloProxyUrl,
  detectUploadMediaKind,
} from '../src/modules/chat/chat-file-helpers.js';

describe('Chat File Security & Media Helpers', () => {
  it('sanitizes dangerous upload extensions while preserving safe extensions', () => {
    assert.deepEqual(sanitizeUploadExtension('../../payload.svg'), {
      ext: '.bin',
      originalExt: 'svg',
      baseName: 'payload',
      wasSanitized: true,
    });
    assert.deepEqual(sanitizeUploadExtension('shell.php'), {
      ext: '.bin',
      originalExt: 'php',
      baseName: 'shell',
      wasSanitized: true,
    });
    assert.deepEqual(sanitizeUploadExtension('CATALOGUE ĐỒNG PHỤC.pdf'), {
      ext: '.pdf',
      originalExt: 'pdf',
      baseName: 'CATALOGUE_ĐỒNG_PHỤC',
      wasSanitized: false,
    });
  });

  it('builds safe Content-Disposition headers and forces attachment for active content extensions', () => {
    const inlinePdf = buildContentDisposition('view', 'bao_gia.pdf');
    assert.ok(inlinePdf.startsWith('inline; filename="bao_gia.pdf"'));

    const svgDownload = buildContentDisposition('view', 'diagram.svg');
    assert.ok(svgDownload.startsWith('attachment; filename="diagram.svg"'));

    const crlfInjected = buildContentDisposition('download', 'bad\r\nX-Injected: 1;"test".html');
    assert.ok(!/[\r\n]/.test(crlfInjected));
    assert.ok(crlfInjected.startsWith('attachment; '));
  });

  it('blocks private/reserved IPs and SSRF proxy targets while allowing public HTTPS', async () => {
    assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
    assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('172.16.5.4'), true);
    assert.equal(isPrivateOrReservedIp('192.168.1.10'), true);
    assert.equal(isPrivateOrReservedIp('::1'), true);
    assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('fe80::1'), true);
    assert.equal(isPrivateOrReservedIp('1.1.1.1'), false);

    assert.equal((await validateZaloProxyUrl('http://f1.zdn.vn/a.jpg')).ok, false);
    assert.equal((await validateZaloProxyUrl('https://user:pass@f1.zdn.vn/a.jpg')).ok, false);
    assert.equal((await validateZaloProxyUrl('https://evil.example/a.jpg')).ok, false);
    assert.equal((await validateZaloProxyUrl('https://127.0.0.1/secret', { allowAnyPublicHttps: true })).ok, false);
    assert.equal((await validateZaloProxyUrl('https://169.254.169.254/latest/meta-data/', { allowAnyPublicHttps: true })).ok, false);
    assert.equal((await validateZaloProxyUrl('https://10.0.0.1/internal', { allowAnyPublicHttps: true })).ok, false);
    assert.equal((await validateZaloProxyUrl('https://[::1]/internal', { allowAnyPublicHttps: true })).ok, false);

    const publicOk = await validateZaloProxyUrl('https://1.1.1.1/file.pdf', { allowAnyPublicHttps: true });
    assert.equal(publicOk.ok, true);
  });

  it('distinguishes voice recordings from webm video uploads', () => {
    assert.equal(detectUploadMediaKind('webm', 'clip.webm', 'video/webm'), 'video');
    assert.equal(detectUploadMediaKind('webm', 'audio.webm', 'audio/webm'), 'voice');
    assert.equal(detectUploadMediaKind('webm', 'voice_record_123.webm', 'application/octet-stream'), 'voice');
    assert.equal(detectUploadMediaKind('ogg', 'voice_1.ogg', 'audio/ogg'), 'voice');
    assert.equal(detectUploadMediaKind('webp', 'sticker.webp', 'image/webp'), 'image');
    assert.equal(detectUploadMediaKind('pdf', 'doc.pdf', 'application/pdf'), 'file');
  });
});

