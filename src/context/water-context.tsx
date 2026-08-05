import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { loadJSON, saveJSON, StorageKeys } from '@/lib/storage';

// Water intake in fluid ounces, per day (keyed YYYY-MM-DD like the food log).
type WaterByDate = Record<string, number>;

type WaterContextValue = {
  ouncesFor: (key: string) => number;
  setOunces: (key: string, oz: number) => void;
  hydrated: boolean;
};

const WaterContext = createContext<WaterContextValue | null>(null);

export function WaterProvider({ children }: PropsWithChildren) {
  const [byDate, setByDate] = useState<WaterByDate>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadJSON<WaterByDate>(StorageKeys.water);
      if (stored && typeof stored === 'object') setByDate(stored);
      setHydrated(true);
    })();
  }, []);

  // Never persist before hydration or we'd wipe stored data.
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.water, byDate);
  }, [byDate, hydrated]);

  const value = useMemo<WaterContextValue>(
    () => ({
      hydrated,
      ouncesFor: (key) => byDate[key] ?? 0,
      setOunces: (key, oz) => setByDate((prev) => ({ ...prev, [key]: Math.max(0, Math.round(oz)) })),
    }),
    [byDate, hydrated]
  );

  return <WaterContext.Provider value={value}>{children}</WaterContext.Provider>;
}

export function useWater() {
  const ctx = useContext(WaterContext);
  if (!ctx) throw new Error('useWater must be used within a WaterProvider');
  return ctx;
}
