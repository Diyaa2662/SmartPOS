/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-native/no-inline-styles */
// src/screens/admin/NewPurchaseOrderScreen.tsx
// SmartPOS - New Purchase Order Screen
// Based on SRS Section 3.7 (FR-PO) and Section 8

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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import { getProductByBarcode, getAllProducts } from '../../database/productDAO';
import { savePurchaseOrder, NewPOLine } from '../../database/purchaseOrderDAO';
import { Product } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<
    AdminStackParamList,
    'NewPurchaseOrder'
  >;
};

interface DraftLine {
  id: string; // local-only id for list rendering
  product: Product | null;
  searchText: string;
  showResults: boolean;
  searchResults: Product[];
  quantity: string;
  purchasePrice: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#1A56A0',
  background: '#F7F8FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#AAAAAA',
  border: '#E0E0E0',
  required: '#E24B4A',
  pillBg: '#E8F0FB',
};

const createEmptyLine = (): DraftLine => ({
  id: Math.random().toString(36).slice(2),
  product: null,
  searchText: '',
  showResults: false,
  searchResults: [],
  quantity: '',
  purchasePrice: '',
});

// ─── Component ────────────────────────────────────────────────────────────────

const NewPurchaseOrderScreen: React.FC<Props> = ({ navigation }) => {
  const [supplierNote, setSupplierNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([createEmptyLine()]);
  const [saving, setSaving] = useState(false);

  const totalCost = lines.reduce((sum, line) => {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.purchasePrice) || 0;
    return sum + qty * price;
  }, 0);

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleSearchChange = async (id: string, text: string) => {
    updateLine(id, { searchText: text, showResults: true });
    if (text.trim().length < 1) {
      updateLine(id, { searchResults: [] });
      return;
    }
    try {
      const results = await getAllProducts(text);
      updateLine(id, { searchResults: results.slice(0, 5) });
    } catch (e) {
      console.error('Product search error:', e);
    }
  };

  const handleSelectProduct = (id: string, product: Product) => {
    updateLine(id, {
      product,
      searchText: product.name,
      showResults: false,
      searchResults: [],
    });
  };

  const handleScanBarcode = (id: string) => {
    // FR-PO-02 — product can be selected via search OR barcode scan
    // Placeholder until hardware scanner SDK is integrated (Section 7.1)
    Alert.alert(
      'Scanner',
      'Barcode scanning will be available once the device scanner SDK is integrated.',
    );
  };

  const handleRemoveLine = (id: string) => {
    setLines(prev => (prev.length > 1 ? prev.filter(l => l.id !== id) : prev));
  };

  const handleAddLine = () => {
    setLines(prev => [...prev, createEmptyLine()]);
  };

  const handleSave = async () => {
    if (saving) return;

    // Validate every line (FR-PO-07)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.product) {
        Alert.alert('Validation', `Line ${i + 1}: please select a product.`);
        return;
      }
      const qty = parseInt(line.quantity, 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        Alert.alert(
          'Validation',
          `Line ${i + 1}: quantity must be a positive integer.`,
        );
        return;
      }
      const price = parseFloat(line.purchasePrice);
      if (isNaN(price) || price < 0) {
        Alert.alert(
          'Validation',
          `Line ${i + 1}: purchase price must be 0 or greater.`,
        );
        return;
      }
    }

    const poLines: NewPOLine[] = lines.map(line => ({
      product_id: line.product!.id,
      product_name: line.product!.name,
      quantity: parseInt(line.quantity, 10),
      purchase_price: parseFloat(line.purchasePrice),
    }));

    setSaving(true);
    try {
      const poId = await savePurchaseOrder(
        poLines,
        supplierNote.trim() || null,
      );
      Alert.alert('Success', 'Purchase order saved successfully.', [
        {
          text: 'OK',
          onPress: () =>
            navigation.replace('PurchaseOrderDetail', {
              purchaseOrderId: poId,
            }),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save purchase order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>New Purchase Order</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Order Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order info</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Supplier note</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={supplierNote}
              onChangeText={setSupplierNote}
              placeholder="Optional note..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items received</Text>

          {lines.map((line, index) => (
            <View key={line.id} style={styles.lineItem}>
              <View style={styles.field}>
                <Text style={styles.label}>
                  Product <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={line.searchText}
                    onChangeText={text => handleSearchChange(line.id, text)}
                    placeholder="Search product..."
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={() => handleScanBarcode(line.id)}
                  >
                    <Text style={styles.scanBtnText}>⌗</Text>
                  </TouchableOpacity>
                </View>
                {line.showResults && line.searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {line.searchResults.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.searchResultItem}
                        onPress={() => handleSelectProduct(line.id, p)}
                      >
                        <Text style={styles.searchResultText}>{p.name}</Text>
                        {p.barcode ? (
                          <Text style={styles.searchResultBarcode}>
                            {p.barcode}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.row2}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>
                    Qty received <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={line.quantity}
                    onChangeText={text =>
                      updateLine(line.id, { quantity: text })
                    }
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>
                    Purchase price <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={line.purchasePrice}
                    onChangeText={text =>
                      updateLine(line.id, { purchasePrice: text })
                    }
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {lines.length > 1 && (
                <TouchableOpacity
                  style={styles.removeLineBtn}
                  onPress={() => handleRemoveLine(line.id)}
                >
                  <Text style={styles.removeLineText}>🗑️ Remove line</Text>
                </TouchableOpacity>
              )}

              {index < lines.length - 1 && <View style={styles.lineDivider} />}
            </View>
          ))}

          <TouchableOpacity style={styles.addLineBtn} onPress={handleAddLine}>
            <Text style={styles.addLineText}>+ Add item</Text>
          </TouchableOpacity>
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total cost</Text>
          <Text style={styles.totalValue}>${totalCost.toFixed(2)}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : '💾 Save purchase order'}
            </Text>
          </TouchableOpacity>
        </View>
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
  required: { color: COLORS.required },
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
  textarea: { height: 50, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 8 },
  lineItem: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 10,
    gap: 8,
    marginBottom: 4,
  },
  searchRow: { flexDirection: 'row', gap: 6 },
  scanBtn: {
    backgroundColor: COLORS.pillBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  scanBtnText: { fontSize: 16, color: COLORS.primary },
  searchResults: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  searchResultItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchResultText: { fontSize: 12, color: COLORS.text },
  searchResultBarcode: { fontSize: 10, color: COLORS.textMuted },
  removeLineBtn: { alignSelf: 'flex-end' },
  removeLineText: { fontSize: 11, color: '#E24B4A' },
  lineDivider: { height: 1, backgroundColor: 'transparent', marginVertical: 2 },
  addLineBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    backgroundColor: COLORS.pillBg,
  },
  addLineText: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  totalRow: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#E5E5E5',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  totalLabel: { fontSize: 12, color: COLORS.textSecondary },
  totalValue: { fontSize: 16, fontWeight: '500', color: COLORS.primary },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  cancelBtnText: { fontSize: 13, color: COLORS.textSecondary },
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 13, fontWeight: '500', color: '#fff' },
});

export default NewPurchaseOrderScreen;
