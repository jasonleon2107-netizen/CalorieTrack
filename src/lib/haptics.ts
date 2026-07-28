import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Web fallback: navigator.vibrate works on Android browsers but is a no-op on
// iOS Safari (Apple doesn't expose vibration to the web). Native uses the real
// Taptic engine via expo-haptics.
function webVibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof (navigator as Navigator).vibrate === 'function') {
    (navigator as Navigator).vibrate(pattern);
  }
}

// A light tap — logging a food, pressing a control.
export function tapHaptic() {
  if (Platform.OS === 'web') return webVibrate(10);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// A crisp success — committing a batch, hitting a milestone, a barcode lock.
export function successHaptic() {
  if (Platform.OS === 'web') return webVibrate([12, 40, 12]);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// A subtle selection tick — cycling the ring, switching a toggle.
export function selectionHaptic() {
  if (Platform.OS === 'web') return webVibrate(6);
  Haptics.selectionAsync().catch(() => {});
}
