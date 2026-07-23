import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing, ThemeColors } from '@/constants/theme';
import { FoodProduct } from '@/lib/food';
import { round } from '@/lib/health';
import { SegmentedControl } from './segmented-control';

type PortionEntry = { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number };

// Shared "how much of this food?" UI: a servings/grams toggle, amount input,
// live totals, and Add. Used by both the barcode result and search result flows.
export function FoodPortionForm({
  colors,
  product,
  onAdd,
  secondaryLabel,
  onSecondary,
}: {
  colors: ThemeColors;
  product: FoodProduct;
  onAdd: (entry: PortionEntry) => void;
  secondaryLabel: string;
  onSecondary: () => void;
}) {
  const styles = createStyles(colors);
  const startMode = product.serving ? 'servings' : 'grams';
  const [mode, setMode] = useState<'servings' | 'grams'>(startMode);
  const [amountStr, setAmountStr] = useState(startMode === 'servings' ? '1' : '100');

  const amount = Number(amountStr) || 0;
  const basis = mode === 'servings' ? product.serving : product.per100g;
  const factor = mode === 'servings' ? amount : amount / 100;
  const kcal = round((basis?.kcal ?? 0) * factor);
  const proteinG = round((basis?.protein ?? 0) * factor);
  const carbsG = round((basis?.carbs ?? 0) * factor);
  const fatG = round((basis?.fat ?? 0) * factor);

  const perLabel = mode === 'servings' ? `per serving (${product.serving?.label ?? '1 serving'})` : 'per 100 g';

  const switchMode = (next: 'servings' | 'grams') => {
    setMode(next);
    setAmountStr(next === 'servings' ? '1' : '100');
  };

  return (
    <Animated.View style={styles.wrap} entering={FadeIn.duration(200)}>
      <Text style={styles.productName}>{product.name}</Text>

      {product.serving && product.per100g && (
        <SegmentedControl
          colors={colors}
          variant="subtle"
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'servings' as const, label: 'Servings' },
            { value: 'grams' as const, label: 'Grams' },
          ]}
        />
      )}

      <Text style={styles.body}>
        {perLabel}: {round(basis?.kcal ?? 0)} cal · {round(basis?.protein ?? 0)}g protein ·{' '}
        {round(basis?.carbs ?? 0)}g carbs · {round(basis?.fat ?? 0)}g fat
      </Text>

      <View style={styles.qtyRow}>
        <Text style={styles.qtyLabel}>{mode === 'servings' ? 'Servings' : 'Grams'}</Text>
        <TextInput
          value={amountStr}
          onChangeText={setAmountStr}
          keyboardType="decimal-pad"
          style={styles.qtyInput}
          placeholderTextColor={colors.muted}
        />
      </View>

      <View style={styles.totalMacroRow}>
        <Text style={styles.totalKcal}>{kcal} cal</Text>
        <Text style={[styles.totalMacro, { color: colors.protein }]}>{proteinG}g protein</Text>
        <Text style={[styles.totalMacro, { color: colors.carbs }]}>{carbsG}g carbs</Text>
        <Text style={[styles.totalMacro, { color: colors.fat }]}>{fatG}g fat</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => onAdd({ name: product.name, kcal, proteinG, carbsG, fatG })}>
        <Text style={styles.primaryButtonText}>Add to today</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={onSecondary}>
        <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { padding: Spacing.four, gap: Spacing.two },
    productName: { fontSize: 18, fontWeight: '700', color: colors.text },
    body: { fontSize: 13, color: colors.muted },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
    qtyLabel: { fontSize: 14, color: colors.muted },
    qtyInput: {
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      color: colors.text,
      fontSize: 16,
      minWidth: 80,
    },
    totalMacroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
    totalKcal: { fontSize: 15, color: colors.text, fontWeight: '700' },
    totalMacro: { fontSize: 13, fontWeight: '700' },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: Spacing.two,
    },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    secondaryButton: { paddingVertical: Spacing.two, alignItems: 'center' },
    secondaryButtonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  });
}
