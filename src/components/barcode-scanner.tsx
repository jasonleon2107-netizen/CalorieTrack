import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Spacing, ThemeColors } from '@/constants/theme';
import { FoodProduct, lookupBarcode } from '@/lib/food';
import { CameraScanner } from './camera-scanner';
import { FoodPortionForm } from './food-portion-form';

type ScanState =
  | { phase: 'scanning' }
  | { phase: 'looking-up'; barcode: string }
  | { phase: 'found'; barcode: string; product: FoodProduct }
  | { phase: 'not-found'; barcode: string }
  | { phase: 'error'; barcode: string; message: string };

type NewEntry = { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number };

// Shared barcode flow. The live camera view is platform-specific (native uses
// expo-camera; web uses ZXing via camera-scanner.web.tsx); everything after a
// barcode is captured — lookup, result, errors — is shared here.
export function BarcodeScanner({
  colors,
  onAdd,
  onManualFallback,
}: {
  colors: ThemeColors;
  onAdd: (entry: NewEntry) => void;
  onManualFallback: (barcode?: string) => void;
}) {
  const [state, setState] = useState<ScanState>({ phase: 'scanning' });
  const styles = createStyles(colors);

  const handleScanned = async (barcode: string) => {
    setState({ phase: 'looking-up', barcode });
    const result = await lookupBarcode(barcode);
    if (result.status === 'found') {
      setState({ phase: 'found', barcode, product: result.product });
    } else if (result.status === 'not_found') {
      setState({ phase: 'not-found', barcode });
    } else {
      setState({ phase: 'error', barcode, message: result.message });
    }
  };

  if (state.phase === 'scanning') {
    return <CameraScanner colors={colors} onScanned={handleScanned} onManualFallback={() => onManualFallback()} />;
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
