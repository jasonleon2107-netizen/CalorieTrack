import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { roundedFont, ThemeColors } from '@/constants/theme';
import { round } from '@/lib/health';
import { AnimatedNumber } from './animated-number';

export function MacroBar({
  colors,
  label,
  grams,
  goalGrams,
  color,
}: {
  colors: ThemeColors;
  label: string;
  grams: number;
  goalGrams: number;
  color: string;
}) {
  const pct = goalGrams > 0 ? Math.min(grams / goalGrams, 1) : 0;
  const remaining = goalGrams - grams;
  const styles = createStyles(colors);

  const width = useSharedValue(0); // animate in from empty on mount
  const flash = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    width.value = withTiming(pct, { duration: 600 });
    if (mounted.current) {
      // Flash the bar brighter when its value changes.
      flash.value = withSequence(withTiming(0.55, { duration: 90 }), withTiming(0, { duration: 420 }));
    } else {
      mounted.current = true;
    }
  }, [grams, pct, width, flash]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <View style={styles.valueRow}>
          <AnimatedNumber value={round(grams)} style={styles.value} />
          <Text style={styles.value}>{goalGrams ? `/${goalGrams}` : ''}g</Text>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]}>
          <Animated.View style={[styles.flash, flashStyle]} />
        </Animated.View>
      </View>
      {goalGrams > 0 && (
        <Text style={[styles.remaining, { color: remaining < 0 ? colors.danger : color }]}>
          {remaining > 0 ? `${round(remaining)}g left` : remaining === 0 ? 'Goal met' : `${round(-remaining)}g over`}
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    label: { fontSize: 12, fontWeight: '700' },
    valueRow: { flexDirection: 'row' },
    value: { fontSize: 12, fontWeight: '700', color: colors.text, fontFamily: roundedFont },
    track: { height: 6, backgroundColor: colors.cardElevated, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF', borderRadius: 3 },
    remaining: { fontSize: 11, fontWeight: '700', marginTop: 5 },
  });
}
