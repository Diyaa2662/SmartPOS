// src/screens/auth/LoginScreen.tsx
// SmartPOS - Login / PIN Screen
// Based on SRS NFR-SEC-01 and Section 2.4 (User Classes)

import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
} from 'react-native';
import {UserRole} from '../../types';
import {verifyAdminPin, getSetting} from '../../database/settingsDAO';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onLogin: (role: UserRole) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIN_LENGTH = 4;
const COLORS = {
  primary: '#1A56A0',
  background: '#F7F8FA',
  white: '#FFFFFF',
  textSecondary: '#666666',
  textMuted: '#AAAAAA',
  border: '#E0E0E0',
  deleteKey: '#F0F0F0',
  activeTab: '#1A56A0',
  inactiveTab: '#FFFFFF',
};

// ─── Component ────────────────────────────────────────────────────────────────

const LoginScreen: React.FC<Props> = ({onLogin}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [pin, setPin] = useState<string>('');

  const handleKeyPress = (key: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const newPin = pin + key;
    setPin(newPin);

    // Auto-submit when PIN is complete
    if (newPin.length === PIN_LENGTH) {
      handleSubmit(newPin);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = (enteredPin: string) => {
    if (selectedRole === 'admin') {
      // Check if admin PIN has been set
      const storedHash = getSetting('admin_pin_hash');
      if (!storedHash) {
        // First launch — no PIN set yet, allow entry and prompt to set PIN
        onLogin('admin');
        return;
      }

      const isValid = verifyAdminPin(enteredPin);
      if (isValid) {
        onLogin('admin');
      } else {
        Alert.alert('Incorrect PIN', 'Please try again.');
        setPin('');
      }
    } else {
      // Cashier — no PIN required (SRS Section 2.4, NFR-SEC-01 only requires Admin PIN)
      onLogin('cashier');
    }
  };

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setPin('');

    // Cashier logs in immediately without PIN
    if (role === 'cashier') {
      onLogin('cashier');
    }
  };

  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header / Logo */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>🏪</Text>
        </View>
        <Text style={styles.appName}>SmartPOS</Text>
        <Text style={styles.appSub}>Point of Sale System</Text>
      </View>

      {/* PIN Area */}
      <View style={styles.pinArea}>

        {/* Role Tabs */}
        <View style={styles.roleTabs}>
          <TouchableOpacity
            style={[
              styles.roleTab,
              selectedRole === 'admin' && styles.roleTabActive,
            ]}
            onPress={() => handleRoleChange('admin')}>
            <Text
              style={[
                styles.roleTabText,
                selectedRole === 'admin' && styles.roleTabTextActive,
              ]}>
              🔒 Admin
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.roleTab,
              selectedRole === 'cashier' && styles.roleTabActive,
            ]}
            onPress={() => handleRoleChange('cashier')}>
            <Text
              style={[
                styles.roleTabText,
                selectedRole === 'cashier' && styles.roleTabTextActive,
              ]}>
              👤 Cashier
            </Text>
          </TouchableOpacity>
        </View>

        {/* PIN label — only shown for Admin */}
        {selectedRole === 'admin' && (
          <>
            <Text style={styles.pinLabel}>Enter your PIN</Text>

            {/* PIN Dots */}
            <View style={styles.pinDots}>
              {Array.from({length: PIN_LENGTH}).map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i < pin.length && styles.dotFilled]}
                />
              ))}
            </View>

            {/* Numpad */}
            <View style={styles.numpad}>
              {numpadKeys.map(key => (
                <TouchableOpacity
                  key={key}
                  style={styles.key}
                  onPress={() => handleKeyPress(key)}>
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              ))}
              {/* Bottom row: empty, 0, delete */}
              <View style={styles.keyEmpty} />
              <TouchableOpacity
                style={styles.key}
                onPress={() => handleKeyPress('0')}>
                <Text style={styles.keyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.key, styles.keyDelete]}
                onPress={handleDelete}>
                <Text style={styles.keyDeleteText}>⌫</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.version}>SmartPOS v1.0 • POS-T8-3</Text>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Header
  header: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 28,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoIcon: {
    fontSize: 28,
  },
  appName: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '500',
  },
  appSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 3,
  },
  // PIN area
  pinArea: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 20,
  },
  // Role tabs
  roleTabs: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 280,
    marginBottom: 20,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inactiveTab,
  },
  roleTabActive: {
    backgroundColor: COLORS.activeTab,
    borderColor: COLORS.activeTab,
  },
  roleTabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  roleTabTextActive: {
    color: COLORS.white,
    fontWeight: '500',
  },
  // PIN label
  pinLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  // PIN dots
  pinDots: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 28,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  dotFilled: {
    backgroundColor: COLORS.primary,
  },
  // Numpad
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 280,
    gap: 8,
  },
  key: {
    width: '30%',
    aspectRatio: 1.6,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  keyEmpty: {
    width: '30%',
  },
  keyDelete: {
    backgroundColor: COLORS.deleteKey,
  },
  keyDeleteText: {
    fontSize: 18,
    color: '#555555',
  },
  // Version
  version: {
    marginTop: 24,
    fontSize: 11,
    color: COLORS.textMuted,
  },
});

export default LoginScreen;