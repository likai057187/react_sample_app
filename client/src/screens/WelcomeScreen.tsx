import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../context/SessionProvider';

const GALLERY = 'Hyperion Galleries';
const TITLE = 'Chromatic Reasonance';
const TAGLINE =
  'Where sculpture, painting, and rhythm converge within an immersive contemporary dialogue.';
const VENUE = 'Rockefeller Center, NYC';
const EXHIBITION_DATE = 'May 14th, 2026';

const HERO_IMAGE_FADE_MS = 4200;
const HERO_INTRO_FALLBACK_MS = HERO_IMAGE_FADE_MS + 800;
const TAGLINE_CHAR_MS = 92;
const LINE_GAP_MS = 520;
const TAGLINE_EXIT_MS = 1350;
const REVEAL_STEP_HOLD_MS = 1350;

type IntroPhase = 'wait' | 'tagline' | 'taglineFadeOut' | 'done';

const webNoFocusInput =
  Platform.OS === 'web'
    ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none',
      } as unknown as TextStyle)
    : undefined;

function TypeLine({ text, count, style }: { text: string; count: number; style: object }) {
  const slice = text.slice(0, count);
  return (
    <Text style={style} accessibilityLabel={text}>
      {slice}
    </Text>
  );
}

export function WelcomeScreen() {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [introPhase, setIntroPhase] = useState<IntroPhase>('wait');
  const [tagCount, setTagCount] = useState(0);
  const [revealStep, setRevealStep] = useState(0);
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(1)).current;
  const galleryOpacity = useRef(new Animated.Value(0)).current;
  const galleryTranslate = useRef(new Animated.Value(14)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(18)).current;
  const venueOpacity = useRef(new Animated.Value(0)).current;
  const venueTranslate = useRef(new Animated.Value(12)).current;
  const dateOpacity = useRef(new Animated.Value(0)).current;
  const dateTranslate = useRef(new Animated.Value(12)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setReduceMotion(enabled);
      if (enabled) {
        bgOpacity.setValue(1);
        taglineOpacity.setValue(0);
        galleryOpacity.setValue(1);
        galleryTranslate.setValue(0);
        titleOpacity.setValue(1);
        titleTranslate.setValue(0);
        venueOpacity.setValue(1);
        venueTranslate.setValue(0);
        dateOpacity.setValue(1);
        dateTranslate.setValue(0);
        formOpacity.setValue(1);
        formTranslate.setValue(0);
        setIntroPhase('done');
        setTagCount(TAGLINE.length);
        setRevealStep(3);
      }
    });
    return () => {
      mounted = false;
    };
  }, [
    bgOpacity,
    dateOpacity,
    dateTranslate,
    formOpacity,
    formTranslate,
    galleryOpacity,
    galleryTranslate,
    taglineOpacity,
    titleOpacity,
    titleTranslate,
    venueOpacity,
    venueTranslate,
  ]);

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: HERO_IMAGE_FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [bgOpacity, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const startAt = Math.floor(HERO_IMAGE_FADE_MS / 2);
    const mainId = globalThis.setTimeout(() => setIntroPhase('tagline'), startAt);
    const fallbackId = globalThis.setTimeout(() => setIntroPhase('tagline'), HERO_INTRO_FALLBACK_MS);
    return () => {
      globalThis.clearTimeout(mainId);
      globalThis.clearTimeout(fallbackId);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || introPhase !== 'tagline') return;
    if (tagCount >= TAGLINE.length) {
      const id = globalThis.setTimeout(() => setIntroPhase('taglineFadeOut'), LINE_GAP_MS);
      return () => globalThis.clearTimeout(id);
    }
    const id = globalThis.setTimeout(() => setTagCount((n) => n + 1), TAGLINE_CHAR_MS);
    return () => globalThis.clearTimeout(id);
  }, [introPhase, reduceMotion, tagCount]);

  useEffect(() => {
    if (reduceMotion || introPhase !== 'taglineFadeOut') return;
    Animated.timing(taglineOpacity, {
      toValue: 0,
      duration: TAGLINE_EXIT_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIntroPhase('done');
    });
  }, [introPhase, reduceMotion, taglineOpacity]);

  useEffect(() => {
    if (reduceMotion || introPhase !== 'done') return;
    setRevealStep(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(galleryOpacity, {
          toValue: 1,
          duration: 680,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(galleryTranslate, {
          toValue: 0,
          duration: 680,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(Math.round(REVEAL_STEP_HOLD_MS * 0.25)),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(Math.round(REVEAL_STEP_HOLD_MS * 0.45)),
      Animated.parallel([
        Animated.timing(venueOpacity, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(venueTranslate, {
          toValue: 0,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(Math.round(REVEAL_STEP_HOLD_MS * 0.35)),
      Animated.parallel([
        Animated.timing(dateOpacity, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dateTranslate, {
          toValue: 0,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(Math.round(REVEAL_STEP_HOLD_MS * 0.35)),
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(formTranslate, {
          toValue: 0,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) setRevealStep(3);
    });
  }, [
    dateOpacity,
    dateTranslate,
    formOpacity,
    formTranslate,
    galleryOpacity,
    galleryTranslate,
    introPhase,
    reduceMotion,
    titleOpacity,
    titleTranslate,
    venueOpacity,
    venueTranslate,
  ]);

  const galleryStyle = useMemo(
    () => ({
      opacity: galleryOpacity,
      transform: [{ translateY: galleryTranslate }],
    }),
    [galleryOpacity, galleryTranslate],
  );

  const titleStyle = useMemo(
    () => ({
      opacity: titleOpacity,
      transform: [{ translateY: titleTranslate }],
    }),
    [titleOpacity, titleTranslate],
  );

  const venueStyle = useMemo(
    () => ({
      opacity: venueOpacity,
      transform: [{ translateY: venueTranslate }],
    }),
    [venueOpacity, venueTranslate],
  );

  const dateStyle = useMemo(
    () => ({
      opacity: dateOpacity,
      transform: [{ translateY: dateTranslate }],
    }),
    [dateOpacity, dateTranslate],
  );

  const formStyle = useMemo(
    () => ({
      opacity: formOpacity,
      transform: [{ translateY: formTranslate }],
    }),
    [formOpacity, formTranslate],
  );

  if (session.status !== 'ready') return null;
  const { patchDisplayName, refreshSession } = session;

  const onContinue = async () => {
    setError(null);
    setSaving(true);
    const res = await patchDisplayName(name.trim());
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await refreshSession();
  };

  return (
    <View style={[styles.bg, { paddingTop: insets.top + 12 }]}>
      <Animated.View style={[styles.heroWrap, { opacity: bgOpacity }]}>
        <Image source={require('../../public/welcome-chromatic-hero.jpg')} style={styles.heroImage} resizeMode="cover" />
      </Animated.View>
      <View style={styles.scrim} />
      {introPhase !== 'done' && (
        <Animated.View style={[styles.taglineIntro, { opacity: taglineOpacity }]}>
          <TypeLine text={TAGLINE} count={tagCount} style={styles.taglineIntroText} />
        </Animated.View>
      )}
      <View style={styles.content}>
        <View style={styles.copyStack}>
          <Animated.Text style={[styles.galleryTitle, galleryStyle]}>{GALLERY}</Animated.Text>
          <Animated.Text style={[styles.title, titleStyle]}>{TITLE}</Animated.Text>
          <Animated.Text style={[styles.meta, styles.metaVenue, venueStyle]}>{VENUE}</Animated.Text>
          <Animated.Text style={[styles.meta, styles.metaDate, dateStyle]}>{EXHIBITION_DATE}</Animated.Text>
        </View>
        <Animated.View style={[styles.form, formStyle, revealStep < 3 && styles.pointerOff]}>
          <View style={styles.inputShell}>
            <TextInput
              style={[styles.input, webNoFocusInput]}
              placeholder="Your Name"
              placeholderTextColor="rgba(245,240,230,0.58)"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!saving}
              onSubmitEditing={name.trim().length >= 2 ? onContinue : undefined}
              returnKeyType="go"
            />
            <Pressable
              accessibilityLabel="Enter"
              style={({ pressed }) => [
                styles.arrowButton,
                pressed && styles.arrowPressed,
                (saving || name.trim().length < 2) && styles.arrowDisabled,
              ]}
              onPress={onContinue}
              disabled={saving || name.trim().length < 2}
            >
              {saving ? (
                <Text style={styles.arrowSaving}>…</Text>
              ) : (
                <Ionicons name="arrow-forward" size={21} color="#1a1208" />
              )}
            </Pressable>
          </View>
          {error ? <Text style={styles.err}>{error}</Text> : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#050505', overflow: 'hidden' },
  heroWrap: { ...StyleSheet.absoluteFillObject },
  heroImage: { width: '100%', height: '100%' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  taglineIntro: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignItems: 'center',
    transform: [{ translateY: -34 }],
  },
  taglineIntroText: {
    color: '#f4efe3',
    fontFamily: Platform.select({
      ios: 'Bodoni 72',
      android: 'serif',
      web: 'Didot, "Bodoni 72", "Cormorant Garamond", Georgia, serif',
    }),
    fontSize: 24,
    lineHeight: 36,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: 0.35,
    maxWidth: 340,
    width: '100%',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyStack: { width: '100%', maxWidth: 356, alignItems: 'center' },
  galleryTitle: {
    color: '#f5f0e6',
    fontFamily: Platform.select({
      ios: 'Bodoni 72',
      android: 'serif',
      web: 'Didot, "Bodoni 72", "Cormorant Garamond", Georgia, serif',
    }),
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
    letterSpacing: 0.24,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  title: {
    color: '#f5f0e6',
    fontFamily: Platform.select({
      ios: 'Bodoni 72',
      android: 'serif',
      web: 'Didot, "Bodoni 72", "Cormorant Garamond", Georgia, serif',
    }),
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 31,
    marginTop: 4,
    letterSpacing: 0.25,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  meta: {
    color: 'rgba(245,240,230,0.78)',
    fontFamily: Platform.select({
      ios: 'Bodoni 72',
      android: 'serif',
      web: 'Didot, "Bodoni 72", Georgia, serif',
    }),
    marginTop: 11,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: 0.25,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.82)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  metaVenue: { marginTop: 18 },
  metaDate: { marginTop: 13 },
  form: { width: '100%', maxWidth: 340, marginTop: 56, gap: 10, alignSelf: 'center' },
  inputShell: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.38)',
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,12,0.66)',
  },
  input: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 12,
    fontSize: 17,
    color: '#f5f0e6',
    outlineWidth: 0,
  },
  err: { color: '#ffb4a8', fontSize: 13 },
  arrowButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#d6b565',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,235,170,0.62)',
    shadowColor: '#000',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  arrowPressed: { transform: [{ translateY: 1 }], opacity: 0.94 },
  arrowDisabled: { opacity: 0.56 },
  arrowSaving: { color: '#1a1208', fontSize: 24, lineHeight: 24, fontWeight: '700' },
  hidden: { opacity: 0 },
  pointerOff: { pointerEvents: 'none' },
});
