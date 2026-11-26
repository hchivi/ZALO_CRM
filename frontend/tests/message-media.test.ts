import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getImageUrl,
  getImageFullUrl,
  getStickerUrl,
  getVideoInfo,
  getVoiceInfo,
  getFileInfo,
  getImageCaption,
  isValidMediaUrl,
  isEmptyMediaJson,
} from '../src/modules/zalocrm/utils/message-media.ts';

describe('CRM Message Media & CSS Display Contracts', () => {
  it('resolves /storage/chat_files/ image URLs for both plain and JSON image messages', () => {
    assert.equal(
      getImageUrl({
        id: 'm1',
        contentType: 'image',
        content: '/storage/chat_files/1794207480000_poster.png',
      }),
      '/storage/chat_files/1794207480000_poster.png',
    );

    assert.equal(
      getImageFullUrl({
        id: 'm2',
        contentType: 'image',
        content: JSON.stringify({
          href: '/storage/chat_files/1794207480000_poster.png',
          localUrl: '/storage/chat_files/1794207480000_poster.png',
        }),
      }),
      '/storage/chat_files/1794207480000_poster.png',
    );
  });

  it('prefers full-resolution localUrl / href / hdUrl over corrupted 4.8KB thumb (repro 0aeac6b4)', () => {
    const msg = {
      id: '0aeac6b4',
      contentType: 'image',
      content: JSON.stringify({
        href: '/storage/chat_files/1794207480000_poster.png',
        localUrl: '/storage/chat_files/1794207480000_poster.png',
        hdUrl: '/storage/chat_files/1794207480000_poster.png',
        thumb: '/uploads/media/wa_1794207481000_F54A7D5.jpg',
        title: '{"href":"/uploads/media/wa_1794207481000_F54A7D5.jpg"}',
      }),
    };

    assert.equal(getImageUrl(msg), '/storage/chat_files/1794207480000_poster.png');
    assert.equal(getImageFullUrl(msg), '/storage/chat_files/1794207480000_poster.png');
    assert.equal(getImageCaption(msg), null);
  });

  it('routes WhatsApp WebP stickers through full-size Image UI (not 130x130 sticker UI) while keeping Zalo CDN stickers intact', () => {
    const waStickerAsStickerType = {
      id: 'wa-s1',
      contentType: 'sticker',
      content: JSON.stringify({ url: '/uploads/media/wa_sticker_1794298000_s1.webp', href: '/uploads/media/wa_sticker_1794298000_s1.webp' }),
      attachments: [{ id: 'wa-att-1', type: 'sticker', url: '/uploads/media/wa_sticker_1794298000_s1.webp' }],
    };
    assert.equal(getStickerUrl(waStickerAsStickerType), null);
    assert.equal(getImageUrl(waStickerAsStickerType), '/uploads/media/wa_sticker_1794298000_s1.webp');

    const waStickerViaProxy = {
      id: 'wa-s2',
      contentType: 'sticker',
      content: JSON.stringify({ url: '/api/zalo-assets/media/wa_1794298000_s2.webp' }),
      attachments: [{ url: '/api/zalo-assets/media/wa_1794298000_s2.webp' }],
    };
    assert.equal(getStickerUrl(waStickerViaProxy), null);
    assert.equal(getImageUrl(waStickerViaProxy), '/api/zalo-assets/media/wa_1794298000_s2.webp');

    const zaloCdnSticker = {
      id: 'z-s1',
      contentType: 'sticker',
      content: JSON.stringify({ id: 21456, catId: 10302, type: 7 }),
    };
    assert.equal(getStickerUrl(zaloCdnSticker), 'https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=21456&size=200');
    assert.equal(getImageUrl(zaloCdnSticker), null);
  });

  it('resolves /storage/ videos and ignores bogus [Hình ảnh] placeholder fallback via message-file endpoint', () => {
    const vid = getVideoInfo({
      id: 'v1',
      contentType: 'video',
      content: '/storage/chat_files/1794200000_clip.mp4',
    });
    assert.ok(vid);
    assert.equal(vid.url, '/storage/chat_files/1794200000_clip.mp4');

    assert.equal(
      getImageUrl({ id: 'broken-img-1', contentType: 'image', content: '[Hình ảnh]' }),
      '/api/zalo/files/message-file/broken-img-1?mode=view',
    );
  });

  it('ignores placeholder captions and never treats zalo_meta or javascript: URLs as images', () => {
    assert.equal(
      getImageCaption({
        contentType: 'image',
        content: JSON.stringify({ href: '/uploads/media/a.jpg', title: '[Hình ảnh]', caption: '[Hình ảnh]' }),
      }),
      null,
    );
    assert.equal(
      getImageUrl({
        contentType: 'text',
        content: 'hello',
        attachments: [{ type: 'zalo_meta', url: 'https://malicious.invalid/not-image', cliMsgId: '123' }],
      }),
      null,
    );
    assert.equal(
      getImageUrl({
        contentType: 'image',
        content: 'javascript:alert(1)',
      }),
      null,
    );
  });

  it('enforces transparent borderless image bubble overrides across main.css, premium.css, and MessageThread.css', () => {
    const assetsDir = path.resolve(import.meta.dirname, '../src/modules/zalocrm/assets');
    const chatDir = path.resolve(import.meta.dirname, '../src/modules/zalocrm/components/chat');
    const mainCss = fs.readFileSync(path.join(assetsDir, 'main.css'), 'utf8');
    const premiumCss = fs.readFileSync(path.join(assetsDir, 'premium.css'), 'utf8');
    const threadCss = fs.readFileSync(path.join(chatDir, 'MessageThread.css'), 'utf8');

    assert.match(mainCss, /\.customer-bubble\.image-bubble/);
    assert.match(mainCss, /\.staff-bubble\.image-bubble/);
    assert.match(mainCss, /\.v-theme--forestTheme/);
    assert.match(premiumCss, /\.customer-bubble\.image-bubble/);
    assert.match(premiumCss, /\.staff-bubble\.image-bubble/);
    assert.match(threadCss, /\.staff-bubble:not\(\.image-bubble\)/);
    assert.match(threadCss, /min-width:\s*min\(240px,\s*100%\)/);
  });

  it('blocks unsafe data URIs, preserves structured non-image cards, and avoids invoice-to-voice or WA sticker bugs', () => {
    assert.equal(isValidMediaUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isValidMediaUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
    assert.equal(isValidMediaUrl('data:image/webp;base64,UklGRkYAAABXRUJQ'), true);
    assert.equal(getImageUrl({ contentType: 'image', content: 'data:text/html,<svg onload=alert(1)>' }), null);

    assert.equal(isEmptyMediaJson({ contentType: 'voice', content: JSON.stringify({ voiceUrl: '/uploads/a.ogg' }) }), false);
    assert.equal(isEmptyMediaJson({ contentType: 'call', content: JSON.stringify({ call: { title: 'Cuộc gọi' } }) }), false);
    assert.equal(isEmptyMediaJson({ contentType: 'bank_card', content: JSON.stringify({ bankName: 'VCB' }) }), false);
    assert.equal(isEmptyMediaJson({ contentType: 'reminder', content: JSON.stringify({ title: 'Gọi lại' }) }), false);

    const invoicePdf = {
      id: 'inv-1',
      contentType: 'file',
      content: JSON.stringify({
        title: 'invoice_2026.pdf',
        localUrl: '/storage/chat_files/invoice_2026.pdf',
        params: { fileSize: '1.4 MB', fileExt: 'pdf' },
      }),
    };
    assert.equal(getVoiceInfo(invoicePdf), null);
    const parsedFile = getFileInfo(invoicePdf);
    assert.ok(parsedFile);
    assert.equal(parsedFile.size, '1.4 MB');
    assert.equal(parsedFile.ext, 'pdf');

    assert.equal(
      getVoiceInfo({ id: 'inv-img', contentType: 'image', content: '/storage/chat_files/invoice.png' }),
      null,
    );
    assert.equal(
      getFileInfo({ id: 'v-msg', contentType: 'voice', content: '/uploads/media/voice_record_1.m4a' }),
      null,
    );

    const waStickerMeta = {
      id: 'wa-meta-sticker',
      contentType: 'sticker',
      content: 'data:image/webp;base64,UklGRkYAAABXRUJQ',
      metadata: { channel: 'whatsapp', whatsappType: 'sticker' },
    };
    assert.equal(getStickerUrl(waStickerMeta), null);
    assert.equal(getImageUrl(waStickerMeta), 'data:image/webp;base64,UklGRkYAAABXRUJQ');
  });
});
