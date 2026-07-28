import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { wa } from '@/lib/anim';
import { selectionHaptic, successHaptic, tapHaptic } from '@/lib/haptics';

import { AddFood } from '@/components/add-food';
import { CalorieRing, type RingMetric } from '@/components/calorie-ring';
import { DraggableSheet } from '@/components/draggable-sheet';
import { EntryRow } from '@/components/entry-row';
import { MacroBar } from '@/components/macro-bar';
import { roundedFont, Spacing, ThemeColors } from '@/constants/theme';
import { dateKey, defaultMealForNow, MEALS, MealCategory, useLog, type RecentFood } from '@/context/log-context';
import { useProfile } from '@/context/profile-context';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { round } from '@/lib/health';
import { computeStreaks } from '@/lib/streak';

const ALL_OPEN: Record<MealCategory, boolean> = { breakfast: true, lunch: true, dinner: true, snack: true };
const MEAL_EMPTY: Record<MealCategory, string> = {
  breakfast: 'No breakfast yet',
  lunch: 'No lunch yet',
  dinner: 'No dinner yet',
  snack: 'No snacks yet',
};

// One-time celebratory milestones, in ascending priority.
function applicableMilestones(daysLogged: number, streak: number): { id: string; msg: string }[] {
  const out: { id: string; msg: string }[] = [];
  if (daysLogged >= 1) out.push({ id: 'first', msg: 'First day logged. Great start!' });
  if (daysLogged >= 7) out.push({ id: 'week1', msg: 'A full week logged. The habit is forming!' });
  if (streak >= 7) out.push({ id: 'streak7', msg: "7-day streak — you're on a roll!" });
  if (streak >= 30) out.push({ id: 'streak30', msg: '30-day streak. Incredible consistency!' });
  return out;
}

export default function TodayScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { goalKcal, macros } = useProfile();
  const { entriesFor, addEntry, addEntries, removeEntry, recents, loggedDateKeys, milestones, markMilestone } = useLog();
  const [toast, setToast] = useState<string | null>(null);
  const milestoneSeeded = useRef(false);

  // Celebrate a newly-reached milestone. On first mount we mark existing ones as
  // seen without celebrating, so returning users aren't greeted with old news.
  useEffect(() => {
    const streak = computeStreaks(loggedDateKeys).current;
    const apps = applicableMilestones(loggedDateKeys.length, streak);
    if (!milestoneSeeded.current) {
      milestoneSeeded.current = true;
      apps.forEach((a) => { if (!milestones.includes(a.id)) markMilestone(a.id); });
      return;
    }
    const fresh = [...apps].reverse().find((a) => !milestones.includes(a.id));
    if (fresh) {
      markMilestone(fresh.id);
      setToast(fresh.msg);
      successHaptic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedDateKeys]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  const insets = useSafeAreaInsets();
  const [addingFood, setAddingFood] = useState(false);
  const [openMeals, setOpenMeals] = useState<Record<MealCategory, boolean>>(ALL_OPEN);
  const [ringMetric, setRingMetric] = useState<RingMetric>('calories');
  const [pulseKey, setPulseKey] = useState(0);
  const [viewedDate, setViewedDate] = useState(() => new Date());
  const cycleMetric = () => {
    selectionHaptic();
    const seq: RingMetric[] = ['calories', 'protein', 'carbs', 'fat'];
    setRingMetric((m) => seq[(seq.indexOf(m) + 1) % seq.length]);
  };

  // Move the viewed day by ±1, never into the future.
  const changeDay = (delta: number) => {
    setViewedDate((d) => {
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
      const t = new Date();
      const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate());
      if (next.getTime() > todayStart.getTime()) return d;
      selectionHaptic();
      return next;
    });
  };
  // Horizontal swipe changes the day; vertical movement lets the list scroll.
  const daySwipe = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX > 60) runOnJS(changeDay)(-1);
      else if (e.translationX < -60) runOnJS(changeDay)(1);
    });

  // Float the FAB clear of the tab bar. On web the tab bar is a floating pill
  // at the bottom-centre (see +html.tsx); on native it's the OS bottom bar
  // above the home-indicator inset.
  const fabBottom = Platform.OS === 'web' ? 88 : insets.bottom + 49 + Spacing.three;
  // Enough scroll padding that the last meal's calories always clear the FAB.
  const listBottomPad = fabBottom + 60 + Spacing.four;

  const key = dateKey(viewedDate);
  const entries = entriesFor(key);
  const todayKey = dateKey(new Date());
  const yesterdayKey = dateKey(new Date(Date.now() - 86400000));
  const isToday = key === todayKey;
  const dayTitle = isToday ? 'Today' : key === yesterdayKey ? 'Yesterday' : viewedDate.toLocaleDateString(undefined, { weekday: 'long' });

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
  const perMeal = MEALS.map((m) => entries.filter((e) => e.meal === m.key).reduce((s, e) => s + e.kcal, 0));
  const ringMacros = macros ?? { proteinG: 0, carbsG: 0, fatG: 0 };
  const toggleMeal = (m: MealCategory) => setOpenMeals((prev) => ({ ...prev, [m]: !prev[m] }));
  const quickAdd = (rc: RecentFood) => {
    tapHaptic();
    addEntry(key, {
      name: rc.name,
      meal: defaultMealForNow(),
      kcal: rc.kcal,
      proteinG: rc.proteinG,
      carbsG: rc.carbsG,
      fatG: rc.fatG,
    });
    setPulseKey((k) => k + 1);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <GestureDetector gesture={daySwipe}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: listBottomPad }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.dateLabel}>
              {viewedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <View style={styles.titleRow}>
              <TouchableOpacity onPress={() => changeDay(-1)} hitSlop={10} style={styles.dayArrow}>
                <Text style={styles.dayArrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{dayTitle}</Text>
              <TouchableOpacity onPress={() => changeDay(1)} hitSlop={10} style={styles.dayArrow} disabled={isToday}>
                <Text style={[styles.dayArrowText, isToday && styles.dayArrowDisabled]}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          <CalorieRing
            colors={colors}
            goal={goal}
            metric={ringMetric}
            perMeal={perMeal}
            totals={totals}
            macros={ringMacros}
            onCycle={cycleMetric}
            pulseKey={pulseKey}
          />

          <View style={styles.macroRow}>
            <MacroBar colors={colors} label="Protein" grams={totals.proteinG} goalGrams={macros?.proteinG ?? 0} color={colors.protein} />
            <MacroBar colors={colors} label="Carbs" grams={totals.carbsG} goalGrams={macros?.carbsG ?? 0} color={colors.carbs} />
            <MacroBar colors={colors} label="Fat" grams={totals.fatG} goalGrams={macros?.fatG ?? 0} color={colors.fat} />
          </View>

          {recents.length > 0 && (
            <View style={styles.quickAddWrap}>
              <Text style={styles.quickAddLabel}>QUICK ADD</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAddRow}>
                {recents.slice(0, 8).map((rc, i) => (
                  <TouchableOpacity key={`${rc.name}-${i}`} style={styles.qaChip} onPress={() => quickAdd(rc)} activeOpacity={0.7}>
                    <Text style={styles.qaName} numberOfLines={1}>
                      {rc.name}
                    </Text>
                    <Text style={styles.qaSub}>{round(rc.kcal)} cal · tap to add</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {entries.length === 0 ? (
            <Animated.View style={styles.emptyHero} entering={wa(FadeIn.duration(220))}>
              <Text style={styles.emptyHeroTitle}>Nothing logged yet</Text>
              <Text style={styles.emptyHeroBody}>Tap the + button to log your first meal.{'\n'}It only takes a few seconds.</Text>
            </Animated.View>
          ) : (
            MEALS.map((m) => {
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
                        entering={wa(FadeIn.duration(180))}
                        exiting={wa(FadeOut.duration(120))}>
                        {MEAL_EMPTY[m.key]}
                      </Animated.Text>
                    ) : (
                      mealEntries.map((item) => (
                        <Animated.View
                          key={item.id}
                          entering={wa(FadeIn.duration(200))}
                          exiting={wa(FadeOut.duration(150))}
                          layout={LinearTransition.duration(200)}>
                          <EntryRow colors={colors} entry={item} onDelete={() => removeEntry(key, item.id)} />
                        </Animated.View>
                      ))
                    ))}
                </Animated.View>
              );
            })
          )}
        </ScrollView>
        </GestureDetector>

        <TouchableOpacity style={[styles.fab, { bottom: fabBottom }]} onPress={() => setAddingFood(true)}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>

        {toast && (
          <Animated.View
            style={[styles.toast, { bottom: fabBottom + 66 }]}
            pointerEvents="none"
            entering={wa(FadeIn.duration(200))}
            exiting={wa(FadeOut.duration(200))}>
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}
      </SafeAreaView>

      <DraggableSheet visible={addingFood} onClose={() => setAddingFood(false)} colors={colors}>
        <AddFood
          colors={colors}
          onClose={() => setAddingFood(false)}
          onCommit={(committed) => {
            addEntries(key, committed);
            setAddingFood(false);
            setPulseKey((k) => k + 1);
            successHaptic();
          }}
        />
      </DraggableSheet>
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
    scrollContent: { padding: Spacing.three },
    header: { marginBottom: Spacing.two },
    dateLabel: { fontSize: 13, color: colors.muted, letterSpacing: 0.3 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: 2 },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    dayArrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    dayArrowText: { fontSize: 24, fontWeight: '600', color: colors.accent, marginTop: -2 },
    dayArrowDisabled: { color: colors.cardElevated },
    macroRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four },
    quickAddWrap: { marginTop: Spacing.four },
    quickAddLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, marginBottom: Spacing.two },
    quickAddRow: { gap: Spacing.two, paddingRight: Spacing.three },
    qaChip: { backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 13, maxWidth: 160 },
    qaName: { fontSize: 14, fontWeight: '600', color: colors.text },
    qaSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
    mealSection: { marginTop: Spacing.four },
    // Reserve the bottom-right corner where the FAB floats so a meal's calorie
    // count is never hidden underneath it.
    mealHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, paddingRight: 76 },
    mealChevron: { fontSize: 13, color: colors.muted, width: 16 },
    mealTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    mealCount: { fontSize: 13, color: colors.muted, marginLeft: Spacing.one },
    mealHeaderSpacer: { flex: 1 },
    mealKcal: { fontSize: 13, fontWeight: '700', color: colors.accent, fontFamily: roundedFont },
    emptyText: { color: colors.muted, fontSize: 13, paddingVertical: Spacing.two, paddingLeft: 16 },
    emptyHero: {
      backgroundColor: colors.card,
      borderRadius: 16,
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
      marginTop: Spacing.four,
    },
    emptyHeroTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptyHeroBody: { fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 },
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
    toast: {
      position: 'absolute',
      left: Spacing.four,
      right: Spacing.four,
      backgroundColor: colors.cardElevated,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: Spacing.three,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toastText: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  });
}
