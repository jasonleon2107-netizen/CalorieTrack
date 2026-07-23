import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { ActivityKey, GoalAdjust, Sex, UnitSystem, calcGoal, calcMacros } from '@/lib/health';
import { loadJSON, saveJSON, StorageKeys } from '@/lib/storage';

export type Profile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityKey;
  adjust: GoalAdjust;
};

type ProfileContextValue = {
  profile: Profile | null;
  saveProfile: (profile: Profile) => void;
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  goalKcal: number | null;
  macros: { proteinG: number; carbsG: number; fatG: number } | null;
  hydrated: boolean;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [units, setUnits] = useState<UnitSystem>('imperial');
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state once on mount.
  useEffect(() => {
    (async () => {
      const [storedProfile, storedUnits] = await Promise.all([
        loadJSON<Profile>(StorageKeys.profile),
        loadJSON<UnitSystem>(StorageKeys.units),
      ]);
      if (storedProfile) setProfile(storedProfile);
      if (storedUnits === 'imperial' || storedUnits === 'metric') setUnits(storedUnits);
      setHydrated(true);
    })();
  }, []);

  // Persist on change, but never before hydration or we'd overwrite stored
  // data with the empty initial state.
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.profile, profile);
  }, [profile, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(StorageKeys.units, units);
  }, [units, hydrated]);

  const goalKcal = useMemo(() => (profile ? calcGoal(profile) : null), [profile]);
  const macros = useMemo(() => (goalKcal !== null ? calcMacros(goalKcal) : null), [goalKcal]);

  const value = useMemo(
    () => ({ profile, saveProfile: setProfile, units, setUnits, goalKcal, macros, hydrated }),
    [profile, units, goalKcal, macros, hydrated]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
