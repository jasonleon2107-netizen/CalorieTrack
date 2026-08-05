import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { roundedFont, Spacing, ThemeColors } from '@/constants/theme';
import { selectionHaptic, successHaptic } from '@/lib/haptics';

const CUP_OZ = 8; // one glass
const CUPS = 8; // 64 oz daily goal

// A row of glasses under the meals. Tap a glass to fill up to it (water rises
// smoothly); tap the last filled glass to empty it. Tracks total ounces.
export function WaterTracker({
  colors,
  ounces,
  onChange,
}: {
  colors: ThemeColors;
  ounces: number;
  onChange: (oz: number) => void;
}) {
  const styles = createStyles(colors);
  const filled = Math.min(Math.round(ounces / CUP_OZ), CUPS);
  const goalOz = CUPS * CUP_OZ;

  const tap = (i: number) => {
    // Tapping the last filled glass empties it; any other fills up to it.
    const next = i + 1 === filled ? i : i + 1;
    if (next > filled) successHaptic();
    else selectionHaptic();
    onChange(next * CUP_OZ);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Water</Text>
        <Text style={styles.amount}>
          {ounces}
          <Text style={styles.goal}> / {goalOz} oz</Text>
        </Text>
      </View>
      <View style={styles.cups}>
        {Array.from({ length: CUPS }).map((_, i) => (
          <Cup key={i} colors={colors} filled={i < filled} onPress={() => tap(i)} />
        ))}
      </View>
    </View>
  );
}

function Cup({ colors, filled, onPress }: { colors: ThemeColors; filled: boolean; onPress: () => void }) {
  const styles = createStyles(colors);
  const level = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    level.value = withTiming(filled ? 1 : 0, { duration: 480 });
  }, [filled, level]);

  const waterStyle = useAnimatedStyle(() => ({ height: `${level.value * 100}%` }));

  return (
    <TouchableOpacity style={styles.cup} activeOpacity={0.7} onPress={onPress}>
      <Animated.View style={[styles.water, waterStyle]} />
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: colors.card, borderRadius: 16, padding: Spacing.three, marginTop: Spacing.four },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.three },
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    amount: { fontSize: 15, fontWeight: '800', color: colors.carbs, fontFamily: roundedFont },
    goal: { fontSize: 12, fontWeight: '600', color: colors.muted },
    cups: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
    // A simple glass: taller than wide, more rounded at the bottom.
    cup: {
      flex: 1,
      maxWidth: 42,
      height: 46,
      borderWidth: 2,
      borderColor: colors.cardElevated,
      borderTopLeftRadius: 5,
      borderTopRightRadius: 5,
      borderBottomLeftRadius: 13,
      borderBottomRightRadius: 13,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      backgroundColor: colors.background,
    },
    water: { width: '100%', backgroundColor: colors.carbs, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  });
}
