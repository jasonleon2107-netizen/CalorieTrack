import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Spacing, ThemeColors } from '@/constants/theme';

// Segmented toggle with a pill indicator that slides between options.
// Used for units, sex, goal adjustment, add-food tabs, and servings/grams.
export function SegmentedControl<T extends string | number>({
  colors,
  options,
  value,
  onChange,
  variant = 'filled',
}: {
  colors: ThemeColors;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  // 'filled' = accent pill (primary choices), 'subtle' = raised pill (tabs).
  variant?: 'filled' | 'subtle';
}) {
  const [width, setWidth] = useState(0);
  const styles = createStyles(colors);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = options.length > 0 ? width / options.length : 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: withTiming(index * segmentWidth, { duration: 200 }) }],
    opacity: segmentWidth > 0 ? 1 : 0,
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.track} onLayout={onLayout}>
      <Animated.View
        style={[
          styles.indicator,
          variant === 'filled' ? styles.indicatorFilled : styles.indicatorSubtle,
          indicatorStyle,
        ]}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            style={styles.segment}
            activeOpacity={0.7}
            onPress={() => onChange(o.value)}>
            <Text
              style={[
                styles.label,
                active && (variant === 'filled' ? styles.labelActiveFilled : styles.labelActiveSubtle),
              ]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 4,
      position: 'relative',
    },
    indicator: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 9,
    },
    indicatorFilled: { backgroundColor: colors.accent },
    indicatorSubtle: { backgroundColor: colors.cardElevated },
    segment: {
      flex: 1,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontSize: 14, fontWeight: '600', color: colors.muted },
    labelActiveFilled: { color: '#FFFFFF' },
    labelActiveSubtle: { color: colors.text },
  });
}
