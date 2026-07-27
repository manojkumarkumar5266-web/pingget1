import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './lib/supabase'
import App from './App'
import { AuthProvider, ThemeProvider } from './context'
import './index.css'

// Mobile (Capacitor): handle password recovery deep links.
// On web, detectSessionInUrl:true in the Supabase client handles the
// recovery token from the URL hash automatically — we must NOT reload
// the page, or the PASSWORD_RECOVERY event is lost and the reset page
// shows "link expired".
CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
  console.log("App URL:", url)

  if (url.includes("#")) {
    const hash = url.split("#")[1]

    const params = new URLSearchParams(hash)

    const access_token = params.get("access_token")
    const refresh_token = params.get("refresh_token")
    const type = params.get("type")

    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })

      if (error) {
        console.error(error)
        return
      }

      // Navigate to Reset Password page.
      // setSession fires SIGNED_IN, not PASSWORD_RECOVERY, so set a
      // flag that AuthContext checks on the next page load.
      if (type === "recovery") {
        sessionStorage.setItem('pingget_password_recovery', 'true')
        window.location.href = "/reset-password"
      }
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
