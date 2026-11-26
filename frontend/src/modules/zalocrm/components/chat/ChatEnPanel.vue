<template>
  <div class="chaten-panel d-flex flex-column" style="height: 100%; overflow: hidden; background: rgb(var(--v-theme-surface));">
    <!-- ═════════════════════════════════════════════════════════════════════
         MAIN SCROLLABLE UNIFIED VIEW (ĐÃ GỘP SOẠN TIN + GỢI Ý NHANH)
    ══════════════════════════════════════════════════════════════════════ -->
    <div
      class="chaten-scroll flex-grow-1 overflow-y-auto"
      style="min-height: 0;"
    >
      <!-- Step 01: Ngữ cảnh chat (Mặc định để trống, bôi đen tự động nạp) -->
      <div class="step-card">
        <div class="step-card-header">
          <div class="step-title-wrap">
            <span class="step-badge">01</span>
            <span class="step-title">Ngữ cảnh đối tác</span>
          </div>

          <div class="step-actions">
            <!-- Toast notification khi bôi đen tự nạp tin nhắn -->
            <transition name="fade">
              <span v-if="autoFillNotice" class="auto-fill-pill">
                {{ autoFillNotice }}
              </span>
            </transition>

            <button
              type="button"
              class="step-btn-primary"
              title="Lấy 12 tin nhắn gần nhất từ hội thoại này"
              @click="loadChatFromConversation"
            >
              <v-icon size="13" class="mr-1">mdi-chat-processing-outline</v-icon>
              Lấy từ chat
            </button>
            <button
              type="button"
              class="step-btn-icon"
              title="Dán từ bộ nhớ tạm (Clipboard)"
              @click="pasteFromClipboard"
            >
              <v-icon size="14">mdi-clipboard-text-outline</v-icon>
            </button>
            <button
              v-if="chatContext"
              type="button"
              class="step-btn-icon"
              title="Xóa trắng ngữ cảnh"
              @click="chatContext = ''"
            >
              <v-icon size="14">mdi-close</v-icon>
            </button>
          </div>
        </div>

        <div class="textarea-wrap">
          <v-textarea
            v-model="chatContext"
            rows="4"
            variant="outlined"
            density="compact"
            hide-details
            placeholder="Mặc định để trống. Bạn có thể dùng chuột bôi đen bất kỳ tin nhắn nào bên khung chat để tự động nạp vào đây, hoặc bấm 'Lấy từ chat'..."
            class="chaten-textarea chaten-textarea--context"
          />
        </div>
      </div>

      <!-- Step 02: Ý bạn muốn trả lời -->
      <div class="step-card">
        <div class="step-card-header">
          <div class="step-title-wrap">
            <span class="step-badge">02</span>
            <span class="step-title">Ý bạn muốn trả lời</span>
          </div>
          <span class="step-hint">(Gạch đầu dòng tiếng Việt)</span>
        </div>

        <div class="textarea-wrap">
          <v-textarea
            v-model="notesVi"
            rows="7"
            variant="outlined"
            density="compact"
            hide-details
            placeholder="Nhập ý chính bằng tiếng Việt. VD:
- Cảm ơn đối tác đã liên hệ
- Báo giá theo mẫu yêu cầu, MOQ 500 cái
- Thời gian sản xuất 7-10 ngày, giao hàng tận nơi
- Hỏi thêm về quy cách đóng gói và địa điểm nhận hàng..."
            class="chaten-textarea chaten-textarea--notes"
          />
        </div>
      </div>

      <!-- Step 03: Tùy chọn Phong cách & Ngôn ngữ -->
      <div class="options-box">
        <div class="options-grid">
          <div class="option-item">
            <label class="option-label">
              <v-icon size="13" class="mr-1 text-slate-500">mdi-tune-variant</v-icon>
              Phong cách (Tone)
            </label>
            <select v-model="selectedTone" class="clean-native-select">
              <option v-for="t in toneOptions" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
          </div>

          <div class="option-item">
            <label class="option-label">
              <v-icon size="13" class="mr-1 text-slate-500">mdi-translate</v-icon>
              Ngôn ngữ đích
            </label>
            <select v-model="selectedLanguage" class="clean-native-select">
              <option v-for="l in languageOptions" :key="l.code" :value="l.code">{{ l.label }}</option>
            </select>
          </div>
        </div>
        <div v-if="selectedToneHint" class="tone-guide-hint">
          <v-icon size="13" color="#006938" class="flex-shrink-0">mdi-creation</v-icon>
          <span>{{ selectedToneHint }}</span>
        </div>
      </div>

      <!-- Nút Soạn trả lời AI -->
      <button
        type="button"
        class="chaten-submit-btn"
        :disabled="!notesVi.trim() || loadingDraft"
        @click="generateDraft"
      >
        <v-progress-circular v-if="loadingDraft" indeterminate size="18" width="2" class="mr-2" color="white" />
        <v-icon v-else size="18" class="mr-1.5">mdi-creation</v-icon>
        <span>{{ loadingDraft ? 'Đang phân tích ngữ cảnh & soạn thảo...' : `Soạn trả lời ${currentLanguageShort}` }}</span>
      </button>

      <v-alert
        v-if="errorMessage"
        type="error"
        density="compact"
        variant="tonal"
        class="text-caption mb-4"
        closable
        @click:close="errorMessage = ''"
      >
        {{ errorMessage }}
      </v-alert>

      <!-- ═════════════════════════════════════════════════════════════════
           OUTPUT: KẾT QUẢ AI ĐỀ XUẤT
      ══════════════════════════════════════════════════════════════════ -->
      <div v-if="draftResult" class="output-stack mb-4">
        <!-- Bản thảo theo ngôn ngữ & phong cách đã chọn -->
        <div class="draft-box">
          <div class="draft-box-header">
            <div class="draft-title">
              <v-icon size="15" color="primary" class="mr-1">mdi-email-fast-outline</v-icon>
              <span>Bản trả lời ({{ resolveReplyLangLabel(draftResult.reply_language) }})</span>
            </div>
            <div class="d-flex align-center" style="gap: 4px;">
              <span class="tone-result-badge" :style="getToneBadgeStyle(draftResult.tone || selectedTone)">{{ resolveToneLabel(draftResult.tone || selectedTone) }}</span>
              <span class="send-ready-badge">READY TO SEND</span>
            </div>
          </div>

          <div v-if="draftResult.customer_summary_vi" class="context-summary-chip mb-2">
            🎯 {{ draftResult.customer_summary_vi }}
          </div>

          <v-textarea
            v-model="draftResult.draft"
            rows="7"
            variant="outlined"
            density="compact"
            hide-details
            class="chaten-output-textarea mb-2.5"
          />

          <!-- Action Buttons Bar -->
          <div class="action-btn-row">
            <button
              type="button"
              class="action-btn-insert"
              title="Chèn nội dung này vào ô nhập tin nhắn của chat"
              @click="insertToChat"
            >
              <v-icon size="15" class="mr-1">mdi-arrow-bottom-left-thick</v-icon>
              Chèn vào chat
            </button>

            <button
              type="button"
              class="action-btn-send"
              title="Gửi ngay tin nhắn này tới đối tác"
              @click="sendDraftDirectly"
            >
              <v-icon size="15" class="mr-1">mdi-send</v-icon>
              Gửi ngay
            </button>

            <button
              type="button"
              class="action-btn-copy"
              title="Sao chép vào clipboard"
              @click="copyDraft"
            >
              <v-icon size="15">{{ copiedDraft ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
            </button>
          </div>
        </div>

        <!-- Bản dịch tiếng Việt để đối chiếu -->
        <div
          v-if="draftResult.back_translation_vi && draftResult.reply_language !== 'vi' && draftResult.back_translation_vi.trim() !== draftResult.draft.trim()"
          class="back-trans-box"
        >
          <div class="back-trans-header">
            <v-icon size="14" class="mr-1">mdi-translate</v-icon>
            Bản dịch tiếng Việt đối chiếu
          </div>
          <div class="back-trans-body">
            {{ draftResult.back_translation_vi }}
          </div>
        </div>

        <!-- Cảnh báo rủi ro (nếu có) -->
        <div v-if="draftResult.warnings_vi && draftResult.warnings_vi.length > 0" class="warnings-box">
          <div class="warnings-header">
            <v-icon size="14" color="#b45309" class="mr-1">mdi-alert-circle-outline</v-icon>
            Lưu ý thương mại & phòng ngừa bịa giá
          </div>
          <ul class="warnings-list">
            <li v-for="(w, idx) in draftResult.warnings_vi" :key="idx">
              {{ w }}
            </li>
          </ul>
        </div>
      </div>

      <!-- ═════════════════════════════════════════════════════════════════
           PHẦN GỢI Ý NHANH (ĐÃ GỘP TRỰC TIẾP VÀO GIAO DIỆN CHÍNH)
      ══════════════════════════════════════════════════════════════════ -->
      <div class="suggestions-unified-section">
        <div class="suggest-header-row">
          <div class="suggest-header-left">
            <div class="d-flex align-center" style="gap: 6px;">
              <v-icon size="17" color="#006938">mdi-lightbulb-on-outline</v-icon>
              <span class="suggest-title">Gợi ý kịch bản phản hồi nhanh</span>
            </div>
            <span class="suggest-desc">AI phân tích hội thoại và gợi ý các kịch bản tiếp theo</span>
          </div>
          <button
            type="button"
            class="suggest-now-btn"
            :disabled="loadingSuggestions"
            @click="fetchSuggestions"
          >
            <v-progress-circular v-if="loadingSuggestions" indeterminate size="12" width="2" class="mr-1.5" />
            <v-icon v-else size="13" class="mr-1">mdi-refresh</v-icon>
            <span>Gợi ý ngay</span>
          </button>
        </div>

        <div v-if="suggestionsStage" class="stage-pill mb-3">
          📍 <strong>Giai đoạn giao dịch:</strong> {{ suggestionsStage }}
        </div>

        <div v-if="suggestionsList.length > 0" class="suggestions-stack mb-3">
          <div
            v-for="sug in suggestionsList"
            :key="sug.id"
            class="suggestion-card"
          >
            <div class="suggestion-card-header">
              <span class="suggestion-title">{{ sug.title }}</span>
              <span class="strategy-badge" :style="{ background: getStrategyBg(sug.strategy_type), color: getStrategyColor(sug.strategy_type) }">
                {{ getStrategyLabel(sug.strategy_type) }}
              </span>
            </div>

            <div class="suggestion-intent">
              💡 <strong>Ý định:</strong> {{ sug.intent_vi }}
            </div>

            <div class="suggestion-draft">
              {{ sug.draft }}
            </div>

            <div
              v-if="sug.back_translation_vi && suggestionsReplyLang !== 'vi' && sug.back_translation_vi.trim() !== sug.draft.trim()"
              class="suggestion-trans"
            >
              🔍 <em>{{ sug.back_translation_vi }}</em>
            </div>

            <div class="suggestion-actions">
              <button
                type="button"
                class="action-btn-insert"
                @click="applySuggestion(sug, true)"
              >
                <v-icon size="14" class="mr-1">mdi-arrow-bottom-left-thick</v-icon>
                Chèn vào chat
              </button>
              <button
                type="button"
                class="action-btn-secondary"
                title="Đưa lên ô ý trả lời phía trên để chỉnh sửa"
                @click="applySuggestion(sug, false)"
              >
                Dùng ý này để sửa
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="!loadingSuggestions" class="empty-suggest-box">
          <span>Chưa có gợi ý nào. Bấm <strong>"Gợi ý ngay"</strong> để AI đọc hội thoại và đưa ra các kịch bản đối ứng.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { api } from '@/modules/zalocrm/api/index';

const props = defineProps<{
  isActive?: boolean;
  conversation: any;
  conversationId: string | null;
  contact: any;
  messages?: any[];
}>();

const emit = defineEmits<{
  (e: 'insert-to-chat', text: string): void;
  (e: 'send-draft', text: string): void;
}>();

// ── States ───────────────────────────────────────────────────────────────────
const chatContext = ref('');
const notesVi = ref('');
const selectedTone = ref('professional');
const selectedLanguage = ref('auto');
const redactPii = ref(false);

const autoFillNotice = ref('');
let noticeTimer: any = null;

const loadingDraft = ref(false);
const draftResult = ref<{
  customer_summary_vi?: string;
  reply_language: string;
  tone?: string;
  draft: string;
  back_translation_vi: string;
  warnings_vi: string[];
} | null>(null);

const errorMessage = ref('');
const copiedDraft = ref(false);

const loadingSuggestions = ref(false);
const suggestionsStage = ref('');
const suggestionsReplyLang = ref('');
const suggestionsList = ref<Array<{
  id: string;
  strategy_type: string;
  title: string;
  intent_vi: string;
  draft: string;
  back_translation_vi: string;
}>>([]);
let draftSeq = 0;
let suggestSeq = 0;

// Dùng model gemini-3.1-flash-lite phản hồi nhanh, ổn định và đầy đủ quota
const preferredModel = ref('gemini-3.1-flash-lite');

// ── Static Options ───────────────────────────────────────────────────────────
const toneOptions = [
  {
    id: 'professional',
    label: 'Chuyên nghiệp (B2B)',
    hint: 'Trang trọng, chuẩn đối tác B2B, bố cục rõ ràng, mở & kết thư lịch sự',
  },
  {
    id: 'friendly',
    label: 'Thân thiện, cởi mở',
    hint: 'Tự nhiên như người thật đang chat (em - anh/chị), ấm áp, gần gũi',
  },
  {
    id: 'concise',
    label: 'Súc tích, ngắn gọn',
    hint: 'Bỏ toàn bộ chào hỏi/xã giao, đi thẳng thông số & câu hỏi cốt lõi (1-3 câu)',
  },
  {
    id: 'negotiation',
    label: 'Đàm phán thương mại',
    hint: 'Neo giá trị trước, đưa điều kiện có đi có lại (Give-Get) & chốt lịch xác nhận',
  },
];

const selectedToneHint = computed(
  () => toneOptions.find(t => t.id === selectedTone.value)?.hint || ''
);

const languageOptions = [
  { code: 'auto', label: '🌐 Tự nhận diện từ khách' },
  { code: 'vi', label: '🇻🇳 Tiếng Việt' },
  { code: 'en', label: '🇬🇧 Tiếng Anh (English)' },
  { code: 'zh-CN', label: '🇨🇳 Tiếng Trung (Giản thể)' },
  { code: 'zh-TW', label: '🇹🇼 Tiếng Trung (Phồn thể)' },
  { code: 'ja', label: '🇯🇵 Tiếng Nhật (Japanese)' },
  { code: 'ko', label: '🇰🇷 Tiếng Hàn (Korean)' },
  { code: 'fr', label: '🇫🇷 Tiếng Pháp (French)' },
  { code: 'es', label: '🇪🇸 Tiếng Tây Ban Nha' },
];

function resolveReplyLangLabel(code?: string): string {
  const c = code || selectedLanguage.value;
  if (c === 'auto') return 'Theo ngôn ngữ khách';
  if (c === 'vi') return '🇻🇳 Tiếng Việt';
  if (c === 'en') return '🇬🇧 Tiếng Anh';
  if (c === 'zh-CN') return '🇨🇳 Trung (Giản thể)';
  if (c === 'zh-TW') return '🇹🇼 Trung (Phồn thể)';
  if (c === 'ja') return '🇯🇵 Tiếng Nhật';
  if (c === 'ko') return '🇰🇷 Tiếng Hàn';
  if (c === 'fr') return '🇫🇷 Tiếng Pháp';
  if (c === 'es') return '🇪🇸 Tây Ban Nha';
  return c;
}

function resolveToneLabel(toneId?: string): string {
  return toneOptions.find(t => t.id === toneId)?.label || toneId || 'Chuyên nghiệp';
}

function getToneBadgeStyle(toneId?: string) {
  const styles: Record<string, { background: string; color: string }> = {
    professional: { background: '#e0f2fe', color: '#0369a1' },
    friendly: { background: '#dcfce7', color: '#15803d' },
    concise: { background: '#f3e8ff', color: '#7e22ce' },
    negotiation: { background: '#fef3c7', color: '#b45309' },
  };
  return styles[toneId || 'professional'] || styles.professional;
}

const currentLanguageShort = computed(() => {
  if (selectedLanguage.value === 'auto') return 'theo ngôn ngữ khách';
  return resolveReplyLangLabel(selectedLanguage.value);
});

function formatMessageTextForContext(m: any): string {
  const type = String(m?.contentType || '').toLowerCase();
  const rawContent = m?.content;
  let parsedObj: any = null;
  let raw = '';

  if (rawContent && typeof rawContent === 'object') {
    parsedObj = rawContent;
  } else {
    raw = String(rawContent || '').trim();
    if (raw.startsWith('{')) {
      try {
        parsedObj = JSON.parse(raw);
      } catch {}
    }
  }

  if (!raw && !parsedObj) {
    if (type === 'image') return '[Hình ảnh]';
    if (type === 'video') return '[Video]';
    if (type === 'voice' || type === 'audio') return '[Tin nhắn thoại]';
    if (type === 'file') return '[Tệp đính kèm]';
    if (type === 'sticker') return '[Sticker]';
    return '';
  }

  if (parsedObj) {
    const caption = parsedObj.caption || parsedObj.description || (parsedObj.title && !String(parsedObj.title).startsWith('{') && !String(parsedObj.title).startsWith('/uploads/') ? parsedObj.title : '');
    const fileName = parsedObj.fileName || parsedObj.filename || parsedObj.name || '';
    if (type === 'sticker' || parsedObj.isSticker) return caption ? `[Sticker: ${caption}]` : '[Sticker]';
    if (type === 'voice' || type === 'audio' || parsedObj.voiceUrl || parsedObj.audioUrl) return '[Tin nhắn thoại]';
    if (type === 'video' || parsedObj.videoUrl) return caption ? `[Video: ${caption}]` : '[Video]';
    if (type === 'image' || parsedObj.hdUrl || parsedObj.thumb || parsedObj.photoUrl || parsedObj.imageUrl) {
      return caption ? `[Hình ảnh: ${caption}]` : '[Hình ảnh]';
    }
    if (type === 'file' || fileName) return fileName ? `[Tệp: ${fileName}]${caption ? ` ${caption}` : ''}` : '[Tệp đính kèm]';
    if (parsedObj.text) return String(parsedObj.text);
    if (caption) return String(caption);
    if (parsedObj.href && /^https?:\/\//i.test(String(parsedObj.href))) return String(parsedObj.href);
    if (parsedObj.url && /^\/(?:uploads|storage|api)\//i.test(String(parsedObj.url))) return '[Tệp đính kèm]';
  }

  if (/^\/(?:uploads|storage|api)\//i.test(raw)) {
    if (type === 'video') return '[Video]';
    if (type === 'voice' || type === 'audio') return '[Tin nhắn thoại]';
    if (type === 'file') return `[Tệp: ${raw.split('/').pop() || 'file'}]`;
    return '[Hình ảnh]';
  }
  return raw;
}

// Reset state cleanly when switching conversations so Context/Draft/Suggestions never leak across customers
watch(() => props.conversationId, (newId, oldId) => {
  if (newId !== oldId) {
    draftSeq += 1;
    suggestSeq += 1;
    loadingDraft.value = false;
    loadingSuggestions.value = false;
    chatContext.value = '';
    draftResult.value = null;
    suggestionsStage.value = '';
    suggestionsReplyLang.value = '';
    suggestionsList.value = [];
    errorMessage.value = '';
    autoFillNotice.value = '';
  }
});

// ── Auto Highlight Selection Feature (Bôi đen tự động nạp tin nhắn) ───────────
function handleGlobalMouseUp(e: MouseEvent) {
  if (props.isActive === false) return;
  const target = e.target as HTMLElement | null;
  // Bỏ qua nếu người dùng bôi đen bên trong chính panel Chat AI
  if (target && target.closest('.chaten-panel')) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const anchorEl = selection.anchorNode instanceof HTMLElement
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const inThread = Boolean(target?.closest('.message-thread') || anchorEl?.closest('.message-thread'));
  if (!inThread) return;

  const selectedText = selection.toString().trim();
  if (selectedText.length >= 2) {
    chatContext.value = selectedText;

    if (noticeTimer) clearTimeout(noticeTimer);
    autoFillNotice.value = `✓ Đã nạp (${selectedText.length} ký tự)`;
    noticeTimer = setTimeout(() => {
      autoFillNotice.value = '';
    }, 2500);
  }
}

// ── Auto Load Chat Context (Chỉ khi người dùng chủ động bấm nút) ───────────────
function loadChatFromConversation() {
  const customerName =
    props.contact?.fullName ||
    props.contact?.name ||
    props.conversation?.contact?.fullName ||
    props.conversation?.threadName ||
    'Khách hàng';

  if (props.messages && props.messages.length > 0) {
    const list = props.messages.filter(m => !m.isDeleted).slice(-12);
    const lines = list.map(m => {
      const isSelf = m.senderType === 'self' || m.fromMe;
      const sender = isSelf ? 'Nhân viên' : (m.senderName || customerName);
      const text = formatMessageTextForContext(m);
      return text ? `${sender}: ${text}` : '';
    }).filter(Boolean);

    if (lines.length > 0) {
      chatContext.value = lines.join('\n');
      return;
    }
  }
  if (props.conversation) {
    chatContext.value = `${customerName}: ${props.conversation.lastMessage || 'Xin chào, tôi cần tư vấn báo giá'}`;
  }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      chatContext.value = text;
    }
  } catch {
    alert('Không thể đọc bộ nhớ tạm. Hãy dán trực tiếp bằng phím Ctrl+V / Cmd+V.');
  }
}

// ── Generate AI Draft ────────────────────────────────────────────────────────
async function generateDraft() {
  if (!notesVi.value.trim()) return;

  const cid = props.conversationId || (props.conversation?.id) || 'general';
  const seq = ++draftSeq;
  loadingDraft.value = true;
  errorMessage.value = '';
  draftResult.value = null;

  try {
    const payload = {
      chat_context: chatContext.value,
      notes_vi: notesVi.value,
      tone: selectedTone.value,
      target_language: selectedLanguage.value,
      redact_pii: redactPii.value,
      model: preferredModel.value
    };

    const res = await api.post(`/conversations/${cid}/chat-ai/draft`, payload);
    if (seq !== draftSeq || (props.conversationId || props.conversation?.id || 'general') !== cid) return;

    const data = res.data;
    if (data.ok && data.data) {
      draftResult.value = data.data;
    } else {
      errorMessage.value = data.error || 'Không thể tạo bản nháp. Vui lòng thử lại.';
    }
  } catch (err: any) {
    if (seq !== draftSeq || (props.conversationId || props.conversation?.id || 'general') !== cid) return;
    console.error('Chat AI Generate Error:', err);
    errorMessage.value = err.response?.data?.error || err.message || 'Lỗi kết nối máy chủ AI.';
  } finally {
    if (seq === draftSeq) {
      loadingDraft.value = false;
    }
  }
}

// ── Generate AI Suggestions ──────────────────────────────────────────────────
async function fetchSuggestions() {
  const cid = props.conversationId || (props.conversation?.id) || 'general';
  const seq = ++suggestSeq;
  loadingSuggestions.value = true;
  errorMessage.value = '';

  try {
    const customerName =
      props.contact?.fullName ||
      props.contact?.name ||
      props.conversation?.contact?.fullName ||
      'Khách hàng';
    const fallbackContext = cid === 'general' && props.conversation?.lastMessage
      ? `${customerName}: ${formatMessageTextForContext({ content: props.conversation.lastMessage })}`
      : '';
    const payload = {
      chat_context: chatContext.value || fallbackContext,
      tone: selectedTone.value,
      target_language: selectedLanguage.value,
      model: preferredModel.value
    };

    const res = await api.post(`/conversations/${cid}/chat-ai/suggest`, payload);
    if (seq !== suggestSeq || (props.conversationId || props.conversation?.id || 'general') !== cid) return;

    const data = res.data;
    if (data.ok && data.data) {
      suggestionsStage.value = data.data.stage || data.data.context_stage || '';
      suggestionsReplyLang.value = data.data.reply_language || '';
      suggestionsList.value = data.data.suggestions || [];
    } else {
      errorMessage.value = data.error || 'Không thể tạo gợi ý.';
    }
  } catch (err: any) {
    if (seq !== suggestSeq || (props.conversationId || props.conversation?.id || 'general') !== cid) return;
    console.error('Chat AI Suggestions Error:', err);
    errorMessage.value = err.response?.data?.error || err.message || 'Lỗi khi lấy gợi ý.';
  } finally {
    if (seq === suggestSeq) {
      loadingSuggestions.value = false;
    }
  }
}

function applySuggestion(sug: any, directInsert: boolean) {
  if (directInsert) {
    emit('insert-to-chat', sug.draft);
  } else {
    notesVi.value = sug.intent_vi || sug.back_translation_vi || sug.draft || '';
  }
}

function getStrategyColor(type: string) {
  const map: Record<string, string> = {
    pricing: '#b45309',
    clarification: '#0369a1',
    sample: '#4338ca',
    closing: '#15803d',
    followup: '#6b7280'
  };
  return map[type] || '#006938';
}

function getStrategyBg(type: string) {
  const map: Record<string, string> = {
    pricing: '#fef3c7',
    clarification: '#e0f2fe',
    sample: '#e0e7ff',
    closing: '#dcfce7',
    followup: '#f3f4f6'
  };
  return map[type] || '#e6f4ea';
}

function getStrategyLabel(type: string) {
  const map: Record<string, string> = {
    pricing: 'Báo giá',
    clarification: 'Hỏi rõ',
    sample: 'Mẫu thử',
    closing: 'Chốt đơn',
    followup: 'Theo dõi'
  };
  return map[type] || type;
}

// ── Output Actions ───────────────────────────────────────────────────────────
function insertToChat() {
  if (draftResult.value?.draft) {
    emit('insert-to-chat', draftResult.value.draft);
  }
}

function sendDraftDirectly() {
  if (draftResult.value?.draft) {
    emit('send-draft', draftResult.value.draft);
  }
}

async function copyDraft() {
  if (!draftResult.value?.draft) return;
  try {
    await navigator.clipboard.writeText(draftResult.value.draft);
    copiedDraft.value = true;
    setTimeout(() => {
      copiedDraft.value = false;
    }, 2000);
  } catch {
    alert('Không thể sao chép vào bộ nhớ tạm.');
  }
}

onMounted(() => {
  // MẶC ĐỊNH ĐỂ TRỐNG (Yêu cầu 3) - Không tự động nạp chatContext
  window.addEventListener('mouseup', handleGlobalMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mouseup', handleGlobalMouseUp);
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<style scoped>
.chaten-panel {
  font-family: inherit;
  color: #1e293b;
  height: 100%;
}

.chaten-scroll {
  padding: 18px 16px 36px 16px !important;
}

/* ── Step Cards ────────────────────────────────────────── */
.step-card {
  background: #ffffff;
  margin-bottom: 20px !important;
}

.step-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 9px;
  gap: 8px;
}

.step-title-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  min-width: 18px;
  border-radius: 4px;
  background: rgba(0, 105, 56, 0.12);
  color: #006938;
  font-size: 10.5px;
  font-weight: 700;
}

.step-title {
  font-weight: 700;
  font-size: 12.5px;
  color: #1e293b;
}

.step-hint {
  font-size: 10.5px;
  color: #64748b;
  font-style: italic;
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.auto-fill-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 12px;
  background: #dcfce7;
  color: #15803d;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  box-shadow: 0 1px 3px rgba(21, 128, 61, 0.15);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

.step-btn-primary {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 5px;
  background: rgba(0, 105, 56, 0.1);
  color: #006938;
  border: 1px solid rgba(0, 105, 56, 0.25);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  height: 25px;
  transition: all 0.15s ease;
}

.step-btn-primary:hover:not(:disabled) {
  background: rgba(0, 105, 56, 0.18);
}

.step-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  border-radius: 5px;
  background: transparent;
  color: #64748b;
  border: 1px solid rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: all 0.15s ease;
}

.step-btn-icon:hover {
  background: #f1f5f9;
  color: #1e293b;
}

/* ── Options Box (Tone & Language) ─────────────────────── */
.options-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 20px !important;
}

.options-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.option-item {
  flex: 1 1 130px;
  min-width: 0;
}

.option-label {
  display: flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 6px;
  white-space: nowrap;
}

.clean-native-select {
  width: 100%;
  height: 36px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.clean-native-select:focus {
  border-color: #006938;
  box-shadow: 0 0 0 2px rgba(0, 105, 56, 0.15);
}

.tone-guide-hint {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 9px;
  padding: 7px 9px;
  border-radius: 6px;
  background: rgba(0, 105, 56, 0.06);
  border: 1px solid rgba(0, 105, 56, 0.14);
  font-size: 11px;
  line-height: 1.4;
  color: #334155;
}

.tone-result-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e0f2fe;
  color: #0369a1;
  white-space: nowrap;
}

.context-summary-chip {
  font-size: 11px;
  line-height: 1.4;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 8px;
}

/* ── Submit Button ─────────────────────────────────────── */
.chaten-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  border-radius: 8px;
  background: linear-gradient(135deg, #006938 0%, #004d2a 100%);
  color: #ffffff;
  border: none;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 105, 56, 0.22);
  margin-bottom: 24px !important;
  transition: all 0.15s ease;
}

.chaten-submit-btn:hover:not(:disabled) {
  opacity: 0.96;
  box-shadow: 0 4px 10px rgba(0, 105, 56, 0.32);
}

.chaten-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* ── Output Stack (Đã bỏ Image 5) ──────────────────────── */
.output-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 24px !important;
}

.draft-box {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.draft-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 7px;
}

.draft-title {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: #006938;
}

.send-ready-badge {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  background: #dcfce7;
  color: #15803d;
  letter-spacing: 0.3px;
}

.action-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.action-btn-insert {
  flex: 1 1 110px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 5px;
  background: #006938;
  color: #ffffff;
  border: none;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn-insert:hover {
  background: #00502b;
}

.action-btn-send {
  flex: 0 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 5px;
  background: transparent;
  color: #006938;
  border: 1px solid #006938;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn-send:hover {
  background: rgba(0, 105, 56, 0.08);
}

.action-btn-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn-copy:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.back-trans-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}

.back-trans-header {
  display: flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 4px;
}

.back-trans-body {
  font-size: 11.5px;
  color: #334155;
  line-height: 1.5;
  white-space: pre-wrap;
}

.warnings-box {
  background: #fefce8;
  border: 1px solid #fde047;
  border-radius: 8px;
  padding: 10px 12px;
}

.warnings-header {
  display: flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 700;
  color: #854d0e;
  margin-bottom: 4px;
}

.warnings-list {
  font-size: 11px;
  color: #713f12;
  margin: 0;
  padding-left: 16px;
  line-height: 1.5;
}

/* ── Suggestions Section (Đã gộp) ──────────────────────── */
.suggestions-unified-section {
  margin-top: 10px;
  padding-top: 22px;
  border-top: 1px solid #e2e8f0 !important;
}

.suggest-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.suggest-header-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.suggest-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.suggest-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.35;
}

.suggest-now-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 11px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 6px;
  background: rgba(0, 105, 56, 0.1);
  color: #006938;
  border: 1px solid rgba(0, 105, 56, 0.25);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.suggest-now-btn:hover:not(:disabled) {
  background: rgba(0, 105, 56, 0.18);
}

.suggest-now-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-suggest-box {
  padding: 16px 16px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.5;
  text-align: center;
}

.suggestions-stack {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.suggestion-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.suggestion-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 5px;
}

.suggestion-title {
  font-weight: 700;
  font-size: 12px;
  color: #006938;
}

.strategy-badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.suggestion-intent {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 6px;
}

.suggestion-draft {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  padding: 7px 9px;
  font-family: monospace;
  font-size: 11.5px;
  color: #0f172a;
  line-height: 1.45;
  margin-bottom: 6px;
  white-space: pre-wrap;
}

.suggestion-trans {
  font-size: 11px;
  color: #475569;
  margin-bottom: 7px;
}

.suggestion-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.action-btn-secondary {
  flex: 0 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn-secondary:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.stage-pill {
  padding: 4px 8px;
  border-radius: 5px;
  background: #f1f5f9;
  font-size: 11px;
  color: #334155;
  border: 1px solid #e2e8f0;
}

/* ── Form Inputs ───────────────────────────────────────── */
.chaten-textarea :deep(.v-field__input) {
  font-size: 12.5px !important;
  line-height: 1.45 !important;
  padding: 8px 10px !important;
}

.chaten-textarea--context :deep(.v-field__input) {
  min-height: 105px !important;
}

.chaten-textarea--notes :deep(.v-field__input) {
  min-height: 160px !important;
}

.chaten-output-textarea :deep(.v-field__input) {
  font-size: 12.5px !important;
  line-height: 1.45 !important;
  font-family: monospace !important;
  padding: 8px 10px !important;
  min-height: 160px !important;
}

.chaten-scroll::-webkit-scrollbar {
  width: 4px;
}

.chaten-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}
</style>
