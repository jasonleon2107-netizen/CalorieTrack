import { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

// A number that counts to its new value when `value` changes, instead of
// snapping. The first render shows the value immediately (no intro count-up
// unless you pass animateOnMount).
export function AnimatedNumber({
  value,
  duration = 600,
  format,
  style,
  animateOnMount = false,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  animateOnMount?: boolean;
}) {
  const [display, setDisplay] = useState(animateOnMount ? 0 : value);
  const currentRef = useRef(animateOnMount ? 0 : value);
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the retarget on the very first effect run unless asked to animate in.
    if (!mounted.current) {
      mounted.current = true;
      if (!animateOnMount) {
        currentRef.current = value;
        setDisplay(value);
        return;
      }
    }
    const from = currentRef.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const k = Math.min((Date.now() - start) / duration, 1);
      const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
      currentRef.current = v;
      setDisplay(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, animateOnMount]);

  const n = Math.round(display);
  return <Text style={style}>{format ? format(n) : String(n)}</Text>;
}
