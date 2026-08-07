import { createAppConfig } from './vite.app.config'

// Default `vite` / `npm run build` = Customer (user) app
export default createAppConfig((process.env.VITE_APP_TARGET as 'user' | 'dp' | 'admin') || 'user')
