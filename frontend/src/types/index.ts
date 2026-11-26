export type UserRole = 'admin' | 'sale' | 'accountant';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  roleLabel: string;
  department: string;
}

export type TimePeriod = 'today' | '7days' | 'month' | 'quarter' | 'year' | 'custom';

export interface KpiMetric {
  id: string;
  title: string;
  value: string;
  subValue?: string;
  changePercent: number;
  isPositive: boolean;
  icon: string;
  accentColor: string;
  chartColor: string;
  sparkline: number[];
  note?: string;
}

export interface RecentOrder {
  id: string;
  code: string;
  customerName: string;
  amount: number;
  status: 'new' | 'processing' | 'completed' | 'cancelled';
  statusLabel: string;
  createdAt: string;
  assignedTo: string;
}

export interface AccountingHandover {
  id: string;
  code: string;
  orderCode: string;
  customerName: string;
  businessType: string;
  amount: number;
  status: 'pending' | 'checking' | 'completed' | 'rejected';
  statusLabel: string;
  createdAt: string;
}

export interface AccountsReceivable {
  id: string;
  customerName: string;
  totalDebt: number;
  dueAmount: number;
  overdueAmount: number;
  status: 'normal' | 'due' | 'overdue';
  statusLabel: string;
}

export interface SystemAlert {
  id: string;
  title: string;
  count: number;
  description: string;
  type: 'danger' | 'warning' | 'info';
  route: string;
  icon: string;
}

export interface MenuItem {
  id: string;
  label: string;
  icon: any; // Lucide icon component
  route?: string;
  badge?: number | string;
  badgeColor?: string;
  children?: {
    id: string;
    label: string;
    route: string;
    badge?: number | string;
  }[];
  roles?: UserRole[];
}

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  time: string;
  isRead: boolean;
  type: 'order' | 'accounting' | 'zalo' | 'alert';
}
