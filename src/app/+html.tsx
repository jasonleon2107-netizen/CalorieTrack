import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Web-only document shell. Adds PWA metadata so the app can be installed to the
// home screen and run fullscreen (which hides the browser's address bar on
// iOS), and repositions expo-router's web tab bar from the top to the bottom.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* Installable PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0E0F12" />

        {/* iOS "Add to Home Screen": run fullscreen without Safari's chrome */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Calorie Tracker" />
        <link rel="apple-touch-icon" href="/icon-192.png" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: RESET_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const RESET_STYLE = `
  html, body { background-color: #0E0F12; }
  /* Center the app in a phone-width column so it reads like the native app on a
     desktop browser. On phones the column is wider than the screen, so it stays
     full-bleed. A soft shadow only appears once there's room beside the column. */
  body { display: flex; flex-direction: column; align-items: center; }
  #root { width: 100%; max-width: 480px; height: 100%; }
  @media (min-width: 520px) {
    #root { box-shadow: 0 0 60px rgba(0, 0, 0, 0.35); }
  }
  /* Move expo-router's floating web tab bar from top-center to bottom-center.
     It's fixed and viewport-centered, which lines up with the centered column. */
  [aria-label="Main"] {
    top: auto !important;
    bottom: calc(14px + env(safe-area-inset-bottom)) !important;
  }
  /* Respect reduced-motion, and act as a safety net: collapse entrance
     animations to instant so content can never sit on a hidden start frame. */
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.001ms !important; animation-delay: 0ms !important; }
  }
`;
