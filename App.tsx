// App.tsx
// SmartPOS - Main Application Entry Point

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { TranslationProvider } from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/database';
import { isDeviceActivated } from './src/utils/licenseService';
import ActivationScreen from './src/screens/auth/ActivationScreen';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [showActivation, setShowActivation] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Initialize database
        await initDatabase();

        // 2. Check activation status
        const activated = await isDeviceActivated();

        // 3. If not activated, show activation screen
        if (!activated) {
          setShowActivation(true);
        } else {
          setShowActivation(false);
        }
      } catch (error) {
        console.error('App initialization error:', error);
        // In case of error, default to showing activation screen
        setShowActivation(true);
      } finally {
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  const handleActivated = () => {
    // User successfully activated the device
    setShowActivation(false);
  };

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A56A0" />
      </View>
    );
  }

  return (
    <TranslationProvider>
      {showActivation ? (
        <ActivationScreen onActivated={handleActivated} />
      ) : (
        <AppNavigator />
      )}
    </TranslationProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default App;
