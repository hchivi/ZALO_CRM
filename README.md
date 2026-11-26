# Zalo & WhatsApp Omnichannel CRM (Standalone)

Hệ thống **Zalo & WhatsApp CRM** chạy độc lập hoàn toàn (không phụ thuộc Portal), bao gồm đầy đủ:
* Chat đa kênh **Zalo cá nhân/nhóm** & **WhatsApp** theo thời gian thực (Socket.IO)
* Quản lý khách hàng (Contacts), Phân loại nhãn, Ghi chú, Lịch hẹn, Đơn hàng, Kho ảnh/tài liệu
* Báo cáo tin nhắn, khách hàng mới, hiệu suất nhân viên (KPI), Xuất Excel
* Hỗ trợ Trợ lý AI gợi ý trả lời & Thông báo Telegram Bot

---

## Cấu trúc thư mục
* `backend/` — Node.js + Fastify + TypeScript + Prisma (PostgreSQL) + Zalo (`zca-js`) + WhatsApp (`whatsapp-web.js`)
* `frontend/` — Vue 3 + Vuetify 3 + Vite

---

## Hướng dẫn cài đặt & chạy dự án

### 1. Yêu cầu hệ thống
* **Node.js** >= 20
* **PostgreSQL** >= 14

### 2. Cài đặt thư viện
Tại thư mục gốc `CRM/`:
```bash
npm run install:all
```

### 3. Cấu hình biến môi trường & Database
```bash
cp backend/.env.example backend/.env
```
Mở `backend/.env` và cập nhật:
* `DATABASE_URL`: chuỗi kết nối PostgreSQL của bạn (ví dụ `postgresql://postgres:password@127.0.0.1:5432/zalocrm`).
* `JWT_SECRET`: chuỗi ngẫu nhiên (`openssl rand -hex 32`).
* `ENCRYPTION_KEY`: chuỗi 32 ký tự hex (`openssl rand -hex 16`).

Tạo bảng database bằng Prisma:
```bash
npm run db:push
```

### 4. Chạy dự án
* **Chạy cả Backend (cổng `3081`) và Frontend (cổng `3000`):**
  ```bash
  npm run dev
  ```
* Mở trình duyệt truy cập thẳng vào: **`http://localhost:3000`**
* Ở lần chạy đầu tiên, hệ thống sẽ tự hiện màn hình **Thiết lập CRM lần đầu** để tạo Công ty và tài khoản Admin đầu tiên, sau đó vào thẳng giao diện Chat CRM.

### 5. Build cho môi trường Production
```bash
npm run build
```
* File build frontend nằm ở `frontend/dist/`.
* File build backend nằm ở `backend/dist/`, khởi chạy bằng `npm start` (hoặc `pm2 start backend/dist/app.js --name crm`).
