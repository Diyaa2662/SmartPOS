/* eslint-disable react-native/no-inline-styles */
// src/screens/admin/AddEditProductScreen.tsx
// SmartPOS - Add / Edit Product Screen
// Based on SRS Section 3.2 (FR-PRD) and Section 8

import React, {useEffect, useState} from 'react';
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
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {AdminStackParamList} from '../../navigation/AppNavigator';
import {
  getProductById,
  createProduct,
  updateProduct,
  generateUniqueBarcode,
  isBarcodeUnique,
} from '../../database/productDAO';
import {getAllCategoriesFlat} from '../../database/categoryDAO';
import {getAllSettings} from '../../database/settingsDAO';
import {Category, AppSettings} from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AddEditProduct'>;
  route: RouteProp<AdminStackParamList, 'AddEditProduct'>;
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
  borderFocus: '#1A56A0',
  required: '#E24B4A',
  pillBg: '#E8F0FB',
  cardBorder: '#E5E5E5',
};

// ─── Component ────────────────────────────────────────────────────────────────

const AddEditProductScreen: React.FC<Props> = ({navigation, route}) => {
  const productId = route.params?.productId;
  const isEdit = productId !== undefined;

  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [cats, appSettings] = await Promise.all([
          getAllCategoriesFlat(),
          getAllSettings(),
        ]);
        setCategories(cats);
        setSettings(appSettings);

        if (isEdit && productId) {
          const product = await getProductById(productId);
          if (product) {
            setName(product.name);
            setCategoryId(product.category_id);
            setDescription(product.description ?? '');
            setPrice(product.price.toString());
            setDiscountPrice(product.discount_price?.toString() ?? '');
            setBarcode(product.barcode ?? '');
            setStockQty(product.stock_qty.toString());
          }
        }
      } catch (e) {
        console.error('AddEditProduct load error:', e);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [isEdit, productId]);

  const selectedCategory = categories.find(c => c.id === categoryId);

  const effectivePrice = () => {
    const p = parseFloat(price);
    const d = parseFloat(discountPrice);
    if (!isNaN(d) && d > 0 && d < p) return d;
    return isNaN(p) ? 0 : p;
  };

  const handleGenerateBarcode = async () => {
    try {
      const generated = await generateUniqueBarcode();
      setBarcode(generated);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      Alert.alert('Error', 'Could not generate barcode.');
    }
  };

  const handleSave = async () => {
    if (saving) return;

    // Validate required fields (FR-PRD-01)
    if (!name.trim()) {
      Alert.alert('Validation', 'Product name is required.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Validation', 'Please select a category.');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Validation', 'Please enter a valid price.');
      return;
    }
    const parsedDiscount = discountPrice ? parseFloat(discountPrice) : null;
    if (parsedDiscount !== null && (isNaN(parsedDiscount) || parsedDiscount < 0)) {
      Alert.alert('Validation', 'Please enter a valid discount price.');
      return;
    }

    setSaving(true);
    try {
      // Validate barcode uniqueness (FR-PRD-08)
      if (barcode.trim()) {
        const unique = await isBarcodeUnique(barcode.trim(), isEdit ? productId : undefined);
        if (!unique) {
          Alert.alert('Validation', 'This barcode already exists.');
          setSaving(false);
          return;
        }
      }

      if (isEdit && productId) {
        await updateProduct(
          productId,
          name.trim(),
          categoryId,
          parsedPrice,
          parsedDiscount,
          barcode.trim() || null,
          description.trim() || null,
          parseInt(stockQty, 10) || 0,
        );
      } else {
        await createProduct(
          name.trim(),
          categoryId,
          parsedPrice,
          parsedDiscount,
          barcode.trim() || null,
          description.trim() || null,
          parseInt(stockQty, 10) || 0,
        );
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save product.');
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
          <Text style={styles.topbarTitle}>{isEdit ? 'Edit product' : 'Add new product'}</Text>
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
        <Text style={styles.topbarTitle}>
          {isEdit ? 'Edit product' : 'Add new product'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Basic info</Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              Product name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pepsi 500ml"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
              <Text style={selectedCategory ? styles.inputText : styles.placeholderText}>
                {selectedCategory ? selectedCategory.name : 'Select category...'}
              </Text>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.picker}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setCategoryId(cat.id);
                      setShowCategoryPicker(false);
                    }}>
                    <Text style={styles.pickerItemText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing</Text>
          <View style={styles.row2}>
            <View style={[styles.field, {flex: 1}]}>
              <Text style={styles.label}>
                Price <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.field, {flex: 1}]}>
              <Text style={styles.label}>Discount price</Text>
              <TextInput
                style={styles.input}
                value={discountPrice}
                onChangeText={setDiscountPrice}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          {/* Effective selling price (FR-PRD-09) */}
          <View style={styles.effectivePrice}>
            <Text style={styles.effectivePriceLabel}>Effective selling price</Text>
            <Text style={styles.effectivePriceValue}>
              {settings?.primary_currency_symbol ?? '$'}{effectivePrice().toFixed(2)}
              {settings?.secondary_currency_code
                ? ` / ${(effectivePrice() * (settings?.exchange_rate ?? 1)).toLocaleString()} ${settings?.secondary_currency_symbol}`
                : ''}
            </Text>
          </View>
        </View>

        {/* Barcode */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Barcode</Text>
          <View style={styles.barcodeRow}>
            <View style={[styles.field, {flex: 1}]}>
              <Text style={styles.label}>Barcode</Text>
              <TextInput
                style={styles.input}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Enter manually or generate..."
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            {/* Generate barcode (FR-PRD-05) */}
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateBarcode}>
              <Text style={styles.generateBtnText}>⊞ Generate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stock */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stock</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Stock quantity</Text>
            <TextInput
              style={styles.input}
              value={stockQty}
              onChangeText={setStockQty}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}>
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : '💾 Save product'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  topbar: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtn: {color: '#fff', fontSize: 28, lineHeight: 32},
  topbarTitle: {color: '#fff', fontSize: 16, fontWeight: '500'},
  scroll: {flex: 1, padding: 12},
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.cardBorder,
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
  field: {gap: 4},
  label: {fontSize: 11, color: COLORS.textSecondary},
  required: {color: COLORS.required},
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
  inputText: {fontSize: 12, color: COLORS.text},
  placeholderText: {fontSize: 12, color: COLORS.textMuted},
  textarea: {height: 70, textAlignVertical: 'top'},
  row2: {flexDirection: 'row', gap: 8},
  effectivePrice: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  effectivePriceLabel: {fontSize: 11, color: COLORS.textMuted},
  effectivePriceValue: {fontSize: 12, fontWeight: '500', color: COLORS.primary},
  barcodeRow: {flexDirection: 'row', gap: 8, alignItems: 'flex-end'},
  generateBtn: {
    backgroundColor: COLORS.pillBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 0,
  },
  generateBtnText: {fontSize: 12, color: COLORS.primary, fontWeight: '500'},
  actionRow: {flexDirection: 'row', gap: 8, marginBottom: 24},
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  cancelBtnText: {fontSize: 13, color: COLORS.textSecondary},
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {opacity: 0.6},
  saveBtnText: {fontSize: 13, fontWeight: '500', color: '#fff'},
  picker: {
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  pickerItemText: {fontSize: 12, color: COLORS.text},
});

export default AddEditProductScreen;