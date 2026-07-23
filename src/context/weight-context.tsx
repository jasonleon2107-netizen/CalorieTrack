import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { loadJSON, saveJSON, StorageKeys } from '@/lib/storage';

// Weight is always stored in kg, matching the profile. The UI converts.
export type WeightEntry = {
  date: string; // YYYY-MM-DD
  weightKg: number;
};

type WeightContextValue = {
  entries: WeightEntry[]; // sorted oldest -> newest
  logWeight: (date: string, weightKg: number) => void;
  removeWeight: (date: string) => void;
  hydrated: boolean;
};

const WeightContext = createContext<WeightContextValue | null>(null);

export function WeightProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadJSON<WeightEntry[]>(StorageKeys.weight);
      if (Array.isArray(stored)) setEntries(stored);
      setHydrated(true);
    })();
  }, []);

  // Never persist before hydration or we'd wipe stored data.
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.weight, entries);
  }, [entries, hydrated]);

  const value = useMemo<WeightContextValue>(
    () => ({
      entries,
      hydrated,
      // One entry per day: logging again for the same date replaces it.
      logWeight: (date, weightKg) =>
        setEntries((prev) =>
          [...prev.filter((e) => e.date !== date), { date, weightKg }].sort((a, b) =>
            a.date.localeCompare(b.date)
          )
        ),
      removeWeight: (date) => setEntries((prev) => prev.filter((e) => e.date !== date)),
    }),
    [entries, hydrated]
  );

  return <WeightContext.Provider value={value}>{children}</WeightContext.Provider>;
}

export function useWeight() {
  const ctx = useContext(WeightContext);
  if (!ctx) throw new Error('useWeight must be used within a WeightProvider');
  return ctx;
}
