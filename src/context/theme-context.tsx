import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { loadJSON, saveJSON, StorageKeys } from '@/lib/storage';

export type ThemePreference = 'light' | 'dark';

type ThemeContextValue = {
  // The effective scheme in use (either the user's choice or the system default).
  scheme: ThemePreference;
  // Persist an explicit choice.
  setScheme: (p: ThemePreference) => void;
  toggle: () => void;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const systemScheme: ThemePreference = system === 'light' ? 'light' : 'dark';

  // `null` = the user has never chosen, so follow the system scheme.
  const [stored, setStored] = useState<ThemePreference | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadJSON<ThemePreference>(StorageKeys.theme);
      if (s === 'light' || s === 'dark') setStored(s);
      setHydrated(true);
    })();
  }, []);

  const scheme = stored ?? systemScheme;

  // Persist on the user action itself (never in an effect), so the empty
  // initial state can't overwrite a stored choice on launch.
  const setScheme = useCallback((p: ThemePreference) => {
    setStored(p);
    saveJSON(StorageKeys.theme, p);
  }, []);

  // Keep the web document's color-scheme in sync so native form controls,
  // scrollbars, and the browser chrome match the chosen theme.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = scheme;
    }
  }, [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, setScheme, toggle: () => setScheme(scheme === 'light' ? 'dark' : 'light'), hydrated }),
    [scheme, setScheme, hydrated]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeProvider');
  return ctx;
}
