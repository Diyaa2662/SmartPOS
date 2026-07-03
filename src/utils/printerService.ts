// src/utils/printerService.ts
// SmartPOS - Printer Service Utility
// Wraps react-native-nyx-printer for receipt and label printing
// Hardware: POS-T8 built-in 80mm thermal printer via net.nyx.printerservice v1.8.7

import {
  printText,
  printBarcode,
  NyxTextFormat,
} from 'react-native-nyx-printer';
import { TransactionWithItems, AppSettings } from '../types';

// ─── Text format helpers ──────────────────────────────────────────────────────

const normalFormat = () => {
  const f = new NyxTextFormat();
  f.textSize = 24;
  return f;
};

const boldFormat = () => {
  const f = new NyxTextFormat();
  f.textSize = 26;
  f.style = (f as any).style?.constructor ? (f as any).style : 1; // NyxFontStyle.bold = 1
  return f;
};

const centerFormat = (size = 24) => {
  const f = new NyxTextFormat();
  f.textSize = size;
  f.align = 1 as any; // NyxAlign.center = 1
  return f;
};

const centerBoldFormat = (size = 28) => {
  const f = new NyxTextFormat();
  f.textSize = size;
  f.align = 1 as any;
  f.style = 1 as any; // bold
  return f;
};

const divider = () => '--------------------------------';

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
  return `${converted.toLocaleString()} ${settings.secondary_currency_symbol}`;
};

// ─── Print receipt (FR-PRT-01, FR-PRT-02, FR-PRT-05) ─────────────────────────

export const printReceipt = async (
  transaction: TransactionWithItems,
  settings: AppSettings,
  usePrimary: boolean = true,
): Promise<void> => {
  try {
    // Header
    await printText(settings.store_name ?? 'SmartPOS', centerBoldFormat(30));
    await printText(divider(), centerFormat(20));

    // Transaction info
    const date = new Date(transaction.created_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    await printText(date, centerFormat(22));
    await printText(
      `TXN #${String(transaction.id).padStart(6, '0')}`,
      centerFormat(22),
    );

    await printText(divider(), centerFormat(20));

    // Items
    await printText('Items', normalFormat());
    for (const item of transaction.items) {
      const lineTotal = formatAmount(item.line_total, settings, usePrimary);
      await printText(
        `${item.product_name}\n  x${item.quantity}  ${lineTotal}`,
        normalFormat(),
      );
    }

    await printText(divider(), centerFormat(20));

    // Totals
    await printText(
      `Subtotal:  ${formatAmount(
        transaction.total_amount,
        settings,
        usePrimary,
      )}`,
      normalFormat(),
    );

    if (transaction.discount_amount > 0) {
      await printText(
        `Discount:  -${formatAmount(
          transaction.discount_amount,
          settings,
          usePrimary,
        )}`,
        normalFormat(),
      );
    }

    await printText(
      `TOTAL:  ${formatAmount(transaction.grand_total, settings, usePrimary)}`,
      boldFormat(),
    );

    // Show secondary currency equivalent (FR-CUR-07)
    if (
      transaction.exchange_rate_snapshot &&
      transaction.secondary_currency_code
    ) {
      const secondaryTotal =
        transaction.grand_total * transaction.exchange_rate_snapshot;
      await printText(
        `(${secondaryTotal.toLocaleString()} ${
          transaction.secondary_currency_code
        })`,
        centerFormat(20),
      );
    }

    await printText(divider(), centerFormat(20));

    // Payment info
    if (transaction.tendered_secondary > 0) {
      // Mixed currency payment
      await printText(
        `Paid (${transaction.primary_currency_code}):  ${
          settings.primary_currency_symbol
        }${transaction.tendered_primary.toFixed(2)}`,
        normalFormat(),
      );
      await printText(
        `Paid (${
          transaction.secondary_currency_code
        }):  ${transaction.tendered_secondary.toLocaleString()} ${
          settings.secondary_currency_symbol
        }`,
        normalFormat(),
      );
    } else {
      await printText(
        `Tendered:  ${formatAmount(
          transaction.amount_tendered,
          settings,
          usePrimary,
        )}`,
        normalFormat(),
      );
    }

    await printText(
      `Change:  ${formatAmount(transaction.change_due, settings, usePrimary)}`,
      normalFormat(),
    );

    // Rate note
    if (
      transaction.exchange_rate_snapshot &&
      transaction.secondary_currency_code
    ) {
      await printText(
        `Rate: 1 ${
          transaction.primary_currency_code
        } = ${transaction.exchange_rate_snapshot.toLocaleString()} ${
          transaction.secondary_currency_code
        }`,
        centerFormat(20),
      );
    }

    await printText(divider(), centerFormat(20));

    // Footer
    await printText(
      settings.receipt_footer || 'Thank you for shopping!',
      centerFormat(24),
    );

    // Transaction barcode
    await printBarcode(
      `TXN${String(transaction.id).padStart(6, '0')}`,
      360,
      80,
    );
  } catch (error) {
    console.error('Print receipt error:', error);
    throw error;
  }
};

// ─── Print product barcode label (FR-PRD-07, FR-PRT-04) ──────────────────────

export const printProductLabel = async (
  productName: string,
  barcode: string,
): Promise<void> => {
  try {
    await printText(productName, centerBoldFormat(26));
    await printBarcode(barcode, 360, 80);
  } catch (error) {
    console.error('Print label error:', error);
    throw error;
  }
};
