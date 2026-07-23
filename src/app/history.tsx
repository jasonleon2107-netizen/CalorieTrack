import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { EntryRow } from '@/components/entry-row';
import { MacroBar } from '@/components/macro-bar';
import { Spacing, ThemeColors } from '@/constants/theme';
import { dateKey, MEALS, useLog, type LogEntry } from '@/context/log-context';
import { useProfile } from '@/context/profile-context';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { round } from '@/lib/health';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A day counts as "goal met" when its total lands within 10% of the target,
// which works whether you're cutting, maintaining, or bulking.
const GOAL_BAND = 0.1;

type DayStatus = 'met' | 'under' | 'missed' | 'neutral';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function HistoryScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { entriesFor, removeEntry } = useLog();
  const { goalKcal, macros } = useProfile();

  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const goal = goalKcal ?? 0;

  const statusFor = (day: Date): DayStatus => {
    const entries = entriesFor(dateKey(day));
    const isFuture = day.getTime() > today.getTime();
    const isToday = day.getTime() === today.getTime();
    if (isFuture) return 'neutral';
    const total = entries.reduce((s, e) => s + e.kcal, 0);
    if (goal > 0 && entries.length > 0 && total >= goal * (1 - GOAL_BAND) && total <= goal * (1 + GOAL_BAND)) {
      return 'met';
    }
    if (entries.length === 0) {
      // Today is still in progress, so an empty day isn't a miss yet.
      return isToday ? 'neutral' : 'missed';
    }
    return 'under';
  };

  const dayColor = (status: DayStatus) => {
    switch (status) {
      case 'met':
        return colors.protein;
      case 'under':
        return colors.muted;
      case 'missed':
        return colors.danger;
      default:
        return colors.text;
    }
  };

  // Leading blanks so the 1st lands on the right weekday, then each day.
  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = new Date(year, month, 1).getDay();
    const out: (Date | null)[] = Array(leading).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    return out;
  }, [viewMonth]);

  const shiftMonth = (delta: number) =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const selectedKey = dateKey(selected);
  const selectedEntries = entriesFor(selectedKey);
  const totals = selectedEntries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
  const diff = goal - totals.kcal;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>History</Text>

          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={12} style={styles.monthArrow}>
              <Text style={styles.monthArrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={12} style={styles.monthArrow}>
              <Text style={styles.monthArrowText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`${d}-${i}`} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          <Animated.View style={styles.grid} layout={LinearTransition.duration(200)}>
            {cells.map((day, i) => {
              if (!day) return <View key={`blank-${i}`} style={styles.cell} />;
              const status = statusFor(day);
              const isSelected = day.getTime() === selected.getTime();
              const isToday = day.getTime() === today.getTime();
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={styles.cell}
                  activeOpacity={0.6}
                  onPress={() => setSelected(day)}>
                  <View style={[styles.dayInner, isSelected && styles.dayInnerSelected, isToday && styles.dayInnerToday]}>
                    <Text style={[styles.dayText, { color: dayColor(status) }]}>{day.getDate()}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          <View style={styles.legend}>
            <LegendDot colors={colors} color={colors.protein} label="Goal met" />
            <LegendDot colors={colors} color={colors.muted} label="Logged, off target" />
            <LegendDot colors={colors} color={colors.danger} label="Nothing logged" />
          </View>

          <Animated.View key={selectedKey} entering={FadeIn.duration(220)} style={styles.detail}>
            <Text style={styles.detailDate}>
              {selected.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <Text style={styles.summaryTotal}>{round(totals.kcal)}</Text>
                <Text style={styles.summaryOf}>of {goal} cal</Text>
              </View>
              <Text style={[styles.summaryDiff, { color: diff >= 0 ? colors.protein : colors.danger }]}>
                {diff >= 0 ? `${round(diff)} under goal` : `${round(-diff)} over goal`}
              </Text>
              <View style={styles.macroRow}>
                <MacroBar colors={colors} label="Protein" grams={totals.proteinG} goalGrams={macros?.proteinG ?? 0} color={colors.protein} />
                <MacroBar colors={colors} label="Carbs" grams={totals.carbsG} goalGrams={macros?.carbsG ?? 0} color={colors.carbs} />
                <MacroBar colors={colors} label="Fat" grams={totals.fatG} goalGrams={macros?.fatG ?? 0} color={colors.fat} />
              </View>
            </View>

            {selectedEntries.length === 0 ? (
              <Text style={styles.emptyDay}>Nothing logged this day.</Text>
            ) : (
              MEALS.map((m) => {
                const mealEntries = selectedEntries.filter((e: LogEntry) => e.meal === m.key);
                if (mealEntries.length === 0) return null;
                const mealKcal = mealEntries.reduce((s, e) => s + e.kcal, 0);
                return (
                  <View key={m.key} style={styles.mealSection}>
                    <View style={styles.mealHeader}>
                      <Text style={styles.mealTitle}>{m.label}</Text>
                      <Text style={styles.mealKcal}>{round(mealKcal)} cal</Text>
                    </View>
                    {mealEntries.map((item) => (
                      <Animated.View
                        key={item.id}
                        entering={FadeIn.duration(180)}
                        exiting={FadeOut.duration(140)}
                        layout={LinearTransition.duration(180)}>
                        <EntryRow colors={colors} entry={item} onDelete={() => removeEntry(selectedKey, item.id)} />
                      </Animated.View>
                    ))}
                  </View>
                );
              })
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LegendDot({ colors, color, label }: { colors: ThemeColors; color: string; label: string }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    scrollContent: { padding: Spacing.three, paddingBottom: Spacing.six * 2 },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: Spacing.three },
    monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    monthArrowText: { color: colors.accent, fontSize: 26, fontWeight: '600' },
    monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
    weekRow: { flexDirection: 'row', marginTop: Spacing.two },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.one },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
    dayInner: {
      flex: 1,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    dayInnerSelected: { backgroundColor: colors.cardElevated, borderColor: colors.accent },
    dayInnerToday: { backgroundColor: colors.card },
    dayText: { fontSize: 15, fontWeight: '700' },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.three },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 11, color: colors.muted },
    detail: { marginTop: Spacing.five },
    detailDate: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: Spacing.two },
    summaryCard: { backgroundColor: colors.card, borderRadius: 16, padding: Spacing.three },
    summaryTop: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
    summaryTotal: { fontSize: 30, fontWeight: '800', color: colors.text },
    summaryOf: { fontSize: 13, color: colors.muted },
    summaryDiff: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    macroRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
    emptyDay: { color: colors.muted, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.four },
    mealSection: { marginTop: Spacing.four },
    mealHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.two,
    },
    mealTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    mealKcal: { fontSize: 13, fontWeight: '700', color: colors.accent },
  });
}
