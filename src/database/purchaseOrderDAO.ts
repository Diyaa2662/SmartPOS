// src/database/purchaseOrderDAO.ts
// SmartPOS - Purchase Order Data Access Object
// Based on SRS Section 3.7 (FR-PO)

import {getDatabase} from './database';
import {PurchaseOrder, PurchaseOrderItem, PurchaseOrderWithItems} from '../types';
import {incrementStock} from './productDAO';

// ─── Generate next PO number (FR-PO-04) ──────────────────────────────────────

const generatePoNumber = (): string => {
  const db = getDatabase();
  const result = db.execute(
    'SELECT COUNT(*) as count FROM purchase_orders;',
  );
  const count = (result.rows?.item(0) as {count: number})?.count ?? 0;
  const next = count + 1;
  return `PO-${String(next).padStart(6, '0')}`;
};

// ─── Get all purchase orders (for history list — FR-PO-05) ───────────────────

export const getAllPurchaseOrders = (): (PurchaseOrder & {item_count: number})[] => {
  const db = getDatabase();
  const result = db.execute(
    `SELECT po.*, COUNT(poi.id) as item_count
     FROM purchase_orders po
     LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
     GROUP BY po.id
     ORDER BY po.created_at DESC;`,
  );
  const orders: (PurchaseOrder & {item_count: number})[] = [];
  if (!result.rows) return orders;
  for (let i = 0; i < result.rows.length; i++) {
    orders.push(result.rows.item(i) as PurchaseOrder & {item_count: number});
  }
  return orders;
};

// ─── Get purchase order by ID with items (for detail view — FR-PO-06) ─────────

export const getPurchaseOrderById = (id: number): PurchaseOrderWithItems | null => {
  const db = getDatabase();

  const poResult = db.execute(
    'SELECT * FROM purchase_orders WHERE id = ?;',
    [id],
  );
  if (!poResult.rows || poResult.rows.length === 0) return null;

  const po = poResult.rows.item(0) as PurchaseOrderWithItems;

  const itemsResult = db.execute(
    'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?;',
    [id],
  );
  po.items = [];
  if (itemsResult.rows) {
    for (let i = 0; i < itemsResult.rows.length; i++) {
      po.items.push(itemsResult.rows.item(i) as PurchaseOrderItem);
    }
  }

  return po;
};

// ─── Save new purchase order (FR-PO-01 to FR-PO-04) ──────────────────────────

export interface NewPOLine {
  product_id: number;
  product_name: string;
  quantity: number;
  purchase_price: number;
}

export const savePurchaseOrder = (
  lines: NewPOLine[],
  supplier_note: string | null,
): number => {
  // Validate all lines before saving (FR-PO-07)
  lines.forEach((line, index) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Line ${index + 1}: quantity must be a positive integer`);
    }
    if (line.purchase_price < 0) {
      throw new Error(`Line ${index + 1}: purchase price cannot be negative`);
    }
  });

  const db = getDatabase();
  const po_number = generatePoNumber();
  const total_cost = lines.reduce(
    (sum, line) => sum + line.quantity * line.purchase_price,
    0,
  );

  let insertedId = 0;

  db.transaction(tx => {
    // Insert purchase order header
    const poResult = tx.execute(
      `INSERT INTO purchase_orders (po_number, supplier_note, total_cost)
       VALUES (?, ?, ?);`,
      [po_number, supplier_note, total_cost],
    );

    insertedId = poResult.insertId ?? 0;

    // Insert each line and update stock
    lines.forEach(line => {
      const line_cost = line.quantity * line.purchase_price;

      // Insert PO line (snapshot product name — FR-PO-04)
      tx.execute(
        `INSERT INTO purchase_order_items
          (purchase_order_id, product_id, product_name, quantity, purchase_price, line_cost)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          insertedId,
          line.product_id,
          line.product_name,
          line.quantity,
          line.purchase_price,
          line_cost,
        ],
      );

      // Increment product stock (FR-PO-03)
      incrementStock(line.product_id, line.quantity);
    });
  });

  return insertedId;
};