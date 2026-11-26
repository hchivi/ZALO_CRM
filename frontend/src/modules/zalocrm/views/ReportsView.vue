<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4 flex-wrap" style="gap: 12px;">
      <h1 class="text-h5 text-sm-h4">Báo cáo</h1>
      <div class="d-flex align-center flex-wrap" style="gap: 8px;">
        <!-- Nút chọn nhanh khoảng thời gian -->
        <div class="d-flex align-center flex-wrap mr-1" style="gap: 4px;">
          <v-chip
            size="small"
            :variant="dateRangePreset === 30 ? 'flat' : 'outlined'"
            :color="dateRangePreset === 30 ? 'primary' : undefined"
            class="font-weight-medium cursor-pointer"
            @click="applyDatePreset(30)"
          >
            30 ngày
          </v-chip>
          <v-chip
            size="small"
            :variant="dateRangePreset === 60 ? 'flat' : 'outlined'"
            :color="dateRangePreset === 60 ? 'primary' : undefined"
            class="font-weight-medium cursor-pointer"
            @click="applyDatePreset(60)"
          >
            60 ngày
          </v-chip>
          <v-chip
            size="small"
            :variant="dateRangePreset === 90 ? 'flat' : 'outlined'"
            :color="dateRangePreset === 90 ? 'primary' : undefined"
            class="font-weight-medium cursor-pointer"
            @click="applyDatePreset(90)"
          >
            90 ngày
          </v-chip>
          <v-chip
            size="small"
            :variant="dateRangePreset === 'all' ? 'flat' : 'outlined'"
            :color="dateRangePreset === 'all' ? 'primary' : undefined"
            class="font-weight-medium cursor-pointer"
            @click="applyDatePreset('all')"
          >
            Tất cả
          </v-chip>
        </div>

        <v-text-field
          v-model="dateFrom"
          label="Từ ngày"
          type="date"
          density="compact"
          variant="outlined"
          style="flex: 1 1 145px; max-width: 180px; min-width: 130px;"
          hide-details
        />
        <v-text-field
          v-model="dateTo"
          label="Đến ngày"
          type="date"
          density="compact"
          variant="outlined"
          style="flex: 1 1 145px; max-width: 180px; min-width: 130px;"
          hide-details
        />
        <v-btn color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="fetchReport">Xem</v-btn>
        <v-btn color="success" prepend-icon="mdi-file-excel" :loading="exporting" @click="exportExcel">Xuất Excel</v-btn>
      </div>
    </div>

    <v-tabs v-model="tab" show-arrows class="mb-4">
      <v-tab value="messages">Tin nhắn</v-tab>
      <v-tab value="contacts">Khách hàng</v-tab>
      <v-tab value="appointments">Lịch hẹn</v-tab>
      <v-tab value="kpi">Hiệu suất Nhân viên</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="messages">
        <v-data-table
          :headers="msgHeaders"
          :items="msgData"
          :loading="loading"
          no-data-text="Không có dữ liệu"
          :items-per-page="50"
          :items-per-page-options="[10, 25, 50, 100, -1]"
        />
      </v-window-item>
      <v-window-item value="contacts">
        <!-- Summary Cards by Zalo Account -->
        <v-row class="mb-4" dense v-if="contactZaloSummaries.length > 0">
          <!-- Total Card -->
          <v-col cols="12" sm="6" md="3">
            <v-card 
              class="pa-4 rounded-xl stat-card"
              :class="{ 'stat-card-active': selectedAccountFilter === '' }"
              @click="selectedAccountFilter = ''"
              style="background: #f0fdf4 !important; border: 1.5px solid #86efac !important; cursor: pointer;"
            >
              <div class="d-flex align-center">
                <v-avatar color="success" size="48" class="mr-3 elevation-1">
                  <v-icon color="white">mdi-account-group-outline</v-icon>
                </v-avatar>
                <div>
                  <div class="stat-card-title" style="color: #14532d !important;">Tổng khách hàng mới</div>
                  <div class="stat-card-count" style="color: #15803d !important;">
                    {{ totalNewContacts }} <span class="stat-card-unit" style="color: #166534 !important;">KH</span>
                  </div>
                </div>
              </div>
            </v-card>
          </v-col>
          <!-- Zalo Account Cards -->
          <v-col
            v-for="item in contactZaloSummaries"
            :key="item.zaloName"
            cols="12"
            sm="6"
            md="3"
          >
            <v-card 
              class="pa-4 rounded-xl stat-card"
              :class="{ 'stat-card-active': selectedAccountFilter === item.zaloName }"
              @click="toggleAccountFilter(item.zaloName)"
              style="background: #ffffff !important; border: 1.5px solid #cbd5e1; cursor: pointer;"
            >
              <div class="d-flex align-center">
                <v-avatar 
                  :color="item.channel === 'whatsapp' ? 'success' : 'primary'" 
                  size="48" 
                  class="mr-3 flex-shrink-0 elevation-1"
                >
                  <v-icon color="white" v-if="item.channel === 'whatsapp'">mdi-whatsapp</v-icon>
                  <v-icon color="white" v-else-if="item.zaloName !== 'Tạo thủ công'">mdi-account-box-outline</v-icon>
                  <v-icon color="white" v-else>mdi-account-plus-outline</v-icon>
                </v-avatar>
                <div style="min-width: 0; flex: 1;">
                  <div class="stat-card-title text-truncate" :title="item.zaloName">{{ item.zaloName }}</div>
                  <div class="stat-card-count">
                    {{ item.count }} <span class="stat-card-unit">KH</span>
                  </div>
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Search & Filter Controls -->
        <v-card class="pa-4 rounded-xl elevation-1 mb-3" style="border: 1px solid #e2e8f0;">
          <div class="d-flex align-center justify-space-between flex-wrap" style="gap: 12px;">
            <div class="d-flex align-center flex-wrap" style="gap: 12px; flex: 1; max-width: 650px;">
              <v-text-field
                v-model="customerSearch"
                placeholder="Tìm theo tên khách hàng, số điện thoại, nội dung..."
                density="compact"
                variant="outlined"
                prepend-inner-icon="mdi-magnify"
                hide-details
                clearable
                style="min-width: 250px; flex: 1;"
              />
              <v-select
                v-model="selectedAccountFilter"
                :items="accountFilterOptions"
                item-title="title"
                item-value="value"
                label="Lọc thương hiệu"
                density="compact"
                variant="outlined"
                hide-details
                style="min-width: 180px; max-width: 220px;"
              />
            </div>
            <div class="text-body-2 font-weight-bold" style="color: #334155;">
              Danh sách: <span class="text-success font-weight-black" style="font-size: 1rem;">{{ filteredCustomers.length }}</span> khách hàng mới
            </div>
          </div>
        </v-card>

        <!-- New Customers Table (replaces old "Phân loại" table) -->
        <v-card class="rounded-xl elevation-2" style="border: 1px solid #e2e8f0;">
          <v-data-table
            :headers="contactHeaders"
            :items="filteredCustomers"
            :loading="loading"
            no-data-text="Không có khách hàng mới trong khoảng thời gian này"
            items-per-page="10"
          >
            <template #item.customerName="{ item }">
              <div class="d-flex align-center py-2">
                <v-avatar size="36" color="primary" class="mr-3 text-white font-weight-bold" style="font-size: 0.85rem;">
                  <v-img v-if="item.avatarUrl" :src="item.avatarUrl" />
                  <span v-else>{{ (item.customerName || 'KH').charAt(0).toUpperCase() }}</span>
                </v-avatar>
                <div>
                  <div class="font-weight-bold" style="color: #0f172a; font-size: 0.95rem;">
                    {{ item.customerName }}
                  </div>
                  <div class="text-caption text-grey" v-if="item.phone">
                    {{ item.phone }}
                  </div>
                </div>
              </div>
            </template>

            <template #item.accountName="{ item }">
              <div class="d-flex align-center">
                <v-chip
                  size="small"
                  :color="item.channel === 'whatsapp' ? 'success' : 'primary'"
                  variant="tonal"
                  class="mr-2 font-weight-bold"
                >
                  <v-icon start size="14" v-if="item.channel === 'whatsapp'">mdi-whatsapp</v-icon>
                  <v-icon start size="14" v-else>mdi-chat-processing-outline</v-icon>
                  {{ item.channel === 'whatsapp' ? 'WhatsApp' : 'Zalo' }}
                </v-chip>
                <span class="font-weight-bold" style="color: #1e293b;">{{ item.accountName }}</span>
              </div>
            </template>

            <template #item.firstMessageAt="{ item }">
              <span class="text-body-2 font-weight-medium" style="color: #334155;">
                {{ formatDateTime(item.firstMessageAt) }}
              </span>
            </template>

            <template #item.totalMessages="{ item }">
              <v-chip size="small" color="info" variant="flat" class="font-weight-bold">
                {{ item.totalMessages }} tin
              </v-chip>
            </template>

            <template #item.firstMessageContent="{ item }">
              <div class="text-truncate" style="max-width: 300px; color: #475569;" :title="item.firstMessageContent">
                {{ item.firstMessageContent || '—' }}
              </div>
            </template>

            <template #item.actions="{ item }">
              <v-btn
                size="small"
                variant="outlined"
                color="primary"
                prepend-icon="mdi-chat"
                class="rounded-lg"
                @click="goToConversation(item.conversationId)"
              >
                Nhắn tin
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>
      <v-window-item value="appointments">
        <v-data-table
          :headers="aptHeaders"
          :items="aptData"
          :loading="loading"
          no-data-text="Không có dữ liệu"
        />
      </v-window-item>
      <v-window-item value="kpi">
        <!-- Summary KPI Cards -->
        <v-row class="mb-4" dense>
          <v-col cols="12" md="4">
            <v-card class="pa-4 rounded-xl elevation-2">
              <div class="d-flex align-center">
                <v-avatar color="primary" size="48" class="mr-3">
                  <v-icon color="white">mdi-flash</v-icon>
                </v-avatar>
                <div>
                  <div class="text-caption text-grey">Phản hồi nhanh nhất</div>
                  <div class="text-h6 font-weight-bold">{{ fastestStaff }}</div>
                </div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card class="pa-4 rounded-xl elevation-2">
              <div class="d-flex align-center">
                <v-avatar color="success" size="48" class="mr-3">
                  <v-icon color="white">mdi-message-processing-outline</v-icon>
                </v-avatar>
                <div>
                  <div class="text-caption text-grey">Tương tác nhiều nhất</div>
                  <div class="text-h6 font-weight-bold">{{ mostActiveStaff }}</div>
                </div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card class="pa-4 rounded-xl elevation-2">
              <div class="d-flex align-center">
                <v-avatar color="warning" size="48" class="mr-3">
                  <v-icon color="white">mdi-trophy-outline</v-icon>
                </v-avatar>
                <div>
                  <div class="text-caption text-grey">Doanh số cao nhất</div>
                  <div class="text-h6 font-weight-bold">{{ topSalesStaff }}</div>
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- KPI Data Table -->
        <v-card class="rounded-xl elevation-2">
          <v-data-table
            :headers="kpiHeaders"
            :items="kpiData"
            :loading="loading"
            no-data-text="Không có dữ liệu hiệu suất"
          >
            <template #item.fullName="{ item }">
              <div class="font-weight-bold">{{ item.fullName }}</div>
              <div class="text-caption text-grey">{{ item.email }}</div>
            </template>
            <template #item.avgResponseTime="{ item }">
              <span v-if="item.avgResponseTime !== null" class="font-weight-bold" :class="responseTimeClass(item.avgResponseTime)">
                {{ formatResponseTime(item.avgResponseTime) }}
              </span>
              <span v-else class="text-grey">—</span>
            </template>
            <template #item.conversionRate="{ item }">
              <div class="d-flex align-center">
                <span class="font-weight-bold mr-2">{{ item.conversionRate }}%</span>
                <v-progress-linear :model-value="item.conversionRate" color="primary" height="6" rounded />
              </div>
            </template>
            <template #item.totalRevenue="{ item }">
              <span class="font-weight-bold text-success">{{ formatVND(item.totalRevenue) }}</span>
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { api } from '@/modules/zalocrm/api';
import { useRouter } from '@/modules/zalocrm/router-adapter';

// Date defaults: last 30 days
const today = new Date();
const prior = new Date(today);
prior.setDate(prior.getDate() - 30);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

const router = useRouter();
const dateRangePreset = ref<number | 'all' | 'custom'>(30);
const dateFrom = ref(fmt(prior));
const dateTo = ref(fmt(today));
const tab = ref('messages');
const loading = ref(false);
const exporting = ref(false);

function applyDatePreset(preset: number | 'all') {
  dateRangePreset.value = preset;
  const now = new Date();
  dateTo.value = fmt(now);
  if (preset === 'all') {
    dateFrom.value = '2025-01-01';
  } else {
    const p = new Date(now);
    p.setDate(p.getDate() - preset);
    dateFrom.value = fmt(p);
  }
  fetchReport();
}

const customerSearch = ref('');
const selectedAccountFilter = ref('');

const msgData = ref<{ date: string; sent: number; received: number }[]>([]);
const customerList = ref<Array<{
  conversationId: string;
  contactId: string | null;
  customerName: string;
  phone: string | null;
  avatarUrl: string | null;
  accountName: string;
  channel: string;
  status: string | null;
  firstMessageAt: string;
  totalMessages: number;
  firstMessageContent: string | null;
}>>([]);
const aptData = ref<{ label: string; count: number }[]>([]);
const kpiData = ref<any[]>([]);
const contactZaloSummaries = ref<{ zaloName: string; channel?: string; count: number }[]>([]);

const totalNewContacts = computed(() => {
  return contactZaloSummaries.value.reduce((sum, item) => sum + item.count, 0);
});

const accountFilterOptions = computed(() => {
  const options = [{ title: 'Tất cả thương hiệu', value: '' }];
  for (const item of contactZaloSummaries.value) {
    options.push({
      title: `${item.zaloName} (${item.count})`,
      value: item.zaloName,
    });
  }
  return options;
});

const filteredCustomers = computed(() => {
  let list = customerList.value;
  if (selectedAccountFilter.value) {
    list = list.filter(c => c.accountName === selectedAccountFilter.value);
  }
  if (customerSearch.value) {
    const q = customerSearch.value.toLowerCase().trim();
    list = list.filter(c =>
      (c.customerName && c.customerName.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.accountName && c.accountName.toLowerCase().includes(q)) ||
      (c.firstMessageContent && c.firstMessageContent.toLowerCase().includes(q))
    );
  }
  return list;
});

function toggleAccountFilter(name: string) {
  if (selectedAccountFilter.value === name) {
    selectedAccountFilter.value = '';
  } else {
    selectedAccountFilter.value = name;
  }
}

function goToConversation(conversationId: string) {
  if (!conversationId) return;
  router.push({ path: '/chat', query: { conversationId } });
}

function formatDateTime(val: string | Date | null | undefined): string {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

const msgHeaders = [
  { title: 'Ngày', key: 'date' },
  { title: 'Đã gửi', key: 'sent' },
  { title: 'Đã nhận', key: 'received' },
];

const contactHeaders = [
  { title: 'Khách hàng (User)', key: 'customerName', sortable: true },
  { title: 'Thương hiệu / Tài khoản', key: 'accountName', sortable: true },
  { title: 'Thời gian nhắn đầu tiên', key: 'firstMessageAt', sortable: true },
  { title: 'Tổng tin', key: 'totalMessages', sortable: true, align: 'center' as const },
  { title: 'Nội dung tin nhắn đầu', key: 'firstMessageContent', sortable: false },
  { title: 'Hành động', key: 'actions', sortable: false, align: 'center' as const },
];

const aptHeaders = [
  { title: 'Phân loại', key: 'label' },
  { title: 'Số lượng', key: 'count' },
];

const kpiHeaders = [
  { title: 'Nhân viên', key: 'fullName', sortable: true },
  { title: 'Số tin nhắn đã gửi', key: 'messagesSent', sortable: true, align: 'center' as const },
  { title: 'Thời gian phản hồi TB', key: 'avgResponseTime', sortable: true, align: 'center' as const },
  { title: 'Khách hàng đang chăm', key: 'totalContacts', sortable: true, align: 'center' as const },
  { title: 'Tỷ lệ chốt đơn', key: 'conversionRate', sortable: true },
  { title: 'Doanh số (VND)', key: 'totalRevenue', sortable: true, align: 'end' as const },
];

function formatVND(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatResponseTime(seconds: number) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function responseTimeClass(seconds: number) {
  if (seconds < 5 * 60) return 'text-success'; // Under 5 mins
  if (seconds < 15 * 60) return 'text-warning'; // Under 15 mins
  return 'text-error'; // 15 mins or more
}

const fastestStaff = computed(() => {
  const list = kpiData.value.filter(u => u.avgResponseTime !== null && u.messagesSent > 0);
  if (list.length === 0) return 'Chưa có';
  const fastest = list.reduce((a, b) => (a.avgResponseTime < b.avgResponseTime ? a : b));
  return `${fastest.fullName} (${formatResponseTime(fastest.avgResponseTime)})`;
});

const mostActiveStaff = computed(() => {
  const list = kpiData.value.filter(u => u.messagesSent > 0);
  if (list.length === 0) return 'Chưa có';
  const active = list.reduce((a, b) => (a.messagesSent > b.messagesSent ? a : b));
  return `${active.fullName} (${active.messagesSent} tin)`;
});

const topSalesStaff = computed(() => {
  const list = kpiData.value.filter(u => u.totalRevenue > 0);
  if (list.length === 0) return 'Chưa có';
  const top = list.reduce((a, b) => (a.totalRevenue > b.totalRevenue ? a : b));
  return `${top.fullName} (${formatVND(top.totalRevenue)})`;
});

async function fetchReport() {
  loading.value = true;
  try {
    const params = { from: dateFrom.value, to: dateTo.value };
    if (tab.value === 'messages') {
      const res = await api.get('/reports/messages', { params });
      msgData.value = res.data.data || res.data;
    } else if (tab.value === 'contacts') {
      const res = await api.get('/reports/contacts', { params });
      const raw = res.data;
      
      if (Array.isArray(raw.summaries)) {
        contactZaloSummaries.value = raw.summaries;
      } else {
        const days = Array.isArray(raw.newPerDay) ? raw.newPerDay : [];
        const sums: Record<string, { channel: string; count: number }> = {};
        for (const d of days) {
          const key = d.zaloName || 'Tạo thủ công';
          if (!sums[key]) sums[key] = { channel: 'zalo', count: 0 };
          sums[key].count += Number(d.count ?? 0);
        }
        contactZaloSummaries.value = Object.entries(sums).map(([zaloName, item]) => ({
          zaloName,
          channel: item.channel,
          count: item.count,
        }));
      }

      customerList.value = Array.isArray(raw.customers) ? raw.customers : [];
    } else if (tab.value === 'appointments') {
      const res = await api.get('/reports/appointments', { params });
      const raw = res.data;
      const rows: { label: string; count: number }[] = [];
      for (const s of (raw.byStatus ?? [])) {
        rows.push({ label: `Trạng thái: ${s.status}`, count: Number(s.count ?? 0) });
      }
      for (const t of (raw.byType ?? [])) {
        rows.push({ label: `Loại: ${t.type ?? '—'}`, count: Number(t.count ?? 0) });
      }
      aptData.value = rows;
    } else if (tab.value === 'kpi') {
      const res = await api.get('/reports/kpi', { params });
      kpiData.value = res.data.data || [];
    }
  } catch (err) {
    console.error('Report fetch error:', err);
  } finally {
    loading.value = false;
  }
}

async function exportExcel() {
  if (tab.value === 'kpi') {
    alert('Xuất Excel cho báo cáo Hiệu suất Nhân viên sẽ được bổ sung sau!');
    return;
  }
  exporting.value = true;
  try {
    const res = await api.get('/reports/export', {
      params: { type: tab.value, from: dateFrom.value, to: dateTo.value },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${tab.value}-${dateFrom.value}-${dateTo.value}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export error:', err);
  } finally {
    exporting.value = false;
  }
}

// Auto-fetch when tab changes
watch(tab, () => fetchReport());

// Initial load
fetchReport();
</script>

<style scoped>
.stat-card {
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
}
.stat-card-active {
  border-color: #004526 !important;
  background: #f0fdf4 !important;
  box-shadow: 0 0 0 2px rgba(0, 69, 38, 0.2) !important;
}
.stat-card-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a !important; /* Bold dark slate */
  line-height: 1.25;
  margin-bottom: 4px;
}
.stat-card-count {
  font-size: 1.35rem;
  font-weight: 800;
  color: #004526 !important; /* Deep forest green */
  line-height: 1.1;
}
.stat-card-unit {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569 !important;
  margin-left: 2px;
}
</style>
