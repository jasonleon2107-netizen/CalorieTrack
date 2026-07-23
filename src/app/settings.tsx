import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { ProfileForm } from '@/components/profile-form';
import { SegmentedControl } from '@/components/segmented-control';
import { WeightChart } from '@/components/weight-chart';
import { Spacing, ThemeColors } from '@/constants/theme';
import { dateKey, useLog } from '@/context/log-context';
import { useProfile } from '@/context/profile-context';
import { useWeight } from '@/context/weight-context';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { ACTIVITY, heightCmToFtIn, kgToLb, lbToKg, round } from '@/lib/health';
import { computeStreaks } from '@/lib/streak';

export default function SettingsScreen() {
  const [editing, setEditing] = useState(false);
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { profile, saveProfile, units, setUnits, goalKcal } = useProfile();
  const { loggedDateKeys } = useLog();
  const { entries: weightEntries, logWeight } = useWeight();
  const [weightInput, setWeightInput] = useState('');

  if (editing || !profile) {
    return <ProfileForm onDone={() => setEditing(false)} />;
  }

  const imperial = units === 'imperial';
  const formatWeight = (kg: number) => (imperial ? `${round(kgToLb(kg))} lb` : `${round(kg)} kg`);

  const streaks = computeStreaks(loggedDateKeys);
  const activity = ACTIVITY.find((a) => a.key === profile.activity);

  const heightDisplay = imperial
    ? (() => {
        const { ft, inch } = heightCmToFtIn(profile.heightCm);
        return `${ft}'${inch}"`;
      })()
    : `${round(profile.heightCm)} cm`;

  const first = weightEntries[0];
  const latest = weightEntries[weightEntries.length - 1];
  const change = first && latest ? latest.weightKg - first.weightKg : 0;
  const changeLabel = imperial ? `${Math.abs(round(kgToLb(change)))} lb` : `${Math.abs(round(change))} kg`;

  const submitWeight = () => {
    const n = Number(weightInput);
    if (!weightInput || Number.isNaN(n) || n <= 0) return;
    const kg = imperial ? lbToKg(n) : n;
    logWeight(dateKey(new Date()), kg);
    // Keep the calorie goal accurate by syncing the profile to the new weight.
    saveProfile({ ...profile, weightKg: kg });
    setWeightInput('');
  };

  const confirmReset = () => {
    Alert.alert('Reset everything?', 'This permanently deletes your profile, food log, and weight history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          const { clearAll } = await import('@/lib/storage');
          await clearAll();
          Alert.alert('Data cleared', 'Fully close and reopen the app to start fresh.');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Settings</Text>

          {/* Streak */}
          <Animated.View style={styles.streakCard} entering={FadeIn.duration(220)}>
            <View style={styles.streakMain}>
              <Text style={styles.streakNumber}>{streaks.current}</Text>
              <View>
                <Text style={styles.streakLabel}>day streak</Text>
                <Text style={styles.streakSub}>
                  {streaks.current === 0 ? 'Log something today to start one' : 'Keep it going'}
                </Text>
              </View>
            </View>
            <View style={styles.streakStats}>
              <Stat colors={colors} value={String(streaks.longest)} label="Best streak" />
              <Stat colors={colors} value={String(streaks.totalDays)} label="Days logged" />
              <Stat colors={colors} value={String(goalKcal ?? 0)} label="Daily goal" />
            </View>
          </Animated.View>

          {/* Weight */}
          <Text style={styles.sectionLabel}>WEIGHT</Text>
          <Animated.View style={styles.card} layout={LinearTransition.duration(200)}>
            <View style={styles.weightHeader}>
              <View>
                <Text style={styles.weightCurrent}>{formatWeight(profile.weightKg)}</Text>
                <Text style={styles.weightSub}>current</Text>
              </View>
              {weightEntries.length >= 2 && (
                <View style={styles.weightChangeWrap}>
                  <Text
                    style={[
                      styles.weightChange,
                      { color: change < 0 ? colors.protein : change > 0 ? colors.fat : colors.muted },
                    ]}>
                    {change === 0 ? 'no change' : `${change < 0 ? '−' : '+'}${changeLabel}`}
                  </Text>
                  <Text style={styles.weightSub}>since {weightEntries[0].date}</Text>
                </View>
              )}
            </View>

            <WeightChart colors={colors} entries={weightEntries} format={formatWeight} />

            <View style={styles.weightInputRow}>
              <TextInput
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder={imperial ? "Today's weight (lb)" : "Today's weight (kg)"}
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={styles.weightInput}
              />
              <TouchableOpacity
                style={[styles.logButton, !weightInput && styles.logButtonDisabled]}
                disabled={!weightInput}
                onPress={submitWeight}>
                <Text style={styles.logButtonText}>Log</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.weightNote}>Logging your weight updates your calorie goal.</Text>
          </Animated.View>

          {/* Units */}
          <Text style={styles.sectionLabel}>UNITS</Text>
          <SegmentedControl
            colors={colors}
            value={units}
            onChange={setUnits}
            options={[
              { value: 'imperial' as const, label: 'Imperial' },
              { value: 'metric' as const, label: 'Metric' },
            ]}
          />

          {/* Profile */}
          <Text style={styles.sectionLabel}>PROFILE</Text>
          <View style={styles.card}>
            <Row colors={colors} label="Sex" value={profile.sex === 'male' ? 'Male' : 'Female'} />
            <Row colors={colors} label="Age" value={`${profile.age} yrs`} />
            <Row colors={colors} label="Height" value={heightDisplay} />
            <Row colors={colors} label="Activity" value={activity?.label ?? ''} />
            <Row
              colors={colors}
              label="Goal"
              value={profile.adjust < 0 ? 'Lose weight' : profile.adjust > 0 ? 'Gain weight' : 'Maintain'}
            />
            <Row colors={colors} label="Daily target" value={`${goalKcal} cal`} />
          </View>

          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={confirmReset}>
            <Text style={styles.resetButtonText}>Reset all data</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ colors, value, label }: { colors: ThemeColors; value: string; label: string }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ colors, label, value }: { colors: ThemeColors; label: string; value: string }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    scrollContent: { padding: Spacing.three, paddingBottom: Spacing.six * 2 },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: Spacing.three },
    sectionLabel: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: '700',
      marginTop: Spacing.four,
      marginBottom: Spacing.two,
      letterSpacing: 0.5,
    },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: Spacing.three },
    // Streak
    streakCard: { backgroundColor: colors.card, borderRadius: 16, padding: Spacing.four },
    streakMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    streakNumber: { fontSize: 48, fontWeight: '800', color: colors.accent, lineHeight: 52 },
    streakLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
    streakSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    streakStats: {
      flexDirection: 'row',
      marginTop: Spacing.four,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardElevated,
      paddingTop: Spacing.three,
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 17, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
    // Weight
    weightHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.three },
    weightCurrent: { fontSize: 26, fontWeight: '800', color: colors.text },
    weightSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
    weightChangeWrap: { alignItems: 'flex-end' },
    weightChange: { fontSize: 16, fontWeight: '700' },
    weightInputRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
    weightInput: {
      flex: 1,
      backgroundColor: colors.cardElevated,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      color: colors.text,
      fontSize: 16,
    },
    logButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingHorizontal: Spacing.four,
      justifyContent: 'center',
    },
    logButtonDisabled: { opacity: 0.4 },
    logButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    weightNote: { fontSize: 11, color: colors.muted, marginTop: Spacing.two },
    // Profile rows
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.two },
    rowLabel: { fontSize: 14, color: colors.muted },
    rowValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
    editButton: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: Spacing.four,
    },
    editButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    resetButton: { paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
    resetButtonText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  });
}
