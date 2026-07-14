/* eslint-disable react-native/no-inline-styles */
// src/screens/admin/CategoryManagerScreen.tsx
// SmartPOS - Category Manager Screen
// Based on SRS Section 3.1 (FR-CAT) and Section 8
// UPDATED per client request: categories now support unlimited nesting depth
// (e.g. Chips -> Chips Medium Size -> Doritos) instead of the original 2 levels.
// The tree row renders itself recursively, and the parent picker lets you
// choose ANY existing category as a parent (excluding the category being
// edited and all of its own descendants, to avoid creating a cycle).

import React, { useEffect, useState, useCallback } from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import {
  getAllCategoriesTree,
  getAllCategoriesFlat,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../database/categoryDAO';
import { Category, CategoryWithChildren } from '../../types';
import { useTranslation } from '../../i18n';

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
  '#1A56A0',
  '#0F6E56',
  '#BA7517',
  '#A0522D',
  '#7B2D8B',
  '#C0392B',
  '#2980B9',
  '#27AE60',
];

const INDENT_PER_LEVEL = 16; // px of left padding added per nesting level

// ─── Helper: collect a category's own id + all descendant ids ───────────────
// Used to exclude a category and its whole subtree from its own parent picker
// (you can't make a category a child of itself or of one of its descendants).

const collectIdsWithDescendants = (cat: CategoryWithChildren): Set<number> => {
  const ids = new Set<number>([cat.id]);
  const walk = (node: CategoryWithChildren) => {
    node.children.forEach(child => {
      ids.add(child.id);
      walk(child);
    });
  };
  walk(cat);
  return ids;
};

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editCategory: CategoryWithChildren | null;
  allCategories: Category[];
  excludedParentIds: Set<number>;
}

const CategoryModal: React.FC<ModalProps> = ({
  visible,
  onClose,
  onSave,
  editCategory,
  allCategories,
  excludedParentIds,
}) => {
  const { t } = useTranslation();
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
      Alert.alert(t('validationRequired'), t('categoryName'));
      return;
    }
    setSaving(true);
    try {
      if (editCategory) {
        await updateCategory(
          editCategory.id,
          name.trim(),
          description.trim() || null,
          color,
          parentId,
        );
      } else {
        await createCategory(
          name.trim(),
          description.trim() || null,
          color,
          parentId,
        );
      }
      onSave();
      onClose();
    } catch (e: any) {
      Alert.alert(t('error'), e.message ?? t('somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  // Any category can be a parent now (unlimited depth) — just exclude the
  // category being edited and its own descendants to prevent a cycle.
  const parentOptions = allCategories.filter(c => !excludedParentIds.has(c.id));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <Text style={modalStyles.title}>
            {editCategory ? t('editCategory') : t('addNewCategoryTitle')}
          </Text>

          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>
              {t('categoryName')}{' '}
              <Text style={{ color: COLORS.required }}>*</Text>
            </Text>
            <TextInput
              style={modalStyles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('categoryName')}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>{t('description')}</Text>
            <TextInput
              style={modalStyles.input}
              value={description}
              onChangeText={setDescription}
              placeholder={t('optional')}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Color picker (FR-CAT-02, FR-CAT-06) */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>{t('color')}</Text>
            <View style={modalStyles.colorRow}>
              {CATEGORY_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    modalStyles.colorDot,
                    { backgroundColor: c },
                    color === c && modalStyles.colorDotSelected,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </View>

          {/* Parent category — any existing category, unlimited depth (FR-CAT-01, extended) */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>{t('parentCategoryOptional')}</Text>
            <ScrollView style={modalStyles.parentList} nestedScrollEnabled>
              <TouchableOpacity
                style={[modalStyles.input, { paddingVertical: 10 }]}
                onPress={() => setParentId(null)}
              >
                <Text
                  style={
                    parentId === null
                      ? modalStyles.inputActive
                      : modalStyles.inputInactive
                  }
                >
                  {t('noneRootCategory')}
                </Text>
              </TouchableOpacity>
              {parentOptions.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    modalStyles.input,
                    { paddingVertical: 10, marginTop: 4 },
                  ]}
                  onPress={() => setParentId(cat.id)}
                >
                  <Text
                    style={
                      parentId === cat.id
                        ? modalStyles.inputActive
                        : modalStyles.inputInactive
                    }
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={modalStyles.actionRow}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelText}>{t('cancelText')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                modalStyles.saveBtn,
                saving && modalStyles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={modalStyles.saveText}>
                {saving ? t('saving') : t('save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Recursive tree row ───────────────────────────────────────────────────────
// Renders one category and, if expanded, recurses into its children at any depth.

interface TreeRowProps {
  category: CategoryWithChildren;
  depth: number;
  expanded: Set<number>;
  onToggleExpand: (id: number) => void;
  onEdit: (cat: CategoryWithChildren) => void;
  onDelete: (cat: CategoryWithChildren) => void;
}

const TreeRow: React.FC<TreeRowProps> = ({
  category,
  depth,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const hasChildren = category.children.length > 0;
  const isExpanded = expanded.has(category.id);

  return (
    <View>
      <View
        style={[
          depth === 0 ? styles.parentRow : styles.childRow,
          { paddingLeft: 12 + depth * INDENT_PER_LEVEL },
        ]}
      >
        <View
          style={[
            styles.colorDot,
            { backgroundColor: category.color ?? COLORS.primary },
          ]}
        />
        <Text
          style={depth === 0 ? styles.parentName : styles.childName}
          numberOfLines={1}
        >
          {category.name}
        </Text>
        <Text style={styles.itemCount}>
          {t('itemsCount', { count: category.item_count })}
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onEdit(category)}
        >
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => onDelete(category)}
        >
          <Text style={styles.deleteIcon}>🗑️</Text>
        </TouchableOpacity>
        {hasChildren && (
          <TouchableOpacity onPress={() => onToggleExpand(category.id)}>
            <Text style={styles.chevron}>{isExpanded ? '▾' : '▸'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isExpanded &&
        category.children.map(child => (
          <TreeRow
            key={child.id}
            category={child}
            depth={depth + 1}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CategoryManagerScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [tree, setTree] = useState<CategoryWithChildren[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryWithChildren | null>(
    null,
  );
  const [excludedParentIds, setExcludedParentIds] = useState<Set<number>>(
    new Set(),
  );
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [treeData, flat] = await Promise.all([
        getAllCategoriesTree(),
        getAllCategoriesFlat(),
      ]);
      setTree(treeData);
      setAllCategories(flat);
    } catch (e) {
      console.error('CategoryManager load error:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleDelete = (cat: CategoryWithChildren) => {
    Alert.alert(
      t('deleteCategory'),
      t('deleteCategoryConfirm', { category: cat.name }),
      [
        { text: t('cancelText'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              await loadData();
            } catch (e: any) {
              Alert.alert(t('cannotDelete'), e.message);
            }
          },
        },
      ],
    );
  };

  const handleEdit = (cat: CategoryWithChildren) => {
    setEditCategory(cat);
    setExcludedParentIds(collectIdsWithDescendants(cat));
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditCategory(null);
    setExcludedParentIds(new Set());
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
          <Text style={styles.topbarTitle}>{t('categories')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>{t('addNewCategory')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tree.length === 0 && (
          <Text style={styles.emptyText}>{t('noCategoriesYet')}</Text>
        )}

        {/* Unlimited-depth tree (FR-CAT-04, extended per client request) */}
        <View style={styles.treeCard}>
          {tree.map((root, i) => (
            <View key={root.id} style={i > 0 ? styles.rootDivider : undefined}>
              <TreeRow
                category={root}
                depth={0}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <CategoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={loadData}
        editCategory={editCategory}
        allCategories={allCategories}
        excludedParentIds={excludedParentIds}
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
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontSize: 12 },
  scroll: { flex: 1, padding: 12 },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    marginTop: 40,
    fontSize: 13,
  },
  treeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  rootDivider: { borderTopWidth: 0.5, borderTopColor: COLORS.border },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 12,
    gap: 8,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: 9,
    paddingRight: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  parentName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  childName: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  itemCount: { fontSize: 10, color: COLORS.textMuted },
  chevron: { fontSize: 14, color: COLORS.textMuted, marginLeft: 4 },
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
  deleteBtn: { borderColor: '#FFCDD2', backgroundColor: '#FFF5F5' },
  editIcon: { fontSize: 13 },
  deleteIcon: { fontSize: 13 },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
    maxHeight: '85%',
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  field: { gap: 4 },
  label: { fontSize: 11, color: COLORS.textSecondary },
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
  inputActive: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  inputInactive: { fontSize: 12, color: COLORS.textMuted },
  colorRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: COLORS.text },
  parentList: { maxHeight: 200 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelText: { fontSize: 13, color: COLORS.textSecondary },
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: 13, fontWeight: '500', color: '#fff' },
});

export default CategoryManagerScreen;
