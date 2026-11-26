<template>
  <div class="chat-input-row d-flex align-end px-2 px-sm-3 pb-2 pt-1" style="gap: 8px;">
    <v-textarea
      :model-value="modelValue"
      :placeholder="placeholder || 'Nhập tin nhắn...'"
      variant="plain"
      density="compact"
      hide-details
      auto-grow
      rows="1"
      max-rows="6"
      aria-label="Soạn tin nhắn"
      class="chat-native-textarea flex-grow-1"
      @update:model-value="$emit('update:modelValue', $event)"
      @input="$emit('typing')"
      @keydown.enter.exact.prevent="$emit('send')"
    />

    <!-- Action bên phải ô nhập: Icon mặt cười & Like / Send -->
    <div class="d-flex align-center flex-shrink-0" style="gap: 6px; margin-bottom: 2px;">
      <v-menu location="top end" :close-on-content-click="false">
        <template #activator="{ props: subEmojiProps }">
          <button class="toolbar-btn" title="Chèn biểu cảm" v-bind="subEmojiProps">
            <v-icon size="20">mdi-emoticon-outline</v-icon>
          </button>
        </template>
        <v-card rounded="xl" elevation="6" class="pa-2 border" style="max-width: min(290px, calc(100vw - 16px));">
          <div class="text-caption font-weight-bold px-1 mb-1.5 text-medium-emphasis">Biểu cảm</div>
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

      <!-- Khi KHÔNG CÓ chữ: Nút Like màu vàng -->
      <button
        v-if="!modelValue?.trim()"
        class="like-quick-btn"
        title="Gửi nhanh Like 👍"
        @click="$emit('send-like')"
      >
        👍
      </button>

      <!-- Khi CÓ chữ: Nút Gửi màu xanh -->
      <v-btn
        v-else
        icon="mdi-send"
        color="primary"
        variant="flat"
        size="small"
        density="comfortable"
        :loading="sending || sendingFile"
        title="Gửi tin nhắn (Enter)"
        @click="$emit('send')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    sending?: boolean;
    sendingFile?: boolean;
    commonEmojis?: string[];
  }>(),
  {
    commonEmojis: () => ['👍', '❤️', '😄', '😮', '😢', '😡', '🙏', '🎉', '🤝', '🔥'],
    sending: false,
    sendingFile: false,
    placeholder: '',
  }
);

defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'typing'): void;
  (e: 'send'): void;
  (e: 'send-like'): void;
  (e: 'insert-emoji', emoji: string): void;
}>();
</script>

<style scoped>
.chat-native-textarea :deep(textarea) {
  padding: 6px 8px;
  font-size: 14px;
  line-height: 1.45;
  color: rgb(var(--v-theme-on-surface));
  min-height: 36px;
  max-height: 160px;
}
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
.toolbar-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-primary));
}
.like-quick-btn {
  width: 32px;
  height: 32px;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 0.15s ease;
  user-select: none;
}
.like-quick-btn:hover {
  transform: scale(1.25) rotate(-5deg);
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
</style>
