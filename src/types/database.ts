export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'other';
export type OrderType = 'dine_in' | 'takeaway' | 'counter';
export type TerminalType = 'pos' | 'kitchen' | 'display' | 'admin' | 'waiter';
export type UserRoleType = 'super_admin' | 'admin' | 'kitchen' | 'waiter' | 'pos';

export interface UserRole {
  id: string;
  user_id: string;
  role: UserRoleType;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Terminal {
  id: string;
  branch_id: string;
  name: string;
  code: string;
  terminal_type: TerminalType;
  ip_address: string | null;
  is_active: boolean;
  created_at: string;
  branch?: Branch;
}

export interface UserBranch {
  id: string;
  user_id: string;
  branch_id: string;
  is_default: boolean;
  created_at: string;
  branch?: Branch;
}

export interface RestaurantTable {
  id: string;
  branch_id: string | null;
  table_number: number;
  qr_code_url: string | null;
  is_active: boolean;
  created_at: string;
  branch?: Branch;
}

export interface Category {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string | null;
  branch_id: string | null;
  terminal_id: string | null;
  table_id: string | null;
  total_amount: number;
  status: 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'paid';
  invoice_id: string | null;
  order_type: OrderType;
  customer_name: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  special_instructions: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: number;
  branch_id: string | null;
  terminal_id: string | null;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  issued_at: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  payment_method: PaymentMethod;
  amount: number;
  created_at: string;
}

export interface DayEnd {
  id: string;
  branch_id: string;
  terminal_id: string | null;
  opened_by?: string | null;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_other: number;
  total_tax: number;
  total_orders: number;
  total_invoices: number;
  actual_cash: number;
  cash_difference: number;
  notes: string | null;
  status: 'open' | 'closed';
  created_at: string;
  branch?: Branch;
  terminal?: Terminal;
  opened_by_user?: { email: string } | null;
  closed_by_user?: { email: string } | null;
}

// Joined types for convenience
export interface OrderWithItems extends Order {
  order_items: (OrderItem & { menu_item: MenuItem })[];
  restaurant_table: RestaurantTable;
  invoice: Invoice | null;
  branch?: Branch | null;
  terminal?: Terminal | null;
}

export interface InvoiceWithPayments extends Invoice {
  payments: InvoicePayment[];
  branch?: Branch | null;
  terminal?: Terminal | null;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

export interface SystemSettings {
  id: string;
  restaurant_name: string;
  tagline: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  logo_url: string | null;
  updated_at: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SidebarMenuItem {
  id: string;
  key: string;
  label: string;
  href: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface RoleMenuPermission {
  id: string;
  role: string;
  menu_item_id: string;
  created_at: string;
}
