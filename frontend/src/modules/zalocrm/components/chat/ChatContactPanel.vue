<template>
  <div
    class="chat-contact-panel d-flex flex-column"
    :class="{ 'chat-contact-panel--info': activeTab === 'info' }"
    style="width: 100%; height: 100%; overflow: hidden; flex-shrink: 0; background: rgb(var(--v-theme-surface));"
  >
    <!-- ═════════════════════════════════════════════════════════════════════
         HEADER (Title + Close X)
    ══════════════════════════════════════════════════════════════════════ -->
    <div class="panel-compact-heading d-flex align-center justify-space-between flex-shrink-0 border-b" style="gap: 8px;">
      <span class="font-weight-bold text-subtitle-2 text-truncate">
        {{ props.conversation?.threadType === 'group' ? 'Thông tin nhóm' : 'Thông tin hội thoại' }}
      </span>
      <v-btn icon size="x-small" variant="text" aria-label="Đóng thông tin hội thoại" title="Đóng thông tin hội thoại" @click="$emit('close')">
        <v-icon size="20">mdi-close</v-icon>
      </v-btn>
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════
         TABS: THÔNG TIN & ẢNH VÀ TỆP (ĐẶT Ở TRÊN PHẦN NỘI DUNG IMAGE 2)
    ══════════════════════════════════════════════════════════════════════ -->
    <v-tabs
      v-model="activeTab"
      density="compact"
      color="primary"
      grow
      :show-arrows="false"
      class="border-b bg-surface flex-shrink-0 panel-nav-tabs"
    >
      <v-tab value="info" :ripple="false" class="text-caption font-weight-bold text-none panel-tab-item">
        <v-icon start size="15">mdi-account-circle-outline</v-icon>
        Thông tin
      </v-tab>
      <v-tab value="media" :ripple="false" class="text-caption font-weight-bold text-none panel-tab-item">
        <v-icon start size="15">mdi-folder-multiple-image</v-icon>
        Ảnh & Tệp
        <v-chip
          v-if="mediaCounts.total > 0"
          size="x-small"
          :color="activeTab === 'media' ? 'primary' : 'default'"
          :variant="activeTab === 'media' ? 'flat' : 'tonal'"
          class="ml-1 px-1 font-weight-bold"
          style="height: 16px; font-size: 0.62rem;"
        >
          {{ mediaCounts.total }}
        </v-chip>
      </v-tab>
      <v-tab value="chaten" :ripple="false" class="text-caption font-weight-bold text-none panel-tab-item">
        <v-icon start size="15" color="#006938">mdi-creation</v-icon>
        Chat AI
      </v-tab>
    </v-tabs>

    <!-- ═════════════════════════════════════════════════════════════════════
         TAB 3 CONTENT: CHAT AI (TRỢ LÝ SOẠN TIN ĐA NGỮ & THEO PHONG CÁCH)
    ══════════════════════════════════════════════════════════════════════ -->
    <div
      v-show="activeTab === 'chaten'"
      class="chaten-tab-host"
    >
      <ChatEnPanel
        :is-active="activeTab === 'chaten'"
        :conversation="props.conversation"
        :conversation-id="props.conversationId"
        :contact="props.contact"
        :messages="props.messages"
        @insert-to-chat="$emit('insert-to-chat', $event)"
        @send-draft="$emit('send-draft', $event)"
      />
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════
         TAB 2 CONTENT: ẢNH VÀ TỆP (DEDICATED STORAGE)
    ══════════════════════════════════════════════════════════════════════ -->
    <div
      v-if="activeTab === 'media'"
      class="flex-grow-1 overflow-hidden d-flex flex-column"
      style="min-height: 0; height: 100%;"
    >
      <ChatMediaStorage
        :conversation-id="props.conversationId"
        :contact-id="props.contactId"
        :zalo-account-id="props.conversation?.zaloAccountId"
        @update:counts="onMediaCountsUpdate"
      />
    </div>

    <!-- ═════════════════════════════════════════════════════════════════════
         TAB 1 CONTENT: THÔNG TIN (IMAGE 2)
    ══════════════════════════════════════════════════════════════════════ -->
    <div
      v-else-if="activeTab === 'info'"
      class="compact-info-body flex-grow-1 overflow-y-auto"
      style="min-height: 0;"
    >
      <div class="compact-profile">
        <div style="position: relative; display: inline-block;">
          <v-avatar size="38" color="surface-variant" class="compact-profile-avatar">
            <v-img v-if="props.contact?.avatarUrl" :src="props.contact.avatarUrl" cover referrerpolicy="no-referrer">
              <template #error>
                <v-icon v-if="props.conversation?.threadType === 'group'" icon="mdi-account-group" size="22" color="primary" />
                <v-icon v-else icon="mdi-account" size="22" color="primary" />
              </template>
            </v-img>
            <v-icon v-else-if="props.conversation?.threadType === 'group'" icon="mdi-account-group" size="22" color="primary" />
            <v-icon v-else icon="mdi-account" size="22" color="primary" />
          </v-avatar>
          <!-- Channel badge: WhatsApp (green) vs Zalo (official logo) -->
          <div
            v-if="props.conversation?.channel === 'whatsapp' || props.conversation?.zaloAccount?.channel === 'whatsapp'"
            style="position: absolute; bottom: -2px; right: -2px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.35); border: 1.5px solid white; background: #25D366;"
            title="WhatsApp"
          >
            <v-icon size="10" color="white">mdi-whatsapp</v-icon>
          </div>
          <div
            v-else
            style="position: absolute; bottom: -2px; right: -2px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.35); border: 1.5px solid white; background: #0068FF; overflow: hidden;"
            title="Zalo"
          >
            <img :src="zaloLogoUrl" alt="Zalo" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
          </div>
        </div>
        <div class="compact-profile-name">
          <strong :title="contactDisplayName">{{ contactDisplayName }}</strong>
          <span class="d-flex align-center text-caption text-medium-emphasis mt-0.5" style="font-size: 0.72rem; gap: 4px;">
            <v-icon size="11" color="primary">mdi-phone</v-icon>
            {{ props.contact?.phone || form.phone || 'Chưa có SĐT' }}
          </span>
        </div>
        <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" title="Chỉnh sửa tên & SĐT" aria-label="Chỉnh sửa tên & SĐT" @click="openEditNameDialog" />
      </div>
      <div class="contact-action-strip" role="group" aria-label="Thao tác hội thoại">
        <v-btn :icon="isMuted ? 'mdi-bell-off-outline' : 'mdi-bell-outline'" variant="text" :class="{ 'action-selected': isMuted }" :title="isMuted ? 'Bật thông báo' : 'Tắt thông báo'" :aria-label="isMuted ? 'Bật thông báo' : 'Tắt thông báo'" :aria-pressed="isMuted" @click="handleToggleMute" />
        <v-btn :icon="isPinned ? 'mdi-pin' : 'mdi-pin-outline'" variant="text" :class="{ 'action-selected': isPinned }" :title="isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'" :aria-label="isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'" :aria-pressed="isPinned" @click="handleTogglePin" />
        <v-btn :icon="props.conversation?.threadType === 'group' ? 'mdi-account-plus-outline' : 'mdi-account-multiple-plus-outline'" variant="text" :title="props.conversation?.threadType === 'group' ? 'Thêm thành viên' : 'Tạo nhóm'" :aria-label="props.conversation?.threadType === 'group' ? 'Thêm thành viên' : 'Tạo nhóm'" @click="openAddToGroupDialog" />
        <v-btn icon="mdi-clock-outline" variant="text" :title="contactAppointments.length ? `Nhắc hẹn (${contactAppointments.length})` : 'Nhắc hẹn'" :aria-label="contactAppointments.length ? `Nhắc hẹn (${contactAppointments.length})` : 'Nhắc hẹn'" @click="showAppointmentsDialog = true">
          <v-icon>mdi-clock-outline</v-icon><span v-if="contactAppointments.length" class="appointment-indicator" aria-hidden="true" />
        </v-btn>
        <v-btn icon="mdi-account-multiple-outline" variant="text" :title="props.conversation?.threadType === 'group' ? 'Thành viên nhóm' : 'Nhóm chung'" :aria-label="props.conversation?.threadType === 'group' ? 'Thành viên nhóm' : 'Nhóm chung'" @click="openAddToGroupDialog" />
      </div>

      <!-- ── Section 3: CRM Trạng thái & Ghi chú (Thưa ra - Image 2) ── -->
      <div class="compact-crm-section">
        <!-- 1. Trạng thái (Gọn gàng lưới 2 cột, thưa và thoáng mắt) -->
        <div class="compact-section-heading d-flex align-center justify-space-between">
          <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis d-flex align-center" style="letter-spacing: 0.5px; font-size: 0.72rem;">
            <v-icon size="14" class="mr-1.5" color="primary">mdi-tag-outline</v-icon>
            Trạng thái
          </span>
          <span v-if="activeStatusObj" class="text-caption font-weight-bold" :style="{ color: activeStatusObj.color, fontSize: '0.72rem' }">
            {{ activeStatusObj.label }}
          </span>
        </div>

        <!-- 8 Status Chips: Lưới 2 cột đều đẹp, khoảng cách thưa thoáng -->
        <div class="status-grid compact-status-grid">
          <button
            v-for="st in CUSTOMER_STATUS_LIST"
            :key="st.id"
            :title="st.label"
            :aria-pressed="activeStatusObj?.id === st.id"
            type="button"
            class="status-grid-btn"
            :class="{ 'is-active': activeStatusObj?.id === st.id }"
            :style="getStatusPillStyle(st, activeStatusObj?.id === st.id)"
            @click="selectStatus(st.id)"
          >
            <v-icon size="14" class="mr-2 flex-shrink-0" :style="{ color: activeStatusObj?.id === st.id ? '#ffffff' : st.color }">{{ st.icon }}</v-icon>
            <span class="text-truncate">{{ st.label }}</span>
          </button>
        </div>

        <div v-if="conversationId && authStore.user?.role !== 'accountant'" class="compact-need-action mt-2">
          <v-btn color="primary" block prepend-icon="mdi-file-document-plus-outline" class="text-none mb-2" size="small" @click="showCustomerNeed = true">Tạo nhu cầu khách hàng</v-btn>
          <CustomerNeedDialog
            v-model="showCustomerNeed"
            :conversation-id="conversationId"
            :customer-name="contactDisplayName"
            :phone="props.contact?.phone || form.phone"
            :customer-email="props.contact?.email || form.email"
            :zalo="props.contact?.zaloUid || props.contact?.zaloName || contactDisplayName"
            :delivery-address="props.contact?.address || form.metadata?.address || ''"
            :customer-status="activeStatusObj?.label || ''"
            :conversation="props.conversation"
            :zalo-account="props.conversation?.zaloAccount"
          />
        </div>

        <!-- 2. Ghi chú (Image 2 - Khoảng cách thoáng đãng) -->
        <div class="compact-notes-heading d-flex align-center justify-space-between flex-wrap" style="gap: 6px;">
          <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis d-flex align-center" style="letter-spacing: 0.5px; font-size: 0.72rem;">
            <v-icon size="14" class="mr-1.5" color="primary">mdi-note-text-outline</v-icon>
            Ghi chú
          </span>
          <v-btn size="x-small" variant="tonal" color="primary" prepend-icon="mdi-notebook-outline" class="handover-summary-button" :disabled="!conversationId" @click="showHandover = true">Tóm tắt đoạn chat</v-btn>
        </div>

        <!-- Textarea Ghi chú (Khoảng cách thưa thoáng) -->
        <v-textarea
          :model-value="localNotes"
          @update:model-value="onNoteInput"
          placeholder="Ví dụ: Khách muốn giao sau 17h, cần xuất hóa đơn VAT, đã cọc 500k, gọi xác nhận trước khi giao..."
          rows="3"
          variant="outlined"
          density="compact"
          class="compact-notes-textarea" aria-label="Ghi chú khách hàng"
          hide-details
          rounded="lg"
        />

        <!-- Nút Lưu Ghi Chú vĩnh viễn lên Database -->
        <div class="compact-notes-actions d-flex align-center justify-space-between flex-wrap mt-2" style="gap: 6px;">
          <span v-if="savingNoteSuccess" class="text-caption text-success d-flex align-center font-weight-medium" style="font-size: 0.72rem;">
            <v-icon size="14" class="mr-1">mdi-check-circle</v-icon>
            Đã lưu CSDL
          </span>
          <span v-else></span>
          <div class="d-flex align-center" style="gap: 6px;">
            <v-btn
              v-if="localNotes"
              color="error"
              variant="tonal"
              size="small"
              rounded="lg"
              class="font-weight-medium text-none px-2.5"
              style="height: 32px;"
              title="Xóa nội dung ghi chú"
              @click="clearNotes"
            >
              <v-icon size="16">mdi-delete-outline</v-icon>
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="small"
              rounded="lg"
              class="font-weight-bold text-none"
              style="height: 32px;"
              :loading="savingNoteLoading"
              @click="saveCustomerNotes"
            >
              <v-icon start size="16">mdi-content-save-outline</v-icon>
              Lưu ghi chú
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Edit Name Dialog ── -->
    <v-dialog v-model="editNameDialog" max-width="400">
      <v-card rounded="xl" class="pa-4">
        <v-card-title class="pa-0 mb-3 text-subtitle-1 font-weight-bold">
          Chỉnh sửa thông tin khách hàng
        </v-card-title>
        <v-text-field
          v-model="form.fullName"
          label="Tên khách hàng / Nhóm"
          variant="outlined"
          density="compact"
          autofocus
          hide-details
          rounded="lg"
          class="mb-3"
        />
        <v-text-field
          v-model="form.phone"
          label="Số điện thoại"
          type="tel"
          prepend-inner-icon="mdi-phone"
          variant="outlined"
          density="compact"
          hide-details
          rounded="lg"
          class="mb-4"
        />
        <div class="d-flex justify-end" style="gap: 8px;">
          <v-btn variant="text" size="small" @click="editNameDialog = false">Hủy</v-btn>
          <v-btn color="primary" variant="flat" size="small" :loading="saving" @click="saveEditName">Lưu</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- ── Add to Group Dialog ── -->
    <v-dialog v-model="addToGroupDialog.show" max-width="440">
      <v-card rounded="xl" class="pa-4">
        <v-card-title class="pa-0 mb-2 text-subtitle-1 font-weight-bold d-flex align-center justify-space-between" style="gap: 8px;">
          <span class="text-truncate" style="flex: 1; min-width: 0;">{{ props.conversation?.threadType === 'group' ? 'Thêm thành viên vào nhóm' : 'Thêm vào nhóm Zalo' }}</span>
          <v-btn icon="mdi-close" variant="text" size="x-small" @click="closeAddToGroupDialog" />
        </v-card-title>

        <v-text-field
          v-model="addToGroupDialog.search"
          placeholder="Tìm nhóm chat..."
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          hide-details
          class="mb-3"
          rounded="lg"
        />

        <div style="max-height: 260px; overflow-y: auto;">
          <v-list density="compact" nav class="pa-0">
            <v-list-item
              v-for="group in filteredGroups"
              :key="group.id"
              :value="group.id"
              rounded="lg"
              :active="addToGroupDialog.selectedGroupId === group.id"
              class="mb-1"
              @click="addToGroupDialog.selectedGroupId = group.id"
            >
              <template #prepend>
                <v-avatar size="32" color="primary" variant="tonal" class="mr-2">
                  <v-icon size="18">mdi-account-group</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2 font-weight-medium">
                {{ group.fullName }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </div>

        <div class="d-flex justify-end mt-3" style="gap: 8px;">
          <v-btn variant="text" size="small" @click="closeAddToGroupDialog">Đóng</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            :loading="addToGroupDialog.submitting"
            :disabled="!addToGroupDialog.selectedGroupId"
            @click="submitAddToGroup"
          >
            Thêm vào nhóm
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- ── Appointments Modal Dialog ── -->
    <v-dialog v-model="showAppointmentsDialog" max-width="480">
      <v-card rounded="xl" class="pa-4">
        <v-card-title class="pa-0 mb-2 text-subtitle-1 font-weight-bold d-flex align-center justify-space-between border-b pb-2">
          <div class="d-flex align-center">
            <v-icon color="primary" class="mr-2" size="20">mdi-clock-outline</v-icon>
            <span>Danh sách nhắc hẹn ({{ contactAppointments.length }})</span>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" @click="showAppointmentsDialog = false" />
        </v-card-title>
        <div style="max-height: 480px; overflow-y: auto;">
          <ChatAppointments
            v-if="props.contactId"
            :contact-id="props.contactId"
            :appointments="contactAppointments"
            @refresh="reloadAppointments"
          />
          <div v-else class="text-center py-6 text-medium-emphasis text-caption">
            Không tìm thấy thông tin liên hệ để xem lịch hẹn
          </div>
        </div>
      </v-card>
    </v-dialog>

    <HandoverDialog v-if="conversationId" :key="conversationId" v-model="showHandover" :conversation-id="conversationId" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, onMounted, onUnmounted } from 'vue';
import zaloLogoUrl from '@/modules/zalocrm/assets/logo-zalo.webp';
import { api } from '@/modules/zalocrm/api/index';
import type { Contact } from '@/modules/zalocrm/composables/use-contacts';
import { useChatContactPanel } from '@/modules/zalocrm/composables/use-chat-contact-panel';
import { useAuthStore } from '@/modules/zalocrm/stores/auth';
import ChatMediaStorage from './ChatMediaStorage.vue';
import ChatAppointments from './ChatAppointments.vue';
import ChatEnPanel from './ChatEnPanel.vue';
import CustomerNeedDialog from './CustomerNeedDialog.vue';
import HandoverDialog from '@/modules/zalocrm/components/handovers/HandoverDialog.vue';
import { CUSTOMER_STATUS_LIST, normalizeCustomerStatus } from '@/modules/zalocrm/constants/customer-statuses';

const props = defineProps<{
  contactId: string | null;
  contact: Contact | null;
  conversationId: string | null;
  conversation: any;
  messages?: any[];
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
  'toggle-mute': [];
  'insert-to-chat': [text: string];
  'send-draft': [text: string];
}>();

const authStore = useAuthStore();
void authStore;

const {
  form, saving,
  contactAppointments,
  saveContact, reloadAppointments,
} = useChatContactPanel(
  () => props.contactId,
  () => props.contact,
  () => emit('saved'),
);

// ── Top Navigation Tabs (Thông tin vs Ảnh và Tệp vs Chat AI) ────────────────
const showCustomerNeed = ref(false);
const showHandover = ref(false);
const activeTab = ref<'info' | 'media' | 'chaten'>('info');
const mediaCounts = ref({ images: 0, files: 0, links: 0, total: 0 });

function onMediaCountsUpdate(counts: { images: number; files: number; links: number; total: number }) {
  mediaCounts.value = counts;
}

// ── Fetch Initial Media Counts for Tab Badge ───────────────────────────────
async function fetchMediaCounts() {
  if (!props.conversationId) return;
  try {
    const res = await api.get(`/conversations/${props.conversationId}/assets`);
    const imgs = res.data.images?.length || 0;
    const fls = res.data.files?.length || 0;
    const lnks = res.data.links?.length || 0;
    mediaCounts.value = {
      images: imgs,
      files: fls,
      links: lnks,
      total: imgs + fls + lnks,
    };
  } catch (err) {
    // Non-critical, ignore
  }
}

onMounted(() => {
  fetchMediaCounts();
  window.addEventListener('crm:contact-status-changed', onGlobalStatusChanged);
});

onUnmounted(() => {
  window.removeEventListener('crm:contact-status-changed', onGlobalStatusChanged);
});

watch(() => props.conversationId, () => {
  fetchMediaCounts();
});

// ── Contact Display Name ───────────────────────────────────────────────────
const contactDisplayName = computed(() => {
  if (props.conversation?.threadType === 'group') {
    return props.conversation.contact?.fullName || props.conversation.threadName || 'Nhóm trò chuyện';
  }
  return form.fullName || props.contact?.fullName || props.conversation?.contact?.fullName || 'Khách hàng';
});

// ── Edit Name Dialog ────────────────────────────────────────────────────────
const editNameDialog = ref(false);
function openEditNameDialog() {
  editNameDialog.value = true;
}
async function saveEditName() {
  editNameDialog.value = false;
  await saveContact();
}

// ── Mute & Pin State ───────────────────────────────────────────────────────
const isMuted = computed(() => Boolean(props.conversation?.isMuted));
const isPinned = ref(false);

function handleToggleMute() {
  emit('toggle-mute');
}

function handleTogglePin() {
  isPinned.value = !isPinned.value;
}

// ── Appointments Dialog ─────────────────────────────────────────────────────
const showAppointmentsDialog = ref(false);

// ── 8 Status Chips & Two-way Sync ─────────────────────────────────────────────
const localStatus = ref<string | null>(props.conversation?.contact?.status ?? null);

const activeStatusObj = computed(() => {
  if (!localStatus.value) return null;
  return normalizeCustomerStatus(localStatus.value);
});

watch(
  [() => props.conversation?.id, () => props.conversation?.contact?.status],
  ([, newStatus]) => {
    localStatus.value = newStatus ?? null;
    if (form.status !== (newStatus ?? null)) {
      form.status = newStatus ?? null;
    }
  },
  { immediate: true }
);

function onGlobalStatusChanged(e: Event) {
  const custom = e as CustomEvent;
  if (custom.detail?.conversationId === props.conversation?.id) {
    const next = custom.detail.status ?? null;
    localStatus.value = next;
    form.status = next;
  }
}

async function selectStatus(statusId: string) {
  const nextStatus = (activeStatusObj.value?.id === statusId || localStatus.value === statusId) ? null : statusId;
  localStatus.value = nextStatus;
  form.status = nextStatus;

  // Broadcast immediately to MessageThread & any other component
  window.dispatchEvent(new CustomEvent('crm:contact-status-changed', {
    detail: { conversationId: props.conversation?.id, status: nextStatus }
  }));

  // Persist to backend
  try {
    if (props.conversation?.id) {
      await api.patch(`/conversations/${props.conversation.id}/customer-note`, {
        status: nextStatus || '',
      });
      emit('saved');
    } else {
      await saveContact();
    }
  } catch (err) {
    console.error('Failed to update customer status from sidebar:', err);
  }
}

function getStatusPillStyle(st: typeof CUSTOMER_STATUS_LIST[0], isActive: boolean) {
  if (isActive) {
    return {
      backgroundColor: st.color,
      color: '#ffffff',
      borderColor: st.color,
      boxShadow: `0 2px 8px ${st.color}44`,
    };
  }
  return {
    backgroundColor: 'rgba(var(--v-theme-on-surface), 0.03)',
    color: 'rgba(var(--v-theme-on-surface), 0.72)',
    borderColor: 'rgba(var(--v-theme-on-surface), 0.12)',
  };
}

const savingNoteSuccess = ref(false);
const savingNoteLoading = ref(false);
const savedNoteAt = ref('');

const localNotes = ref('');
const isNoteDirty = ref(false);

function cleanNotes(text: string) {
  return (text || '')
    .replace(/\[Chuyển cho Kế toán\]/g, '')
    .replace(/\[Kế toán được chat\]/g, '')
    .replace(/\n\n+/g, '\n');
}

// Khi đổi cuộc hội thoại / khách hàng: nạp ghi chú mới hoặc phục hồi bản nháp đang gõ dở
watch(
  () => props.conversation?.id || props.contactId,
  (newId, oldId) => {
    if (newId !== oldId) {
      const draft = newId ? sessionStorage.getItem('crm_draft_note_' + newId) : null;
      if (draft !== null) {
        localNotes.value = draft;
        isNoteDirty.value = true;
      } else {
        localNotes.value = cleanNotes(props.conversation?.contact?.notes || props.contact?.notes || form.notes || '');
        isNoteDirty.value = false;
      }
    }
  },
  { immediate: true }
);

// Đồng bộ ghi chú từ server (chỉ cập nhật nếu người dùng chưa sửa dở)
watch(
  () => props.conversation?.contact?.notes,
  (newNotes) => {
    if (!isNoteDirty.value && newNotes !== undefined) {
      localNotes.value = cleanNotes(newNotes || '');
    }
  }
);

function onNoteInput(val: string) {
  localNotes.value = val;
  isNoteDirty.value = true;
  const cid = props.conversation?.id || props.contactId;
  if (cid) {
    sessionStorage.setItem('crm_draft_note_' + cid, val);
  }
}

async function saveCustomerNotes() {
  savingNoteLoading.value = true;
  try {
    const textToSave = localNotes.value.trim();
    if (props.conversation?.id) {
      await api.patch(`/conversations/${props.conversation.id}/customer-note`, {
        note: textToSave,
        pinnedNote: textToSave,
      });
      emit('saved');
    } else {
      form.notes = textToSave;
      await saveContact();
    }
    isNoteDirty.value = false;
    const cid = props.conversation?.id || props.contactId;
    if (cid) {
      sessionStorage.removeItem('crm_draft_note_' + cid);
    }
    savingNoteSuccess.value = true;
    savedNoteAt.value = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setTimeout(() => { savingNoteSuccess.value = false; }, 3000);
  } catch (err) {
    console.error('Failed to save customer notes:', err);
  } finally {
    savingNoteLoading.value = false;
  }
}

async function clearNotes() {
  localNotes.value = '';
  isNoteDirty.value = false;
  const cid = props.conversation?.id || props.contactId;
  if (cid) {
    sessionStorage.removeItem('crm_draft_note_' + cid);
  }
  await saveCustomerNotes();
}

// ── Zalo Group Management ───────────────────────────────────────────────────
const addToGroupDialog = reactive({
  show: false,
  loading: false,
  submitting: false,
  search: '',
  groups: [] as Array<{ id: string; fullName: string; zaloUid: string; avatarUrl?: string }>,
  selectedGroupId: '',
  error: '',
});

const filteredGroups = computed(() => {
  const query = addToGroupDialog.search.toLowerCase().trim();
  if (!query) return addToGroupDialog.groups;
  return addToGroupDialog.groups.filter(g =>
    g.fullName.toLowerCase().includes(query)
  );
});

function openAddToGroupDialog() {
  addToGroupDialog.show = true;
  fetchGroups();
}

function closeAddToGroupDialog() {
  addToGroupDialog.show = false;
  addToGroupDialog.selectedGroupId = '';
  addToGroupDialog.search = '';
  addToGroupDialog.error = '';
}

async function fetchGroups() {
  if (!props.conversation?.zaloAccountId) return;
  addToGroupDialog.loading = true;
  addToGroupDialog.error = '';
  try {
    const res = await api.get(`/zalo-accounts/${props.conversation.zaloAccountId}/groups`);
    addToGroupDialog.groups = res.data.groups || [];
  } catch (err: any) {
    console.error('Failed to fetch Zalo groups:', err);
    addToGroupDialog.error = 'Không thể tải danh sách nhóm chat.';
  } finally {
    addToGroupDialog.loading = false;
  }
}

async function submitAddToGroup() {
  if (!props.conversation?.zaloAccountId || !props.contact?.zaloUid || !addToGroupDialog.selectedGroupId) return;

  addToGroupDialog.submitting = true;
  addToGroupDialog.error = '';

  try {
    await api.post(`/zalo-accounts/${props.conversation.zaloAccountId}/groups/${addToGroupDialog.selectedGroupId}/add-member`, {
      userZaloUid: props.contact.zaloUid
    });

    closeAddToGroupDialog();
  } catch (err: any) {
    console.error('Failed to add member to Zalo group:', err);
    addToGroupDialog.error = err.response?.data?.error || 'Không thể thêm khách hàng vào nhóm.';
  } finally {
    addToGroupDialog.submitting = false;
  }
}
</script>

<style scoped>
.chat-contact-panel {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.panel-nav-tabs {
  flex: 0 0 36px !important;
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px;
  width: 100% !important;
}

.panel-nav-tabs :deep(.v-slide-group__container) {
  overflow: hidden !important;
  width: 100% !important;
}

.panel-nav-tabs :deep(.v-slide-group__content) {
  display: flex !important;
  width: 100% !important;
  justify-content: stretch !important;
}

.panel-nav-tabs :deep(.v-slide-group__prev),
.panel-nav-tabs :deep(.v-slide-group__next) {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  flex: 0 0 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}

.panel-nav-tabs :deep(.v-btn) {
  height: 36px !important;
  border-radius: 0 !important;
  background: transparent !important;
}

.panel-nav-tabs :deep(.v-btn__overlay),
.panel-nav-tabs :deep(.v-btn__underlay) {
  display: none !important;
  opacity: 0 !important;
}

.panel-nav-tabs :deep(.v-tab) {
  flex: 1 1 0 !important;
  min-width: 0 !important;
  max-width: none !important;
  padding: 0 4px !important;
  height: 36px !important;
  font-size: 11.5px !important;
  letter-spacing: -0.2px !important;
  border-radius: 0 !important;
  background-color: transparent !important;
  background: transparent !important;
  text-transform: none !important;
  transition: color 0.15s ease !important;
  white-space: nowrap !important;
}

.panel-nav-tabs :deep(.v-tab .v-icon) {
  font-size: 14px !important;
  margin-inline-end: 3px !important;
}

.panel-nav-tabs :deep(.v-tab:hover) {
  background-color: transparent !important;
  background: transparent !important;
  color: rgb(var(--v-theme-primary)) !important;
}

.panel-nav-tabs :deep(.v-tab--selected) {
  color: rgb(var(--v-theme-primary)) !important;
  font-weight: 700 !important;
  background-color: transparent !important;
  background: transparent !important;
}

.panel-nav-tabs :deep(.v-tab:not(.v-tab--selected)) {
  color: rgba(var(--v-theme-on-surface), 0.65) !important;
  font-weight: 500;
  background-color: transparent !important;
  background: transparent !important;
}

.panel-nav-tabs :deep(.v-tab__slider) {
  height: 2.5px !important;
  background-color: rgb(var(--v-theme-primary)) !important;
  border-radius: 2px 2px 0 0 !important;
}

.action-circle-btn {
  width: 44px;
  height: 44px;
  border-radius: 50% !important;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.action-circle-btn:hover {
  transform: translateY(-1px);
}

.action-label {
  font-size: 0.72rem;
  color: rgba(var(--v-theme-on-surface), 0.78);
  font-weight: 500;
  text-align: center;
}

.action-list-item {
  border-radius: 8px;
  margin: 1px 8px;
  transition: background-color 0.12s ease;
}

.action-list-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

/* 2 tính năng Nhắc hẹn & Nhóm chung thành hàng ngang (Image 1) */
.shortcut-h-btn {
  background: rgba(var(--v-theme-surface), 0.7);
  border: 1px solid rgba(var(--v-border-color), 0.22);
  transition: all 0.15s ease;
  min-width: 0;
  user-select: none;
}

.shortcut-h-btn:hover {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.35);
  transform: translateY(-1px);
}

.shortcut-h-btn:active {
  transform: translateY(0);
}

/* Lưới 2 cột đều đẹp cho Trạng thái (Thưa ra - Image 2) */
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 8px; /* Thưa ra theo yêu cầu */
}

.status-grid-btn {
  height: 31px; /* Tăng chiều cao để thưa và dễ bấm hơn */
  border-radius: 8px;
  border: 1px solid;
  padding: 0 10px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  user-select: none;
  width: 100%;
  overflow: hidden;
}

.status-grid-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.status-grid-btn:active {
  transform: translateY(0);
}

.status-grid-btn.is-active {
  font-weight: 700;
}

/* Gợi ý nhanh chip thoáng đãng, thưa hơn */
.quick-tag-btn {
  display: inline-flex;
  align-items: center;
  font-size: 0.68rem;
  font-weight: 500;
  height: 24px;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px solid rgba(var(--v-theme-primary), 0.22);
  background: rgba(var(--v-theme-primary), 0.06);
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  outline: none;
  transition: all 0.12s ease;
  white-space: nowrap;
}

.quick-tag-btn:hover {
  background: rgba(var(--v-theme-primary), 0.15);
  border-color: rgba(var(--v-theme-primary), 0.4);
  transform: translateY(-1px);
}

.quick-tag-btn:active {
  transform: translateY(0);
}

.compact-notes-textarea :deep(textarea) {
  font-size: 0.76rem !important;
  line-height: 1.4 !important;
}

/* Balanced contact panel: proportional controls, useful writing space, even grids. */
.chat-contact-panel { container-type:size; }
.chat-contact-panel--info { height:100% !important; max-height:100%; }
.chaten-tab-host { flex:1 1 0; min-height:0; height:100%; overflow:hidden; }
.panel-compact-heading { padding:8px 14px; min-height:44px; }
.panel-nav-tabs { --v-tabs-height:34px; flex:0 0 34px !important; }
.panel-nav-tabs :deep(.v-tab) { height:34px !important; min-height:34px; font-size:11px !important; }
.compact-info-body { display:flex; flex-direction:column; flex:1 1 0 !important; min-height:0; padding-bottom:12px; }
.compact-profile { display:flex; align-items:center; flex-shrink:0; gap:10px; padding:clamp(10px,1.7cqh,16px) 14px 12px; }
.compact-profile-avatar { border:1px solid rgba(var(--v-theme-primary),.12); }
.compact-profile-name { flex:1; min-width:0; }
.compact-profile-name strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; letter-spacing:-.25px; }
.compact-profile-name span { display:block; font-size:10px; margin-top:4px; color:rgba(var(--v-theme-on-surface),.55); }
.contact-action-strip { flex-shrink:0; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:6px; margin:0 14px clamp(10px,1.7cqh,16px); padding:4px; border:1px solid rgba(var(--v-theme-primary),.11); border-radius:10px; background:rgba(var(--v-theme-primary),.035); }
.contact-action-strip :deep(.v-btn) { width:100%; min-width:0; height:clamp(30px,4.4cqh,38px); border-radius:7px !important; color:rgb(var(--v-theme-primary)); }
.contact-action-strip :deep(.v-icon) { font-size:19px; }
.contact-action-strip :deep(.v-btn:hover), .contact-action-strip :deep(.action-selected) { background:rgba(var(--v-theme-primary),.10); }
.appointment-indicator { position:absolute; width:5px; height:5px; top:6px; right:8px; border-radius:50%; background:rgb(var(--v-theme-warning)); }
.compact-crm-section { display:flex; flex-direction:column; flex:1 0 auto; padding:clamp(10px,1.8cqh,17px) 14px 0; border-top:1px solid rgba(var(--v-theme-on-surface),.07); }
.compact-section-heading { flex-shrink:0; min-height:20px; margin-bottom:8px; gap:6px; }
.compact-section-heading > span { font-size:10px !important; }
.compact-status-grid { flex-shrink:0; gap:7px; margin-bottom:clamp(12px,2cqh,18px); }
.compact-status-grid .status-grid-btn { height:clamp(30px,4.5cqh,40px); padding-inline:8px; font-size:11px; border-radius:8px; }
.compact-status-grid .status-grid-btn .v-icon { font-size:14px !important; margin-right:5px !important; }
.compact-status-grid .status-grid-btn.is-active { box-shadow:0 2px 5px rgba(var(--v-theme-primary),.1) !important; }
.compact-need-action { flex-shrink:0; margin-bottom:12px; }
.compact-need-action :deep(.v-btn) { height:30px; font-size:11px; }
.compact-notes-heading { flex-shrink:0; min-height:24px; margin-bottom:8px; }
.compact-notes-heading > span { font-size:10px !important; }
.handover-summary-button { height:24px !important; font-size:10px !important; letter-spacing:0; padding-inline:8px !important; }
.compact-notes-textarea { display:flex; flex-direction:column; flex:1 0 76px !important; min-height:76px; }
.compact-notes-textarea :deep(.v-input__control) { flex:1; min-height:0; }
.compact-notes-textarea :deep(.v-field) { height:100%; border-radius:9px !important; background:rgba(var(--v-theme-primary),.015); }
.compact-notes-textarea :deep(.v-field__field) { height:100%; }
.compact-notes-textarea :deep(textarea) { height:100% !important; min-height:76px !important; max-height:none !important; font-size:12px !important; line-height:1.6 !important; padding:10px 12px !important; overflow-y:auto !important; resize:none; }
.compact-notes-actions { flex-shrink:0; justify-content:flex-end; gap:6px; padding-top:8px; margin-bottom:clamp(12px,2cqh,18px); }
.compact-notes-actions :deep(.v-btn) { height:29px !important; font-size:11px; padding-inline:12px; }
button:focus-visible { outline:2px solid rgb(var(--v-theme-primary)); outline-offset:2px; }
@container(max-height:740px) {
 .compact-info-body { padding-bottom:8px; }
 .compact-profile { padding:10px 14px 8px; }
 .contact-action-strip { margin-bottom:10px; }
 .compact-crm-section { padding-top:10px; }
 .compact-status-grid { gap:5px; margin-bottom:10px; }
 .compact-status-grid .status-grid-btn { height:29px; font-size:10px; }
 .compact-notes-actions { margin-bottom:10px; padding-top:6px; }
 .compact-notes-textarea { flex-basis:64px !important; min-height:64px; }
 .compact-notes-textarea :deep(textarea) { min-height:64px !important; }
}
@media (max-width: 420px) {
  .panel-nav-tabs :deep(.v-tab) {
    padding: 0 3px !important;
    font-size: 10.5px !important;
  }
  .compact-status-grid .status-grid-btn {
    min-height: 36px;
  }
}
</style>
