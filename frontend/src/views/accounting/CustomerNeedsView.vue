<template>
  <section class="needs-page">
    <header class="needs-heading">
      <div>
        <p class="eyebrow">TÀI CHÍNH & KẾ TOÁN / TIẾP NHẬN TỪ ZALO CRM</p>
        <h2>Nhu cầu từ Sales</h2>
        <p>Tiếp nhận đơn đã chốt, đối soát tiền cọc và theo dõi yêu cầu của khách hàng.</p>
      </div>
      <div class="header-actions">
        <router-link to="/cskh/chat" class="btn-forest-secondary"><MessageSquare :size="16" /> Chat Zalo</router-link>
        <a href="/dashboard" class="btn-forest-secondary"><ArrowLeft :size="16" /> Về Portal</a>
        <button class="btn-forest-secondary" :disabled="loading" @click="refresh"><RefreshCw :size="16" /> Làm mới</button>
      </div>
    </header>

    <div class="summary-grid">
      <button v-for="card in summaryCards" :key="card.value" class="forest-card summary-card" :class="{ chosen: filters.status === card.value }" @click="filterStatus(card.value)">
        <span class="metric-icon" :class="card.value"><component :is="card.icon" :size="20" /></span>
        <span><span class="metric-label">{{ card.label }}</span><strong>{{ counts[card.value] || 0 }}</strong></span>
      </button>
    </div>

    <div v-if="error" class="notice error" role="alert">{{ error }} <button @click="refresh">Thử lại</button></div>
    <div v-if="success" class="notice success" role="status">{{ success }}</div>

    <div class="forest-card inbox-card">
      <form class="filters" @submit.prevent="loadList(1)">
        <label class="search-field"><Search :size="17" /><input v-model="filters.q" placeholder="Tìm mã phiếu, khách hàng, số điện thoại, Sales…" aria-label="Tìm phiếu nhu cầu" maxlength="200" /></label>
        <select v-model="filters.status" aria-label="Lọc trạng thái" @change="loadList(1)">
          <option value="">Tất cả trạng thái</option>
          <option v-for="(label, value) in labels" :key="value" :value="value">{{ label }}</option>
        </select>
        <button type="submit" class="btn-forest-primary" :disabled="loading">Tìm kiếm</button>
      </form>
      <p v-if="loading" class="empty-state" role="status">Đang tải phiếu nhu cầu…</p>
      <div v-else-if="!rows.length" class="empty-state">
        <Inbox :size="38" /><h3>{{ filters.q || filters.status ? 'Không có phiếu phù hợp' : 'Chưa có phiếu nhu cầu' }}</h3>
        <p>{{ filters.q || filters.status ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Phiếu Sales gửi từ Zalo CRM sẽ xuất hiện tại đây.' }}</p>
      </div>
      <div v-else class="table-scroll">
        <table>
          <thead><tr><th>Phiếu / Ngày gửi</th><th>Khách hàng</th><th>Sales / Thương hiệu</th><th class="align-right">Giá trị đơn / Đã cọc</th><th>Ngày giao</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td><button class="text-link code" @click="openNeed(row.id)">{{ row.code }}</button><small>{{ timestamp(row.created_at) }}</small><span v-if="row.priority === 'urgent'" class="urgent-tag">Cần xử lý gấp</span></td>
              <td><strong>{{ row.customer_name }}</strong><small>{{ row.phone }}</small></td>
              <td>{{ row.sales_name || 'Sales' }}<small>{{ row.brand?.name }}</small></td>
              <td class="align-right"><strong>{{ money(row.total_amount) }}</strong><small :class="row.deposit_status === 'confirmed' ? 'confirmed-text' : 'unverified-text'">Cọc {{ money(row.deposit_amount) }} · {{ row.deposit_status === 'confirmed' ? 'Đã xác nhận' : 'Chưa đối soát' }}</small></td>
              <td>{{ dateOnly(row.delivery_date) }}</td>
              <td><span class="status-tag" :class="row.status">{{ labels[row.status] || row.status }}</span><small v-if="row.accepted_by">{{ row.accepted_by.name }}</small></td>
              <td>
                <div class="row-actions">
                  <a v-if="row.order_id" :href="`/orders/${row.order_id}/edit`" target="_blank" class="text-link order-link" title="Xem đơn hàng">
                    <ShoppingCart :size="13" /> {{ row.order_code || ('Đơn #' + row.order_id) }}
                  </a>
                  <a v-else :href="`/orders/create?need_id=${row.id}`" target="_blank" class="text-link convert-link" title="Tạo đơn hàng từ phiếu này">
                    <ShoppingCart :size="13" /> + Tạo đơn
                  </a>
                  <button class="text-link" @click="openNeed(row.id)" :aria-label="`Xem phiếu ${row.code}`">Xem phiếu <ArrowUpRight :size="14" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="pagination"><span>{{ total }} phiếu · Trang {{ page }} / {{ lastPage }}</span><div><button class="btn-forest-secondary" :disabled="loading || page <= 1" @click="loadList(page - 1)">Trước</button><button class="btn-forest-secondary" :disabled="loading || page >= lastPage" @click="loadList(page + 1)">Sau</button></div></footer>
    </div>

    <v-dialog v-model="detailOpen" :fullscreen="mobile" :max-width="mobile ? undefined : 1240" scrollable :persistent="saving">
      <v-card class="detail-card" :class="{ 'rounded-0': mobile }">
        <v-card-title class="detail-heading"><div><p class="eyebrow">PHIẾU NHU CẦU TỪ SALES <span v-if="detail">· {{ detail.code }}</span></p><h3>{{ detail?.customer_name || 'Đang tải phiếu…' }}</h3></div><button class="icon-button" aria-label="Đóng chi tiết" :disabled="saving" @click="closeDetail"><X :size="21" /></button></v-card-title>
        <v-card-text>
          <div v-if="detailError" class="notice error" role="alert">{{ detailError }}</div>
          <p v-if="detailLoading" class="empty-state">Đang tải nội dung phiếu…</p>
          <template v-else-if="detail">
            <div class="detail-banner"><span class="status-tag" :class="detail.status">{{ labels[detail.status] }}</span><span>{{ detail.brand?.name }} · Sales: <strong>{{ detail.sales_name }}</strong></span><span v-if="detail.priority === 'urgent'" class="urgent-tag">Cần xử lý gấp</span></div>
            <div class="detail-grid">
              <div class="detail-main">
                <section class="detail-section"><h4><span class="detail-step">01</span> Khách hàng & nhu cầu</h4><dl class="info-grid"><div><dt>Khách hàng</dt><dd>{{ detail.customer_name }}</dd></div><div><dt>Số điện thoại</dt><dd>{{ detail.phone }}</dd></div><div><dt>Ngày chốt đơn</dt><dd>{{ dateOnly(detail.closed_date) }}</dd></div><div><dt>Ngày khách đặt cọc</dt><dd>{{ dateOnly(detail.deposit_date) }}</dd></div></dl><p class="long-text requirement">{{ detail.payload.requirement }}</p></section>
                <section class="detail-section"><h4><span class="detail-step">02</span> Sản phẩm & mẫu mã</h4><div class="table-scroll"><table class="items-table"><thead><tr><th>Sản phẩm / Mẫu mã</th><th>SL / ĐVT</th><th class="align-right">Đơn giá</th><th class="align-right">Thành tiền</th></tr></thead><tbody><tr v-for="(item, index) in detail.payload.items" :key="index"><td><strong>{{ item.name }}</strong><small class="long-text">{{ item.specification || 'Chưa ghi mẫu mã' }}</small></td><td>{{ item.quantity }} {{ item.unit }}</td><td class="align-right">{{ money(item.unitPrice) }}</td><td class="align-right">{{ money(item.quantity * item.unitPrice) }}</td></tr></tbody></table></div>
                  <div v-if="referenceLinks.length" class="references"><strong>Tài liệu / mẫu duyệt</strong><template v-for="(link, index) in referenceLinks" :key="index"><a v-if="safeLink(link)" :href="safeLink(link)" target="_blank" rel="noopener noreferrer">{{ link }}</a><p v-else>{{ link }}</p></template></div>
                </section>
                <section class="detail-section"><h4><span class="detail-step">03</span> Giao hàng & ghi chú</h4><dl class="info-grid"><div><dt>Ngày giao dự kiến</dt><dd>{{ dateOnly(detail.delivery_date) }}</dd></div><div><dt>Người nhận / Điện thoại</dt><dd>{{ detail.payload.recipient || '—' }}</dd></div><div class="full-width"><dt>Địa chỉ giao hàng</dt><dd>{{ detail.payload.deliveryAddress || '—' }}</dd></div></dl><div class="note-grid"><div><h5>Ghi chú / cam kết với khách</h5><p class="long-text">{{ detail.payload.customerNote || 'Chưa có ghi chú' }}</p></div><div><h5>Sales gửi kế toán</h5><p class="long-text">{{ detail.payload.internalNote || 'Chưa có ghi chú' }}</p></div></div></section>
              </div>
              <aside class="detail-side">
                <section class="payment-box"><h4>Giá trị & thanh toán</h4><dl><div><dt>Tiền hàng</dt><dd>{{ money(detail.payload.subtotal) }}</dd></div><div v-if="detail.payload.vatRate != null"><dt>VAT ({{ detail.payload.vatRate }}%)</dt><dd>{{ money(detail.payload.vatAmount) }}</dd></div><div><dt>{{ detail.payload.vatRate != null ? 'Phí khác' : 'VAT / Phí thêm' }}</dt><dd>{{ money(detail.payload.extraCharges) }}</dd></div><div><dt>Giảm giá</dt><dd>{{ money(detail.payload.discount) }}</dd></div><div class="total-line"><dt>Tổng giá trị</dt><dd>{{ money(detail.total_amount) }}</dd></div><div><dt>Khách đã cọc</dt><dd>{{ money(detail.deposit_amount) }}</dd></div><div class="remaining-line"><dt>Còn lại dự kiến</dt><dd>{{ money(Number(detail.total_amount) - Number(detail.deposit_amount)) }}</dd></div></dl><p class="deposit-label" :class="detail.deposit_status === 'confirmed' ? 'confirmed-text' : 'unverified-text'">{{ detail.deposit_status === 'confirmed' ? 'Đã xác nhận thực nhận' : 'Sales khai báo · Chưa đối soát' }}</p><small v-if="detail.deposit_confirmed_at">{{ detail.deposit_confirmed_by?.name }} · {{ timestamp(detail.deposit_confirmed_at) }}</small></section>
                <section class="detail-section"><h4>Thông tin nhận cọc</h4><dl class="payment-info"><dt>Phương thức</dt><dd>{{ detail.payload.paymentMethod }}</dd><dt>Tài khoản / Người nhận</dt><dd>{{ detail.payload.receivingAccount || '—' }}</dd><dt>Mã / Nội dung giao dịch</dt><dd>{{ detail.payload.transactionReference || '—' }}</dd></dl></section>

              </aside>
                <form id="need-accounting-form" class="accounting-form" @submit.prevent="saveDetail"><h4><span class="detail-step">04</span> Kế toán xử lý</h4><div class="accounting-fields"><label>Trạng thái<select v-model="edit.status" :disabled="saving || detail.status === 'completed'"><option v-for="(label, value) in allowedStatuses" :key="value" :value="value">{{ label }}</option></select></label><label>Ghi chú xử lý<textarea v-model="edit.note" :disabled="saving" rows="2" maxlength="3000" placeholder="Kết quả đối soát, nội dung cần Sales bổ sung…"></textarea></label></div><label v-if="detail.deposit_status !== 'confirmed'" class="checkbox-label"><input v-model="edit.confirmDeposit" type="checkbox" :disabled="saving" /><span>Tôi đã đối soát và xác nhận nhận đủ {{ money(detail.deposit_amount) }} tiền cọc.</span></label><p v-if="detail.accepted_at" class="audit-line">Tiếp nhận: {{ detail.accepted_by?.name }}<br />{{ timestamp(detail.accepted_at) }}</p></form>
            </div>
          </template>
        </v-card-text>
        <v-card-actions v-if="detail && !detailLoading" class="detail-footer">
          <span class="detail-footer-status">
            <span class="status-tag" :class="detail.status">{{ labels[detail.status] }}</span>
            <span>{{ detail.deposit_status === 'confirmed' ? 'Tiền cọc đã được xác nhận' : 'Tiền cọc chưa đối soát' }}</span>
          </span>
          <div class="footer-action-group">
            <a v-if="detail.order_id" :href="`/orders/${detail.order_id}/edit`" target="_blank" class="btn-forest-order">
              <ShoppingCart :size="16" /> Xem Đơn {{ detail.order_code || ('#' + detail.order_id) }}
            </a>
            <a v-else :href="`/orders/create?need_id=${detail.id}`" target="_blank" class="btn-forest-convert">
              <ShoppingCart :size="16" /> Chuyển thành Đơn hàng
            </a>
            <button type="submit" form="need-accounting-form" class="btn-forest-primary" :disabled="saving">
              {{ saving ? 'Đang lưu…' : detail.status === 'pending' && edit.status === 'processing' ? 'Tiếp nhận & lưu xử lý' : 'Lưu xử lý' }}
            </button>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, Inbox, MessageSquare, MessageSquareWarning, RefreshCw, Search, ShoppingCart, X } from 'lucide-vue-next';

type Need = { id: number; code: string; status: string; deposit_status: string; customer_name: string; phone: string; sales_name: string; priority: string; brand?: { name: string }; total_amount: string; deposit_amount: string; closed_date: string; deposit_date: string; delivery_date: string | null; created_at: string; accepted_at: string | null; accepted_by?: { name: string }; deposit_confirmed_at?: string; deposit_confirmed_by?: { name: string }; accountant_note: string | null; version: number; payload: Record<string, any>; order_id?: number | null; order_code?: string | null };
const route = useRoute(), router = useRouter();
const { mobile } = useDisplay();
const labels: Record<string, string> = { pending: 'Chờ tiếp nhận', processing: 'Đang xử lý', needs_info: 'Cần bổ sung', completed: 'Hoàn thành' };
const summaryCards = [{ value: 'pending', label: 'Chờ tiếp nhận', icon: Inbox }, { value: 'processing', label: 'Đang xử lý', icon: Clock3 }, { value: 'needs_info', label: 'Cần bổ sung', icon: MessageSquareWarning }, { value: 'completed', label: 'Hoàn thành', icon: CheckCircle2 }];
const rows = ref<Need[]>([]), counts = ref<Record<string, number>>({});
const filters = ref({ q: '', status: '' }), page = ref(1), lastPage = ref(1), total = ref(0);
const loading = ref(false), error = ref(''), success = ref('');
const detailOpen = ref(false), detailLoading = ref(false), saving = ref(false), detailError = ref('');
const detail = ref<Need | null>(null), edit = ref({ status: 'processing', note: '', confirmDeposit: false });
let listRequest = 0, detailRequest = 0;
const allowedStatuses = computed(() => Object.fromEntries(Object.entries(labels).filter(([key]) => detail.value?.status === 'completed' ? key === 'completed' : detail.value?.status === 'pending' || key !== 'pending')));
const referenceLinks = computed<string[]>(() => String(detail.value?.payload.referenceLinks || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean));
const money = (n: unknown) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n || 0)) + ' đ';
const dateOnly = (value?: string | null) => value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
const timestamp = (value?: string | null) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : '—';
function safeLink(value: string) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; } }
async function request(path: string, options: RequestInit = {}) {
  const config = (window as any).APP_CONFIG;
  const response = await fetch(`/api/customer-needs${path}`, { ...options, credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': config?.csrfToken || '', ...options.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const validation = Object.values(data?.errors || {}).flat().join(' ');
    throw new Error(response.status === 401 ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại portal.' : response.status === 403 ? 'Tài khoản cần quyền kế toán hoặc quản trị viên để truy cập phiếu.' : validation || data?.message || 'Không kết nối được portal. Vui lòng thử lại.');
  }
  if (!data) throw new Error('Portal trả về dữ liệu không hợp lệ.');
  return data;
}
async function loadList(target = 1) {
  const serial = ++listRequest;
  loading.value = true; error.value = '';
  try {
    const params = new URLSearchParams({ page: String(target), q: filters.value.q, status: filters.value.status });
    const data = await request(`?${params}`);
    if (serial !== listRequest) return;
    rows.value = data.needs.data; counts.value = data.counts; page.value = data.needs.current_page; lastPage.value = data.needs.last_page; total.value = data.needs.total;
  } catch (e) { if (serial === listRequest) { error.value = (e as Error).message; rows.value = []; } }
  finally { if (serial === listRequest) loading.value = false; }
}
function filterStatus(value: string) { filters.value.status = filters.value.status === value ? '' : value; loadList(1); }
async function refresh() { await loadList(page.value); if (detailOpen.value && detail.value && !saving.value) await loadDetail(detail.value.id); }
async function openNeed(id: number) { await router.replace({ query: { ...route.query, need: id } }); }
async function loadDetail(id: number) {
  const serial = ++detailRequest;
  detail.value = null; detailError.value = ''; detailLoading.value = true; detailOpen.value = true;
  try { const data = await request(`/${id}`); if (serial !== detailRequest) return; applyDetail(data.need); }
  catch (e) { if (serial === detailRequest) detailError.value = (e as Error).message; }
  finally { if (serial === detailRequest) detailLoading.value = false; }
}
function applyDetail(need: Need) { detail.value = need; edit.value = { status: need.status === 'pending' ? 'processing' : need.status, note: need.accountant_note || '', confirmDeposit: false }; }
function closeDetail() { if (saving.value) return; detailOpen.value = false; }
watch(detailOpen, value => { if (!value) { ++detailRequest; const { need, ...query } = route.query; router.replace({ query }); } });
watch(() => route.query.need, value => { const id = Number(value); if (Number.isSafeInteger(id) && id > 0) loadDetail(id); else detailOpen.value = false; }, { immediate: true });
async function saveDetail() {
  if (!detail.value || saving.value) return;
  saving.value = true; detailError.value = ''; success.value = '';
  try {
    const data = await request(`/${detail.value.id}`, { method: 'PATCH', body: JSON.stringify({ version: detail.value.version, status: edit.value.status, accountant_note: edit.value.note, confirm_deposit: edit.value.confirmDeposit }) });
    applyDetail(data.need);
    success.value = data.message;
    await loadList(page.value);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm:needs-changed'));
    }
  } catch (e) { detailError.value = (e as Error).message; }
  finally { saving.value = false; }
}
onMounted(() => loadList());
</script>

<style scoped>
.needs-page{max-width:1600px;margin:0 auto}.needs-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}.eyebrow{font-size:10px;font-weight:700;letter-spacing:1.3px;color:var(--color-brand-secondary);margin-bottom:8px}.needs-heading h2{font-size:28px;letter-spacing:-.8px;margin-bottom:6px}.needs-heading>div>p:last-child{font-size:13px;color:var(--color-text-secondary)}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px}.summary-card{display:flex;text-align:left;align-items:center;gap:14px;padding:20px;cursor:pointer;color:inherit;font:inherit}.summary-card.chosen{border-color:var(--color-brand-secondary);box-shadow:0 0 0 1px var(--color-brand-secondary)}.metric-icon{padding:13px;display:flex;border-radius:12px;background:#f0f4f2;color:#126b49}.metric-icon.pending{background:#fff4dc;color:#b77708}.metric-icon.needs_info{background:#fff0e9;color:#c25f24}.metric-label{display:block;font-size:12px;color:var(--color-text-secondary)}.summary-card strong{display:block;font-size:26px;margin-top:4px}.filters{display:flex;gap:12px;padding:20px;border-bottom:1px solid var(--color-border)}.search-field{display:flex;align-items:center;gap:10px;flex:1;border:1px solid var(--color-border);padding:10px 12px;border-radius:8px;color:var(--color-text-secondary)}.search-field input{border:0;outline:0;width:100%;font:inherit;font-size:12px;background:transparent}select,textarea{border:1px solid var(--color-border);border-radius:8px;padding:10px;background:white;color:var(--color-text-primary);font:inherit;font-size:12px}button:disabled{opacity:.5;cursor:default;transform:none}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #126b49;outline-offset:3px}.table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}table{width:100%;border-collapse:collapse;font-size:12px}thead{background:#f7faf8}th{text-align:left;font-size:10px;letter-spacing:.3px;color:var(--color-text-secondary);font-weight:600;white-space:nowrap}td,th{padding:16px 18px;border-bottom:1px solid var(--color-border-subtle);vertical-align:top}tbody tr:hover{background:#fcfdfc}td strong{font-weight:600}td small{display:block;font-size:10px;margin-top:5px;color:var(--color-text-secondary)}.align-right{text-align:right}.text-link{display:inline-flex;align-items:center;gap:5px;color:#126b49;font:inherit;font-weight:600;cursor:pointer;background:transparent;border:0;white-space:nowrap}.code{font-size:12px;letter-spacing:.2px}.status-tag{display:inline-flex;white-space:nowrap;padding:5px 9px;border-radius:6px;font-size:10px;font-weight:600}.status-tag.pending{background:#fff4dc;color:#996911}.status-tag.processing{background:#eaf2ff;color:#3165a3}.status-tag.needs_info{background:#fff0e9;color:#b9541d}.status-tag.completed{background:#e4f4eb;color:#126b49}.urgent-tag{font-size:10px;color:#c24131;display:block;margin-top:5px}.confirmed-text{color:#126b49!important}.unverified-text{color:#a76c12!important}.empty-state{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--color-text-secondary);font-size:13px;padding:32px;text-align:center}.empty-state svg{color:#8fae9b}.empty-state h3{font-size:16px;color:var(--color-text-primary)}.pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;font-size:12px;color:var(--color-text-secondary)}.pagination>div{display:flex;gap:8px}.notice{padding:12px 16px;border-radius:9px;margin-bottom:16px;font-size:12px}.notice.error{background:#fff0ee;color:#b53c32}.notice.success{background:#e4f4eb;color:#126b49}.notice button{font:inherit;text-decoration:underline;margin-left:8px}.detail-card{border-radius:16px!important}.detail-heading{display:flex;align-items:center;justify-content:space-between;padding:20px 24px!important;border-bottom:1px solid var(--color-border)}.detail-heading h3{font-size:21px}.detail-heading .eyebrow{margin:0 0 5px}.icon-button{border:0;background:transparent;cursor:pointer;padding:6px;display:flex}.detail-banner{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12px;margin-bottom:22px}.detail-banner .urgent-tag{margin:0}.detail-grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(265px,1fr);gap:24px}.detail-section{margin-bottom:24px}.detail-section h4,.payment-box h4,.accounting-form h4{font-size:13px;font-weight:700;margin-bottom:16px;color:#174d39}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.info-grid dt,.payment-info dt{font-size:11px;color:var(--color-text-secondary);margin-bottom:4px}.info-grid dd,.payment-info dd{font-size:13px;margin:0;overflow-wrap:anywhere}.full-width{grid-column:1/-1}.long-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-size:12px}.requirement{margin-top:16px;padding:14px;background:#f3f7f4;border-radius:9px}.items-table td,.items-table th{padding:12px 8px}.note-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.note-grid>div{padding:12px;border:1px solid var(--color-border);border-radius:8px}.note-grid h5{font-size:11px;margin-bottom:8px;color:var(--color-text-secondary)}.references{font-size:11px;display:grid;gap:7px;margin-top:14px;overflow-wrap:anywhere}.references a{color:#126b49}.payment-box{background:#f0f6f2;border:1px solid #dbe9df;border-radius:12px;padding:18px;margin-bottom:22px}.payment-box dl>div{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px;font-size:12px}.payment-box dd{margin:0;font-weight:600;white-space:nowrap}.total-line{border-top:1px solid #d3e2d7;padding-top:13px;margin-top:13px}.remaining-line{color:#126b49}.deposit-label{font-size:11px;font-weight:600;margin-top:15px}.payment-box>small{font-size:10px;color:var(--color-text-secondary)}.payment-info dd{margin-bottom:12px}.accounting-form{border-top:1px solid var(--color-border);padding-top:20px}.accounting-form>label{display:grid;gap:7px;margin-bottom:14px;font-size:11px;font-weight:600}.accounting-form textarea{resize:vertical;width:100%}.accounting-form .checkbox-label{display:flex;align-items:flex-start;font-weight:400;font-size:12px;line-height:1.6;gap:9px}.checkbox-label input{margin-top:4px;accent-color:#126b49}.accounting-form>button{width:100%;margin-top:6px}.audit-line{font-size:10px;color:var(--color-text-secondary);margin-bottom:12px}@media(max-width:1100px){.summary-grid{gap:10px}.summary-card{padding:14px;gap:10px}.metric-icon{padding:9px}}@media(max-width:760px){.needs-heading{flex-direction:column;align-items:stretch;gap:14px}.header-actions{display:flex;flex-wrap:wrap;gap:8px}.needs-heading h2{font-size:23px}.summary-grid{grid-template-columns:1fr 1fr}.filters{flex-wrap:wrap;padding:14px}.search-field{flex-basis:100%}.filters select{flex:1;min-width:0}.detail-grid{grid-template-columns:1fr}.detail-side{border-top:1px solid var(--color-border);padding-top:20px}.note-grid{grid-template-columns:1fr}.pagination{padding:14px;flex-wrap:wrap}.info-grid{gap:12px}}@media(max-width:480px){.summary-grid{grid-template-columns:1fr}.summary-card{padding:12px}}

/* Detail reading surface: clear hierarchy, larger type and a persistent save action. */
.detail-card { --detail-ink: var(--color-text-primary, #243b31); --detail-muted: var(--color-text-secondary, #63776b); --detail-line: var(--color-border, #dfe8e2); color: var(--detail-ink); }
.detail-card > .v-card-text { padding: 22px 26px !important; background: #f7f9f7; }
.detail-heading { padding: 22px 26px !important; gap: 14px; align-items: flex-start; white-space: normal; }
.detail-heading h3 { font-size: 25px; line-height: 1.35; font-weight: 700; overflow-wrap: anywhere; }
.detail-heading .eyebrow { font-size: 12px; line-height: 1.5; letter-spacing: .8px; margin-bottom: 6px; }
.detail-heading .eyebrow span { letter-spacing: 0; }
.detail-heading .icon-button { min-width: 38px; min-height: 38px; align-items: center; justify-content: center; border-radius: 9px; }
.detail-heading .icon-button:hover { background: #eff4f0; }
.detail-banner { margin-bottom: 18px; font-size: 15px; gap: 12px; line-height: 1.5; }
.detail-card .status-tag { font-size: 13px; padding: 6px 11px; }
.detail-card .urgent-tag { font-size: 13px; }
.detail-grid { grid-template-columns: minmax(0, 1.6fr) minmax(310px, 1fr); gap: 18px; align-items: start; }
.detail-main, .detail-side { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.detail-section, .payment-box, .accounting-form { margin: 0; padding: 20px; background: #fff; border: 1px solid var(--detail-line); border-radius: 12px; }
.detail-section h4, .payment-box h4, .accounting-form h4 { display: flex; gap: 9px; align-items: center; margin: 0 0 18px; font-size: 16px; line-height: 1.4; font-weight: 700; }
.detail-step { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 28px; height: 28px; background: #edf4ef; color: #246247; border-radius: 8px; font-size: 12px; font-weight: 700; }
.info-grid { gap: 16px 22px; }
.info-grid dt, .payment-info dt { font-size: 14px; line-height: 1.5; margin-bottom: 5px; color: var(--detail-muted); }
.info-grid dd, .payment-info dd { font-size: 16px; line-height: 1.5; font-weight: 500; }
.detail-card .long-text { font-size: 16px; line-height: 1.65; }
.requirement { padding: 13px 15px; margin: 16px 0 0; border-left: 3px solid #6f9e83; background: #f1f6f2; border-radius: 0 8px 8px 0; }
.detail-card .items-table { font-size: 15px; }
.items-table th { font-size: 13px; letter-spacing: 0; white-space: normal; line-height: 1.5; }
.items-table td, .items-table th { padding: 12px 10px; }
.items-table td:first-child { min-width: 155px; }
.items-table td.align-right { white-space: nowrap; font-variant-numeric: tabular-nums; }
.detail-card .items-table td small { font-size: 14px; line-height: 1.5; margin-top: 6px; }
.note-grid { gap: 10px; margin-top: 18px; }
.note-grid > div { padding: 14px; background: #f8faf8; border: 0; border-radius: 8px; }
.note-grid h5 { font-size: 14px; line-height: 1.5; margin-bottom: 6px; font-weight: 600; }
.note-grid p { margin: 0; }
.references { font-size: 14px; line-height: 1.6; gap: 8px; }
.payment-box { background: #edf5ef; border-color: #d7e7dc; }
.payment-box dl > div { font-size: 15px; line-height: 1.5; margin-bottom: 12px; align-items: baseline; }
.payment-box dd { text-align: right; font-variant-numeric: tabular-nums; }
.payment-box .total-line { padding-top: 15px; margin-top: 15px; border-color: #cddfd2; }
.payment-box .total-line dd { font-size: 22px; font-weight: 750; }
.payment-box .remaining-line { padding-top: 10px; margin-top: 4px; border-top: 1px solid #cddfd2; }
.payment-box .remaining-line dd { font-size: 18px; }
.deposit-label { font-size: 13px; line-height: 1.6; margin: 16px 0 0; }
.payment-box > small { display: block; font-size: 13px; line-height: 1.5; margin-top: 6px; }
.payment-info dd { margin-bottom: 15px; }
.payment-info dd:last-child { margin-bottom: 0; }
.accounting-form { grid-column: 1 / -1; }
.accounting-fields { display: grid; grid-template-columns: minmax(220px, .65fr) minmax(0, 1.6fr); gap: 18px; align-items: start; }
.accounting-fields > label { display: grid; gap: 9px; font-size: 14px; font-weight: 600; line-height: 1.5; }
.accounting-form select, .accounting-form textarea { font-size: 16px; line-height: 1.5; padding: 11px 12px; border: 1px solid var(--detail-line); border-radius: 8px; background: #fff; }
.accounting-form select { min-height: 47px; width: 100%; }
.accounting-form textarea { min-height: 82px; }
.accounting-form .checkbox-label { font-size: 15px; margin: 16px 0 0; padding: 12px 14px; background: #f4f7f4; border-radius: 8px; }
.accounting-form .checkbox-label input { width: 18px; height: 18px; flex-shrink: 0; }
.audit-line { font-size: 13px; line-height: 1.6; margin: 14px 0 0; }
.detail-footer { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 15px 26px !important; border-top: 1px solid var(--detail-line); background: #fff; flex-shrink: 0; }
.detail-footer-status { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 14px; color: var(--detail-muted); }
.detail-footer .btn-forest-primary { font-size: 15px; padding: 12px 20px; min-height: 44px; margin-left: 0; }
.detail-card .notice { font-size: 15px; line-height: 1.5; }
.row-actions { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; }
.convert-link { color: #047857 !important; font-weight: 700 !important; }
.convert-link:hover { text-decoration: underline; }
.order-link { color: #2563eb !important; font-weight: 700 !important; }
.order-link:hover { text-decoration: underline; }
.footer-action-group { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-wrap: wrap; }
.btn-forest-convert { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; border-radius: 9px; font-weight: 600; font-size: 14px; background: #047857; color: #fff !important; text-decoration: none; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.btn-forest-convert:hover { background: #065f46; color: #fff !important; }
.btn-forest-order { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; border-radius: 9px; font-weight: 600; font-size: 14px; background: #e0f2fe; color: #0369a1 !important; border: 1px solid #bae6fd; text-decoration: none; transition: background 0.15s ease; }
.btn-forest-order:hover { background: #bae6fd; color: #0284c7 !important; }
@media(max-width: 1000px) { .detail-grid { grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); } .detail-section, .payment-box, .accounting-form { padding: 16px; } .detail-card > .v-card-text { padding: 18px !important; } .info-grid { column-gap: 14px; } .payment-box .total-line dd { font-size: 20px; } }
@media(max-width: 800px) { .detail-grid { grid-template-columns: 1fr; } .detail-side { border: 0; padding: 0; } .accounting-fields { grid-template-columns: 1fr; } .detail-heading { padding: 14px 16px !important; } .detail-heading h3 { font-size: 20px; } .detail-footer { padding: 12px 16px !important; } .detail-footer-status { font-size: 13px; } .footer-action-group { width: 100%; justify-content: flex-end; margin-left: 0; } }
@media(max-width: 480px) { .detail-card > .v-card-text { padding: 12px !important; } .detail-banner { font-size: 14px; } .info-grid, .note-grid { grid-template-columns: 1fr; } .detail-section, .payment-box, .accounting-form { padding: 14px; } .detail-footer-status > span:last-child { display: none; } .detail-footer .btn-forest-primary, .btn-forest-convert, .btn-forest-order { font-size: 13px; padding: 10px 14px; } .detail-card .items-table { min-width: 520px; } }

</style>
