import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';

import { Spacing, ThemeColors } from '@/constants/theme';
import { useCustomFoods, type CustomFood } from '@/context/custom-foods-context';
import { MEALS, MealCategory, defaultMealForNow, type LogEntry } from '@/context/log-context';
import { FoodProduct, fetchProductDetails, searchFoods } from '@/lib/food';
import { round } from '@/lib/health';
import { BarcodeScanner } from './barcode-scanner';
import { Dropdown } from './dropdown';
import { FoodPortionForm } from './food-portion-form';
import { SegmentedControl } from './segmented-control';

type Tab = 'search' | 'manual' | 'scan';
type EntryDraft = { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number };
type StagedEntry = Omit<LogEntry, 'id'>;

export function AddFood({
  colors,
  onClose,
  onCommit,
}: {
  colors: ThemeColors;
  onClose: () => void;
  onCommit: (entries: StagedEntry[]) => void;
}) {
  const [tab, setTab] = useState<Tab>('search');
  const [meal, setMeal] = useState<MealCategory>(defaultMealForNow());
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedEntry[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const styles = createStyles(colors);

  // Adding queues the item locally; nothing hits the log until "Add all".
  // The meal is captured per item, so it can change between adds.
  const stage = (draft: EntryDraft) => {
    setStaged((prev) => [...prev, { ...draft, meal }]);
    setToast(`Added ${draft.name}`);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const stagedKcal = staged.reduce((sum, e) => sum + e.kcal, 0);

  const handleClose = () => {
    if (staged.length === 0) {
      onClose();
      return;
    }
    Alert.alert(
      'Discard items?',
      `You have ${staged.length} item${staged.length === 1 ? '' : 's'} not yet added to your log.`,
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]
    );
  };

  const commitAll = () => {
    if (staged.length === 0) return;
    onCommit(staged);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={12}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add food</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.mealField}>
          <Dropdown
            colors={colors}
            label="MEAL"
            value={meal}
            options={MEALS.map((m) => ({ value: m.key, label: m.label }))}
            onChange={setMeal}
          />
        </View>

        <View style={styles.tabRow}>
          <SegmentedControl
            colors={colors}
            variant="subtle"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'search' as Tab, label: 'Search' },
              { value: 'manual' as Tab, label: 'Manual' },
              { value: 'scan' as Tab, label: 'Scan' },
            ]}
          />
        </View>

        {/* Keying on `tab` remounts the panel so each switch cross-fades. */}
        <Animated.View key={tab} style={styles.tabContent} entering={FadeIn.duration(200)}>
          {tab === 'search' && <SearchTab colors={colors} onStage={stage} />}
          {tab === 'manual' && <ManualTab colors={colors} onStage={stage} fallbackNote={fallbackNote} />}
          {tab === 'scan' && (
            <BarcodeScanner
              colors={colors}
              onAdd={stage}
              onManualFallback={(barcode) => {
                setFallbackNote(barcode ? `Barcode ${barcode} not found — enter the details manually.` : null);
                setTab('manual');
              }}
            />
          )}
        </Animated.View>

        {toast && (
          <Animated.View
            style={styles.toast}
            pointerEvents="none"
            entering={FadeInDown.duration(200)}
            exiting={FadeOut.duration(200)}>
            <Text style={styles.toastText} numberOfLines={1}>
              {toast}
            </Text>
          </Animated.View>
        )}

        {staged.length > 0 && (
          <Animated.View
            style={styles.basket}
            entering={SlideInDown.duration(240)}
            exiting={SlideOutDown.duration(200)}
            layout={LinearTransition.duration(200)}>
            {reviewOpen && (
              <Animated.ScrollView
                style={styles.reviewList}
                keyboardShouldPersistTaps="handled"
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}>
                {staged.map((e, i) => (
                  <Animated.View
                    key={`${e.name}-${i}`}
                    style={styles.reviewRow}
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(140)}
                    layout={LinearTransition.duration(180)}>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.reviewName} numberOfLines={1}>
                        {e.name}
                      </Text>
                      <Text style={styles.reviewMeta}>
                        {MEALS.find((m) => m.key === e.meal)?.label} · {round(e.kcal)} cal
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setStaged((prev) => prev.filter((_, idx) => idx !== i))}
                      hitSlop={10}
                      style={styles.reviewRemove}>
                      <Text style={styles.reviewRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </Animated.ScrollView>
            )}

            <View style={styles.basketBar}>
              <TouchableOpacity style={styles.basketSummary} onPress={() => setReviewOpen((o) => !o)}>
                <Text style={styles.basketCount}>
                  {staged.length} item{staged.length === 1 ? '' : 's'} · {round(stagedKcal)} cal
                </Text>
                <Text style={styles.basketChevron}>{reviewOpen ? '▾' : '▴'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.basketButton} onPress={commitAll}>
                <Text style={styles.basketButtonText}>Add all</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

// A saved food behaves like a product with a single serving and no per-100g
// data, so the shared portion form shows just the servings input.
function customFoodAsProduct(f: CustomFood): FoodProduct {
  return {
    name: f.name,
    serving: { label: '1 serving', kcal: f.kcal, protein: f.proteinG, carbs: f.carbsG, fat: f.fatG },
    per100g: null,
    basisUnit: 'g',
  };
}

function SearchTab({ colors, onStage }: { colors: ThemeColors; onStage: (entry: EntryDraft) => void }) {
  const styles = createStyles(colors);
  const { foods, removeFood, markUsed } = useCustomFoods();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodProduct | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [focused, setFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Search hits lack serving sizes, so pull the full record on selection.
  const selectProduct = async (p: FoodProduct) => {
    if (!p.code) {
      setSelected(p);
      return;
    }
    setLoadingDetails(true);
    try {
      setSelected(await fetchProductDetails(p));
    } catch {
      setSelected(p); // fall back to the lighter search result
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const found = await searchFoods(q, controller.signal);
        setResults(found);
        setLoading(false);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        // Surface the real reason instead of blaming the network for every failure.
        console.warn('Food search failed:', e);
        setError(`Search failed: ${(e as Error).message ?? 'unknown error'}`);
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  // Saved foods match locally and always sit above database results.
  const q = query.trim().toLowerCase();
  const myFoods = q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods;

  if (loadingDetails) {
    return (
      <View style={styles.detailLoading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.searchHint}>Loading serving sizes…</Text>
      </View>
    );
  }

  if (selected) {
    return (
      <FoodPortionForm
        colors={colors}
        product={selected}
        onAdd={(entry) => {
          onStage(entry);
          // Drop straight back to results so the next item is one tap away.
          setSelected(null);
        }}
        secondaryLabel="Back to results"
        onSecondary={() => setSelected(null)}
      />
    );
  }

  return (
    <View style={styles.searchWrap}>
      <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search foods…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator color={colors.accent} style={styles.searchSpinner} />}
      {error && <Text style={styles.searchError}>{error}</Text>}
      {!loading && !error && query.trim().length >= 2 && results.length === 0 && myFoods.length === 0 && (
        <Text style={styles.searchHint}>No matches. Try a simpler term, or use Manual.</Text>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.resultsList}>
        {myFoods.length > 0 && (
          <>
            <Text style={styles.groupLabel}>MY FOODS</Text>
            {myFoods.map((f) => (
              <Animated.View key={f.id} entering={FadeIn.duration(180)} layout={LinearTransition.duration(180)}>
                <TouchableOpacity
                  style={styles.resultRow}
                  activeOpacity={0.6}
                  onPress={() => setSelected(customFoodAsProduct(f))}
                  onLongPress={() =>
                    Alert.alert('Delete saved food?', f.name, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => removeFood(f.id) },
                    ])
                  }>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text style={styles.resultSub}>{round(f.kcal)} cal per serving</Text>
                  </View>
                  {/* One-tap add: stages a single serving without opening the form. */}
                  <TouchableOpacity
                    style={styles.quickAdd}
                    hitSlop={8}
                    onPress={() => {
                      markUsed(f.id);
                      onStage({
                        name: f.name,
                        kcal: f.kcal,
                        proteinG: f.proteinG,
                        carbsG: f.carbsG,
                        fatG: f.fatG,
                      });
                    }}>
                    <Text style={styles.quickAddText}>+</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Animated.View>
            ))}
            {results.length > 0 && <Text style={styles.groupLabel}>DATABASE</Text>}
          </>
        )}
        {results.map((p, i) => {
          const basis = p.per100g ?? p.serving;
          const perLabel = p.per100g ? '/100g' : '/serving';
          return (
            <Animated.View key={`${p.name}-${i}`} entering={FadeIn.delay(Math.min(i, 8) * 20).duration(180)}>
              <TouchableOpacity style={styles.resultRow} activeOpacity={0.6} onPress={() => selectProduct(p)}>
                <Text style={styles.resultName} numberOfLines={2}>
                  {p.name}
                </Text>
                <Text style={styles.resultKcal}>
                  {round(basis?.kcal ?? 0)} cal{perLabel}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ManualTab({
  colors,
  onStage,
  fallbackNote,
}: {
  colors: ThemeColors;
  onStage: (entry: EntryDraft) => void;
  fallbackNote: string | null;
}) {
  const styles = createStyles(colors);
  const { saveFood } = useCustomFoods();
  const [name, setName] = useState('');
  const [kcalStr, setKcalStr] = useState('');
  const [proteinStr, setProteinStr] = useState('');
  const [carbsStr, setCarbsStr] = useState('');
  const [fatStr, setFatStr] = useState('');
  const [saveToMyFoods, setSaveToMyFoods] = useState(false);

  const kcal = Number(kcalStr);
  const valid = name.trim() !== '' && kcalStr !== '' && !Number.isNaN(kcal);

  const submit = () => {
    if (!valid) return;
    const draft = {
      name: name.trim(),
      kcal,
      proteinG: Number(proteinStr) || 0,
      carbsG: Number(carbsStr) || 0,
      fatG: Number(fatStr) || 0,
    };
    onStage(draft);
    if (saveToMyFoods) saveFood(draft);
    // Clear the form so the next item can be typed immediately.
    setName('');
    setKcalStr('');
    setProteinStr('');
    setCarbsStr('');
    setFatStr('');
  };

  return (
    <ScrollView style={styles.manualForm} contentContainerStyle={styles.manualContent} keyboardShouldPersistTaps="handled">
      {fallbackNote && <Text style={styles.fallbackNote}>{fallbackNote}</Text>}
      <ManualField colors={colors} label="Name" value={name} onChangeText={setName} placeholder="e.g. Homemade burrito" />
      <ManualField colors={colors} label="Calories" value={kcalStr} onChangeText={setKcalStr} placeholder="0" numeric />
      <View style={styles.macroFieldRow}>
        <ManualField colors={colors} label="Protein (g)" value={proteinStr} onChangeText={setProteinStr} placeholder="0" numeric flex />
        <ManualField colors={colors} label="Carbs (g)" value={carbsStr} onChangeText={setCarbsStr} placeholder="0" numeric flex />
        <ManualField colors={colors} label="Fat (g)" value={fatStr} onChangeText={setFatStr} placeholder="0" numeric flex />
      </View>
      <TouchableOpacity
        style={styles.saveToggle}
        activeOpacity={0.7}
        onPress={() => setSaveToMyFoods((s) => !s)}>
        <View style={[styles.checkbox, saveToMyFoods && styles.checkboxOn]}>
          {saveToMyFoods && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.saveToggleText}>
          <Text style={styles.saveToggleTitle}>Save to My Foods</Text>
          <Text style={styles.saveToggleSub}>Reuse it later with one tap from Search.</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.primaryButton, !valid && styles.primaryButtonDisabled]} disabled={!valid} onPress={submit}>
        <Text style={styles.primaryButtonText}>Add another</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ManualField({
  colors,
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
  flex,
}: {
  colors: ThemeColors;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  flex?: boolean;
}) {
  const styles = createStyles(colors);
  return (
    <View style={[styles.field, flex && styles.fieldFlex]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={styles.fieldInput}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
    },
    closeButton: { width: 56 },
    closeButtonText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    headerSpacer: { width: 56 },
    mealField: { paddingHorizontal: Spacing.three, marginTop: Spacing.three, zIndex: 100 },
    tabRow: { marginHorizontal: Spacing.three, marginTop: Spacing.three },
    tabContent: { flex: 1 },
    // Toast
    toast: {
      position: 'absolute',
      left: Spacing.four,
      right: Spacing.four,
      bottom: 96,
      backgroundColor: colors.cardElevated,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: Spacing.three,
      alignItems: 'center',
    },
    toastText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    // Staging basket
    basket: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.cardElevated },
    reviewList: { maxHeight: 180, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: Spacing.two,
    },
    reviewInfo: { flex: 1, minWidth: 0 },
    reviewName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    reviewMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    reviewRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    reviewRemoveText: { color: colors.muted, fontSize: 14 },
    basketBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    basketSummary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: 8 },
    basketCount: { color: colors.text, fontSize: 14, fontWeight: '700' },
    basketChevron: { color: colors.muted, fontSize: 12 },
    basketButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: Spacing.four,
    },
    basketButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    // Search
    searchWrap: { flex: 1, padding: Spacing.three },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: Spacing.three,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    searchBoxFocused: { borderColor: colors.accent },
    searchInput: {
      flex: 1,
      paddingVertical: 16,
      color: colors.text,
      fontSize: 19,
      fontWeight: '600',
    },
    searchClear: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.cardElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchClearText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    searchSpinner: { marginTop: Spacing.three },
    detailLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
    searchError: { color: colors.danger, fontSize: 13, marginTop: Spacing.three, textAlign: 'center' },
    searchHint: { color: colors.muted, fontSize: 13, marginTop: Spacing.three, textAlign: 'center' },
    resultsList: { paddingTop: Spacing.two, paddingBottom: Spacing.four },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: Spacing.two,
      gap: Spacing.two,
    },
    resultInfo: { flex: 1, minWidth: 0 },
    resultName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
    resultSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    resultKcal: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    groupLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      letterSpacing: 0.6,
      marginTop: Spacing.two,
      marginBottom: Spacing.two,
    },
    quickAdd: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickAddText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginTop: -2 },
    saveToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    saveToggleText: { flex: 1 },
    saveToggleTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
    saveToggleSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
    // Manual
    manualForm: { flex: 1 },
    manualContent: { padding: Spacing.three, paddingBottom: Spacing.four },
    fallbackNote: { fontSize: 13, color: colors.danger, marginBottom: Spacing.two },
    macroFieldRow: { flexDirection: 'row', gap: Spacing.two },
    field: { marginBottom: Spacing.two },
    fieldFlex: { flex: 1 },
    fieldLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: Spacing.one },
    fieldInput: {
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      color: colors.text,
      fontSize: 16,
    },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: Spacing.three,
    },
    primaryButtonDisabled: { opacity: 0.4 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
