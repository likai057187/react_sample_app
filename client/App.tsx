import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SessionProvider, useSession } from './src/context/SessionProvider';
import { AuctionProvider } from './src/context/AuctionProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { blurActiveElement } from './src/lib/focus';
import { initLocalStores } from './src/lib/localStoresInit';

function AppGate() {
  const session = useSession();

  React.useEffect(() => {
    void initLocalStores();
  }, []);

  if (session.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#c9a962" />
        <Text style={styles.muted}>Connecting…</Text>
      </View>
    );
  }

  if (session.status === 'error') {
    return (
      <View style={[styles.center, styles.pad]}>
        <Text style={styles.error}>{session.message}</Text>
        <Text style={styles.hint}>
          Start the API (`npm run dev:api` from repo root) and ensure API_KEY / VITE_API_KEY match in `.env`.
        </Text>
      </View>
    );
  }

  if (!session.welcomeComplete) {
    return <WelcomeScreen />;
  }

  return (
    <AuctionProvider>
      <NavigationContainer onStateChange={blurActiveElement}>
        <AppNavigator />
      </NavigationContainer>
    </AuctionProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="light" />
          <AppGate />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    ...(Platform.OS === 'web' ? { width: '100%', minHeight: '100vh' as unknown as number } : {}),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0b',
    gap: 12,
  },
  pad: { padding: 20 },
  muted: { color: '#8a8a8f', marginTop: 8 },
  error: { color: '#ffb4a8', textAlign: 'center' },
  hint: { color: '#8a8a8f', textAlign: 'center', marginTop: 12, maxWidth: 320 },
});
