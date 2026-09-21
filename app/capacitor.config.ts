import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The bundle identifier is deliberately unchanged.
  //
  // Apple does not allow a bundle id to change after first submission: a new
  // one means a new App Store record, new provisioning profiles, new signing
  // secrets and a first review from zero. Every one of those would also break
  // the Mac-free GitHub Actions pipeline this project depends on. The app's
  // NAME is what users see, and that is free to change in App Store Connect,
  // so frontier go ships under the identifier Trailer Roulette established.
  // See docs/FRONTIER-GO-MIGRATION.md.
  appId: 'app.trailerroulette.ios',
  appName: 'frontier go',
  webDir: 'dist',
  ios: {
    // The web view is transparent and floats over a native AVPlayerLayer.
    // Any inset, bounce or background colour here would show up as a band of
    // nothing over the footage.
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#00000000',
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: 'mobile',
    handleApplicationNotifications: false,
  },
  server: {
    // Serve the bundled app from https://localhost rather than a custom
    // scheme. Retained from the previous product: the original reason (a
    // YouTube embed that rejected non-http origins) is gone with YouTube, but
    // changing the scheme now would orphan the localStorage of every
    // installed build for no benefit. Durable state lives in Capacitor
    // Preferences, which is keyed by bundle id and unaffected either way.
    iosScheme: 'https',
  },
  plugins: {
    App: {},
    Haptics: {},
    Share: {},
    Preferences: {
      group: 'NSUserDefaults',
    },
  },
};

export default config;
