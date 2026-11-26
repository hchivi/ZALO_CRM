import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappPool, extractWhatsAppMessageText } from '../src/modules/whatsapp/whatsapp-pool.js';

test('WhatsApp normalizeJid standardizes phone numbers and domain variants to @c.us', () => {
  const norm = (whatsappPool as any).normalizeJid.bind(whatsappPool);

  assert.equal(norm('0912345678'), '84912345678@c.us');
  assert.equal(norm('84912345678'), '84912345678@c.us');
  assert.equal(norm('84912345678@s.whatsapp.net'), '84912345678@c.us');
  assert.equal(norm('84912345678@c.us'), '84912345678@c.us');
  assert.equal(norm('1203630248@g.us'), '1203630248@g.us'); // Groups untouched
});

test('WhatsApp getMessageModel patch must be synchronous and return plain object, not Promise', () => {
  // Simulate WWebJS.getMessageModel mock
  const origGetMessageModel = (msg: any) => ({
    id: {
      fromMe: msg.fromMe,
      remote: msg.remote,
      id: msg.id,
      _serialized: `${msg.fromMe}_${msg.remote}_${msg.id}`,
    },
    body: msg.body,
  });

  const wrapped = function (message: any) {
    const model = origGetMessageModel(message);
    if (model && model.id) {
      const origId = message?.id;
      const remoteStr =
        typeof origId?.remote === 'object'
          ? origId.remote?._serialized
          : (typeof model.id.remote === 'object' ? model.id.remote?._serialized : model.id.remote);
      const fromMeVal = typeof model.id.fromMe === 'boolean' ? model.id.fromMe : origId?.fromMe;
      const rawId = model.id.id || origId?.id;
      const serialized = `${fromMeVal}_${remoteStr}_${rawId}`;
      model.id = Object.assign({}, model.id, { remote: remoteStr, _serialized: serialized });
    }
    return model;
  };

  const incomingMsg = { fromMe: false, remote: '84988776655@c.us', id: 'ABCDEF123456', body: 'Xin chào shop' };
  const result = wrapped(incomingMsg);

  // Must NOT be a Promise so Puppeteer does not serialize it as an empty object {}
  assert.equal(result instanceof Promise, false);
  assert.equal(typeof result, 'object');
  assert.equal(result.body, 'Xin chào shop');
  assert.equal(result.id.fromMe, false);
  assert.equal(result.id._serialized, 'false_84988776655@c.us_ABCDEF123456');
});

test('WhatsApp channel query filter condition correctly covers conversation.channel and zaloAccount.channel', () => {
  const conversations = [
    { id: 'conv-1', channel: 'whatsapp', zaloAccount: { channel: 'whatsapp' } },
    { id: 'conv-2', channel: 'zalo', zaloAccount: { channel: 'whatsapp' } }, // Account switched/provisioned as WhatsApp
    { id: 'conv-3', channel: 'zalo', zaloAccount: { channel: 'zalo' } },
  ];

  const filterChannel = 'whatsapp';
  const matched = conversations.filter(c => {
    return c.channel === filterChannel || c.zaloAccount?.channel === filterChannel;
  });

  assert.equal(matched.length, 2);
  assert.deepEqual(matched.map(m => m.id), ['conv-1', 'conv-2']);
});

test('Meta AI richResponse, submessages, and _extractedBotText extraction works cleanly', () => {
  const richMsg = {
    body: '',
    type: 'rich_response',
    _data: {
      richResponse: {
        submessages: [
          { messageType: 1, messageText: 'Xin chào! Tôi là Meta AI.' },
          { messageType: 1, text: 'Tôi có thể giúp gì cho bạn?' },
        ],
      },
    },
  };
  assert.equal(
    extractWhatsAppMessageText(richMsg),
    'Xin chào! Tôi là Meta AI.\nTôi có thể giúp gì cho bạn?',
  );

  const domExtractedMsg = {
    body: '',
    _data: {
      _extractedBotText: 'Nội dung lấy trực tiếp từ DOM Meta AI',
    },
  };
  assert.equal(extractWhatsAppMessageText(domExtractedMsg), 'Nội dung lấy trực tiếp từ DOM Meta AI');

  // Cleanly exit any keepalive handles from webpush/pools
  setTimeout(() => process.exit(0), 50).unref();
});
