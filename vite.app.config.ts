import { defineConfig, loadEnv, type UserConfigExport } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export type BuildTarget = 'user' | 'dp' | 'admin' | 'web'

/**
 * - user / dp / admin → separate Capacitor bundles (later)
 * - web → one deploy with path routing: / (user), /dp (partner), /admin (admin)
 */
export function createAppConfig(target: BuildTarget): UserConfigExport {
  const outDir =
    target === 'user' ? 'dist-user'
    : target === 'dp' ? 'dist-dp'
    : target === 'admin' ? 'dist-admin'
    : 'dist'

  return defineConfig(({ mode }) => {
    loadEnv(mode, process.cwd(), '')
    return {
      plugins: [react()],
      // Capacitor needs relative asset paths; unified web uses absolute for SPA routes
      base: target === 'web' ? '/' : './',
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
        port: target === 'dp' ? 5174 : target === 'admin' ? 5175 : target === 'web' ? 5173 : 5173,
      },
    }
  })
}
