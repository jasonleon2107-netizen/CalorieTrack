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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadJSON<LogByDate>(StorageKeys.log);
      if (stored && typeof stored === 'object') setLogByDate(stored);
      setHydrated(true);
    })();
  }, []);

  // Persist on change, but never before hydration or we'd wipe stored data.
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.log, logByDate);
  }, [logByDate, hydrated]);

  const value = useMemo<LogContextValue>(
    () => ({
      hydrated,
      entriesFor: (key) => logByDate[key] ?? [],
      loggedDateKeys: Object.keys(logByDate).filter((k) => (logByDate[k]?.length ?? 0) > 0),
      addEntry: (key, entry) =>
        setLogByDate((prev) => ({
          ...prev,
          [key]: [...(prev[key] ?? []), { ...entry, id: makeId() }],
        })),
      // Commit a batch in one update so staged items land together.
      addEntries: (key, entries) =>
        setLogByDate((prev) => ({
          ...prev,
          [key]: [...(prev[key] ?? []), ...entries.map((e) => ({ ...e, id: makeId() }))],
        })),
      removeEntry: (key, id) =>
        setLogByDate((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).filter((e) => e.id !== id),
        })),
    }),
    [logByDate, hydrated]
  );

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}

export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error('useLog must be used within a LogProvider');
  return ctx;
}
