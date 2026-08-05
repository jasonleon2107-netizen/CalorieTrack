import { Platform } from 'react-native';

import type { FoodProduct } from '@/lib/food';

// A complete recommended meal: a group of REAL menu items with server-summed
// totals. Numbers come from the food database, never the model.
export type CoachMeal = {
  title: string;
  reason: string;
  items: FoodProduct[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

// Shape returned by the meal-advisor serverless function.
export type CoachResponse = {
  query?: string;
  restaurant?: boolean;
  meals: CoachMeal[];
  // Present (with meals empty) when there was nothing useful to recommend.
  note?: string;
};

// Same base as food search: empty (same origin) on the deployed web build, the
// hosted site URL on native via EXPO_PUBLIC_FOOD_API_BASE (see lib/food.ts).
const FOOD_API_BASE = process.env.EXPO_PUBLIC_FOOD_API_BASE ?? '';

// Ask the grounded meal coach for restaurant recommendations. The backend is
// stateless: each call sends only this message, no prior turns.
export async function askMealAdvisor(message: string, signal?: AbortSignal): Promise<CoachResponse> {
  const msg = message.trim();
  if (!msg) throw new Error('Say what you feel like eating.');
  // Native has no page origin, so a blank base cannot resolve. Fail clearly.
  if (!FOOD_API_BASE && Platform.OS !== 'web') {
    throw new Error('The coach is not configured for this build yet. Set EXPO_PUBLIC_FOOD_API_BASE.');
  }

  const res = await fetch(`${FOOD_API_BASE}/.netlify/functions/meal-advisor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: msg }),
    signal,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('The coach is busy. Try again shortly.');
  }
  // The function returns friendly error strings with non-200 codes. A 200 with
  // empty meals plus a `note` is a normal "nothing found" reply, not an error.
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `The coach returned ${res.status}. Try again shortly.`);
  }

  return {
    query: typeof data?.query === 'string' ? data.query : undefined,
    restaurant: data?.restaurant === true,
    meals: Array.isArray(data?.meals) ? data.meals : [],
    note: typeof data?.note === 'string' ? data.note : undefined,
  };
}
