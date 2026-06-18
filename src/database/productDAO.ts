// src/database/productDAO.ts
// SmartPOS - Product Data Access Object
// Based on SRS Section 3.2 (FR-PRD)

import {getDatabase} from './database';
import {Product, ProductWithCategory} from '../types';

// ─── Get all products with category name (FR-PRD-04) ─────────────────────────

export const getAllProducts = (
  search?: string,
  category_id?: number,
): ProductWithCategory[] => {
  const db = getDatabase();

  let query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  // Filter by search (name or barcode — FR-PRD-04)
  if (search && search.trim() !== '') {
    query += ' AND (p.name LIKE ? OR p.barcode LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  // Filter by category (FR-PRD-04)
  if (category_id !== undefined) {
    query += ' AND p.category_id = ?';
    params.push(category_id);
  }

  query += ' ORDER BY p.name ASC;';

  const result = db.execute(query, params);
  const products: ProductWithCategory[] = [];
  if (!result.rows) return products;
  for (let i = 0; i < result.rows.length; i++) {
    products.push(result.rows.item(i) as ProductWithCategory);
  }
  return products;
};

// ─── Get product by ID ────────────────────────────────────────────────────────

export const getProductById = (id: number): Product | null => {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM products WHERE id = ?;',
    [id],
  );
  if (result.rows && result.rows.length > 0) {
    return result.rows.item(0) as Product;
  }
  return null;
};

// ─── Get product by barcode (FR-SAL-02, FR-SAL-11) ───────────────────────────

export const getProductByBarcode = (barcode: string): Product | null => {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM products WHERE barcode = ?;',
    [barcode],
  );
  if (result.rows && result.rows.length > 0) {
    return result.rows.item(0) as Product;
  }
  return null;
};

// ─── Generate unique Code128 barcode (FR-PRD-05) ─────────────────────────────

export const generateUniqueBarcode = (): string => {
  const db = getDatabase();
  let barcode = '';
  let isUnique = false;

  while (!isUnique) {
    // Generate random 12-digit number
    const random = Math.floor(100000000000 + Math.random() * 900000000000);
    barcode = `128${random}`;

    // Check uniqueness (FR-PRD-08)
    const result = db.execute(
      'SELECT COUNT(*) as count FROM products WHERE barcode = ?;',
      [barcode],
    );
    const count = (result.rows?.item(0) as {count: number})?.count ?? 0;
    isUnique = count === 0;
  }

  return barcode;
};

// ─── Check barcode uniqueness (FR-PRD-08) ────────────────────────────────────

export const isBarcodeUnique = (barcode: string, excludeId?: number): boolean => {
  const db = getDatabase();
  let query = 'SELECT COUNT(*) as count FROM products WHERE barcode = ?';
  const params: (string | number)[] = [barcode];

  if (excludeId !== undefined) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  query += ';';
  const result = db.execute(query, params);
  const count = (result.rows?.item(0) as {count: number})?.count ?? 0;
  return count === 0;
};

// ─── Get effective selling price (FR-PRD-09) ─────────────────────────────────

export const getEffectivePrice = (product: Product): number => {
  if (product.discount_price !== null && product.discount_price < product.price) {
    return product.discount_price;
  }
  return product.price;
};

// ─── Create product (FR-PRD-01) ──────────────────────────────────────────────

export const createProduct = (
  name: string,
  category_id: number,
  price: number,
  discount_price: number | null,
  barcode: string | null,
  description: string | null,
  stock_qty: number,
): number => {
  const db = getDatabase();

  // Validate barcode uniqueness (FR-PRD-08)
  if (barcode !== null && !isBarcodeUnique(barcode)) {
    throw new Error('Barcode already exists');
  }

  const result = db.execute(
    `INSERT INTO products
      (name, category_id, price, discount_price, barcode, description, stock_qty, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
    [name, category_id, price, discount_price, barcode, description, stock_qty],
  );

  return result.insertId ?? 0;
};

// ─── Update product (FR-PRD-02) ──────────────────────────────────────────────

export const updateProduct = (
  id: number,
  name: string,
  category_id: number,
  price: number,
  discount_price: number | null,
  barcode: string | null,
  description: string | null,
  stock_qty: number,
): void => {
  const db = getDatabase();

  // Validate barcode uniqueness excluding current product (FR-PRD-08)
  if (barcode !== null && !isBarcodeUnique(barcode, id)) {
    throw new Error('Barcode already exists');
  }

  db.execute(
    `UPDATE products
     SET name = ?, category_id = ?, price = ?, discount_price = ?,
         barcode = ?, description = ?, stock_qty = ?, updated_at = datetime('now')
     WHERE id = ?;`,
    [name, category_id, price, discount_price, barcode, description, stock_qty, id],
  );
};

// ─── Delete product (FR-PRD-03) ──────────────────────────────────────────────

export const deleteProduct = (id: number): void => {
  const db = getDatabase();
  db.execute('DELETE FROM products WHERE id = ?;', [id]);
};

// ─── Update stock quantity (called after purchase order — FR-PO-03) ──────────

export const incrementStock = (product_id: number, quantity: number): void => {
  const db = getDatabase();
  db.execute(
    `UPDATE products
     SET stock_qty = stock_qty + ?, updated_at = datetime('now')
     WHERE id = ?;`,
    [quantity, product_id],
  );
};