export type ShopStatus = 'active' | 'suspended' | 'expired';
export type UserRole = 'superadmin' | 'owner' | 'staff';
export type VatMode = 'none' | 'inclusive' | 'exclusive';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'pending' | 'confirmed' | 'cooking' | 'served' | 'completed' | 'cancelled';
export type OrderItemStatus = 'pending' | 'cooking' | 'served' | 'cancelled';
export type OrderSource = 'customer' | 'staff';
export type PaymentMethod = 'promptpay' | 'cash';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export interface Shop {
  id: string;
  slug: string;
  name: string;
  logo?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  address?: string | null;
  promptpay_id: string | null;
  promptpay_name: string | null;
  plan: string;
  status: ShopStatus;
  is_active: boolean;
  is_open?: boolean;
  expires_at: string | null;
  plan_expires_at?: string | null;
  service_charge: number;
  vat_mode: VatMode;
  has_printer: boolean;
  device_mode: 'single_device' | 'multi_device';
  kds_pin: string;
  support_access_expires_at?: string | null;
  allow_dine_in?: boolean;
  allow_takeaway?: boolean;
  allow_delivery?: boolean;
  is_delivery_enabled?: boolean;
  telegram_enabled?: boolean;
  shop_lat?: number | null;
  shop_lng?: number | null;
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
  table_no?: string | null;
  order_no: string;
  type: OrderType;
  status: OrderStatus;
  source: OrderSource;
  subtotal: number;
  service_charge_amount: number;
  vat_amount: number;
  total: number;
  note: string | null;
  customer_name?: string | null;
  customer_phone: string | null;
  delivery_address?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  pickup_at: string | null;
  telegram_chat_id?: string | null;
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

export interface RegisterInput {
  shop_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password: string;
  origin: string;
}

export interface PlatformStats {
  totalStores: number;
  activeStores: number;
  suspendedStores: number;
  totalOrders: number;
  todayOrders: number;
}

// =============================================================================
// Delivery & Preorder Types
// =============================================================================

export interface DeliveryLocation {
  id: string;
  shop_id: string | null;
  name: string;
  zone_name: string;
  lat: number;
  lng: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export type DeliveryTripStatus = 'draft' | 'in_transit' | 'completed' | 'cancelled';
export type DeliveryItemStatus = 'pending' | 'delivered' | 'failed';

export interface DeliveryTrip {
  id: string;
  shop_id: string;
  trip_name: string;
  trip_date: string;
  cutoff_at: string | null;
  delivery_time_window: string | null;
  status: DeliveryTripStatus;
  created_at: string;
  updated_at: string;
  items_count?: number;
  delivered_count?: number;
}

export interface DeliveryTripItem {
  id: string;
  trip_id: string;
  location_id: string | null;
  recipient_name: string;
  recipient_phone: string;
  location_note: string | null;
  items_summary: string;
  order_reference_id: string | null;
  delivery_status: DeliveryItemStatus;
  delivered_at: string | null;
  created_at: string;
  location?: DeliveryLocation | null;
}

export type PreorderRoundStatus = 'open' | 'closed' | 'completed';

export interface PreorderRound {
  id: string;
  shop_id: string;
  title: string;
  cutoff_at: string;
  delivery_date: string;
  delivery_time_window: string | null;
  status: PreorderRoundStatus;
  created_at: string;
  updated_at: string;
  items_count?: number;
  total_revenue?: number;
}

export interface PreorderItem {
  id: string;
  round_id: string;
  location_id: string | null;
  recipient_name: string;
  recipient_phone: string;
  location_note: string | null;
  items_summary: string;
  total_amount: number;
  payment_method: 'promptpay' | 'cash';
  payment_status: 'pending' | 'verified';
  raw_input_text: string | null;
  created_at: string;
  location?: DeliveryLocation | null;
}

export interface ParsedCommentOrder {
  recipient_name: string;
  recipient_phone: string;
  location_id: string | null;
  location_name: string | null;
  location_note: string | null;
  items_summary: string;
  total_amount: number;
  raw_text: string;
}

// ==============================================================================
// 7. LEGAL & PDPA COMPLIANCE TYPES (WP-19 to WP-23)
// ==============================================================================

export type ConsentType = 'terms_and_privacy' | 'gps_location' | 'marketing';

export interface ConsentLog {
  id: string;
  shop_id?: string | null;
  order_id?: string | null;
  customer_phone?: string | null;
  consent_type: ConsentType;
  policy_version: string;
  ip_address?: string | null;
  user_agent?: string | null;
  accepted_at: string;
}

export interface AuditLog {
  id: string;
  shop_id?: string | null;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  created_at: string;
}

export type DataSubjectRequestType =
  | 'access'
  | 'copy'
  | 'correct'
  | 'delete'
  | 'suspend'
  | 'portability'
  | 'withdraw'
  | 'object';

export type DataSubjectRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface DataSubjectRequest {
  id: string;
  shop_id?: string | null;
  requester_name: string;
  requester_phone: string;
  requester_email?: string | null;
  request_type: DataSubjectRequestType;
  details?: string | null;
  status: DataSubjectRequestStatus;
  admin_notes?: string | null;
  due_date: string;
  completed_at?: string | null;
  created_at: string;
}

