// src/database/schema.ts
// SmartPOS - Database Schema
// Based on SRS Section 6 - Data Model

export const CREATE_CATEGORIES_TABLE = `
  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(name, parent_id)
  );
`;
// parent_id NULL = root category. Max 2 levels of nesting enforced by app logic.

export const CREATE_PRODUCTS_TABLE = `
  CREATE TABLE IF NOT EXISTS products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id    INTEGER NOT NULL REFERENCES categories(id),
    name           TEXT NOT NULL,
    barcode        TEXT UNIQUE,
    price          REAL NOT NULL CHECK(price >= 0),
    discount_price REAL CHECK(discount_price >= 0),
    description    TEXT,
    stock_qty      INTEGER DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

export const CREATE_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    total_amount             REAL NOT NULL,
    discount_amount          REAL NOT NULL DEFAULT 0,
    grand_total              REAL NOT NULL,
    amount_tendered          REAL NOT NULL,
    change_due               REAL NOT NULL,
    primary_currency_code    TEXT NOT NULL,
    secondary_currency_code  TEXT,
    exchange_rate_snapshot   REAL,
    note                     TEXT,
    created_at               TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;
// exchange_rate_snapshot: 1 primary = N secondary at sale time (FR-CUR-05)

export const CREATE_TRANSACTION_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS transaction_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    product_id     INTEGER NOT NULL REFERENCES products(id),
    product_name   TEXT NOT NULL,
    unit_price     REAL NOT NULL,
    discount_price REAL,
    quantity       INTEGER NOT NULL CHECK(quantity > 0),
    line_total     REAL NOT NULL
  );
`;
// product_name & prices are snapshotted at sale time for historical accuracy (SRS Section 6 note)
// Secondary currency equivalent = line_total * transactions.exchange_rate_snapshot

export const CREATE_PURCHASE_ORDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number     TEXT NOT NULL UNIQUE,
    supplier_note TEXT,
    total_cost    REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;
// po_number format: 'PO-000042' (FR-PO-04)

export const CREATE_PURCHASE_ORDER_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    product_id        INTEGER NOT NULL REFERENCES products(id),
    product_name      TEXT NOT NULL,
    quantity          INTEGER NOT NULL CHECK(quantity > 0),
    purchase_price    REAL NOT NULL CHECK(purchase_price >= 0),
    line_cost         REAL NOT NULL
  );
`;
// After insert: UPDATE products SET stock_qty = stock_qty + quantity WHERE id = product_id (FR-PO-03)

export const CREATE_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`;
/*
  Settings keys (from SRS Section 6.7):
  - primary_currency_code      e.g. 'USD'
  - primary_currency_symbol    e.g. '$'
  - secondary_currency_code    e.g. 'IQD'
  - secondary_currency_symbol  e.g. 'IQD'
  - exchange_rate              e.g. '3660'
  - exchange_rate_updated_at   ISO-8601 timestamp
  - store_name
  - admin_pin_hash
  - receipt_footer
  - receipt_show_qr
*/

// All table creation statements in order (respecting foreign key dependencies)
export const ALL_TABLES = [
  CREATE_CATEGORIES_TABLE,
  CREATE_PRODUCTS_TABLE,
  CREATE_TRANSACTIONS_TABLE,
  CREATE_TRANSACTION_ITEMS_TABLE,
  CREATE_PURCHASE_ORDERS_TABLE,
  CREATE_PURCHASE_ORDER_ITEMS_TABLE,
  CREATE_SETTINGS_TABLE,
];