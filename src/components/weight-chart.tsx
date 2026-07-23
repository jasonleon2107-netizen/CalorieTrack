import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Spacing, ThemeColors } from '@/constants/theme';
import { type WeightEntry } from '@/context/weight-context';

const HEIGHT = 110;

// Compact line chart of recent weigh-ins. The y-axis is padded around the
// min/max so small changes stay visible instead of rendering as a flat line.
export function WeightChart({
  colors,
  entries,
  format,
}: {
  colors: ThemeColors;
  entries: WeightEntry[];
  format: (kg: number) => string;
}) {
  const styles = createStyles(colors);
  const [width, setWidth] = useState(0);
  const points = entries.slice(-30);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length < 2) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          {points.length === 0 ? 'Log your weight to see a trend.' : 'Log once more to see a trend.'}
        </Text>
      </View>
    );
  }

  const values = points.map((p) => p.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.2 || 1;
  const lo = min - pad;
  const hi = max + pad;

  const inset = 5; // keep the end dots from clipping at the edges
  const plotW = Math.max(width - inset * 2, 1);
  const x = (i: number) => inset + (i / (points.length - 1)) * plotW;
  const y = (v: number) => inset + (1 - (v - lo) / (hi - lo)) * (HEIGHT - inset * 2);

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.weightKg).toFixed(2)}`)
    .join(' ');
  const last = points[points.length - 1];

  return (
    <View>
      <View onLayout={onLayout} style={styles.plot}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Path d={d} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
            <Circle cx={x(points.length - 1)} cy={y(last.weightKg)} r={4} fill={colors.accent} />
          </Svg>
        )}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>low {format(min)}</Text>
        <Text style={styles.axisText}>high {format(max)}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    plot: { height: HEIGHT },
    placeholder: { height: HEIGHT, alignItems: 'center', justifyContent: 'center' },
    placeholderText: { color: colors.muted, fontSize: 13 },
    axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.one },
    axisText: { color: colors.muted, fontSize: 11 },
  });
}
