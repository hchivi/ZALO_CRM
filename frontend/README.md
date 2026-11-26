# CHUỖI CUNG ỨNG CRM — FOREST ADAPTIVE

Hệ thống giao diện quản trị doanh nghiệp cao cấp thế hệ mới dành cho Chuỗi Cung Ứng CRM, được thiết kế theo phong cách thị giác **Forest Adaptive**, xây dựng hoàn toàn bằng **Vue 3, TypeScript, Vite, Vuetify 3, Pinia, Vue Router và ApexCharts**.

---

## 🌲 Bảng Màu & Ngôn Ngữ Thiết Kế (Forest Adaptive)

- **Xanh thương hiệu chính (Primary):** `#004526`
- **Xanh hỗ trợ (Secondary):** `#126B49`
- **Xanh rừng đậm Sidebar:** `#003B2B`
- **Nền ứng dụng (App Background):** `#F5F8F6`
- **Nền card (Card Background):** `#FFFFFF`
- **Xanh rất nhạt (Accent Soft):** `#E2F0E7`
- **Viền (Borders):** `#E5EBE7`
- **Chữ chính:** `#132A23` | **Chữ phụ:** `#64756D`
- **Status Tokens:**
  - Thành công (Success): `#10B981` (Xanh lá)
  - Cảnh báo (Warning): `#F59E0B` (Vàng cam)
  - Nguy hiểm (Danger): `#EF4444` (Đỏ)
  - Thông tin (Info): `#3B82F6` (Xanh dương)
- **Bo góc chuẩn:** `12px – 16px` | **Đổ bóng:** Shadow rất nhẹ, tinh tế.

---

## 🏛️ Cấu Trúc App Shell & Phân Hệ Nghiệp Vụ

Sidebar được chia theo đúng luồng nghiệp vụ 6 nhóm chức năng:

1. **Tổng quan:**
   - `Dashboard`: Tự động nhận diện và chuyển đổi giao diện theo vai trò (Admin / Sale / Kế toán).
2. **Khách hàng & CSKH:**
   - Tin nhắn Zalo (`/crm/zalo`)
   - Khách hàng (`/crm/customers`)
   - Việc cần xử lý (`/crm/tasks`)
   - Lịch hẹn (`/crm/appointments`)
   - Kho hình ảnh (`/crm/gallery`)
3. **Kinh doanh & Đơn hàng:**
   - Báo giá (`/sales/quotes`)
   - Đơn hàng (`/sales/orders`)
   - Tiến độ sản xuất (`/sales/production`)
   - Theo dõi giao hàng (`/sales/delivery`)
4. **Tài chính & Kế toán:**
   - Bàn giao Kế toán (`/accounting/handover`)
   - Đối soát (`/accounting/reconciliation`)
   - Thu chi (`/accounting/transactions`)
   - Công nợ (`/accounting/debt`)
   - Chứng từ (`/accounting/documents`)
5. **Báo cáo & Phân tích:**
   - Báo cáo kinh doanh (`/reports/business`)
   - Báo cáo tài chính (`/reports/finance`)
   - Báo cáo CSKH (`/reports/cskh`)
   - Hiệu suất nhân viên (`/reports/employees`)
6. **Quản trị hệ thống:**
   - Nhân sự (`/system/users`)
   - Phân quyền (`/system/permissions`)
   - Tài khoản Zalo (`/system/zalo-accounts`)
   - AI Assistant (`/system/ai`)
   - API & Webhook (`/system/api`)
   - Cài đặt (`/system/settings`)

---

## 🎯 3 Màn Hình Dashboard Hoàn Chỉnh

### 1. Dashboard Admin (Tổng quan hệ thống)
- **Hàng 1:** 6 thẻ KPI Cards (Doanh thu, Lợi nhuận gộp, Công nợ phải thu, Tổng đơn hàng, Bàn giao Kế toán, Hội thoại CSKH) kèm biểu đồ mini Sparkline và % tăng trưởng.
- **Hàng 2:**
  - Biểu đồ kết hợp cột (Doanh thu) và đường (Lợi nhuận gộp) theo 12 tháng.
  - 2 biểu đồ Donut: Tình trạng đơn hàng và Tình trạng bàn giao Kế toán.
  - Thẻ Cảnh báo & Việc cần xử lý (6 nhóm cảnh báo với icon và badge số lượng).
- **Hàng 3:**
  - Kênh khách hàng (Zalo, Website, Giới thiệu, Ads, Khác).
  - Biểu đồ ngang Hiệu suất nhân viên Sales.
  - Biểu đồ Area hoạt động CSKH & Khách mới theo ngày.
- **Hàng 4:** 3 bảng nghiệp vụ sắc nét:
  - Đơn hàng gần đây
  - Bàn giao Kế toán chờ xử lý
  - Công nợ phải thu quá hạn/đến hạn

### 2. Dashboard Sale (Tổng quan công việc)
- 6 thẻ KPI cá nhân: Tin nhắn chưa phản hồi, Khách cần chăm sóc, Báo giá đang chờ, Đơn của tôi, Bàn giao Kế toán, Doanh số cá nhân.
- Khu vực: Việc cần làm hôm nay (checkbox tương tác), Tiến độ mục tiêu doanh số (77%), Danh sách chat Zalo cần phản hồi gấp, Báo giá đang theo sát.

### 3. Dashboard Kế toán (Tổng quan Kế toán)
- 6 thẻ KPI tài chính: Bàn giao chờ tiếp nhận, Hồ sơ đang đối soát, Chứng từ cần bổ sung, Công nợ phải thu, Khoản đến hạn tuần này, Hồ sơ đã hoàn tất.
- Bảng danh sách bàn giao chờ tiếp nhận (với nút Tiếp nhận / Yêu cầu bổ sung trực tiếp).
- Biểu đồ cột phân loại tuổi nợ (Chưa hạn, 1-30, 31-60, 61-90, >90 ngày).
- Kế hoạch công việc kế toán hôm nay & Cảnh báo đối soát rủi ro.

---

## ⚡ Tính Năng Tương Tác Nổi Bật

- **Thanh chuyển đổi vai trò (Role Switcher) trên Header:** Cho phép bạn bấm trực tiếp giữa **Admin**, **Sale**, và **Kế toán** để trải nghiệm ngay sự thay đổi của Sidebar (phân quyền hiển thị) và Dashboard tương ứng.
- **Thu gọn / Mở rộng Sidebar:** Bấm nút mũi tên dưới chân Sidebar để thu gọn từ 260px về 68px.
- **Nút "+ Tạo mới" màu xanh đậm `#004526`:** Menu thả xuống tạo nhanh Đơn hàng, Báo giá, Khách hàng, Phiếu thu/chi.
- **Hệ thống Mock Data Store (Pinia):** Dữ liệu mẫu phong phú, định dạng tiền tệ Việt Nam Đồng chuẩn xác.

---

## 🚀 Hướng Dẫn Khởi Chạy

```bash
cd "c:\PHANMEM\portal.chuoicungung.vn (NEW)\forest-crm"

# 1. Cài đặt thư viện (nếu chưa cài):
npm install

# 2. Khởi chạy máy chủ:
npm run dev
```

Truy cập trên trình duyệt tại: **[http://localhost:3000](http://localhost:3000)**
