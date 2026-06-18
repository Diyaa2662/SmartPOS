// src/database/categoryDAO.ts
// SmartPOS - Category Data Access Object
// Based on SRS Section 3.1 (FR-CAT)

import {getDatabase} from './database';
import {Category, CategoryWithChildren} from '../types';

// ─── Get all categories as 2-level tree (FR-CAT-04) ──────────────────────────

export const getAllCategoriesTree = (): CategoryWithChildren[] => {
  const db = getDatabase();

  // Get root categories (parent_id IS NULL)
  const rootResult = db.execute(
    `SELECT c.*, COUNT(p.id) as item_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     WHERE c.parent_id IS NULL
     GROUP BY c.id
     ORDER BY c.name ASC;`,
  );

  const roots: CategoryWithChildren[] = [];

  if (!rootResult.rows) return roots;

  for (let i = 0; i < rootResult.rows.length; i++) {
    const root = rootResult.rows.item(i) as CategoryWithChildren;

    // Get children for each root
    const childResult = db.execute(
      `SELECT c.*, COUNT(p.id) as item_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       WHERE c.parent_id = ?
       GROUP BY c.id
       ORDER BY c.name ASC;`,
      [root.id],
    );

    root.children = [];
    if (childResult.rows) {
      for (let j = 0; j < childResult.rows.length; j++) {
        root.children.push(childResult.rows.item(j) as Category);
      }
    }

    roots.push(root);
  }

  return roots;
};

// ─── Get all root categories (for parent selector in Add Category) ────────────

export const getRootCategories = (): Category[] => {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM categories WHERE parent_id IS NULL ORDER BY name ASC;',
  );
  const categories: Category[] = [];
  if (!result.rows) return categories;
  for (let i = 0; i < result.rows.length; i++) {
    categories.push(result.rows.item(i) as Category);
  }
  return categories;
};

// ─── Get all categories flat (for product category selector) ─────────────────

export const getAllCategoriesFlat = (): Category[] => {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM categories ORDER BY name ASC;',
  );
  const categories: Category[] = [];
  if (!result.rows) return categories;
  for (let i = 0; i < result.rows.length; i++) {
    categories.push(result.rows.item(i) as Category);
  }
  return categories;
};

// ─── Get category by ID ───────────────────────────────────────────────────────

export const getCategoryById = (id: number): Category | null => {
  const db = getDatabase();
  const result = db.execute(
    'SELECT * FROM categories WHERE id = ?;',
    [id],
  );
  if (result.rows && result.rows.length > 0) {
    return result.rows.item(0) as Category;
  }
  return null;
};

// ─── Create category (FR-CAT-01) ─────────────────────────────────────────────

export const createCategory = (
  name: string,
  description: string | null,
  color: string | null,
  parent_id: number | null,
): number => {
  const db = getDatabase();

  // Enforce max 2 levels — parent must be a root category (FR-CAT-01)
  if (parent_id !== null) {
    const parent = getCategoryById(parent_id);
    if (parent && parent.parent_id !== null) {
      throw new Error('Only 2 levels of categories are allowed');
    }
  }

  const result = db.execute(
    `INSERT INTO categories (name, description, color, parent_id, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'));`,
    [name, description, color, parent_id],
  );

  return result.insertId ?? 0;
};

// ─── Update category (FR-CAT-02) ─────────────────────────────────────────────

export const updateCategory = (
  id: number,
  name: string,
  description: string | null,
  color: string | null,
  parent_id: number | null,
): void => {
  const db = getDatabase();

  // Enforce max 2 levels
  if (parent_id !== null) {
    const parent = getCategoryById(parent_id);
    if (parent && parent.parent_id !== null) {
      throw new Error('Only 2 levels of categories are allowed');
    }
  }

  db.execute(
    `UPDATE categories
     SET name = ?, description = ?, color = ?, parent_id = ?, updated_at = datetime('now')
     WHERE id = ?;`,
    [name, description, color, parent_id, id],
  );
};

// ─── Delete category (FR-CAT-03) ─────────────────────────────────────────────

export const deleteCategory = (id: number): void => {
  const db = getDatabase();

  // Block if category has products assigned
  const productsResult = db.execute(
    'SELECT COUNT(*) as count FROM products WHERE category_id = ?;',
    [id],
  );
  const productCount = (productsResult.rows?.item(0) as {count: number})?.count ?? 0;
  if (productCount > 0) {
    throw new Error('Cannot delete category with assigned products');
  }

  // Block if category has child categories
  const childrenResult = db.execute(
    'SELECT COUNT(*) as count FROM categories WHERE parent_id = ?;',
    [id],
  );
  const childCount = (childrenResult.rows?.item(0) as {count: number})?.count ?? 0;
  if (childCount > 0) {
    throw new Error('Cannot delete category with subcategories');
  }

  db.execute('DELETE FROM categories WHERE id = ?;', [id]);
};