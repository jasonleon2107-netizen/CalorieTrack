import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { loadJSON, saveJSON, StorageKeys } from '@/lib/storage';

// A food the user saved themselves. Nutrition is stored per single serving.
export type CustomFood = {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: number;
  useCount: number;
};

type CustomFoodsContextValue = {
  foods: CustomFood[]; // most-used first
  saveFood: (food: Omit<CustomFood, 'id' | 'createdAt' | 'useCount'>) => void;
  removeFood: (id: string) => void;
  markUsed: (id: string) => void;
  hydrated: boolean;
};

const CustomFoodsContext = createContext<CustomFoodsContextValue | null>(null);

export function CustomFoodsProvider({ children }: PropsWithChildren) {
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadJSON<CustomFood[]>(StorageKeys.customFoods);
      if (Array.isArray(stored)) setFoods(stored);
      setHydrated(true);
    })();
  }, []);

  // Never persist before hydration or we'd wipe stored data.
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.customFoods, foods);
  }, [foods, hydrated]);

  const value = useMemo<CustomFoodsContextValue>(
    () => ({
      hydrated,
      // Most-used first, then newest, so frequent foods stay at the top.
      foods: [...foods].sort((a, b) => b.useCount - a.useCount || b.createdAt - a.createdAt),
      saveFood: (food) =>
        setFoods((prev) => {
          // Re-saving the same name updates it instead of creating a duplicate.
          const existing = prev.find((f) => f.name.toLowerCase() === food.name.toLowerCase());
          if (existing) {
            return prev.map((f) => (f.id === existing.id ? { ...f, ...food } : f));
          }
          return [
            ...prev,
            { ...food, id: `cf-${Date.now()}-${prev.length}`, createdAt: Date.now(), useCount: 0 },
          ];
        }),
      removeFood: (id) => setFoods((prev) => prev.filter((f) => f.id !== id)),
      markUsed: (id) =>
        setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, useCount: f.useCount + 1 } : f))),
    }),
    [foods, hydrated]
  );

  return <CustomFoodsContext.Provider value={value}>{children}</CustomFoodsContext.Provider>;
}

export function useCustomFoods() {
  const ctx = useContext(CustomFoodsContext);
  if (!ctx) throw new Error('useCustomFoods must be used within a CustomFoodsProvider');
  return ctx;
}
