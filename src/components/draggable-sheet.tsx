import { PropsWithChildren, useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeColors } from '@/constants/theme';

// A bottom sheet you can flick or drag down to dismiss. Presented over a
// dimmed backdrop; the drag handle at the top is the grab point. Works on
// native and web (react-native-gesture-handler supports both).
export function DraggableSheet({
  visible,
  onClose,
  colors,
  children,
}: PropsWithChildren<{ visible: boolean; onClose: () => void; colors: ThemeColors }>) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Own SafeAreaProvider: safe-area context does not cross a Modal boundary. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SheetInner visible={visible} colors={colors} onClose={onClose} onClosed={() => setMounted(false)}>
          {children}
        </SheetInner>
      </SafeAreaProvider>
    </Modal>
  );
}

function SheetInner({
  visible,
  colors,
  onClose,
  onClosed,
  children,
}: PropsWithChildren<{ visible: boolean; colors: ThemeColors; onClose: () => void; onClosed: () => void }>) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(height);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      translateY.value = withTiming(height, { duration: 240 }, (finished) => {
        if (finished) runOnJS(onClosed)();
      });
    }
  }, [visible, height, translateY, onClosed]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - translateY.value / height) * 0.5 }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Animated.View style={[styles.sheet, { backgroundColor: colors.background }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={[styles.handleArea, { paddingTop: insets.top + 6 }]}>
            <View style={[styles.handle, { backgroundColor: colors.cardElevated }]} />
          </View>
        </GestureDetector>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingBottom: 6 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  body: { flex: 1 },
});
