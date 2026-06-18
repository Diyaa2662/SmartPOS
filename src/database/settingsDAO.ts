/* eslint-disable no-bitwise */
// src/database/settingsDAO.ts
// SmartPOS - Settings Data Access Object
// Based on SRS Section 3.8 (FR-CUR) and Section 6.7

import {getDatabase} from './database';
import {AppSettings, Setting} from '../types';

// ─── Get single setting by key ────────────────────────────────────────────────

export const getSetting = (key: string): string | null => {
  const db = getDatabase();
  const result = db.execute('SELECT value FROM settings WHERE key = ?;', [key]);
  if (result.rows && result.rows.length > 0) {
    return (result.rows.item(0) as Setting).value;
  }
  return null;
};

// ─── Set single setting by key ────────────────────────────────────────────────

export const setSetting = (key: string, value: string): void => {
  const db = getDatabase();
  db.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
    [key, value],
  );
};

// ─── Get all settings as typed AppSettings object ────────────────────────────

export const getAllSettings = (): AppSettings => {
  const db = getDatabase();
  const result = db.execute('SELECT key, value FROM settings;');

  const map: Record<string, string> = {};
  if (result.rows) {
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i) as Setting;
      map[row.key] = row.value;
    }
  }

  return {
    store_name:               map.store_name ?? 'My Store',
    primary_currency_code:    map.primary_currency_code ?? 'USD',
    primary_currency_symbol:  map.primary_currency_symbol ?? '$',
    secondary_currency_code:  map.secondary_currency_code ?? '',
    secondary_currency_symbol:map.secondary_currency_symbol ?? '',
    exchange_rate:            parseFloat(map.exchange_rate ?? '1'),
    exchange_rate_updated_at: map.exchange_rate_updated_at ?? '',
    receipt_footer:           map.receipt_footer ?? '',
    receipt_show_qr:          map.receipt_show_qr === 'true',
    admin_pin_hash:           map.admin_pin_hash ?? '',
  };
};

// ─── Save all settings at once (from Settings screen) ────────────────────────

export const saveAllSettings = (settings: Partial<AppSettings>): void => {
  const db = getDatabase();

  // Validate exchange rate before saving (FR-CUR-09)
  if (settings.exchange_rate !== undefined && settings.exchange_rate <= 0) {
    throw new Error('Exchange rate must be greater than 0');
  }

  db.transaction(tx => {
    if (settings.store_name !== undefined) {
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['store_name', settings.store_name]);
    }
    if (settings.primary_currency_code !== undefined) {
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['primary_currency_code', settings.primary_currency_code]);
    }
    if (settings.primary_currency_symbol !== undefined) {
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['primary_currency_symbol', settings.primary_currency_symbol]);
    }
    if (settings.secondary_currency_code !== undefined) {
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['secondary_currency_code', settings.secondary_currency_code]);
    }
    if (settings.secondary_currency_symbol !== undefined) {
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['secondary_currency_symbol', settings.secondary_currency_symbol]);
    }
    if (settings.exchange_rate !== undefined) {
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['exchange_rate', settings.exchange_rate.toString()]);
      // Update timestamp when rate changes (FR-CUR-08)
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['exchange_rate_updated_at', new Date().toISOString()]);
    }
    if (settings.receipt_footer !== undefined) {
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['receipt_footer', settings.receipt_footer]);
    }
    if (settings.receipt_show_qr !== undefined) {
      tx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', ['receipt_show_qr', settings.receipt_show_qr.toString()]);
    }
  });
};

// ─── PIN helpers (NFR-SEC-01, NFR-SEC-03) ────────────────────────────────────

// Simple hash function — in production consider using react-native-bcrypt
const hashPin = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const saveAdminPin = (pin: string): void => {
  const hashed = hashPin(pin);
  setSetting('admin_pin_hash', hashed);
};

export const verifyAdminPin = (pin: string): boolean => {
  const storedHash = getSetting('admin_pin_hash');
  if (!storedHash) return false;
  return hashPin(pin) === storedHash;
};