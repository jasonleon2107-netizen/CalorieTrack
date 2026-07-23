export type Sex = 'male' | 'female';
export type ActivityKey = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryactive';
export type GoalAdjust = -500 | 0 | 500;
export type UnitSystem = 'imperial' | 'metric';

export const ACTIVITY: { key: ActivityKey; label: string; mult: number; hint: string }[] = [
  { key: 'sedentary', label: 'Sedentary', mult: 1.2, hint: 'little/no exercise' },
  { key: 'light', label: 'Light', mult: 1.375, hint: '1-3 days/wk' },
  { key: 'moderate', label: 'Moderate', mult: 1.55, hint: '3-5 days/wk' },
  { key: 'active', label: 'Active', mult: 1.725, hint: '6-7 days/wk' },
  { key: 'veryactive', label: 'Very active', mult: 1.9, hint: 'hard daily/physical job' },
];

export const round = (n: number) => Math.round(n);

// Mifflin-St Jeor
export function calcGoal({
  sex,
  age,
  heightCm,
  weightKg,
  activity,
  adjust,
}: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityKey;
  adjust: GoalAdjust;
}) {
  const bmr =
    sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const mult = ACTIVITY.find((a) => a.key === activity)?.mult ?? 1.2;
  return round(bmr * mult + adjust);
}

export function calcMacros(goalKcal: number, split = { p: 0.3, c: 0.4, f: 0.3 }) {
  return {
    proteinG: round((goalKcal * split.p) / 4),
    carbsG: round((goalKcal * split.c) / 4),
    fatG: round((goalKcal * split.f) / 9),
  };
}

// Unit conversions — profile is always stored in metric under the hood.
export const cmToIn = (cm: number) => cm / 2.54;
export const inToCm = (inches: number) => inches * 2.54;
export const kgToLb = (kg: number) => kg / 0.45359237;
export const lbToKg = (lb: number) => lb * 0.45359237;

export function heightCmToFtIn(cm: number) {
  const totalIn = cmToIn(cm);
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return { ft, inch };
}

export function ftInToHeightCm(ft: number, inch: number) {
  return inToCm(ft * 12 + inch);
}
