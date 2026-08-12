import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Customer mobile app — packages dist-user.
 * applicationId remains com.pingget.app until Firebase/google-services is updated.
 * Partner app uses capacitor.dp.config.ts (com.pingget.dp) in a separate native project.
 * Both share one Supabase project.
 */
const config: CapacitorConfig = {
  appId: 'com.pingget.customer',
  appName: 'PingGET',
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
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
  },
}

export default config
