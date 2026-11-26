<template>
  <v-dialog v-model="opened" :fullscreen="mobile" :max-width="mobile ? undefined : 1240" scrollable persistent>
    <v-card class="need-dialog" :class="{ 'need-dialog--fullscreen': mobile }">
      <v-card-title class="need-header">
        <div class="d-flex align-start" style="gap: 12px;">
          <div class="need-header-accent"></div>
          <div>
            <div class="need-eyebrow">SALES → KẾ TOÁN</div>
            <h2>Tạo nhu cầu khách hàng</h2>
            <div class="need-owner">
              <span class="font-weight-bold" style="color: #00875A;">{{ selectedBrandName }}</span>
              <span v-if="props.customerStatus" class="ml-2 font-weight-bold" style="color: #D97706;">· {{ props.customerStatus }}</span>
              <span class="need-owner-sub">· {{ salesName }}</span>
            </div>
          </div>
        </div>
        <div class="need-header-actions">
          <span :class="['need-status-pill', `need-status-pill--${status}`]">
            <span class="need-status-dot"></span>
            {{ statusLabel(status) }}
          </span>
          <v-btn icon="mdi-close" size="small" variant="text" class="need-close-btn" aria-label="Đóng form nhu cầu" :disabled="saving" @click="close" />
        </div>
      </v-card-title>
      <v-card-text class="need-body">
        <v-defaults-provider :defaults="{ VTextField: { density: 'compact', variant: 'outlined', hideDetails: 'auto', color: 'primary' }, VTextarea: { density: 'compact', variant: 'outlined', hideDetails: 'auto', color: 'primary', noResize: true }, VCombobox: { density: 'compact', variant: 'outlined', hideDetails: 'auto', color: 'primary', returnObject: false }, VSelect: { density: 'compact', variant: 'outlined', hideDetails: 'auto', color: 'primary' } }">
          <div v-if="history.length" class="need-history">
            <v-select :items="historyOptions" :model-value="form.id" :disabled="saving" label="Phiếu đã lưu của hội thoại" @update:model-value="loadExisting" />
            <button type="button" class="btn-portal-secondary need-history-new-btn" :disabled="saving" @click="startNewForm">
              <v-icon size="16" class="mr-1">mdi-plus</v-icon>
              Phiếu mới
            </button>
          </div>
          <v-form ref="formRef" :disabled="locked || saving" class="need-layout" @submit.prevent="save('send')">
            <div class="need-column">
              <section class="need-section">
                <div class="need-section-heading">
                  <span class="need-step">01</span>
                  <h3>Thông tin khách hàng & yêu cầu</h3>
                </div>
                <div class="need-fields">
                  <v-select
                    v-model="form.brandId"
                    :items="portalBrands"
                    item-title="name"
                    item-value="id"
                    label="Thương hiệu áp dụng *"
                    :rules="[required]"
                    class="need-wide"
                  >
                    <template #item="{ props: itemProps, item }">
                      <v-list-item v-bind="itemProps" :title="undefined">
                        <div class="d-flex align-center" style="gap: 8px;">
                          <span class="brand-select-dot"></span>
                          <span class="font-weight-medium">{{ item.title }}</span>
                        </div>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <div class="d-flex align-center" style="gap: 8px;">
                        <span class="brand-select-dot"></span>
                        <span class="font-weight-bold" style="color: #004526;">{{ item.title }}</span>
                      </div>
                    </template>
                  </v-select>
                  <v-select
                    v-model="form.customerType"
                    :items="[
                      { title: 'Cá nhân', value: '01' },
                      { title: 'Doanh nghiệp (Công ty)', value: '02' }
                    ]"
                    label="Loại khách hàng *"
                    :rules="[required]"
                  >
                    <template #item="{ props: itemProps, item }">
                      <v-list-item v-bind="itemProps" :title="undefined">
                        <div class="d-flex align-center" style="gap: 8px;">
                          <span :class="['cust-type-dot', item.value === '02' ? 'cust-type-dot--blue' : 'cust-type-dot--amber']"></span>
                          <span class="font-weight-medium">{{ item.title }}</span>
                        </div>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <div class="d-flex align-center" style="gap: 8px;">
                        <span :class="['cust-type-dot', item.value === '02' ? 'cust-type-dot--blue' : 'cust-type-dot--amber']"></span>
                        <span class="font-weight-medium">{{ item.title }}</span>
                      </div>
                    </template>
                  </v-select>
                  <v-text-field
                    v-model="form.customerName"
                    :label="form.customerType === '02' ? 'Tên Công ty / Đơn vị *' : 'Tên khách hàng (Zalo) *'"
                    :rules="[required]"
                  />
                  <v-text-field
                    v-if="form.customerType === '02'"
                    v-model="form.contactPerson"
                    label="Người liên hệ / Đại diện"
                    placeholder="Họ tên người trực tiếp làm việc"
                  />
                  <v-text-field
                    v-model="form.phone"
                    label="Số điện thoại (tùy chọn)"
                    type="tel"
                    placeholder="Nhập nếu khách cung cấp"
                  />
                  <v-text-field
                    v-model="form.customerEmail"
                    label="Email khách hàng (tùy chọn)"
                    type="email"
                    placeholder="email@example.com"
                  />
                  <v-text-field
                    v-model="form.closedDate"
                    type="date"
                    label="Ngày dự kiến chốt *"
                    :rules="[required]"
                  />
                  <v-select
                    v-model="form.priority"
                    :items="[{ title: 'Bình thường', value: 'normal' }, { title: 'Cần xử lý gấp', value: 'urgent' }]"
                    label="Mức ưu tiên"
                  />
                  <v-textarea
                    v-model="form.requirement"
                    class="need-wide"
                    rows="3"
                    label="Nhu cầu chi tiết *"
                    placeholder="Mô tả mục đích sử dụng, yêu cầu đặc biệt của khách…"
                    :rules="[required]"
                  />
                </div>
              </section>
            </div>
            <div class="need-column">
              <section class="need-section">
                <div class="need-section-heading">
                  <span class="need-step">02</span>
                  <h3>Sản phẩm yêu cầu</h3>
                  <span class="need-section-meta">{{ form.items.length }} sản phẩm · Chưa báo giá</span>
                </div>
                <div v-for="(item, index) in form.items" :key="index" class="need-item">
                  <div class="need-item-heading">
                    <div class="d-flex align-center" style="gap: 6px;">
                      <span class="need-item-badge">#{{ index + 1 }}</span>
                      <strong>Sản phẩm {{ index + 1 }}</strong>
                    </div>
                    <v-btn icon="mdi-delete-outline" variant="text" size="x-small" color="error" :disabled="locked || saving || form.items.length === 1" :aria-label="`Xóa sản phẩm ${index + 1}`" @click="form.items.splice(index, 1)" />
                  </div>
                  <div>
                    <v-combobox
                      v-model="item.name"
                      :items="portalProductNames"
                      label="Tên sản phẩm *"
                      placeholder="Chọn từ Portal hoặc gõ tên"
                      :rules="[required]"
                    />
                    <div class="d-flex flex-wrap gap-2 mt-2">
                      <v-text-field
                        v-model.number="item.quantity"
                        type="number"
                        min="1"
                        step="1"
                        label="Số lượng *"
                        style="flex: 0 1 140px; min-width: 110px;"
                        :rules="[positive]"
                      />
                      <v-combobox
                        v-model="item.unit"
                        :items="unitOptions"
                        label="Đơn vị tính"
                        :return-object="false"
                        style="flex: 1 1 180px; min-width: 160px;"
                        :rules="[unitLength]"
                        @blur="rememberUnit(item.unit)"
                      />
                    </div>
                  </div>
                </div>
                <button type="button" class="need-add-btn" :disabled="locked || saving || form.items.length >= 50" @click="form.items.push(blankItem())">
                  <v-icon size="16" class="mr-1">mdi-plus</v-icon>
                  Thêm sản phẩm
                </button>
                <v-textarea v-model="form.referenceLinks" rows="2" class="mt-3" label="Liên kết mẫu duyệt / bảng size / tài liệu" placeholder="Mỗi liên kết một dòng" />
              </section>
            </div>
          </v-form>
        </v-defaults-provider>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3 rounded-lg">{{ error }}</v-alert>
        <v-alert v-if="message" type="success" variant="tonal" density="compact" class="mt-3 rounded-lg">{{ message }}</v-alert>
      </v-card-text>
      <div class="need-footer">
        <div class="need-totals" aria-live="polite">
          <div class="need-total-col">
            <span class="need-total-label">Số mặt hàng</span>
            <strong class="need-total-val">{{ form.items.length }}</strong>
          </div>
          <div class="need-total-col">
            <span class="need-total-label">Tổng số lượng</span>
            <strong class="need-total-val">{{ totalQuantity }}</strong>
          </div>
          <div class="need-total-col need-total-col--hint">
            <span class="need-total-hint">Phiếu tiếp nhận nhu cầu (Chưa báo giá)</span>
          </div>
        </div>
        <v-card-actions class="need-actions">
          <span class="need-code">{{ code || 'Phiếu mới' }} · {{ statusLabel(status) }}</span>
          <button type="button" class="btn-portal-secondary" :disabled="saving || locked" @click="save('draft')">
            Lưu nháp
          </button>
          <a v-if="status === 'sent' && portalUrl" :href="portalUrl" target="_blank" rel="noopener noreferrer" class="btn-portal-secondary">
            Mở trên portal
          </a>
          <a v-if="code" :href="'/orders/create?need_id=' + code" target="_blank" rel="noopener noreferrer" class="btn-portal-order">
            <v-icon size="16" class="mr-1">mdi-cart-arrow-right</v-icon>
            Tạo đơn hàng
          </a>
          <button type="button" class="btn-portal-primary" :disabled="saving || status === 'sent'" @click="save('send')">
            <v-progress-circular v-if="saving" indeterminate size="16" width="2" class="mr-1.5" />
            <v-icon v-else size="16" class="mr-1.5">mdi-send-outline</v-icon>
            {{ status === 'sent' ? 'Đã gửi portal' : status === 'pending_delivery' ? 'Gửi lại nhu cầu' : 'Ghi nhận nhu cầu' }}
          </button>
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { api } from '@/modules/zalocrm/api';
import NeedMoneyField from './NeedMoneyField.vue';
import { useAuthStore } from '@/modules/zalocrm/stores/auth';
const { mobile } = useDisplay();
const opened = defineModel<boolean>({ default: false });
const props = defineProps<{
  conversationId: string;
  customerName?: string | null;
  phone?: string | null;
  customerEmail?: string | null;
  contactPerson?: string | null;
  customerType?: string | null;
  zalo?: string | null;
  deliveryAddress?: string | null;
  customerStatus?: string | null;
  conversation?: any;
  zaloAccount?: any;
}>();
const auth = useAuthStore();
const portalBrands = ref<Array<{ id: number; name: string }>>([
  { id: 1, name: 'AdamEva.vn' },
  { id: 2, name: 'ChuyenGiaDongPhuc.vn' },
  { id: 3, name: 'CGDP.vn' },
  { id: 4, name: 'Team KCN' },
  { id: 5, name: 'VINMERICA' },
  { id: 6, name: 'Robert Việt' },
]);

function detectBrandId(): number {
  const accName = (
    props.conversation?.zaloAccount?.displayName ||
    props.zaloAccount?.displayName ||
    ''
  ).toLowerCase().replace(/[\s\-_.]/g, '');

  if (accName.includes('cgdp') || accName.includes('cgd')) return 3;
  if (accName.includes('chuyengiadongphuc') || accName.includes('cgia')) return 2;
  if (accName.includes('adameva') || accName.includes('adam')) return 1;
  if (accName.includes('kcn') || accName.includes('teamkcn')) return 4;
  if (accName.includes('vinmerica')) return 5;
  if (accName.includes('robert')) return 6;

  const appConfig = (window as any).portalAppConfig;
  if (appConfig?.activeBrandId && appConfig.activeBrandId !== 'all') {
    return Number(appConfig.activeBrandId) || 1;
  }
  return 1;
}

async function loadPortalBrands() {
  try {
    const res = await fetch('/api/zalo-native/brands');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        portalBrands.value = data;
      }
    }
  } catch (e) {
    // Keep defaults
  }
}

const selectedBrandName = computed(() => {
  const found = portalBrands.value.find(b => b.id === form.value.brandId);
  return found ? found.name : (auth.user?.orgName || 'Doanh nghiệp');
});
const organizationName = computed(() => auth.user?.orgName || 'Doanh nghiệp hiện tại');
const salesName = computed(() => auth.user?.fullName || 'Sales');
const blankItem = () => ({ name: '', specification: '', quantity: 1, unit: 'Cái', unitPrice: 0 });
const today = () => new Date().toLocaleDateString('sv-SE');
const initial = () => ({
  id: crypto.randomUUID(),
  version: 0,
  brandId: detectBrandId(),
  customerType: props.customerType || '01',
  customerName: props.customerName || '',
  contactPerson: props.contactPerson || '',
  phone: props.phone || '',
  customerEmail: props.customerEmail || '',
  zalo: props.customerName || props.zalo || '',
  closedDate: today(),
  priority: 'normal',
  requirement: '',
  items: [blankItem()],
  referenceLinks: '',
  vatRate: props.customerType === '02' ? 8 : 0,
  extraCharges: 0,
  discount: 0,
  depositAmount: 0,
  depositDate: '',
  paymentMethod: '',
  receivingAccount: '',
  transactionReference: '',
  deliveryDate: '',
  recipient: '',
  deliveryAddress: props.deliveryAddress || '',
  customerNote: '',
  internalNote: ''
});
const form = ref(initial());
const totalQuantity = computed(() => form.value.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
const formRef = ref();
const saving = ref(false), error = ref(''), message = ref(''), code = ref(''), status = ref('draft');
const baseline = ref('');
const portalUrl = ref('');
const locked = computed(() => ['sent', 'pending_delivery'].includes(status.value));
const statusLabel = (value: string) => value === 'sent' ? 'Portal đã nhận phiếu' : value === 'draft' ? 'Bản nháp' : value === 'pending_delivery' ? 'Chờ gửi lại' : 'Chờ gửi portal';
const history = ref<any[]>([]);
const historyOptions = computed(() => history.value.map(n => ({ title: `${n.code} · ${statusLabel(n.status)}`, value: n.id })));
const roundMoney = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const subtotal = computed(() => roundMoney(form.value.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0)));
const vatAmount = computed(() => roundMoney(Math.max(0, subtotal.value - Number(form.value.discount || 0)) * Number(form.value.vatRate || 0) / 100));
const total = computed(() => roundMoney(subtotal.value - Number(form.value.discount || 0) + vatAmount.value + Number(form.value.extraCharges || 0)));
const currency = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value) || 0) + ' đ';
const unitOptions = computed(() => [...new Set(['Cái', 'Bộ', ...history.value.flatMap(n => (n.items || []).map((i: any) => i.unit)), ...form.value.items.map(i => i.unit), ...customUnits.value].filter(Boolean))]);
const customUnits = ref<string[]>([]);
const rememberUnit = (value: unknown) => { if (typeof value === 'string' && value.trim() && value.length <= 30 && !customUnits.value.includes(value.trim())) customUnits.value.push(value.trim()); };
const unitLength = (value: unknown) => String(value || '').length <= 30 || 'Đơn vị tối đa 30 ký tự';
const vatOptions = [{ title: '0%', value: 0 }, { title: '5%', value: 5 }, { title: '8%', value: 8 }, { title: '10%', value: 10 }];
const setVatRate = (value: unknown) => { const text = String(value ?? '').trim().replace(/%$/, '').trim().replace(',', '.'); form.value.vatRate = text !== '' && /^\d+(?:\.\d{1,2})?$/.test(text) ? Number(text) : NaN; };
const validVat = () => (Number.isFinite(form.value.vatRate) && form.value.vatRate >= 0 && form.value.vatRate <= 100) || 'Nhập VAT từ 0 đến 100%, tối đa 2 số lẻ';
const required = (v: unknown) => !!String(v ?? '').trim() || 'Bắt buộc';
const nonnegative = (v: unknown) => (v !== '' && v !== null && Number.isFinite(Number(v)) && Number(v) >= 0) || 'Nhập số tiền hợp lệ';
const positive = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0) || 'Giá trị phải lớn hơn 0';
function newForm() { form.value = initial(); code.value = ''; portalUrl.value = ''; status.value = 'draft'; error.value = ''; message.value = ''; formRef.value?.resetValidation(); baseline.value = JSON.stringify(form.value); }
function startNewForm() { if (!locked.value && JSON.stringify(form.value) !== baseline.value && !confirm('Tạo phiếu mới? Thông tin chưa lưu sẽ bị mất.')) return; newForm(); }
function applyNeed(need: any) { form.value = { ...initial(), ...JSON.parse(JSON.stringify(need)), brandId: need.brandId || need.brand_id || form.value.brandId || detectBrandId(), vatRate: need.vatRate ?? 0, customerType: need.customerType || '01', customerName: need.customerName || '', contactPerson: need.contactPerson || '', customerEmail: need.customerEmail || '', zalo: need.zalo || '' }; code.value = need.code; status.value = need.status; portalUrl.value = /^https?:\/\//.test(need.portalUrl || '') ? need.portalUrl : ''; baseline.value = JSON.stringify(form.value); }
function loadExisting(id: string) { const need = history.value.find(n => n.id === id); if (!need) return; applyNeed(need); message.value = ''; error.value = need.deliveryError || ''; formRef.value?.resetValidation(); }
const portalProducts = ref<any[]>([]);
const portalProductNames = computed(() => portalProducts.value.map(p => p.name));
async function loadPortalProducts() {
  try {
    const res = await fetch('/api/zalo-native/products');
    if (res.ok) {
      portalProducts.value = await res.json();
    }
  } catch (e) {
    console.warn('Failed to load portal products', e);
  }
}
async function refresh() {
  const res = await api.get(`/conversations/${props.conversationId}/customer-needs`);
  history.value = res.data.needs || [];
  loadPortalProducts();
}
watch(opened, async value => { if (value) { loadPortalBrands(); newForm(); loadPortalProducts(); try { await refresh(); if (history.value[0]) loadExisting(history.value[0].id); } catch { error.value = 'Không tải được phiếu đã lưu. Vui lòng đóng và thử lại.'; } } });
async function save(intent: 'draft' | 'send') {
  if (saving.value || status.value === 'sent') return;
  error.value = ''; message.value = '';
  if (intent === 'send' && !locked.value && !(await formRef.value?.validate())?.valid) { error.value = 'Vui lòng kiểm tra các mục bắt buộc trong form.'; return; }
  saving.value = true;
  try {
    const brandObj = portalBrands.value.find(b => b.id === form.value.brandId);
    const brandName = brandObj ? brandObj.name : '';
    const res = await api.post(`/conversations/${props.conversationId}/customer-needs`, {
      ...form.value,
      brandId: form.value.brandId,
      brandName,
      customerStatus: props.customerStatus,
      intent,
    });
    applyNeed(res.data.need);
    message.value = res.data.message;
    await refresh();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm:needs-changed'));
    }
  }
  catch (e: any) { if (e.response?.data?.need) applyNeed(e.response.data.need); error.value = e.response?.data?.error || 'Không lưu được phiếu. Vui lòng thử lại; dữ liệu đang nhập vẫn được giữ.'; }
  finally { saving.value = false; }
}
function close() { if (JSON.stringify(form.value) !== baseline.value && !confirm('Đóng form? Thông tin chưa lưu sẽ bị mất.')) return; opened.value = false; }
</script>
<style scoped>
.need-dialog {
  border-radius: 20px !important;
  border: 1px solid #E5EBE7 !important;
  box-shadow: 0 20px 45px -12px rgba(0, 59, 43, 0.15), 0 0 1px rgba(0, 0, 0, 0.05) !important;
  overflow: hidden;
  background: #FFFFFF !important;
}
.brand-select-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00875A;
  flex-shrink: 0;
}
.need-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 28px 18px !important;
  gap: 16px;
  border-bottom: 1px solid #E5EBE7;
  white-space: normal;
  flex-shrink: 0;
  background: #FFFFFF;
}
.need-header-accent {
  width: 4px;
  height: 38px;
  background: rgb(var(--v-theme-primary));
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}
.need-header h2 {
  margin: 3px 0 2px;
  font-size: 22px;
  line-height: 1.35;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  letter-spacing: -0.3px;
}
.need-eyebrow {
  font-size: 11px;
  letter-spacing: 1.2px;
  color: rgb(var(--v-theme-primary));
  font-weight: 800;
  text-transform: uppercase;
}
.need-owner {
  font-size: 13px;
  line-height: 1.4;
  font-weight: 600;
  color: #2C4A3E;
}
.need-owner-sub {
  font-weight: 400;
  color: #64756D;
}
.need-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.need-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
.need-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.need-status-pill--sent {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  border: 1px solid rgba(var(--v-theme-primary), 0.25);
}
.need-status-pill--sent .need-status-dot {
  background: rgb(var(--v-theme-primary));
}
.need-status-pill--draft {
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgba(var(--v-theme-on-surface), 0.65);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.need-status-pill--draft .need-status-dot {
  background: rgba(var(--v-theme-on-surface), 0.65);
}
.need-status-pill--pending_delivery {
  background: #FEF3C7;
  color: #92400E;
  border: 1px solid #FDE68A;
}
.need-status-pill--pending_delivery .need-status-dot {
  background: #F59E0B;
}
.need-close-btn {
  color: rgba(var(--v-theme-on-surface), 0.6) !important;
  border-radius: 8px !important;
}
.need-close-btn:hover {
  background: rgba(var(--v-theme-primary), 0.08) !important;
  color: rgb(var(--v-theme-primary)) !important;
}
.need-body {
  padding: 22px 28px !important;
  background: #F8FAF9;
}
.need-history {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #FFFFFF;
  border: 1px solid #E5EBE7;
  border-radius: 12px;
}
.need-history > .v-select {
  min-width: 0;
}
.need-history-new-btn {
  height: 40px;
  white-space: nowrap;
}
.need-layout {
  display: grid;
  grid-template-columns: 1.12fr 1fr;
  gap: 18px;
  align-items: start;
}
.need-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.need-section {
  border: 1px solid #E5EBE7;
  border-radius: 16px;
  padding: 20px;
  min-width: 0;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}
.need-section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.need-step {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.need-section-heading h3 {
  font-size: 15px;
  line-height: 1.4;
  font-weight: 700;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}
.need-section-meta {
  margin-left: auto;
  font-size: 12.5px;
  color: #64756D;
  font-weight: 500;
}
.need-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
  row-gap: 18px;
}
.need-wide {
  grid-column: 1 / -1;
}
.cust-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cust-type-dot--amber {
  background: #F59E0B;
}
.cust-type-dot--blue {
  background: #3B82F6;
}
.need-dialog :deep(.v-field) {
  border-radius: 10px !important;
  font-size: 14.5px;
  color: #132A23;
  background: #FFFFFF;
}
.need-dialog :deep(.v-field__outline) {
  --v-field-border-opacity: 1 !important;
  color: #E5EBE7 !important;
}
.need-dialog :deep(.v-field:hover:not(.v-field--focused) .v-field__outline) {
  color: #C5E1CF !important;
}
.need-dialog :deep(.v-field--focused .v-field__outline) {
  color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.12) !important;
}
.need-dialog :deep(.v-label) {
  font-size: 13.5px !important;
  color: #64756D !important;
  opacity: 1 !important;
}
.need-dialog :deep(.v-field--focused .v-label) {
  color: rgb(var(--v-theme-primary)) !important;
  font-weight: 600;
}
.need-dialog :deep(.v-field__input) {
  font-size: 14.5px;
  min-height: 44px;
  line-height: 1.5;
}
.need-dialog :deep(.v-textarea .v-field__input) {
  min-height: 76px;
  line-height: 1.5;
}
.need-dialog :deep(.v-field--disabled) {
  opacity: 1;
  background: #F5F8F6 !important;
}
.need-dialog :deep(.v-field--disabled input),
.need-dialog :deep(.v-field--disabled textarea) {
  color: #2C4A3E !important;
  -webkit-text-fill-color: #2C4A3E !important;
}
.need-item {
  background: #FAFCFB;
  border: 1px solid #EBF1ED;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.need-item-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.need-item-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
  padding: 1px 6px;
  border-radius: 4px;
}
.need-item-heading strong {
  font-size: 13.5px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}
.need-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 9px 16px;
  background: rgba(var(--v-theme-primary), 0.04);
  border: 1px dashed rgba(var(--v-theme-primary), 0.3);
  color: rgb(var(--v-theme-primary));
  border-radius: 10px;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.need-add-btn:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.1);
  border-color: rgb(var(--v-theme-primary));
}
.need-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.need-footer {
  flex-shrink: 0;
  border-top: 1px solid #E5EBE7;
  background: #FFFFFF;
}
.need-totals {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  padding: 14px 28px;
  background: #F5F8F6;
  border-bottom: 1px solid #E5EBE7;
}
.need-total-col {
  display: flex;
  flex-direction: column;
}
.need-total-col + .need-total-col {
  padding-left: 18px;
  border-left: 1px solid #E5EBE7;
}
.need-total-col--hint {
  justify-content: center;
}
.need-total-label {
  font-size: 11px;
  font-weight: 600;
  color: #64756D;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.need-total-val {
  margin-top: 2px;
  font-size: 22px;
  font-weight: 800;
  color: rgb(var(--v-theme-primary));
  font-variant-numeric: tabular-nums;
}
.need-total-hint {
  font-size: 12.5px;
  color: #64756D;
  font-weight: 500;
}
.need-actions {
  padding: 14px 28px !important;
  gap: 10px;
  min-height: 64px;
  flex-wrap: wrap;
  align-items: center;
}
.need-code {
  font-size: 13px;
  font-weight: 500;
  color: #64756D;
  margin-right: auto;
}
.btn-portal-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-primary));
  color: #FFFFFF;
  font-weight: 700;
  font-size: 13.5px;
  padding: 0 20px;
  height: 40px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 4px rgba(var(--v-theme-primary), 0.25);
}
.btn-portal-primary:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}
.btn-portal-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-portal-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  font-weight: 600;
  font-size: 13.5px;
  padding: 0 16px;
  height: 40px;
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}
.btn-portal-secondary:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}
.btn-portal-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-portal-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-secondary));
  color: #FFFFFF;
  font-weight: 600;
  font-size: 13.5px;
  padding: 0 16px;
  height: 40px;
  border-radius: 10px;
  border: none;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-portal-order:hover {
  opacity: 0.92;
}
@media(max-width: 900px) {
  .need-layout {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}
.need-dialog.need-dialog--fullscreen {
  border-radius: 0 !important;
  border: none !important;
}
@media(max-width: 600px) {
  .need-header {
    padding: 14px 16px !important;
    flex-wrap: wrap;
    gap: 10px;
  }
  .need-header h2 {
    font-size: 18px;
  }
  .need-header-actions {
    width: 100%;
    justify-content: space-between;
  }
  .need-body {
    padding: 14px !important;
  }
  .need-history {
    flex-direction: column;
    align-items: stretch;
    padding: 10px 12px;
    gap: 8px;
  }
  .need-section {
    padding: 14px;
  }
  .need-section-heading {
    flex-wrap: wrap;
    gap: 6px 10px;
    margin-bottom: 14px;
  }
  .need-fields {
    grid-template-columns: 1fr;
  }
  .need-totals {
    grid-template-columns: repeat(2, 1fr);
    padding: 10px 14px;
    gap: 8px 10px;
  }
  .need-total-col--hint {
    grid-column: 1 / -1;
    border-left: none !important;
    padding-left: 0 !important;
    padding-top: 6px;
    border-top: 1px solid #E5EBE7;
  }
  .need-totals strong {
    font-size: 16px;
  }
  .need-actions {
    padding: 10px 14px !important;
    gap: 8px;
  }
  .need-actions > button,
  .need-actions > a {
    flex: 1 1 auto;
  }
  .need-code {
    width: 100%;
  }
}
</style>
