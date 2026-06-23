/* eslint-disable react-native/no-inline-styles */
// src/screens/admin/ReportsScreen.tsx
// SmartPOS - Reports Screen
// Based on SRS Section 3.6 (FR-RPT) and Section 8
// Currency display toggle added per client request — uses each transaction's
// own exchange_rate_snapshot (FR-CUR-06) rather than the current live rate,
// so historical totals stay accurate regardless of rate changes since the sale.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import {
  getTransactionsByDateRange,
  getCategorySalesDetailed,
} from '../../database/transactionDAO';
import { getAllSettings } from '../../database/settingsDAO';
import { AppSettings, TransactionWithItems } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'Reports'>;
};

type DisplayCurrency = 'primary' | 'secondary';

type ReportSummary = {
  total_revenue: number;
  total_transactions: number;
  avg_transaction: number;
  total_discount: number;
};

type CategorySales = { category_name: string; total_revenue: number };
type TopProduct = {
  product_name: string;
  total_qty: number;
  total_revenue: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#1A56A0',
  background: '#F7F8FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#444444',
  textMuted: '#888888',
  border: '#E5E5E5',
};

const CATEGORY_COLORS = ['#1A56A0', '#BA7517', '#0F6E56', '#A0522D', '#7B2D8B'];

const formatDateInput = (d: Date) => d.toISOString().split('T')[0];

// Converts a primary-currency amount into the secondary currency using the
// exchange rate that was active AT THE TIME of that specific transaction
// (FR-CUR-06) — never the current live rate.
const toDisplayAmount = (
  amount: number,
  rateSnapshot: number | null,
  displayCurrency: DisplayCurrency,
): number => {
  if (displayCurrency === 'primary' || !rateSnapshot) return amount;
  return amount * rateSnapshot;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReportsScreen: React.FC<Props> = ({ navigation }) => {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(formatDateInput(weekAgo));
  const [endDate, setEndDate] = useState(formatDateInput(today));
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [displayCurrency, setDisplayCurrency] =
    useState<DisplayCurrency>('primary');

  const [transactions, setTransactions] = useState<TransactionWithItems[]>([]);
  const [categoryRows, setCategoryRows] = useState<
    {
      category_name: string;
      line_total: number;
      exchange_rate_snapshot: number | null;
    }[]
  >([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Validation', 'Please enter both start and end dates.');
      return;
    }
    setLoading(true);
    try {
      const [txData, catRows, appSettings] = await Promise.all([
        getTransactionsByDateRange(startDate, endDate),
        getCategorySalesDetailed(startDate, endDate),
        getAllSettings(),
      ]);
      setTransactions(txData);
      setCategoryRows(catRows);
      setSettings(appSettings);
      setHasGenerated(true);
    } catch (e) {
      console.error('Report generation error:', e);
      Alert.alert('Error', 'Could not generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    // FR-RPT-03 — placeholder until PDF export library is integrated
    Alert.alert(
      'Export PDF',
      'PDF export will be available once the PDF generation library is integrated.',
    );
  };

  const handlePrint = () => {
    // FR-RPT-04 — placeholder until thermal printer SDK is integrated (Section 7.2)
    Alert.alert(
      'Print',
      'Printing will be available once the printer SDK is integrated.',
    );
  };

  // ─── Derive summary / category / top-products from raw transactions,
  //     converting each transaction with ITS OWN rate snapshot (FR-CUR-06) ──

  const summary: ReportSummary = (() => {
    if (transactions.length === 0) {
      return {
        total_revenue: 0,
        total_transactions: 0,
        avg_transaction: 0,
        total_discount: 0,
      };
    }
    const total_revenue = transactions.reduce(
      (sum, t) =>
        sum +
        toDisplayAmount(
          t.grand_total,
          t.exchange_rate_snapshot,
          displayCurrency,
        ),
      0,
    );
    const total_discount = transactions.reduce(
      (sum, t) =>
        sum +
        toDisplayAmount(
          t.discount_amount,
          t.exchange_rate_snapshot,
          displayCurrency,
        ),
      0,
    );
    return {
      total_revenue,
      total_transactions: transactions.length,
      avg_transaction: total_revenue / transactions.length,
      total_discount,
    };
  })();

  const categorySales: CategorySales[] = (() => {
    const map = new Map<string, number>();
    for (const row of categoryRows) {
      const converted = toDisplayAmount(
        row.line_total,
        row.exchange_rate_snapshot,
        displayCurrency,
      );
      map.set(row.category_name, (map.get(row.category_name) ?? 0) + converted);
    }
    return Array.from(map.entries())
      .map(([category_name, total_revenue]) => ({
        category_name,
        total_revenue,
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue);
  })();

  const topProducts: TopProduct[] = (() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const t of transactions) {
      for (const item of t.items) {
        const existing = map.get(item.product_name) ?? { qty: 0, revenue: 0 };
        const converted = toDisplayAmount(
          item.line_total,
          t.exchange_rate_snapshot,
          displayCurrency,
        );
        map.set(item.product_name, {
          qty: existing.qty + item.quantity,
          revenue: existing.revenue + converted,
        });
      }
    }
    return Array.from(map.entries())
      .map(([product_name, v]) => ({
        product_name,
        total_qty: v.qty,
        total_revenue: v.revenue,
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10);
  })();

  const symbol =
    displayCurrency === 'primary'
      ? settings?.primary_currency_symbol ?? '$'
      : settings?.secondary_currency_symbol ?? '';
  const maxCategoryRevenue = Math.max(
    ...categorySales.map(c => c.total_revenue),
    1,
  );
  const canShowSecondary = !!settings?.secondary_currency_code;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Reports</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Date range (FR-RPT-01) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Date range</Text>
          <View style={styles.row2}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Start date</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>End date</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.genBtn}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.genBtnText}>📊 Generate report</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Currency display toggle — client-requested addition */}
        {hasGenerated && canShowSecondary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Display currency</Text>
            <View style={styles.currencyToggle}>
              <TouchableOpacity
                style={[
                  styles.currencyOption,
                  displayCurrency === 'primary' && styles.currencyOptionActive,
                ]}
                onPress={() => setDisplayCurrency('primary')}
              >
                <Text
                  style={[
                    styles.currencyOptionText,
                    displayCurrency === 'primary' &&
                      styles.currencyOptionTextActive,
                  ]}
                >
                  {settings?.primary_currency_code}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.currencyOption,
                  displayCurrency === 'secondary' &&
                    styles.currencyOptionActive,
                ]}
                onPress={() => setDisplayCurrency('secondary')}
              >
                <Text
                  style={[
                    styles.currencyOptionText,
                    displayCurrency === 'secondary' &&
                      styles.currencyOptionTextActive,
                  ]}
                >
                  {settings?.secondary_currency_code}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.currencyNote}>
              Each sale is converted using the exchange rate active at the time
              of that sale.
            </Text>
          </View>
        )}

        {hasGenerated && (
          <>
            {summary.total_transactions === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>
                  No sales found for this period.
                </Text>
              </View>
            ) : (
              <>
                {/* Summary KPIs (FR-RPT-02) */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Summary</Text>
                  <View style={styles.kpiGrid}>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>Total revenue</Text>
                      <Text style={styles.kpiValue}>
                        {symbol}
                        {summary.total_revenue.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>Transactions</Text>
                      <Text style={styles.kpiValue}>
                        {summary.total_transactions}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>Avg. transaction</Text>
                      <Text style={styles.kpiValue}>
                        {symbol}
                        {summary.avg_transaction.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>Total discount</Text>
                      <Text style={styles.kpiValue}>
                        {symbol}
                        {summary.total_discount.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Sales by category (FR-RPT-02) */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Sales by category</Text>
                  {categorySales.length === 0 ? (
                    <Text style={styles.emptyTextSmall}>No category data</Text>
                  ) : (
                    categorySales.map((cat, i) => (
                      <View key={cat.category_name} style={styles.catRow}>
                        <View
                          style={[
                            styles.catDot,
                            {
                              backgroundColor:
                                CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                            },
                          ]}
                        />
                        <Text style={styles.catName}>{cat.category_name}</Text>
                        <View style={styles.catBarWrap}>
                          <View
                            style={[
                              styles.catBar,
                              {
                                width: `${
                                  (cat.total_revenue / maxCategoryRevenue) * 100
                                }%`,
                                backgroundColor:
                                  CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.catVal}>
                          {symbol}
                          {cat.total_revenue.toFixed(2)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Top products (FR-RPT-02) */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Top products</Text>
                  <View style={styles.tblHeader}>
                    <Text style={[styles.tblHeaderText, { flex: 1 }]}>
                      Product
                    </Text>
                    <Text style={[styles.tblHeaderText, styles.colQty]}>
                      Qty
                    </Text>
                    <Text style={[styles.tblHeaderText, styles.colRev]}>
                      Revenue
                    </Text>
                  </View>
                  {topProducts.map(p => (
                    <View key={p.product_name} style={styles.tblRow}>
                      <Text style={[styles.tblName, { flex: 1 }]}>
                        {p.product_name}
                      </Text>
                      <Text style={[styles.tblCell, styles.colQty]}>
                        {p.total_qty}
                      </Text>
                      <Text style={[styles.tblRev, styles.colRev]}>
                        {symbol}
                        {p.total_revenue.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Export / Print (FR-RPT-03, FR-RPT-04) */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={handleExportPDF}
                  >
                    <Text style={styles.exportBtnText}>📄 Export PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.printBtn}
                    onPress={handlePrint}
                  >
                    <Text style={styles.printBtnText}>🖨️ Print report</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
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
  scroll: { flex: 1, padding: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row2: { flexDirection: 'row', gap: 8 },
  field: { gap: 4 },
  label: { fontSize: 11, color: COLORS.textSecondary },
  input: {
    backgroundColor: '#F3F4F6',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.text,
  },
  genBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  genBtnText: { fontSize: 12, fontWeight: '500', color: '#fff' },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 10,
  },
  emptyTextSmall: { fontSize: 11, color: COLORS.textMuted },
  currencyToggle: { flexDirection: 'row', gap: 8 },
  currencyOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
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
  currencyNote: { fontSize: 9, color: COLORS.textMuted },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kpi: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 8,
  },
  kpiLabel: { fontSize: 9, color: COLORS.textMuted, marginBottom: 3 },
  kpiValue: { fontSize: 14, fontWeight: '500', color: COLORS.primary },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontSize: 10, color: COLORS.textSecondary, width: 64 },
  catBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catBar: { height: '100%', borderRadius: 3 },
  catVal: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.text,
    width: 56,
    textAlign: 'right',
  },
  tblHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tblHeaderText: { fontSize: 9, color: COLORS.textMuted, fontWeight: '500' },
  tblRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F5F5F5',
    alignItems: 'center',
  },
  tblName: { fontSize: 10, color: COLORS.text },
  tblCell: { fontSize: 10, color: '#888' },
  tblRev: { fontSize: 10, fontWeight: '500', color: COLORS.primary },
  colQty: { width: 40, textAlign: 'center' },
  colRev: { width: 64, textAlign: 'right' },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  exportBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  exportBtnText: { fontSize: 11, color: COLORS.primary },
  printBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 11,
    alignItems: 'center',
  },
  printBtnText: { fontSize: 11, fontWeight: '500', color: '#fff' },
});

export default ReportsScreen;
