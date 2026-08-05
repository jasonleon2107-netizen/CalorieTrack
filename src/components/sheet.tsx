import { PropsWithChildren } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeColors } from '@/constants/theme';

const isWeb = Platform.OS === 'web';

// The Add Food / Coach sheet.
//
// Native: a full-screen Modal that slides up from the bottom (dismiss via Close).
// An earlier drag-to-dismiss version was removed — gesture handlers don't work
// inside a RN Modal (it renders outside the app's gesture root).
//
// Web: a RN Modal covers the whole viewport, so a full-screen sheet becomes a
// tall edge-to-edge strip with its content stranded at the top. Instead we frame
// it as a centred, phone-proportioned card over a dim backdrop, which reads like
// the native sheet rather than a stretched page. Tapping the backdrop closes it.
export function Sheet({
  visible,
  onClose,
  colors,
  children,
}: PropsWithChildren<{ visible: boolean; onClose: () => void; colors: ThemeColors }>) {
  if (isWeb) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <View style={[styles.card, { backgroundColor: colors.background }]}>{children}</View>
          </View>
        </SafeAreaProvider>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Safe-area context does not cross a Modal boundary, so give it its own. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    // Sit the card low, like a bottom sheet floating just above the edge, with
    // the app peeking through above it.
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    height: '92%',
    maxHeight: 900,
    borderRadius: 22,
    overflow: 'hidden',
  },
});
