import { Alert, Platform } from 'react-native';

// Cross-platform destructive confirm. react-native-web doesn't implement
// Alert.alert with buttons (the dialog never shows and onPress never fires), so
// on web we fall back to the browser's confirm. Native keeps the styled Alert.
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message ? `${title}\n\n${message}` : title)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
