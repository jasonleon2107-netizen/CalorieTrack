import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { roundedFont, Spacing, ThemeColors } from '@/constants/theme';
import { round } from '@/lib/health';
import { AnimatedNumber } from './animated-number';

const SIZE = 200;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const C = SIZE / 2;

export type RingMetric = 'calories' | 'protein' | 'carbs' | 'fat';

// SVG arc between two fractions of the circle (0 = top, clockwise).
function arcPath(cx: number, cy: number, r: number, f0: number, f1: number) {
  if (f1 >= 0.9999) f1 = 0.9999;
  const pt = (f: number) => {
    const a = ((-90 + 360 * f) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const [sx, sy] = pt(f0);
  const [ex, ey] = pt(f1);
  const large = f1 - f0 > 0.5 ? 1 : 0;
  return `M${sx.toFixed(2)} ${sy.toFixed(2)} A${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

export function CalorieRing({
  colors,
  goal,
  metric,
  perMeal,
  totals,
  macros,
  onCycle,
  pulseKey,
}: {
  colors: ThemeColors;
  goal: number;
  metric: RingMetric;
  perMeal: number[]; // kcal per meal, breakfast..snack order
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  macros: { proteinG: number; carbsG: number; fatG: number };
  onCycle: () => void;
  pulseKey: number;
}) {
  const styles = createStyles(colors);
  const scale = useSharedValue(1);

  // A brief pulse whenever a food is logged (pulseKey increments).
  useEffect(() => {
    if (pulseKey > 0) {
      scale.value = withSequence(withTiming(1.04, { duration: 180 }), withTiming(1, { duration: 240 }));
    }
  }, [pulseKey, scale]);

  const ringAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const segments: ReactNode[] = [];
  let over: ReactNode = null;

  if (metric === 'calories') {
    let cum = 0;
    const gap = 0.006;
    perMeal.forEach((mk, i) => {
      const f = goal > 0 ? mk / goal : 0;
      const startF = Math.min(cum, 1);
      const endF = Math.min(cum + f, 1);
      if (endF > startF) {
        const g = endF - startF > gap * 2 ? gap : 0;
        segments.push(
          <Path key={i} d={arcPath(C, C, R, startF, endF - g)} stroke={colors.mealColors[i]} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        );
      }
      cum += f;
    });
    if (cum > 1) {
      over = <Path d={arcPath(C, C, R - 14, 0, Math.min(cum - 1, 1))} stroke={colors.danger} strokeWidth={6} fill="none" strokeLinecap="round" />;
    }
  } else {
    const val = metric === 'protein' ? totals.proteinG : metric === 'carbs' ? totals.carbsG : totals.fatG;
    const goalG = metric === 'protein' ? macros.proteinG : metric === 'carbs' ? macros.carbsG : macros.fatG;
    const col = metric === 'protein' ? colors.protein : metric === 'carbs' ? colors.carbs : colors.fat;
    const f = goalG > 0 ? val / goalG : 0;
    if (f > 0) segments.push(<Path key="m" d={arcPath(C, C, R, 0, Math.min(f, 1))} stroke={col} strokeWidth={STROKE} fill="none" strokeLinecap="round" />);
    if (f > 1) over = <Path d={arcPath(C, C, R - 14, 0, Math.min(f - 1, 1))} stroke={colors.danger} strokeWidth={6} fill="none" strokeLinecap="round" />;
  }

  let bigValue: number;
  let subLabel: string;
  let remainColor: string;
  let remainText: string;
  if (metric === 'calories') {
    const isOver = totals.kcal > goal;
    const left = goal - totals.kcal;
    bigValue = round(totals.kcal);
    subLabel = `of ${goal} cal`;
    remainColor = isOver ? colors.danger : colors.protein;
    remainText = isOver ? `${round(-left)} over` : `${round(left)} left`;
  } else {
    const val = metric === 'protein' ? totals.proteinG : metric === 'carbs' ? totals.carbsG : totals.fatG;
    const goalG = metric === 'protein' ? macros.proteinG : metric === 'carbs' ? macros.carbsG : macros.fatG;
    const rem = goalG - val;
    const col = metric === 'protein' ? colors.protein : metric === 'carbs' ? colors.carbs : colors.fat;
    bigValue = round(val);
    subLabel = `of ${goalG}g ${metric}`;
    remainColor = rem < 0 ? colors.danger : col;
    remainText = rem > 0 ? `${round(rem)}g left` : rem === 0 ? 'Goal met' : `${round(-rem)}g over`;
  }
  const macroColor = metric === 'protein' ? colors.protein : metric === 'carbs' ? colors.carbs : metric === 'fat' ? colors.fat : colors.text;
  const allMetrics: RingMetric[] = ['calories', 'protein', 'carbs', 'fat'];

  return (
    <View style={styles.wrap}>
      <Animated.View style={ringAnim}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={C} cy={C} r={R} stroke={colors.cardElevated} strokeWidth={STROKE} fill="none" />
          {segments}
          {over}
        </Svg>
      </Animated.View>
      <Pressable style={styles.center} onPress={onCycle}>
        <AnimatedNumber
          value={bigValue}
          style={[styles.consumed, metric !== 'calories' ? { color: macroColor } : null]}
          format={(n) => (metric === 'calories' ? String(n) : `${n}g`)}
        />
        <Text style={styles.goalLabel}>{subLabel}</Text>
        <Text style={[styles.remaining, { color: remainColor }]}>{remainText}</Text>
        <View style={styles.dots}>
          {allMetrics.map((mm) => (
            <View key={mm} style={[styles.dot, { backgroundColor: mm === metric ? colors.accent : colors.cardElevated }]} />
          ))}
        </View>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { width: SIZE, height: SIZE, alignSelf: 'center', marginTop: Spacing.three },
    center: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    consumed: { fontSize: 40, fontWeight: '800', color: colors.text, lineHeight: 44, fontFamily: roundedFont },
    goalLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
    remaining: { fontSize: 13, fontWeight: '600', marginTop: 6 },
    dots: { flexDirection: 'row', gap: 5, marginTop: 9 },
    dot: { width: 5, height: 5, borderRadius: 3 },
  });
}
