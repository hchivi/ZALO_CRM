import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSerializedMsgKey,
  buildCandidateSerializedIds,
  classifyWhatsAppMediaType,
  detectImageFormatFromBuffer,
  isLikelyTinyWhatsAppThumb,
  shouldIgnoreWhatsAppCaption,
  hasExplicitVoiceMarker,
  extractUsableCaptionFromIncoming,
  mergeOutgoingSelfEcho,
  extractConversationAssets,
} from '../src/modules/whatsapp/whatsapp-media-helpers.js';

describe('WhatsApp Media Helpers & Self-Echo Guards', () => {
  it('reconstructs missing _serialized on MsgKey for 1-1 and group messages', () => {
    assert.equal(
      getSerializedMsgKey({
        id: { fromMe: false, remote: '84901234567@c.us', id: '3A819CC5672178273489' },
      }),
      'false_84901234567@c.us_3A819CC5672178273489',
    );
    assert.equal(
      getSerializedMsgKey({
        id: {
          fromMe: true,
          remote: { _serialized: '12036312345@g.us' },
          id: '3EB0B15B9E85B74F54A7D5',
          participant: { _serialized: '84909998888@c.us' },
        },
      }),
      'true_12036312345@g.us_3EB0B15B9E85B74F54A7D5_84909998888@c.us',
    );
  });

  it('builds candidate serialized IDs across fromMe and @s.whatsapp.net -> @c.us normalization', () => {
    const cands = buildCandidateSerializedIds('3A819CC5672178273489', '84901234567@s.whatsapp.net', false);
    assert.ok(cands.includes('false_84901234567@c.us_3A819CC5672178273489'));
    assert.ok(cands.includes('true_84901234567@c.us_3A819CC5672178273489'));
    assert.ok(cands.includes('3A819CC5672178273489'));
    assert.equal(cands[0], 'false_84901234567@c.us_3A819CC5672178273489');
  });

  it('classifies media types strictly without letting JPEG thumbnails hijack documents, videos, or links', () => {
    const thumb = '/9j/4AAQSkZJRgABAQAAAQABAAD/';
    assert.equal(classifyWhatsAppMediaType({ type: 'document', hasMedia: true }, thumb), 'file');
    assert.equal(classifyWhatsAppMediaType({ type: 'video', hasMedia: true }, thumb), 'video');
    assert.equal(classifyWhatsAppMediaType({ type: 'ptv', hasMedia: true }, thumb), 'video');
    assert.equal(classifyWhatsAppMediaType({ type: 'ptt', hasMedia: true }, thumb), 'voice');
    assert.equal(classifyWhatsAppMediaType({ type: 'chat', hasMedia: false }, thumb), 'text');
    assert.equal(classifyWhatsAppMediaType({ type: 'sticker', hasMedia: true }, undefined), 'image');
    assert.equal(classifyWhatsAppMediaType({ type: 'image', hasMedia: true }, thumb), 'image');
    assert.equal(classifyWhatsAppMediaType({ type: '', hasMedia: false }, thumb), 'image');
  });

  it('detects WEBP, PNG, GIF, JPEG from magic bytes even if mimetype is inaccurate', () => {
    const webp = Buffer.from('52494646240000005745425056503820', 'hex');
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const gif = Buffer.from('GIF89a');
    const jpg = Buffer.from('ffd8ffe000104a464946', 'hex');

    assert.deepEqual(detectImageFormatFromBuffer(webp, 'image/jpeg'), { ext: 'webp', mime: 'image/webp' });
    assert.deepEqual(detectImageFormatFromBuffer(png, 'application/octet-stream'), { ext: 'png', mime: 'image/png' });
    assert.deepEqual(detectImageFormatFromBuffer(gif, undefined), { ext: 'gif', mime: 'image/gif' });
    assert.deepEqual(detectImageFormatFromBuffer(jpg, undefined), { ext: 'jpg', mime: 'image/jpeg' });
  });

  it('distinguishes micro-thumbnails from authentic WebP stickers', () => {
    const thumbB64 = '/9j/' + 'A'.repeat(4000);
    assert.equal(
      isLikelyTinyWhatsAppThumb({
        msgType: 'image',
        buf: Buffer.from(thumbB64, 'base64'),
        ext: 'jpg',
        declaredSize: 180000,
        dataB64: thumbB64,
        rawThumbB64: thumbB64,
      }),
      true,
    );

    // Even when rawThumbB64 is absent, a 3KB non-WebP JPEG for a 150KB declared image is a thumb
    assert.equal(
      isLikelyTinyWhatsAppThumb({
        msgType: 'image',
        buf: Buffer.alloc(3200),
        ext: 'jpg',
        declaredSize: 150000,
      }),
      true,
    );

    // A 4.5KB WebP sticker MUST NOT be rejected as a thumbnail
    const webpStickerBuf = Buffer.concat([Buffer.from('524946462400000057454250', 'hex'), Buffer.alloc(4500)]);
    assert.equal(
      isLikelyTinyWhatsAppThumb({
        msgType: 'sticker',
        buf: webpStickerBuf,
        ext: 'webp',
        declaredSize: 4512,
        dataB64: webpStickerBuf.toString('base64'),
        rawThumbB64: thumbB64,
      }),
      false,
    );
  });

  it('filters JSON, paths, and placeholders from WhatsApp captions while preserving real text', () => {
    assert.equal(shouldIgnoreWhatsAppCaption('{"href":"/uploads/media/wa_123.jpg"}'), true);
    assert.equal(shouldIgnoreWhatsAppCaption('/storage/chat_files/1794207627554.png'), true);
    assert.equal(shouldIgnoreWhatsAppCaption('/uploads/media/wa_123.jpg'), true);
    assert.equal(shouldIgnoreWhatsAppCaption('https://example.com/a.jpg'), true);
    assert.equal(shouldIgnoreWhatsAppCaption('[Hình ảnh]'), true);
    assert.equal(shouldIgnoreWhatsAppCaption('[Tài liệu]'), true);
    assert.equal(shouldIgnoreWhatsAppCaption('/9j/4AAQSkZJRg'), true);
    assert.equal(shouldIgnoreWhatsAppCaption('Gửi chị mẫu tuyển dụng mới nhất ạ'), false);
  });

  it('preserves high-res /storage/ images and PDFs on WA outgoing self-echo (0aeac6b4 & 2652f83d)', () => {
    // Reproducer 1: 0aeac6b4 (poster sent from CRM, echoed back with 4.8KB thumb & JSON echo content)
    const mergedImg = mergeOutgoingSelfEcho(
      {
        zaloMsgId: '3EB0B15B9E85B74F54A7D5',
        content: JSON.stringify({
          href: '/storage/chat_files/1794207480000_poster.png',
          thumb: '/storage/chat_files/1794207480000_poster.png',
          hdUrl: '/storage/chat_files/1794207480000_poster.png',
          localUrl: '/storage/chat_files/1794207480000_poster.png',
        }),
        contentType: 'image',
        attachments: [{ type: 'image', url: '/storage/chat_files/1794207480000_poster.png' }],
      },
      {
        msgId: '3EB0B15B9E85B74F54A7D5',
        content: JSON.stringify({
          href: '/uploads/media/wa_1794207481000_F54A7D5.jpg',
          thumb: '/uploads/media/wa_1794207481000_F54A7D5.jpg',
          hdUrl: '/uploads/media/wa_1794207481000_F54A7D5.jpg',
        }),
        contentType: 'image',
        attachments: [{ type: 'image', url: '/uploads/media/wa_1794207481000_F54A7D5.jpg' }],
      },
    );

    const parsedImg = JSON.parse(mergedImg.content);
    assert.equal(parsedImg.href, '/storage/chat_files/1794207480000_poster.png');
    assert.equal(parsedImg.thumb, '/storage/chat_files/1794207480000_poster.png');
    assert.equal(parsedImg.caption, undefined);
    assert.equal(parsedImg.title, undefined);
    assert.equal(mergedImg.attachments[0].url, '/storage/chat_files/1794207480000_poster.png');

    // Reproducer 2: 2652f83d (PDF sent from CRM, echoed back as "[Tài liệu]")
    const mergedFile = mergeOutgoingSelfEcho(
      {
        zaloMsgId: '3EB07CEC00B5AC4CA58F5D',
        content: JSON.stringify({
          title: 'CATALOGUE_DONG_PHUC.pdf',
          href: '/storage/chat_files/1794207627554_CATALOGUE.pdf',
          localUrl: '/storage/chat_files/1794207627554_CATALOGUE.pdf',
          params: JSON.stringify({ fileSize: '2048000', fileExt: 'pdf' }),
        }),
        contentType: 'file',
        attachments: [{ type: 'file', url: '/storage/chat_files/1794207627554_CATALOGUE.pdf', name: 'CATALOGUE_DONG_PHUC.pdf' }],
      },
      {
        msgId: '3EB07CEC00B5AC4CA58F5D',
        content: '[Tài liệu]',
        contentType: 'file',
        attachments: [],
      },
    );

    const parsedFile = JSON.parse(mergedFile.content);
    assert.equal(mergedFile.contentType, 'file');
    assert.equal(parsedFile.href, '/storage/chat_files/1794207627554_CATALOGUE.pdf');
    assert.equal(parsedFile.title, 'CATALOGUE_DONG_PHUC.pdf');
    assert.equal(mergedFile.attachments.length, 1);
  });

  it('extractConversationAssets preserves plain /storage/ or /uploads/ images and ignores JSON captions', () => {
    const assets = extractConversationAssets([
      {
        id: 'm1',
        contentType: 'image',
        content: '/storage/chat_files/poster.png',
        senderType: 'self',
        senderName: 'Staff',
        sentAt: new Date('2026-11-09T09:52:00Z'),
      },
      {
        id: 'm2',
        contentType: 'image',
        content: JSON.stringify({
          localUrl: '/storage/chat_files/full.png',
          thumb: '/uploads/media/wa_small.jpg',
          title: '{"href":"/uploads/media/wa_small.jpg"}',
        }),
        senderType: 'self',
        senderName: 'Staff',
        sentAt: new Date('2026-11-09T09:53:00Z'),
      },
    ]);

    assert.equal(assets.images.length, 2);
    assert.equal(assets.images[0].url, '/storage/chat_files/poster.png');
    assert.equal(assets.images[1].url, '/storage/chat_files/full.png');
    assert.equal(assets.images[1].caption, null);
  });

  it('detects PDF magic bytes, spares small PDFs from thumb rejection, unwraps JSON captions, and avoids invoice/voice false positives', () => {
    const pdfBuf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(1800)]);
    assert.deepEqual(detectImageFormatFromBuffer(pdfBuf, 'application/pdf'), { ext: 'pdf', mime: 'application/pdf' });

    assert.equal(
      isLikelyTinyWhatsAppThumb({
        msgType: 'document',
        buf: pdfBuf,
        ext: 'pdf',
        declaredSize: 1809,
      }),
      false,
    );

    assert.equal(
      extractUsableCaptionFromIncoming(JSON.stringify({ href: '/uploads/a.jpg', caption: 'Bảng giá đồng phục 2026' })),
      'Bảng giá đồng phục 2026',
    );
    assert.equal(
      extractUsableCaptionFromIncoming(JSON.stringify({ href: '/uploads/a.jpg', caption: '{"href":"/uploads/a.jpg"}' })),
      '',
    );

    assert.equal(hasExplicitVoiceMarker('/storage/chat_files/invoice_2026.pdf'), false);
    assert.equal(hasExplicitVoiceMarker('/storage/chat_files/invoice.png'), false);
    assert.equal(hasExplicitVoiceMarker('/uploads/media/voice_1794298000.ogg'), true);

    const assets = extractConversationAssets([
      {
        id: 'inv-pdf',
        contentType: 'file',
        content: JSON.stringify({
          title: 'invoice_2026.pdf',
          localUrl: '/storage/chat_files/invoice_2026.pdf',
          href: '/storage/chat_files/invoice_2026.pdf',
        }),
        senderType: 'self',
        senderName: 'Staff',
        sentAt: new Date('2026-11-10T01:00:00Z'),
      },
      {
        id: 'inv-png',
        contentType: 'image',
        content: '/storage/chat_files/invoice.png',
        senderType: 'self',
        senderName: 'Staff',
        sentAt: new Date('2026-11-10T01:01:00Z'),
      },
    ]);
    assert.equal(assets.files.length, 1);
    assert.equal(assets.files[0].id, 'inv-pdf');
    assert.equal(assets.images.length, 1);
    assert.equal(assets.images[0].id, 'inv-png');

    const groupCands = buildCandidateSerializedIds('3A819CC5', '12036312345@g.us', false, '84909998888@s.whatsapp.net');
    assert.ok(groupCands.includes('false_12036312345@g.us_3A819CC5_84909998888@c.us'));
  });
});
