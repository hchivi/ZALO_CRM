export interface ConversationCategory {
  title: string;
  icon: string;
  color: string;
  isRole?: boolean;
}

export const CONVERSATION_CATEGORIES: ConversationCategory[] = [
  // 3 Đối tượng chính (Khách hàng, Nhà cung cấp, Nội bộ công ty - Image 4)
  { title: 'Khách hàng', icon: 'mdi-account-check', color: '#16A34A', isRole: true },
  { title: 'Nhà cung cấp', icon: 'mdi-truck-delivery-outline', color: '#EA580C', isRole: true },
  { title: 'Nội bộ công ty', icon: 'mdi-domain', color: '#64748B', isRole: true },

  // Các nhãn phân loại theo tiến độ công việc
  { title: 'KH quan trọng', icon: 'mdi-star-outline', color: '#B18A48' },
  { title: 'Đang báo giá', icon: 'mdi-file-document-edit-outline', color: '#0284C7' },
  { title: 'Cần xử lý gấp', icon: 'mdi-alert-circle-outline', color: '#DC2626' },
  { title: 'Đã chốt đơn', icon: 'mdi-check-circle-outline', color: '#059669' },
  { title: 'Bảo hành/KT', icon: 'mdi-tools', color: '#7C3AED' },
];

export const CONVERSATION_CATEGORY_LABELS = CONVERSATION_CATEGORIES.map(item => item.title);

