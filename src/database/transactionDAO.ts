// src/database/transactionDAO.ts
// SmartPOS - Transaction Data Access Object
// Based on SRS Section 3.3 (FR-SAL) and Section 3.8 (FR-CUR)
// NOTE: All functions are async because op-sqlite's execute() returns a Promise
// NOTE: result.rows is a plain array (Record<string, Scalar>[]) — use [i], not .item(i)

import {getDatabase} from './database';
import {Transaction, TransactionItem, TransactionWithItems, CartItem} from '../types';
import {getAllSettings} from './settingsDAO';

// ─── Get transaction by ID with items (for receipt — FR-PRT-02) ───────────────

export const getTransactionById = async (id: number): Promise<TransactionWithItems | null> => {
  const db = getDatabase();

  const txResult = await db.execute(
    'SELECT * FROM transactions WHERE id = ?;',
    [id],
  );
  if (!txResult.rows || txResult.rows.length === 0) return null;

  const transaction = txResult.rows[0] as unknown as TransactionWithItems;

  const itemsResult = await db.execute(
    'SELECT * FROM transaction_items WHERE transaction_id = ?;',
    [id],
  );
  transaction.items = [];
  if (itemsResult.rows) {
    for (let i = 0; i < itemsResult.rows.length; i++) {
      transaction.items.push(itemsResult.rows[i] as unknown as TransactionItem);
    }
  }

  return transaction;
};

// ─── Get recent transactions (for receipt history — FR-PRT-03) ───────────────

export const getRecentTransactions = async (limit: number = 20): Promise<Transaction[]> => {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?;',
    [limit],
  );
  const transactions: Transaction[] = [];
  if (!result.rows) return transactions;
  for (let i = 0; i < result.rows.length; i++) {
    transactions.push(result.rows[i] as unknown as Transaction);
  }
  return transactions;
};

// ─── Get transactions by date range (for reports — FR-RPT-01) ────────────────

export const getTransactionsByDateRange = async (
  startDate: string,
  endDate: string,
): Promise<TransactionWithItems[]> => {
  const db = getDatabase();

  const txResult = await db.execute(
    `SELECT * FROM transactions
     WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
     ORDER BY created_at DESC;`,
    [startDate, endDate],
  );

  const transactions: TransactionWithItems[] = [];
  if (!txResult.rows) return transactions;

  for (let i = 0; i < txResult.rows.length; i++) {
    const tx = txResult.rows[i] as unknown as TransactionWithItems;

    const itemsResult = await db.execute(
      'SELECT * FROM transaction_items WHERE transaction_id = ?;',
      [tx.id],
    );
    tx.items = [];
    if (itemsResult.rows) {
      for (let j = 0; j < itemsResult.rows.length; j++) {
        tx.items.push(itemsResult.rows[j] as unknown as TransactionItem);
      }
    }
    transactions.push(tx);
  }

  return transactions;
};

// ─── Get today's summary (for dashboard — FR-DAS-01) ─────────────────────────

export const getTodaySummary = async (): Promise<{
  total_sales: number;
  transaction_count: number;
  best_selling_product: string | null;
  best_selling_qty: number;
}> => {
  const db = getDatabase();

  const summaryResult = await db.execute(
    `SELECT
       COALESCE(SUM(grand_total), 0) as total_sales,
       COUNT(*) as transaction_count
     FROM transactions
     WHERE date(created_at) = date('now');`,
  );

  const summary = summaryResult.rows?.[0] as unknown as {
    total_sales: number;
    transaction_count: number;
  };

  // Best selling product today by quantity
  const bestResult = await db.execute(
    `SELECT ti.product_name, SUM(ti.quantity) as total_qty
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     WHERE date(t.created_at) = date('now')
     GROUP BY ti.product_name
     ORDER BY total_qty DESC
     LIMIT 1;`,
  );

  const best = bestResult.rows?.[0] as unknown as {
    product_name: string;
    total_qty: number;
  } | undefined;

  return {
    total_sales: summary?.total_sales ?? 0,
    transaction_count: summary?.transaction_count ?? 0,
    best_selling_product: best?.product_name ?? null,
    best_selling_qty: best?.total_qty ?? 0,
  };
};

// ─── Get sales by day for chart (FR-DAS-02) ───────────────────────────────────

export const getWeeklySales = async (): Promise<{date: string; total: number}[]> => {
  const db = getDatabase();
  const result = await db.execute(
    `SELECT date(created_at) as date, SUM(grand_total) as total
     FROM transactions
     WHERE date(created_at) >= date('now', '-6 days')
     GROUP BY date(created_at)
     ORDER BY date ASC;`,
  );
  const rows: {date: string; total: number}[] = [];
  if (!result.rows) return rows;
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows[i] as unknown as {date: string; total: number});
  }
  return rows;
};

// ─── Get top products for period (FR-DAS-04, FR-RPT-02) ──────────────────────

export const getTopProducts = async (
  startDate: string,
  endDate: string,
  limit: number = 10,
): Promise<{product_name: string; total_qty: number; total_revenue: number}[]> => {
  const db = getDatabase();
  const result = await db.execute(
    `SELECT
       ti.product_name,
       SUM(ti.quantity) as total_qty,
       SUM(ti.line_total) as total_revenue
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     WHERE date(t.created_at) >= date(?) AND date(t.created_at) <= date(?)
     GROUP BY ti.product_name
     ORDER BY total_revenue DESC
     LIMIT ?;`,
    [startDate, endDate, limit],
  );
  const rows: {product_name: string; total_qty: number; total_revenue: number}[] = [];
  if (!result.rows) return rows;
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows[i] as unknown as {product_name: string; total_qty: number; total_revenue: number});
  }
  return rows;
};

// ─── Get sales by category for period (FR-DAS-03, FR-RPT-02) ─────────────────

export const getSalesByCategory = async (
  startDate: string,
  endDate: string,
): Promise<{category_name: string; total_revenue: number}[]> => {
  const db = getDatabase();
  const result = await db.execute(
    `SELECT
       c.name as category_name,
       SUM(ti.line_total) as total_revenue
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     JOIN products p ON p.id = ti.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE date(t.created_at) >= date(?) AND date(t.created_at) <= date(?)
     GROUP BY c.name
     ORDER BY total_revenue DESC;`,
    [startDate, endDate],
  );
  const rows: {category_name: string; total_revenue: number}[] = [];
  if (!result.rows) return rows;
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows[i] as unknown as {category_name: string; total_revenue: number});
  }
  return rows;
};

// ─── Save completed transaction (FR-SAL-10, FR-CUR-05) ───────────────────────

export const saveTransaction = async (
  cartItems: CartItem[],
  subtotal: number,
  discount_amount: number,
  grand_total: number,
  amount_tendered: number,
  change_due: number,
): Promise<number> => {
  const db = getDatabase();
  const settings = await getAllSettings();

  let insertedId = 0;

  await db.transaction(async tx => {
    // Save transaction header with exchange rate snapshot (FR-CUR-05)
    const txResult = await tx.execute(
      `INSERT INTO transactions
        (total_amount, discount_amount, grand_total, amount_tendered, change_due,
         primary_currency_code, secondary_currency_code, exchange_rate_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        subtotal,
        discount_amount,
        grand_total,
        amount_tendered,
        change_due,
        settings.primary_currency_code,
        settings.secondary_currency_code,
        settings.exchange_rate,
      ],
    );

    insertedId = txResult.insertId ?? 0;

    // Save each cart item as transaction_item (snapshot product name & price)
    for (const cartItem of cartItems) {
      await tx.execute(
        `INSERT INTO transaction_items
          (transaction_id, product_id, product_name, unit_price, discount_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          insertedId,
          cartItem.product.id,
          cartItem.product.name,
          cartItem.product.price,
          cartItem.product.discount_price,
          cartItem.quantity,
          cartItem.line_total,
        ],
      );
    }
  });

  return insertedId;
};