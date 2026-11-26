<template>
  <div
    :id="`msg-${msg.id}`"
    class="mb-2 d-flex message-row position-relative align-end"
    :class="[
      msg.senderType === 'self' ? 'justify-end' : 'justify-start',
      { 'multi-select-mode-active': isMultiSelectMode }
    ]"
    @click="isMultiSelectMode ? $emit('toggle-select', msg) : undefined"
  >
    <!-- Checkbox when in multi-select mode -->
    <div
      v-if="isMultiSelectMode"
      class="d-flex align-center mr-2 flex-shrink-0 cursor-pointer mb-2"
      style="order: 0;"
      @click.stop="$emit('toggle-select', msg)"
    >
      <v-checkbox-btn
        :model-value="isSelected"
        color="primary"
        density="compact"
      />
    </div>

    <!-- OUTSIDE ACTION BUTTONS -->
    <div
      v-if="!msg.isDeleted && !isMultiSelectMode"
      class="message-outside-actions d-flex align-center mb-1.5"
      :style="{
        order: msg.senderType === 'self' ? 1 : 2,
        marginLeft: msg.senderType === 'self' ? '0' : '8px',
        marginRight: msg.senderType === 'self' ? '8px' : '0',
      }"
    >
      <!-- 1. Trả lời (Quote) -->
      <button class="msg-outside-btn" title="Trả lời tin nhắn" @click.stop="$emit('reply', msg)">
        <v-icon size="14">mdi-format-quote-close</v-icon>
      </button>

      <!-- 2. Chuyển tiếp (Forward) -->
      <button class="msg-outside-btn" title="Chuyển tiếp" @click.stop="$emit('forward', msg)">
        <v-icon size="14">mdi-share</v-icon>
      </button>

      <!-- 3. Ba chấm ... -->
      <v-menu
        :location="msg.senderType === 'self' ? 'top end' : 'top start'"
        :close-on-content-click="true"
        offset="6"
      >
        <template #activator="{ props: menuProps }">
          <button class="msg-outside-btn" title="Thêm tùy chọn" v-bind="menuProps" @click.stop>
            <v-icon size="14">mdi-dots-horizontal</v-icon>
          </button>
        </template>

        <v-list density="compact" class="py-1 message-zalo-menu-list rounded-xl" elevation="10" min-width="190" max-width="calc(100vw - 24px)">
          <v-list-item density="compact" class="zalo-menu-item" @click="$emit('copy', msg)">
            <template #prepend><v-icon size="17" class="mr-2.5">mdi-content-copy</v-icon></template>
            <v-list-item-title class="text-caption font-weight-medium">Copy tin nhắn</v-list-item-title>
          </v-list-item>

          <v-list-item density="compact" class="zalo-menu-item" @click="$emit('pin', msg)">
            <template #prepend><v-icon size="17" class="mr-2.5">mdi-pin-outline</v-icon></template>
            <v-list-item-title class="text-caption font-weight-medium">Ghim tin nhắn</v-list-item-title>
          </v-list-item>

          <v-list-item density="compact" class="zalo-menu-item" @click="$emit('star', msg)">
            <template #prepend><v-icon size="17" class="mr-2.5">mdi-star-outline</v-icon></template>
            <v-list-item-title class="text-caption font-weight-medium">Đánh dấu tin nhắn</v-list-item-title>
          </v-list-item>

          <v-list-item density="compact" class="zalo-menu-item" @click="$emit('multi-select', msg)">
            <template #prepend><v-icon size="17" class="mr-2.5">mdi-format-list-checks</v-icon></template>
            <v-list-item-title class="text-caption font-weight-medium">Chọn nhiều tin nhắn</v-list-item-title>
          </v-list-item>

          <v-list-item density="compact" class="zalo-menu-item" @click="$emit('details', msg)">
            <template #prepend><v-icon size="17" class="mr-2.5">mdi-information-outline</v-icon></template>
            <v-list-item-title class="text-caption font-weight-medium">Xem chi tiết</v-list-item-title>
          </v-list-item>

          <v-menu :location="mobile ? 'bottom' : (msg.senderType === 'self' ? 'start top' : 'end top')" :close-on-content-click="true" offset="4" :open-on-hover="!mobile" :open-on-click="true">
            <template #activator="{ props: subMenuProps }">
              <v-list-item density="compact" class="zalo-menu-item" v-bind="subMenuProps">
                <template #prepend><v-icon size="17" class="mr-2.5">mdi-dots-horizontal-circle-outline</v-icon></template>
                <v-list-item-title class="text-caption font-weight-medium">Tuỳ chọn khác</v-list-item-title>
                <template #append><v-icon size="14">mdi-chevron-right</v-icon></template>
              </v-list-item>
            </template>
            <v-list density="compact" class="py-1 message-zalo-menu-list rounded-xl" elevation="10" min-width="170" max-width="calc(100vw - 24px)">
              <v-list-item density="compact" class="zalo-menu-item" @click="$emit('appointment', msg)">
                <template #prepend><v-icon size="16" class="mr-2">mdi-calendar-clock</v-icon></template>
                <v-list-item-title class="text-caption font-weight-medium">Tạo nhắc hẹn</v-list-item-title>
              </v-list-item>
              <v-list-item
                v-if="msg.senderType === 'self' && !msg.isDeleted"
                density="compact"
                class="zalo-menu-item menu-item-danger"
                @click="$emit('recall', msg)"
              >
                <template #prepend><v-icon size="16" class="mr-2 action-danger-icon">mdi-backup-restore</v-icon></template>
                <v-list-item-title class="text-caption font-weight-medium action-danger-text">Thu hồi</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <v-divider class="my-1 opacity-20" />

          <v-list-item density="compact" class="zalo-menu-item menu-item-danger" @click="$emit('delete-only-me', msg)">
            <template #prepend><v-icon size="17" class="mr-2.5 action-danger-icon">mdi-delete-outline</v-icon></template>
            <v-list-item-title class="text-caption font-weight-medium action-danger-text">Xóa chỉ ở phía tôi</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Message bubble wrapper -->
    <div class="message-wrapper position-relative" :style="{ order: msg.senderType === 'self' ? 2 : 1 }">
      <div v-if="conversation?.threadType === 'group' && msg.senderType !== 'self'" class="text-caption mb-1 font-weight-medium text-primary">
        {{ msg.senderName || 'Unknown' }}
      </div>
      <div
        class="message-bubble position-relative"
        :class="[
          msg.senderType === 'self' ? 'staff-bubble' : 'customer-bubble',
          stickerUrl
            ? 'pa-0 sticker-bubble'
            : (hasContactCard
                ? 'pa-0 contact-card-bubble'
                : (renderImageUrl ? 'pa-0 image-bubble' : 'pa-3 px-4')),
          renderImageUrl && msg.senderType === 'self' ? 'image-bubble-self' : '',
          hasContactCard && msg.senderType === 'self' ? 'contact-bubble-self' : ''
        ]"
        style="word-wrap: break-word;"
      >
        <!-- Forwarded Header Tag -->
        <div v-if="forwardInfo" class="forwarded-tag mb-1.5 d-flex align-center">
          <v-icon size="12" class="mr-1" style="opacity: 0.75;">mdi-share-outline</v-icon>
          <span class="text-caption font-italic" style="font-size: 0.72rem; opacity: 0.85;">
            Đã chuyển tiếp{{ forwardInfo.originalSender ? ` từ ${forwardInfo.originalSender}` : '' }}
          </span>
        </div>

        <!-- Quoted Reply Box -->
        <div
          v-if="quoteInfo"
          class="quote-reply-box mb-2 cursor-pointer"
          @click="$emit('scroll-to-quote', quoteInfo)"
          title="Nhấn để xem tin nhắn gốc"
        >
          <div class="quote-reply-content">
            <div class="quote-reply-author">
              <v-icon size="11" class="mr-1">mdi-reply</v-icon>
              <span>{{ quoteInfo.fromD || 'Tin nhắn trả lời' }}</span>
            </div>
            <div class="quote-reply-snippet">
              {{ quoteSnippet }}
            </div>
          </div>
        </div>

        <!-- Deleted -->
        <div v-if="msg.isDeleted" class="recalled-message-box d-flex align-center font-italic text-medium-emphasis py-1" style="opacity: 0.8; gap: 6px;">
          <v-icon size="16" class="opacity-70">mdi-delete-clock-outline</v-icon>
          <span class="text-body-2">{{ deletedDisplay }}</span>
        </div>

        <!-- Call notification card -->
        <div v-else-if="callInfo" class="call-card pa-2.5 rounded-lg border d-flex align-center" :class="callInfo.isMissed ? 'call-missed' : 'call-answered'" :style="{ borderLeftColor: callInfo.color, borderLeftWidth: '4px' }">
          <v-avatar size="38" :color="callInfo.color" class="mr-3 flex-shrink-0" style="color: white !important;">
            <v-icon size="20" color="white">{{ callInfo.icon }}</v-icon>
          </v-avatar>
          <div class="flex-grow-1">
            <div class="d-flex align-center justify-space-between">
              <span class="text-body-2 font-weight-bold" :style="{ color: callInfo.isMissed ? '#EF4444' : 'inherit' }">
                {{ callInfo.title }}
              </span>
              <v-chip
                v-if="callInfo.isMissed"
                size="x-small"
                color="error"
                variant="flat"
                class="font-weight-bold px-1.5 ml-2"
                style="height: 18px; font-size: 0.62rem;"
              >
                NHỠ
              </v-chip>
            </div>
            <div class="text-caption mt-0.5" style="opacity: 0.8; font-size: 0.75rem;">
              {{ callInfo.subtitle }}
            </div>
          </div>
        </div>

        <!-- Voice message player -->
        <div v-else-if="voiceInfo" class="voice-card pa-2.5 rounded-lg border d-flex align-center" :class="msg.senderType === 'self' ? 'voice-card-self' : 'voice-card-contact'">
          <v-btn
            :icon="isVoicePlayingCurrent ? 'mdi-pause' : 'mdi-play'"
            size="small"
            :color="msg.senderType === 'self' ? 'white' : 'primary'"
            :variant="msg.senderType === 'self' ? 'tonal' : 'flat'"
            class="mr-2.5 flex-shrink-0"
            elevation="1"
            @click.stop="$emit('play-voice', msg)"
          />
          <div class="flex-grow-1 mr-2" style="min-width: 110px;">
            <div
              class="voice-progress-bar rounded-pill cursor-pointer"
              title="Nhấn để tua âm thanh"
              @click.stop="$emit('seek-voice', $event, msg)"
            >
              <div
                class="voice-progress-fill rounded-pill"
                :style="{ width: `${voiceProgressPercent}%` }"
              ></div>
            </div>
            <div class="d-flex align-center justify-space-between mt-1" style="font-size: 0.68rem; opacity: 0.85;">
              <span class="font-weight-medium">
                {{ isVoicePlayingCurrent || (activeVoiceMsgId === msg.id && (voiceCurrentTime || 0) > 0) ? formatVoiceTime(voiceCurrentTime || 0) : (voiceInfo.durationText || '0:00') }}
              </span>
              <span class="d-flex align-center" style="gap: 2px;">
                <v-icon size="11">mdi-microphone</v-icon>
                <span>Thoại</span>
              </span>
            </div>
          </div>
          <v-btn
            v-if="voiceInfo.url"
            icon="mdi-download"
            size="x-small"
            variant="text"
            title="Tải tệp ghi âm"
            @click.stop="$emit('download-voice', msg)"
          />
        </div>

        <!-- File/PDF -->
        <div v-else-if="fileInfo" class="file-card" style="min-width: 0; max-width: 100%;">
          <v-icon size="20" class="mr-2 flex-shrink-0" color="info">mdi-file-document-outline</v-icon>
          <div class="flex-grow-1" style="min-width: 0;">
            <div class="text-body-2 font-weight-medium text-truncate">{{ fileInfo.name }}</div>
            <div class="text-caption" style="opacity: 0.6;">{{ fileInfo.size }}</div>
          </div>
          <v-btn v-if="fileInfo.href" icon size="x-small" variant="text" @click="$emit('open-file', fileInfo.href)">
            <v-icon size="16">mdi-download</v-icon>
          </v-btn>
        </div>

        <!-- Sticker -->
        <div v-else-if="stickerUrl" class="sticker-message-container py-1">
          <img
            :src="stickerUrl"
            alt="Sticker"
            class="zalo-sticker-img"
            loading="lazy"
            @click.stop="$emit('preview-image-direct', stickerUrl, 'Sticker')"
          />
        </div>

        <!-- Image -->
        <div v-else-if="renderImageUrl">
          <div
            v-if="isImageFailed"
            class="pa-3 rounded-lg border d-flex align-center text-caption text-medium-emphasis"
            style="gap: 8px; background: rgba(var(--v-theme-surface), 0.92);"
          >
            <v-icon size="18">mdi-image-off-outline</v-icon>
            <span>Không tải được hình ảnh</span>
          </div>
          <img
            v-else
            :src="renderImageUrl"
            alt="Hình ảnh"
            class="chat-image"
            @click="$emit('preview-image', msg)"
            @error="onImageError"
            loading="lazy"
            decoding="async"
          />
          <div v-if="imageCaption" class="chat-image-caption mt-2">
            {{ imageCaption }}
          </div>
        </div>

        <!-- Video -->
        <div v-else-if="videoInfo" class="video-message-box">
          <div class="video-wrapper position-relative rounded-lg overflow-hidden" style="max-width: min(320px, 100%); background: #000;">
            <video
              v-if="videoInfo.url"
              :src="videoInfo.url"
              :poster="videoInfo.thumb"
              controls
              playsinline
              preload="metadata"
              class="w-100 rounded-lg"
              style="max-height: 280px; display: block;"
              @click.stop
            ></video>
            <div v-else-if="videoInfo.thumb" class="position-relative d-flex align-center justify-center cursor-pointer" style="min-height: 160px;">
              <img :src="videoInfo.thumb" alt="Video thumbnail" class="w-100" style="object-fit: cover; max-height: 220px;" />
              <v-btn icon="mdi-play" size="large" color="primary" class="position-absolute" elevation="3" />
            </div>
            <div v-else class="pa-3 text-center text-white">
              <v-icon size="32">mdi-video</v-icon>
              <div class="text-caption mt-1">Video</div>
            </div>
          </div>
          <div v-if="videoInfo.caption" class="chat-image-caption mt-1.5">
            {{ videoInfo.caption }}
          </div>
        </div>

        <!-- Default text -->
        <div v-else class="message-text" v-html="renderedContent"></div>

        <!-- Timestamp row underneath chat content -->
        <div class="text-caption mt-1.5 msg-time d-flex align-center justify-space-between" :class="msg.senderType === 'self' ? 'msg-time-self' : 'msg-time-contact'" style="font-size: 0.7rem; gap: 8px;">
          <div class="d-flex align-center" style="gap: 6px;">
            <span
              v-if="msg.senderType === 'self' && (msg.repliedBy || msg.senderName)"
              class="px-2 py-0.5 rounded text-white text-caption font-weight-bold"
              :style="{ backgroundColor: staffColor, fontSize: '0.62rem', borderRadius: '4px !important', letterSpacing: '0.5px' }"
            >
              {{ staffDisplayName }}
            </span>
          </div>
          <span class="msg-timestamp">{{ formattedTime }}</span>
        </div>

        <!-- Corner Quick Reaction Badge -->
        <v-menu
          v-if="!msg.isDeleted"
          :open-on-hover="!mobile"
          :open-on-click="true"
          location="top center"
          :close-on-content-click="true"
          :open-delay="60"
          :close-delay="250"
          offset="4"
          transition="scale-transition"
        >
          <template #activator="{ props: reactionActivatorProps }">
            <button
              v-bind="reactionActivatorProps"
              class="message-reaction-corner-badge"
              :class="{
                'has-reaction': !!currentReaction,
                'is-unreacted': !currentReaction,
                'badge-self': msg.senderType === 'self'
              }"
              :title="currentReaction ? `Cảm xúc: ${currentReaction} (Bấm để xóa hoặc đổi)` : 'Thả cảm xúc nhanh (Bấm hoặc rê chuột để chọn)'"
            >
              <span v-if="currentReaction" class="corner-reaction-emoji">
                {{ currentReaction }}
              </span>
              <v-icon v-else size="13" class="corner-reaction-default-icon">
                mdi-heart-outline
              </v-icon>
            </button>
          </template>

          <div
            class="d-flex align-center px-2 py-1 rounded-pill elevation-6 reaction-picker-bar"
            style="gap: 6px; border: 1px solid rgba(var(--v-border-color), 0.15); max-width: calc(100vw - 16px);"
            @click.stop
          >
            <button
              v-for="r in reactionList"
              :key="r.name"
              class="reaction-emoji-btn"
              :title="r.title"
              @click.stop="$emit('react', msg, r.emoji)"
            >
              {{ r.emoji }}
            </button>
          </div>
        </v-menu>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import {
  getVoiceInfo as extractVoiceInfo,
  getFileInfo as extractFileInfo,
  getStickerUrl as extractStickerUrl,
  getVideoInfo as extractVideoInfo,
  getImageUrl as extractImageUrl,
  getImageCaption as extractImageCaption,
  getImageFallbackUrl,
  isValidMediaUrl,
  sanitizeMediaCaption,
} from '@/modules/zalocrm/utils/message-media';

const props = withDefaults(
  defineProps<{
    msg: any;
    conversation?: any;
    isMultiSelectMode?: boolean;
    isSelected?: boolean;
    reactionList?: Array<{ name: string; emoji: string; title: string; icon: string }>;
    activeVoiceMsgId?: string | number | null;
    isVoicePlaying?: boolean;
    voiceCurrentTime?: number;
  }>(),
  {
    isMultiSelectMode: false,
    isSelected: false,
    reactionList: () => [
      { name: 'like', emoji: '👍', title: 'Thích', icon: '👍' },
      { name: 'heart', emoji: '❤️', title: 'Yêu thích', icon: '❤️' },
      { name: 'haha', emoji: '😂', title: 'Haha', icon: '😂' },
      { name: 'wow', emoji: '😮', title: 'Wow', icon: '😮' },
      { name: 'sad', emoji: '😢', title: 'Buồn', icon: '😢' },
      { name: 'angry', emoji: '😡', title: 'Phẫn nộ', icon: '😡' },
    ],
    activeVoiceMsgId: null,
    isVoicePlaying: false,
    voiceCurrentTime: 0,
  }
);

const { mobile } = useDisplay();

defineEmits<{
  (e: 'toggle-select', msg: any): void;
  (e: 'reply', msg: any): void;
  (e: 'forward', msg: any): void;
  (e: 'copy', msg: any): void;
  (e: 'pin', msg: any): void;
  (e: 'star', msg: any): void;
  (e: 'multi-select', msg: any): void;
  (e: 'details', msg: any): void;
  (e: 'appointment', msg: any): void;
  (e: 'recall', msg: any): void;
  (e: 'delete-only-me', msg: any): void;
  (e: 'scroll-to-quote', quote: any): void;
  (e: 'play-voice', msg: any): void;
  (e: 'seek-voice', ev: MouseEvent, msg: any): void;
  (e: 'download-voice', msg: any): void;
  (e: 'preview-image', msg: any): void;
  (e: 'preview-image-direct', url: string, title?: string): void;
  (e: 'contact-call', phone?: string): void;
  (e: 'contact-message', card: any): void;
  (e: 'open-file', href: string): void;
  (e: 'sync-appointment', msg: any): void;
  (e: 'react', msg: any, emoji: string): void;
  (e: 'corner-badge-click', msg: any): void;
}>();

// Helper computeds
const forwardInfo = computed(() => {
  const meta = props.msg?.metadata as any;
  if (!meta) return null;
  return meta.forward || meta.forwarded || null;
});

const quoteInfo = computed(() => {
  const meta = props.msg?.metadata as any;
  if (!meta) return null;
  return meta.quote || meta.quoted || null;
});

const quoteSnippet = computed(() => {
  const q = quoteInfo.value;
  if (!q) return '';
  return q.msg || q.content || q.snippet || '';
});

const deletedDisplay = computed(() => {
  return props.msg?.senderType === 'self' ? 'Bạn đã thu hồi tin nhắn' : 'Tin nhắn đã được thu hồi';
});

const callInfo = computed(() => {
  const meta = props.msg?.metadata as any;
  if (props.msg?.contentType === 'call' || meta?.call) {
    const c = meta?.call || {};
    return {
      title: c.title || 'Cuộc gọi Zalo',
      subtitle: c.duration || '00:00',
      isMissed: !!c.isMissed,
      icon: c.isMissed ? 'mdi-phone-missed' : 'mdi-phone',
      color: c.isMissed ? '#EF4444' : '#10B981',
    };
  }
  return null;
});

const voiceInfo = computed(() => {
  const m = props.msg;
  if (!m) return null;
  const direct = extractVoiceInfo(m);
  if (direct) return direct;
  const meta = m.metadata as any;
  if (meta?.voiceUrl) {
    return {
      url: meta.voiceUrl,
      duration: meta.duration || 0,
      durationText: meta.durationText || '0:00',
    };
  }
  return null;
});

const isVoicePlayingCurrent = computed(() => {
  return props.activeVoiceMsgId === props.msg?.id && props.isVoicePlaying;
});

const voiceProgressPercent = computed(() => {
  if (props.activeVoiceMsgId !== props.msg?.id) return 0;
  const duration = voiceInfo.value?.duration || 1;
  return Math.min(100, Math.max(0, ((props.voiceCurrentTime || 0) / duration) * 100));
});

function formatVoiceTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const fileInfo = computed(() => extractFileInfo(props.msg));

const videoInfo = computed(() => extractVideoInfo(props.msg));

const imageUrl = computed(() => extractImageUrl(props.msg));

const retriedPrimarySrc = ref('');
const failedImageSrc = ref('');

watch(() => props.msg?.id, () => {
  retriedPrimarySrc.value = '';
  failedImageSrc.value = '';
});

const renderImageUrl = computed(() => {
  const primary = imageUrl.value;
  const fallback = getImageFallbackUrl(props.msg);
  if (primary && retriedPrimarySrc.value === primary && fallback && fallback !== primary) {
    return fallback;
  }
  return primary;
});

const isImageFailed = computed(() => {
  const url = renderImageUrl.value;
  return !url || failedImageSrc.value === url;
});

function onImageError() {
  const primary = imageUrl.value;
  const fallback = getImageFallbackUrl(props.msg);
  const current = renderImageUrl.value;
  if (primary && current === primary && fallback && fallback !== primary && retriedPrimarySrc.value !== primary) {
    retriedPrimarySrc.value = primary;
    return;
  }
  if (current) {
    failedImageSrc.value = current;
  }
}

const imageCaption = computed(() => {
  return extractImageCaption(props.msg) || sanitizeMediaCaption((props.msg?.metadata as any)?.caption) || '';
});

const hasContactCard = computed(() => {
  return props.msg?.contentType === 'contact_card' || !!(props.msg?.metadata as any)?.contactCard;
});

const currentReaction = computed(() => {
  const meta = props.msg?.metadata as any;
  return meta?.reaction || meta?.reactionEmoji || null;
});

const stickerUrl = computed(() => extractStickerUrl(props.msg));

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPlainTextWithLinks(raw: string): string {
  const escaped = escapeHtml(raw);
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  return escaped
    .replace(urlRegex, (match) => {
      let cleanUrl = match;
      let trailing = '';
      while (cleanUrl.length > 0 && /[.,;:!?'"`]/.test(cleanUrl[cleanUrl.length - 1])) {
        trailing = cleanUrl[cleanUrl.length - 1] + trailing;
        cleanUrl = cleanUrl.slice(0, -1);
      }
      while (cleanUrl.endsWith(')')) {
        const opens = (cleanUrl.match(/\(/g) || []).length;
        const closes = (cleanUrl.match(/\)/g) || []).length;
        if (closes > opens) {
          trailing = ')' + trailing;
          cleanUrl = cleanUrl.slice(0, -1);
        } else {
          break;
        }
      }
      const unescapedForCheck = cleanUrl
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
      if (!/^https?:\/\//i.test(unescapedForCheck) || !isValidMediaUrl(unescapedForCheck)) {
        return match;
      }
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="message-inline-link">${cleanUrl}</a>${trailing}`;
    })
    .replace(/\n/g, '<br/>');
}

const renderedContent = computed(() => {
  const content = props.msg?.content || '';
  if (!content) {
    if (
      !props.msg?.isDeleted &&
      !props.msg?.attachments?.length &&
      !renderImageUrl.value &&
      !voiceInfo.value &&
      !fileInfo.value &&
      !videoInfo.value &&
      !stickerUrl.value &&
      !callInfo.value
    ) {
      if (props.conversation?.channel === 'whatsapp' || props.msg?.senderName?.toLowerCase().includes('meta')) {
        return '<span class="font-italic text-medium-emphasis" style="opacity: 0.85;">[Phản hồi từ Meta AI]</span>';
      }
      return '<span class="font-italic text-medium-emphasis" style="opacity: 0.85;">[Tin nhắn không có nội dung văn bản]</span>';
    }
    return '';
  }
  if (typeof content === 'string' && (content.startsWith('/9j/') || content.startsWith('data:image/'))) {
    return '';
  }
  if (content.startsWith('{')) {
    try {
      const p = JSON.parse(content);
      if ('href' in p && 'thumb' in p && 'hdUrl' in p && !p.href && !p.thumb && !p.hdUrl && !p.localUrl) {
        const cap = sanitizeMediaCaption(p.title) || sanitizeMediaCaption(p.caption);
        return cap ? formatPlainTextWithLinks(cap) : '';
      }
      const text =
        sanitizeMediaCaption(p.title) ||
        sanitizeMediaCaption(p.description) ||
        sanitizeMediaCaption(p.msg) ||
        sanitizeMediaCaption(p.caption) ||
        '';
      if (text) return formatPlainTextWithLinks(text);
      if (typeof p.href === 'string' && /^https?:\/\//i.test(p.href) && isValidMediaUrl(p.href)) {
        const safeHref = escapeHtml(p.href.trim());
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="message-inline-link">${safeHref}</a>`;
      }
      return '';
    } catch {}
  }
  return formatPlainTextWithLinks(content);
});

const formattedTime = computed(() => {
  if (!props.msg?.sentAt) return '';
  const d = new Date(props.msg.sentAt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

const staffColor = computed(() => {
  const name = props.msg?.repliedBy?.fullName || props.msg?.senderName || 'Staff';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706'];
  return colors[Math.abs(hash) % colors.length];
});

const staffDisplayName = computed(() => {
  const name = props.msg?.repliedBy?.fullName || props.msg?.senderName || 'AI';
  return String(name).toUpperCase();
});
</script>

<style scoped>
.message-row {
  transition: background-color 0.15s ease;
}
.message-wrapper {
  max-width: 70%;
  min-width: 0;
}
@media (max-width: 600px) {
  .message-wrapper {
    min-width: 0;
    max-width: calc(100% - 86px) !important;
  }
  .message-bubble {
    max-width: 100% !important;
  }
  .chat-image {
    min-width: min(170px, 100%);
    max-width: 100%;
    max-height: 62dvh;
  }
}
@media (hover: none), (max-width: 959px) {
  .message-outside-actions,
  .message-reaction-corner-badge.badge-self.is-unreacted {
    opacity: 0.92 !important;
  }
}
.message-bubble {
  border-radius: 12px;
  position: relative;
  font-size: 14px;
  line-height: 1.45;
}
.staff-bubble {
  background: #E8F2FF;
  color: #0F172A;
  border-bottom-right-radius: 2px;
}
.customer-bubble {
  background: #FFFFFF;
  color: #0F172A;
  border-bottom-left-radius: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.msg-outside-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}
.msg-outside-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
  color: rgb(var(--v-theme-primary));
}
.chat-image {
  display: block;
  min-width: 0 !important;
  max-width: min(380px, 100%);
  max-height: min(600px, 75vh);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
  background: transparent !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08));
  image-rendering: auto !important;
  cursor: pointer;
}
.message-bubble.image-bubble,
.customer-bubble.image-bubble,
.staff-bubble.image-bubble,
.staff-bubble.image-bubble-self,
.message-bubble.sticker-bubble,
.customer-bubble.sticker-bubble,
.staff-bubble.sticker-bubble {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  min-width: 0 !important;
}
.corner-reaction-emoji {
  font-size: 14px;
}
</style>
