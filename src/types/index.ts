// src/types/index.ts
// SmartPOS - TypeScript Interfaces
// Based on SRS Section 6 - Data Model

// ─── Category ───────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

// Category with its children (unlimited nesting depth — FR-CAT-04, extended
// per client request to support categories like Chips -> Chips Medium -> Doritos)
export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
  item_count: number;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  category_id: number;
  name: string;
  barcode: string | null;
  price: number;
  discount_price: number | null;
  description: string | null;
  stock_qty: number;
  created_at: string;
  updated_at: string;
}

// Product with category name (for display in lists)
export interface ProductWithCategory extends Product {
  category_name: string;
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: number;
  total_amount: number;
  discount_amount: number;
  grand_total: number;
  amount_tendered: number;
  change_due: number;
  tendered_primary: number; // amount paid in primary currency
  tendered_secondary: number; // amount paid in secondary currency
  primary_currency_code: string;
  secondary_currency_code: string | null;
  exchange_rate_snapshot: number | null; // FR-CUR-05
  note: string | null;
  created_at: string;
}

// Transaction with its items (for receipt display — FR-PRT-02)
export interface TransactionWithItems extends Transaction {
  items: TransactionItem[];
}

// ─── Transaction Item ─────────────────────────────────────────────────────────

export interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number;
  product_name: string; // snapshot at sale time
  unit_price: number; // primary currency
  discount_price: number | null;
  quantity: number;
  line_total: number; // primary currency
}

// ─── Purchase Order ───────────────────────────────────────────────────────────

export interface PurchaseOrder {
  id: number;
  po_number: string; // e.g. 'PO-000042'
  supplier_note: string | null;
  total_cost: number;
  created_at: string;
}

// Purchase order with its items (for detail view — FR-PO-06)
export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[];
}

// ─── Purchase Order Item ──────────────────────────────────────────────────────

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  product_name: string; // snapshot at PO time
  quantity: number;
  purchase_price: number;
  line_cost: number; // quantity * purchase_price
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface Setting {
  key: string;
  value: string;
}

// Typed settings object (for easier use across the app)
export interface AppSettings {
  store_name: string;
  primary_currency_code: string;
  primary_currency_symbol: string;
  secondary_currency_code: string;
  secondary_currency_symbol: string;
  exchange_rate: number;
  exchange_rate_updated_at: string;
  receipt_footer: string;
  receipt_show_qr: boolean;
  admin_pin_hash: string;
  language: 'en' | 'ar';
}

// ─── Cart (in-memory only, not stored in DB) ──────────────────────────────────

export interface CartItem {
  product: Product;
  quantity: number;
  line_total: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount_amount: number;
  grand_total: number;
}

// ─── User Roles ───────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'cashier';
