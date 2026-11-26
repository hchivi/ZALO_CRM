<template>
  <div>
    <div class="d-flex align-center justify-space-between flex-wrap mb-4" style="gap: 10px;">
      <h1 class="text-h5 text-sm-h4">Tài khoản Zalo & WhatsApp</h1>
      <div v-if="authStore.isAdmin" class="d-flex align-center flex-wrap" style="gap: 8px;">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="showAddDialog = true">
          Thêm Zalo
        </v-btn>
        <v-btn
          color="success"
          prepend-icon="mdi-whatsapp"
          style="background-color: #25D366 !important; color: white !important;"
          @click="showAddWhatsAppDialog = true"
        >
          Thêm WhatsApp
        </v-btn>
      </div>
    </div>

    <v-card>
      <v-data-table :headers="headers" :items="accounts" :loading="loading" no-data-text="Chưa có tài khoản nào">
        <!-- Channel Column -->
        <template #item.channel="{ item }">
          <v-chip
            v-if="item.channel === 'whatsapp'"
            size="small"
            color="success"
            variant="flat"
            style="background-color: #25D366 !important; color: white !important; font-weight: bold;"
          >
            <v-icon start size="14">mdi-whatsapp</v-icon>
            WhatsApp
          </v-chip>
          <v-chip
            v-else
            size="small"
            color="primary"
            variant="flat"
            style="font-weight: bold; background-color: #0068FF !important; color: white !important;"
          >
            <img :src="zaloLogoUrl" alt="Zalo" style="width: 14px; height: 14px; border-radius: 2px; margin-right: 6px; display: inline-block; vertical-align: middle; object-fit: cover;" />
            Zalo
          </v-chip>
        </template>

        <!-- Status Column -->
        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.liveStatus || item.status)" size="small" variant="flat">
            {{ statusText(item.liveStatus || item.status) }}
          </v-chip>
        </template>

        <!-- Actions Column -->
        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-end" style="gap: 4px;">
            <v-btn v-if="authStore.isAdmin" icon size="small" variant="tonal" color="primary" title="Phân quyền truy cập" @click="openAccess(item)">
              <v-icon>mdi-shield-account</v-icon>
            </v-btn>

            <!-- Zalo-only: Sync contacts -->
            <v-btn
              v-if="authStore.isAdmin && item.channel !== 'whatsapp'"
              icon
              size="small"
              color="success"
              @click="syncContacts(item.id)"
              title="Đồng bộ danh bạ Zalo"
              :loading="syncing === item.id"
            >
              <v-icon>mdi-account-sync</v-icon>
            </v-btn>

            <!-- Zalo-only: Pending Friend Requests Button with badge -->
            <v-btn
              v-if="item.channel !== 'whatsapp' && item.liveStatus === 'connected'"
              icon
              size="small"
              color="purple"
              title="Lời mời kết bạn đang chờ"
              @click="openPendingRequests(item)"
            >
              <v-badge
                v-if="pendingCounts[item.id] > 0"
                :content="pendingCounts[item.id]"
                color="error"
                floating
              >
                <v-icon>mdi-account-clock</v-icon>
              </v-badge>
              <v-icon v-else>mdi-account-clock</v-icon>
            </v-btn>

            <!-- WhatsApp QR Login -->
            <v-btn
              v-if="item.channel === 'whatsapp' && item.liveStatus !== 'connected'"
              icon
              size="small"
              color="success"
              @click="loginWhatsAppAccount(item.id)"
              title="Quét QR WhatsApp"
              style="color: #25D366 !important;"
            >
              <v-icon>mdi-qrcode</v-icon>
            </v-btn>

            <!-- Zalo QR Login -->
            <v-btn
              v-else-if="item.channel !== 'whatsapp' && item.liveStatus !== 'connected'"
              icon
              size="small"
              color="primary"
              @click="loginAccount(item.id)"
              title="Đăng nhập QR"
            >
              <v-icon>mdi-qrcode</v-icon>
            </v-btn>

            <!-- Reconnect button (Zalo with session) -->
            <v-btn
              v-if="item.channel !== 'whatsapp' && item.liveStatus === 'disconnected' && item.sessionData"
              icon
              size="small"
              color="info"
              @click="reconnectAccount(item.id)"
              title="Kết nối lại"
            >
              <v-icon>mdi-refresh</v-icon>
            </v-btn>

            <!-- Disconnect button when connected -->
            <v-btn
              v-if="authStore.isAdmin && (item.liveStatus === 'connected' || item.status === 'connected')"
              icon
              size="small"
              color="amber-darken-2"
              title="Đăng xuất / Ngắt kết nối (Giữ lại lịch sử chat)"
              :loading="disconnecting === item.id"
              @click="handleDirectDisconnect(item)"
            >
              <v-icon>mdi-link-off</v-icon>
            </v-btn>

            <!-- Delete button -->
            <v-btn v-if="authStore.isAdmin" icon size="small" color="error" @click="confirmDelete(item)" title="Xóa / Ngắt kết nối">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Add Zalo account dialog -->
    <v-dialog v-model="showAddDialog" max-width="400">
      <v-card class="rounded-xl">
        <v-card-title class="d-flex align-center pa-4">
          <img :src="zaloLogoUrl" alt="Zalo" style="width: 20px; height: 20px; border-radius: 4px; margin-right: 8px; object-fit: cover;" />
          <span class="text-h6 font-weight-bold">Thêm tài khoản Zalo</span>
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          <v-text-field v-model="newAccountName" label="Tên hiển thị (VD: Zalo Sale Hương)" variant="outlined" density="compact" hide-details @keyup.enter="handleAddAccount" />
        </v-card-text>
        <v-card-actions class="pa-4 pt-0 flex-wrap" style="gap: 8px;">
          <v-spacer />
          <v-btn variant="text" @click="showAddDialog = false">Hủy</v-btn>
          <v-btn color="primary" variant="flat" :loading="adding" @click="handleAddAccount">Thêm</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add WhatsApp account dialog -->
    <v-dialog v-model="showAddWhatsAppDialog" max-width="420">
      <v-card class="rounded-xl">
        <v-card-title class="d-flex align-center pa-4">
          <v-icon color="success" class="mr-2">mdi-whatsapp</v-icon>
          <span class="text-h6 font-weight-bold">Thêm tài khoản WhatsApp</span>
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          <p class="text-caption text-grey mb-3">
            Kết nối tài khoản WhatsApp cá nhân hoặc WhatsApp Business vào CRM bằng mã QR.
          </p>
          <v-text-field
            v-model="newWhatsAppAccountName"
            label="Tên hiển thị (VD: WhatsApp CSKH, WhatsApp Hotline)"
            variant="outlined"
            density="compact"
            hide-details
            @keyup.enter="handleAddWhatsAppAccount"
          />
        </v-card-text>
        <v-card-actions class="pa-4 pt-0 flex-wrap" style="gap: 8px;">
          <v-spacer />
          <v-btn variant="text" @click="showAddWhatsAppDialog = false">Hủy</v-btn>
          <v-btn
            color="success"
            variant="flat"
            style="background-color: #25D366 !important; color: white !important;"
            :loading="whatsappConnecting"
            @click="handleAddWhatsAppAccount"
          >
            Tạo mã QR
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Zalo QR Code dialog -->
    <v-dialog v-model="showQRDialog" max-width="400" persistent>
      <v-card class="text-center pa-4 rounded-xl">
        <v-card-title class="font-weight-bold">Quét QR để đăng nhập Zalo</v-card-title>
        <v-card-text>
          <div v-if="qrImage" class="mb-4 d-flex justify-center">
            <div style="background: #ffffff; padding: 14px; border-radius: 16px; display: inline-block; box-shadow: 0 4px 16px rgba(0,0,0,0.15);">
              <img :src="'data:image/png;base64,' + qrImage" alt="QR Code" style="max-width: 260px; width: 100%; display: block;" />
            </div>
          </div>
          <div v-else-if="qrScanned" class="mb-4">
            <v-icon icon="mdi-check-circle" size="64" color="success" />
            <p class="text-h6 mt-2">Đã quét! Xác nhận trên điện thoại...</p>
            <p v-if="scannedName" class="text-body-2">{{ scannedName }}</p>
          </div>
          <div v-else class="mb-4">
            <v-progress-circular indeterminate color="primary" size="64" />
            <p class="mt-2">Đang tạo QR code...</p>
          </div>
          <v-alert v-if="qrError" type="error" density="compact" class="mt-2">{{ qrError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="cancelQR">Đóng</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- WhatsApp QR Code dialog -->
    <v-dialog v-model="showWhatsAppQRDialog" max-width="440" persistent>
      <v-card class="text-center pa-4 rounded-xl">
        <v-card-title class="d-flex align-center justify-center font-weight-bold text-wrap">
          <v-icon color="success" class="mr-2">mdi-whatsapp</v-icon>
          Quét QR liên kết WhatsApp Web
        </v-card-title>

        <v-card-text class="pt-2">
          <div v-if="whatsappQrCode" class="my-3 d-flex justify-center">
            <div style="background: #ffffff; padding: 14px; border-radius: 16px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.12); border: 1px solid rgba(0,0,0,0.06);">
              <img :src="whatsappQrCode" alt="WhatsApp QR Code" style="max-width: 250px; width: 100%; display: block;" />
            </div>
          </div>
          <div v-else class="my-8">
            <v-progress-circular indeterminate color="success" size="64" />
            <p class="mt-4 text-body-2 font-weight-medium">Đang kết nối WhatsApp Web & tạo mã QR...</p>
            <p class="text-caption text-grey">Vui lòng đợi vài giây...</p>
          </div>

          <v-alert v-if="whatsappError" type="error" density="compact" class="mt-2 text-left">
            {{ whatsappError }}
          </v-alert>

          <!-- 3-step Instructions -->
          <v-card variant="tonal" color="success" class="mt-3 pa-3 text-left rounded-lg" style="background-color: rgba(37, 211, 102, 0.08) !important;">
            <div class="font-weight-bold text-caption text-success mb-1">HƯỚNG DẪN QUÉT TRÊN ĐIỆN THOẠI:</div>
            <ol class="text-caption text-medium-emphasis pl-4 mb-0" style="line-height: 1.6;">
              <li>Mở <strong>WhatsApp</strong> trên điện thoại</li>
              <li>Vào <strong>Cài đặt</strong> (iOS) hoặc bấm <strong>⋮ (3 chấm)</strong> (Android) &gt; Chọn <strong>Thiết bị liên kết</strong></li>
              <li>Bấm <strong>Liên kết thiết bị</strong> và quét mã QR ở trên để đăng nhập</li>
            </ol>
          </v-card>
        </v-card-text>

        <v-card-actions class="justify-center">
          <v-btn variant="outlined" color="grey" @click="cancelWhatsAppQR">Đóng</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Enhanced Delete / Deactivate dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="520">
      <v-card style="border-radius: 16px;">
        <v-card-title class="d-flex align-center pa-4" style="border-bottom: 1px solid rgba(255,255,255,0.08); gap: 8px;">
          <v-icon color="warning" class="flex-shrink-0">mdi-alert-circle-outline</v-icon>
          <span class="text-h6 text-wrap" style="min-width: 0;">Quản lý: {{ deleteTarget?.displayName || deleteTarget?.id }}</span>
        </v-card-title>
        
        <v-card-text class="pa-4">
          <v-alert
            v-if="targetStats.loading"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            Đang kiểm tra dữ liệu liên quan...
          </v-alert>
          <v-alert
            v-else
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            <div class="font-weight-medium">Dữ liệu liên quan đến tài khoản này:</div>
            <div class="text-body-2 mt-1">
              💬 <strong>{{ targetStats.conversationCount }}</strong> cuộc hội thoại &bull; 
              📨 <strong>{{ targetStats.messageCount }}</strong> tin nhắn đã lưu
            </div>
          </v-alert>

          <p class="text-body-2 mb-3">Vui lòng chọn hình thức xử lý:</p>

          <v-radio-group v-model="deleteMode" density="compact" hide-details>
            <v-radio value="disconnect" color="primary">
              <template #label>
                <div class="py-1">
                  <div class="font-weight-bold text-body-2 text-primary">Ngắt kết nối & Vô hiệu hóa (Khuyên dùng)</div>
                  <div class="text-caption text-grey">Dừng nhận/gửi tin nhắn, ngắt kết nối nhưng <strong>bảo tồn 100% lịch sử chat</strong> và dữ liệu khách hàng.</div>
                </div>
              </template>
            </v-radio>
            <v-divider class="my-2" />
            <v-radio value="purge" color="error">
              <template #label>
                <div class="py-1">
                  <div class="font-weight-bold text-body-2 text-error">Xóa vĩnh viễn (Xóa sạch toàn bộ)</div>
                  <div class="text-caption text-error-lighten-1">Xóa tài khoản và <strong>xóa toàn bộ {{ targetStats.conversationCount }} cuộc hội thoại, {{ targetStats.messageCount }} tin nhắn</strong> khỏi CRM. Không thể hoàn tác!</div>
                </div>
              </template>
            </v-radio>
          </v-radio-group>

          <v-checkbox
            v-if="deleteMode === 'purge'"
            v-model="confirmPurgeCheck"
            color="error"
            density="compact"
            class="mt-3"
            label="Tôi hiểu hành động này sẽ xóa vĩnh viễn toàn bộ lịch sử chat và không thể hoàn tác."
            hide-details
          />
        </v-card-text>

        <v-card-actions class="pa-4 pt-0 flex-wrap" style="gap: 8px;">
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">Hủy</v-btn>
          <v-btn
            v-if="deleteMode === 'disconnect'"
            color="warning"
            variant="flat"
            :loading="deleting"
            prepend-icon="mdi-link-off"
            @click="handleDeleteAccount"
          >
            Ngắt kết nối an toàn
          </v-btn>
          <v-btn
            v-else
            color="error"
            variant="flat"
            :loading="deleting"
            :disabled="!confirmPurgeCheck"
            prepend-icon="mdi-delete-forever"
            @click="handleDeleteAccount"
          >
            Xóa vĩnh viễn
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Access control dialog -->
    <ZaloAccessDialog
      v-model="showAccessDialog"
      :account-id="accessTarget?.id ?? ''"
      :account-name="accessTarget?.displayName ?? accessTarget?.id ?? ''"
    />

    <!-- Pending Friend Requests Dialog (Zalo only) -->
    <v-dialog v-model="showPendingDialog" max-width="560" scrollable>
      <v-card class="rounded-xl">
        <v-card-title class="d-flex align-center justify-space-between pa-3 pa-sm-4" style="border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); gap: 8px;">
          <div class="d-flex align-center" style="gap: 8px; min-width: 0; flex: 1;">
            <v-icon color="purple-lighten-2" class="flex-shrink-0">mdi-account-clock</v-icon>
            <span class="text-subtitle-1 font-weight-bold text-foreground text-wrap">
              Lời mời kết bạn Zalo [{{ pendingAccountName }}]
            </span>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" class="flex-shrink-0" @click="showPendingDialog = false" />
        </v-card-title>

        <v-card-text class="pa-3">
          <div v-if="loadingPending" class="text-center py-8">
            <v-progress-circular indeterminate color="purple" size="40" />
            <p class="text-caption text-grey mt-2">Đang tải...</p>
          </div>

          <div v-else-if="pendingRequests.length === 0" class="text-center py-8">
            <v-icon size="48" color="grey" class="mb-2">mdi-account-check-outline</v-icon>
            <p class="text-body-2 text-grey">Không có lời mời kết bạn nào đang chờ</p>
          </div>

          <div v-else class="d-flex flex-column" style="gap: 10px;">
            <v-card
              v-for="req in pendingRequests"
              :key="req.uid"
              variant="outlined"
              class="pa-3 rounded-lg"
              style="background: rgba(var(--v-theme-surface), 0.6); border-color: rgba(var(--v-border-color), var(--v-border-opacity));"
            >
              <div class="d-flex flex-wrap align-start" style="gap: 12px;">
                <v-avatar size="48" color="grey-darken-3" style="border: 2px solid rgba(var(--v-theme-primary), 0.3); flex-shrink: 0;">
                  <v-img v-if="req.avatar" :src="req.avatar" />
                  <v-icon v-else size="24" color="primary">mdi-account</v-icon>
                </v-avatar>

                <div class="flex-grow-1" style="min-width: 140px;">
                  <p class="text-subtitle-2 font-weight-bold text-foreground mb-0">{{ req.displayName }}</p>
                  <p class="text-caption text-grey mb-1 text-truncate">UID: {{ req.uid }}</p>
                  <div v-if="req.message" class="text-caption pa-2 rounded" style="background: rgba(var(--v-theme-surface-variant), 0.5); font-style: italic;">
                    "{{ req.message }}"
                  </div>
                </div>

                <div class="d-flex flex-row flex-sm-column flex-wrap" style="gap: 6px; flex-shrink: 0;">
                  <v-btn
                    color="success"
                    size="small"
                    variant="flat"
                    class="text-none font-weight-bold"
                    :loading="processingUid === req.uid && lastAction === 'accept'"
                    :disabled="!!processingUid"
                    @click="handleAccept(req)"
                  >
                    <v-icon start size="14">mdi-check</v-icon>
                    Đồng ý
                  </v-btn>
                  <v-btn
                    color="error"
                    size="small"
                    variant="outlined"
                    class="text-none font-weight-bold"
                    :loading="processingUid === req.uid && lastAction === 'reject'"
                    :disabled="!!processingUid"
                    @click="handleReject(req)"
                  >
                    <v-icon start size="14">mdi-close</v-icon>
                    Từ chối
                  </v-btn>
                </div>
              </div>
            </v-card>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="top">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { createSocket } from '@/modules/zalocrm/integration';
import zaloLogoUrl from '@/modules/zalocrm/assets/logo-zalo.webp';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from '@/modules/zalocrm/router-adapter';
import { useZaloAccounts, type ZaloAccount } from '@/modules/zalocrm/composables/use-zalo-accounts';
import { useAuthStore } from '@/modules/zalocrm/stores/auth';
import ZaloAccessDialog from '@/modules/zalocrm/components/settings/ZaloAccessDialog.vue';
import { api } from '@/modules/zalocrm/api/index';

const {
  accounts, loading, adding, deleting,
  showQRDialog, qrImage, qrScanned, scannedName, qrError,
  showWhatsAppQRDialog, whatsappQrCode, whatsappConnecting, whatsappError, whatsappPairingCode, whatsappPairingLoading, requestPairingCode,
  statusColor, statusText,
  fetchAccounts, addAccount, addWhatsAppAccount, loginAccount, loginWhatsAppAccount, reconnectAccount, deleteAccount,
  disconnectAccount, getAccountStats,
  cancelQR, cancelWhatsAppQR, setupSocket,
} = useZaloAccounts();

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const showAddDialog = ref(false);
const showAddWhatsAppDialog = ref(false);
const waActiveTab = ref<'qr' | 'code'>('qr');
const waPhoneNumber = ref('');
const waCopied = ref(false);

async function handleGetPairingCode() {
  if (!waPhoneNumber.value.trim()) return;
  await requestPairingCode(waPhoneNumber.value.trim());
}

function copyPairingCode() {
  if (!whatsappPairingCode.value) return;
  navigator.clipboard.writeText(whatsappPairingCode.value.replace(/-/g, ''));
  waCopied.value = true;
  setTimeout(() => { waCopied.value = false; }, 2500);
}

const newAccountName = ref('');
const newWhatsAppAccountName = ref('');

watch(() => route.query.add, value => {
  if (value === '1' && authStore.isAdmin) {
    showAddDialog.value = true;
    const { add: _add, ...query } = route.query;
    router.replace({ path: route.path, query });
  }
}, { immediate: true });

const syncing = ref<string | null>(null);
const showDeleteDialog = ref(false);
const showAccessDialog = ref(false);
const deleteTarget = ref<ZaloAccount | null>(null);
const accessTarget = ref<ZaloAccount | null>(null);

// Enhanced delete/disconnect state
const deleteMode = ref<'disconnect' | 'purge'>('disconnect');
const confirmPurgeCheck = ref(false);
const targetStats = ref({ loading: false, conversationCount: 0, messageCount: 0 });
const disconnecting = ref<string | null>(null);

// Pending friend requests
const showPendingDialog = ref(false);
const pendingAccountId = ref('');
const pendingAccountName = ref('');
const pendingRequests = ref<any[]>([]);
const loadingPending = ref(false);
const processingUid = ref('');
const lastAction = ref('');
const pendingCounts = ref<Record<string, number>>({});

const snackbar = ref({ show: false, text: '', color: 'success' });

const headers = [
  { title: 'Kênh', key: 'channel', sortable: true },
  { title: 'Tên hiển thị', key: 'displayName', sortable: true },
  { title: 'Tài khoản / UID', key: 'zaloUid' },
  { title: 'SĐT', key: 'phone' },
  { title: 'Trạng thái', key: 'status', sortable: true },
  { title: 'Hành động', key: 'actions', sortable: false, align: 'end' as const },
];

async function syncContacts(accountId: string) {
  syncing.value = accountId;
  try {
    const res = await api.post(`/zalo-accounts/${accountId}/sync-contacts`);
    snackbar.value = { show: true, text: `Đồng bộ thành công: ${res.data.created} mới, ${res.data.updated} cập nhật`, color: 'success' };
  } catch (err: any) {
    snackbar.value = { show: true, text: 'Đồng bộ thất bại: ' + (err.response?.data?.error || err.message), color: 'error' };
  } finally {
    syncing.value = null;
  }
}

async function handleAddAccount() {
  const ok = await addAccount(newAccountName.value);
  if (ok) {
    showAddDialog.value = false;
    newAccountName.value = '';
  }
}

async function handleAddWhatsAppAccount() {
  const name = newWhatsAppAccountName.value.trim() || 'WhatsApp CSKH';
  showAddWhatsAppDialog.value = false;
  newWhatsAppAccountName.value = '';
  await addWhatsAppAccount(name);
}

async function handleDirectDisconnect(account: ZaloAccount) {
  disconnecting.value = account.id;
  try {
    const ok = await disconnectAccount(account.id);
    if (ok) {
      snackbar.value = {
        show: true,
        text: `Đã ngắt kết nối tài khoản "${account.displayName || account.id}". Lịch sử chat được giữ nguyên.`,
        color: 'info'
      };
    } else {
      snackbar.value = { show: true, text: 'Không thể ngắt kết nối', color: 'error' };
    }
  } finally {
    disconnecting.value = null;
  }
}

async function confirmDelete(account: ZaloAccount) {
  deleteTarget.value = account;
  deleteMode.value = 'disconnect';
  confirmPurgeCheck.value = false;
  targetStats.value = { loading: true, conversationCount: 0, messageCount: 0 };
  showDeleteDialog.value = true;

  const stats = await getAccountStats(account.id);
  targetStats.value = { loading: false, ...stats };
}

function openAccess(account: ZaloAccount) {
  accessTarget.value = account;
  showAccessDialog.value = true;
}

async function handleDeleteAccount() {
  if (!deleteTarget.value) return;
  const isPurge = deleteMode.value === 'purge';
  const targetName = deleteTarget.value.displayName || deleteTarget.value.id;
  const ok = await deleteAccount(deleteTarget.value, isPurge);
  if (ok) {
    snackbar.value = {
      show: true,
      text: isPurge
        ? `Đã xóa vĩnh viễn tài khoản "${targetName}" và toàn bộ lịch sử chat.`
        : `Đã ngắt kết nối tài khoản "${targetName}". Lịch sử chat được bảo toàn.`,
      color: isPurge ? 'warning' : 'success'
    };
    showDeleteDialog.value = false;
    deleteTarget.value = null;
  }
}

async function openPendingRequests(account: ZaloAccount) {
  pendingAccountId.value = account.id;
  pendingAccountName.value = account.displayName || account.id;
  showPendingDialog.value = true;
  loadingPending.value = true;
  pendingRequests.value = [];
  try {
    const res = await api.get(`/zalo-accounts/${account.id}/friend-requests`);
    pendingRequests.value = res.data.requests || [];
    pendingCounts.value[account.id] = pendingRequests.value.length;
  } catch (err: any) {
    snackbar.value = { show: true, text: err.response?.data?.error || 'Lỗi khi tải lời mời từ Zalo', color: 'error' };
  } finally {
    loadingPending.value = false;
  }
}

async function handleAccept(req: any) {
  processingUid.value = req.uid;
  lastAction.value = 'accept';
  try {
    const res = await api.post(`/zalo-accounts/${pendingAccountId.value}/accept-friend-request`, {
      uid: req.uid,
      displayName: req.displayName,
      avatar: req.avatar,
    });
    pendingRequests.value = pendingRequests.value.filter(r => r.uid !== req.uid);
    pendingCounts.value[pendingAccountId.value] = pendingRequests.value.length;
    snackbar.value = { show: true, text: `Đã kết bạn với ${req.displayName}!`, color: 'success' };
    if (res.data?.conversationId) {
      showPendingDialog.value = false;
      router.push(`/chat?convId=${res.data.conversationId}`);
    }
  } catch (err: any) {
    snackbar.value = { show: true, text: err.response?.data?.error || 'Lỗi khi chấp nhận kết bạn', color: 'error' };
  } finally {
    processingUid.value = '';
    lastAction.value = '';
  }
}

async function handleReject(req: any) {
  processingUid.value = req.uid;
  lastAction.value = 'reject';
  try {
    await api.post(`/zalo-accounts/${pendingAccountId.value}/reject-friend-request`, {
      uid: req.uid,
    });
    pendingRequests.value = pendingRequests.value.filter(r => r.uid !== req.uid);
    pendingCounts.value[pendingAccountId.value] = pendingRequests.value.length;
    snackbar.value = { show: true, text: `Đã từ chối lời mời từ ${req.displayName}`, color: 'info' };
  } catch (err: any) {
    snackbar.value = { show: true, text: err.response?.data?.error || 'Lỗi khi từ chối', color: 'error' };
  } finally {
    processingUid.value = '';
    lastAction.value = '';
  }
}

async function fetchAccountsAndCounts() {
  await fetchAccounts();
  for (const account of accounts.value) {
    if (account.channel !== 'whatsapp' && account.liveStatus === 'connected') {
      try {
        const res = await api.get(`/zalo-accounts/${account.id}/friend-requests`);
        pendingCounts.value[account.id] = (res.data?.requests || []).length;
      } catch (_) {}
    }
  }
}

let friendRequestSocket: any = null;
const handleFriendRequest = (data: any) => {
  if (data?.accountId) {
    pendingCounts.value[data.accountId] = (pendingCounts.value[data.accountId] || 0) + 1;
    if (showPendingDialog.value && pendingAccountId.value === data.accountId) {
      const mappedReq = {
        uid: data.senderUid,
        displayName: data.senderName,
        avatar: data.senderAvatar,
        message: data.message,
      };
      const exists = pendingRequests.value.find(r => r.uid === mappedReq.uid);
      if (!exists) pendingRequests.value.unshift(mappedReq);
    }
  }
};

onMounted(() => {
  fetchAccountsAndCounts();
  setupSocket();

  // Listen for real-time friend requests to update badge counts
  friendRequestSocket = createSocket();
  friendRequestSocket.on('zalo:friend_request', handleFriendRequest);
});

onUnmounted(() => {
  friendRequestSocket?.off('zalo:friend_request', handleFriendRequest);
  friendRequestSocket = null;
});
</script>
