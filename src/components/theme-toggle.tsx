import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemeColors } from '@/constants/theme';
import type { ThemePreference } from '@/context/theme-context';
import { selectionHaptic } from '@/lib/haptics';

function SunIcon({ color, size = 18 }: { color: string; size?: number }) {
  const rays: [number, number, number, number][] = [
    [12, 2, 12, 4.2],
    [12, 19.8, 12, 22],
    [4.9, 4.9, 6.4, 6.4],
    [17.6, 17.6, 19.1, 19.1],
    [2, 12, 4.2, 12],
    [19.8, 12, 22, 12],
    [4.9, 19.1, 6.4, 17.6],
    [17.6, 6.4, 19.1, 4.9],
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={4.4} fill={color} />
      {rays.map((r, i) => (
        <Line key={i} x1={r[0]} y1={r[1]} x2={r[2]} y2={r[3]} stroke={color} strokeWidth={2} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

function MoonIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill={color} />
    </Svg>
  );
}

// A compact light/dark switch. Sun = light, moon = dark; the active side fills
// with the accent color.
export function ThemeToggle({
  colors,
  scheme,
  onChange,
}: {
  colors: ThemeColors;
  scheme: ThemePreference;
  onChange: (p: ThemePreference) => void;
}) {
  const styles = createStyles(colors);
  // Tick only when the choice actually changes, so tapping the active side is silent.
  const pick = (p: ThemePreference) => {
    if (p === scheme) return;
    selectionHaptic();
    onChange(p);
  };
  return (
    <View style={styles.track}>
      <TouchableOpacity
        style={[styles.half, scheme === 'light' && styles.halfActive]}
        onPress={() => pick('light')}
        accessibilityRole="button"
        accessibilityState={{ selected: scheme === 'light' }}
        accessibilityLabel="Light mode">
        <SunIcon color={scheme === 'light' ? '#FFFFFF' : colors.muted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.half, scheme === 'dark' && styles.halfActive]}
        onPress={() => pick('dark')}
        accessibilityRole="button"
        accessibilityState={{ selected: scheme === 'dark' }}
        accessibilityLabel="Dark mode">
        <MoonIcon color={scheme === 'dark' ? '#FFFFFF' : colors.muted} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.cardElevated,
      borderRadius: 12,
      padding: 4,
      gap: 4,
      alignSelf: 'flex-start',
    },
    half: {
      width: 54,
      height: 36,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    halfActive: { backgroundColor: colors.accent },
  });
}
