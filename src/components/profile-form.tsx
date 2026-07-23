import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { useProfile, type Profile } from '@/context/profile-context';
import { Spacing, ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { SegmentedControl } from './segmented-control';
import {
  ACTIVITY,
  ActivityKey,
  GoalAdjust,
  Sex,
  calcGoal,
  calcMacros,
  ftInToHeightCm,
  heightCmToFtIn,
  kgToLb,
  lbToKg,
  round,
} from '@/lib/health';

const ADJUST_OPTIONS: { value: GoalAdjust; label: string }[] = [
  { value: -500, label: 'Lose' },
  { value: 0, label: 'Maintain' },
  { value: 500, label: 'Gain' },
];

export function ProfileForm({ onDone }: { onDone?: () => void }) {
  const { profile, saveProfile, units, setUnits } = useProfile();
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'male');
  const [ageStr, setAgeStr] = useState(profile ? String(profile.age) : '');
  const [activity, setActivity] = useState<ActivityKey>(profile?.activity ?? 'moderate');
  const [adjust, setAdjust] = useState<GoalAdjust>(profile?.adjust ?? 0);

  const [heightCm, setHeightCm] = useState<number | null>(profile?.heightCm ?? null);
  const [weightKg, setWeightKg] = useState<number | null>(profile?.weightKg ?? null);

  const [heightPrimaryStr, setHeightPrimaryStr] = useState('');
  const [heightSecondaryStr, setHeightSecondaryStr] = useState('');
  const [weightStr, setWeightStr] = useState('');

  // Re-render the height/weight text fields whenever the unit system changes,
  // converting from the canonical metric values so nothing gets lost.
  useEffect(() => {
    if (heightCm == null) {
      setHeightPrimaryStr('');
      setHeightSecondaryStr('');
    } else if (units === 'metric') {
      setHeightPrimaryStr(String(round(heightCm)));
      setHeightSecondaryStr('');
    } else {
      const { ft, inch } = heightCmToFtIn(heightCm);
      setHeightPrimaryStr(String(ft));
      setHeightSecondaryStr(String(inch));
    }

    if (weightKg == null) {
      setWeightStr('');
    } else {
      setWeightStr(units === 'metric' ? String(round(weightKg)) : String(round(kgToLb(weightKg))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);

  const onHeightPrimaryChange = (v: string) => {
    setHeightPrimaryStr(v);
    const n = Number(v);
    if (v === '' || Number.isNaN(n)) {
      setHeightCm(units === 'imperial' && heightSecondaryStr !== '' ? heightCm : null);
      return;
    }
    if (units === 'metric') {
      setHeightCm(n);
    } else {
      const inch = Number(heightSecondaryStr) || 0;
      setHeightCm(ftInToHeightCm(n, inch));
    }
  };

  const onHeightSecondaryChange = (v: string) => {
    setHeightSecondaryStr(v);
    const ft = Number(heightPrimaryStr) || 0;
    const inch = Number(v) || 0;
    if (heightPrimaryStr === '' && v === '') {
      setHeightCm(null);
      return;
    }
    setHeightCm(ftInToHeightCm(ft, inch));
  };

  const onWeightChange = (v: string) => {
    setWeightStr(v);
    const n = Number(v);
    if (v === '' || Number.isNaN(n)) {
      setWeightKg(null);
      return;
    }
    setWeightKg(units === 'metric' ? n : lbToKg(n));
  };

  const age = Number(ageStr);
  const valid = ageStr !== '' && !Number.isNaN(age) && heightCm != null && weightKg != null;

  const preview = valid ? calcGoal({ sex, age, heightCm: heightCm!, weightKg: weightKg!, activity, adjust }) : null;
  const previewMacros = preview != null ? calcMacros(preview) : null;

  const save = () => {
    if (!valid) return;
    const newProfile: Profile = { sex, age, heightCm: heightCm!, weightKg: weightKg!, activity, adjust };
    saveProfile(newProfile);
    onDone?.();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Your goal</Text>
          <Text style={styles.subtitle}>We calculate your daily target from these. Adjust anytime.</Text>

          <Text style={styles.sectionLabel}>UNITS</Text>
          <SegmentedControl
            colors={colors}
            options={[
              { value: 'imperial', label: 'Imperial' },
              { value: 'metric', label: 'Metric' },
            ]}
            value={units}
            onChange={setUnits}
          />

          <Text style={styles.sectionLabel}>SEX</Text>
          <SegmentedControl
            colors={colors}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            value={sex}
            onChange={setSex}
          />

          <View style={styles.fieldRow}>
            <Field colors={colors} label="Age" value={ageStr} onChangeText={setAgeStr} placeholder="yrs" />
            {units === 'imperial' ? (
              <>
                <Field
                  colors={colors}
                  label="Height (ft)"
                  value={heightPrimaryStr}
                  onChangeText={onHeightPrimaryChange}
                  placeholder="ft"
                />
                <Field
                  colors={colors}
                  label="Height (in)"
                  value={heightSecondaryStr}
                  onChangeText={onHeightSecondaryChange}
                  placeholder="in"
                />
              </>
            ) : (
              <Field
                colors={colors}
                label="Height (cm)"
                value={heightPrimaryStr}
                onChangeText={onHeightPrimaryChange}
                placeholder="cm"
              />
            )}
            <Field
              colors={colors}
              label={units === 'imperial' ? 'Weight (lb)' : 'Weight (kg)'}
              value={weightStr}
              onChangeText={onWeightChange}
              placeholder={units === 'imperial' ? 'lb' : 'kg'}
            />
          </View>

          <Text style={styles.sectionLabel}>ACTIVITY</Text>
          {ACTIVITY.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={[styles.activityRow, activity === a.key && styles.activityRowActive]}
              onPress={() => setActivity(a.key)}>
              <View>
                <Text style={styles.activityLabel}>{a.label}</Text>
                <Text style={styles.activityHint}>{a.hint}</Text>
              </View>
              <Text style={styles.activityMult}>×{a.mult}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionLabel}>GOAL ADJUSTMENT</Text>
          <SegmentedControl colors={colors} options={ADJUST_OPTIONS} value={adjust} onChange={setAdjust} />

          {preview != null && previewMacros != null && (
            <Animated.View style={styles.previewCard} entering={FadeIn.duration(220)} layout={LinearTransition}>
              <Text style={styles.previewLabel}>Daily target</Text>
              <Text style={styles.previewValue}>{preview}</Text>
              <Text style={styles.previewLabel}>cal / day</Text>
              <View style={styles.previewMacroRow}>
                <MacroPreview colors={colors} label="Protein" value={previewMacros.proteinG} color={colors.protein} />
                <MacroPreview colors={colors} label="Carbs" value={previewMacros.carbsG} color={colors.carbs} />
                <MacroPreview colors={colors} label="Fat" value={previewMacros.fatG} color={colors.fat} />
              </View>
            </Animated.View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, !valid && styles.saveButtonDisabled]}
            disabled={!valid}
            onPress={save}>
            <Text style={styles.saveButtonText}>{profile ? 'Save' : 'Start tracking'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MacroPreview({
  colors,
  label,
  value,
  color,
}: {
  colors: ThemeColors;
  label: string;
  value: number;
  color: string;
}) {
  const styles = createStyles(colors);
  return (
    <View style={styles.macroPreviewItem}>
      <Text style={[styles.macroPreviewLabel, { color }]}>{label}</Text>
      <Text style={styles.macroPreviewValue}>{value}g</Text>
    </View>
  );
}

function Field({
  colors,
  label,
  value,
  onChangeText,
  placeholder,
}: {
  colors: ThemeColors;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const styles = createStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        style={styles.fieldInput}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    scrollContent: { padding: Spacing.three, paddingBottom: Spacing.six },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      marginTop: Spacing.one,
      marginBottom: Spacing.four,
    },
    sectionLabel: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: '600',
      marginTop: Spacing.four,
      marginBottom: Spacing.two,
    },
    fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    field: { flexGrow: 1, minWidth: 80, marginBottom: Spacing.two },
    fieldLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: Spacing.one },
    fieldInput: {
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      color: colors.text,
      fontSize: 16,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 15,
      marginBottom: Spacing.two,
    },
    activityRowActive: {
      borderWidth: 2,
      borderColor: colors.accent,
    },
    activityLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    activityHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
    activityMult: { fontSize: 13, color: colors.muted },
    previewCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: Spacing.four,
      alignItems: 'center',
      marginTop: Spacing.four,
    },
    previewLabel: { fontSize: 13, color: colors.muted },
    previewValue: { fontSize: 36, fontWeight: '800', color: colors.accent, marginTop: 4 },
    previewMacroRow: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.three },
    macroPreviewItem: { alignItems: 'center' },
    macroPreviewLabel: { fontSize: 12, fontWeight: '700' },
    macroPreviewValue: { fontSize: 14, color: colors.text, fontWeight: '600', marginTop: 2 },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: Spacing.five,
    },
    saveButtonDisabled: { opacity: 0.4 },
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
