/**
 * chat-ai-helpers.ts — Shared prompt engineering, context extraction,
 * tone differentiation, and resilient fallback helpers for Chat AI.
 */

export type ChatAiTone = 'professional' | 'friendly' | 'concise' | 'negotiation';

export const VALID_CHAT_AI_TONES: readonly ChatAiTone[] = [
  'professional',
  'friendly',
  'concise',
  'negotiation',
] as const;

export const LANG_NAME_MAP: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  es: 'Spanish',
};

export interface ChatContextMessageLike {
  senderType?: string | null;
  sender_type?: string | null;
  senderName?: string | null;
  fromMe?: boolean | null;
  content?: string | null;
  text?: string | null;
  contentType?: string | null;
}

export function normalizeTone(raw?: unknown): ChatAiTone {
  const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (val === 'friendly' || val === 'concise' || val === 'negotiation' || val === 'professional') {
    return val;
  }
  return 'professional';
}

export function normalizeTargetLanguage(raw?: unknown): string {
  const val = typeof raw === 'string' ? raw.trim() : '';
  if (!val) return 'en';
  if (val === 'auto') return 'auto';
  if (val in LANG_NAME_MAP) return val;
  const lower = val.toLowerCase();
  if (lower === 'vi' || lower === 'vietnamese') return 'vi';
  if (lower === 'en' || lower === 'english') return 'en';
  if (lower === 'zh-cn' || lower === 'zh') return 'zh-CN';
  if (lower === 'zh-tw') return 'zh-TW';
  if (lower === 'ja' || lower === 'jp') return 'ja';
  if (lower === 'ko' || lower === 'kr') return 'ko';
  if (lower === 'fr') return 'fr';
  if (lower === 'es') return 'es';
  return val;
}

const VI_UNIQUE_DIACRITIC_RE =
  /[ăằắẳẵặầấẩẫậđềếểễệồốổỗộơờớởỡợưừứửữựạảãẹẻẽịỉĩọỏõụủũỳỵỷỹ]/i;
const VI_DIACRITIC_RE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const VI_WORD_RE =
  /\b(anh|chị|em|bên|giá|áo|mẫu|không|nhé|ạ|gửi|cho|với|cần|muốn|tư vấn|báo giá|đồng phục|số lượng|chào|vâng|dạ|của|này|lấy|xem)\b/i;

export function inferLanguageFromText(text: string): string {
  const clean = (text || '').trim();
  if (!clean) return 'en';
  if (VI_UNIQUE_DIACRITIC_RE.test(clean) || VI_WORD_RE.test(clean)) return 'vi';
  if (/[\u3040-\u30ff]/.test(clean)) return 'ja';
  if (/[\uac00-\ud7af]/.test(clean)) return 'ko';
  if (/[\u4e00-\u9fff]/.test(clean)) return 'zh-CN';
  if (/[ñ¿¡]/i.test(clean) || /\b(hola|gracias|precio|cotizaci[oó]n|buenos\s+d[ií]as|por\s+favor)\b/i.test(clean)) {
    return 'es';
  }
  if (/[çœæ]/i.test(clean) || /\b(bonjour|bonsoir|merci|devis|prix|pouvez|vous|livraison|combien|tr[eè]s\s+bien)\b/i.test(clean)) {
    return 'fr';
  }
  if (VI_DIACRITIC_RE.test(clean)) return 'vi';
  return 'en';
}

export function extractCustomerUtterances(chat: string): string {
  const lines = String(chat || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('['));
  if (lines.length === 0) return '';

  const customerLines = lines.filter(
    (l) => !/^(?:You|Nhân viên|Bot AI|agent|ai|system|Hệ thống):/i.test(l),
  );
  const chosen = customerLines.length > 0 ? customerLines : lines;
  return chosen
    .map((l) => l.replace(/^[^:]{1,40}:\s*/, '').trim())
    .filter((l) => l && !/^\[(?:Hình ảnh|Video|Sticker|Tệp|Tin nhắn thoại)/i.test(l))
    .join('\n');
}

export function inferLanguageFromContext(
  selectedText?: string | null,
  chatText?: string | null,
  fallbackText?: string | null,
): string {
  const cleanSelected = String(selectedText || '')
    .replace(/^[^:]{1,40}:\s*/, '')
    .trim();
  if (cleanSelected) return inferLanguageFromText(cleanSelected);

  const utterances = extractCustomerUtterances(chatText || '');
  if (utterances) return inferLanguageFromText(utterances);

  const cleanFallback = String(fallbackText || '').trim();
  if (cleanFallback) return inferLanguageFromText(cleanFallback);
  return 'en';
}

export function formatMessageContentForContext(
  rawContent: string | null | undefined,
  contentType?: string | null,
): string {
  const content = String(rawContent || '').trim();
  const type = String(contentType || '').toLowerCase();

  if (!content) {
    if (type === 'image') return '[Hình ảnh]';
    if (type === 'video') return '[Video]';
    if (type === 'voice' || type === 'audio') return '[Tin nhắn thoại]';
    if (type === 'file') return '[Tệp đính kèm]';
    if (type === 'sticker') return '[Sticker]';
    return '';
  }

  if (content.startsWith('{')) {
    try {
      const p = JSON.parse(content);
      const caption =
        p.caption ||
        p.description ||
        (p.title && !String(p.title).startsWith('{') && !String(p.title).startsWith('/uploads/')
          ? p.title
          : '');
      const fileName = p.fileName || p.filename || p.name || '';
      if (type === 'sticker' || p.isSticker) return caption ? `[Sticker: ${caption}]` : '[Sticker]';
      if (type === 'voice' || type === 'audio' || p.voiceUrl || p.audioUrl) return '[Tin nhắn thoại]';
      if (type === 'video' || p.videoUrl) return caption ? `[Video: ${caption}]` : '[Video]';
      if (type === 'image' || p.hdUrl || p.thumb || p.photoUrl || p.imageUrl) {
        return caption ? `[Hình ảnh: ${caption}]` : '[Hình ảnh]';
      }
      if (type === 'file' || fileName) {
        return fileName ? `[Tệp: ${fileName}]${caption ? ` ${caption}` : ''}` : '[Tệp đính kèm]';
      }
      if (p.text) return String(p.text);
      if (caption) return String(caption);
      if (p.href && /^https?:\/\//i.test(String(p.href))) return String(p.href);
      if (p.url && /^\/(?:uploads|storage|api)\//i.test(String(p.url))) return '[Tệp đính kèm]';
    } catch {
      // fall through
    }
  }

  if (/^\/(?:uploads|storage|api)\//i.test(content)) {
    if (type === 'video') return '[Video]';
    if (type === 'voice' || type === 'audio') return '[Tin nhắn thoại]';
    if (type === 'file') return `[Tệp: ${content.split('/').pop() || 'file'}]`;
    return '[Hình ảnh]';
  }

  return content;
}

export function extractChatContextFromMessages(
  messages: ChatContextMessageLike[],
  options?: {
    contactName?: string | null;
    channel?: string | null;
    threadType?: string | null;
    maxMessages?: number;
  },
): string {
  const max = options?.maxMessages ?? 15;
  const recent = messages.slice(-max);
  if (recent.length === 0) return '';

  const customerLabel = (options?.contactName || '').trim() || 'Khách hàng';
  const lines: string[] = [];

  for (const m of recent) {
    const st = m.senderType || m.sender_type || '';
    const isSelf = Boolean(m.fromMe) || st === 'self' || st === 'agent' || st === 'ai';
    const speaker = isSelf
      ? st === 'ai'
        ? 'Bot AI'
        : 'Nhân viên'
      : (m.senderName || '').trim() || customerLabel;
    const text = formatMessageContentForContext(m.text ?? m.content, m.contentType);
    if (text) {
      lines.push(`${speaker}: ${text}`);
    }
  }

  if (lines.length === 0) return '';
  const metaParts: string[] = [];
  if (options?.channel) metaParts.push(`Kênh: ${options.channel}`);
  if (options?.contactName) metaParts.push(`Khách: ${options.contactName}`);
  if (options?.threadType === 'group') metaParts.push('Nhóm chat');
  const header = metaParts.length > 0 ? `[${metaParts.join(' | ')}]\n` : '';
  return `${header}${lines.join('\n')}`;
}

export function getToneTemperature(tone: ChatAiTone): number {
  switch (tone) {
    case 'concise':
      return 0.15;
    case 'professional':
      return 0.25;
    case 'negotiation':
      return 0.38;
    case 'friendly':
      return 0.5;
    default:
      return 0.25;
  }
}

export function getToneSpecification(tone: ChatAiTone, isVietnameseTarget: boolean): string {
  if (tone === 'professional') {
    return isVietnameseTarget
      ? `TONE = "professional" (CHUYÊN NGHIỆP B2B — CHUẨN DOANH NGHIỆP):
- VAI TRÒ & XƯNG HÔ: Giữ phong thái chuyên nghiệp, chuẩn mực đối tác B2B. Mở đầu lịch sự bằng "Kính gửi anh/chị [Tên]," hoặc "Kính chào Quý đối tác," (hoặc "Kính gửi Quý khách,"), xưng "chúng tôi" (HOẶC "bên em" nếu hội thoại đang là chat Việt Nam nhưng văn phong PHẢI trang trọng, mạch lạc, tuyệt đối không suồng sã). Khuyến khích xưng "chúng tôi" và gọi "Quý đối tác / Anh/Chị" để tách biệt rõ với phong cách Thân thiện.
- CẤU TRÚC: Chia bố cục rõ ràng, mạch lạc (mở đầu bám đúng vấn đề khách vừa hỏi → phần nội dung/thông số gạch ý gọn hoặc câu văn chỉn chu → kết bằng lời mời bước tiếp theo chuẩn B2B như "Rất mong nhận được phản hồi từ Quý đối tác. Trân trọng,").
- CẤM KỴ: Không dùng ngôn ngữ suồng sã ("nha", "liền nhé", "haha", emoji).`
      : `TONE = "professional" (EXECUTIVE B2B — FORMAL & STRUCTURED):
- REGISTER: Executive, courteous, structured international B2B correspondence. Open cleanly ("Dear [Name / Valued Partner]," or "Hello [Name]," if ongoing formal thread).
- GRAMMAR & STRUCTURE: Use complete formal sentences WITHOUT casual contractions (avoid "we're", "I'll", "can't", "awesome", emojis). Organize specifications clearly (bullet points or crisp paragraphs). Close formally ("Please let us know your confirmation so we can proceed accordingly. Best regards,").
- MUST contrast clearly with "friendly" (chatty) and "negotiation" (value-anchoring/tradeoffs).`;
  }

  if (tone === 'friendly') {
    return isVietnameseTarget
      ? `TONE = "friendly" (THÂN THIỆN, CỞI MỞ — NHƯ NGƯỜI THẬT ĐANG CHAT):
- VAI TRÒ & XƯNG HÔ (BẮT BUỘC): Viết như nhân viên tư vấn tận tâm đang chat trực tiếp trên Zalo / WhatsApp / Web chat. Xưng "em" hoặc "bên em", gọi khách là "anh/chị [Tên]" (hoặc "bạn" nếu khách xưng bạn/mình).
- MỞ ĐẦU & NHỊP CÂU: Nếu là đoạn chat đang diễn ra, nhảy vào trả lời tự nhiên ("Dạ em chào anh/chị [Tên] nhé!", "Dạ vâng anh/chị ơi,"). Câu chữ mềm mại, gần gũi, tạo cảm giác thoải mái chia sẻ, dùng từ nối tự nhiên ("ạ", "nhé"). Có thể dùng tối đa 1 emoji nhẹ nhàng (ví dụ 😊 hoặc ❤️) nếu hợp ngữ cảnh.
- KẾT THÚC: Gợi mở nhiệt tình, nhẹ nhàng ("Anh/chị xem qua có cần em hỗ trợ thêm mẫu nào cứ nhắn em liền nhé!").
- CẤM TUYỆT ĐỐI: KHÔNG dùng "Kính gửi", "Quý đối tác", "Quý công ty", "chúng tôi", "Trân trọng,", văn phong email hành chính cứng nhắc!`
      : `TONE = "friendly" (WARM, CONVERSATIONAL HUMAN CHAT — NOT AN EMAIL):
- VOICE: Write like an attentive, upbeat human advisor messaging directly on chat (WhatsApp / Livechat / Zalo). Warm, personable, natural spoken rhythm!
- OPENING & LANGUAGE: Use warm casual openings ("Hi [Name]!" or "Hey [Name], great to hear from you!" or jump right into a warm reply if mid-chat). Use natural contractions ("I'd", "we're", "you'll", "let's") and warm phrases ("happy to help", "I'd love to check that for you"). Close warmly ("Feel free to drop a message anytime if you'd like to adjust anything!").
- STRICTLY BANNED: NO "Dear Customer", NO "Dear Sir/Madam", NO "Best regards", NO "Sincerely", NO stiff corporate letterhead wording!`;
  }

  if (tone === 'concise') {
    return `TONE = "concise" (SÚC TÍCH, NGẮN GỌN — ĐI THẲNG TRỌNG TÂM):
- QUY TẮC BẮT BUỘC TUYỆT ĐỐI:
  1. TUYỆT ĐỐI KHÔNG CHÀO HỎI (NO GREETINGS): Cấm mọi lời chào như "Kính gửi", "Dạ chào", "Chào anh/chị", "Dear", "Hi", "Hello", "Cảm ơn đã liên hệ", "Thank you for reaching out". Bắt đầu NGAY TỪ TỪ ĐẦU TIÊN bằng thông tin trả lời!
  2. TUYỆT ĐỐI KHÔNG LỜI KẾT XÃ GIAO (NO SIGN-OFFS): Cấm "Trân trọng", "Best regards", "Sincerely", "Cần gì cứ nhắn em nhé", "Let us know if you need anything".
  3. NGẮN NHẤT CÓ THỂ: Chỉ 1–3 câu siêu gọn hoặc tối đa vài gạch đầu dòng ngắn. Lọc bỏ mọi chữ thừa, chỉ giữ đúng các dữ kiện/câu hỏi trong USER NOTES gắn sát câu hỏi vừa rồi của khách. Độ dài phải ngắn hơn rõ rệt (~50% ngắn hơn bản Professional).`;
  }

  // negotiation
  return isVietnameseTarget
    ? `TONE = "negotiation" (ĐÀM PHÁN THƯƠNG MẠI — KHÉO LÉO GIỮ GIÁ & CHỐT ĐIỀU KIỆN):
- CHIẾN LƯỢC BẮT BUỘC (PHẢI KHÁC HẲN CHUYÊN NGHIỆP & THÂN THIỆN):
  1. THẤU HIỂU & ĐỊNH VỊ GIÁ TRỊ TRƯỚC: Khéo léo ghi nhận mong muốn của khách về giá/tiến độ/số lượng, sau đó neo giá trị (chất lượng chuẩn, đường may/vật liệu, bảo hành, tiến độ cam kết) TRƯỚC KHI đưa điều kiện.
  2. ĐƯA ĐIỀU KIỆN CÓ ĐI CÓ LẠI (GIVE-GET): Sử dụng lập luận thương mại có điều kiện rõ ràng (VD: "Để giữ đúng tiêu chuẩn [X], mức giá chuẩn là... Tuy nhiên nếu bên anh/chị chốt [số lượng / thanh toán cọc / gộp đơn], bên em sẵn sàng ưu tiên điều chỉnh [quyền lợi] để tối ưu chi phí cho mình").
  3. BẢO VỆ BIÊN LỢI NHUẬN & QUY TRÌNH: Không nhượng bộ vô điều kiện, không hạ mình xin xỏ, giữ thế cân bằng đối tác thắng-cùng-thắng (win-win).
  4. CHỐT CAM KẾT CỤ THỂ (DECISIVE CTA): Đề nghị chốt mốc thời gian hoặc phương án xác nhận rõ ràng (VD: "Anh/chị xác nhận giúp em phương án nào phù hợp trong hôm nay để bên em giữ mức giá này và xếp lịch sản xuất ưu tiên nhé.").`
    : `TONE = "negotiation" (STRATEGIC COMMERCIAL NEGOTIATION — VALUE ANCHOR & CONDITIONAL TRADE-OFF):
- MANDATORY PERSUASIVE STRUCTURE (MUST DIFFER CLEARLY FROM STANDARD PROFESSIONAL):
  1. TACTFUL ALIGNMENT + VALUE ANCHOR: Acknowledge the buyer's target/constraint professionally, then immediately anchor value (quality standard, reliability, cost drivers, lead time protection) BEFORE discussing pricing or terms.
  2. CONDITIONAL GIVE-GET FRAMING: Protect margin and MOQ/payment/schedule discipline using clear commercial trade-offs ("While our standard rate at this tier reflects [quality/spec], we can review [optimization/priority slot] if we align on [higher volume / deposit schedule / timeline]"). Never give unconditional discounts or sound defensive.
  3. COMMITMENT CLOSE: End with a crisp decision-oriented next step ("Let us know which option works best by [timeframe] so we can lock in these terms and allocate production capacity.").`;
}

export interface BuildDraftPromptInput {
  finalChat: string;
  finalSelected: string;
  finalNotes: string;
  tone: ChatAiTone;
  targetLanguage: string;
  contactName?: string | null;
  channel?: string | null;
  siteName?: string | null;
  siteDomain?: string | null;
  currentPage?: string | null;
  knowledgeContext?: string | null;
  extraPolicyRules?: string | null;
}

export function buildChatAiDraftPrompts(input: BuildDraftPromptInput): {
  systemPrompt: string;
  userPrompt: string;
  effectiveLanguage: string;
  temperature: number;
} {
  const tone = normalizeTone(input.tone);
  const resolvedLang =
    input.targetLanguage === 'auto'
      ? inferLanguageFromContext(input.finalSelected, input.finalChat, input.finalNotes)
      : normalizeTargetLanguage(input.targetLanguage);
  const isViTarget = resolvedLang === 'vi';
  const langLabel = LANG_NAME_MAP[resolvedLang] || resolvedLang;

  const targetLangDesc =
    input.targetLanguage === 'auto'
      ? `INFER the customer's language carefully from CONVERSATION EXCERPT and SELECTED SPECIFIC TEXT (detected likely language: ${langLabel}, code: "${resolvedLang}"). Reply naturally in THAT exact language. If unclear, use "${langLabel}". Return "reply_language" as its ISO code (e.g., "vi", "en", "zh-CN", "ja", "ko").`
      : isViTarget
        ? `Write the ENTIRE reply in natural, idiomatic Vietnamese ("vi"). Return "reply_language": "vi" and set "back_translation_vi": "".`
        : `Write the reply in ${langLabel} ("${resolvedLang}"). Return "reply_language": "${resolvedLang}" and provide an accurate "back_translation_vi" in Vietnamese so staff can verify every detail.`;

  const toneSpec = getToneSpecification(tone, isViTarget);
  const channelLabel = input.channel
    ? input.channel.toUpperCase()
    : input.siteDomain
      ? `WEBSITE LIVECHAT (${input.siteDomain})`
      : 'CHAT';

  const systemPrompt = `You are Chat AI, a sharp context-aware sales & customer support copilot for Vietnamese staff.
${targetLangDesc}

=== MANDATORY CONTEXT GROUNDING RULES ("ĐÚNG THEO NGỮ CẢNH") ===
1. READ THE CONVERSATION DEEPLY BEFORE WRITING:
   - Identify the customer's exact latest question, objection, requested product, quantity, size, deadline, or hesitation.
   - Check who already spoke! If the agent or bot ALREADY greeted in prior messages, DO NOT repeat a generic first-time introduction ("Thank you for reaching out for the first time" / "Cảm ơn bạn đã liên hệ"); continue the live conversation smoothly from the latest turn!
   - Use the customer's real name (${input.contactName || 'if mentioned in transcript'}) instead of impersonal "Customer" when natural.
   - Adapt sentence rhythm to the active channel (${channelLabel}).
2. INTEGRATE USER NOTES INTO THAT CONTEXT:
   - Transform ALL points in USER NOTES IN VIETNAMESE into a natural, cohesive reply answering what the customer actually asked in the excerpt.
   - Do NOT dump raw disconnected bullet points unless Tone is "concise" or User Notes contain multiple specs that read cleanly as bullets in "professional".

=== MANDATORY TONE SPECIFICATION ("ĐÚNG PHONG CÁCH") ===
You MUST follow EVERY stylistic constraint of the selected tone below so that switching between tones yields unmistakably different messages:
${toneSpec}

=== CRITICAL ANTI-HALLUCINATION & SAFETY RULES ===
1. NEVER invent unconfirmed prices, minimum quantities (MOQ), discounts, freebies, delivery dates, stock levels, Incoterms, or certifications unless explicitly present in USER NOTES, CONVERSATION EXCERPT, or APPROVED KNOWLEDGE.
2. If USER NOTES leave key commercial terms undecided, phrase them conditionally or ask a targeted clarifying question, AND list any unverified items briefly in "warnings_vi".
${input.extraPolicyRules ? `\n=== SITE-SPECIFIC BUSINESS POLICY ===\n${input.extraPolicyRules}` : ''}

OUTPUT MUST BE VALID JSON ONLY (no markdown prose outside JSON):
{
  "customer_summary_vi": "1 câu tóm tắt ngắn gọn bằng tiếng Việt ngữ cảnh/yêu cầu mới nhất của khách hàng",
  "reply_language": "${resolvedLang}",
  "draft": "Nội dung tin nhắn hoàn chỉnh bằng ngôn ngữ đích, đúng ngữ cảnh và chuẩn phong cách đã chọn",
  "back_translation_vi": "${isViTarget ? '' : 'Bản dịch tiếng Việt sát nghĩa nội dung draft để nhân viên đối chiếu'}",
  "warnings_vi": ["Mảng các chuỗi cảnh báo/lưu ý bằng tiếng Việt nếu thiếu thông tin cần xác nhận, hoặc [] nếu an toàn"]
}`;

  const metaLines: string[] = [];
  if (input.siteName || input.siteDomain) {
    metaLines.push(`Website/Thương hiệu: ${[input.siteName, input.siteDomain].filter(Boolean).join(' · ')}`);
  }
  if (input.channel) metaLines.push(`Kênh chat: ${input.channel}`);
  if (input.contactName) metaLines.push(`Tên khách hàng: ${input.contactName}`);
  if (input.currentPage) metaLines.push(`Trang khách đang xem: ${input.currentPage}`);

  const userPrompt = `${metaLines.length > 0 ? `METADATA:\n${metaLines.join('\n')}\n\n` : ''}${
    input.knowledgeContext ? `APPROVED KNOWLEDGE / PRODUCT SPECS:\n${input.knowledgeContext}\n\n` : ''
  }CONVERSATION EXCERPT (MỚI NHẤT Ở CUỐI):
${input.finalChat || '(Chưa có lịch sử đoạn chat — hãy soạn theo đúng ý chính và phong cách)'}
${input.finalSelected ? `\nHIGHLIGHTED SPECIFIC MESSAGE TO ADDRESS DIRECTLY:\n${input.finalSelected}` : ''}

USER NOTES IN VIETNAMESE (Ý CHÍNH NHÂN VIÊN MUỐN TRẢ LỜI):
${input.finalNotes}`;

  return {
    systemPrompt,
    userPrompt,
    effectiveLanguage: resolvedLang,
    temperature: getToneTemperature(tone),
  };
}

export function buildChatAiSuggestPrompts(input: {
  conversationChat: string;
  tone: ChatAiTone;
  targetLanguage: string;
  contactName?: string | null;
  channel?: string | null;
  siteName?: string | null;
  siteDomain?: string | null;
  currentPage?: string | null;
  knowledgeContext?: string | null;
  extraPolicyRules?: string | null;
}): {
  systemPrompt: string;
  userPrompt: string;
  effectiveLanguage: string;
  temperature: number;
} {
  const tone = normalizeTone(input.tone);
  const resolvedLang =
    input.targetLanguage === 'auto'
      ? inferLanguageFromContext('', input.conversationChat, '')
      : normalizeTargetLanguage(input.targetLanguage);
  const isViTarget = resolvedLang === 'vi';
  const langLabel = LANG_NAME_MAP[resolvedLang] || resolvedLang;
  const toneSpec = getToneSpecification(tone, isViTarget);

  const systemPrompt = `You are Chat AI, a context-aware strategic sales & CSKH advisor.
Analyze the conversation excerpt and provide 3 distinct, immediately usable next-step response scenarios tailored to:
- Language: ${isViTarget ? 'Vietnamese ("vi")' : `${langLabel} ("${resolvedLang}")`}
- Requested Tone Style:
${toneSpec}

RULES:
1. Ground EVERY suggestion in the specific topic, product, or question visible in the conversation (do NOT use generic unrelated templates like coffee/destination port if the customer is asking about uniforms, fashion, software, etc.).
2. Vary the 3 strategies meaningfully (e.g., "clarification", "pricing", "sample", "closing", "followup").
3. ${isViTarget ? 'Because draft is in Vietnamese, set "back_translation_vi" to "".' : 'Provide accurate Vietnamese "back_translation_vi" for each suggestion.'}
4. Never fabricate prices, lead times, or promotions not grounded in the excerpt or knowledge.
${input.extraPolicyRules ? `\nSITE POLICY:\n${input.extraPolicyRules}` : ''}

OUTPUT MUST BE VALID JSON ONLY:
{
  "stage": "Mô tả ngắn giai đoạn hội thoại bằng tiếng Việt",
  "suggestions": [
    {
      "id": "s1",
      "strategy_type": "clarification",
      "title": "Tiêu đề tiếng Việt ngắn gọn",
      "intent_vi": "Mục tiêu chiến lược của kịch bản này (tiếng Việt)",
      "draft": "Nội dung gợi ý phản hồi sẵn sàng gửi, chuẩn ngôn ngữ & phong cách đã chọn",
      "back_translation_vi": "${isViTarget ? '' : 'Bản dịch tiếng Việt đối chiếu'}"
    }
  ]
}`;

  const metaLines: string[] = [];
  if (input.siteName || input.siteDomain) {
    metaLines.push(`Website/Brand: ${[input.siteName, input.siteDomain].filter(Boolean).join(' · ')}`);
  }
  if (input.channel) metaLines.push(`Channel: ${input.channel}`);
  if (input.contactName) metaLines.push(`Customer: ${input.contactName}`);
  if (input.currentPage) metaLines.push(`Current page: ${input.currentPage}`);

  const userPrompt = `${metaLines.length > 0 ? `METADATA:\n${metaLines.join('\n')}\n\n` : ''}${
    input.knowledgeContext ? `APPROVED KNOWLEDGE:\n${input.knowledgeContext}\n\n` : ''
  }CONVERSATION EXCERPT:
${input.conversationChat || 'Khách hàng mới mở hội thoại hỏi thông tin tư vấn sản phẩm/dịch vụ.'}`;

  return {
    systemPrompt,
    userPrompt,
    effectiveLanguage: resolvedLang,
    temperature: getToneTemperature(tone),
  };
}

export function extractJsonObject(rawText: string): any | null {
  if (!rawText || typeof rawText !== 'string') return null;
  let clean = rawText.trim();
  const fenced = clean.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) clean = fenced[1].trim();

  try {
    return JSON.parse(clean);
  } catch {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function splitNotePoints(notes: string): string[] {
  return String(notes || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*+]\s*/, '').trim())
    .filter(Boolean);
}

function detectContextTopicSnippet(chat: string): string {
  const lines = String(chat || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('['));
  if (lines.length === 0) return '';
  const customerLines = lines.filter(
    (l) => !/^(?:You|Nhân viên|Bot AI|agent|ai):/i.test(l),
  );
  const picked = (customerLines[customerLines.length - 1] || lines[lines.length - 1] || '')
    .replace(/^[^:]{1,40}:\s*/, '')
    .trim();
  if (!picked || /^\[(?:Hình ảnh|Video|Sticker|Tệp)/i.test(picked)) return '';
  return picked.length > 90 ? `${picked.slice(0, 87)}...` : picked;
}

export function buildFallbackDraft(input: {
  tone: ChatAiTone;
  targetLanguage: string;
  finalNotes: string;
  finalChat?: string;
  contactName?: string | null;
  apiSuccess?: boolean;
}): {
  customer_summary_vi: string;
  reply_language: string;
  draft: string;
  back_translation_vi: string;
  warnings_vi: string[];
  mock: boolean;
} {
  const tone = normalizeTone(input.tone);
  const resolvedLang =
    input.targetLanguage === 'auto'
      ? inferLanguageFromContext('', input.finalChat, input.finalNotes)
      : normalizeTargetLanguage(input.targetLanguage);
  const points = splitNotePoints(input.finalNotes);
  const joinedInline = points.join('; ');
  const bullets = points.length > 1 ? points.map((p) => `- ${p}`).join('\n') : joinedInline;
  const cleanName = (input.contactName || '').trim();
  const topicSnippet = detectContextTopicSnippet(input.finalChat || '');
  const summaryVi = topicSnippet
    ? `Khách hàng đang trao đổi về: "${topicSnippet}".`
    : 'Soạn phản hồi theo ý chính nhân viên đã nhập.';

  const isMock = !input.apiSuccess;

  if (resolvedLang === 'vi') {
    const salutationPro = cleanName ? `Kính gửi anh/chị ${cleanName},` : 'Kính gửi Quý đối tác,';
    const salutationFriendly = cleanName ? `Dạ chào anh/chị ${cleanName} nhé,` : 'Dạ em chào anh/chị ạ,';
    const contextRefVi = topicSnippet ? ` về nội dung "${topicSnippet}"` : '';

    if (tone === 'concise') {
      const conciseBody = points.length > 1 ? points.map((p) => `- ${p}`).join('\n') : joinedInline;
      return {
        customer_summary_vi: summaryVi,
        reply_language: 'vi',
        draft: conciseBody,
        back_translation_vi: '',
        warnings_vi: [],
        mock: isMock,
      };
    }

    if (tone === 'friendly') {
      return {
        customer_summary_vi: summaryVi,
        reply_language: 'vi',
        draft: `${salutationFriendly}\n\nEm gửi mình thông tin chi tiết${contextRefVi} nhé ạ: ${joinedInline}.\n\nAnh/chị xem qua có cần em tư vấn hoặc hỗ trợ thêm điểm nào cứ nhắn em ngay nha!`,
        back_translation_vi: '',
        warnings_vi: [
          'Bản nháp tạo từ chế độ dự phòng (kiểm tra kết nối Gemini API). Vui lòng rà lại số liệu trước khi gửi.',
        ],
        mock: isMock,
      };
    }

    if (tone === 'negotiation') {
      return {
        customer_summary_vi: summaryVi,
        reply_language: 'vi',
        draft: `${cleanName ? `Chào anh/chị ${cleanName},` : 'Chào anh/chị,'}\n\nBên em rất trân trọng sự quan tâm của mình${contextRefVi}. Để đảm bảo đúng tiêu chuẩn chất lượng và tiến độ cam kết, phương án áp dụng hiện tại là:\n${bullets}\n\nNếu bên mình cân nhắc chốt sớm phương án hoặc nâng quy mô đơn hàng/điều kiện thanh toán phù hợp, bên em sẵn sàng ưu tiên hỗ trợ thêm để tối ưu hiệu quả cho cả hai bên. Anh/chị xác nhận lại phương án mong muốn để bên em giữ lịch triển khai nhé.`,
        back_translation_vi: '',
        warnings_vi: [
          'Đang ở phong cách đàm phán (chế độ dự phòng): cần kiểm tra kỹ ngưỡng chiết khấu/điều kiện trước khi chốt.',
        ],
        mock: isMock,
      };
    }

    // professional (vi)
    return {
      customer_summary_vi: summaryVi,
      reply_language: 'vi',
      draft: `${salutationPro}\n\nChúng tôi xin phản hồi thông tin${contextRefVi} theo yêu cầu của Quý đối tác như sau:\n${bullets}\n\nRất mong nhận được phản hồi xác nhận từ Quý đối tác để chúng tôi phối hợp triển khai các bước tiếp theo.\n\nTrân trọng,`,
      back_translation_vi: '',
      warnings_vi: [
        'Bản nháp tạo từ chế độ dự phòng (kiểm tra kết nối Gemini API). Vui lòng rà lại thông số thương mại trước khi gửi.',
      ],
      mock: isMock,
    };
  }

  // Non-Vietnamese (English baseline / fallback + accurate Vietnamese back-translation)
  const recipientEn = cleanName || 'Valued Partner';
  const contextNoteEn = topicSnippet ? ` regarding your message ("${topicSnippet}")` : '';
  const safeNotesSummary = joinedInline || 'our product and quotation details';

  if (tone === 'concise') {
    const conciseDraft =
      points.length > 1
        ? points.map((p) => `- ${p}`).join('\n')
        : safeNotesSummary;
    return {
      customer_summary_vi: summaryVi,
      reply_language: resolvedLang,
      draft: conciseDraft,
      back_translation_vi: conciseDraft,
      warnings_vi: ['Đang dùng chế độ dự phòng: kiểm tra kết nối Gemini AI để dịch mượt sang ngôn ngữ đích.'],
      mock: isMock,
    };
  }

  if (tone === 'friendly') {
    const draftEn = `Hi ${cleanName || 'there'}!\n\nThanks so much for reaching out${contextNoteEn}. Happy to share the details with you: ${safeNotesSummary}.\n\nFeel free to message me right here anytime if you have any questions or would like to tweak anything!`;
    const backVi = `Chào ${cleanName || 'bạn'}!\n\nCảm ơn bạn đã nhắn tin${topicSnippet ? ` về "${topicSnippet}"` : ''}. Bên em rất vui gửi mình thông tin: ${safeNotesSummary}.\n\nCó câu hỏi gì hay cần chỉnh thêm chỗ nào, bạn cứ nhắn ngay cho em ở đây nhé!`;
    return {
      customer_summary_vi: summaryVi,
      reply_language: resolvedLang,
      draft: draftEn,
      back_translation_vi: backVi,
      warnings_vi: ['Chế độ dự phòng đang bật: cần kiểm tra lại bản dịch nếu ghi chú tiếng Việt chưa được AI chuyển ngữ.'],
      mock: isMock,
    };
  }

  if (tone === 'negotiation') {
    const draftEn = `Dear ${recipientEn},\n\nWe appreciate your interest${contextNoteEn}. To maintain our production quality standards and committed lead time, please review our current commercial terms: ${safeNotesSummary}.\n\nWhile standard terms apply at the baseline tier, we would be glad to discuss a more flexible arrangement if we can align on order volume or confirmation schedule. Please let us know how you would like to proceed so we can lock in capacity.`;
    const backVi = `Kính gửi ${cleanName || 'Quý đối tác'},\n\nChúng tôi đánh giá cao sự quan tâm của Quý vị${topicSnippet ? ` đối với "${topicSnippet}"` : ''}. Để đảm bảo tiêu chuẩn chất lượng và tiến độ sản xuất cam kết, điều kiện thương mại hiện tại là: ${safeNotesSummary}.\n\nDù đơn giá chuẩn áp dụng theo mức cơ bản, chúng tôi sẵn sàng trao đổi linh hoạt hơn nếu hai bên thống nhất được về sản lượng hoặc lịch xác nhận đơn. Vui lòng phản hồi phương án phù hợp để chúng tôi giữ lịch sản xuất.`;
    return {
      customer_summary_vi: summaryVi,
      reply_language: resolvedLang,
      draft: draftEn,
      back_translation_vi: backVi,
      warnings_vi: ['Chế độ dự phòng phong cách Đàm phán: rà soát kỹ điều kiện thương mại và kiểm tra kết nối Gemini AI.'],
      mock: isMock,
    };
  }

  // professional (en/default)
  const draftEn = `Dear ${recipientEn},\n\nThank you for contacting us${contextNoteEn}. Regarding your inquiry, please find our response below:\n${points.length > 1 ? points.map((p) => `- ${p}`).join('\n') : `- ${safeNotesSummary}`}\n\nPlease confirm your requirements at your earliest convenience so we may proceed accordingly.\n\nBest regards,`;
  const backVi = `Kính gửi ${cleanName || 'Quý đối tác'},\n\nCảm ơn Quý vị đã liên hệ${topicSnippet ? ` về "${topicSnippet}"` : ''}. Chúng tôi xin phản hồi chi tiết như sau:\n${bullets}\n\nQuý đối tác vui lòng xác nhận lại yêu cầu để chúng tôi tiến hành các bước tiếp theo.\n\nTrân trọng,`;
  return {
    customer_summary_vi: summaryVi,
    reply_language: resolvedLang,
    draft: draftEn,
    back_translation_vi: backVi,
    warnings_vi: ['Chế độ dự phòng đang bật: kiểm tra lại kết nối Gemini API hoặc chi tiết báo giá trước khi gửi.'],
    mock: isMock,
  };
}

export function buildFallbackSuggestions(input: {
  tone: ChatAiTone;
  targetLanguage: string;
  conversationChat?: string;
  contactName?: string | null;
}): {
  stage: string;
  context_stage: string;
  suggestions: Array<{
    id: string;
    strategy_type: string;
    title: string;
    intent_vi: string;
    draft: string;
    back_translation_vi: string;
  }>;
} {
  const tone = normalizeTone(input.tone);
  const resolvedLang =
    input.targetLanguage === 'auto'
      ? inferLanguageFromContext('', input.conversationChat, '')
      : normalizeTargetLanguage(input.targetLanguage);
  const cleanName = (input.contactName || '').trim();
  const topic = detectContextTopicSnippet(input.conversationChat || '');
  const topicPhraseVi = topic ? ` về "${topic}"` : '';

  if (resolvedLang === 'vi') {
    if (tone === 'concise') {
      return {
        stage: 'Giai đoạn làm rõ nhu cầu (Súc tích)',
        context_stage: 'Giai đoạn làm rõ nhu cầu (Súc tích)',
        suggestions: [
          {
            id: 's1',
            strategy_type: 'clarification',
            title: 'Hỏi thẳng thông số cốt lõi',
            intent_vi: 'Hỏi ngắn gọn nhu cầu cụ thể để chốt phương án nhanh.',
            draft: `Anh/chị vui lòng cho biết thêm quy cách, màu sắc và thời gian dự kiến nhận hàng${topicPhraseVi} để bên em báo phương án chính xác.`,
            back_translation_vi: '',
          },
          {
            id: 's2',
            strategy_type: 'sample',
            title: 'Đề xuất gửi mẫu / hình thực tế',
            intent_vi: 'Đưa phương án xem mẫu nhanh.',
            draft: 'Bên em có sẵn hình ảnh và mẫu đối chiếu thực tế. Anh/chị cần gửi qua kênh này hay nhận thông tin chi tiết nào trước?',
            back_translation_vi: '',
          },
          {
            id: 's3',
            strategy_type: 'followup',
            title: 'Chốt bước trao đổi tiếp theo',
            intent_vi: 'Xác nhận thời gian trao đổi tiếp.',
            draft: 'Anh/chị tiện phản hồi giúp em thông tin liên hệ hoặc khung giờ rảnh để chuyên viên phụ trách hỗ trợ trực tiếp.',
            back_translation_vi: '',
          },
        ],
      };
    }

    if (tone === 'friendly') {
      return {
        stage: 'Giai đoạn tư vấn thân thiện & khai thác nhu cầu',
        context_stage: 'Giai đoạn tư vấn thân thiện & khai thác nhu cầu',
        suggestions: [
          {
            id: 's1',
            strategy_type: 'clarification',
            title: 'Hỏi nhẹ nhàng thêm chi tiết',
            intent_vi: 'Khơi gợi khách chia sẻ thêm sở thích/nhu cầu một cách thoải mái.',
            draft: `Dạ anh/chị ${cleanName || 'ơi'}, mình đang ưng phong cách, màu sắc hoặc chất liệu nào nhất${topicPhraseVi} để em lọc giúp mình vài mẫu đẹp và hợp gu nhất nhé!`,
            back_translation_vi: '',
          },
          {
            id: 's2',
            strategy_type: 'sample',
            title: 'Mời xem hình thực tế & demo',
            intent_vi: 'Tạo thiện cảm bằng việc gửi mẫu tham khảo trước.',
            draft: 'Dạ bên em có sẵn ảnh chụp thực tế và bảng màu để anh/chị dễ hình dung hơn ạ. Nếu mình thích bên em lên demo xem trước luôn cho tiện nhé!',
            back_translation_vi: '',
          },
          {
            id: 's3',
            strategy_type: 'followup',
            title: 'Nhắn nhẹ hỗ trợ qua SĐT/Zalo',
            intent_vi: 'Mời khách kết nối thêm kênh nếu cần gửi tài liệu nặng.',
            draft: 'Anh/chị cứ chia sẻ thoải mái nha, hoặc nếu tiện anh/chị gửi em số Zalo để em gửi nhanh bảng màu & tư vấn chi tiết hơn cho mình ạ!',
            back_translation_vi: '',
          },
        ],
      };
    }

    if (tone === 'negotiation') {
      return {
        stage: 'Giai đoạn thương lượng giá trị & chốt điều kiện',
        context_stage: 'Giai đoạn thương lượng giá trị & chốt điều kiện',
        suggestions: [
          {
            id: 's1',
            strategy_type: 'pricing',
            title: 'Neo giá trị & mở phương án theo quy mô',
            intent_vi: 'Bảo vệ đơn giá chuẩn đồng thời mở đường tối ưu nếu chốt điều kiện tốt.',
            draft: `Với chất lượng hoàn thiện chuẩn bên em${topicPhraseVi}, mức giá hiện tại đã được cân đối rất sát. Tuy nhiên nếu bên anh/chị chốt sớm quy cách và lịch thanh toán phù hợp, em sẽ kiểm tra phương án tối ưu nhất cho mình.`,
            back_translation_vi: '',
          },
          {
            id: 's2',
            strategy_type: 'closing',
            title: 'Khóa lịch ưu tiên theo mốc xác nhận',
            intent_vi: 'Tạo động lực chốt sớm bằng việc giữ lịch sản xuất/ưu đãi.',
            draft: 'Anh/chị chốt giúp em cấu hình mong muốn trong tuần này để bên em giữ nguyên đơn giá tốt nhất và ưu tiên xếp lịch triển khai đúng hạn cho bên mình nhé.',
            back_translation_vi: '',
          },
          {
            id: 's3',
            strategy_type: 'clarification',
            title: 'Làm rõ điểm mấu chốt để chốt phương án',
            intent_vi: 'Xác định ưu tiên số 1 của khách (giá, chất lượng hay thời gian).',
            draft: 'Hiện tại yếu tố nào bên anh/chị ưu tiên nhất — ngân sách mục tiêu, chất liệu hay thời hạn bàn giao — để bên em cân đối phương án vừa vặn nhất ạ?',
            back_translation_vi: '',
          },
        ],
      };
    }

    // professional (vi)
    return {
      stage: 'Giai đoạn làm rõ thông số & tư vấn B2B',
      context_stage: 'Giai đoạn làm rõ thông số & tư vấn B2B',
      suggestions: [
        {
          id: 's1',
          strategy_type: 'clarification',
          title: 'Xác nhận quy cách & yêu cầu kỹ thuật',
          intent_vi: 'Thu thập thông số chuẩn xác trước khi lập báo giá.',
          draft: `Kính gửi ${cleanName ? `anh/chị ${cleanName}` : 'Quý đối tác'},\n\nĐể chúng tôi chuẩn bị phương án phù hợp${topicPhraseVi}, Quý đối tác vui lòng chia sẻ thêm về quy cách mong muốn, yêu cầu chất liệu và địa điểm giao nhận dự kiến.\n\nTrân trọng,`,
          back_translation_vi: '',
        },
        {
          id: 's2',
          strategy_type: 'sample',
          title: 'Đề xuất gửi hồ sơ năng lực & mẫu tham khảo',
          intent_vi: 'Xây dựng uy tín B2B và hỗ trợ đánh giá chất lượng.',
          draft: 'Chúng tôi sẵn sàng cung cấp tài liệu thông số chi tiết cùng mẫu đối chứng thực tế để Quý đối tác đánh giá trực tiếp. Rất mong nhận được thông tin người phụ trách nhận mẫu.',
          back_translation_vi: '',
        },
        {
          id: 's3',
          strategy_type: 'followup',
          title: 'Đề xuất lịch trao đổi thống nhất phương án',
          intent_vi: 'Chuyển sang bước trao đổi trực tiếp nhanh chóng.',
          draft: 'Quý đối tác vui lòng cho biết khung giờ thuận tiện để bộ phận chuyên môn của chúng tôi liên hệ trao đổi trực tiếp và hoàn thiện báo giá chi tiết.',
          back_translation_vi: '',
        },
      ],
    };
  }

  // English / non-Vietnamese suggestions tailored per tone
  if (tone === 'concise') {
    return {
      stage: 'Giai đoạn làm rõ nhu cầu (Súc tích)',
      context_stage: 'Giai đoạn làm rõ nhu cầu (Súc tích)',
      suggestions: [
        {
          id: 's1',
          strategy_type: 'clarification',
          title: 'Hỏi thẳng thông số & số lượng',
          intent_vi: 'Hỏi trực diện quy cách và sản lượng dự kiến.',
          draft: 'Could you confirm your target quantity, preferred specifications, and delivery destination?',
          back_translation_vi: 'Bạn vui lòng xác nhận số lượng dự kiến, quy cách mong muốn và điểm nhận hàng?',
        },
        {
          id: 's2',
          strategy_type: 'sample',
          title: 'Hỏi nhu cầu xem mẫu thực tế',
          intent_vi: 'Xác nhận địa chỉ gửi mẫu hoặc catalogue.',
          draft: 'We can share our product specs and evaluation samples. Would you like us to arrange a sample dispatch?',
          back_translation_vi: 'Chúng tôi có thể gửi thông số và mẫu đánh giá. Bạn có muốn chúng tôi sắp xếp gửi mẫu không?',
        },
        {
          id: 's3',
          strategy_type: 'followup',
          title: 'Chốt lịch trao đổi ngắn',
          intent_vi: 'Đề nghị khung giờ gọi nhanh.',
          draft: 'Please let us know a convenient time slot for a quick 10-minute call to align on details.',
          back_translation_vi: 'Vui lòng cho biết khung giờ thuận tiện cho cuộc trao đổi nhanh 10 phút để thống nhất chi tiết.',
        },
      ],
    };
  }

  if (tone === 'friendly') {
    return {
      stage: 'Giai đoạn kết nối & hỗ trợ thân thiện',
      context_stage: 'Giai đoạn kết nối & hỗ trợ thân thiện',
      suggestions: [
        {
          id: 's1',
          strategy_type: 'clarification',
          title: 'Hỏi nhu cầu cởi mở, tự nhiên',
          intent_vi: 'Mời khách chia sẻ nhu cầu một cách thân thiện.',
          draft: `Hi ${cleanName || 'there'}! I'd love to point you toward the best fit — could you share a bit about the style or quantity you're thinking of?`,
          back_translation_vi: 'Chào bạn! Rất vui được gợi ý phương án phù hợp nhất — bạn chia sẻ thêm một chút về kiểu dáng hoặc số lượng mình đang cân nhắc nhé!',
        },
        {
          id: 's2',
          strategy_type: 'sample',
          title: 'Nhiệt tình gửi ảnh mẫu / catalogue',
          intent_vi: 'Chủ động gửi tài liệu trực quan để khách dễ chọn.',
          draft: "I'd be happy to send over real photos, material options, and our latest catalogue so you can browse easily. Would that help?",
          back_translation_vi: 'Em rất sẵn lòng gửi thêm ảnh thực tế, tùy chọn chất liệu và catalogue mới nhất để mình dễ chọn. Bạn thấy tiện không ạ?',
        },
        {
          id: 's3',
          strategy_type: 'followup',
          title: 'Mở kênh hỗ trợ trực tiếp',
          intent_vi: 'Giữ cuộc trò chuyện nhẹ nhàng, dễ tiếp tục.',
          draft: 'No rush at all — feel free to drop any questions right here whenever you are ready, and I will jump right on them!',
          back_translation_vi: 'Không vội đâu ạ — lúc nào cần mình cứ nhắn câu hỏi ngay ở đây, em sẽ hỗ trợ liền nhé!',
        },
      ],
    };
  }

  if (tone === 'negotiation') {
    return {
      stage: 'Giai đoạn đàm phán điều kiện & chốt đơn',
      context_stage: 'Giai đoạn đàm phán điều kiện & chốt đơn',
      suggestions: [
        {
          id: 's1',
          strategy_type: 'pricing',
          title: 'Đề xuất bậc giá theo điều kiện đơn hàng',
          intent_vi: 'Mở phương án tối ưu giá có điều kiện (Give-Get).',
          draft: 'To balance quality standards with your target budget, we can explore tiered pricing if the order volume or confirmation schedule aligns. What target bracket are you aiming for?',
          back_translation_vi: 'Để cân bằng tiêu chuẩn chất lượng và ngân sách mục tiêu của bạn, chúng tôi có thể xem xét giá theo bậc nếu số lượng hoặc tiến độ chốt đơn phù hợp. Mức giá mục tiêu bạn đang hướng tới là bao nhiêu?',
        },
        {
          id: 's2',
          strategy_type: 'closing',
          title: 'Khóa lịch sản xuất theo mốc xác nhận',
          intent_vi: 'Tạo lý do chính đáng để chốt xác nhận sớm.',
          draft: 'Confirming your final specifications this week allows us to lock in raw material rates and prioritize your production window.',
          back_translation_vi: 'Nếu bạn xác nhận quy cách chốt trong tuần này, chúng tôi có thể giữ nguyên mức giá nguyên liệu và ưu tiên lịch sản xuất cho đơn hàng của bạn.',
        },
        {
          id: 's3',
          strategy_type: 'clarification',
          title: 'Xác định ưu tiên thương mại chính',
          intent_vi: 'Tìm điểm cân bằng giữa giá, thời gian giao và thanh toán.',
          draft: 'Could you share whether unit cost, faster turnaround, or flexible payment scheduling is your main priority so we can structure the best offer?',
          back_translation_vi: 'Bạn có thể cho biết yếu tố nào được ưu tiên nhất — đơn giá, tiến độ giao gấp hay lịch thanh toán linh hoạt — để chúng tôi đề xuất gói tối ưu nhất?',
        },
      ],
    };
  }

  return {
    stage: 'Giai đoạn làm rõ nhu cầu & điều khoản B2B',
    context_stage: 'Giai đoạn làm rõ nhu cầu & điều khoản B2B',
    suggestions: [
      {
        id: 's1',
        strategy_type: 'clarification',
        title: 'Làm rõ số lượng & quy cách',
        intent_vi: 'Cảm ơn và hỏi rõ yêu cầu kỹ thuật cùng địa điểm nhận hàng.',
        draft: `Dear ${cleanName || 'Valued Partner'},\n\nThank you for your interest. Could you please confirm your estimated order quantity, specifications, and delivery destination so we may prepare an accurate quotation?\n\nBest regards,`,
        back_translation_vi: 'Kính gửi Quý đối tác, Cảm ơn bạn đã quan tâm! Bạn vui lòng xác nhận số lượng dự kiến, quy cách và địa điểm giao hàng để chúng tôi chuẩn bị báo giá chính xác?',
      },
      {
        id: 's2',
        strategy_type: 'sample',
        title: 'Đề xuất gửi mẫu thử & catalogue',
        intent_vi: 'Giới thiệu gửi mẫu sản phẩm đánh giá chất lượng và gửi tài liệu.',
        draft: 'We would be pleased to provide our full catalogue and product samples for your quality evaluation. Kindly share your shipping address and recipient details.',
        back_translation_vi: 'Chúng tôi rất hân hạnh cung cấp catalogue đầy đủ và mẫu sản phẩm để Quý vị đánh giá chất lượng. Vui lòng chia sẻ địa chỉ nhận hàng và thông tin người nhận.',
      },
      {
        id: 's3',
        strategy_type: 'followup',
        title: 'Hẹn cuộc trao đổi trực tiếp',
        intent_vi: 'Đề xuất hẹn trao đổi nhanh để thống nhất yêu cầu đơn hàng.',
        draft: 'Would you be available for a brief call at your convenience to review your project requirements in greater detail?',
        back_translation_vi: 'Quý đối tác có thuận tiện sắp xếp một cuộc trao đổi ngắn để chúng tôi nắm chi tiết hơn về yêu cầu đơn hàng không ạ?',
      },
    ],
  };
}
