/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-native/no-inline-styles */
// src/screens/shared/ReceiptPreviewScreen.tsx
// SmartPOS - Receipt Preview Screen
// Based on SRS Section 3.4 (FR-PRT) and Section 8
// Accessible by both Admin and Cashier roles
// Print-currency toggle added per client request: lets the user choose to
// display/print the receipt in the primary or secondary currency, converted
// using the exchange_rate_snapshot stored on that specific transaction
// (FR-CUR-07) — never the current live rate.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import {
  AdminStackParamList,
  CashierStackParamList,
} from '../../navigation/AppNavigator';
import {
  getTransactionById,
  getRecentTransactions,
} from '../../database/transactionDAO';
import { getAllSettings } from '../../database/settingsDAO';
import { parseSqliteDateAsUtc } from '../../utils/dateTime';
import { Transaction, TransactionWithItems, AppSettings } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<
    AdminStackParamList | CashierStackParamList,
    'ReceiptPreview'
  >;
  route: RouteProp<
    AdminStackParamList | CashierStackParamList,
    'ReceiptPreview'
  >;
};

type PrintCurrency = 'primary' | 'secondary';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#1A56A0',
  background: '#F7F8FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#555555',
  textMuted: '#AAAAAA',
  border: '#E5E5E5',
  deleteRed: '#E24B4A',
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReceiptPreviewScreen: React.FC<Props> = ({ navigation, route }) => {
  const transactionId = (route.params as { transactionId?: number } | undefined)
    ?.transactionId;

  const [receipt, setReceipt] = useState<TransactionWithItems | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [printCurrency, setPrintCurrency] = useState<PrintCurrency>('primary');

  const loadData = useCallback(async () => {
    try {
      const [appSettings, recents] = await Promise.all([
        getAllSettings(),
        getRecentTransactions(10),
      ]);
      setSettings(appSettings);
      setHistory(recents);

      // FR-PRT-03 — show specific receipt, or the most recent one by default
      const targetId = transactionId ?? recents[0]?.id;
      if (targetId) {
        const tx = await getTransactionById(targetId);
        setReceipt(tx);
        setPrintCurrency('primary');
      }
    } catch (e) {
      console.error('ReceiptPreview load error:', e);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (e.data.action.type === 'GO_BACK') {
        e.preventDefault();
        navigation.navigate('Sales' as any, { clearCart: true });
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handleReprint = async (transactionId?: number) => {
    if (!settings) return;

    try {
      const { printReceipt } = await import('../../utils/printerService');
      const targetReceipt = transactionId
        ? await getTransactionById(transactionId)
        : receipt;
      if (!targetReceipt) return;
      await printReceipt(targetReceipt, settings, printCurrency === 'primary');
    } catch (e) {
      Alert.alert(
        'Print Error',
        'Could not print receipt. Make sure printer is ready.',
      );
    }
  };

  const handleSelectHistory = async (id: number) => {
    setLoading(true);
    try {
      const tx = await getTransactionById(id);
      setReceipt(tx);
      setPrintCurrency('primary');
    } catch (e) {
      console.error('Load receipt error:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return parseSqliteDateAsUtc(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Converts a primary-currency amount on THIS receipt using its own
  // exchange_rate_snapshot — never the current live rate (FR-CUR-07).
  const convert = (amount: number): number => {
    if (printCurrency === 'primary' || !receipt?.exchange_rate_snapshot)
      return amount;
    return amount * receipt.exchange_rate_snapshot;
  };

  const canPrintSecondary =
    !!receipt?.secondary_currency_code && !!receipt?.exchange_rate_snapshot;
  const symbol =
    printCurrency === 'primary'
      ? settings?.primary_currency_symbol ?? '$'
      : settings?.secondary_currency_symbol ?? '';
  const currencyCode =
    printCurrency === 'primary'
      ? receipt?.primary_currency_code
      : receipt?.secondary_currency_code;

  if (loading && !receipt) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topbarTitle}>Receipt Preview</Text>
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('Sales' as any, { clearCart: true })
          }
        >
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Receipt Preview</Text>
      </View>

      <ScrollView style={styles.scroll}>
        {!receipt ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No receipts yet.</Text>
          </View>
        ) : (
          <>
            {/* Print currency toggle — client-requested addition */}
            {canPrintSecondary && (
              <View style={styles.card}>
                <Text style={styles.toggleLabel}>Print currency</Text>
                <View style={styles.currencyToggle}>
                  <TouchableOpacity
                    style={[
                      styles.currencyOption,
                      printCurrency === 'primary' &&
                        styles.currencyOptionActive,
                    ]}
                    onPress={() => setPrintCurrency('primary')}
                  >
                    <Text
                      style={[
                        styles.currencyOptionText,
                        printCurrency === 'primary' &&
                          styles.currencyOptionTextActive,
                      ]}
                    >
                      {receipt.primary_currency_code}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currencyOption,
                      printCurrency === 'secondary' &&
                        styles.currencyOptionActive,
                    ]}
                    onPress={() => setPrintCurrency('secondary')}
                  >
                    <Text
                      style={[
                        styles.currencyOptionText,
                        printCurrency === 'secondary' &&
                          styles.currencyOptionTextActive,
                      ]}
                    >
                      {receipt.secondary_currency_code}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Receipt paper (FR-PRT-02, FR-PRT-05) */}
            <View style={styles.receipt}>
              <Text style={styles.rStore}>
                {settings?.store_name ?? 'My Store'}
              </Text>
              <View style={styles.rDivider} />
              <Text style={styles.rMeta}>
                {formatDateTime(receipt.created_at)}
                {'\n'}
                Transaction #TXN-{String(receipt.id).padStart(6, '0')}
                {printCurrency === 'secondary'
                  ? `\nPrinted in ${currencyCode}`
                  : ''}
              </Text>
              <View style={styles.rDivider} />

              <Text style={styles.rSectionTitle}>Items</Text>
              {receipt.items.map(item => (
                <View key={item.id} style={styles.rItem}>
                  <Text style={styles.rItemName} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text style={styles.rItemQty}>x{item.quantity}</Text>
                  <Text style={styles.rItemTotal}>
                    {symbol}
                    {convert(item.line_total).toFixed(2)}
                  </Text>
                </View>
              ))}

              <View style={styles.rDivider} />
              <View style={styles.rTotalRow}>
                <Text style={styles.rLabel}>Subtotal</Text>
                <Text style={styles.rValue}>
                  {symbol}
                  {convert(receipt.total_amount).toFixed(2)}
                </Text>
              </View>
              {receipt.discount_amount > 0 && (
                <View style={styles.rTotalRow}>
                  <Text style={styles.rLabel}>Discount</Text>
                  <Text style={styles.rDiscount}>
                    -{symbol}
                    {convert(receipt.discount_amount).toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.rTotalRow}>
                <Text style={styles.rGrandLabel}>Total</Text>
                <Text style={styles.rGrandValue}>
                  {symbol}
                  {convert(receipt.grand_total).toFixed(2)}
                </Text>
              </View>
              {/* Always show the other currency as a secondary reference line,
                  using the snapshot rate (FR-CUR-07) */}
              {receipt.secondary_currency_code &&
              receipt.exchange_rate_snapshot ? (
                <Text style={styles.rSecondary}>
                  {printCurrency === 'primary'
                    ? `${(
                        receipt.grand_total * receipt.exchange_rate_snapshot
                      ).toLocaleString()} ${receipt.secondary_currency_code}`
                    : `${
                        settings?.primary_currency_symbol ?? '$'
                      }${receipt.grand_total.toFixed(2)} ${
                        receipt.primary_currency_code
                      }`}
                </Text>
              ) : null}

              <View style={styles.rDivider} />
              {/* Tendered breakdown — shows mixed-currency payment if applicable */}
              {receipt.tendered_secondary > 0 ? (
                <>
                  <View style={styles.rTotalRow}>
                    <Text style={styles.rLabel}>
                      Paid in {receipt.primary_currency_code}
                    </Text>
                    <Text style={styles.rValue}>
                      {settings?.primary_currency_symbol ?? '$'}
                      {receipt.tendered_primary.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.rTotalRow}>
                    <Text style={styles.rLabel}>
                      Paid in {receipt.secondary_currency_code}
                    </Text>
                    <Text style={styles.rValue}>
                      {settings?.secondary_currency_symbol ?? ''}
                      {receipt.tendered_secondary.toFixed(2)}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.rTotalRow}>
                  <Text style={styles.rLabel}>Tendered</Text>
                  <Text style={styles.rValue}>
                    {symbol}
                    {convert(receipt.amount_tendered).toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.rTotalRow}>
                <Text style={styles.rLabel}>Change</Text>
                <Text style={styles.rValue}>
                  {symbol}
                  {convert(receipt.change_due).toFixed(2)}
                </Text>
              </View>

              <View style={styles.rDivider} />
              <Text style={styles.rFooter}>
                {settings?.receipt_footer || 'Thank you for shopping!'}
                {receipt.secondary_currency_code &&
                receipt.exchange_rate_snapshot
                  ? `\nRate: 1 ${
                      receipt.primary_currency_code
                    } = ${receipt.exchange_rate_snapshot.toLocaleString()} ${
                      receipt.secondary_currency_code
                    }`
                  : ''}
              </Text>
            </View>

            {/* Reprint (FR-PRT-03) */}
            <TouchableOpacity
              style={styles.reprintBtn}
              onPress={() => handleReprint()}
            >
              <Text style={styles.reprintBtnText}>
                🖨️ Reprint receipt{' '}
                {canPrintSecondary ? `(${currencyCode})` : ''}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Past receipts (FR-PRT-03) */}
        {history.length > 0 && (
          <>
            <Text style={styles.historyLabel}>Past receipts</Text>
            <View style={styles.histCard}>
              {history.map(tx => (
                <TouchableOpacity
                  key={tx.id}
                  style={styles.histRow}
                  onPress={() => handleSelectHistory(tx.id)}
                >
                  <Text style={styles.histId}>
                    #TXN-{String(tx.id).padStart(3, '0')}
                  </Text>
                  <Text style={styles.histDate}>
                    {formatDateTime(tx.created_at)}
                  </Text>
                  <Text style={styles.histTotal}>
                    {settings?.primary_currency_symbol ?? '$'}
                    {tx.grand_total.toFixed(2)}
                  </Text>
                  <TouchableOpacity
                    style={styles.histPrint}
                    onPress={() => handleReprint(tx.id)}
                  >
                    <Text style={styles.histPrintIcon}>🖨️</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topbar: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtn: { color: '#fff', fontSize: 28, lineHeight: 32 },
  topbarTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, padding: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 12,
  },
  toggleLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 },
  currencyToggle: { flexDirection: 'row', gap: 8 },
  currencyOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  currencyOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  currencyOptionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  currencyOptionTextActive: { color: '#fff' },
  emptyText: { fontSize: 13, color: COLORS.textMuted },
  receipt: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  rStore: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  rDivider: {
    width: '100%',
    borderTopWidth: 0.5,
    borderTopColor: '#CCC',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  rMeta: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  rSectionTitle: {
    fontSize: 9,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  rItem: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rItemName: { fontSize: 11, color: COLORS.text, flex: 1 },
  rItemQty: { fontSize: 11, color: COLORS.textMuted, marginHorizontal: 8 },
  rItemTotal: { fontSize: 11, fontWeight: '500', color: COLORS.text },
  rTotalRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rLabel: { fontSize: 11, color: COLORS.textSecondary },
  rValue: { fontSize: 11, color: COLORS.textSecondary },
  rDiscount: { fontSize: 11, color: COLORS.deleteRed },
  rGrandLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  rGrandValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  rSecondary: { fontSize: 9, color: COLORS.textMuted, alignSelf: 'flex-end' },
  rFooter: {
    fontSize: 9,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 14,
  },
  reprintBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 16,
  },
  reprintBtnText: { fontSize: 12, fontWeight: '500', color: '#fff' },
  historyLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 6 },
  histCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  histId: { fontSize: 10, fontWeight: '500', color: COLORS.primary, width: 60 },
  histDate: { fontSize: 10, color: COLORS.textMuted, flex: 1 },
  histTotal: { fontSize: 11, fontWeight: '500', color: COLORS.text },
  histPrint: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histPrintIcon: { fontSize: 12 },
});

export default ReceiptPreviewScreen;
