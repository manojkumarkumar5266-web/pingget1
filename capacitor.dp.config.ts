import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Delivery Partner mobile app — packages dist-dp into android-dp/.
 * Firebase / Play package: com.pingget.dp
 * Same Supabase as User + Admin.
 */
const config: CapacitorConfig = {
  appId: 'com.pingget.dp',
  appName: 'pinGGetDP',
  webDir: 'dist-dp',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B0B0B',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0B0B0B',
      showSpinner: false,
    },
  },
  android: {
    path: 'android-dp',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
  },
}

export default config
