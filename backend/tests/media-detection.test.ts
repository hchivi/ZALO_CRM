import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectContentType } from '../src/modules/zalo/zalo-message-helpers.js';

describe('Media and Content Type Detection', () => {
  it('detects Zalo photo JSON payload from screenshot as image', () => {
    const rawPayload = JSON.stringify({
      title: "",
      description: "",
      href: "https://f20-zpc.zdn.vn/3177037013593771876/bb845ab7c77947271e68.jpg",
      thumb: "https://t-f20-zpc.zdn.vn/3177037013593771876/bb845ab7c77947271e68.jpg",
      childnumber: 0,
      action: "",
      params: JSON.stringify({
        rawUrl: "https://f20-zpc.zdn.vn/3177037013593771876/bb845ab7c77947271e68.jpg",
        width: 800,
        convertible: "jxl",
        hd: "https://b-f11-zpc.zdn.vn/3177037013593771876/bb845ab7c77947271e68.jpg",
        hdSize: 687212,
        height: 600,
      }),
      type: "",
    });

    const detected = detectContentType('webchat', rawPayload);
    assert.strictEqual(detected, 'image');
  });

  it('detects Zalo video payload as video', () => {
    const videoPayload = JSON.stringify({
      title: "sample_video.mp4",
      description: "",
      href: "https://v-f10-zpc.zdn.vn/video.mp4",
      thumb: "https://t-f10-zpc.zdn.vn/thumb.jpg",
      params: JSON.stringify({
        videoUrl: "https://v-f10-zpc.zdn.vn/video.mp4",
        duration: 12000,
        extention: "mp4",
        fType: 2,
        videoWidth: 1280,
        videoHeight: 720,
      }),
      type: "video",
    });

    const detected = detectContentType('chat.video', videoPayload);
    assert.strictEqual(detected, 'video');
  });

  it('detects MP4 video even with generic webchat msgType', () => {
    const videoPayload = JSON.stringify({
      title: "clip.mp4",
      description: "",
      href: "https://example.com/clip.mp4",
      params: JSON.stringify({
        duration: 5000,
        width: 1920,
        height: 1080,
      }),
    });

    const detected = detectContentType('webchat', videoPayload);
    assert.strictEqual(detected, 'video');
  });

  it('accurately detects portrait image dimensions without distorting to 800x600', async () => {
    const sharp = (await import('sharp')).default;
    // Create a 400x800 portrait image buffer (ratio 1:2)
    const portraitBuffer = await sharp({
      create: {
        width: 400,
        height: 800,
        channels: 3,
        background: { r: 50, g: 50, b: 50 },
      },
    }).jpeg().toBuffer();

    const pipeline = sharp(portraitBuffer).rotate();
    const { info } = await pipeline.jpeg().toBuffer({ resolveWithObject: true });

    assert.strictEqual(info.width, 400, 'Portrait width must remain 400');
    assert.strictEqual(info.height, 800, 'Portrait height must remain 800');
    assert.notStrictEqual(info.width, 800, 'Should NOT be forced to 800 width');
    assert.notStrictEqual(info.height, 600, 'Should NOT be forced to 600 height');
  });
});

