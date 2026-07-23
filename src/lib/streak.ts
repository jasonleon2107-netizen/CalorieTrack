import { dateKey } from '@/context/log-context';

export type Streaks = {
  current: number;
  longest: number;
  totalDays: number;
};

function shiftDays(d: Date, delta: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

/**
 * Current streak counts consecutive logged days ending today. If today isn't
 * logged yet the streak isn't broken — the day isn't over — so we start
 * counting from yesterday instead.
 */
export function computeStreaks(loggedDateKeys: string[], today = new Date()): Streaks {
  const logged = new Set(loggedDateKeys);
  const totalDays = logged.size;

  let current = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!logged.has(dateKey(cursor))) cursor = shiftDays(cursor, -1);
  while (logged.has(dateKey(cursor))) {
    current++;
    cursor = shiftDays(cursor, -1);
  }

  // Longest run anywhere in the history.
  const sorted = [...logged].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    if (prev !== null && dateKey(shiftDays(new Date(`${prev}T00:00:00`), 1)) === key) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = key;
  }

  return { current, longest: Math.max(longest, current), totalDays };
}
