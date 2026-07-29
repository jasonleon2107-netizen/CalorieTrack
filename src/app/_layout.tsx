import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import AppTabs from '@/components/app-tabs';
import { ProfileForm } from '@/components/profile-form';
import { WelcomeScreen } from '@/components/welcome-screen';
import { Colors } from '@/constants/theme';
import { CustomFoodsProvider, useCustomFoods } from '@/context/custom-foods-context';
import { LogProvider, useLog } from '@/context/log-context';
import { ProfileProvider, useProfile } from '@/context/profile-context';
import { ThemeProvider, useThemeMode } from '@/context/theme-context';
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

// A brief cross-dissolve when the theme flips, so switching light/dark reads as
// a smooth change rather than an instant refresh. On theme change we cover the
// screen with the previous background color, then fade it away to reveal the
// already-reskinned UI underneath.
function ThemeFade({ scheme }: { scheme: 'light' | 'dark' }) {
  const opacity = useSharedValue(0);
  const prev = useRef(scheme);
  const [color, setColor] = useState(Colors[scheme].background);

  useEffect(() => {
    if (prev.current !== scheme) {
      setColor(Colors[prev.current].background);
      opacity.value = 1;
      opacity.value = withTiming(0, { duration: 360 });
      prev.current = scheme;
    }
  }, [scheme, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.fade, { backgroundColor: color }, style]}
    />
  );
}

function RootLayoutInner() {
  const { profile, hydrated: profileHydrated } = useProfile();
  const { hydrated: logHydrated } = useLog();
  const { hydrated: weightHydrated } = useWeight();
  const { hydrated: foodsHydrated } = useCustomFoods();
  const { scheme, hydrated: themeHydrated } = useThemeMode();
  const ready = profileHydrated && logHydrated && weightHydrated && foodsHydrated && themeHydrated;
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
    <NavigationThemeProvider value={buildNavigationTheme(scheme)}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <View style={styles.root}>
        {renderRoot()}
        <ThemeFade scheme={scheme} />
      </View>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ProfileProvider>
          <LogProvider>
            <WeightProvider>
              <CustomFoodsProvider>
                <RootLayoutInner />
              </CustomFoodsProvider>
            </WeightProvider>
          </LogProvider>
        </ProfileProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fade: { zIndex: 10 },
});
