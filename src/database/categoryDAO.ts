// src/database/categoryDAO.ts
// SmartPOS - Category Data Access Object
// Based on SRS Section 3.1 (FR-CAT)
// NOTE: All functions are async because op-sqlite's execute() returns a Promise
// NOTE: result.rows is a plain array (Record<string, Scalar>[]) — use [i], not .item(i)

import {getDatabase} from './database';
import {Category, CategoryWithChildren} from '../types';

// ─── Get all categories as 2-level tree (FR-CAT-04) ──────────────────────────

export const getAllCategoriesTree = async (): Promise<CategoryWithChildren[]> => {
  const db = getDatabase();

  // Get root categories (parent_id IS NULL)
  const rootResult = await db.execute(
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
    const root = rootResult.rows[i] as unknown as CategoryWithChildren;

    // Get children for each root
    const childResult = await db.execute(
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
        root.children.push(childResult.rows[j] as unknown as Category);
      }
    }

    roots.push(root);
  }

  return roots;
};

// ─── Get all root categories (for parent selector in Add Category) ────────────

export const getRootCategories = async (): Promise<Category[]> => {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM categories WHERE parent_id IS NULL ORDER BY name ASC;',
  );
  const categories: Category[] = [];
  if (!result.rows) return categories;
  for (let i = 0; i < result.rows.length; i++) {
    categories.push(result.rows[i] as unknown as Category);
  }
  return categories;
};

// ─── Get all categories flat (for product category selector) ─────────────────

export const getAllCategoriesFlat = async (): Promise<Category[]> => {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM categories ORDER BY name ASC;',
  );
  const categories: Category[] = [];
  if (!result.rows) return categories;
  for (let i = 0; i < result.rows.length; i++) {
    categories.push(result.rows[i] as unknown as Category);
  }
  return categories;
};

// ─── Get category by ID ───────────────────────────────────────────────────────

export const getCategoryById = async (id: number): Promise<Category | null> => {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM categories WHERE id = ?;',
    [id],
  );
  if (result.rows && result.rows.length > 0) {
    return result.rows[0] as unknown as Category;
  }
  return null;
};

// ─── Create category (FR-CAT-01) ─────────────────────────────────────────────

export const createCategory = async (
  name: string,
  description: string | null,
  color: string | null,
  parent_id: number | null,
): Promise<number> => {
  const db = getDatabase();

  // Enforce max 2 levels — parent must be a root category (FR-CAT-01)
  if (parent_id !== null) {
    const parent = await getCategoryById(parent_id);
    if (parent && parent.parent_id !== null) {
      throw new Error('Only 2 levels of categories are allowed');
    }
  }

  const result = await db.execute(
    `INSERT INTO categories (name, description, color, parent_id, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'));`,
    [name, description, color, parent_id],
  );

  return result.insertId ?? 0;
};

// ─── Update category (FR-CAT-02) ─────────────────────────────────────────────

export const updateCategory = async (
  id: number,
  name: string,
  description: string | null,
  color: string | null,
  parent_id: number | null,
): Promise<void> => {
  const db = getDatabase();

  // Enforce max 2 levels
  if (parent_id !== null) {
    const parent = await getCategoryById(parent_id);
    if (parent && parent.parent_id !== null) {
      throw new Error('Only 2 levels of categories are allowed');
    }
  }

  await db.execute(
    `UPDATE categories
     SET name = ?, description = ?, color = ?, parent_id = ?, updated_at = datetime('now')
     WHERE id = ?;`,
    [name, description, color, parent_id, id],
  );
};

// ─── Delete category (FR-CAT-03) ─────────────────────────────────────────────

export const deleteCategory = async (id: number): Promise<void> => {
  const db = getDatabase();

  // Block if category has products assigned
  const productsResult = await db.execute(
    'SELECT COUNT(*) as count FROM products WHERE category_id = ?;',
    [id],
  );
  const productCount = (productsResult.rows?.[0] as unknown as {count: number})?.count ?? 0;
  if (productCount > 0) {
    throw new Error('Cannot delete category with assigned products');
  }

  // Block if category has child categories
  const childrenResult = await db.execute(
    'SELECT COUNT(*) as count FROM categories WHERE parent_id = ?;',
    [id],
  );
  const childCount = (childrenResult.rows?.[0] as unknown as {count: number})?.count ?? 0;
  if (childCount > 0) {
    throw new Error('Cannot delete category with subcategories');
  }

  await db.execute('DELETE FROM categories WHERE id = ?;', [id]);
};