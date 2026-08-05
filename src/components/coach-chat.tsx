import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { roundedFont, Spacing, ThemeColors } from '@/constants/theme';
import { useCustomFoods } from '@/context/custom-foods-context';
import { dateKey, defaultMealForNow, MEALS, MealCategory, useLog } from '@/context/log-context';
import { wa } from '@/lib/anim';
import { askMealAdvisor, CoachMeal } from '@/lib/coach';
import { FoodProduct } from '@/lib/food';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { round } from '@/lib/health';
import { Dropdown } from './dropdown';

type Draft = { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number };

type Msg =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; meals: CoachMeal[]; note?: string }
  | { id: string; role: 'error'; text: string; retry: string };

// Prompts that both seed a conversation and teach the "place + goal" format the
// backend turns into a database query.
const STARTERS = [
  'Chipotle, high protein',
  'Something under 500 cal',
  'Chick-fil-A, low carb',
  'Post-workout, 40g protein',
];

let msgCounter = 0;
const mkId = () => `m-${Date.now()}-${msgCounter++}`;

const mealLabel = (m: MealCategory) => MEALS.find((x) => x.key === m)?.label ?? 'today';

// One serving of an item, ready to log. Prefers the per-serving figure (what you
// actually order); falls back to the per-100 basis when that is all we have.
function servingDraft(p: FoodProduct): Draft | null {
  const n = p.serving ?? p.per100g;
  if (!n) return null;
  return {
    name: p.name,
    kcal: round(n.kcal),
    proteinG: round(n.protein),
    carbsG: round(n.carbs),
    fatG: round(n.fat),
  };
}

const itemKcal = (p: FoodProduct) => round((p.serving ?? p.per100g)?.kcal ?? 0);

export function CoachChat({ colors, onClose, onLogged }: { colors: ThemeColors; onClose: () => void; onLogged?: () => void }) {
  const styles = createStyles(colors);
  const { addEntry, removeEntry } = useLog();
  const { saveFood } = useCustomFoods();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [meal, setMeal] = useState<MealCategory>(defaultMealForNow());
  // Meal titles already saved to My Foods this session, so the star reads as done.
  const [saved, setSaved] = useState<Set<string>>(new Set());
  // Toast can undo a whole meal add, so it tracks every entry id it created.
  const [toast, setToast] = useState<{ msg: string; key: string; ids: string[] } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const runQuery = async (content: string, echoUser: boolean) => {
    if (loading) return;
    if (echoUser) setMessages((m) => [...m, { id: mkId(), role: 'user', text: content }]);
    setLoading(true);
    try {
      const res = await askMealAdvisor(content);
      setMessages((m) => [...m, { id: mkId(), role: 'assistant', meals: res.meals, note: res.note }]);
    } catch (e) {
      setMessages((m) => [...m, { id: mkId(), role: 'error', text: (e as Error).message, retry: content }]);
    } finally {
      setLoading(false);
    }
  };

  const sendText = (text: string) => {
    const c = text.trim();
    if (!c || loading) return;
    selectionHaptic();
    setInput('');
    runQuery(c, true);
  };
  const send = () => sendText(input);

  const logMeal = (m: CoachMeal) => {
    const key = dateKey(new Date());
    const ids: string[] = [];
    for (const p of m.items) {
      const d = servingDraft(p);
      if (d) ids.push(addEntry(key, { ...d, meal }));
    }
    if (ids.length === 0) return;
    successHaptic();
    setToast({ msg: `Added ${m.title} to ${mealLabel(meal)}`, key, ids });
    onLogged?.();
  };

  // Save the whole meal as one combined food for quick re-logging later.
  const saveMeal = (m: CoachMeal) => {
    saveFood({ name: m.title, kcal: m.kcal, proteinG: m.protein, carbsG: m.carbs, fatG: m.fat });
    selectionHaptic();
    setSaved((s) => new Set(s).add(m.title));
  };

  const undo = () => {
    if (!toast) return;
    toast.ids.forEach((id) => removeEntry(toast.key, id));
    selectionHaptic();
    setToast(null);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meal coach</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* The meal every "Add meal to __" targets, defaulted by time of day. */}
        <View style={styles.mealField}>
          <Dropdown
            colors={colors}
            label="ADD TO"
            value={meal}
            options={MEALS.map((m) => ({ value: m.key, label: m.label }))}
            onChange={setMeal}
          />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 ? (
              <EmptyState colors={colors} onPick={sendText} />
            ) : (
              messages.map((m) => (
                <MessageBlock
                  key={m.id}
                  msg={m}
                  colors={colors}
                  target={meal}
                  savedTitles={saved}
                  onAdd={logMeal}
                  onSave={saveMeal}
                  onRetry={(text) => runQuery(text, false)}
                />
              ))
            )}
            {loading && <TypingBubble colors={colors} />}
          </ScrollView>

          <View style={styles.inputDock}>
            <View style={styles.inputBox}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Where are you eating?"
                placeholderTextColor={colors.muted}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={send}
                editable={!loading}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
              onPress={send}
              disabled={!input.trim() || loading}>
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {toast && (
          <Animated.View
            style={styles.toast}
            entering={wa(FadeInDown.duration(200))}
            exiting={wa(FadeOut.duration(200))}>
            <Text style={styles.toastText} numberOfLines={1}>
              {toast.msg}
            </Text>
            <TouchableOpacity onPress={undo} hitSlop={10}>
              <Text style={styles.toastUndo}>Undo</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

function EmptyState({ colors, onPick }: { colors: ThemeColors; onPick: (s: string) => void }) {
  const styles = createStyles(colors);
  return (
    <Animated.View style={styles.empty} entering={wa(FadeIn.duration(240))}>
      <Text style={styles.emptyTitle}>Eating out?</Text>
      <Text style={styles.emptyBody}>
        Tell me the place and your goal. I pull the real menu, build the best meals to order, and you add one in a tap.
      </Text>
      <View style={styles.chipWrap}>
        {STARTERS.map((s) => (
          <TouchableOpacity key={s} style={styles.starter} onPress={() => onPick(s)} activeOpacity={0.7}>
            <Text style={styles.starterText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

function MessageBlock({
  msg,
  colors,
  target,
  savedTitles,
  onAdd,
  onSave,
  onRetry,
}: {
  msg: Msg;
  colors: ThemeColors;
  target: MealCategory;
  savedTitles: Set<string>;
  onAdd: (m: CoachMeal) => void;
  onSave: (m: CoachMeal) => void;
  onRetry: (text: string) => void;
}) {
  const styles = createStyles(colors);

  if (msg.role === 'user') {
    return (
      <Animated.View style={styles.userRow} entering={wa(FadeInDown.duration(200))}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{msg.text}</Text>
        </View>
      </Animated.View>
    );
  }

  if (msg.role === 'error') {
    return (
      <Animated.View style={styles.assistantRow} entering={wa(FadeInDown.duration(200))}>
        <View style={styles.errorBubble}>
          <Text style={styles.errorText}>{msg.text}</Text>
          <TouchableOpacity onPress={() => onRetry(msg.retry)} hitSlop={8}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  // Never leave an assistant turn visually empty (e.g. an unexpected response
  // shape) — fall back to a plain line so the user always gets a reply.
  const fallback = msg.meals.length === 0 && !msg.note ? "I couldn't put together a recommendation. Try again or rephrase." : null;

  return (
    <Animated.View style={styles.assistantRow} entering={wa(FadeInDown.duration(200))}>
      {(msg.note || fallback) && (
        <View style={styles.assistantBubble}>
          <Text style={styles.assistantText}>{msg.note ?? fallback}</Text>
        </View>
      )}
      {msg.meals.map((ml, i) => (
        <MealCard
          key={`${msg.id}:${i}`}
          meal={ml}
          colors={colors}
          target={target}
          saved={savedTitles.has(ml.title)}
          onAdd={() => onAdd(ml)}
          onSave={() => onSave(ml)}
        />
      ))}
    </Animated.View>
  );
}

function MealCard({
  meal,
  colors,
  target,
  saved,
  onAdd,
  onSave,
}: {
  meal: CoachMeal;
  colors: ThemeColors;
  target: MealCategory;
  saved: boolean;
  onAdd: () => void;
  onSave: () => void;
}) {
  const styles = createStyles(colors);
  return (
    <Animated.View style={styles.card} layout={wa(LinearTransition.duration(200))}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{meal.title}</Text>
        <Text style={styles.cardKcal}>{meal.kcal} cal</Text>
      </View>
      {meal.reason.length > 0 && <Text style={styles.cardReason}>{meal.reason}</Text>}

      <View style={styles.itemList}>
        {meal.items.map((p, i) => (
          <View key={`${p.name}-${i}`} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={styles.itemKcal}>{itemKcal(p)} cal</Text>
          </View>
        ))}
      </View>

      <View style={styles.macroRow}>
        <Text style={[styles.macro, { color: colors.protein }]}>{meal.protein}g protein</Text>
        <Text style={[styles.macro, { color: colors.carbs }]}>{meal.carbs}g carbs</Text>
        <Text style={[styles.macro, { color: colors.fat }]}>{meal.fat}g fat</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.addButton} onPress={onAdd} activeOpacity={0.85}>
          <Text style={styles.addButtonText}>Add meal to {mealLabel(target)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={onSave} hitSlop={8} disabled={saved}>
          <Text style={[styles.saveIcon, saved && styles.saveIconOn]}>{saved ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// Three dots that pulse in sequence while the coach is thinking.
function TypingBubble({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  return (
    <Animated.View style={styles.assistantRow} entering={wa(FadeIn.duration(160))} exiting={wa(FadeOut.duration(120))}>
      <View style={[styles.assistantBubble, styles.typingBubble]}>
        <Dot colors={colors} delay={0} />
        <Dot colors={colors} delay={160} />
        <Dot colors={colors} delay={320} />
      </View>
    </Animated.View>
  );
}

function Dot({ colors, delay }: { colors: ThemeColors; delay: number }) {
  const styles = createStyles(colors);
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.3, { duration: 380 })), -1));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    flex: { flex: 1 },
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
    thread: { padding: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two },
    // Empty state
    empty: { paddingTop: Spacing.five, alignItems: 'center' },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: Spacing.two, paddingHorizontal: Spacing.three },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.four },
    starter: { backgroundColor: colors.card, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.cardElevated },
    starterText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    // Messages
    userRow: { alignItems: 'flex-end' },
    userBubble: { backgroundColor: colors.accent, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14, maxWidth: '86%' },
    userText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', lineHeight: 20 },
    assistantRow: { alignItems: 'stretch', gap: Spacing.two },
    assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.card, borderRadius: 18, borderBottomLeftRadius: 6, paddingVertical: 11, paddingHorizontal: 14, maxWidth: '92%' },
    assistantText: { color: colors.text, fontSize: 15, lineHeight: 21 },
    errorBubble: { alignSelf: 'flex-start', backgroundColor: colors.card, borderRadius: 18, borderBottomLeftRadius: 6, paddingVertical: 11, paddingHorizontal: 14, maxWidth: '92%', flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    errorText: { color: colors.danger, fontSize: 14, flexShrink: 1, lineHeight: 20 },
    retryText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    // Meal card
    card: { backgroundColor: colors.card, borderRadius: 16, padding: Spacing.three },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
    cardTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
    cardKcal: { color: colors.accent, fontSize: 15, fontWeight: '800', fontFamily: roundedFont },
    cardReason: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
    itemList: { marginTop: Spacing.two, gap: 4 },
    itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
    itemName: { flex: 1, color: colors.text, fontSize: 14 },
    itemKcal: { color: colors.muted, fontSize: 12, fontFamily: roundedFont },
    macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
    macro: { fontSize: 12, fontWeight: '700', fontFamily: roundedFont },
    actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
    addButton: { flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    saveButton: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.cardElevated, alignItems: 'center', justifyContent: 'center' },
    saveIcon: { fontSize: 20, color: colors.muted },
    saveIconOn: { color: colors.accent },
    // Typing
    typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 14 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted },
    // Input dock
    inputDock: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
    inputBox: { flex: 1, backgroundColor: colors.card, borderRadius: 22, borderWidth: 2, borderColor: colors.cardElevated, paddingHorizontal: Spacing.three },
    input: { color: colors.text, fontSize: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 8, maxHeight: 120 },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    sendButtonDisabled: { opacity: 0.4 },
    sendIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: -2 },
    // Toast
    toast: {
      position: 'absolute',
      left: Spacing.four,
      right: Spacing.four,
      bottom: 92,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardElevated,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: Spacing.three,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toastText: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    toastUndo: { color: colors.accent, fontSize: 14, fontWeight: '700', marginLeft: Spacing.three },
  });
}
