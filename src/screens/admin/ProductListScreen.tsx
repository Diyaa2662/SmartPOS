// src/screens/admin/ProductListScreen.tsx
// SmartPOS - Product List Screen
// Based on SRS Section 3.2 (FR-PRD) and Section 8

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
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import { getAllProducts, deleteProduct } from '../../database/productDAO';
import { getAllCategoriesFlat } from '../../database/categoryDAO';
import { ProductWithCategory, Category } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'ProductList'>;
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
  stockLow: '#BA7517',
  stockOk: '#0F6E56',
};

// ─── Component ────────────────────────────────────────────────────────────────

const ProductListScreen: React.FC<Props> = ({ navigation }) => {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(
    undefined,
  );
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    try {
      const prods = getAllProducts(search, selectedCategory);
      const cats = getAllCategoriesFlat();
      setProducts(prods);
      setCategories(cats);
    } catch (e) {
      console.error('ProductList load error:', e);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload when coming back from AddEditProduct
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const handleDelete = (product: ProductWithCategory) => {
    // FR-PRD-03 — confirmation prompt before delete
    Alert.alert(
      'Delete product',
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteProduct(product.id);
              loadData();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
              Alert.alert('Error', 'Could not delete product.');
            }
          },
        },
      ],
    );
  };

  const getEffectivePrice = (product: ProductWithCategory) => {
    if (
      product.discount_price !== null &&
      product.discount_price < product.price
    ) {
      return product.discount_price;
    }
    return product.price;
  };

  const renderProduct = ({ item }: { item: ProductWithCategory }) => (
    <View style={styles.productRow}>
      <View style={styles.productIcon}>
        <Text style={styles.productIconText}>📦</Text>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.productCat}>{item.category_name}</Text>
          {item.barcode ? (
            <Text style={styles.productBarcode}>{item.barcode}</Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.productStock,
            item.stock_qty <= 5 ? styles.stockLow : styles.stockOk,
          ]}
        >
          Stock: {item.stock_qty}
          {item.stock_qty <= 5 ? ' ⚠️' : ''}
        </Text>
      </View>
      <View style={styles.productRight}>
        {item.discount_price !== null && item.discount_price < item.price ? (
          <Text style={styles.priceOld}>${item.price.toFixed(2)}</Text>
        ) : null}
        <Text style={styles.price}>${getEffectivePrice(item).toFixed(2)}</Text>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate('AddEditProduct', { productId: item.id })
            }
          >
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
          <Text style={styles.topbarTitle}>Products</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddEditProduct', {})}
        >
          <Text style={styles.addBtnText}>+ Add new</Text>
        </TouchableOpacity>
      </View>

      {/* Search (FR-PRD-04) */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, category, barcode..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Category Filter (FR-PRD-04) */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.pill,
            selectedCategory === undefined && styles.pillActive,
          ]}
          onPress={() => setSelectedCategory(undefined)}
        >
          <Text
            style={[
              styles.pillText,
              selectedCategory === undefined && styles.pillTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.pill,
              selectedCategory === cat.id && styles.pillActive,
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text
              style={[
                styles.pillText,
                selectedCategory === cat.id && styles.pillTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Product List */}
      <FlatList
        data={products}
        keyExtractor={item => item.id.toString()}
        renderItem={renderProduct}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No products found</Text>
        }
        contentContainerStyle={styles.listContent}
      />
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
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtn: { color: '#fff', fontSize: 28, lineHeight: 32 },
  topbarTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontSize: 12 },
  // Search
  searchRow: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    padding: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.text },
  // Filter
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 11, color: '#555' },
  pillTextActive: { color: '#fff' },
  // List
  listContent: { paddingBottom: 20 },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 40,
  },
  // Product row
  productRow: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    gap: 10,
  },
  productIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIconText: { fontSize: 16 },
  productInfo: { flex: 1 },
  productName: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },
  productMeta: { flexDirection: 'row', gap: 8, marginTop: 2 },
  productCat: { fontSize: 10, color: COLORS.textMuted },
  productBarcode: { fontSize: 10, color: '#CCC' },
  productStock: { fontSize: 10, marginTop: 2 },
  stockOk: { color: COLORS.stockOk },
  stockLow: { color: COLORS.stockLow },
  productRight: { alignItems: 'flex-end', gap: 4 },
  priceOld: { fontSize: 10, color: '#BBB', textDecorationLine: 'line-through' },
  price: { fontSize: 13, fontWeight: '500', color: COLORS.primary },
  rowActions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { borderColor: '#FFCDD2', backgroundColor: '#FFF5F5' },
  editIcon: { fontSize: 13 },
  deleteIcon: { fontSize: 13 },
});

export default ProductListScreen;
