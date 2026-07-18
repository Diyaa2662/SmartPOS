// src/utils/licenseService.ts
// SmartPOS - License / Activation Service
// Handles device-based activation using SHA256 encryption

import DeviceInfo from 'react-native-device-info';
import { getSetting, setSetting } from '../database/settingsDAO';
import { sha256Hash } from './crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

// Secret key for generating activation codes (CHANGE THIS IN PRODUCTION!)
// This should be a long, random string known only to you.
const SECRET_KEY = 'SmartPOS_SecretKey_2024_ChangeMe_!@#$%^&*()';

// ─── Get Device ID ────────────────────────────────────────────────────────────

export const getDeviceId = async (): Promise<string> => {
  try {
    // Get Android ID (unique per device per app install)
    const deviceId = await DeviceInfo.getAndroidId();
    if (!deviceId || deviceId === 'unknown' || deviceId === '') {
      // Fallback: use a combination of other identifiers
      const deviceName = await DeviceInfo.getDeviceName();
      const manufacturer = await DeviceInfo.getManufacturer();
      const model = await DeviceInfo.getModel();
      const fallbackId = `${manufacturer}_${model}_${deviceName}`.replace(
        /\s/g,
        '_',
      );
      return fallbackId;
    }
    return deviceId;
  } catch (error) {
    console.error('Failed to get device ID:', error);
    // Ultimate fallback: generate a random ID
    return `FALLBACK_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
};

// ─── Generate Activation Code ────────────────────────────────────────────────

export const generateActivationCode = async (
  deviceId: string,
): Promise<string> => {
  // Combine device ID with secret key and hash it
  const raw = `${deviceId}::${SECRET_KEY}`;
  const hash = await sha256Hash(raw);
  // Take first 8 characters as activation code (uppercase)
  return hash.substring(0, 8).toUpperCase();
};

// ─── Validate Activation Code ─────────────────────────────────────────────────

export const validateActivationCode = async (
  deviceId: string,
  code: string,
): Promise<boolean> => {
  const expectedCode = await generateActivationCode(deviceId);
  return expectedCode === code.trim().toUpperCase();
};

// ─── Activate Device ──────────────────────────────────────────────────────────

export const activateDevice = async (
  code: string,
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    // Get device ID
    const deviceId = await getDeviceId();

    // Validate the code
    const isValid = await validateActivationCode(deviceId, code);

    if (!isValid) {
      return {
        success: false,
        message: 'Invalid activation code. Please check and try again.',
      };
    }

    // Save activation status to database
    await setSetting('activation_status', 'activated');
    await setSetting('activated_device_id', deviceId);

    return {
      success: true,
      message: 'Device activated successfully!',
    };
  } catch (error) {
    console.error('Activation error:', error);
    return {
      success: false,
      message: 'An error occurred during activation. Please try again.',
    };
  }
};

// ─── Check Activation Status ─────────────────────────────────────────────────

export const isDeviceActivated = async (): Promise<boolean> => {
  try {
    const status = await getSetting('activation_status');
    return status === 'activated';
  } catch (error) {
    console.error('Failed to check activation status:', error);
    return false;
  }
};

// ─── Get Activation Info ─────────────────────────────────────────────────────

export const getActivationInfo = async (): Promise<{
  isActivated: boolean;
  deviceId: string;
  activatedDeviceId: string | null;
}> => {
  try {
    const deviceId = await getDeviceId();
    const isActivated = await isDeviceActivated();
    const activatedDeviceId = await getSetting('activated_device_id');

    return {
      isActivated,
      deviceId,
      activatedDeviceId,
    };
  } catch (error) {
    console.error('Failed to get activation info:', error);
    return {
      isActivated: false,
      deviceId: 'ERROR',
      activatedDeviceId: null,
    };
  }
};
