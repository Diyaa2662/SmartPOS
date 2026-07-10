// src/navigation/AppNavigator.tsx
// SmartPOS - Navigation Structure
// Based on SRS Section 8 - Screen Module Summary

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { UserRole } from '../types';

// ─── Screens (to be created) ──────────────────────────────────────────────────

// Auth
import LoginScreen from '../screens/auth/LoginScreen';

// Admin screens
import DashboardScreen from '../screens/admin/DashboardScreen';
import ProductListScreen from '../screens/admin/ProductListScreen';
import AddEditProductScreen from '../screens/admin/AddEditProductScreen';
import CategoryManagerScreen from '../screens/admin/CategoryManagerScreen';
import PurchaseOrdersScreen from '../screens/admin/PurchaseOrdersScreen';
import NewPurchaseOrderScreen from '../screens/admin/NewPurchaseOrderScreen';
import PurchaseOrderDetailScreen from '../screens/admin/PurchaseOrderDetailScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import SettingsScreen from '../screens/admin/SettingsScreen';

// Shared screens (Admin + Cashier)
import SalesScreen from '../screens/shared/SalesScreen';
import CheckoutScreen from '../screens/shared/CheckoutScreen';
import ReceiptPreviewScreen from '../screens/shared/ReceiptPreviewScreen';

// ─── Stack Param Lists (TypeScript route params) ──────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
};

export type AdminStackParamList = {
  Dashboard: undefined;
  ProductList: undefined;
  AddEditProduct: { productId?: number }; // undefined = Add, number = Edit
  CategoryManager: undefined;
  PurchaseOrders: undefined;
  NewPurchaseOrder: undefined;
  PurchaseOrderDetail: { purchaseOrderId: number };
  Reports: undefined;
  Settings: undefined;
  Sales: { clearCart?: boolean } | undefined;
  Checkout: {
    cartItems: any[];
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
  };
  ReceiptPreview: { transactionId?: number }; // undefined = last receipt
};

export type CashierStackParamList = {
  Sales: { clearCart?: boolean } | undefined;
  Checkout: {
    cartItems: any[];
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
  };
  ReceiptPreview: { transactionId?: number };
};

// ─── Stack Navigators ─────────────────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();
const CashierStack = createNativeStackNavigator<CashierStackParamList>();

// ─── Admin Navigator ──────────────────────────────────────────────────────────

const AdminNavigator = ({ onLogout }: { onLogout: () => void }) => (
  <AdminStack.Navigator
    initialRouteName="Dashboard"
    screenOptions={{ headerShown: false }}
  >
    <AdminStack.Screen name="Dashboard">
      {props => <DashboardScreen {...props} onLogout={onLogout} />}
    </AdminStack.Screen>
    <AdminStack.Screen name="ProductList" component={ProductListScreen} />
    <AdminStack.Screen name="AddEditProduct" component={AddEditProductScreen} />
    <AdminStack.Screen
      name="CategoryManager"
      component={CategoryManagerScreen}
    />
    <AdminStack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
    <AdminStack.Screen
      name="NewPurchaseOrder"
      component={NewPurchaseOrderScreen}
    />
    <AdminStack.Screen
      name="PurchaseOrderDetail"
      component={PurchaseOrderDetailScreen}
    />
    <AdminStack.Screen name="Reports" component={ReportsScreen} />
    <AdminStack.Screen name="Settings" component={SettingsScreen} />
    <AdminStack.Screen name="Sales">
      {props => <SalesScreen {...props} onLogout={onLogout} />}
    </AdminStack.Screen>
    <AdminStack.Screen name="Checkout" component={CheckoutScreen} />
    <AdminStack.Screen name="ReceiptPreview" component={ReceiptPreviewScreen} />
  </AdminStack.Navigator>
);

// ─── Cashier Navigator ────────────────────────────────────────────────────────

const CashierNavigator = ({ onLogout }: { onLogout: () => void }) => (
  <CashierStack.Navigator
    initialRouteName="Sales"
    screenOptions={{ headerShown: false }}
  >
    <CashierStack.Screen name="Sales">
      {props => <SalesScreen {...props} onLogout={onLogout} />}
    </CashierStack.Screen>
    <CashierStack.Screen name="Checkout" component={CheckoutScreen} />
    <CashierStack.Screen
      name="ReceiptPreview"
      component={ReceiptPreviewScreen}
    />
  </CashierStack.Navigator>
);

// ─── Root Navigator ───────────────────────────────────────────────────────────

const AppNavigator = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
  };

  const handleLogout = () => {
    setUserRole(null);
  };

  return (
    <NavigationContainer>
      {userRole === null && (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login">
            {props => <LoginScreen {...props} onLogin={handleLogin} />}
          </AuthStack.Screen>
        </AuthStack.Navigator>
      )}
      {userRole === 'admin' && <AdminNavigator onLogout={handleLogout} />}
      {userRole === 'cashier' && <CashierNavigator onLogout={handleLogout} />}
    </NavigationContainer>
  );
};

export default AppNavigator;
