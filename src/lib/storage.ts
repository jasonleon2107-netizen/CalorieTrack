import AsyncStorage from '@react-native-async-storage/async-storage';

// Versioned keys so a future data-shape change can migrate instead of crash.
export const StorageKeys = {
  profile: 'ct:profile:v1',
  units: 'ct:units:v1',
  log: 'ct:log:v1',
  weight: 'ct:weight:v1',
  customFoods: 'ct:customFoods:v1',
} as const;

export async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Failed to load "${key}" from storage:`, e);
    return null;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save "${key}" to storage:`, e);
  }
}

export async function clearAll(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(StorageKeys));
  } catch (e) {
    console.warn('Failed to clear storage:', e);
  }
}
