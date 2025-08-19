// Point of Sale System Types - Complete POS Data Models
// Extends UPP with traditional retail/restaurant POS capabilities

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  cost?: number;
  tax_rate?: number;
  inventory_quantity: number;
  min_stock_level?: number;
  max_stock_level?: number;
  unit_of_measure: string;
  barcode?: string;
  image_url?: string;
  is_active: boolean;
  is_taxable: boolean;
  allow_decimal_quantity: boolean;
  variants?: ProductVariant[];
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price_adjustment: number;
  inventory_quantity: number;
  attributes: Record<string, string>;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Customer {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  address?: Address;
  loyalty_points?: number;
  total_spent: number;
  visit_count: number;
  last_visit?: Date;
  customer_type: 'walk_in' | 'regular' | 'vip';
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  zip_code?: string;
  country: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  product_name: string;
  product_sku: string;
}

export interface Sale {
  id: string;
  merchant_id: string;
  customer_id?: string;
  cashier_id?: string;
  transaction_id?: string;
  sale_number: string;
  items: SaleItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  change_amount: number;
  payment_method: PaymentMethod;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  sale_type: 'sale' | 'return' | 'exchange' | 'void';
  notes?: string;
  receipt_email?: string;
  receipt_phone?: string;
  receipt_printed: boolean;
  receipt_sent: boolean;
  device_id?: string;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethod {
  type: 'cash' | 'card' | 'mobile' | 'nfc' | 'qr' | 'digital_wallet' | 'store_credit' | 'gift_card';
  details?: {
    card_last_four?: string;
    card_brand?: string;
    approval_code?: string;
    terminal_id?: string;
    reference_number?: string;
  };
}

export interface Discount {
  id: string;
  name: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y';
  value: number;
  minimum_amount?: number;
  maximum_discount?: number;
  applicable_products?: string[];
  applicable_categories?: string[];
  start_date?: Date;
  end_date?: Date;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  type: 'percentage' | 'fixed_amount';
  applicable_categories?: string[];
  is_inclusive: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Merchant {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: Address;
  business_type: string;
  tax_id?: string;
  currency: string;
  timezone: string;
  business_hours?: BusinessHours;
  payment_methods_accepted: PaymentMethod['type'][];
  pos_settings: POSSettings;
  created_at: Date;
  updated_at: Date;
}

export interface BusinessHours {
  [key: string]: {
    open: string;
    close: string;
    is_open: boolean;
  };
}

export interface POSSettings {
  auto_print_receipt: boolean;
  ask_for_email_receipt: boolean;
  ask_for_phone_receipt: boolean;
  require_customer_signature: boolean;
  enable_tips: boolean;
  default_tip_percentages: number[];
  enable_loyalty_points: boolean;
  loyalty_points_rate: number;
  low_stock_threshold: number;
  enable_inventory_tracking: boolean;
  receipt_footer_text?: string;
  receipt_header_text?: string;
}

export interface Receipt {
  id: string;
  sale_id: string;
  type: 'sale' | 'return' | 'refund' | 'gift_receipt';
  format: 'thermal' | 'email' | 'sms';
  content: ReceiptContent;
  sent_to?: string;
  printed_at?: Date;
  emailed_at?: Date;
  sms_sent_at?: Date;
  created_at: Date;
}

export interface ReceiptContent {
  header: {
    business_name: string;
    address: Address;
    phone: string;
    tax_id?: string;
  };
  transaction: {
    sale_number: string;
    date: Date;
    cashier?: string;
    terminal?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    amount_paid: number;
    change: number;
  };
  footer?: string;
  barcode?: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  variant_id?: string;
  movement_type: 'sale' | 'return' | 'adjustment' | 'restock' | 'transfer' | 'waste';
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  cost_per_unit?: number;
  total_cost?: number;
  reason?: string;
  reference_id?: string;
  user_id?: string;
  location?: string;
  created_at: Date;
}

export interface POSSession {
  id: string;
  merchant_id: string;
  cashier_id?: string;
  device_id: string;
  session_number: string;
  opening_cash: number;
  closing_cash?: number;
  expected_cash?: number;
  cash_difference?: number;
  total_sales: number;
  total_refunds: number;
  transaction_count: number;
  started_at: Date;
  ended_at?: Date;
  status: 'open' | 'closed' | 'suspended';
  notes?: string;
}

export interface DailySummary {
  date: string;
  merchant_id: string;
  total_sales: number;
  total_refunds: number;
  net_sales: number;
  transaction_count: number;
  average_transaction: number;
  payment_methods: Record<PaymentMethod['type'], number>;
  top_products: Array<{
    product_id: string;
    name: string;
    quantity_sold: number;
    revenue: number;
  }>;
  hourly_sales: Array<{
    hour: number;
    sales: number;
    transactions: number;
  }>;
  tax_collected: number;
  discounts_given: number;
  created_at: Date;
}

// API Request/Response Types
export interface CreateSaleRequest {
  customer_id?: string;
  items: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
    unit_price?: number;
    discount_amount?: number;
  }>;
  payment_method: PaymentMethod;
  discount_amount?: number;
  notes?: string;
  receipt_email?: string;
  receipt_phone?: string;
}

export interface ProcessPaymentRequest {
  sale_id: string;
  amount: number;
  payment_method: PaymentMethod;
  device_id?: string;
  upp_payment_data?: {
    deviceType: string;
    capabilities: any;
    metadata?: Record<string, any>;
  };
}

export interface POSValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface StockAlert {
  id: string;
  product_id: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'overstock';
  current_quantity: number;
  threshold_quantity: number;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  is_resolved: boolean;
  created_at: Date;
  resolved_at?: Date;
}