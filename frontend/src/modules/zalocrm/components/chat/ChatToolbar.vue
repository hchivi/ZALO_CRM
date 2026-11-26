<template>
  <div class="chat-toolbar d-flex align-center px-3 py-1.5" style="gap: 10px;">
    <!-- Vai trò Kế toán Badge -->
    <v-chip
      v-if="userRole === 'accountant'"
      size="x-small"
      color="amber-darken-3"
      variant="tonal"
      class="font-weight-medium"
      prepend-icon="mdi-shield-check-outline"
    >
      {{ threadType === 'group' ? 'Kế toán (Nhóm làm việc)' : 'Kế toán (Được bàn giao)' }}
    </v-chip>

    <!-- 1. Sticker / Biểu cảm -->
    <v-menu location="top start" :close-on-content-click="false">
      <template #activator="{ props: emojiMenuProps }">
        <button class="toolbar-btn" title="Biểu cảm & Nhãn dán" v-bind="emojiMenuProps">
          <v-icon size="19">mdi-emoticon-outline</v-icon>
        </button>
      </template>
      <v-card rounded="xl" elevation="6" class="pa-2 border" style="max-width: min(290px, calc(100vw - 16px));">
        <div class="text-caption font-weight-bold px-1 mb-1.5 text-medium-emphasis">Biểu cảm thường dùng</div>
        <div class="d-flex flex-wrap" style="gap: 6px;">
          <button
            v-for="e in commonEmojis"
            :key="e"
            class="reaction-emoji-btn"
            @click="$emit('insert-emoji', e)"
          >
            {{ e }}
          </button>
        </div>
      </v-card>
    </v-menu>

    <!-- 2. Gửi hình ảnh -->
    <button
      class="toolbar-btn"
      :disabled="sending || sendingFile"
      title="Gửi hình ảnh từ Kho"
      @click="$emit('open-media-picker')"
    >
      <v-icon size="19">mdi-image-outline</v-icon>
    </button>

    <!-- 3. Đính kèm tệp -->
    <button
      class="toolbar-btn"
      :disabled="sending || sendingFile"
      title="Đính kèm file từ máy tính"
      @click="$emit('trigger-file-input')"
    >
      <v-icon size="19">mdi-paperclip</v-icon>
    </button>

    <!-- 4. Gửi Danh thiếp -->
    <button
      class="toolbar-btn"
      :disabled="sending || sendingFile"
      title="Gửi Danh thiếp Zalo"
      @click="$emit('open-contact-card')"
    >
      <v-icon size="19">mdi-card-account-details-outline</v-icon>
    </button>

    <!-- 7. Tin nhắn nhanh (Icon sấm sét trong tin nhắn) -->
    <QuickRepliesMenu
      @select="(val) => $emit('select-quick-reply', val)"
      @send-instant="(val) => $emit('send-instant-quick-reply', val)"
    />

    <!-- 8. Thẻ ngân hàng & QR -->
    <button
      class="toolbar-btn"
      :disabled="sending || sendingFile"
      title="Gửi Thẻ ngân hàng & VietQR"
      @click="$emit('open-bank-card')"
    >
      <v-icon size="19">mdi-credit-card-outline</v-icon>
    </button>

    <!-- 9. Nút Ba Chấm ... (Menu popup nổi bật) -->
    <v-menu location="top start" offset="6">
      <template #activator="{ props: moreMenuProps }">
        <button class="toolbar-btn toolbar-more-active-btn" title="Thêm tùy chọn" v-bind="moreMenuProps">
          <v-icon size="18">mdi-dots-horizontal</v-icon>
        </button>
      </template>
      <v-list density="compact" class="py-1.5 zalo-popup-menu" rounded="xl" elevation="10" min-width="240" max-width="calc(100vw - 24px)">
        <!-- Tạo nhắc hẹn -->
        <v-list-item
          density="compact"
          class="zalo-popup-item cursor-pointer"
          @click="$emit('open-reminder-modal')"
        >
          <template #prepend>
            <v-icon size="19" class="mr-3" color="amber-darken-2">mdi-alarm</v-icon>
          </template>
          <v-list-item-title class="text-body-2 font-weight-medium">Tạo nhắc hẹn</v-list-item-title>
        </v-list-item>

        <!-- Đánh dấu tin quan trọng -->
        <v-list-item
          density="compact"
          class="zalo-popup-item cursor-pointer"
          @click="$emit('mark-important')"
        >
          <template #prepend>
            <v-icon size="19" class="mr-3" color="error">mdi-exclamation-thick</v-icon>
          </template>
          <v-list-item-title class="text-body-2 font-weight-medium">Đánh dấu tin quan trọng</v-list-item-title>
          <template #append>
            <v-icon size="15" class="opacity-50">mdi-help-circle-outline</v-icon>
          </template>
        </v-list-item>

        <!-- Đánh dấu tin khẩn cấp -->
        <v-list-item
          density="compact"
          class="zalo-popup-item cursor-pointer"
          @click="$emit('mark-urgent')"
        >
          <template #prepend>
            <v-icon size="19" class="mr-3" color="deep-orange-darken-1">mdi-bell-outline</v-icon>
          </template>
          <v-list-item-title class="text-body-2 font-weight-medium">Đánh dấu tin khẩn cấp</v-list-item-title>
          <template #append>
            <v-icon size="15" class="opacity-50">mdi-help-circle-outline</v-icon>
          </template>
        </v-list-item>

        <!-- Nếu là Group: Tạo bình chọn Poll -->
        <template v-if="threadType === 'group'">
          <v-divider class="my-1 opacity-20" />
          <v-list-item
            density="compact"
            class="zalo-popup-item cursor-pointer"
            @click="$emit('open-poll-modal')"
          >
            <template #prepend>
              <v-icon size="19" class="mr-3" color="info">mdi-poll</v-icon>
            </template>
            <v-list-item-title class="text-body-2 font-weight-medium">Tạo bình chọn nhóm</v-list-item-title>
          </v-list-item>
        </template>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import QuickRepliesMenu from './QuickRepliesMenu.vue';

withDefaults(
  defineProps<{
    userRole?: string;
    threadType?: string;
    sending?: boolean;
    sendingFile?: boolean;
    commonEmojis?: string[];
  }>(),
  {
    commonEmojis: () => ['👍', '❤️', '😄', '😮', '😢', '😡', '🙏', '🎉', '🤝', '🔥'],
    sending: false,
    sendingFile: false,
  }
);

defineEmits<{
  (e: 'insert-emoji', emoji: string): void;
  (e: 'open-media-picker'): void;
  (e: 'trigger-file-input'): void;
  (e: 'open-contact-card'): void;
  (e: 'prompt-screenshot-tip'): void;
  (e: 'toggle-formatting'): void;
  (e: 'select-quick-reply', item: any): void;
  (e: 'send-instant-quick-reply', item: any): void;
  (e: 'open-bank-card'): void;
  (e: 'open-reminder-modal'): void;
  (e: 'mark-important'): void;
  (e: 'mark-urgent'): void;
  (e: 'open-poll-modal'): void;
}>();
</script>

<style scoped>
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.7);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.toolbar-btn:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-primary));
}
.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.reaction-emoji-btn {
  font-size: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.reaction-emoji-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
  transform: scale(1.15);
}
.toolbar-more-active-btn {
  color: #0088FF;
}
.zalo-popup-menu {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.zalo-popup-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
@media (max-width: 600px) {
  .chat-toolbar {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap !important;
  }
  .chat-toolbar::-webkit-scrollbar {
    display: none;
  }
  .toolbar-btn {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
  }
}
</style>
