import { useColorScheme } from 'react-native';

import { Colors, ThemeColors } from '@/constants/theme';

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return Colors[scheme === 'light' ? 'light' : 'dark'];
}
