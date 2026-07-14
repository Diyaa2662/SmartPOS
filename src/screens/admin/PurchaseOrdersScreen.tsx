// src/screens/admin/PurchaseOrdersScreen.tsx
// SmartPOS - Purchase Orders History Screen
// Based on SRS Section 3.7 (FR-PO) and Section 8

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import { getAllPurchaseOrders } from '../../database/purchaseOrderDAO';
import { parseSqliteDateAsUtc } from '../../utils/dateTime';
import { PurchaseOrder, AppSettings } from '../../types';
import { getAllSettings } from '../../database/settingsDAO';
import { useTranslation } from '../../i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'PurchaseOrders'>;
};

type POWithCount = PurchaseOrder & { item_count: number };

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

const PurchaseOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<POWithCount[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [data, appSettings] = await Promise.all([
        getAllPurchaseOrders(),
        getAllSettings(),
      ]);
      setOrders(data);
      setSettings(appSettings);
    } catch (e) {
      console.error('PurchaseOrders load error:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    return parseSqliteDateAsUtc(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderOrder = ({ item }: { item: POWithCount }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate('PurchaseOrderDetail', { purchaseOrderId: item.id })
      }
    >
      <Text style={styles.poNumber}>{item.po_number}</Text>
      <View style={styles.info}>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        {item.supplier_note ? (
          <Text style={styles.note}>
            {t('supplierNote')}: {item.supplier_note}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.itemCount}>
          {t('itemsReceived', { count: item.item_count })}
        </Text>
        <Text style={styles.cost}>
          {settings?.primary_currency_symbol ?? '$'}
          {item.total_cost.toFixed(2)}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topbarTitle}>{t('purchaseOrders')}</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('NewPurchaseOrder')}
        >
          <Text style={styles.newBtnText}>{t('newPO')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.id.toString()}
        renderItem={renderOrder}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('noPurchaseOrdersYet')}</Text>
        }
        contentContainerStyle={styles.listContent}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtn: { color: '#fff', fontSize: 28, lineHeight: 32 },
  topbarTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  newBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newBtnText: { color: '#fff', fontSize: 12 },
  listContent: { padding: 12 },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 40,
  },
  row: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    marginBottom: 8,
    gap: 10,
  },
  poNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.primary,
    width: 80,
  },
  info: { flex: 1 },
  date: { fontSize: 11, color: COLORS.textMuted },
  note: { fontSize: 10, color: '#BBB', marginTop: 1 },
  right: { alignItems: 'flex-end' },
  itemCount: { fontSize: 10, color: COLORS.textMuted },
  cost: { fontSize: 13, fontWeight: '500', color: COLORS.text, marginTop: 2 },
  chevron: { fontSize: 18, color: '#BBB', marginLeft: 4 },
});

export default PurchaseOrdersScreen;
