<template>
  <v-dialog v-model="open" max-width="520" :fullscreen="mobile">
    <v-card :rounded="mobile ? '0' : 'lg'">
      <v-card-title class="d-flex align-center text-wrap pa-3 pa-sm-4">
        <v-icon class="mr-2 flex-shrink-0" color="cyan">mdi-shield-account</v-icon>
        <span style="min-width: 0; overflow-wrap: anywhere;">Phân quyền truy cập — {{ accountName }}</span>
      </v-card-title>

      <v-card-text class="pa-3 pa-sm-4">
        <v-progress-linear v-if="loading" indeterminate color="cyan" class="mb-3" />

        <!-- Current access list -->
        <div v-if="accessList.length" class="mb-4">
          <div class="text-subtitle-2 mb-2">Người có quyền truy cập</div>
          <div class="d-flex flex-column rounded-lg border pa-2" style="gap: 8px; background: rgba(var(--v-theme-on-surface), 0.03);">
            <div
              v-for="a in accessList"
              :key="a.id"
              class="d-flex flex-wrap align-center justify-space-between pa-2 rounded"
              style="gap: 8px;"
            >
              <div class="d-flex align-center" style="min-width: 0; flex: 1 1 180px; gap: 10px;">
                <v-icon color="cyan" class="flex-shrink-0">mdi-account</v-icon>
                <div style="min-width: 0;">
                  <div class="text-body-2 font-weight-medium text-truncate">{{ a.fullName }}</div>
                  <div class="text-caption text-medium-emphasis text-truncate">{{ a.email }}</div>
                </div>
              </div>
              <div class="d-flex align-center flex-shrink-0" style="gap: 6px;">
                <v-select
                  :model-value="a.permission"
                  :items="permissionOptions"
                  item-title="label"
                  item-value="value"
                  density="compact"
                  hide-details
                  variant="outlined"
                  style="min-width: 112px;"
                  @update:model-value="handleUpdatePermission(a.id, $event)"
                />
                <v-btn icon size="x-small" color="error" variant="text" @click="handleRemoveAccess(a.id)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="!loading" class="text-medium-emphasis text-body-2 mb-4">
          Chưa có người dùng nào được cấp quyền
        </div>

        <!-- Add access section -->
        <v-divider class="mb-3" />
        <div class="text-subtitle-2 mb-2">Thêm người dùng</div>
        <div class="d-flex flex-wrap align-stretch align-sm-center" style="gap: 8px;">
          <v-select
            v-model="newUserId"
            :items="availableUsers"
            item-title="displayLabel"
            item-value="id"
            label="Chọn nhân viên"
            density="compact"
            hide-details
            variant="outlined"
            no-data-text="Không có nhân viên để thêm"
            style="flex: 1 1 180px; min-width: 0;"
          />
          <v-select
            v-model="newPermission"
            :items="permissionOptions"
            item-title="label"
            item-value="value"
            label="Quyền"
            density="compact"
            hide-details
            variant="outlined"
            style="flex: 0 1 130px; min-width: 110px;"
          />
          <v-btn color="primary" :loading="saving" :disabled="!newUserId" @click="handleAddAccess">
            Thêm
          </v-btn>
        </div>
        <div class="text-caption text-medium-emphasis mt-3 d-flex align-start" style="gap: 6px;">
          <v-icon size="16" color="info" class="mt-0.5 flex-shrink-0">mdi-information-outline</v-icon>
          <div><strong>Lưu ý phân quyền:</strong> Kế toán mặc định có quyền xem tra cứu toàn hệ thống; được phép chat trong <em>Nhóm chat (Group)</em> và các hội thoại được bàn giao xử lý.</div>
        </div>
        <v-alert v-if="dialogError" type="error" density="compact" class="mt-3">{{ dialogError }}</v-alert>
      </v-card-text>

      <v-card-actions class="flex-wrap pa-3" style="gap: 8px;">
        <v-spacer />
        <v-btn @click="open = false">Đóng</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDisplay } from 'vuetify';

import { api } from '@/modules/zalocrm/api/index';
import { useUsers } from '@/modules/zalocrm/composables/use-users';

const { mobile } = useDisplay();

interface AccessEntry {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  permission: string;
}

const props = defineProps<{
  modelValue: boolean;
  accountId: string;
  accountName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const { users, fetchUsers } = useUsers();

// Writable computed to allow v-model on the dialog
const open = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const accessList = ref<AccessEntry[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogError = ref('');
const newUserId = ref('');
const newPermission = ref('read');

const permissionOptions = [
  { label: 'Xem', value: 'read' },
  { label: 'Chat', value: 'chat' },
  { label: 'Quản lý', value: 'admin' },
];

const availableUsers = computed(() => {
  const grantedIds = new Set(accessList.value.map((a) => a.userId));
  return users.value
    .filter((u) => !grantedIds.has(u.id))
    .map((u) => ({
      ...u,
      displayLabel: u.role === 'accountant' ? `${u.fullName} (Kế toán)` : (u.role === 'admin' ? `${u.fullName} (Admin)` : u.fullName),
    }));
});

async function fetchAccess() {
  if (!props.accountId) return;
  loading.value = true;
  try {
    const res = await api.get(`/zalo-accounts/${props.accountId}/access`);
    const list = res.data.access ?? res.data ?? [];
    accessList.value = list.map((a: any) => ({
      id: a.id,
      userId: a.userId,
      permission: a.permission,
      fullName: a.user?.fullName || 'Không rõ',
      email: a.user?.email || '',
    }));
  } catch {
    accessList.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleAddAccess() {
  if (!newUserId.value) return;
  saving.value = true;
  dialogError.value = '';
  try {
    await api.post(`/zalo-accounts/${props.accountId}/access`, {
      userId: newUserId.value,
      permission: newPermission.value,
    });
    newUserId.value = '';
    newPermission.value = 'read';
    await fetchAccess();
  } catch (err: any) {
    dialogError.value = err.response?.data?.error || 'Lỗi thêm quyền truy cập';
  } finally {
    saving.value = false;
  }
}

async function handleUpdatePermission(accessId: string, permission: string) {
  try {
    await api.put(`/zalo-accounts/${props.accountId}/access/${accessId}`, { permission });
    await fetchAccess();
  } catch (err: any) {
    dialogError.value = err.response?.data?.error || 'Lỗi cập nhật quyền';
  }
}

async function handleRemoveAccess(accessId: string) {
  try {
    await api.delete(`/zalo-accounts/${props.accountId}/access/${accessId}`);
    await fetchAccess();
  } catch (err: any) {
    dialogError.value = err.response?.data?.error || 'Lỗi xóa quyền truy cập';
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    dialogError.value = '';
    fetchAccess();
    fetchUsers();
  }
});
</script>
