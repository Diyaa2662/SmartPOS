// src/database/database.ts
// SmartPOS - Database Initialization
// NOTE: @op-engineering/op-sqlite execute() returns a Promise — all DB calls are async

import {open, DB} from '@op-engineering/op-sqlite';
import {ALL_TABLES} from './schema';

const DB_NAME = 'smartpos.db';

let db: DB;
let initPromise: Promise<void> | null = null;

export const getDatabase = (): DB => {
  if (!db) {
    db = open({name: DB_NAME});
  }
  return db;
};

// Call this once at app startup (e.g. in App.tsx) and await it
// before rendering any screen that touches the database.
export const initDatabase = (): Promise<void> => {
  if (!initPromise) {
    initPromise = initializeDatabase();
  }
  return initPromise;
};

const initializeDatabase = async (): Promise<void> => {
  try {
    const database = getDatabase();

    // Enable foreign keys (disabled by default in SQLite)
    await database.execute('PRAGMA foreign_keys = ON;');

    // Create all tables (IF NOT EXISTS — safe to run on every launch)
    for (const tableSQL of ALL_TABLES) {
      await database.execute(tableSQL);
    }

    // Insert default settings if not already set (FR-CUR-01, FR-CUR-02)
    await insertDefaultSettings();

    console.log('SmartPOS database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

const insertDefaultSettings = async (): Promise<void> => {
  const database = getDatabase();

  const defaults: {key: string; value: string}[] = [
    {key: 'store_name', value: 'My Store'},
    {key: 'primary_currency_code', value: 'USD'},
    {key: 'primary_currency_symbol', value: '$'},
    {key: 'secondary_currency_code', value: 'IQD'},
    {key: 'secondary_currency_symbol', value: 'IQD'},
    {key: 'exchange_rate', value: '1'},
    {key: 'exchange_rate_updated_at', value: new Date().toISOString()},
    {key: 'receipt_footer', value: 'Thank you for shopping!'},
    {key: 'receipt_show_qr', value: 'false'},
    {key: 'admin_pin_hash', value: ''},
  ];

  for (const {key, value} of defaults) {
    // INSERT OR IGNORE — only inserts if key doesn't exist yet
    await database.execute(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);',
      [key, value],
    );
  }
};