import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTone,
  normalizeTargetLanguage,
  inferLanguageFromContext,
  formatMessageContentForContext,
  extractChatContextFromMessages,
  buildChatAiDraftPrompts,
  buildChatAiSuggestPrompts,
  extractJsonObject,
  buildFallbackDraft,
  buildFallbackSuggestions,
  getToneTemperature,
} from '../src/modules/chat/chat-ai-helpers.js';

describe('Chat AI Helpers — Tone Differentiation, Context & Vietnamese Support', () => {
  it('normalizes tones and target languages cleanly', () => {
    assert.equal(normalizeTone('FRIENDLY'), 'friendly');
    assert.equal(normalizeTone('concise'), 'concise');
    assert.equal(normalizeTone('negotiation'), 'negotiation');
    assert.equal(normalizeTone('unknown-tone'), 'professional');

    assert.equal(normalizeTargetLanguage('auto'), 'auto');
    assert.equal(normalizeTargetLanguage('Vietnamese'), 'vi');
    assert.equal(normalizeTargetLanguage('vi'), 'vi');
    assert.equal(normalizeTargetLanguage('ZH'), 'zh-CN');
    assert.equal(normalizeTargetLanguage(''), 'en');
  });

  it('infers customer language from customer utterances while ignoring Vietnamese metadata/agent headers', () => {
    const enConversation = [
      '[Kênh: whatsapp | Khách: John Smith]',
      'Bot AI: Dạ xin chào quý khách!',
      'Nhân viên: Chào anh John, bên em hỗ trợ ngay.',
      'John Smith: Hello, we need 500 pcs wholesale polo shirts by next Friday. What is the unit price?',
    ].join('\n');

    assert.equal(inferLanguageFromContext('', enConversation, 'Giá 120k/áo'), 'en');

    const zhConversation = [
      '[Kênh: zalo | Khách: Lin Wei]',
      'Nhân viên: Dạ em gửi bảng giá nhé',
      'Lin Wei: 你好，请问这批货的交货期是几天？',
    ].join('\n');
    assert.equal(inferLanguageFromContext('', zhConversation, ''), 'zh-CN');

    const viConversation = [
      '[Kênh: zalo | Khách: Phạm Thị Nga]',
      'Phạm Thị Nga: Em ơi báo giá giúp chị 200 áo đồng phục công ty vải cá sấu nhé',
    ].join('\n');
    assert.equal(inferLanguageFromContext('', viConversation, ''), 'vi');

    const frConversation = 'Claire: Bonjour, avez-vous un devis pour 50 chemises ?';
    assert.equal(inferLanguageFromContext('', frConversation, ''), 'fr');

    const esConversation = 'Carlos: Hola, gracias por la cotización de camisetas.';
    assert.equal(inferLanguageFromContext('', esConversation, ''), 'es');
  });

  it('extracts readable chat context from media JSON payloads and paths', () => {
    const formatted = extractChatContextFromMessages(
      [
        {
          senderType: 'customer',
          senderName: 'David Lee',
          contentType: 'image',
          content: JSON.stringify({ url: '/uploads/a.jpg', caption: 'Mẫu áo polo xanh navy' }),
        },
        {
          senderType: 'customer',
          senderName: 'David Lee',
          content: JSON.stringify({ videoUrl: 'https://cdn.example.com/demo.mp4' }),
        },
        {
          senderType: 'customer',
          contentType: 'file',
          content: JSON.stringify({ fileName: 'bang-size-2026.pdf' }),
        },
        {
          senderType: 'self',
          contentType: 'text',
          content: 'Bên em đã nhận được file mẫu ạ.',
        },
      ],
      { contactName: 'David Lee', channel: 'zalo' },
    );

    assert.match(formatted, /\[Kênh: zalo \| Khách: David Lee\]/);
    assert.match(formatted, /David Lee: \[Hình ảnh: Mẫu áo polo xanh navy\]/);
    assert.match(formatted, /David Lee: \[Video\]/);
    assert.match(formatted, /David Lee: \[Tệp: bang-size-2026\.pdf\]/);
    assert.match(formatted, /Nhân viên: Bên em đã nhận được file mẫu ạ\./);
    assert.doesNotMatch(formatted, /bang-size-2026\.pdf"\}/);
    assert.doesNotMatch(formatted, /demo\.mp4/);
  });

  it('parses fenced and inline JSON objects resiliently', () => {
    assert.deepEqual(extractJsonObject('```json\n{"draft":"Hello","reply_language":"en"}\n```'), {
      draft: 'Hello',
      reply_language: 'en',
    });
    assert.deepEqual(extractJsonObject('Here is output:\n{"stage":"Báo giá","suggestions":[]}\nDone.'), {
      stage: 'Báo giá',
      suggestions: [],
    });
    assert.equal(extractJsonObject('not valid json'), null);
  });

  it('produces distinct temperatures and prompt constraints across all 4 tones', () => {
    const temps = [
      getToneTemperature('concise'),
      getToneTemperature('professional'),
      getToneTemperature('negotiation'),
      getToneTemperature('friendly'),
    ];
    assert.equal(new Set(temps).size, 4, 'Each tone must have a distinct temperature');

    const proPrompt = buildChatAiDraftPrompts({
      finalChat: 'Phạm Thị Nga: Chị cần báo giá 100 áo sơ mi',
      finalSelected: '',
      finalNotes: 'Giá 250k/áo, giao 10 ngày',
      tone: 'professional',
      targetLanguage: 'vi',
      contactName: 'Phạm Thị Nga',
    });
    assert.equal(proPrompt.effectiveLanguage, 'vi');
    assert.match(proPrompt.systemPrompt, /CHUYÊN NGHIỆP B2B/);
    assert.match(proPrompt.systemPrompt, /"back_translation_vi": ""/);

    const friendlyPrompt = buildChatAiDraftPrompts({
      finalChat: 'Phạm Thị Nga: Chị cần báo giá 100 áo sơ mi',
      finalSelected: '',
      finalNotes: 'Giá 250k/áo, giao 10 ngày',
      tone: 'friendly',
      targetLanguage: 'vi',
      contactName: 'Phạm Thị Nga',
    });
    assert.match(friendlyPrompt.systemPrompt, /THÂN THIỆN, CỞI MỞ/);
    assert.match(friendlyPrompt.systemPrompt, /KHÔNG dùng "Kính gửi"/);

    const concisePrompt = buildChatAiDraftPrompts({
      finalChat: 'John: Price for 100 shirts?',
      finalSelected: '',
      finalNotes: 'Giá $12/áo, giao 10 ngày',
      tone: 'concise',
      targetLanguage: 'auto',
      contactName: 'John',
    });
    assert.equal(concisePrompt.effectiveLanguage, 'en');
    assert.match(concisePrompt.systemPrompt, /NO GREETINGS/);

    const negotiationPrompt = buildChatAiSuggestPrompts({
      conversationChat: 'Buyer: Can you discount 15% if we order 50 pcs?',
      tone: 'negotiation',
      targetLanguage: 'auto',
      contactName: 'Alex',
    });
    assert.equal(negotiationPrompt.effectiveLanguage, 'en');
    assert.match(negotiationPrompt.systemPrompt, /GIVE-GET/);
  });

  it('generates unmistakably differentiated fallback drafts across all 4 tones in Vietnamese and English', () => {
    const notes = 'Đơn giá 185.000đ/áo cotton 100%\nHỗ trợ thêu logo ngực trái';
    const chatVi = 'Phạm Thị Nga: Chị cần may 120 áo thun sự kiện tuần tới';

    const proVi = buildFallbackDraft({
      tone: 'professional',
      targetLanguage: 'vi',
      finalNotes: notes,
      finalChat: chatVi,
      contactName: 'Phạm Thị Nga',
    });
    const friendlyVi = buildFallbackDraft({
      tone: 'friendly',
      targetLanguage: 'vi',
      finalNotes: notes,
      finalChat: chatVi,
      contactName: 'Phạm Thị Nga',
    });
    const conciseVi = buildFallbackDraft({
      tone: 'concise',
      targetLanguage: 'vi',
      finalNotes: notes,
      finalChat: chatVi,
      contactName: 'Phạm Thị Nga',
    });
    const negVi = buildFallbackDraft({
      tone: 'negotiation',
      targetLanguage: 'vi',
      finalNotes: notes,
      finalChat: chatVi,
      contactName: 'Phạm Thị Nga',
    });

    assert.equal(new Set([proVi.draft, friendlyVi.draft, conciseVi.draft, negVi.draft]).size, 4);
    assert.equal(proVi.back_translation_vi, '');
    assert.equal(friendlyVi.back_translation_vi, '');
    assert.equal(conciseVi.back_translation_vi, '');
    assert.equal(negVi.back_translation_vi, '');

    assert.match(proVi.draft, /Kính gửi anh\/chị Phạm Thị Nga/);
    assert.match(proVi.draft, /Trân trọng,/);
    assert.match(friendlyVi.draft, /Dạ chào anh\/chị Phạm Thị Nga nhé/);
    assert.doesNotMatch(friendlyVi.draft, /Kính gửi|Trân trọng/);
    assert.doesNotMatch(conciseVi.draft, /Kính gửi|Dạ chào|Trân trọng/);
    assert.ok(conciseVi.draft.length < proVi.draft.length);
    assert.match(negVi.draft, /tiêu chuẩn chất lượng|chốt sớm/i);
    assert.match(proVi.customer_summary_vi, /120 áo thun sự kiện/);

    const chatEn = 'Mark: We want 200pcs polo uniform with custom collar.';
    const proEn = buildFallbackDraft({ tone: 'professional', targetLanguage: 'en', finalNotes: notes, finalChat: chatEn, contactName: 'Mark' });
    const friendlyEn = buildFallbackDraft({ tone: 'friendly', targetLanguage: 'en', finalNotes: notes, finalChat: chatEn, contactName: 'Mark' });
    const conciseEn = buildFallbackDraft({ tone: 'concise', targetLanguage: 'en', finalNotes: notes, finalChat: chatEn, contactName: 'Mark' });
    const negEn = buildFallbackDraft({ tone: 'negotiation', targetLanguage: 'en', finalNotes: notes, finalChat: chatEn, contactName: 'Mark' });

    assert.equal(new Set([proEn.draft, friendlyEn.draft, conciseEn.draft, negEn.draft]).size, 4);
    assert.match(proEn.draft, /Dear Mark/);
    assert.match(proEn.draft, /Best regards,/);
    assert.match(friendlyEn.draft, /Hi Mark!/);
    assert.doesNotMatch(friendlyEn.draft, /Dear Mark|Best regards/);
    assert.doesNotMatch(conciseEn.draft, /Dear |Hi |Best regards/);
    assert.match(negEn.draft, /production quality standards|flexible arrangement/i);
    assert.ok(proEn.back_translation_vi.length > 0);
  });

  it('builds tone-specific fallback suggestions grounded in conversation language & topic', () => {
    const sProVi = buildFallbackSuggestions({
      tone: 'professional',
      targetLanguage: 'vi',
      conversationChat: 'Nguyễn Lan: Em tư vấn áo vest nữ công sở nhé',
      contactName: 'Nguyễn Lan',
    });
    const sNegVi = buildFallbackSuggestions({
      tone: 'negotiation',
      targetLanguage: 'vi',
      conversationChat: 'Nguyễn Lan: Em tư vấn áo vest nữ công sở nhé',
      contactName: 'Nguyễn Lan',
    });

    assert.equal(sProVi.suggestions.length, 3);
    assert.equal(sNegVi.suggestions.length, 3);
    assert.notEqual(sProVi.suggestions[0].draft, sNegVi.suggestions[0].draft);
    assert.match(sProVi.suggestions[0].draft, /áo vest nữ công sở/);
    assert.equal(sProVi.suggestions[0].back_translation_vi, '');
  });
});

