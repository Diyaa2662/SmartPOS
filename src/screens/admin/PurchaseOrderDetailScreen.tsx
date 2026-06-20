/* eslint-disable react-native/no-inline-styles */
// src/screens/admin/PurchaseOrderDetailScreen.tsx
// SmartPOS - Purchase Order Detail Screen (read-only)
// Based on SRS Section 3.7 (FR-PO-06) and Section 8

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import { getPurchaseOrderById } from '../../database/purchaseOrderDAO';
import { getAllSettings } from '../../database/settingsDAO';
import { PurchaseOrderWithItems, AppSettings } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<
    AdminStackParamList,
    'PurchaseOrderDetail'
  >;
  route: RouteProp<AdminStackParamList, 'PurchaseOrderDetail'>;
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

// ─── Component ────────────────────────────────────────────────────────────────

const PurchaseOrderDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { purchaseOrderId } = route.params;
  const [po, setPo] = useState<PurchaseOrderWithItems | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, appSettings] = await Promise.all([
          getPurchaseOrderById(purchaseOrderId),
          getAllSettings(),
        ]);
        setPo(data);
        setSettings(appSettings);
      } catch (e) {
        console.error('PurchaseOrderDetail load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [purchaseOrderId]);

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const symbol = settings?.primary_currency_symbol ?? '$';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Purchase Order Detail</Text>
        {/* Read-only badge (FR-PO-06) */}
        <View style={styles.readonlyBadge}>
          <Text style={styles.readonlyText}>Read-only</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !po ? (
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>Purchase order not found.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          {/* Order Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order info</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>PO number</Text>
              <Text style={styles.infoValue}>{po.po_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {formatDateTime(po.created_at)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Supplier note</Text>
              <Text style={styles.infoValue}>{po.supplier_note ?? '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Items received</Text>
              <Text style={styles.infoValue}>{po.items.length} items</Text>
            </View>
          </View>

          {/* Items table */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Items</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Product</Text>
              <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.colPrice]}>
                Unit cost
              </Text>
              <Text style={[styles.tableHeaderText, styles.colCost]}>
                Line cost
              </Text>
            </View>
            {po.items.map(item => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.tableCellName, { flex: 1 }]}>
                  {item.product_name}
                </Text>
                <Text style={[styles.tableCell, styles.colQty]}>
                  {item.quantity}
                </Text>
                <Text style={[styles.tableCell, styles.colPrice]}>
                  {symbol}
                  {item.purchase_price.toFixed(2)}
                </Text>
                <Text style={[styles.tableCellCost, styles.colCost]}>
                  {symbol}
                  {item.line_cost.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total cost</Text>
            <Text style={styles.totalValue}>
              {symbol}
              {po.total_cost.toFixed(2)}
            </Text>
          </View>
        </ScrollView>
      )}
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
  topbarTitle: { color: '#fff', fontSize: 15, fontWeight: '500', flex: 1 },
  readonlyBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  readonlyText: { color: '#fff', fontSize: 10 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
  scroll: { flex: 1, padding: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F5F5F5',
  },
  infoLabel: { fontSize: 11, color: COLORS.textMuted },
  infoValue: { fontSize: 11, fontWeight: '500', color: COLORS.text },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: { fontSize: 9, color: COLORS.textMuted, fontWeight: '500' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F5F5F5',
    alignItems: 'center',
  },
  tableCellName: { fontSize: 10, color: COLORS.text },
  tableCell: { fontSize: 10, color: '#555' },
  tableCellCost: { fontSize: 10, fontWeight: '500', color: COLORS.primary },
  colQty: { width: 36, textAlign: 'center' },
  colPrice: { width: 60, textAlign: 'right' },
  colCost: { width: 60, textAlign: 'right' },
  totalRow: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  totalLabel: { fontSize: 12, color: COLORS.textSecondary },
  totalValue: { fontSize: 16, fontWeight: '500', color: COLORS.primary },
});

export default PurchaseOrderDetailScreen;
