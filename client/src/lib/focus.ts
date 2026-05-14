import { Platform } from 'react-native';

export function blurActiveElement() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}
