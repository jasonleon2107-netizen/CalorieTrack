import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Spacing, ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { readInstallState } from '@/lib/pwa';

// Shown once, right after onboarding, on the web build when the app isn't already
// installed. Walks the user through adding it to their home screen so it runs
// full-screen like a native app. `onContinue` drops them into the app.
export function InstallScreen({ onContinue }: { onContinue: () => void }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { coarse } = readInstallState();

  const steps = coarse
    ? [
        { text: "Tap the Share icon in your browser's toolbar.", share: true },
        { text: 'Choose “Add to Home Screen” from the list.', share: false },
        { text: 'Tap “Add,” then open Calorie Tracker from your Home Screen.', share: false },
      ]
    : [
        { text: 'Open your browser menu, or the install icon in the address bar.', share: false },
        { text: 'Choose “Install” or “Add to Home Screen.”', share: false },
        { text: 'Launch it like any other app.', share: false },
      ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Image source={{ uri: '/icon-192.png' }} style={styles.mark} resizeMode="cover" />
          <Text style={styles.title}>Add to your Home Screen</Text>
          <Text style={styles.subtitle}>
            Run Calorie Tracker full-screen, without the browser bars. It takes a few seconds and everything stays on your device.
          </Text>

          <View style={styles.steps}>
            {steps.map((s, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>
                  {s.text}
                  {s.share ? <Text>{'  '}</Text> : null}
                </Text>
                {s.share && (
                  <View style={styles.shareGlyph}>
                    <ShareIcon color={colors.accent} size={18} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={onContinue} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Continue to the app</Text>
          </TouchableOpacity>
          <Text style={styles.footnote}>You can do this anytime from your browser.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ShareIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8.5 6.5 12 3l3.5 3.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M7 10H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1, paddingHorizontal: Spacing.four },
    content: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.five },
    mark: { width: 84, height: 84, borderRadius: 20, alignSelf: 'center', marginBottom: Spacing.four },
    title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
    subtitle: {
      fontSize: 15,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: Spacing.two,
      marginBottom: Spacing.five,
    },
    steps: { gap: Spacing.three },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.three,
      gap: Spacing.three,
    },
    stepNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    stepText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
    shareGlyph: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: colors.cardElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: { paddingBottom: Spacing.three, paddingTop: Spacing.two },
    button: { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
    buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
    footnote: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: Spacing.three },
  });
}
