import { Platform, StyleSheet } from 'react-native';

// Deterministic CSS entrance animations for web. Reanimated's enter/exit (layout)
// animations are unreliable on web, so `wa()` drops them there (see lib/anim.ts)
// and mount-reveal elements use these instead, rendered through the plain-RNW `A`
// components (see lib/a) so the animation actually reaches the DOM.
//
// react-native-web only compiles `animationKeyframes` for styles registered via
// StyleSheet.create (the class path); inline style objects silently drop it. So
// the keyframes live in a registered sheet here, and only the dynamic timing
// (delay/duration) is passed inline.
//
// Usage: add to an entering element's style, matching the native effect/timing:
//   <A.View style={[styles.card, appear('down', 120, 450)]} entering={wa(FadeInDown.delay(120).duration(450))}>

export type AppearEffect =
  | 'in' // FadeIn
  | 'down' // FadeInDown (settles downward from slightly above)
  | 'up' // FadeInUp (rises from slightly below)
  | 'slideUp'; // SlideInDown-style panel rising into place

// Registered only on web; on native `appear` returns null before this is read.
const KF: Record<AppearEffect, unknown> =
  Platform.OS === 'web'
    ? (StyleSheet.create({
        in: { animationKeyframes: { '0%': { opacity: 0 }, '100%': { opacity: 1 } } },
        down: {
          animationKeyframes: {
            '0%': { opacity: 0, transform: [{ translateY: -10 }] },
            '100%': { opacity: 1, transform: [{ translateY: 0 }] },
          },
        },
        up: {
          animationKeyframes: {
            '0%': { opacity: 0, transform: [{ translateY: 10 }] },
            '100%': { opacity: 1, transform: [{ translateY: 0 }] },
          },
        },
        slideUp: {
          animationKeyframes: {
            '0%': { transform: [{ translateY: 40 }] },
            '100%': { transform: [{ translateY: 0 }] },
          },
        },
      } as any) as Record<AppearEffect, unknown>)
    : ({ in: null, down: null, up: null, slideUp: null } as Record<AppearEffect, unknown>);

// Returns a web-only style (registered keyframes + inline timing), or null on
// native. `fillMode: both` holds the start frame through any delay so staggered
// reveals stay hidden until their turn.
export function appear(effect: AppearEffect = 'in', delay = 0, duration = 220): any {
  if (Platform.OS !== 'web') return null;
  return [
    KF[effect],
    {
      animationDuration: `${duration}ms`,
      animationDelay: `${delay}ms`,
      animationTimingFunction: 'ease-out',
      animationFillMode: 'both',
    },
  ];
}
