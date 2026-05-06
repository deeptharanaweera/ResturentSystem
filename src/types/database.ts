export interface RestaurantTable {
  id: string;
  table_number: number;
  qr_code_url: string | null;
  is_active: boolean;
  created_at: string;
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
  table_id: string;
  total_amount: number;
  status: 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'paid';
  invoice_id: string | null;
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
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  issued_at: string;
}

// Joined types for convenience
export interface OrderWithItems extends Order {
  order_items: (OrderItem & { menu_item: MenuItem })[];
  restaurant_table: RestaurantTable;
  invoice: Invoice | null;
}

export interface MenuItemWithCategory extends MenuItem {
  category: Category;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions: string;
}

export type UserRoleType = 'admin' | 'kitchen' | 'waiter';

export interface UserRole {
  id: string;
  user_id: string;
  role: UserRoleType;
  created_at: string;
}
