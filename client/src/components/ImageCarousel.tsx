import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';

type Props = {
  urls: string[];
  alt: string;
  height?: number;
  horizontalInset?: number;
  borderRadius?: number;
  fit?: 'cover' | 'contain';
};

export function ImageCarousel({ urls, alt, height = 340, horizontalInset = 0, borderRadius = 0, fit = 'contain' }: Props) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(1, width - horizontalInset * 2);
  const [index, setIndex] = useState(0);
  const activeUrl = urls[index] ?? urls[0];
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -30) setIndex((current) => Math.min(urls.length - 1, current + 1));
          if (gesture.dx > 30) setIndex((current) => Math.max(0, current - 1));
        },
      }),
    [urls.length],
  );

  if (!urls.length) return null;
  return (
    <View style={[styles.wrap, { width: pageWidth, height, borderRadius }]} {...panResponder.panHandlers}>
      <Image source={{ uri: activeUrl }} style={[styles.img, { width: pageWidth, height }]} contentFit={fit} accessibilityLabel={alt} />
      {urls.length > 1 ? (
        <View style={styles.dots} pointerEvents="box-none">
          {urls.map((u, dotIndex) => (
            <Pressable
              accessibilityLabel={`Show image ${dotIndex + 1}`}
              key={`${u}-${dotIndex}`}
              onPress={() => setIndex(dotIndex)}
              style={[styles.dot, dotIndex === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#111' },
  img: { backgroundColor: '#111' },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(245,240,230,0.36)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#f5f0e6',
  },
});
