import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { AddFood } from '@/components/add-food';
import { CalorieRing } from '@/components/calorie-ring';
import { EntryRow } from '@/components/entry-row';
import { MacroBar } from '@/components/macro-bar';
import { Spacing, ThemeColors } from '@/constants/theme';
import { dateKey, MEALS, MealCategory, useLog } from '@/context/log-context';
import { useProfile } from '@/context/profile-context';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { round } from '@/lib/health';

const ALL_OPEN: Record<MealCategory, boolean> = { breakfast: true, lunch: true, dinner: true, snack: true };

export default function TodayScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { goalKcal, macros } = useProfile();
  const { entriesFor, addEntries, removeEntry } = useLog();
  const insets = useSafeAreaInsets();
  const [addingFood, setAddingFood] = useState(false);
  const [openMeals, setOpenMeals] = useState<Record<MealCategory, boolean>>(ALL_OPEN);

  // Native tab bar is ~49pt tall and sits above the home-indicator inset.
  // Float the FAB clear of both so it never overlaps the tabs.
  const fabBottom = insets.bottom + 49 + Spacing.three;

  const key = dateKey(new Date());
  const entries = entriesFor(key);

  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const goal = goalKcal ?? 0;
  const toggleMeal = (m: MealCategory) => setOpenMeals((prev) => ({ ...prev, [m]: !prev[m] }));

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.dateLabel}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.title}>Today</Text>
          </View>

          <CalorieRing consumed={totals.kcal} goal={goal} colors={colors} />

          <View style={styles.macroRow}>
            <MacroBar colors={colors} label="Protein" grams={totals.proteinG} goalGrams={macros?.proteinG ?? 0} color={colors.protein} />
            <MacroBar colors={colors} label="Carbs" grams={totals.carbsG} goalGrams={macros?.carbsG ?? 0} color={colors.carbs} />
            <MacroBar colors={colors} label="Fat" grams={totals.fatG} goalGrams={macros?.fatG ?? 0} color={colors.fat} />
          </View>

          {MEALS.map((m) => {
            const mealEntries = entries.filter((e) => e.meal === m.key);
            const mealKcal = mealEntries.reduce((sum, e) => sum + e.kcal, 0);
            const open = openMeals[m.key];
            return (
              <Animated.View key={m.key} style={styles.mealSection} layout={LinearTransition.duration(220)}>
                <TouchableOpacity style={styles.mealHeader} onPress={() => toggleMeal(m.key)} activeOpacity={0.6}>
                  <MealChevron colors={colors} open={open} />
                  <Text style={styles.mealTitle}>{m.label}</Text>
                  <Text style={styles.mealCount}>({mealEntries.length})</Text>
                  <View style={styles.mealHeaderSpacer} />
                  <Text style={styles.mealKcal}>{round(mealKcal)} cal</Text>
                </TouchableOpacity>

                {open &&
                  (mealEntries.length === 0 ? (
                    <Animated.Text
                      style={styles.emptyText}
                      entering={FadeIn.duration(180)}
                      exiting={FadeOut.duration(120)}>
                      Nothing logged
                    </Animated.Text>
                  ) : (
                    mealEntries.map((item) => (
                      <Animated.View
                        key={item.id}
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(150)}
                        layout={LinearTransition.duration(200)}>
                        <EntryRow colors={colors} entry={item} onDelete={() => removeEntry(key, item.id)} />
                      </Animated.View>
                    ))
                  ))}
              </Animated.View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={[styles.fab, { bottom: fabBottom }]} onPress={() => setAddingFood(true)}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <Modal
        visible={addingFood}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setAddingFood(false)}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <AddFood
            colors={colors}
            onClose={() => setAddingFood(false)}
            onCommit={(entries) => {
              addEntries(key, entries);
              setAddingFood(false);
            }}
          />
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

// Rotates between pointing right (collapsed) and down (expanded).
function MealChevron({ colors, open }: { colors: ThemeColors; open: boolean }) {
  const styles = createStyles(colors);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '90deg' : '0deg', { duration: 200 }) }],
  }));
  return <Animated.Text style={[styles.mealChevron, style]}>▸</Animated.Text>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    scrollContent: { padding: Spacing.three, paddingBottom: Spacing.six * 2 },
    header: { marginBottom: Spacing.two },
    dateLabel: { fontSize: 13, color: colors.muted, letterSpacing: 0.3 },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },
    macroRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four },
    mealSection: { marginTop: Spacing.four },
    mealHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two },
    mealChevron: { fontSize: 13, color: colors.muted, width: 16 },
    mealTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    mealCount: { fontSize: 13, color: colors.muted, marginLeft: Spacing.one },
    mealHeaderSpacer: { flex: 1 },
    mealKcal: { fontSize: 13, fontWeight: '700', color: colors.accent },
    emptyText: { color: colors.muted, fontSize: 13, paddingVertical: Spacing.two, paddingLeft: 16 },
    fab: {
      position: 'absolute',
      right: Spacing.four,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    fabIcon: { fontSize: 30, color: '#FFFFFF', fontWeight: '400', marginTop: -2 },
  });
}
