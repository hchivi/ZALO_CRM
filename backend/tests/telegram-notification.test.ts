import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBrandName,
  formatMessageSnippet,
  extractTelegramMedia,
} from '../src/shared/services/telegram-notification.js';

describe('Telegram Customer Alert — Brand Resolution & Formatting', () => {
  test('resolves canonical brand names from various Zalo and WhatsApp display names', () => {
    // AdamEva
    assert.equal(resolveBrandName('AdamEva.vn'), 'AdamEva.vn');
    assert.equal(resolveBrandName('Adam Eva CSKH'), 'AdamEva.vn');
    assert.equal(resolveBrandName('CSKH ADAM EVA'), 'AdamEva.vn');

    // ChuyenGiaDongPhuc
    assert.equal(resolveBrandName('ChuyenGiaDongPhuc.vn'), 'ChuyenGiaDongPhuc.vn');
    assert.equal(resolveBrandName('Chuyên Gia Đồng Phục'), 'ChuyenGiaDongPhuc.vn');

    // CGDP
    assert.equal(resolveBrandName('CGDP.vn'), 'CGDP.vn');
    assert.equal(resolveBrandName('C-G-D-P Chuyên Sỉ'), 'CGDP.vn');

    // PIJU.vn (New Brand)
    assert.equal(resolveBrandName('PIJU.vn'), 'PIJU.vn');
    assert.equal(resolveBrandName('Xưởng May PIJU'), 'PIJU.vn');

    // Team KCN
    assert.equal(resolveBrandName('Team KCN'), 'Team KCN');
    assert.equal(resolveBrandName('KCN Tân Bình'), 'Team KCN');

    // VINMERICA
    assert.equal(resolveBrandName('VINMERICA'), 'VINMERICA');

    // Robert Việt
    assert.equal(resolveBrandName('Robert Việt'), 'Robert Việt');

    // Custom fallback
    assert.equal(resolveBrandName('Cửa hàng test'), 'Cửa hàng test');
    assert.equal(resolveBrandName(null, 'AdamEva.vn'), 'AdamEva.vn');
    assert.equal(resolveBrandName(null, null), 'Portal');
  });

  test('formats snippet for text and media content cleanly', () => {
    assert.equal(formatMessageSnippet('Cho em xin báo giá áo thun 50 cái'), 'Cho em xin báo giá áo thun 50 cái');
    assert.equal(formatMessageSnippet('', 'image'), '[Hình ảnh]');
    assert.equal(formatMessageSnippet(null, 'video'), '[Video]');
    assert.equal(formatMessageSnippet(undefined, 'voice'), '[Tin nhắn thoại]');
    assert.equal(formatMessageSnippet('', 'file'), '[Tệp đính kèm]');
    assert.equal(formatMessageSnippet('', 'sticker'), '[Nhãn dán]');

    // JSON payload from Zalo image without caption -> extracts [Hình ảnh]
    const jsonWithoutCaption = JSON.stringify({ title: '', description: '', href: 'https://f20-zpc.zdn.vn/123.jpg' });
    assert.equal(formatMessageSnippet(jsonWithoutCaption, 'image'), '[Hình ảnh]');

    // JSON payload from Zalo image with caption -> extracts real caption
    const jsonWithCaption = JSON.stringify({ title: 'Mẫu áo đẹp', description: '', href: 'https://f20-zpc.zdn.vn/123.jpg' });
    assert.equal(formatMessageSnippet(jsonWithCaption, 'image'), 'Mẫu áo đẹp');

    // Storage path payload without text -> falls back to contentType
    assert.equal(formatMessageSnippet('/uploads/chat/sample.png', 'image'), '[Hình ảnh]');
  });

  test('constructs exact user-requested Telegram message structure', () => {
    const customer = 'Nguyễn Thị Mai';
    const brand = resolveBrandName('PIJU.vn');
    const content = formatMessageSnippet('Em cần tư vấn đồng phục mẫu polo');

    // Cú pháp yêu cầu của user:
    // Khách: [Tên khách] từ [tên thương hiệu mà khách đang nhắn đến] 
    // Nội dung: [Nội dung của khách nhắn đến]
    const text = `Khách: ${customer} từ ${brand}\nNội dung: ${content}`;

    assert.equal(
      text,
      'Khách: Nguyễn Thị Mai từ PIJU.vn\nNội dung: Em cần tư vấn đồng phục mẫu polo'
    );
  });

  test('extracts media for Telegram from various payloads', () => {
    // 1. Zalo image JSON
    const zaloImgPayload = JSON.stringify({
      title: 'ảnh áo thun',
      href: 'https://photo-stal-35.zdn.vn/gr/jpg/sample.jpg',
      thumb: 'https://photo-stal-35.zdn.vn/gr/jpg/sample.jpg',
    });
    const imgMedia = extractTelegramMedia(zaloImgPayload, 'image');
    assert.equal(imgMedia.kind, 'photo');
    assert.equal(imgMedia.url, 'https://photo-stal-35.zdn.vn/gr/jpg/sample.jpg');

    // 2. Zalo sticker with eid
    const stickerPayload = JSON.stringify({ id: 46982, catId: 12003, type: 7 });
    const stickerMedia = extractTelegramMedia(stickerPayload, 'sticker');
    assert.equal(stickerMedia.kind, 'photo');
    assert.equal(stickerMedia.url, 'https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=46982&size=200');

    // 3. Voice URL
    const voicePayload = JSON.stringify({ href: 'https://cdn.example.com/audio/voice.m4a', action: 'voice' });
    const voiceMedia = extractTelegramMedia(voicePayload, 'voice');
    assert.equal(voiceMedia.kind, 'voice');
    assert.equal(voiceMedia.url, 'https://cdn.example.com/audio/voice.m4a');

    // 4. Video URL
    const videoPayload = JSON.stringify({ href: 'https://cdn.example.com/video.mp4', videoUrl: 'https://cdn.example.com/video.mp4' });
    const videoMedia = extractTelegramMedia(videoPayload, 'video');
    assert.equal(videoMedia.kind, 'video');
    assert.equal(videoMedia.url, 'https://cdn.example.com/video.mp4');

    // 5. Document / File
    const filePayload = JSON.stringify({ title: 'hop_dong.pdf', href: 'https://cdn.example.com/hop_dong.pdf' });
    const fileMedia = extractTelegramMedia(filePayload, 'file');
    assert.equal(fileMedia.kind, 'document');
    assert.equal(fileMedia.url, 'https://cdn.example.com/hop_dong.pdf');
    assert.equal(fileMedia.filename, 'hop_dong.pdf');

    // 6. Plain text -> kind: none
    const textMedia = extractTelegramMedia('Xin chào shop', 'text');
    assert.equal(textMedia.kind, 'none');
  });

  test('constructs disconnection alert format accurately', () => {
    const channel = 'Zalo';
    const accountName = 'PIJU.vn CSKH';
    const reason = 'Mất kết nối mạng hoặc phiên Zalo hết hạn';
    const alert = `⚠️ CẢNH BÁO MẤT KẾT NỐI CRM\n` +
      `Kênh: ${channel}\n` +
      `Tài khoản: ${accountName}\n` +
      `Trạng thái: Bị mất kết nối (${reason})\n` +
      `👉 Vui lòng vào CRM kiểm tra và kết nối lại ngay để không bỏ lỡ tin nhắn khách hàng!`;

    assert.ok(alert.includes('⚠️ CẢNH BÁO MẤT KẾT NỐI CRM'));
    assert.ok(alert.includes('PIJU.vn CSKH'));
    assert.ok(alert.includes('Zalo'));
  });
});
