import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuction } from '../context/AuctionProvider';
import { blurActiveElement } from '../lib/focus';
import { parseArtworkIdFromQr } from '../lib/qrPayload';
import { matchArtworkFrame } from '../lib/apiClient';
import type { Artwork } from '../types';
import type { MainTabParamList } from '../navigation/AppNavigator';

const SCAN_INTERVAL_MS = 1500;
const FIRST_SCAN_DELAY_MS = 900;
const MATCH_FRAME_MAX_EDGE = 640;
const MATCH_FRAME_JPEG_QUALITY = 0.45;

type CapturedFrame = {
  uri?: string;
  base64?: string;
  width?: number;
  height?: number;
};

async function resizeFrameForMatch(frame: CapturedFrame): Promise<string | null> {
  if (!frame.uri) return frame.base64 ?? null;
  const width = frame.width ?? 0;
  const height = frame.height ?? 0;
  const resize =
    width > 0 && height > 0 && width >= height
      ? { width: MATCH_FRAME_MAX_EDGE }
      : { height: MATCH_FRAME_MAX_EDGE };
  const resized = await manipulateAsync(frame.uri, [{ resize }], {
    compress: MATCH_FRAME_JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return resized.base64 ?? frame.base64 ?? null;
}

export function DiscoveryScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const isFocused = useIsFocused();
  const { getArtwork } = useAuction();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const inFlight = useRef(false);
  const navigationLocked = useRef(false);
  const servicePaused = useRef(false);
  const lastScan = useRef<{ t: number; d: string }>({ t: 0, d: '' });
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const openArtwork = useCallback(
    (artwork: Artwork) => {
      blurActiveElement();
      navigationLocked.current = true;
      nav.navigate('Inventory', { screen: 'InventoryArtwork', params: { id: artwork.id, returnTo: 'inventory' } });
    },
    [nav],
  );

  const tryResolve = useCallback(
    (raw: string) => {
      const id = parseArtworkIdFromQr(raw) ?? (raw.trim() ? raw.trim() : null);
      if (!id) return false;
      const a = getArtwork(id);
      if (!a) return false;
      openArtwork(a);
      return true;
    },
    [getArtwork, openArtwork],
  );

  const onBarcode = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      if (data === lastScan.current.d && now - lastScan.current.t < 2500) return;
      lastScan.current = { t: now, d: data };
      tryResolve(data);
    },
    [tryResolve],
  );

  const scanFrame = useCallback(async () => {
    if (!isFocused || !permission?.granted || !cameraReady || inFlight.current || navigationLocked.current || servicePaused.current) return;
    const camera = cameraRef.current;
    if (!camera) return;

    inFlight.current = true;
    try {
      const picture = await camera.takePictureAsync({ quality: MATCH_FRAME_JPEG_QUALITY, base64: true });
      const imageBase64 = picture ? await resizeFrameForMatch(picture) : null;
      if (!imageBase64) {
        return;
      }
      const result = await matchArtworkFrame(imageBase64);
      if (result.match) {
        const artwork = getArtwork(result.match.artworkId);
        if (artwork) {
          openArtwork(artwork);
          return;
        }
      }

      if (result.error === 'roboflow_not_configured') {
        servicePaused.current = true;
        return;
      }
    } catch {
      // Keep retrying silently; the scanner UI stays minimal.
    } finally {
      inFlight.current = false;
    }
  }, [cameraReady, getArtwork, isFocused, openArtwork, permission?.granted]);

  useEffect(() => {
    if (!isFocused || !permission?.granted || !cameraReady) return;
    inFlight.current = false;
    navigationLocked.current = false;
    const first = globalThis.setTimeout(() => void scanFrame(), FIRST_SCAN_DELAY_MS);
    const interval = globalThis.setInterval(() => void scanFrame(), SCAN_INTERVAL_MS);
    return () => {
      globalThis.clearTimeout(first);
      globalThis.clearInterval(interval);
    };
  }, [cameraReady, isFocused, permission?.granted, scanFrame]);

  return (
    <View style={styles.root}>
      {!permission?.granted ? (
        <View style={[styles.perm, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.eyebrow}>Discovery</Text>
          <Text style={styles.title}>Scan Artwork</Text>
          <Text style={styles.permText}>Camera access lets us identify artworks and open their detail page automatically.</Text>
          <Pressable style={styles.permBtn} onPress={() => void requestPermission()}>
            <Text style={styles.permBtnText}>Allow camera</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarcode}
            onCameraReady={() => setCameraReady(true)}
          />
          <View pointerEvents="none" style={[styles.topOverlay, { paddingTop: insets.top + 14 }]}>
            <Text style={styles.eyebrow}>Discovery</Text>
            <Text style={styles.title}>Scan Artwork</Text>
            <View style={styles.liveStatus}>
              <Animated.View style={[styles.statusDot, { opacity: pulse }]} />
              <Text style={styles.statusTitle}>Live recognition</Text>
            </View>
          </View>
          <View pointerEvents="none" style={styles.edgeFrame}>
            <View style={[styles.edgeCorner, styles.edgeCornerTl]} />
            <View style={[styles.edgeCorner, styles.edgeCornerTr]} />
            <View style={[styles.edgeCorner, styles.edgeCornerBl]} />
            <View style={[styles.edgeCorner, styles.edgeCornerBr]} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  perm: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0a0a0b', alignItems: 'center' },
  eyebrow: { color: '#c9a962', fontSize: 12, letterSpacing: 2.4, textTransform: 'uppercase' },
  title: { color: '#f5f0e6', fontSize: 32, fontWeight: '700', fontFamily: 'serif', marginTop: 6 },
  permText: { color: '#d8d4cc', textAlign: 'center', marginVertical: 16, lineHeight: 21 },
  permBtn: { alignSelf: 'center', backgroundColor: '#c9a962', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: '#1a1208', fontWeight: '700' },
  topOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  edgeFrame: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8,
    bottom: 8,
  },
  edgeCorner: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderColor: '#c9a962',
  },
  edgeCornerTl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  edgeCornerTr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  edgeCornerBl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  edgeCornerBr: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  liveStatus: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 28,
    marginTop: 14,
  },
  statusTitle: { color: '#f5f0e6', fontWeight: '700', fontSize: 14 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff9a8f' },
});
