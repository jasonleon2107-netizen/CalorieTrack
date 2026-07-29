import { Colors, ThemeColors } from '@/constants/theme';
import { useThemeMode } from '@/context/theme-context';

export function useThemeColors(): ThemeColors {
  const { scheme } = useThemeMode();
  return Colors[scheme];
}
