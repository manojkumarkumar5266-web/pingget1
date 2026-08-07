import { defineConfig, loadEnv, type UserConfigExport } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Shared Vite factory:
 * - user  → Capacitor Customer app → dist-user
 * - dp    → Capacitor Partner app  → dist-dp
 * - admin → Web-only console       → dist-admin
 * Same Supabase env for all three.
 */
export function createAppConfig(target: 'user' | 'dp' | 'admin'): UserConfigExport {
  const outDir = target === 'user' ? 'dist-user' : target === 'dp' ? 'dist-dp' : 'dist-admin'

  return defineConfig(({ mode }) => {
    loadEnv(mode, process.cwd(), '')
    return {
      plugins: [react()],
      base: './',
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
      },
      define: {
        __PINGGET_APP_TARGET__: JSON.stringify(target),
      },
      build: {
        outDir,
        emptyOutDir: true,
      },
      server: {
        host: true,
        port: target === 'user' ? 5173 : target === 'dp' ? 5174 : 5175,
      },
    }
  })
}
