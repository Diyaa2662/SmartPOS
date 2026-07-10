// src/utils/printerService.ts
// SmartPOS - Printer Service Utility
// Uses our own Native Module (PrinterModule.java) which connects directly
// to net.nyx.printerservice (v1.8.7) installed on the Aocom POS-T8 device.

import { NativeModules } from 'react-native';
import { TransactionWithItems, AppSettings } from '../types';

const { PrinterModule } = NativeModules;

// ─── Text format option keys (match PrintTextFormat setters in Java) ──────────

interface TextOptions {
  textSize?: number;
  align?: number; // 0=left, 1=center, 2=right
  style?: number; // 0=normal, 1=bold, 2=italic, 3=bold+italic
  lineSpacing?: number;
  topPadding?: number;
}

const NORMAL: TextOptions = { textSize: 24, align: 0 };
const BOLD: TextOptions = { textSize: 26, align: 0, style: 1 };
const CENTER: TextOptions = { textSize: 24, align: 1 };
const CENTER_BOLD: TextOptions = { textSize: 28, align: 1, style: 1 };
const SMALL_CENTER: TextOptions = { textSize: 20, align: 1 };

const DIVIDER = '--------------------------------';

// ─── Check printer connection ─────────────────────────────────────────────────

export const isPrinterConnected = async (): Promise<boolean> => {
  try {
    return await PrinterModule.isConnected();
  } catch {
    return false;
  }
};

// ─── Format currency ──────────────────────────────────────────────────────────

const formatAmount = (
  amount: number,
  settings: AppSettings,
  usePrimary: boolean,
): string => {
  if (usePrimary) {
    return `${settings.primary_currency_symbol}${amount.toFixed(2)}`;
  }
  const converted = amount * (settings.exchange_rate ?? 1);
  return `${Math.round(converted).toLocaleString()} ${
    settings.secondary_currency_symbol
  }`;
};

// ─── Print receipt (FR-PRT-01, FR-PRT-02) ────────────────────────────────────

export const printReceipt = async (
  transaction: TransactionWithItems,
  settings: AppSettings,
  usePrimary: boolean = true,
): Promise<void> => {
  if (!PrinterModule) {
    throw new Error('PrinterModule not available');
  }

  // Wait for printer service to connect (binding takes time on startup)
  const connected = await PrinterModule.isConnected();
  if (!connected) {
    // Wait 2 seconds and retry
    await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
    const retryConnected = await PrinterModule.isConnected();
    if (!retryConnected) {
      throw new Error('Printer service not connected. Please try again.');
    }
  }

  const print = (text: string, opts: TextOptions = NORMAL) =>
    PrinterModule.printText(text, opts);

  // Header
  await print(settings.store_name ?? 'SmartPOS', CENTER_BOLD);
  await print(DIVIDER, SMALL_CENTER);

  // Date & transaction ID
  const date = new Date(transaction.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  await print(date, SMALL_CENTER);
  await print(`TXN #${String(transaction.id).padStart(6, '0')}`, SMALL_CENTER);
  await print(DIVIDER, SMALL_CENTER);

  // Items
  await print('Items', BOLD);
  for (const item of transaction.items) {
    const lineTotal = formatAmount(item.line_total, settings, usePrimary);
    const itemLine = `${item.product_name.substring(0, 20).padEnd(20)} x${
      item.quantity
    } ${lineTotal}`;
    await print(itemLine, NORMAL);
  }
  await print(DIVIDER, SMALL_CENTER);

  // Totals
  await print(
    `Subtotal:  ${formatAmount(
      transaction.total_amount,
      settings,
      usePrimary,
    )}`,
    NORMAL,
  );
  if (transaction.discount_amount > 0) {
    await print(
      `Discount:  -${formatAmount(
        transaction.discount_amount,
        settings,
        usePrimary,
      )}`,
      NORMAL,
    );
  }
  await print(
    `TOTAL:  ${formatAmount(transaction.grand_total, settings, usePrimary)}`,
    BOLD,
  );

  // Secondary currency reference (FR-CUR-07)
  if (
    transaction.exchange_rate_snapshot &&
    transaction.secondary_currency_code
  ) {
    const sec = Math.round(
      transaction.grand_total * transaction.exchange_rate_snapshot,
    );
    await print(
      `(${sec.toLocaleString()} ${transaction.secondary_currency_code})`,
      SMALL_CENTER,
    );
  }

  await print(DIVIDER, SMALL_CENTER);

  // Payment
  if (transaction.tendered_secondary > 0) {
    await print(
      `Paid (${transaction.primary_currency_code}):  ${
        settings.primary_currency_symbol
      }${transaction.tendered_primary.toFixed(2)}`,
      NORMAL,
    );
    await print(
      `Paid (${transaction.secondary_currency_code}):  ${Math.round(
        transaction.tendered_secondary,
      ).toLocaleString()} ${settings.secondary_currency_symbol}`,
      NORMAL,
    );
  } else {
    await print(
      `Tendered:  ${formatAmount(
        transaction.amount_tendered,
        settings,
        usePrimary,
      )}`,
      NORMAL,
    );
  }
  await print(
    `Change:  ${formatAmount(transaction.change_due, settings, usePrimary)}`,
    NORMAL,
  );

  // Rate note
  if (
    transaction.exchange_rate_snapshot &&
    transaction.secondary_currency_code
  ) {
    await print(
      `Rate: 1 ${
        transaction.primary_currency_code
      } = ${transaction.exchange_rate_snapshot.toLocaleString()} ${
        transaction.secondary_currency_code
      }`,
      SMALL_CENTER,
    );
  }

  await print(DIVIDER, SMALL_CENTER);

  // Footer
  await print(settings.receipt_footer || 'Thank you for shopping!', CENTER);

  // Barcode
  await PrinterModule.printBarcode(
    `TXN${String(transaction.id).padStart(6, '0')}`,
    360,
    80,
  );

  // Feed paper at end
  await PrinterModule.paperOut(180);
};

// ─── Print product barcode label (FR-PRD-07, FR-PRT-04) ──────────────────────

export const printProductLabel = async (
  productName: string,
  barcode: string,
): Promise<void> => {
  if (!PrinterModule) {
    throw new Error('PrinterModule not available');
  }
  await PrinterModule.printText(productName, CENTER_BOLD);
  await PrinterModule.printBarcode(barcode, 360, 80);
  await PrinterModule.paperOut(40);
};
