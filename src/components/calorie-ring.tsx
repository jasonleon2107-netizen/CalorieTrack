import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Spacing, ThemeColors } from '@/constants/theme';
import { round } from '@/lib/health';

const SIZE = 200;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ consumed, goal, colors }: { consumed: number; goal: number; colors: ThemeColors }) {
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const over = consumed > goal;
  const remaining = goal - consumed;
  const styles = createStyles(colors);

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.cardElevated} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={over ? colors.danger : colors.accent}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - pct)}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.consumed}>{round(consumed)}</Text>
        <Text style={styles.goalLabel}>of {goal} cal</Text>
        <Text style={[styles.remaining, { color: over ? colors.danger : colors.protein }]}>
          {over ? `${round(-remaining)} over` : `${round(remaining)} left`}
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { width: SIZE, height: SIZE, alignSelf: 'center', marginTop: Spacing.three },
    svg: { transform: [{ rotate: '-90deg' }] },
    center: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    consumed: { fontSize: 40, fontWeight: '800', color: colors.text, lineHeight: 44 },
    goalLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
    remaining: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  });
}
