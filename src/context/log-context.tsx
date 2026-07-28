import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { loadJSON, saveJSON, StorageKeys } from '@/lib/storage';

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: { key: MealCategory; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

// Best-guess meal based on the current hour, used as the default selection.
export function defaultMealForNow(date = new Date()): MealCategory {
  const h = date.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export type LogEntry = {
  id: string;
  name: string;
  meal: MealCategory;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

// A food you've logged before, remembered for one-tap re-logging (Quick Add).
export type RecentFood = { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number };

function pushRecent(list: RecentFood[], e: Omit<LogEntry, 'id' | 'meal'>): RecentFood[] {
  const r: RecentFood = { name: e.name, kcal: e.kcal, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG };
  return [r, ...list.filter((x) => !(x.name === r.name && x.kcal === r.kcal))].slice(0, 12);
}

export function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type LogByDate = Record<string, LogEntry[]>;

type LogContextValue = {
  entriesFor: (key: string) => LogEntry[];
  // Date keys that have at least one entry, for streak calculation.
  loggedDateKeys: string[];
  recents: RecentFood[];
  milestones: string[];
  markMilestone: (id: string) => void;
  addEntry: (key: string, entry: Omit<LogEntry, 'id'>) => void;
  addEntries: (key: string, entries: Omit<LogEntry, 'id'>[]) => void;
  removeEntry: (key: string, id: string) => void;
  hydrated: boolean;
};

let idCounter = 0;
const makeId = () => `${Date.now()}-${idCounter++}`;

const LogContext = createContext<LogContextValue | null>(null);

export function LogProvider({ children }: PropsWithChildren) {
  const [logByDate, setLogByDate] = useState<LogByDate>({});
  const [recents, setRecents] = useState<RecentFood[]>([]);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedLog, storedRecents, storedMilestones] = await Promise.all([
        loadJSON<LogByDate>(StorageKeys.log),
        loadJSON<RecentFood[]>(StorageKeys.recents),
        loadJSON<string[]>(StorageKeys.milestones),
      ]);
      if (storedLog && typeof storedLog === 'object') setLogByDate(storedLog);
      if (Array.isArray(storedRecents)) setRecents(storedRecents);
      if (Array.isArray(storedMilestones)) setMilestones(storedMilestones);
      setHydrated(true);
    })();
  }, []);

  // Persist on change, but never before hydration or we'd wipe stored data.
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.log, logByDate);
  }, [logByDate, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.recents, recents);
  }, [recents, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.milestones, milestones);
  }, [milestones, hydrated]);

  const value = useMemo<LogContextValue>(
    () => ({
      hydrated,
      recents,
      milestones,
      markMilestone: (id) => setMilestones((prev) => (prev.includes(id) ? prev : [...prev, id])),
      entriesFor: (key) => logByDate[key] ?? [],
      loggedDateKeys: Object.keys(logByDate).filter((k) => (logByDate[k]?.length ?? 0) > 0),
      addEntry: (key, entry) => {
        setLogByDate((prev) => ({
          ...prev,
          [key]: [...(prev[key] ?? []), { ...entry, id: makeId() }],
        }));
        setRecents((prev) => pushRecent(prev, entry));
      },
      // Commit a batch in one update so staged items land together.
      addEntries: (key, entries) => {
        setLogByDate((prev) => ({
          ...prev,
          [key]: [...(prev[key] ?? []), ...entries.map((e) => ({ ...e, id: makeId() }))],
        }));
        setRecents((prev) => entries.reduce((acc, e) => pushRecent(acc, e), prev));
      },
      removeEntry: (key, id) =>
        setLogByDate((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).filter((e) => e.id !== id),
        })),
    }),
    [logByDate, recents, milestones, hydrated]
  );

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}

export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error('useLog must be used within a LogProvider');
  return ctx;
}
