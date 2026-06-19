/* eslint-disable react-native/no-inline-styles */
// src/screens/admin/CategoryManagerScreen.tsx
// SmartPOS - Category Manager Screen
// Based on SRS Section 3.1 (FR-CAT) and Section 8

import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AdminStackParamList} from '../../navigation/AppNavigator';
import {
  getAllCategoriesTree,
  getRootCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../database/categoryDAO';
import {Category, CategoryWithChildren} from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'CategoryManager'>;
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
  required: '#E24B4A',
  deleteRed: '#E24B4A',
};

const CATEGORY_COLORS = [
  '#1A56A0', '#0F6E56', '#BA7517', '#A0522D',
  '#7B2D8B', '#C0392B', '#2980B9', '#27AE60',
];

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editCategory: CategoryWithChildren | Category | null;
  rootCategories: Category[];
}

const CategoryModal: React.FC<ModalProps> = ({
  visible, onClose, onSave, editCategory, rootCategories,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [parentId, setParentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
      setDescription(editCategory.description ?? '');
      setColor(editCategory.color ?? CATEGORY_COLORS[0]);
      setParentId(editCategory.parent_id);
    } else {
      setName('');
      setDescription('');
      setColor(CATEGORY_COLORS[0]);
      setParentId(null);
    }
  }, [editCategory, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Category name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editCategory) {
        await updateCategory(editCategory.id, name.trim(), description.trim() || null, color, parentId);
      } else {
        await createCategory(name.trim(), description.trim() || null, color, parentId);
      }
      onSave();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <Text style={modalStyles.title}>
            {editCategory ? 'Edit category' : 'Add new category'}
          </Text>

          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>
              Name <Text style={{color: COLORS.required}}>*</Text>
            </Text>
            <TextInput
              style={modalStyles.input}
              value={name}
              onChangeText={setName}
              placeholder="Category name..."
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Description</Text>
            <TextInput
              style={modalStyles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional..."
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Color picker (FR-CAT-02, FR-CAT-06) */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Color</Text>
            <View style={modalStyles.colorRow}>
              {CATEGORY_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    modalStyles.colorDot,
                    {backgroundColor: c},
                    color === c && modalStyles.colorDotSelected,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </View>

          {/* Parent category (FR-CAT-01) */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Parent category (optional)</Text>
            <TouchableOpacity
              style={[modalStyles.input, {paddingVertical: 10}]}
              onPress={() => setParentId(null)}>
              <Text style={parentId === null ? modalStyles.inputActive : modalStyles.inputInactive}>
                None (root category)
              </Text>
            </TouchableOpacity>
            {rootCategories
              .filter(r => !editCategory || r.id !== editCategory.id)
              .map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[modalStyles.input, {paddingVertical: 10, marginTop: 4}]}
                  onPress={() => setParentId(cat.id)}>
                  <Text style={parentId === cat.id ? modalStyles.inputActive : modalStyles.inputInactive}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          <View style={modalStyles.actionRow}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.saveBtn, saving && modalStyles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}>
              <Text style={modalStyles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CategoryManagerScreen: React.FC<Props> = ({navigation}) => {
  const [tree, setTree] = useState<CategoryWithChildren[]>([]);
  const [rootCategories, setRootCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryWithChildren | Category | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [treeData, roots] = await Promise.all([
        getAllCategoriesTree(),
        getRootCategories(),
      ]);
      setTree(treeData);
      setRootCategories(roots);
    } catch (e) {
      console.error('CategoryManager load error:', e);
    }
  }, []);

  useEffect(() => {loadData();}, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = (cat: Category) => {
    Alert.alert(
      'Delete category',
      `Delete "${cat.name}"?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              await loadData();
            } catch (e: any) {
              Alert.alert('Cannot delete', e.message);
            }
          },
        },
      ],
    );
  };

  const handleEdit = (cat: CategoryWithChildren | Category) => {
    setEditCategory(cat);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditCategory(null);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Top Bar */}
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topbarTitle}>Categories</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>+ Add new</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {tree.length === 0 && (
          <Text style={styles.emptyText}>No categories yet. Add one!</Text>
        )}

        {/* 2-level tree (FR-CAT-04) */}
        {tree.map(parent => (
          <View key={parent.id} style={styles.parentCard}>
            {/* Parent row */}
            <View style={styles.parentRow}>
              <View style={[styles.colorDot, {backgroundColor: parent.color ?? COLORS.primary}]} />
              <Text style={styles.parentName}>{parent.name}</Text>
              <Text style={styles.itemCount}>{parent.item_count} items</Text>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(parent)}>
                <Text style={styles.editIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(parent)}>
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
              {parent.children.length > 0 && (
                <TouchableOpacity onPress={() => toggleExpand(parent.id)}>
                  <Text style={styles.chevron}>
                    {expanded.has(parent.id) ? '▾' : '▸'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Children rows */}
            {expanded.has(parent.id) && parent.children.map(child => (
              <View key={child.id} style={styles.childRow}>
                <View style={styles.childIndent} />
                <View style={[styles.colorDot, {backgroundColor: child.color ?? COLORS.primary}]} />
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.itemCount}>
                  {(child as any).item_count ?? 0} items
                </Text>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(child)}>
                  <Text style={styles.editIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(child)}>
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <CategoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={loadData}
        editCategory={editCategory}
        rootCategories={rootCategories}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topbarLeft: {flexDirection: 'row', alignItems: 'center', gap: 6},
  backBtn: {color: '#fff', fontSize: 28, lineHeight: 32},
  topbarTitle: {color: '#fff', fontSize: 16, fontWeight: '500'},
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: {color: '#fff', fontSize: 12},
  scroll: {flex: 1, padding: 12},
  emptyText: {textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 13},
  parentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingRight: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  childIndent: {width: 20},
  colorDot: {width: 10, height: 10, borderRadius: 5},
  parentName: {flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.textSecondary},
  childName: {flex: 1, fontSize: 12, color: COLORS.textSecondary},
  itemCount: {fontSize: 10, color: COLORS.textMuted},
  chevron: {fontSize: 14, color: COLORS.textMuted, marginLeft: 4},
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  deleteBtn: {borderColor: '#FFCDD2', backgroundColor: '#FFF5F5'},
  editIcon: {fontSize: 13},
  deleteIcon: {fontSize: 13},
});

const modalStyles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {fontSize: 15, fontWeight: '500', color: COLORS.text, marginBottom: 4},
  field: {gap: 4},
  label: {fontSize: 11, color: COLORS.textSecondary},
  input: {
    backgroundColor: '#F3F4F6',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.text,
  },
  inputActive: {fontSize: 12, color: COLORS.primary, fontWeight: '500'},
  inputInactive: {fontSize: 12, color: COLORS.textMuted},
  colorRow: {flexDirection: 'row', gap: 10, marginTop: 4},
  colorDot: {width: 28, height: 28, borderRadius: 14},
  colorDotSelected: {borderWidth: 3, borderColor: COLORS.text},
  actionRow: {flexDirection: 'row', gap: 8, marginTop: 8},
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelText: {fontSize: 13, color: COLORS.textSecondary},
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {opacity: 0.6},
  saveText: {fontSize: 13, fontWeight: '500', color: '#fff'},
});

export default CategoryManagerScreen;