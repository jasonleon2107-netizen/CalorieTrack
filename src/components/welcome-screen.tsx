import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeIn, FadeInDown } from 'react-native-reanimated';
import { A as Animated } from '@/lib/a';
import { wa } from '@/lib/anim';
import { appear } from '@/lib/appear';
import Svg, { Circle, Path } from 'react-native-svg';

import { Spacing, ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-colors';

const RING_SIZE = 132;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRC = 2 * Math.PI * RING_RADIUS;

// True only on the web build, on a touch device, and when the app isn't already
// running as an installed PWA — i.e. exactly when "Add to Home Screen" helps.
function useInstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const mm = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
      const standalone = mm('(display-mode: standalone)') || (typeof navigator !== 'undefined' && (navigator as any).standalone === true);
      const coarse = mm('(pointer: coarse)');
      setShow(!standalone && coarse);
    } catch {
      // matchMedia not available; leave the hint hidden.
    }
  }, []);
  return show;
}

// iOS-style share glyph (a tray with an up arrow) to anchor the hint.
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

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const showInstall = useInstallHint();

  const features = [
    { color: colors.protein, title: 'Track every macro', body: 'Calories, protein, carbs and fat at a glance.' },
    { color: colors.carbs, title: 'Search or scan', body: 'Find foods by name or scan a barcode.' },
    { color: colors.fat, title: 'Built around your goal', body: 'A daily target from your body and activity.' },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Animated.View entering={wa(FadeIn.duration(500))} style={[styles.ringWrap, appear('in', 0, 500)]}>
            <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.cardElevated}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.accent}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${CIRC} ${CIRC}`}
                strokeDashoffset={CIRC * 0.32}
              />
            </Svg>
          </Animated.View>

          <Animated.Text entering={wa(FadeInDown.delay(120).duration(450))} style={[styles.title, appear('down', 120, 450)]}>
            Calorie Tracker
          </Animated.Text>
          <Animated.Text entering={wa(FadeInDown.delay(200).duration(450))} style={[styles.subtitle, appear('down', 200, 450)]}>
            Know what you eat. Hit your targets.
          </Animated.Text>

          <View style={styles.features}>
            {features.map((f, i) => (
              <Animated.View
                key={f.title}
                entering={wa(FadeInDown.delay(300 + i * 90).duration(450))}
                style={[styles.featureRow, appear('down', 300 + i * 90, 450)]}>
                <View style={[styles.featureDot, { backgroundColor: f.color }]} />
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureBody}>{f.body}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View entering={wa(FadeInDown.delay(600).duration(450))} style={[styles.footer, appear('down', 600, 450)]}>
          <TouchableOpacity style={styles.button} onPress={onStart} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Get started</Text>
          </TouchableOpacity>
          <Text style={styles.footnote}>Takes about a minute. Everything stays on your device.</Text>
          {showInstall && (
            <View style={styles.installHint}>
              <ShareIcon color={colors.accent} />
              <Text style={styles.installText}>
                Tap <Text style={styles.installStrong}>Share</Text>, then{' '}
                <Text style={styles.installStrong}>Add to Home Screen</Text>, to run it full-screen like an app.
              </Text>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1, paddingHorizontal: Spacing.four },
    content: { flex: 1, justifyContent: 'center' },
    ringWrap: { alignSelf: 'center', marginBottom: Spacing.five },
    ring: { transform: [{ rotate: '-90deg' }] },
    title: { fontSize: 32, fontWeight: '800', color: colors.text, textAlign: 'center' },
    subtitle: {
      fontSize: 15,
      color: colors.muted,
      textAlign: 'center',
      marginTop: Spacing.two,
      marginBottom: Spacing.five,
    },
    features: { gap: Spacing.three },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
    featureDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
    featureText: { flex: 1 },
    featureTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    featureBody: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
    footer: { paddingBottom: Spacing.three },
    button: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 17,
      alignItems: 'center',
    },
    buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
    footnote: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: Spacing.three },
    installHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardElevated,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginTop: Spacing.three,
    },
    installText: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 17 },
    installStrong: { color: colors.text, fontWeight: '700' },
  });
}
