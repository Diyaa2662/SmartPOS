// src/database/settingsDAO.ts
// SmartPOS - Settings Data Access Object
// Based on SRS Section 3.8 (FR-CUR) and Section 6.7
// NOTE: All functions are async because op-sqlite's execute() returns a Promise
// NOTE: result.rows is a plain array (Record<string, Scalar>[]) — use [i], not .item(i)

import { getDatabase } from './database';
import { AppSettings, Setting } from '../types';

// ─── Get single setting by key ────────────────────────────────────────────────

export const getSetting = async (key: string): Promise<string | null> => {
  const db = getDatabase();
  const result = await db.execute('SELECT value FROM settings WHERE key = ?;', [
    key,
  ]);
  if (result.rows && result.rows.length > 0) {
    return (result.rows[0] as unknown as Setting).value;
  }
  return null;
};

// ─── Set single setting by key ────────────────────────────────────────────────

export const setSetting = async (key: string, value: string): Promise<void> => {
  const db = getDatabase();
  await db.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
    [key, value],
  );
};

// ─── Get all settings as typed AppSettings object ────────────────────────────

export const getAllSettings = async (): Promise<AppSettings> => {
  const db = getDatabase();
  const result = await db.execute('SELECT key, value FROM settings;');

  const map: Record<string, string> = {};
  if (result.rows) {
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i] as unknown as Setting;
      map[row.key] = row.value;
    }
  }

  return {
    store_name: map.store_name ?? 'My Store',
    primary_currency_code: map.primary_currency_code ?? 'USD',
    primary_currency_symbol: map.primary_currency_symbol ?? '$',
    secondary_currency_code: map.secondary_currency_code ?? '',
    secondary_currency_symbol: map.secondary_currency_symbol ?? '',
    exchange_rate: parseFloat(map.exchange_rate ?? '1'),
    exchange_rate_updated_at: map.exchange_rate_updated_at ?? '',
    receipt_footer: map.receipt_footer ?? '',
    receipt_show_qr: map.receipt_show_qr === 'true',
    admin_pin_hash: map.admin_pin_hash ?? '',
    language: map.language ?? 'en',
  };
};

// ─── Save all settings at once (from Settings screen) ────────────────────────

export const saveAllSettings = async (
  settings: Partial<AppSettings>,
): Promise<void> => {
  const db = getDatabase();

  // Validate exchange rate before saving (FR-CUR-09)
  if (settings.exchange_rate !== undefined && settings.exchange_rate <= 0) {
    throw new Error('Exchange rate must be greater than 0');
  }

  await db.transaction(async tx => {
    if (settings.store_name !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['store_name', settings.store_name],
      );
    }
    if (settings.primary_currency_code !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['primary_currency_code', settings.primary_currency_code],
      );
    }
    if (settings.primary_currency_symbol !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['primary_currency_symbol', settings.primary_currency_symbol],
      );
    }
    if (settings.secondary_currency_code !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['secondary_currency_code', settings.secondary_currency_code],
      );
    }
    if (settings.secondary_currency_symbol !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['secondary_currency_symbol', settings.secondary_currency_symbol],
      );
    }
    if (settings.exchange_rate !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['exchange_rate', settings.exchange_rate.toString()],
      );
      // Update timestamp when rate changes (FR-CUR-08)
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['exchange_rate_updated_at', new Date().toISOString()],
      );
    }
    if (settings.receipt_footer !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['receipt_footer', settings.receipt_footer],
      );
    }
    if (settings.receipt_show_qr !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['receipt_show_qr', settings.receipt_show_qr.toString()],
      );
    }
    if (settings.language !== undefined) {
      await tx.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        ['language', settings.language],
      );
    }
  });
};

// ─── PIN helpers (NFR-SEC-01, NFR-SEC-03) ────────────────────────────────────

// Simple hash function — in production consider using react-native-bcrypt
const hashPin = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = Math.imul(31, hash) + pin.charCodeAt(i);
  }
  return Math.abs(hash).toString(16);
};

export const saveAdminPin = async (pin: string): Promise<void> => {
  const hashed = hashPin(pin);
  await setSetting('admin_pin_hash', hashed);
};

export const verifyAdminPin = async (pin: string): Promise<boolean> => {
  const storedHash = await getSetting('admin_pin_hash');
  if (!storedHash) return false;
  return hashPin(pin) === storedHash;
};
