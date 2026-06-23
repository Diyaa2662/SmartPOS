// src/database/categoryDAO.ts
// SmartPOS - Category Data Access Object
// Based on SRS Section 3.1 (FR-CAT)
// NOTE: All functions are async because op-sqlite's execute() returns a Promise
// NOTE: result.rows is a plain array (Record<string, Scalar>[]) — use [i], not .item(i)
// UPDATED per client request: categories now support unlimited nesting depth
// (e.g. Chips -> Chips Medium Size -> Doritos), replacing the original 2-level
// limit from the SRS. parent_id is self-referencing so the schema itself
// already supports any depth — only the application-level 2-level guard and
// the tree-building logic needed to change.

import { getDatabase } from './database';
import { Category, CategoryWithChildren } from '../types';

// ─── Get all categories as an unlimited-depth tree (FR-CAT-04, extended) ─────
// Builds the full tree recursively starting from root categories (parent_id IS NULL).

export const getAllCategoriesTree = async (): Promise<
  CategoryWithChildren[]
> => {
  const db = getDatabase();

  // Pull every category with its product count in one pass, then assemble
  // the tree in memory — far fewer queries than recursing per level in SQL.
  const allResult = await db.execute(
    `SELECT c.*, COUNT(p.id) as item_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.name ASC;`,
  );

  const flatList: CategoryWithChildren[] = [];
  if (allResult.rows) {
    for (let i = 0; i < allResult.rows.length; i++) {
      const row = allResult.rows[i] as unknown as CategoryWithChildren;
      row.children = [];
      flatList.push(row);
    }
  }

  const byId = new Map<number, CategoryWithChildren>();
  flatList.forEach(cat => byId.set(cat.id, cat));

  const roots: CategoryWithChildren[] = [];
  flatList.forEach(cat => {
    if (cat.parent_id === null) {
      roots.push(cat);
    } else {
      const parent = byId.get(cat.parent_id);
      // Defensive fallback: if a parent is somehow missing, treat as root
      // rather than silently dropping the category from the tree.
      if (parent) {
        parent.children.push(cat);
      } else {
        roots.push(cat);
      }
    }
  });

  return roots;
};

// ─── Get a category's id plus all descendant ids at any depth ───────────────
// Used when filtering products by category: selecting "Chips" should also
// include products under "Chips Medium Size" and "Doritos" beneath it, since
// categories now support unlimited nesting depth (client-requested change).

export const getCategoryIdWithDescendants = async (
  categoryId: number,
): Promise<number[]> => {
  const db = getDatabase();
  const allResult = await db.execute('SELECT id, parent_id FROM categories;');

  const childrenByParent = new Map<number, number[]>();
  if (allResult.rows) {
    for (let i = 0; i < allResult.rows.length; i++) {
      const row = allResult.rows[i] as unknown as {
        id: number;
        parent_id: number | null;
      };
      if (row.parent_id !== null) {
        const list = childrenByParent.get(row.parent_id) ?? [];
        list.push(row.id);
        childrenByParent.set(row.parent_id, list);
      }
    }
  }

  const result: number[] = [categoryId];
  const stack = [categoryId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenByParent.get(current) ?? [];
    children.forEach(childId => {
      result.push(childId);
      stack.push(childId);
    });
  }

  return result;
};

// ─── Get all categories that are valid parent options (for selectors) ───────
// Any existing category can be a parent now (unlimited depth), so this is
// effectively the same data as getAllCategoriesFlat but kept as a separate,
// clearly-named function for readability at call sites that build pickers.

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
  const result = await db.execute('SELECT * FROM categories WHERE id = ?;', [
    id,
  ]);
  if (result.rows && result.rows.length > 0) {
    return result.rows[0] as unknown as Category;
  }
  return null;
};

// ─── Get full ancestor chain for a category (root...parent), for breadcrumbs ─
// e.g. for "Doritos" under "Chips Medium Size" under "Chips", returns
// [Chips, Chips Medium Size] (excludes the category itself).

export const getCategoryAncestors = async (id: number): Promise<Category[]> => {
  const ancestors: Category[] = [];
  let current = await getCategoryById(id);
  while (current && current.parent_id !== null) {
    const parent = await getCategoryById(current.parent_id);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
};

// ─── Check whether candidateParentId is a descendant of categoryId ───────────
// Prevents creating a cycle (e.g. setting a category's own grandchild as its
// new parent), which is now a real risk with unlimited nesting depth.

const isDescendant = async (
  categoryId: number,
  candidateParentId: number,
): Promise<boolean> => {
  let current = await getCategoryById(candidateParentId);
  while (current) {
    if (current.id === categoryId) return true;
    if (current.parent_id === null) return false;
    current = await getCategoryById(current.parent_id);
  }
  return false;
};

// ─── Create category (FR-CAT-01, unlimited depth) ────────────────────────────

export const createCategory = async (
  name: string,
  description: string | null,
  color: string | null,
  parent_id: number | null,
): Promise<number> => {
  const db = getDatabase();

  const result = await db.execute(
    `INSERT INTO categories (name, description, color, parent_id, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'));`,
    [name, description, color, parent_id],
  );

  return result.insertId ?? 0;
};

// ─── Update category (FR-CAT-02, unlimited depth) ────────────────────────────

export const updateCategory = async (
  id: number,
  name: string,
  description: string | null,
  color: string | null,
  parent_id: number | null,
): Promise<void> => {
  const db = getDatabase();

  // A category can't be its own parent
  if (parent_id === id) {
    throw new Error('A category cannot be its own parent');
  }

  // A category can't be moved under one of its own descendants (would create a cycle)
  if (parent_id !== null && (await isDescendant(id, parent_id))) {
    throw new Error(
      'Cannot move a category under one of its own subcategories',
    );
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
  const productCount =
    (productsResult.rows?.[0] as unknown as { count: number })?.count ?? 0;
  if (productCount > 0) {
    throw new Error('Cannot delete category with assigned products');
  }

  // Block if category has child categories (at any depth — direct children only need checking,
  // since a non-empty child already blocks its own deletion the same way)
  const childrenResult = await db.execute(
    'SELECT COUNT(*) as count FROM categories WHERE parent_id = ?;',
    [id],
  );
  const childCount =
    (childrenResult.rows?.[0] as unknown as { count: number })?.count ?? 0;
  if (childCount > 0) {
    throw new Error('Cannot delete category with subcategories');
  }

  await db.execute('DELETE FROM categories WHERE id = ?;', [id]);
};
