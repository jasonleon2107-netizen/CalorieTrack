import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { useThemeColors } from '@/hooks/use-theme-colors';

export default function AppTabs() {
  const colors = useThemeColors();

  return (
    <NativeTabs
      backgroundColor={colors.card}
      indicatorColor={colors.cardElevated}
      iconColor={{ selected: colors.accent, default: colors.muted }}
      // Explicit label colors so the tab titles stay legible in light mode
      // (near-black) as well as dark mode (near-white), with the accent for the
      // active tab.
      labelStyle={{ default: { color: colors.text }, selected: { color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <Label>Today</Label>
        <Icon sf="flame.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <Label>History</Label>
        <Icon sf="calendar" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon sf="gearshape.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
