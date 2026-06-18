// src/screens/admin/DashboardScreen.tsx
// SmartPOS - Dashboard Screen
// Based on SRS Section 3.5 (FR-DAS) and Section 8

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import { getTodaySummary, getWeeklySales } from '../../database/transactionDAO';
import { getAllSettings } from '../../database/settingsDAO';
import { AppSettings } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'Dashboard'>;
  onLogout: () => void;
};

type TodaySummary = {
  total_sales: number;
  transaction_count: number;
  best_selling_product: string | null;
  best_selling_qty: number;
};

type WeekDay = {
  date: string;
  total: number;
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
  rateBg: '#E8F0FB',
  rateBorder: '#CCDDEE',
  barInactive: '#B5D4F4',
  green: '#0F6E56',
  gold: '#BA7517',
};

const QUICK_ACCESS = [
  { label: 'Products', icon: '📦', screen: 'ProductList' },
  { label: 'Categories', icon: '🗂️', screen: 'CategoryManager' },
  { label: 'New Sale', icon: '🛒', screen: 'Sales' },
  { label: 'Purchase Orders', icon: '🚚', screen: 'PurchaseOrders' },
  { label: 'Reports', icon: '📊', screen: 'Reports' },
  { label: 'Settings', icon: '⚙️', screen: 'Settings' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const DashboardScreen: React.FC<Props> = ({ navigation, onLogout }) => {
  const [summary, setSummary] = useState<TodaySummary>({
    total_sales: 0,
    transaction_count: 0,
    best_selling_product: null,
    best_selling_qty: 0,
  });
  const [weeklySales, setWeeklySales] = useState<WeekDay[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    try {
      const s = getTodaySummary();
      const w = getWeeklySales();
      const appSettings = getAllSettings();
      setSummary(s);
      setWeeklySales(w);
      setSettings(appSettings);
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const maxSales = Math.max(...weeklySales.map(d => d.total), 1);
  const today = new Date().toISOString().split('T')[0];

  const formatCurrency = (amount: number) => {
    if (!settings) return `$${amount.toFixed(2)}`;
    return `${settings.primary_currency_symbol}${amount.toFixed(2)}`;
  };

  const formatSecondaryCurrency = (amount: number) => {
    if (!settings || !settings.secondary_currency_code) return '';
    const converted = amount * settings.exchange_rate;
    return `${converted.toLocaleString()} ${
      settings.secondary_currency_symbol
    }`;
  };

  const getDayLabel = (dateStr: string) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(dateStr).getDay()];
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topbarTitle}>Dashboard</Text>
          <Text style={styles.topbarSub}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.topbarIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.topbarIcon}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout}>
            <Text style={styles.topbarIcon}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Exchange Rate Bar (FR-CUR-08) */}
      {settings?.secondary_currency_code ? (
        <View style={styles.rateBar}>
          <Text style={styles.rateText}>
            💱 Rate: 1 {settings.primary_currency_code} ={' '}
            {settings.exchange_rate.toLocaleString()}{' '}
            {settings.secondary_currency_code} — last updated{' '}
            {settings.exchange_rate_updated_at
              ? new Date(settings.exchange_rate_updated_at).toLocaleDateString()
              : '—'}
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* KPI Cards (FR-DAS-01) */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiIcon}>💰</Text>
            <Text style={styles.kpiLabel}>Sales today</Text>
            <Text style={styles.kpiValue}>
              {formatCurrency(summary.total_sales)}
            </Text>
            {settings?.secondary_currency_code ? (
              <Text style={styles.kpiSub}>
                {formatSecondaryCurrency(summary.total_sales)}
              </Text>
            ) : null}
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiIcon}>🧾</Text>
            <Text style={styles.kpiLabel}>Transactions</Text>
            <Text style={styles.kpiValue}>{summary.transaction_count}</Text>
            <Text style={styles.kpiSub}>today</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiIcon}>🏆</Text>
            <Text style={styles.kpiLabel}>Best seller</Text>
            <Text
              style={[styles.kpiValue, styles.kpiBestName]}
              numberOfLines={2}
            >
              {summary.best_selling_product ?? '—'}
            </Text>
            {summary.best_selling_qty > 0 && (
              <Text style={styles.kpiSub}>
                x{summary.best_selling_qty} units
              </Text>
            )}
          </View>
        </View>

        {/* Weekly Chart (FR-DAS-02) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sales this week</Text>
          {weeklySales.length === 0 ? (
            <Text style={styles.emptyText}>No sales data yet</Text>
          ) : (
            <View style={styles.chartArea}>
              {weeklySales.map(day => (
                <View key={day.date} style={styles.barWrap}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(4, (day.total / maxSales) * 80),
                        backgroundColor:
                          day.date === today
                            ? COLORS.primary
                            : COLORS.barInactive,
                      },
                    ]}
                  />
                  <Text style={styles.barLabel}>{getDayLabel(day.date)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quick Access (FR-DAS links to all modules) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick access</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACCESS.map(item => (
              <TouchableOpacity
                key={item.screen}
                style={styles.quickBtn}
                onPress={() => navigation.navigate(item.screen as any)}
              >
                <Text style={styles.quickIcon}>{item.icon}</Text>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // Topbar
  topbar: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topbarTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  topbarSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  topbarIcons: { flexDirection: 'row', gap: 14 },
  topbarIcon: { fontSize: 18 },
  // Rate bar
  rateBar: {
    backgroundColor: COLORS.rateBg,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.rateBorder,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  rateText: { fontSize: 11, color: COLORS.primary },
  // Scroll
  scroll: { flex: 1, padding: 12 },
  // KPI
  kpiGrid: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 10,
  },
  kpiIcon: { fontSize: 14, marginBottom: 4 },
  kpiLabel: { fontSize: 9, color: COLORS.textMuted, marginBottom: 3 },
  kpiValue: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  kpiBestName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
    lineHeight: 16,
  },
  kpiSub: { fontSize: 9, color: COLORS.textMuted, marginTop: 2 },
  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  // Chart
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 4,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bar: { width: '100%', borderRadius: 3 },
  barLabel: { fontSize: 9, color: COLORS.textMuted },
  // Quick access
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickBtn: {
    width: '31%',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  quickIcon: { fontSize: 20 },
  quickLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default DashboardScreen;
