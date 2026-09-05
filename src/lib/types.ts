export type ShopStatus = 'active' | 'suspended' | 'expired';
export type UserRole = 'superadmin' | 'owner' | 'staff';
export type VatMode = 'none' | 'inclusive' | 'exclusive';
export type OrderType = 'dine_in' | 'takeaway';
export type OrderStatus = 'pending' | 'confirmed' | 'cooking' | 'served' | 'completed' | 'cancelled';
export type OrderItemStatus = 'pending' | 'cooking' | 'served' | 'cancelled';
export type OrderSource = 'customer' | 'staff';
export type PaymentMethod = 'promptpay' | 'cash';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export interface Shop {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  promptpay_id: string | null;
  promptpay_name: string | null;
  plan: string;
  status: ShopStatus;
  is_active: boolean;
  expires_at: string | null;
  service_charge: number;
  vat_mode: VatMode;
  has_printer: boolean;
  device_mode: 'single_device' | 'multi_device';
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  shop_id: string | null;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  shop_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  options?: Option[];
}

export interface Option {
  id: string;
  menu_item_id: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
  created_at: string;
}

export interface OrderItemOptionSnapshot {
  id: string;
  name: string;
  price_delta: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  qty: number;
  options_json: OrderItemOptionSnapshot[];
  note: string | null;
  status: OrderItemStatus;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  ref: string | null;
  trans_ref: string | null;
  slip_url: string | null;
  verified_at: string | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  shop_id: string;
  table_id: string | null;
  order_no: string;
  type: OrderType;
  status: OrderStatus;
  source: OrderSource;
  subtotal: number;
  service_charge_amount: number;
  vat_amount: number;
  total: number;
  note: string | null;
  customer_phone: string | null;
  pickup_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  payments?: Payment[];
}

export interface CartItem {
  menu_item_id: string;
  name: string;
  base_price: number;
  qty: number;
  selected_options: Option[];
  note?: string;
  line_total: number;
}
