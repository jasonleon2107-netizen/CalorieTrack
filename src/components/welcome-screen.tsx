import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Spacing, ThemeColors } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-colors';

const RING_SIZE = 132;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRC = 2 * Math.PI * RING_RADIUS;

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const features = [
    { color: colors.protein, title: 'Track every macro', body: 'Calories, protein, carbs and fat at a glance.' },
    { color: colors.carbs, title: 'Search or scan', body: 'Find foods by name or scan a barcode.' },
    { color: colors.fat, title: 'Built around your goal', body: 'A daily target from your body and activity.' },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Animated.View entering={FadeIn.duration(500)} style={styles.ringWrap}>
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

          <Animated.Text entering={FadeInDown.delay(120).duration(450)} style={styles.title}>
            Calorie Tracker
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200).duration(450)} style={styles.subtitle}>
            Know what you eat. Hit your targets.
          </Animated.Text>

          <View style={styles.features}>
            {features.map((f, i) => (
              <Animated.View
                key={f.title}
                entering={FadeInDown.delay(300 + i * 90).duration(450)}
                style={styles.featureRow}>
                <View style={[styles.featureDot, { backgroundColor: f.color }]} />
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureBody}>{f.body}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(600).duration(450)} style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={onStart} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Get started</Text>
          </TouchableOpacity>
          <Text style={styles.footnote}>Takes about a minute. Everything stays on your phone.</Text>
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
  });
}
