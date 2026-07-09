import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './lib/supabase'
import App from './App'
import { AuthProvider, ThemeProvider } from './context'
import './index.css'

CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
  console.log("App URL:", url);

  if (url.includes("code=")) {
    console.log("Found code");
  }

  if (url.includes("access_token")) {
    console.log("Found access token");
  }
});

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