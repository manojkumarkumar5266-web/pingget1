import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from '../lib/supabase'
import { AuthProvider, ThemeProvider } from '../context'
import { APP_TARGET, APP_DISPLAY_NAME, resolveAppTarget } from '../lib/appTarget'
import UserShell from './user/UserShell'
import DpShell from './dp/DpShell'
import AdminShell from './admin/AdminShell'
import '../index.css'

function syncDocumentTitle(target: 'user' | 'dp' | 'admin') {
  if (target === 'dp') document.title = `${APP_DISPLAY_NAME} — Deliver & Earn`
  else if (target === 'admin') document.title = `${APP_DISPLAY_NAME} — Console`
  else document.title = `${APP_DISPLAY_NAME} — Ask Anything. Get Anything.`
}

CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
  if (!url.includes('#')) return
  const hash = url.split('#')[1]
  const params = new URLSearchParams(hash)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  const type = params.get('type')
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) {
      console.error(error)
      return
    }
    if (type === 'recovery') {
      sessionStorage.setItem('pingget_password_recovery', 'true')
      window.location.href = '/reset-password'
    }
  }
}).catch(() => {
  /* web — Capacitor plugins may be unavailable */
})

/**
 * Pick shell from the current URL (unified web) or from the build target (Capacitor).
 * Must subscribe to location so /dp and /admin remount the correct shell.
 */
function Root() {
  const location = useLocation()
  const target = resolveAppTarget()

  useEffect(() => {
    syncDocumentTitle(target)
  }, [target, location.pathname])

  if (target === 'dp') return <DpShell />
  if (target === 'admin') return <AdminShell />
  return <UserShell />
}

// Keep APP_TARGET referenced so dedicated builds still tree-shake cleanly
void APP_TARGET
syncDocumentTitle(resolveAppTarget())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
