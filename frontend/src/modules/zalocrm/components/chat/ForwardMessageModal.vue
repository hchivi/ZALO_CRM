<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 560"
    scrollable
  >
    <v-card
      :rounded="mobile ? '0' : 'xl'"
      class="d-flex flex-column forward-dialog-card"
      :style="{ maxHeight: mobile ? '100dvh' : '85dvh' }"
    >
      <!-- Header -->
      <v-card-title class="d-flex align-center justify-space-between pa-3 pa-sm-4 border-b" style="gap: 8px;">
        <div class="d-flex align-center" style="gap: 8px; min-width: 0; flex: 1;">
          <v-icon color="primary" size="22" class="flex-shrink-0">mdi-share</v-icon>
          <span class="text-subtitle-1 font-weight-bold text-truncate">Chuyển tiếp tin nhắn</span>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" class="flex-shrink-0" @click="$emit('update:modelValue', false)" />
      </v-card-title>

      <!-- Message Preview Box -->
      <div v-if="targetMessages.length === 1" class="pa-3 bg-surface-variant-opacity border-b">
        <div class="text-caption font-weight-bold mb-1 d-flex align-center" style="color: rgba(var(--v-theme-on-surface), 0.7); gap: 4px;">
          <v-icon size="14">mdi-message-text-outline</v-icon>
          <span>Nội dung chuyển tiếp:</span>
        </div>
        
        <!-- Sticker Preview -->
        <div v-if="getStickerUrl(targetMessages[0])" class="forward-preview-image d-flex align-center pa-2 rounded-lg" style="background: rgba(var(--v-theme-surface), 0.8); border: 1px solid rgba(var(--v-border-color), 0.12); gap: 12px;">
          <img :src="getStickerUrl(targetMessages[0])!" alt="Sticker chuyển tiếp" class="forward-img-thumb rounded flex-shrink-0" />
          <div class="flex-grow-1 text-truncate" style="min-width: 0;">
            <div class="text-body-2 font-weight-medium">[Sticker]</div>
          </div>
        </div>

        <!-- Image Preview -->
        <div v-else-if="getImageUrl(targetMessages[0])" class="forward-preview-image d-flex align-center pa-2 rounded-lg" style="background: rgba(var(--v-theme-surface), 0.8); border: 1px solid rgba(var(--v-border-color), 0.12); gap: 12px;">
          <img :src="getImageUrl(targetMessages[0])!" alt="Ảnh chuyển tiếp" class="forward-img-thumb rounded flex-shrink-0" />
          <div class="flex-grow-1 text-truncate" style="min-width: 0;">
            <div class="text-body-2 font-weight-medium">[Hình ảnh]</div>
            <div v-if="getImageCaption(targetMessages[0])" class="text-caption text-truncate" style="opacity: 0.75;">
              {{ getImageCaption(targetMessages[0]) }}
            </div>
          </div>
        </div>

        <!-- Video Preview -->
        <div v-else-if="getVideoInfo(targetMessages[0])" class="forward-preview-image d-flex align-center pa-2 rounded-lg" style="background: rgba(var(--v-theme-surface), 0.8); border: 1px solid rgba(var(--v-border-color), 0.12); gap: 12px;">
          <div class="position-relative d-flex align-center justify-center rounded overflow-hidden flex-shrink-0" style="width: 54px; height: 54px; background: #1a1a1a;">
            <img v-if="getVideoInfo(targetMessages[0])!.thumb" :src="getVideoInfo(targetMessages[0])!.thumb" alt="Video thumbnail" class="w-100 h-100" style="object-fit: cover; opacity: 0.85;" />
            <v-icon color="white" size="26" class="position-absolute" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));">mdi-play-circle</v-icon>
          </div>
          <div class="flex-grow-1 text-truncate" style="min-width: 0;">
            <div class="text-body-2 font-weight-medium d-flex align-center" style="gap: 4px;">
              <v-icon size="16" color="primary">mdi-video</v-icon>
              <span>[Video]</span>
            </div>
            <div class="text-caption text-truncate" style="opacity: 0.75;">
              {{ getVideoInfo(targetMessages[0])!.title }}
            </div>
          </div>
        </div>

        <!-- Voice Preview -->
        <div v-else-if="getVoiceInfo(targetMessages[0])" class="d-flex align-center pa-2 rounded-lg" style="background: rgba(var(--v-theme-surface), 0.8); border: 1px solid rgba(var(--v-border-color), 0.12); gap: 10px;">
          <v-icon color="primary" size="24" class="flex-shrink-0">mdi-microphone</v-icon>
          <div class="flex-grow-1 text-truncate" style="min-width: 0;">
            <div class="text-body-2 font-weight-medium">[Tin nhắn thoại]</div>
            <div v-if="getVoiceInfo(targetMessages[0])!.durationText" class="text-caption" style="opacity: 0.7;">
              {{ getVoiceInfo(targetMessages[0])!.durationText }}
            </div>
          </div>
        </div>

        <!-- Contact Card Preview -->
        <div v-else-if="getContactCardPreview(targetMessages[0])" class="d-flex align-center pa-2 rounded-lg" style="background: rgba(var(--v-theme-surface), 0.8); border: 1px solid rgba(var(--v-border-color), 0.12); gap: 10px;">
          <v-icon color="success" size="24" class="flex-shrink-0">mdi-card-account-details-outline</v-icon>
          <div class="flex-grow-1 text-truncate" style="min-width: 0;">
            <div class="text-body-2 font-weight-medium text-truncate">
              [Danh thiếp] {{ getContactCardPreview(targetMessages[0])!.name }}
            </div>
            <div v-if="getContactCardPreview(targetMessages[0])!.phone" class="text-caption" style="opacity: 0.7;">
              {{ getContactCardPreview(targetMessages[0])!.phone }}
            </div>
          </div>
        </div>

        <!-- File Preview -->
        <div v-else-if="getFileInfo(targetMessages[0])" class="d-flex align-center pa-2 rounded-lg" style="background: rgba(var(--v-theme-surface), 0.8); border: 1px solid rgba(var(--v-border-color), 0.12); gap: 10px;">
          <v-icon color="info" size="24" class="flex-shrink-0">mdi-file-document-outline</v-icon>
          <div class="flex-grow-1 text-truncate" style="min-width: 0;">
            <div class="text-body-2 font-weight-medium text-truncate">{{ getFileInfo(targetMessages[0])!.name }}</div>
            <div class="text-caption" style="opacity: 0.7;">{{ getFileInfo(targetMessages[0])!.size }}</div>
          </div>
        </div>

        <!-- Text Preview -->
        <div v-else class="forward-preview-text pa-2.5 px-3 rounded-lg text-body-2" style="background: rgba(var(--v-theme-surface), 0.8); border: 1px solid rgba(var(--v-border-color), 0.12); max-height: 120px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;">
          {{ getCleanTextPreview(targetMessages[0]) }}
        </div>
      </div>

      <!-- Multiple Messages Preview Box -->
      <div v-else-if="targetMessages.length > 1" class="pa-3 bg-surface-variant-opacity border-b">
        <div class="d-flex align-center pa-2.5 rounded-lg" style="background: rgba(var(--v-theme-surface), 0.8); border: 1px solid rgba(var(--v-border-color), 0.12); gap: 10px;">
          <v-icon color="primary" size="24">mdi-checkbox-multiple-marked-outline</v-icon>
          <div class="text-body-2 font-weight-medium">
            Chuyển tiếp <strong>{{ targetMessages.length }}</strong> tin nhắn đã chọn
          </div>
        </div>
      </div>

      <!-- Search Input -->
      <div class="pa-3 border-b">
        <v-text-field
          v-model="searchQuery"
          placeholder="Tìm tên khách hàng, số điện thoại, nhóm..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          rounded="lg"
          clearable
          autocomplete="off"
        />
      </div>

      <!-- Conversations Selection List -->
      <v-card-text class="pa-0 flex-grow-1 overflow-y-auto" style="min-height: 220px; max-height: 340px;">
        <v-progress-linear v-if="loadingConvs" indeterminate color="primary" />

        <div v-if="filteredConversations.length === 0 && !loadingConvs" class="pa-8 text-center text-medium-emphasis">
          <v-icon size="36" class="mb-2" style="opacity: 0.5;">mdi-account-search-outline</v-icon>
          <div class="text-body-2">Không tìm thấy cuộc trò chuyện phù hợp</div>
        </div>

        <v-list v-else lines="two" class="py-1">
          <v-list-item
            v-for="conv in filteredConversations"
            :key="conv.id"
            :value="conv.id"
            class="px-4 py-2 cursor-pointer conversation-select-item"
            :class="{ 'selected-conv': selectedConvIds.includes(conv.id) }"
            @click="toggleSelection(conv.id)"
          >
            <!-- Checkbox -->
            <template #prepend>
              <v-checkbox-btn
                :model-value="selectedConvIds.includes(conv.id)"
                color="primary"
                class="mr-2"
                density="compact"
              />
              <v-avatar size="36" class="mr-3">
                <v-img v-if="getAvatar(conv)" :src="getAvatar(conv) || ''" :alt="getDisplayName(conv)" />
                <span v-else class="font-weight-bold text-white text-caption" :style="{ backgroundColor: getStaffColor(getDisplayName(conv)) }">
                  {{ (getDisplayName(conv) || '?')[0].toUpperCase() }}
                </span>
              </v-avatar>
            </template>

            <!-- Title & Subtitle -->
            <v-list-item-title class="font-weight-medium text-body-2 d-flex align-center" style="gap: 6px;">
              <span class="text-truncate">{{ getDisplayName(conv) }}</span>
              <v-chip
                v-if="conv.threadType === 'group'"
                size="x-small"
                variant="tonal"
                color="info"
                class="px-1.5"
                style="height: 18px; font-size: 0.65rem;"
              >
                Nhóm
              </v-chip>
            </v-list-item-title>

            <v-list-item-subtitle class="text-caption mt-0.5 text-medium-emphasis text-truncate">
              {{ conv.contact?.phone || conv.zaloAccount?.displayName || 'Cuộc trò chuyện Zalo' }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>

      <!-- Optional Extra Message Input -->
      <div class="pa-3 border-t bg-surface-variant-opacity">
        <v-textarea
          v-model="extraText"
          placeholder="Lời nhắn kèm (không bắt buộc)..."
          variant="outlined"
          density="compact"
          rows="1"
          max-rows="3"
          auto-grow
          hide-details
          rounded="lg"
        />
      </div>

      <!-- Error banner -->
      <v-alert
        v-if="forwardError"
        type="error"
        variant="tonal"
        density="compact"
        closable
        class="mx-3 mt-2"
        @click:close="forwardError = ''"
      >
        {{ forwardError }}
      </v-alert>

      <!-- Footer Buttons -->
      <v-card-actions class="pa-3 px-4 border-t d-flex flex-wrap align-center justify-space-between" style="gap: 8px;">
        <div class="text-caption text-medium-emphasis font-weight-medium">
          <span v-if="selectedConvIds.length > 0">Đã chọn: <strong>{{ selectedConvIds.length }}</strong> hội thoại</span>
          <span v-else>Chọn người nhận để chuyển tiếp</span>
        </div>
        <div class="d-flex align-center" style="gap: 8px;">
          <v-btn
            variant="text"
            rounded="lg"
            :disabled="forwarding"
            @click="$emit('update:modelValue', false)"
          >
            Hủy
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            prepend-icon="mdi-send"
            :loading="forwarding"
            :disabled="selectedConvIds.length === 0 || targetMessages.length === 0"
            @click="handleForward"
          >
            Chuyển tiếp
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDisplay } from 'vuetify';
import type { Message, Conversation } from '@/modules/zalocrm/composables/use-chat';
import { api } from '@/modules/zalocrm/api/index';
import {
  getVideoInfo as extractVideoInfo,
  getVoiceInfo as extractVoiceInfo,
  getFileInfo as extractFileInfo,
  getImageUrl as extractImageUrl,
  getImageCaption as extractImageCaption,
  getStickerUrl as extractStickerUrl,
  sanitizeMediaCaption,
} from '@/modules/zalocrm/utils/message-media';

const props = defineProps<{
  modelValue: boolean;
  message?: Message | null;
  messages?: Message[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'forward-success': [count: number];
}>();

const { mobile } = useDisplay();

const targetMessages = computed<Message[]>(() => {
  if (props.messages && props.messages.length > 0) {
    return props.messages;
  }
  if (props.message) {
    return [props.message];
  }
  return [];
});

const conversations = ref<Conversation[]>([]);
const loadingConvs = ref(false);
const searchQuery = ref('');
const selectedConvIds = ref<string[]>([]);
const extraText = ref('');
const forwarding = ref(false);
const forwardError = ref('');

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    selectedConvIds.value = [];
    extraText.value = '';
    searchQuery.value = '';
    forwardError.value = '';
    loadConversations();
  }
});

async function loadConversations() {
  loadingConvs.value = true;
  try {
    const res = await api.get('/conversations', { params: { limit: 100 } });
    conversations.value = res.data.conversations || [];
  } catch (err) {
    console.error('Failed to load conversations for forward:', err);
  } finally {
    loadingConvs.value = false;
  }
}

const filteredConversations = computed(() => {
  if (!searchQuery.value?.trim()) return conversations.value;
  const q = searchQuery.value.trim().toLowerCase();
  return conversations.value.filter((c: Conversation) => {
    const name = getDisplayName(c).toLowerCase();
    const phone = (c.contact?.phone || '').toLowerCase();
    const acc = (c.zaloAccount?.displayName || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || acc.includes(q);
  });
});

function toggleSelection(id: string) {
  const idx = selectedConvIds.value.indexOf(id);
  if (idx >= 0) {
    selectedConvIds.value.splice(idx, 1);
  } else {
    selectedConvIds.value.push(id);
  }
}

function getDisplayName(c: Conversation): string {
  if (c.contact?.fullName) return c.contact.fullName;
  if (c.groupName) return c.groupName;
  return c.contact?.phone || 'Khách hàng';
}

function getAvatar(c: Conversation): string | null {
  return c.contact?.avatarUrl || null;
}

function getStickerUrl(msg: Message | null): string | null {
  return extractStickerUrl(msg);
}

function getVideoInfo(msg: Message | null): { url: string; thumb: string; title: string } | null {
  const info = extractVideoInfo(msg);
  if (!info) return null;
  return {
    url: info.url,
    thumb: info.thumb,
    title: info.caption || 'Video',
  };
}

function getImageUrl(msg: Message | null): string | null {
  return extractImageUrl(msg);
}

function getImageCaption(msg: Message | null): string | null {
  return extractImageCaption(msg);
}

function getCleanTextPreview(msg: Message | null): string {
  if (!msg) return '';
  if (extractStickerUrl(msg)) return '[Sticker]';
  const content = (msg.content || '').trim();
  if (!content) return '';
  if (content.startsWith('/storage/') || content.startsWith('/uploads/') || content.startsWith('/api/')) {
    if (/\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(content)) return '[Video]';
    if (/\.(aac|m4a|mp3|ogg|opus|wav)(\?|$)/i.test(content)) return '[Tin nhắn thoại]';
    if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|txt)(\?|$)/i.test(content)) return '[Tệp đính kèm]';
    return '[Hình ảnh]';
  }
  if (content.startsWith('{')) {
    try {
      const p = JSON.parse(content);
      const txt =
        sanitizeMediaCaption(p.title) ||
        sanitizeMediaCaption(p.description) ||
        sanitizeMediaCaption(p.msg) ||
        sanitizeMediaCaption(p.caption) ||
        '';
      if (txt) return txt;
      if (typeof p.href === 'string' && p.href.trim()) return p.href.trim();
      if (typeof p.localUrl === 'string' && p.localUrl.trim()) return '[Tệp đính kèm]';
    } catch {}
    if (content.includes('zdn.vn') || /\.(jpg|jpeg|png|webp|gif)/i.test(content)) {
      return '[Hình ảnh]';
    }
    if (/\.(pdf|doc|docx|xls|xlsx|zip)/i.test(content)) {
      return '[Tệp đính kèm]';
    }
    const match = content.match(/https?:\/\/[^\s"'<>\\]+/);
    if (match) return match[0];
    return '[Tin nhắn]';
  }
  return content;
}

function getFileInfo(msg: Message | null): { name: string; size: string } | null {
  return extractFileInfo(msg);
}

function getVoiceInfo(msg: Message | null) {
  return extractVoiceInfo(msg);
}

function getContactCardPreview(msg: Message | null): { name: string; phone?: string } | null {
  if (!msg) return null;
  const meta = (msg.metadata || {}) as any;
  if (meta?.contactCard) {
    return {
      name: meta.contactCard.name || meta.contactCard.displayName || 'Liên hệ',
      phone: meta.contactCard.phone || undefined,
    };
  }
  if (msg.contentType === 'contact_card') {
    return { name: msg.content || 'Liên hệ' };
  }
  return null;
}

function getStaffColor(name: string | null | undefined): string {
  if (!name) return '#007AFF';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#0284C7', '#2563EB', '#D97706', '#7C3AED', '#059669', '#E11D48', '#EA580C', '#0D9488'];
  return colors[Math.abs(hash) % colors.length];
}

async function handleForward() {
  if (targetMessages.value.length === 0 || selectedConvIds.value.length === 0) return;
  forwarding.value = true;
  forwardError.value = '';
  try {
    let totalForwarded = 0;
    for (let i = 0; i < targetMessages.value.length; i++) {
      const msg = targetMessages.value[i];
      const isLast = i === targetMessages.value.length - 1;
      const res = await api.post('/conversations/forward', {
        targetConversationIds: selectedConvIds.value,
        messageId: msg.id,
        extraText: isLast && extraText.value?.trim() ? extraText.value.trim() : undefined,
      });
      totalForwarded += Number(res.data?.forwardedCount ?? 0);
    }
    if (totalForwarded > 0) {
      emit('forward-success', totalForwarded);
      emit('update:modelValue', false);
    } else {
      forwardError.value = 'Không thể chuyển tiếp tin nhắn tới cuộc trò chuyện đã chọn.';
    }
  } catch (err: any) {
    console.error('Forward failed:', err);
    forwardError.value = err?.response?.data?.error || 'Chuyển tiếp tin nhắn thất bại. Vui lòng thử lại.';
  } finally {
    forwarding.value = false;
  }
}
</script>

<style scoped>
.forward-dialog-card {
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22) !important;
}

.conversation-select-item {
  transition: background-color 0.15s ease;
}

.conversation-select-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.selected-conv {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}

.forward-img-thumb {
  width: 52px;
  height: 52px;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.bg-surface-variant-opacity {
  background-color: rgba(var(--v-theme-surface-variant), 0.35);
}
</style>
