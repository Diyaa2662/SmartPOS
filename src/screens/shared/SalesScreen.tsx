// src/screens/shared/SalesScreen.tsx
// SmartPOS - Sales / Checkout Screen
// Based on SRS Section 3.3 (FR-SAL) and Section 8
// Accessible by both Admin and Cashier roles

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AdminStackParamList,
  CashierStackParamList,
} from '../../navigation/AppNavigator';
import { getAllProducts, getProductByBarcode } from '../../database/productDAO';
import { getAllCategoriesFlat } from '../../database/categoryDAO';
import { getAllSettings } from '../../database/settingsDAO';
import { Product, Category, CartItem, AppSettings } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<
    AdminStackParamList | CashierStackParamList,
    'Sales'
  >;
  onLogout?: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#1A56A0',
  background: '#F7F8FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#333333',
  textMuted: '#888888',
  border: '#E5E5E5',
  pillBg: '#E8F0FB',
  deleteRed: '#E24B4A',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getEffectivePrice = (product: Product): number => {
  if (
    product.discount_price !== null &&
    product.discount_price < product.price
  ) {
    return product.discount_price;
  }
  return product.price;
};

// ─── Component ────────────────────────────────────────────────────────────────

const SalesScreen: React.FC<Props> = ({ navigation, onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(
    undefined,
  );
  const [cart, setCart] = useState<CartItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [prods, cats, appSettings] = await Promise.all([
        getAllProducts(search, selectedCategory),
        getAllCategoriesFlat(),
        getAllSettings(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSettings(appSettings);
    } catch (e) {
      console.error('Sales load error:', e);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload products/settings when returning from Checkout (e.g. after a sale)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  // ─── Cart logic ──────────────────────────────────────────────────────────

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      const price = getEffectivePrice(product);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                line_total: (item.quantity + 1) * price,
              }
            : item,
        );
      }
      return [...prev, { product, quantity: 1, line_total: price }];
    });
  };

  const changeQuantity = (productId: number, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const price = getEffectivePrice(item.product);
          return { ...item, quantity: newQty, line_total: newQty * price };
        })
        .filter((item): item is CartItem => item !== null),
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleVoidSale = () => {
    if (cart.length === 0) return;
    // FR-SAL-12 — void/cancel current transaction before finalized
    Alert.alert('Void sale', 'Clear the current cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Void', style: 'destructive', onPress: () => setCart([]) },
    ]);
  };

  const handleBarcodeSubmit = async (code: string) => {
    if (!code.trim()) return;
    try {
      // FR-SAL-02 — add by scanning barcode
      const product = await getProductByBarcode(code.trim());
      if (product) {
        addToCart(product);
        setSearch('');
      } else {
        // FR-SAL-11 — barcode not found
        Alert.alert(
          'Product not found',
          `No product matches barcode "${code}".`,
        );
      }
    } catch (e) {
      console.error('Barcode lookup error:', e);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
  // Discount already baked into line_total via discount_price; transaction-level discount handled at Checkout (FR-SAL-08)
  const discountAmount = cart.reduce((sum, item) => {
    const fullPrice = item.product.price * item.quantity;
    return sum + (fullPrice - item.line_total);
  }, 0);
  const fullTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const handleCheckout = () => {
    if (cart.length === 0) return;
    navigation.navigate('Checkout' as any, {
      cartItems: cart,
      subtotal: fullTotal,
      discountAmount,
      grandTotal: subtotal,
    });
  };

  const formatSecondary = (amount: number) => {
    if (!settings?.secondary_currency_code) return '';
    const converted = amount * settings.exchange_rate;
    return ` / ${converted.toLocaleString()} ${
      settings.secondary_currency_symbol
    }`;
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.prodCard} onPress={() => addToCart(item)}>
      <Text style={styles.prodName} numberOfLines={2}>
        {item.name}
      </Text>
      {item.discount_price !== null && item.discount_price < item.price ? (
        <Text style={styles.prodOld}>
          {settings?.primary_currency_symbol ?? '$'}
          {item.price.toFixed(2)}
        </Text>
      ) : null}
      <Text style={styles.prodPrice}>
        {settings?.primary_currency_symbol ?? '$'}
        {getEffectivePrice(item).toFixed(2)}
      </Text>
      {settings?.secondary_currency_code ? (
        <Text style={styles.prodPriceSec}>
          {(getEffectivePrice(item) * settings.exchange_rate).toLocaleString()}{' '}
          {settings.secondary_currency_symbol}
        </Text>
      ) : null}
      <View style={styles.addBtn}>
        <Text style={styles.addBtnText}>+</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <Text style={styles.topbarTitle}>Sales</Text>
        {onLogout ? (
          <TouchableOpacity onPress={onLogout}>
            <Text style={styles.topbarIcon}>🚪</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Exchange Rate Bar (FR-CUR-08) */}
      {settings?.secondary_currency_code ? (
        <View style={styles.rateBar}>
          <Text style={styles.rateText}>
            💱 1 {settings.primary_currency_code} ={' '}
            {settings.exchange_rate.toLocaleString()}{' '}
            {settings.secondary_currency_code}
          </Text>
        </View>
      ) : null}

      <View style={styles.main}>
        {/* Search + Scanner */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search or scan barcode..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => handleBarcodeSubmit(search)}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => handleBarcodeSubmit(search)}
          >
            <Text style={styles.scanBtnIcon}>⌗</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        <View style={styles.catsRow}>
          <TouchableOpacity
            style={[
              styles.catPill,
              selectedCategory === undefined && styles.catPillActive,
            ]}
            onPress={() => setSelectedCategory(undefined)}
          >
            <Text
              style={[
                styles.catPillText,
                selectedCategory === undefined && styles.catPillTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catPill,
                selectedCategory === cat.id && styles.catPillActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.catPillText,
                  selectedCategory === cat.id && styles.catPillTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.body}>
          {/* Product Grid */}
          <FlatList
            data={products}
            keyExtractor={item => item.id.toString()}
            renderItem={renderProduct}
            numColumns={2}
            style={styles.productList}
            contentContainerStyle={styles.productListContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No products found</Text>
            }
          />

          {/* Cart */}
          <View style={styles.cart}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Cart</Text>
              <Text style={styles.cartCount}>{cart.length} items</Text>
            </View>

            <FlatList
              data={cart}
              keyExtractor={item => item.product.id.toString()}
              style={styles.cartItems}
              ListEmptyComponent={
                <Text style={styles.cartEmptyText}>Cart is empty</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.cartItem}>
                  <Text style={styles.ciName} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <View style={styles.ciRow}>
                    <View style={styles.ciQty}>
                      <TouchableOpacity
                        style={styles.ciQtyBtn}
                        onPress={() => changeQuantity(item.product.id, -1)}
                      >
                        <Text style={styles.ciQtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.ciQtyNum}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.ciQtyBtn}
                        onPress={() => changeQuantity(item.product.id, 1)}
                      >
                        <Text style={styles.ciQtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.ciTotal}>
                      {settings?.primary_currency_symbol ?? '$'}
                      {item.line_total.toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.ciDel}
                    onPress={() => removeFromCart(item.product.id)}
                  >
                    <Text style={styles.ciDelText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            />

            <View style={styles.cartFooter}>
              <View style={styles.cfRow}>
                <Text style={styles.cfLabel}>Subtotal</Text>
                <Text style={styles.cfValue}>
                  {settings?.primary_currency_symbol ?? '$'}
                  {fullTotal.toFixed(2)}
                </Text>
              </View>
              {discountAmount > 0 && (
                <View style={styles.cfRow}>
                  <Text style={styles.cfLabel}>Discount</Text>
                  <Text style={styles.cfDiscount}>
                    -{settings?.primary_currency_symbol ?? '$'}
                    {discountAmount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.cfRow}>
                <Text style={styles.cfTotalLabel}>Total</Text>
                <Text style={styles.cfTotalValue}>
                  {settings?.primary_currency_symbol ?? '$'}
                  {subtotal.toFixed(2)}
                </Text>
              </View>
              {settings?.secondary_currency_code ? (
                <Text style={styles.cfSecondary}>
                  {formatSecondary(subtotal).replace(' / ', '')}
                </Text>
              ) : null}

              <TouchableOpacity style={styles.voidBtn} onPress={handleVoidSale}>
                <Text style={styles.voidBtnText}>✕ Void sale</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.checkoutBtn,
                  cart.length === 0 && styles.checkoutBtnDisabled,
                ]}
                onPress={handleCheckout}
                disabled={cart.length === 0}
              >
                <Text style={styles.checkoutBtnText}>Checkout ›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
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
  topbarTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  topbarIcon: { fontSize: 18 },
  rateBar: {
    backgroundColor: '#E8F0FB',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#CCDDEE',
  },
  rateText: { fontSize: 10, color: COLORS.primary },
  main: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.text },
  scanBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  scanBtnIcon: { fontSize: 16, color: '#fff' },
  catsRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  catPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catPillText: { fontSize: 11, color: '#555' },
  catPillTextActive: { color: '#fff' },
  body: { flex: 1, flexDirection: 'row' },
  productList: { flex: 1 },
  productListContent: { padding: 8 },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    marginTop: 40,
    fontSize: 12,
  },
  prodCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
    margin: 4,
  },
  prodName: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text,
    lineHeight: 14,
  },
  prodOld: {
    fontSize: 9,
    color: '#BBB',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  prodPrice: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.primary,
    marginTop: 2,
  },
  prodPriceSec: { fontSize: 9, color: COLORS.textMuted },
  addBtn: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
  addBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  cart: {
    width: 160,
    backgroundColor: COLORS.white,
    borderLeftWidth: 0.5,
    borderLeftColor: COLORS.border,
  },
  cartHeader: {
    padding: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cartTitle: { fontSize: 12, fontWeight: '500', color: COLORS.text },
  cartCount: { fontSize: 11, color: COLORS.primary },
  cartItems: { flex: 1, padding: 6 },
  cartEmptyText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
  cartItem: {
    backgroundColor: COLORS.background,
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  ciName: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 3,
  },
  ciRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ciQty: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ciQtyBtn: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#E8F0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ciQtyBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  ciQtyNum: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.text,
    minWidth: 14,
    textAlign: 'center',
  },
  ciTotal: { fontSize: 10, fontWeight: '500', color: COLORS.primary },
  ciDel: { alignSelf: 'flex-end', marginTop: 2 },
  ciDelText: { fontSize: 10 },
  cartFooter: {
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    padding: 8,
    gap: 4,
  },
  cfRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cfLabel: { fontSize: 10, color: COLORS.textMuted },
  cfValue: { fontSize: 10, color: COLORS.textSecondary },
  cfDiscount: { fontSize: 10, color: COLORS.deleteRed },
  cfTotalLabel: { fontSize: 12, fontWeight: '500', color: COLORS.text },
  cfTotalValue: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  cfSecondary: { fontSize: 9, color: COLORS.textMuted, textAlign: 'right' },
  voidBtn: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  voidBtnText: { fontSize: 10, color: COLORS.deleteRed },
  checkoutBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 4,
  },
  checkoutBtnDisabled: { opacity: 0.5 },
  checkoutBtnText: { fontSize: 12, fontWeight: '500', color: '#fff' },
});

export default SalesScreen;
