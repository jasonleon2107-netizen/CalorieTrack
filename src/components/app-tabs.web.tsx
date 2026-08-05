import { Tabs } from 'expo-router';

import { CalendarIcon, FlameIcon, GearIcon } from '@/components/tab-icons';
import { useThemeColors } from '@/hooks/use-theme-colors';

// Web-only tab bar. Native uses the real iOS tab bar (app-tabs.tsx / NativeTabs);
// expo-router's web NativeTabs renders labels with NO icons, so on web we use the
// JS Tabs navigator instead, which supports icons, styled to echo the native bar
// (flame / calendar / gear, navy accent for the active tab).
export default function AppTabs() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.cardElevated,
          height: 60,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color }) => <FlameIcon color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color }) => <CalendarIcon color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <GearIcon color={color} size={22} /> }}
      />
    </Tabs>
  );
}
