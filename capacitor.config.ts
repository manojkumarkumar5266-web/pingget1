import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Customer mobile app — packages dist-user into android-customer/.
 * Firebase / Play package: com.pingget.customer
 * Partner app: capacitor.dp.config.ts → android-dp/ (com.pingget.dp)
 * Both share one Supabase project.
 */
const config: CapacitorConfig = {
  appId: 'com.pingget.customer',
  appName: 'pinGGet',
  webDir: 'dist-user',
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
    path: 'android-customer',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
  },
}

export default config
