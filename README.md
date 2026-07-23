# Calorie Tracker

A native iOS calorie and macro tracker built with Expo and React Native. Everything is stored locally on your phone — no accounts, no backend, no cloud sync. The only network call is the food database lookup.

## Features

- **Daily log** with a calorie progress ring and protein / carbs / fat bars, grouped into collapsible Breakfast, Lunch, Dinner and Snacks sections
- **Three ways to add food** — search a food database, scan a barcode, or enter it manually
- **Save your own foods** and re-log them with one tap
- **Batch adding** — queue up several items, then commit them all at once
- **Interactive history calendar** — colour-coded days (green = goal met, grey = logged but off target, red = nothing logged); tap any day for the full breakdown
- **Goal calculation** using Mifflin-St Jeor with an activity multiplier, plus lose / maintain / gain adjustment
- **Weight tracking** with a trend chart, which keeps your calorie goal in sync as your weight changes
- **Logging streaks**
- **Imperial or metric**, switchable anywhere in the app
- **Light and dark mode**, following your system setting

## Requirements

- [Node.js](https://nodejs.org) 20 or newer
- The **Expo Go** app on your iPhone ([App Store](https://apps.apple.com/app/expo-go/id982107779))
- A computer and phone on the same Wi-Fi network

You do **not** need an Apple Developer account or a Mac to run this.

## Getting started

```bash
git clone <your-repo-url>
cd CalorieTracker
npm install
npx expo start
```

Then scan the QR code from the terminal with your iPhone camera and open it in Expo Go.

## Important: this project is pinned to Expo SDK 54

**Do not upgrade the `expo` package without checking first.** The version of Expo Go on the App Store only supports specific SDK versions, and Apple's review of new Expo Go builds often lags behind Expo's releases. If you upgrade past what the public Expo Go supports, the app will refuse to open on your phone with a "requires a newer version of Expo Go" error.

Check what the current Expo Go supports at [expo.dev/go](https://expo.dev/go) before bumping the SDK.

## Food data

Food search and barcode lookup both use [Open Food Facts](https://world.openfoodfacts.org), a free, open, crowd-sourced database. **No API key is required**, so the app works out of the box after cloning.

- Barcode lookup: `world.openfoodfacts.org/api/v2/product/{barcode}.json`
- Text search: `search.openfoodfacts.org/search?q={query}`

Because the data is crowd-sourced and skews toward branded products, results for generic whole foods can be inconsistent. Anything the database misses can be entered manually and saved for reuse.

## Project structure

```
src/
  app/                  Screens (Expo Router file-based routing)
    _layout.tsx         Root layout, context providers, onboarding gate
    index.tsx           Today screen
    history.tsx         History calendar
    settings.tsx        Settings, streaks, weight tracking
  components/           Reusable UI
  context/              App state (profile, log, weight, custom foods)
  lib/                  Pure logic: goal maths, food API, storage, streaks
  constants/theme.ts    Colour palette and spacing tokens
```

State lives in React context and persists to `AsyncStorage`. Each context hydrates on launch and exposes a `hydrated` flag; the splash screen is held until all of them are ready.

> **Note for contributors:** the save-on-change effects in each context are deliberately guarded with `if (!hydrated) return;`. Removing that guard causes the empty initial state to overwrite stored data on every launch.

## Data and privacy

All data stays on the device. There are no accounts, no analytics and no telemetry. Uninstalling the app deletes everything, and there is a "Reset all data" button in Settings.

## Type checking

```bash
npx tsc --noEmit
```

On some Windows and Node 24 setups this crashes with a `StackOverflowException`. That is a V8 stack-size quirk rather than a code error — use this instead:

```bash
node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit
```

## License

MIT — see [LICENSE](LICENSE).
