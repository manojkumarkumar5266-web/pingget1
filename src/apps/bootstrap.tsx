import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from '../lib/supabase'
import { AuthProvider, ThemeProvider } from '../context'
import { APP_TARGET, APP_DISPLAY_NAME } from '../lib/appTarget'
import UserShell from './user/UserShell'
import DpShell from './dp/DpShell'
import AdminShell from './admin/AdminShell'
import '../index.css'

document.title =
  APP_TARGET === 'dp'
    ? `${APP_DISPLAY_NAME} — Deliver & Earn`
    : APP_TARGET === 'admin'
    ? `${APP_DISPLAY_NAME} — Console`
    : `${APP_DISPLAY_NAME} — Ask Anything. Get Anything.`

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

function Root() {
  if (APP_TARGET === 'dp') return <DpShell />
  if (APP_TARGET === 'admin') return <AdminShell />
  return <UserShell />
}

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
