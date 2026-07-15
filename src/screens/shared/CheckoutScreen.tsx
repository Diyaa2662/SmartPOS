/* eslint-disable react-native/no-inline-styles */
// src/screens/shared/CheckoutScreen.tsx
// SmartPOS - Checkout / Payment Screen
// Based on SRS Section 3.3 (FR-SAL) and Section 8
// Accessible by both Admin and Cashier roles
// Mixed-currency payment added per client request: the customer can pay part
// of the bill in the primary currency and the rest in the secondary currency,
// converted using the exchange rate configured in Settings.

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
import {
  saveTransaction,
  getTransactionById,
} from '../../database/transactionDAO';
import { getAllSettings } from '../../database/settingsDAO';
import { CartItem, AppSettings } from '../../types';
import { useTranslation } from '../../i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<
    AdminStackParamList | CashierStackParamList,
    'Checkout'
  >;
  route: RouteProp<AdminStackParamList | CashierStackParamList, 'Checkout'>;
};

type PaymentMode = 'single' | 'mixed';
type ActiveField = 'primary' | 'secondary';

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
  const { t } = useTranslation();
  const { cartItems, subtotal, discountAmount, grandTotal } = route.params as {
    cartItems: CartItem[];
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
  };

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('single');
  const [amountPrimary, setAmountPrimary] = useState('');
  const [amountSecondary, setAmountSecondary] = useState('');
  const [activeField, setActiveField] = useState<ActiveField>('primary');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllSettings().then(setSettings).catch(console.error);
  }, []);

  const symbol = settings?.primary_currency_symbol ?? '$';
  const secSymbol = settings?.secondary_currency_symbol ?? '';
  const rate = settings?.exchange_rate ?? 1;
  const hasSecondary = !!settings?.secondary_currency_code;

  const tenderedPrimary = parseFloat(amountPrimary) || 0;
  const tenderedSecondary = parseFloat(amountSecondary) || 0;

  // Combined amount tendered, expressed in primary currency (FR-CUR-05 style snapshot use)
  const tenderedSecondaryInPrimary = rate > 0 ? tenderedSecondary / rate : 0;
  const combinedTendered =
    paymentMode === 'mixed'
      ? tenderedPrimary + tenderedSecondaryInPrimary
      : tenderedPrimary;

  const changeDue = combinedTendered - grandTotal;

  const handleKeyPress = (key: string) => {
    const setValue =
      activeField === 'primary' ? setAmountPrimary : setAmountSecondary;
    const currentValue =
      activeField === 'primary' ? amountPrimary : amountSecondary;
    if (key === '.' && currentValue.includes('.')) return;
    setValue(currentValue + key);
  };

  const handleDelete = () => {
    const setValue =
      activeField === 'primary' ? setAmountPrimary : setAmountSecondary;
    const currentValue =
      activeField === 'primary' ? amountPrimary : amountSecondary;
    setValue(currentValue.slice(0, -1));
  };

  const handlePaymentModeChange = (mode: PaymentMode) => {
    setPaymentMode(mode);
    setAmountPrimary('');
    setAmountSecondary('');
    setActiveField('primary');
  };

  const handleCancel = () => {
    // FR-SAL-12 — cancel before finalized
    navigation.goBack();
  };

  const handleConfirm = async () => {
    if (saving) return;

    if (combinedTendered < grandTotal) {
      Alert.alert(t('insufficientAmount'), t('amountTenderedIsLess'));
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
        combinedTendered,
        changeDue,
        paymentMode === 'mixed' ? tenderedPrimary : combinedTendered,
        paymentMode === 'mixed' ? tenderedSecondary : 0,
      );

      // FR-PRT-01 — auto print after sale
      try {
        const tx = await getTransactionById(transactionId);
        if (tx) {
          const { printReceipt } = await import('../../utils/printerService');
          await printReceipt(tx, settings!, true);
        }
      } catch (e: any) {
        Alert.alert(
          t('printingError'),
          `${e?.message ?? t('printErrorDetails')}\n\nCode: ${
            e?.code ?? 'none'
          }`,
        );
      }

      navigation.replace('ReceiptPreview' as any, {
        transactionId,
        returnTo: 'Sales',
      });
    } catch (e: any) {
      Alert.alert(t('error'), e.message ?? t('somethingWentWrong'));
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
        <TouchableOpacity style={styles.backBtn} onPress={handleCancel}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>{t('checkout')}</Text>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Order Summary (FR-SAL-04) */}
        <View style={styles.card}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderHeaderTitle}>{t('orderSummary')}</Text>
            <Text style={styles.orderHeaderCount}>
              {t('items', { count: cartItems.length })}
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
            <Text style={styles.tLabel}>{t('subtotal')}</Text>
            <Text style={styles.tValue}>
              {symbol}
              {subtotal.toFixed(2)}
            </Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.tRow}>
              <Text style={styles.tLabel}>{t('discount')}</Text>
              <Text style={styles.tDiscount}>
                -{symbol}
                {discountAmount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.tRow}>
            <Text style={styles.tGrandLabel}>{t('total')}</Text>
            <Text style={styles.tGrandValue}>
              {symbol}
              {grandTotal.toFixed(2)}
            </Text>
          </View>
          {hasSecondary ? (
            <Text style={styles.tSecondary}>
              {(grandTotal * rate).toLocaleString()} {secSymbol}
            </Text>
          ) : null}
        </View>

        {/* Payment mode toggle — client-requested addition (only when a secondary currency is configured) */}
        {hasSecondary && (
          <View style={styles.card}>
            <Text style={styles.inputLabel}>{t('paymentMethod')}</Text>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  paymentMode === 'single' && styles.modeOptionActive,
                ]}
                onPress={() => handlePaymentModeChange('single')}
              >
                <Text
                  style={[
                    styles.modeOptionText,
                    paymentMode === 'single' && styles.modeOptionTextActive,
                  ]}
                >
                  {t('singleCurrency')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  paymentMode === 'mixed' && styles.modeOptionActive,
                ]}
                onPress={() => handlePaymentModeChange('mixed')}
              >
                <Text
                  style={[
                    styles.modeOptionText,
                    paymentMode === 'mixed' && styles.modeOptionTextActive,
                  ]}
                >
                  {t('mixedCurrency')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Amount tendered / Change (FR-SAL-09) */}
        <View style={styles.card}>
          {paymentMode === 'single' ? (
            <>
              <Text style={styles.inputLabel}>{t('amountTendered')}</Text>
              <TouchableOpacity
                style={[
                  styles.inputBox,
                  activeField === 'primary' && styles.inputBoxActive,
                ]}
                onPress={() => setActiveField('primary')}
              >
                <Text style={styles.inputVal}>
                  {symbol}
                  {amountPrimary || '0'}
                </Text>
                <Text style={styles.inputCurrency}>
                  {settings?.primary_currency_code ?? 'USD'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>
                {t('amountIn', {
                  currency: settings?.primary_currency_code ?? 'USD',
                })}
              </Text>
              <TouchableOpacity
                style={[
                  styles.inputBox,
                  activeField === 'primary' && styles.inputBoxActive,
                ]}
                onPress={() => setActiveField('primary')}
              >
                <Text style={styles.inputVal}>
                  {symbol}
                  {amountPrimary || '0'}
                </Text>
                <Text style={styles.inputCurrency}>
                  {settings?.primary_currency_code}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>
                {t('amountIn', {
                  currency: settings?.secondary_currency_code ?? '',
                })}
              </Text>
              <TouchableOpacity
                style={[
                  styles.inputBox,
                  activeField === 'secondary' && styles.inputBoxActive,
                ]}
                onPress={() => setActiveField('secondary')}
              >
                <Text style={styles.inputVal}>
                  {secSymbol}
                  {amountSecondary || '0'}
                </Text>
                <Text style={styles.inputCurrency}>
                  {settings?.secondary_currency_code}
                </Text>
              </TouchableOpacity>

              <View style={styles.combinedBox}>
                <Text style={styles.combinedLabel}>
                  {t('combinedPrimary', {
                    currency: settings?.primary_currency_code ?? 'USD',
                  })}
                </Text>
                <Text style={styles.combinedValue}>
                  {symbol}
                  {combinedTendered.toFixed(2)}
                </Text>
              </View>
            </>
          )}

          <View style={styles.changeBox}>
            <Text style={styles.changeLabel}>{t('changeDue')}</Text>
            <Text style={styles.changeVal}>
              {symbol}
              {Math.max(0, changeDue).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Numpad — types into whichever field is currently active */}
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
            <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={saving}
          >
            <Text style={styles.confirmBtnText}>
              {saving ? t('saving') : t('confirmSalePrint')}
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
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 32,
    marginTop: -2,
  },
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
  modeToggle: { flexDirection: 'row', gap: 8 },
  modeOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modeOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeOptionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modeOptionTextActive: { color: '#fff' },
  inputLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 },
  inputBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputBoxActive: { borderColor: COLORS.primary },
  inputVal: { fontSize: 18, fontWeight: '500', color: COLORS.text },
  inputCurrency: { fontSize: 11, color: COLORS.textMuted },
  combinedBox: {
    backgroundColor: '#EEF3FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  combinedLabel: { fontSize: 11, color: COLORS.primary },
  combinedValue: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
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
