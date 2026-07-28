import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Spacing, ThemeColors } from '@/constants/theme';
import { successHaptic } from '@/lib/haptics';

// Native (iOS) live barcode camera, backed by expo-camera's hardware scanner.
export function CameraScanner({
  colors,
  onScanned,
  onManualFallback,
}: {
  colors: ThemeColors;
  onScanned: (barcode: string) => void;
  onManualFallback: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const styles = createStyles(colors);
  // The camera can fire several times before the parent unmounts us; only
  // report the first hit.
  const handled = useRef(false);
  const [locked, setLocked] = useState(false);
  const lock = useSharedValue(0);

  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + lock.value * 0.06 }],
    borderColor: interpolateColor(lock.value, [0, 1], [colors.accent, colors.protein]),
  }));

  const onDetected = (data: string) => {
    if (handled.current) return;
    handled.current = true;
    setLocked(true);
    successHaptic();
    lock.value = withTiming(1, { duration: 200 });
    // Brief "locked on" beat before handing off to the lookup.
    setTimeout(() => onScanned(data), 340);
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.body}>
          We use your camera to scan food barcodes and look up nutrition info. Nothing is stored or shared.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant camera access</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryButton} onPress={onManualFallback}>
          <Text style={styles.secondaryButtonText}>Enter manually instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={({ data }) => onDetected(data)}
      />
      <Animated.View style={[styles.scanFrame, frameStyle]} pointerEvents="none" />
      <Text style={styles.scanHint}>{locked ? 'Got it!' : 'Point your camera at a barcode'}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
    cameraWrap: { flex: 1, margin: Spacing.three, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
    scanFrame: {
      position: 'absolute',
      top: '30%',
      left: '15%',
      right: '15%',
      height: '25%',
      borderWidth: 2,
      borderColor: colors.accent,
      borderRadius: 12,
    },
    scanHint: {
      position: 'absolute',
      bottom: Spacing.four,
      alignSelf: 'center',
      color: '#FFFFFF',
      fontSize: 13,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      borderRadius: 8,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
    body: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: Spacing.five,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    secondaryButton: { paddingVertical: Spacing.two },
    secondaryButtonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  });
}
