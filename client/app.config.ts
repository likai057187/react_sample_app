import dotenv from 'dotenv';
import path from 'node:path';
import type { ExpoConfig } from 'expo/config';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const apiOrigin = (process.env.EXPO_PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:3847').replace(/\/$/, '');
const apiKey =
  (process.env.EXPO_PUBLIC_API_KEY ?? process.env.VITE_API_KEY ?? '').trim();

const config: ExpoConfig = {
  name: 'Chromatic Reasonance',
  slug: 'chromatic-reasonance',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'divineillumination',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'cover',
    backgroundColor: '#0A0A0B',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.chromaticreasonance.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0A0B',
    },
    package: 'com.chromaticreasonance.app',
  },
  web: {
    favicon: './assets/favicon.svg',
    name: 'Chromatic Reasonance',
    bundler: 'metro',
  },
  extra: {
    apiOrigin,
    apiKey,
  },
  plugins: [
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Divine Illumination to scan QR codes on artwork labels and collector tags.',
      },
    ],
  ],
};

export default { expo: config };
