import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Spacing, ThemeColors } from '@/constants/theme';
import { type LogEntry } from '@/context/log-context';
import { round } from '@/lib/health';

// A single logged food row. Shared by the Today screen and History detail.
export function EntryRow({
  colors,
  entry,
  onDelete,
}: {
  colors: ThemeColors;
  entry: LogEntry;
  onDelete?: () => void;
}) {
  const styles = createStyles(colors);
  return (
    <View style={styles.entryRow}>
      <View style={styles.entryInfo}>
        <Text style={styles.entryName}>{entry.name}</Text>
        <View style={styles.entryMacroRow}>
          <Text style={[styles.entryMacro, { color: colors.protein }]}>{round(entry.proteinG)}g protein</Text>
          <Text style={[styles.entryMacro, { color: colors.carbs }]}>{round(entry.carbsG)}g carbs</Text>
          <Text style={[styles.entryMacro, { color: colors.fat }]}>{round(entry.fatG)}g fat</Text>
        </View>
      </View>
      <Text style={styles.entryKcal}>{round(entry.kcal)}</Text>
      {onDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: Spacing.two,
    },
    entryInfo: { flex: 1, minWidth: 0 },
    entryName: { fontWeight: '600', fontSize: 15, color: colors.text },
    entryMacroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: 3 },
    entryMacro: { fontSize: 12, fontWeight: '700' },
    entryKcal: { fontWeight: '700', fontSize: 15, color: colors.text, marginRight: Spacing.two },
    deleteButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    deleteButtonText: { color: colors.muted, fontSize: 15 },
  });
}
