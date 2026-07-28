import { Platform } from 'react-native';

// Macro colors and the danger state stay constant across themes — they're
// saturated enough to read on both a white and a near-black background.
const shared = {
  danger: '#EF4444',
  protein: '#4ADE80',
  carbs: '#60A5FA',
  fat: '#FBBF24',
};

export interface ThemeColors {
  background: string;
  card: string;
  cardElevated: string;
  text: string;
  muted: string;
  accent: string;
  danger: string;
  protein: string;
  carbs: string;
  fat: string;
  // One harmonious blue family (light -> deep) for the meal segments of the
  // calorie ring, in breakfast/lunch/dinner/snack order.
  mealColors: [string, string, string, string];
}

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: '#F7F8FA',
    card: '#FFFFFF',
    cardElevated: '#ECEEF2',
    text: '#14161A',
    muted: '#6B7280',
    accent: '#1D3A8A',
    mealColors: ['#6C8AE0', '#3E63C8', '#1D3A8A', '#132A66'],
    ...shared,
  },
  dark: {
    background: '#0E0F12',
    card: '#191B20',
    cardElevated: '#22242B',
    text: '#F2F3F5',
    muted: '#8A8F98',
    accent: '#5B7FFF',
    mealColors: ['#B9CBFF', '#8AA5FF', '#5B7FFF', '#3B5BD9'],
    ...shared,
  },
};

// SF Rounded numerals on iOS give figures a friendly, app-like feel.
export const roundedFont = Platform.select({ ios: 'ui-rounded', default: undefined });

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
