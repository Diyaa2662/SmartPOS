// src/screens/auth/ActivationScreen.tsx
// SmartPOS - Activation Screen
// Shows device ID and allows entering activation code

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getDeviceId, activateDevice } from '../../utils/licenseService';
import { useTranslation } from '../../i18n';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onActivated: () => void;
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
  success: '#0F6E56',
  error: '#E24B4A',
  inputBg: '#F3F4F6',
};

// ─── Component ────────────────────────────────────────────────────────────────

const ActivationScreen: React.FC<Props> = ({ onActivated }) => {
  const { t } = useTranslation();
  const [deviceId, setDeviceId] = useState<string>('');
  const [activationCode, setActivationCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [activating, setActivating] = useState<boolean>(false);

  useEffect(() => {
    const loadDeviceId = async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
      } catch (error) {
        console.error('Failed to load device ID:', error);
        Alert.alert(t('error'), t('somethingWentWrong'));
      } finally {
        setLoading(false);
      }
    };
    loadDeviceId();
  }, [t]);

  const handleActivate = async () => {
    if (!activationCode.trim()) {
      Alert.alert(t('validationRequired'), 'Please enter an activation code.');
      return;
    }

    setActivating(true);
    try {
      const result = await activateDevice(activationCode.trim());
      if (result.success) {
        Alert.alert(t('success'), result.message, [
          { text: 'OK', onPress: onActivated },
        ]);
      } else {
        Alert.alert(t('error'), result.message);
      }
    } catch (error) {
      console.error('Activation error:', error);
      Alert.alert(t('error'), t('somethingWentWrong'));
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🏪</Text>
          </View>
          <Text style={styles.appName}>{t('appTitle')}</Text>
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>🏪</Text>
        </View>
        <Text style={styles.appName}>{t('appTitle')}</Text>
        <Text style={styles.appSub}>Activation Required</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device ID</Text>
          <Text style={styles.cardDescription}>
            Please copy this Device ID and send it to the administrator to get
            your activation code.
          </Text>

          <View style={styles.deviceIdBox}>
            <Text style={styles.deviceIdText} selectable>
              {deviceId}
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.cardTitle}>Activation Code</Text>
          <Text style={styles.cardDescription}>
            Enter the activation code you received from the administrator.
          </Text>

          <TextInput
            style={styles.codeInput}
            value={activationCode}
            onChangeText={setActivationCode}
            placeholder="e.g. A3F7B2C1"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />

          <TouchableOpacity
            style={[
              styles.activateBtn,
              activating && styles.activateBtnDisabled,
            ]}
            onPress={handleActivate}
            disabled={activating}
          >
            <Text style={styles.activateBtnText}>
              {activating ? 'Activating...' : '🔓 Activate'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>{t('version')}</Text>
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
  header: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 28,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoIcon: {
    fontSize: 36,
  },
  appName: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '600',
  },
  appSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  deviceIdBox: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceIdText: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  divider: {
    height: 0.5,
    backgroundColor: COLORS.border,
  },
  codeInput: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    letterSpacing: 2,
    textAlign: 'center',
  },
  activateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  activateBtnDisabled: {
    opacity: 0.6,
  },
  activateBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textMuted,
    paddingBottom: 16,
  },
});

export default ActivationScreen;
