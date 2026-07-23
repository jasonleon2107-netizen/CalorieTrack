import { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInUp, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Spacing, ThemeColors } from '@/constants/theme';

// A select-style field that matches the app's text inputs. Tapping opens a
// list of options overlaid below the field; picking one closes it.
export function Dropdown<T extends string>({
  colors,
  label,
  value,
  options,
  onChange,
}: {
  colors: ThemeColors;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const styles = createStyles(colors);
  const selected = options.find((o) => o.value === value);

  // Rotate the chevron between ▾ and ▴ rather than swapping glyphs.
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 200 }) }],
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
        <Text style={styles.value}>{selected?.label ?? 'Select…'}</Text>
        <Animated.Text style={[styles.chevron, chevronStyle]}>▾</Animated.Text>
      </TouchableOpacity>

      {open && (
        <>
          {/* Backdrop catches taps outside the menu to dismiss it. */}
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <Animated.View
            style={styles.menu}
            entering={FadeInUp.duration(180)}
            exiting={FadeOut.duration(140)}>
            {options.map((o, i) => (
              <Animated.View key={o.value} entering={FadeIn.delay(i * 25).duration(160)}>
                <TouchableOpacity
                  style={styles.option}
                  activeOpacity={0.6}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}>
                  <Text style={[styles.optionText, o.value === value && styles.optionTextActive]}>{o.label}</Text>
                  {o.value === value && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>
        </>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { position: 'relative', zIndex: 100 },
    label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: Spacing.one },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    value: { color: colors.text, fontSize: 16 },
    chevron: { color: colors.muted, fontSize: 14 },
    backdrop: {
      position: 'absolute',
      top: -1000,
      left: -1000,
      right: -1000,
      bottom: -1000,
    },
    menu: {
      position: 'absolute',
      top: 62,
      left: 0,
      right: 0,
      backgroundColor: colors.cardElevated,
      borderRadius: 12,
      paddingVertical: 4,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    optionText: { color: colors.text, fontSize: 15 },
    optionTextActive: { color: colors.accent, fontWeight: '700' },
    check: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  });
}
