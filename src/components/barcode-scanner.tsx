import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Spacing, ThemeColors } from '@/constants/theme';
import { FoodProduct, lookupBarcode } from '@/lib/food';
import { FoodPortionForm } from './food-portion-form';

type ScanState =
  | { phase: 'scanning' }
  | { phase: 'looking-up'; barcode: string }
  | { phase: 'found'; barcode: string; product: FoodProduct }
  | { phase: 'not-found'; barcode: string }
  | { phase: 'error'; barcode: string; message: string };

type NewEntry = { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number };

export function BarcodeScanner({
  colors,
  onAdd,
  onManualFallback,
}: {
  colors: ThemeColors;
  onAdd: (entry: NewEntry) => void;
  onManualFallback: (barcode?: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ phase: 'scanning' });
  const styles = createStyles(colors);

  const handleScanned = async ({ data }: { data: string }) => {
    if (state.phase !== 'scanning') return;
    setState({ phase: 'looking-up', barcode: data });
    const result = await lookupBarcode(data);
    if (result.status === 'found') {
      setState({ phase: 'found', barcode: data, product: result.product });
    } else if (result.status === 'not_found') {
      setState({ phase: 'not-found', barcode: data });
    } else {
      setState({ phase: 'error', barcode: data, message: result.message });
    }
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
        <TouchableOpacity style={styles.secondaryButton} onPress={() => onManualFallback()}>
          <Text style={styles.secondaryButtonText}>Enter manually instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state.phase === 'scanning') {
    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={handleScanned}
        />
        <View style={styles.scanFrame} pointerEvents="none" />
        <Text style={styles.scanHint}>Point your camera at a barcode</Text>
      </View>
    );
  }

  if (state.phase === 'looking-up') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.body}>Looking up {state.barcode}…</Text>
      </View>
    );
  }

  if (state.phase === 'found') {
    return (
      <FoodPortionForm
        key={state.barcode}
        colors={colors}
        product={state.product}
        onAdd={(entry) => {
          onAdd(entry);
          // Jump straight back to the camera so the next item can be scanned.
          setState({ phase: 'scanning' });
        }}
        secondaryLabel="Scan another"
        onSecondary={() => setState({ phase: 'scanning' })}
      />
    );
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{state.phase === 'not-found' ? 'Product not found' : 'Lookup failed'}</Text>
      <Text style={styles.body}>
        {state.phase === 'not-found'
          ? `We couldn't find barcode ${state.barcode} in the Open Food Facts database.`
          : state.message}
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => setState({ phase: 'scanning' })}>
        <Text style={styles.primaryButtonText}>Try again</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => onManualFallback(state.barcode)}>
        <Text style={styles.secondaryButtonText}>Enter manually</Text>
      </TouchableOpacity>
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
