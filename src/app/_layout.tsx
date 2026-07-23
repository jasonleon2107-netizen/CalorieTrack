import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { ProfileForm } from '@/components/profile-form';
import { WelcomeScreen } from '@/components/welcome-screen';
import { Colors } from '@/constants/theme';
import { CustomFoodsProvider, useCustomFoods } from '@/context/custom-foods-context';
import { LogProvider, useLog } from '@/context/log-context';
import { ProfileProvider, useProfile } from '@/context/profile-context';
import { WeightProvider, useWeight } from '@/context/weight-context';

SplashScreen.preventAutoHideAsync();

function buildNavigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'light' ? DefaultTheme : DarkTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.cardElevated,
      primary: colors.accent,
    },
  };
}

function RootLayoutInner() {
  const { profile, hydrated: profileHydrated } = useProfile();
  const { hydrated: logHydrated } = useLog();
  const { hydrated: weightHydrated } = useWeight();
  const { hydrated: foodsHydrated } = useCustomFoods();
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const ready = profileHydrated && logHydrated && weightHydrated && foodsHydrated;
  // Only shown on a first run, before any profile exists.
  const [startedSetup, setStartedSetup] = useState(false);

  // Keep the splash up until stored data is loaded, so returning users never
  // see a flash of the onboarding form.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: Colors[scheme].background }} />;
  }

  const renderRoot = () => {
    if (profile) return <AppTabs />;
    if (!startedSetup) return <WelcomeScreen onStart={() => setStartedSetup(true)} />;
    return <ProfileForm />;
  };

  return (
    <ThemeProvider value={buildNavigationTheme(scheme)}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      {renderRoot()}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ProfileProvider>
      <LogProvider>
        <WeightProvider>
          <CustomFoodsProvider>
            <RootLayoutInner />
          </CustomFoodsProvider>
        </WeightProvider>
      </LogProvider>
    </ProfileProvider>
  );
}
