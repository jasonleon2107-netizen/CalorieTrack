import { Platform } from 'react-native';

/**
 * Web-safe entering/exiting animation. Reanimated's entering animations leave
 * elements at `visibility: hidden` on web (the reveal never fires), so on web
 * we drop the animation entirely and render the element in its final state.
 * Native keeps the full animation.
 */
export function wa<T>(animation: T): T | undefined {
  return Platform.OS === 'web' ? undefined : animation;
}
