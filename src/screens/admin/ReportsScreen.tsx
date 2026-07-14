/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react-native/no-inline-styles */
// src/screens/admin/ReportsScreen.tsx
// SmartPOS - Reports Screen
// Based on SRS Section 3.6 (FR-RPT) and Section 8
// Currency display toggle added per client request — uses each transaction's
// own exchange_rate_snapshot (FR-CUR-06) rather than the current live rate,
// so historical totals stay accurate regardless of rate changes since the sale.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import {
  getTransactionsByDateRange,
  getCategorySalesDetailed,
  getProductInventorySnapshot,
} from '../../database/transactionDAO';
import { getAllSettings } from '../../database/settingsDAO';
import { getAllProducts } from '../../database/productDAO';
import {
  AppSettings,
  ProductWithCategory,
  TransactionWithItems,
} from '../../types';
import { useTranslation } from '../../i18n';

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
  total_units_sold: number;
};

type InventorySnapshot = {
  current_total: number;
  beginning_total: number;
  change_total: number;
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

const parseDateInput = (dateString: string): Date => {
  const parsed = new Date(dateString + 'T00:00:00');
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const addDate = (
  date: Date,
  field: 'day' | 'month' | 'year',
  value: number,
) => {
  const next = new Date(date);
  if (field === 'day') next.setDate(next.getDate() + value);
  if (field === 'month') next.setMonth(next.getMonth() + value);
  if (field === 'year') next.setFullYear(next.getFullYear() + value);
  return next;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ReportsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(formatDateInput(weekAgo));
  const [endDate, setEndDate] = useState(formatDateInput(today));
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [displayCurrency, setDisplayCurrency] =
    useState<DisplayCurrency>('primary');
  const [editingDateField, setEditingDateField] = useState<
    'start' | 'end' | null
  >(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  const [transactions, setTransactions] = useState<TransactionWithItems[]>([]);
  const [categoryRows, setCategoryRows] = useState<
    {
      category_name: string;
      line_total: number;
      exchange_rate_snapshot: number | null;
    }[]
  >([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<ProductWithCategory[]>(
    [],
  );
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithCategory | null>(null);
  const [productSnapshot, setProductSnapshot] =
    useState<InventorySnapshot | null>(null);

  const handleProductSearchChange = async (text: string) => {
    setProductSearch(text);
    if (selectedProduct && text !== selectedProduct.name) {
      setSelectedProduct(null);
      setProductSnapshot(null);
    }
    if (text.trim().length < 1) {
      setProductResults([]);
      return;
    }

    try {
      const results = await getAllProducts(text);
      setProductResults(results.slice(0, 5));
    } catch (e) {
      console.error('Product search error:', e);
    }
  };

  const loadProductSnapshot = async (productId: number) => {
    if (!startDate) return;
    try {
      const snapshot = await getProductInventorySnapshot(productId, startDate);
      setProductSnapshot(snapshot);
    } catch (e) {
      console.error('Product snapshot error:', e);
    }
  };

  const handleSelectProduct = async (product: ProductWithCategory) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setProductResults([]);
    await loadProductSnapshot(product.id);
  };

  useEffect(() => {
    const refreshSnapshot = async () => {
      if (!selectedProduct || !startDate) return;
      try {
        const snapshot = await getProductInventorySnapshot(
          selectedProduct.id,
          startDate,
        );
        setProductSnapshot(snapshot);
      } catch (e) {
        console.error('Product snapshot reload error:', e);
      }
    };
    refreshSnapshot();
  }, [selectedProduct, startDate]);

  const setPresetRange = (range: 'day' | 'week' | 'month') => {
    const now = new Date();
    const end = formatDateInput(now);
    let start: string;
    if (range === 'day') {
      start = end;
    } else if (range === 'week') {
      const rangeStart = addDate(now, 'day', -6);
      start = formatDateInput(rangeStart);
    } else {
      const rangeStart = addDate(now, 'day', -29);
      start = formatDateInput(rangeStart);
    }
    setStartDate(start);
    setEndDate(end);
  };

  const openDatePicker = (field: 'start' | 'end') => {
    setPickerDate(parseDateInput(field === 'start' ? startDate : endDate));
    setEditingDateField(field);
  };

  const confirmDatePicker = () => {
    if (editingDateField === 'start') {
      setStartDate(formatDateInput(pickerDate));
    } else if (editingDateField === 'end') {
      setEndDate(formatDateInput(pickerDate));
    }
    setEditingDateField(null);
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      Alert.alert(t('validationRequired'), t('validationChooseBothDates'));
      return;
    }
    if (parseDateInput(startDate) > parseDateInput(endDate)) {
      Alert.alert(t('validationRequired'), t('validationStartBeforeEnd'));
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
      if (selectedProduct) {
        await loadProductSnapshot(selectedProduct.id);
      }
    } catch (e) {
      console.error('Report generation error:', e);
      Alert.alert(t('error'), t('somethingWentWrong'));
    } finally {
      setLoading(false);
    }
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
        total_units_sold: 0,
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
    const total_units_sold = transactions.reduce(
      (sum, t) =>
        sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    return {
      total_revenue,
      total_transactions: transactions.length,
      avg_transaction: total_revenue / transactions.length,
      total_discount,
      total_units_sold,
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
        <Text style={styles.topbarTitle}>{t('reports')}</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <Modal
          visible={editingDateField !== null}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingDateField === 'start'
                  ? t('selectStartDate')
                  : t('selectEndDate')}
              </Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setPickerDate(addDate(pickerDate, 'year', -1))}
                >
                  <Text style={styles.datePickerButtonText}>-</Text>
                </TouchableOpacity>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Year</Text>
                  <Text style={styles.datePickerValue}>
                    {pickerDate.getFullYear()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setPickerDate(addDate(pickerDate, 'year', 1))}
                >
                  <Text style={styles.datePickerButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() =>
                    setPickerDate(addDate(pickerDate, 'month', -1))
                  }
                >
                  <Text style={styles.datePickerButtonText}>-</Text>
                </TouchableOpacity>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Month</Text>
                  <Text style={styles.datePickerValue}>
                    {pickerDate.getMonth() + 1}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setPickerDate(addDate(pickerDate, 'month', 1))}
                >
                  <Text style={styles.datePickerButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setPickerDate(addDate(pickerDate, 'day', -1))}
                >
                  <Text style={styles.datePickerButtonText}>-</Text>
                </TouchableOpacity>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Day</Text>
                  <Text style={styles.datePickerValue}>
                    {pickerDate.getDate()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setPickerDate(addDate(pickerDate, 'day', 1))}
                >
                  <Text style={styles.datePickerButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalActionBtn}
                  onPress={() => setEditingDateField(null)}
                >
                  <Text style={styles.modalActionText}>{t('cancelText')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.modalActionPrimary]}
                  onPress={confirmDatePicker}
                >
                  <Text
                    style={[
                      styles.modalActionText,
                      styles.modalActionPrimaryText,
                    ]}
                  >
                    {t('setDate')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Date range (FR-RPT-01) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dateRange')}</Text>
          <View style={styles.rangeButtonsRow}>
            <TouchableOpacity
              style={styles.rangeButton}
              onPress={() => setPresetRange('day')}
            >
              <Text style={styles.rangeButtonText}>{t('day')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rangeButton}
              onPress={() => setPresetRange('week')}
            >
              <Text style={styles.rangeButtonText}>{t('week')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rangeButton}
              onPress={() => setPresetRange('month')}
            >
              <Text style={styles.rangeButtonText}>{t('month')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row2}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t('selectStartDate')}</Text>
              <TouchableOpacity
                style={styles.dateField}
                onPress={() => openDatePicker('start')}
              >
                <Text style={styles.dateFieldText}>{startDate}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>{t('selectEndDate')}</Text>
              <TouchableOpacity
                style={styles.dateField}
                onPress={() => openDatePicker('end')}
              >
                <Text style={styles.dateFieldText}>{endDate}</Text>
              </TouchableOpacity>
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
              <Text style={styles.genBtnText}>{t('generateReport')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('inventorySnapshot')}</Text>
          <Text style={styles.label}>{t('searchProduct')}</Text>
          <TextInput
            value={productSearch}
            onChangeText={handleProductSearchChange}
            placeholder={t('startTypingProductName')}
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
            autoCorrect={false}
            returnKeyType="search"
          />
          {productResults.length > 0 && (
            <View style={styles.searchResults}>
              {productResults.map(product => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectProduct(product)}
                >
                  <Text style={styles.searchResultText}>{product.name}</Text>
                  <Text style={styles.searchResultCategory}>
                    {product.category_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {selectedProduct && productSnapshot && (
            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotTitle}>{selectedProduct.name}</Text>
              <Text style={styles.snapshotLine}>
                {t('beginningQuantity', {
                  qty: productSnapshot.beginning_total,
                })}
              </Text>
              <Text style={styles.snapshotLine}>
                {t('currentQuantity', { qty: productSnapshot.current_total })}
              </Text>
              <Text style={styles.snapshotLine}>
                {t('changeQuantity', {
                  diff: productSnapshot.change_total >= 0 ? '+' : '',
                })}
                {productSnapshot.change_total}
              </Text>
            </View>
          )}
        </View>

        {/* Currency display toggle — client-requested addition */}
        {hasGenerated && canShowSecondary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('displayCurrency')}</Text>
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
            <Text style={styles.currencyNote}>{t('currencyNote')}</Text>
          </View>
        )}

        {hasGenerated && (
          <>
            {summary.total_transactions === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>{t('noSalesFound')}</Text>
              </View>
            ) : (
              <>
                {/* Summary KPIs (FR-RPT-02) */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t('summary')}</Text>
                  <View style={styles.kpiGrid}>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>{t('totalRevenue')}</Text>
                      <Text style={styles.kpiValue}>
                        {symbol}
                        {summary.total_revenue.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>{t('transactions')}</Text>
                      <Text style={styles.kpiValue}>
                        {summary.total_transactions}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>{t('avgTransaction')}</Text>
                      <Text style={styles.kpiValue}>
                        {symbol}
                        {summary.avg_transaction.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>{t('totalDiscount')}</Text>
                      <Text style={styles.kpiValue}>
                        {symbol}
                        {summary.total_discount.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.kpi}>
                      <Text style={styles.kpiLabel}>{t('unitsSold')}</Text>
                      <Text style={styles.kpiValue}>
                        {summary.total_units_sold}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Sales by category (FR-RPT-02) */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t('salesByCategory')}</Text>
                  {categorySales.length === 0 ? (
                    <Text style={styles.emptyTextSmall}>
                      {t('noCategoryData')}
                    </Text>
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
                  <Text style={styles.cardTitle}>{t('topProducts')}</Text>
                  <View style={styles.tblHeader}>
                    <Text style={[styles.tblHeaderText, { flex: 1 }]}>
                      {t('productHeader')}
                    </Text>
                    <Text style={[styles.tblHeaderText, styles.colQty]}>
                      {t('qtyHeader')}
                    </Text>
                    <Text style={[styles.tblHeaderText, styles.colRev]}>
                      {t('revenueHeader')}
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
  rangeButtonsRow: { flexDirection: 'row', gap: 8 },
  rangeButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  rangeButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  dateField: {
    backgroundColor: '#F3F4F6',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  dateFieldText: { fontSize: 12, color: COLORS.text },
  searchResults: {
    marginTop: 8,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  searchResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  searchResultText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  searchResultCategory: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  snapshotCard: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
  },
  snapshotTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  snapshotLine: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  datePickerColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  datePickerLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  datePickerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  datePickerButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  modalActionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  modalActionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalActionPrimary: {
    backgroundColor: COLORS.primary,
  },
  modalActionPrimaryText: {
    color: '#fff',
  },
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
});

export default ReportsScreen;
