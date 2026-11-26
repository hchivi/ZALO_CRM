<template>
  <div
    v-if="visible"
    class="zalo-drag-drop-overlay d-flex flex-column"
    @dragover.prevent
    @drop.prevent
  >
    <!-- Top Zone: Gửi nhanh -->
    <div
      class="zalo-dropzone zalo-dropzone-quick d-flex flex-column align-center justify-center flex-grow-1"
      :class="{ 'dropzone-active': activeZone === 'quick' }"
      @dragenter.prevent="activeZone = 'quick'"
      @dragover.prevent="activeZone = 'quick'"
      @drop.prevent="handleDropQuick"
    >
      <div v-if="draggedFileLabel" class="dragged-file-indicator mb-auto mt-4 px-3 py-1 rounded-pill d-flex align-center">
        <v-icon size="14" class="mr-1.5" color="white">mdi-file-image-outline</v-icon>
        <span class="text-caption font-weight-medium text-white">{{ draggedFileLabel }}</span>
      </div>

      <div class="text-center my-auto px-3 pointer-events-none">
        <div class="quick-send-title text-h6 font-weight-bold mb-1">Gửi nhanh</div>
        <div class="quick-send-desc text-body-2">Thả File hoặc Ảnh vào đây để gửi nhanh</div>
      </div>
    </div>

    <!-- Bottom Zone: Xem trước khi gửi -->
    <div
      class="zalo-dropzone zalo-dropzone-preview d-flex flex-column align-center justify-center py-4 px-3 text-center"
      :class="{ 'dropzone-active': activeZone === 'preview' }"
      @dragenter.prevent="activeZone = 'preview'"
      @dragover.prevent="activeZone = 'preview'"
      @drop.prevent="handleDropPreview"
    >
      <div class="preview-send-title text-subtitle-1 font-weight-bold mb-0.5 pointer-events-none">Xem trước khi gửi</div>
      <div class="preview-send-desc text-caption pointer-events-none">Thả File hoặc Ảnh vào đây để xem lại trước khi gửi</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  visible: boolean;
  draggedFileLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'drop-quick', event: DragEvent): void;
  (e: 'drop-preview', event: DragEvent): void;
}>();

const activeZone = ref<'quick' | 'preview'>('quick');

function handleDropQuick(e: DragEvent) {
  emit('drop-quick', e);
}

function handleDropPreview(e: DragEvent) {
  emit('drop-preview', e);
}
</script>

<style scoped>
.zalo-drag-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  padding: 16px;
  gap: 12px;
}
.zalo-dropzone {
  border: 2px dashed rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transition: all 0.2s ease;
  cursor: copy;
}
.zalo-dropzone.dropzone-active {
  border-color: #0088FF;
  background: rgba(0, 136, 255, 0.25);
  transform: scale(1.01);
}
.dragged-file-indicator {
  background: rgba(0, 0, 0, 0.6);
}
</style>
