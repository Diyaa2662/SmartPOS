/* eslint-disable react-native/no-inline-styles */
// src/screens/admin/SettingsScreen.tsx
// SmartPOS - Settings Screen
// Based on SRS Section 3.8 (FR-CUR), Section 4.4 (NFR-SEC), Section 6.7

import React, { useEffect, useState } from 'react';
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
  getAllSettings,
  saveAllSettings,
  saveAdminPin,
  getSetting,
} from '../../database/settingsDAO';
import { AppSettings } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'Settings'>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#1A56A0',
  background: '#F7F8FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#AAAAAA',
  border: '#E0E0E0',
  warningBg: '#FFF8E6',
  warningBorder: '#F0D080',
  warningText: '#BA7517',
};

// ─── Component ────────────────────────────────────────────────────────────────

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [primaryCode, setPrimaryCode] = useState('');
  const [primarySymbol, setPrimarySymbol] = useState('');
  const [secondaryCode, setSecondaryCode] = useState('');
  const [secondarySymbol, setSecondarySymbol] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [rateUpdatedAt, setRateUpdatedAt] = useState('');
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [settings, pinHash] = await Promise.all([
          getAllSettings(),
          getSetting('admin_pin_hash'),
        ]);
        setStoreName(settings.store_name);
        setReceiptFooter(settings.receipt_footer);
        setPrimaryCode(settings.primary_currency_code);
        setPrimarySymbol(settings.primary_currency_symbol);
        setSecondaryCode(settings.secondary_currency_code);
        setSecondarySymbol(settings.secondary_currency_symbol);
        setExchangeRate(settings.exchange_rate.toString());
        setRateUpdatedAt(settings.exchange_rate_updated_at);
        setHasExistingPin(!!pinHash);
      } catch (e) {
        console.error('Settings load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (saving) return;

    // Validate exchange rate (FR-CUR-09)
    const rate = parseFloat(exchangeRate);
    if (secondaryCode.trim() && (isNaN(rate) || rate <= 0)) {
      Alert.alert('Validation', 'Exchange rate must be greater than 0.');
      return;
    }

    // Validate PIN if entered
    if (newPin || confirmPin) {
      if (newPin.length !== 4) {
        Alert.alert('Validation', 'PIN must be exactly 4 digits.');
        return;
      }
      if (newPin !== confirmPin) {
        Alert.alert('Validation', 'PIN and confirmation do not match.');
        return;
      }
    } else if (!hasExistingPin) {
      Alert.alert(
        'Validation',
        'Please set an admin PIN before saving (required for Dashboard access).',
      );
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<AppSettings> = {
        store_name: storeName.trim(),
        receipt_footer: receiptFooter.trim(),
        primary_currency_code: primaryCode.trim(),
        primary_currency_symbol: primarySymbol.trim(),
        secondary_currency_code: secondaryCode.trim(),
        secondary_currency_symbol: secondarySymbol.trim(),
      };
      if (secondaryCode.trim()) {
        updates.exchange_rate = rate;
      }

      await saveAllSettings(updates);

      if (newPin) {
        await saveAdminPin(newPin);
        setHasExistingPin(true);
        setNewPin('');
        setConfirmPin('');
      }

      Alert.alert('Success', 'Settings saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topbarTitle}>Settings</Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Store */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Store</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Store name</Text>
            <TextInput
              style={styles.input}
              value={storeName}
              onChangeText={setStoreName}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Receipt footer</Text>
            <TextInput
              style={styles.input}
              value={receiptFooter}
              onChangeText={setReceiptFooter}
              placeholder="e.g. Thank you for shopping!"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>

        {/* Primary currency (FR-CUR-01) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Primary currency</Text>
          <View style={styles.row2}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Currency code</Text>
              <TextInput
                style={styles.input}
                value={primaryCode}
                onChangeText={setPrimaryCode}
                placeholder="USD"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Symbol</Text>
              <TextInput
                style={styles.input}
                value={primarySymbol}
                onChangeText={setPrimarySymbol}
                placeholder="$"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Secondary currency (FR-CUR-02) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Secondary currency</Text>
          <View style={styles.row2}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Currency code</Text>
              <TextInput
                style={styles.input}
                value={secondaryCode}
                onChangeText={setSecondaryCode}
                placeholder="IQD"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Symbol</Text>
              <TextInput
                style={styles.input}
                value={secondarySymbol}
                onChangeText={setSecondarySymbol}
                placeholder="IQD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>
              Exchange rate — 1 {primaryCode || 'primary'} =
            </Text>
            <TextInput
              style={styles.input}
              value={exchangeRate}
              onChangeText={setExchangeRate}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
          {/* Warning (FR-CUR-09) */}
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              ⚠️ Rate cannot be 0 or negative
            </Text>
          </View>
          {rateUpdatedAt ? (
            <Text style={styles.lastUpdated}>
              Last updated: {new Date(rateUpdatedAt).toLocaleString()}
            </Text>
          ) : null}
        </View>

        {/* Admin PIN (NFR-SEC-01, NFR-SEC-03) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin PIN</Text>
          {hasExistingPin && (
            <Text style={styles.pinNote}>
              PIN is set. Enter a new PIN below to change it.
            </Text>
          )}
          <View style={styles.field}>
            <Text style={styles.label}>New PIN (4 digits)</Text>
            <TextInput
              style={styles.input}
              value={newPin}
              onChangeText={text =>
                setNewPin(text.replace(/[^0-9]/g, '').slice(0, 4))
              }
              placeholder="••••"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Confirm PIN</Text>
            <TextInput
              style={styles.input}
              value={confirmPin}
              onChangeText={text =>
                setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, 4))
              }
              placeholder="••••"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : '💾 Save settings'}
          </Text>
        </TouchableOpacity>

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
    borderColor: '#E5E5E5',
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
  field: { gap: 4 },
  label: { fontSize: 11, color: COLORS.textSecondary },
  input: {
    backgroundColor: '#F3F4F6',
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.text,
  },
  row2: { flexDirection: 'row', gap: 8 },
  warning: {
    backgroundColor: COLORS.warningBg,
    borderWidth: 0.5,
    borderColor: COLORS.warningBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  warningText: { fontSize: 10, color: COLORS.warningText },
  lastUpdated: { fontSize: 9, color: COLORS.textMuted },
  pinNote: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 13, fontWeight: '500', color: '#fff' },
});

export default SettingsScreen;
