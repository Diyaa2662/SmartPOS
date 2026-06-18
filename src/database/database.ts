// src/database/database.ts
// SmartPOS - Database Initialization

import {open, DB} from '@op-engineering/op-sqlite';
import {ALL_TABLES} from './schema';

const DB_NAME = 'smartpos.db';

let db: DB;

export const getDatabase = (): DB => {
  if (!db) {
    db = open({name: DB_NAME});
    initializeDatabase();
  }
  return db;
};

const initializeDatabase = (): void => {
  try {
    // Enable foreign keys (disabled by default in SQLite)
    db.execute('PRAGMA foreign_keys = ON;');

    // Create all tables (IF NOT EXISTS — safe to run on every launch)
    ALL_TABLES.forEach(tableSQL => {
      db.execute(tableSQL);
    });

    // Insert default settings if not already set (FR-CUR-01, FR-CUR-02)
    insertDefaultSettings();

    console.log('SmartPOS database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

const insertDefaultSettings = (): void => {
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

  defaults.forEach(({key, value}) => {
    // INSERT OR IGNORE — only inserts if key doesn't exist yet
    db.execute(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);',
      [key, value],
    );
  });
};