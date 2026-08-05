import { Platform } from 'react-native';

/**
 * Web-safe entering/exiting animation. Reanimated's layout (entering/exiting)
 * animations are unreliable on web (elements can be left at `visibility: hidden`
 * when the reveal never fires), so on web we drop the animation and render the
 * element in its final state. Native keeps the full animation.
 *
 * Note: this only affects mount-reveal animations. Style-driven motion
 * (useAnimatedStyle: macro bars, count-up numbers, the ring, the theme fade) and
 * the Modal slide work on web already.
 */
export function wa<T>(animation: T): T | undefined {
  return Platform.OS === 'web' ? undefined : animation;
}
