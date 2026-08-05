import { Platform } from 'react-native';

const SEEN_KEY = 'ct:install-seen:v1';

// Whether to offer the "Add to Home Screen" step, and whether we're on a touch
// device (so the instructions can match). Only meaningful on web: native is
// never eligible, and an already-installed PWA (standalone display) is done.
export function readInstallState(): { eligible: boolean; coarse: boolean } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { eligible: false, coarse: false };
  try {
    const mm = (q: string) => (window.matchMedia ? window.matchMedia(q).matches : false);
    const standalone = mm('(display-mode: standalone)') || (window.navigator as any).standalone === true;
    const coarse = mm('(pointer: coarse)');
    return { eligible: !standalone, coarse };
  } catch {
    return { eligible: false, coarse: false };
  }
}

// Whether the install screen has already been dismissed on this device, so it's
// shown at most once (to fresh onboarders and existing not-yet-installed users).
export function hasSeenInstall(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markInstallSeen(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore storage failures
  }
}
