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

function useWebVisualViewportHeight() {
  const [height, setHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const viewport = window.visualViewport;
    const update = () => {
      setHeight(Math.round(viewport?.height ?? window.innerHeight));
    };

    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return height;
}

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
  const webHeight = useWebVisualViewportHeight();

  return (
    <GestureHandlerRootView
      style={[
        styles.gestureRoot,
        Platform.OS === 'web' && styles.webRoot,
        Platform.OS === 'web' && (webHeight ? { height: webHeight } : styles.webRootFallback),
      ]}
    >
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
    backgroundColor: '#0a0a0b',
  },
  webRoot: {
    width: '100%',
    overflow: 'hidden',
  },
  webRootFallback: {
    height: '100dvh' as unknown as number,
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
