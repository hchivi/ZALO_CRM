import { createRouter, createWebHistory } from 'vue-router';
import { useGlobalLoading } from '@/modules/zalocrm/composables/use-global-loading';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'Login', component: () => import('@/views/LoginView.vue'), meta: { public: true, title: 'Đăng nhập CRM' } },
    { path: '/', redirect: '/cskh/chat' },
    {
      path: '/cskh',
      component: () => import('@/modules/zalocrm/layouts/ZaloWorkspace.vue'),
      meta: { workspace: 'zalo', roles: ['admin', 'sale', 'accountant'] },
      children: [
        { path: '', redirect: '/cskh/chat' },
        { path: "chat", name: "ZaloMessages", component: () => import('@/modules/zalocrm/views/ChatView.vue'), meta: { title: "Tin nhắn Zalo", group: "Khách hàng & CSKH", roles: ["admin", "sale", "accountant"] } },
        { path: "contacts", name: "ZaloLeads", component: () => import('@/modules/zalocrm/views/ContactsView.vue'), meta: { title: "Đầu mối Zalo", group: "Khách hàng & CSKH", roles: ["admin", "sale", "accountant"] } },
        { path: "contacts/:id", name: "ZaloContactDetail", component: () => import('@/modules/zalocrm/views/ContactDetailView.vue'), meta: { title: "Chi tiết đầu mối Zalo", group: "Khách hàng & CSKH", roles: ["admin", "sale", "accountant"] } },
        { path: "appointments", name: "Appointments", component: () => import('@/modules/zalocrm/views/AppointmentsView.vue'), meta: { title: "Lịch hẹn & Tiếp xúc", group: "Khách hàng & CSKH", roles: ["admin", "sale"] } },
        { path: "handovers", redirect: "/cskh/chat" },
        { path: "warehouse", name: "Warehouse", component: () => import('@/modules/zalocrm/views/WarehouseView.vue'), meta: { title: "Kho & Tư vấn", group: "Khách hàng & CSKH", roles: ["admin", "sale", "accountant"] } },
        { path: "media", redirect: to => ({ path: "/cskh/warehouse", query: { ...to.query, tab: 'media' } }) },
        { path: "orders", name: "ZaloOrders", component: () => import('@/modules/zalocrm/views/OrdersView.vue'), meta: { title: "Đơn từ hội thoại Zalo", group: "Kinh doanh & Đơn hàng", roles: ["admin", "sale", "accountant"] } },
        { path: "catalog", redirect: to => ({ path: "/cskh/warehouse", query: { ...to.query, tab: 'catalog' } }) },
        { path: "reports", name: "CskhReport", component: () => import('@/modules/zalocrm/views/ReportsView.vue'), meta: { title: "Báo cáo CSKH Zalo", group: "Báo cáo & Phân tích", roles: ["admin", "sale", "accountant"] } },
        { path: "dashboard", name: "ZaloOverview", component: () => import('@/modules/zalocrm/views/DashboardView.vue'), meta: { title: "Tổng quan hoạt động Zalo", group: "Báo cáo & Phân tích", roles: ["admin", "sale", "accountant"] } },
        { path: "zalo-accounts", name: "ZaloAccounts", component: () => import('@/modules/zalocrm/views/ZaloAccountsView.vue'), meta: { title: "Tài khoản Zalo & Phân quyền", group: "Quản trị hệ thống", roles: ["admin"] } },
        { path: "ai", name: "AiAssistant", component: () => import('@/modules/zalocrm/views/AiAssistantView.vue'), meta: { title: "Trợ lý AI & Cấu hình", group: "Quản trị hệ thống", roles: ["admin"] } },
        { path: "api-settings", name: "ApiWebhook", component: () => import('@/modules/zalocrm/views/ApiSettingsView.vue'), meta: { title: "API & Webhook", group: "Quản trị hệ thống", roles: ["admin"] } },
        { path: "attendance", redirect: "/cskh/chat" },
        { path: "needs", name: "CustomerNeedsWorkspace", component: () => import('@/views/accounting/CustomerNeedsView.vue'), meta: { title: "Nhu cầu từ Sales", group: "Tài chính & Kế toán", roles: ["admin", "accountant"] } },
        { path: "settings", redirect: "/cskh/chat" }
      ]
    },
    // Shortcuts and aliases to canonical Zalo CSKH modules
    { path: "/zalo", redirect: to => ({ path: "/cskh/chat", query: to.query }) },
    { path: "/dashboard", redirect: to => ({ path: "/cskh/dashboard", query: to.query }) },
    { path: "/reports", redirect: to => ({ path: "/cskh/reports", query: to.query }) },
    { path: "/leads", redirect: to => ({ path: "/cskh/contacts", query: to.query }) },
    { path: "/leads/:id", redirect: to => ({ path: '/cskh/contacts/' + to.params.id, query: to.query }) },
    { path: "/appointments", redirect: to => ({ path: "/cskh/appointments", query: to.query }) },
    { path: "/handovers", redirect: "/cskh/chat" },
    { path: '/tasks', name: 'Tasks', redirect: to => ({ path: '/cskh/chat', query: { ...to.query, mode: 'tasks' } }) },
    { path: '/tracked', name: 'Tracked', redirect: to => ({ path: '/cskh/chat', query: { ...to.query, mode: 'tracked' } }) },
    { path: "/warehouse", redirect: to => ({ path: "/cskh/warehouse", query: to.query }) },
    { path: "/gallery", redirect: to => ({ path: "/cskh/warehouse", query: { ...to.query, tab: 'media' } }) },
    { path: "/sales/zalo-orders", redirect: to => ({ path: "/cskh/orders", query: to.query }) },
    { path: "/sales/catalog", redirect: to => ({ path: "/cskh/warehouse", query: { ...to.query, tab: 'catalog' } }) },
    { path: "/reports/cskh", redirect: to => ({ path: "/cskh/reports", query: to.query }) },
    { path: "/reports/zalo-overview", redirect: to => ({ path: "/cskh/dashboard", query: to.query }) },
    { path: "/system/zalo-accounts", redirect: to => ({ path: "/cskh/zalo-accounts", query: to.query }) },
    { path: "/system/ai", redirect: to => ({ path: "/cskh/ai", query: to.query }) },
    { path: "/system/api", redirect: to => ({ path: "/cskh/api-settings", query: to.query }) },
    { path: "/system/attendance", redirect: "/cskh/chat" },
    { path: "/system/zalo-settings", redirect: "/cskh/chat" },
    { path: "/attendance", redirect: "/cskh/chat" },
    { path: "/settings", redirect: "/cskh/chat" },

    // Kế toán & Duyệt cọc nhu cầu từ Sales
    { path: "/needs", redirect: to => ({ path: "/cskh/needs", query: to.query }) },
    { path: "/accounting/needs", redirect: to => ({ path: "/cskh/needs", query: to.query }) },
    { path: "/crm/accounting/needs", redirect: to => ({ path: "/cskh/needs", query: to.query }) },
    { path: "/customer-needs", redirect: to => ({ path: "/cskh/needs", query: to.query }) },

    // Fallback everything else to /cskh/chat
    { path: '/:pathMatch(.*)*', redirect: '/cskh/chat' }
  ]
});

const { showLoading, hideLoading } = useGlobalLoading();

router.beforeEach(to => {
  showLoading('Đang tải dữ liệu...', 'Vui lòng chờ trong giây lát', 100);
  const token = localStorage.getItem('crm:token');
  if (!to.meta.public && !token) {
    return '/login';
  }
  if (to.path === '/login' && token) {
    return '/cskh/chat';
  }
});

router.afterEach(() => {
  hideLoading(150);
});

export default router;
