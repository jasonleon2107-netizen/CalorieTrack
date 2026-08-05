import { ComponentType } from 'react';
import { ScrollView, Text, View } from 'react-native';

// Web: Reanimated's layout (entering/exiting/layout) animations are unreliable on
// web AND its Animated wrapper strips react-native-web's `animationKeyframes`
// style, so mount-reveal elements never animate. For those we render plain RNW
// components, which DO honor `animationKeyframes` (see lib/appear), and simply
// drop the Reanimated-only props. Style-driven motion (useAnimatedStyle) keeps
// using the real `Animated` elsewhere and is untouched.
function plain<P extends object>(Comp: ComponentType<P>) {
  return function Plain(props: any) {
    const { entering, exiting, layout, ...rest } = props;
    return <Comp {...(rest as P)} />;
  };
}

export const A = {
  View: plain(View),
  Text: plain(Text),
  ScrollView: plain(ScrollView),
};
