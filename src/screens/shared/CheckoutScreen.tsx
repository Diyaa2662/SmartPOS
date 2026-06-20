/* eslint-disable react-native/no-inline-styles */
// src/screens/shared/CheckoutScreen.tsx
// SmartPOS - Checkout / Payment Screen
// Based on SRS Section 3.3 (FR-SAL) and Section 8
// Accessible by both Admin and Cashier roles

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import {
  AdminStackParamList,
  CashierStackParamList,
} from '../../navigation/AppNavigator';
import { saveTransaction } from '../../database/transactionDAO';
import { getAllSettings } from '../../database/settingsDAO';
import { CartItem, AppSettings } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<
    AdminStackParamList | CashierStackParamList,
    'Checkout'
  >;
  route: RouteProp<AdminStackParamList | CashierStackParamList, 'Checkout'>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#1A56A0',
  background: '#F7F8FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#555555',
  textMuted: '#AAAAAA',
  border: '#E0E0E0',
  deleteRed: '#E24B4A',
  green: '#0F6E56',
  greenBg: '#E8F5EE',
};

// ─── Component ────────────────────────────────────────────────────────────────

const CheckoutScreen: React.FC<Props> = ({ navigation, route }) => {
  const { cartItems, subtotal, discountAmount, grandTotal } = route.params as {
    cartItems: CartItem[];
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
  };

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [amountTendered, setAmountTendered] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllSettings().then(setSettings).catch(console.error);
  }, []);

  const symbol = settings?.primary_currency_symbol ?? '$';
  const tendered = parseFloat(amountTendered) || 0;
  const changeDue = tendered - grandTotal;

  const handleKeyPress = (key: string) => {
    if (key === '.' && amountTendered.includes('.')) return;
    setAmountTendered(prev => prev + key);
  };

  const handleDelete = () => {
    setAmountTendered(prev => prev.slice(0, -1));
  };

  const handleCancel = () => {
    // FR-SAL-12 — cancel before finalized
    navigation.goBack();
  };

  const handleConfirm = async () => {
    if (saving) return;

    if (tendered < grandTotal) {
      Alert.alert(
        'Insufficient amount',
        'Amount tendered is less than the total due.',
      );
      return;
    }

    setSaving(true);
    try {
      // FR-SAL-10 — save transaction with timestamp
      const transactionId = await saveTransaction(
        cartItems,
        subtotal,
        discountAmount,
        grandTotal,
        tendered,
        changeDue,
      );

      // FR-PRT-01 — auto-print receipt after sale completes
      // Printing integration pending hardware SDK (Section 7.2); navigate to preview for now
      navigation.replace('ReceiptPreview' as any, { transactionId });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not complete the sale.');
    } finally {
      setSaving(false);
    }
  };

  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Checkout</Text>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Order Summary (FR-SAL-04) */}
        <View style={styles.card}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderHeaderTitle}>Order summary</Text>
            <Text style={styles.orderHeaderCount}>
              {cartItems.length} items
            </Text>
          </View>
          {cartItems.map(item => (
            <View key={item.product.id} style={styles.orderItem}>
              <Text style={styles.oiName} numberOfLines={1}>
                {item.product.name}
              </Text>
              <Text style={styles.oiQty}>x{item.quantity}</Text>
              <Text style={styles.oiTotal}>
                {symbol}
                {item.line_total.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals (FR-SAL-07) */}
        <View style={styles.card}>
          <View style={styles.tRow}>
            <Text style={styles.tLabel}>Subtotal</Text>
            <Text style={styles.tValue}>
              {symbol}
              {subtotal.toFixed(2)}
            </Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.tRow}>
              <Text style={styles.tLabel}>Discount</Text>
              <Text style={styles.tDiscount}>
                -{symbol}
                {discountAmount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.tRow}>
            <Text style={styles.tGrandLabel}>Grand total</Text>
            <Text style={styles.tGrandValue}>
              {symbol}
              {grandTotal.toFixed(2)}
            </Text>
          </View>
          {settings?.secondary_currency_code ? (
            <Text style={styles.tSecondary}>
              {(grandTotal * settings.exchange_rate).toLocaleString()}{' '}
              {settings.secondary_currency_symbol}
            </Text>
          ) : null}
        </View>

        {/* Amount tendered / Change (FR-SAL-09) */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Amount tendered</Text>
          <View style={styles.inputBox}>
            <Text style={styles.inputVal}>
              {symbol}
              {amountTendered || '0'}
            </Text>
            <Text style={styles.inputCurrency}>
              {settings?.primary_currency_code ?? 'USD'}
            </Text>
          </View>
          <View style={styles.changeBox}>
            <Text style={styles.changeLabel}>💰 Change due</Text>
            <Text style={styles.changeVal}>
              {symbol}
              {Math.max(0, changeDue).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Numpad */}
        <View style={styles.numpad}>
          {numpadKeys.map(key => (
            <TouchableOpacity
              key={key}
              style={styles.key}
              onPress={() => handleKeyPress(key)}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.key}
            onPress={() => handleKeyPress('.')}
          >
            <Text style={styles.keyText}>.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.key}
            onPress={() => handleKeyPress('0')}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.key, styles.keyDelete]}
            onPress={handleDelete}
          >
            <Text style={styles.keyDeleteText}>⌫</Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>✕ Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={saving}
          >
            <Text style={styles.confirmBtnText}>
              {saving ? 'Saving...' : '✓ Confirm sale & print'}
            </Text>
          </TouchableOpacity>
        </View>

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
  scroll: { flex: 1, padding: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#E5E5E5',
    padding: 12,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEE',
  },
  orderHeaderTitle: { fontSize: 12, fontWeight: '500', color: COLORS.text },
  orderHeaderCount: { fontSize: 11, color: COLORS.primary },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F5F5F5',
  },
  oiName: { fontSize: 11, color: '#333', flex: 1 },
  oiQty: { fontSize: 11, color: '#888', marginHorizontal: 8 },
  oiTotal: { fontSize: 11, fontWeight: '500', color: COLORS.text },
  tRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  tLabel: { fontSize: 12, color: COLORS.textSecondary },
  tValue: { fontSize: 12, color: COLORS.textSecondary },
  tDiscount: { fontSize: 12, color: COLORS.deleteRed },
  divider: { height: 0.5, backgroundColor: '#EEE', marginVertical: 4 },
  tGrandLabel: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  tGrandValue: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  tSecondary: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  inputLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 },
  inputBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputVal: { fontSize: 18, fontWeight: '500', color: COLORS.text },
  inputCurrency: { fontSize: 11, color: COLORS.textMuted },
  changeBox: {
    backgroundColor: COLORS.greenBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeLabel: { fontSize: 12, color: COLORS.green },
  changeVal: { fontSize: 18, fontWeight: '500', color: COLORS.green },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#E5E5E5',
    padding: 8,
    marginBottom: 10,
  },
  key: {
    width: '30.5%',
    aspectRatio: 1.8,
    backgroundColor: '#F7F8FA',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 18, fontWeight: '500', color: COLORS.text },
  keyDelete: { backgroundColor: '#F0F0F0' },
  keyDeleteText: { fontSize: 15, color: '#555' },
  actionRow: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  cancelBtnText: { fontSize: 12, color: COLORS.deleteRed },
  confirmBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 12, fontWeight: '500', color: '#fff' },
});

export default CheckoutScreen;
