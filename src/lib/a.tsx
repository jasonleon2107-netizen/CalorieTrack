import Animated from 'react-native-reanimated';

// Native: `A` is just Reanimated's animated components, so entering/exiting/layout
// animations work exactly as before. The web build swaps in `a.web.tsx`, which
// renders plain react-native-web elements for mount-reveal so the CSS entrance
// from `lib/appear` actually reaches the DOM (Reanimated's wrapper drops it).
export const A = Animated;
