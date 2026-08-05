import type { ReactNode } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CalendarIcon, FlameIcon, GearIcon } from '@/components/tab-icons';
import { Spacing, ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-colors';

// Web-only tab bar. Native uses the real iOS tab bar (app-tabs.tsx / NativeTabs);
// expo-router's web NativeTabs renders labels with no icons and a flat, static
// bar. On web we render the JS Tabs navigator with a custom floating pill: a
// rounded, centred menu whose active indicator slides between tabs (a CSS
// transition), so it feels alive like the native bar.

const TAB_W = 92;

const META: Record<string, { label: string; icon: (c: string) => ReactNode }> = {
  index: { label: 'Today', icon: (c) => <FlameIcon color={c} size={22} /> },
  history: { label: 'History', icon: (c) => <CalendarIcon color={c} size={22} /> },
  settings: { label: 'Settings', icon: (c) => <GearIcon color={c} size={22} /> },
};

function FloatingTabBar({ state, navigation }: any) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <View
          style={
            [
              styles.indicator,
              {
                left: 6 + state.index * TAB_W,
                transitionProperty: 'left',
                transitionDuration: '260ms',
                transitionTimingFunction: 'cubic-bezier(.2,.7,.2,1)',
              },
            ] as any
          }
        />
        {state.routes.map((route: any, i: number) => {
          const meta = META[route.name];
          if (!meta) return null;
          const focused = state.index === i;
          const color = focused ? colors.accent : colors.muted;
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              style={styles.tab}
              activeOpacity={0.7}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}>
              {meta.icon(color)}
              <Text style={[styles.label, { color }]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // In normal flow so it reserves space (content never hides behind it), but
    // styled to float: centred, gap below, not full-width.
    wrap: { alignItems: 'center', paddingTop: Spacing.two, paddingBottom: 14, backgroundColor: 'transparent' },
    pill: {
      flexDirection: 'row',
      position: 'relative',
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardElevated,
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    indicator: {
      position: 'absolute',
      top: 6,
      left: 6,
      bottom: 6,
      width: TAB_W,
      borderRadius: 18,
      backgroundColor: colors.cardElevated,
    },
    tab: { width: TAB_W, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 3, zIndex: 1 },
    label: { fontSize: 11, fontWeight: '600' },
  });
}
