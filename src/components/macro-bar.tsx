import { StyleSheet, Text, View } from 'react-native';

import { ThemeColors } from '@/constants/theme';
import { round } from '@/lib/health';

export function MacroBar({
  colors,
  label,
  grams,
  goalGrams,
  color,
}: {
  colors: ThemeColors;
  label: string;
  grams: number;
  goalGrams: number;
  color: string;
}) {
  const pct = goalGrams > 0 ? Math.min(grams / goalGrams, 1) : 0;
  const remaining = goalGrams - grams;
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text style={styles.value}>
          {round(grams)}
          {goalGrams ? `/${goalGrams}` : ''}g
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      {goalGrams > 0 && (
        <Text style={[styles.remaining, { color: remaining < 0 ? colors.danger : color }]}>
          {remaining > 0 ? `${round(remaining)}g left` : remaining === 0 ? 'Goal met' : `${round(-remaining)}g over`}
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    label: { fontSize: 12, fontWeight: '700' },
    value: { fontSize: 12, fontWeight: '700', color: colors.text },
    track: { height: 6, backgroundColor: colors.cardElevated, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    remaining: { fontSize: 11, fontWeight: '700', marginTop: 5 },
  });
}
