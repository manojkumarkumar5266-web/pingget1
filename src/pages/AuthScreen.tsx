import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { supabase } from '../lib/supabase'
import { ErrorBanner } from '../components/ui'
import { Bike, Package, ArrowRight, CheckCircle, XCircle, MapPin, MessageCircle, User, Phone, Home } from 'lucide-react'

type Mode = 'main' | 'signup' | 'signup_success'
type Role = 'user' | 'dp'

type PincodeStatus = { served: boolean; area?: string; city?: string } | null

export default function AuthScreen() {
  const { signInWithGoogle, passwordRecovery, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'main' | 'signup' | 'signup_success'>('main')
  const [role, setRole] = useState<Role>('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Signup form fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>(null)
  const [pincodeChecking, setPincodeChecking] = useState(false)

  useEffect(() => {
    if (passwordRecovery) {
      clearPasswordRecovery()
    }
  }, [passwordRecovery, clearPasswordRecovery])

  // Handle OAuth callback - check if user's email exists in database
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const pendingSignup = sessionStorage.getItem('pending-signup')
      if (pendingSignup) {
        const signupData = JSON.parse(pendingSignup)

        // Check if signup is recent (within last 5 minutes)
        if (Date.now() - signupData.timestamp > 300000) {
          sessionStorage.removeItem('pending-signup')
          return
        }

        setLoading(true)

        try {
          // Create profile in database
          const profileData: Record<string, any> = {
            id: session.user.id,
            role: signupData.role,
            full_name: signupData.fullName,
            phone: signupData.phone,
            address: signupData.address,
            pincode: signupData.pincode,
            status: 'active',
          }

          const { error: profileError } = await supabase
            .from('profiles')
            .insert(profileData)

          if (profileError) {
            // If profile already exists, that's fine - just continue
            if (!profileError.message.includes('duplicate')) {
              throw profileError
            }
          }

          // For DP, create delivery_partner record
          if (signupData.role === 'dp') {
            const { error: dpError } = await supabase
              .from('delivery_partners')
              .insert({
                user_id: session.user.id,
                status: 'pending',
                vehicle_type: signupData.vehicleType || 'Bicycle',
              })

            if (dpError && !dpError.message.includes('duplicate')) {
              throw dpError
            }
          }

          sessionStorage.removeItem('pending-signup')
          setMode('signup_success')
        } catch (err: any) {
          setError(err.message || 'Failed to complete signup')
        } finally {
          setLoading(false)
        }
        return
      }

      // Check if user's email exists in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) {
        // User exists, redirect based on role
        if (profile.role === 'admin') {
          navigate('/admin')
        } else if (profile.role === 'dp') {
          navigate('/dp')
        } else {
          navigate('/app')
        }
      } else {
        // New user without profile - sign them out and show error
        await supabase.auth.signOut()
        setError('Account not found. Please sign up first.')
      }
    }

    handleOAuthCallback()
  }, [navigate])

  // Pincode validation
  useEffect(() => {
    if (pincode.length !== 6) {
      setPincodeStatus(null)
      return
    }
    const timer = setTimeout(async () => {
      setPincodeChecking(true)
      const { data: pins, error } = await supabase
  .from('pincodes')
  .select('*')
  .eq('pincode', pincode);

console.log("Pins:", pins);
console.log("Error:", error);
console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("Checking pincode:", pincode);
      const pin = pins?.[0]
      if (!pin) {
        setPincodeChecking(false)
        setPincodeStatus({ served: false })
        return
      }
      const { data: city, error: cityError } = await supabase
  .from('cities')
  .select('*')
  .eq('id', pin.city_id)
  .maybeSingle();

console.log("CITY:", city);
console.log("CITY ERROR:", cityError);
      setPincodeChecking(false)
      if (city?.is_active) {
        setPincodeStatus({ served: true, area: pin.area_name || '', city: city.name })
      } else {
        setPincodeStatus({ served: false })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [pincode])

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    const { error } = await signInWithGoogle()
    setLoading(false)
    if (error) setError(error)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }
    if (!phone.trim() || !/^\+?[\d\s\-]{10,}$/.test(phone)) {
      setError('Please enter a valid phone number')
      return
    }
    if (!address.trim()) {
      setError('Address is required')
      return
    }
    if (pincode.length !== 6) {
      setError('Please enter a 6-digit pincode')
      return
    }
    if (!pincodeStatus?.served) {
      setError('Sorry, we do not operate in this area yet.')
      return
    }

    // Store signup data in sessionStorage
    const signupData = {
      role,
      fullName,
      phone,
      address,
      pincode,
      timestamp: Date.now(),
    }
    sessionStorage.setItem('pending-signup', JSON.stringify(signupData))

    // Initiate Google OAuth
    setLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth',
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  const oliveGreen = '#808000'

  if (mode === 'signup_success') {
    return (
      <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #1c2a14 0%, #2a3d1c 40%, #374524 100%)' }}>
        <div className="flex min-h-screen flex-col justify-center px-6 py-8">
          <div className="card p-6 text-center max-w-md mx-auto">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
                <CheckCircle size={32} className="text-success-600 dark:text-success-400" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account Created!</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Your account has been created successfully. You can now sign in anytime.
            </p>
            <button
              onClick={() => { sessionStorage.removeItem('pending-signup'); window.location.reload(); }}
              className="btn-primary mt-5 w-full"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #1c2a14 0%, #2a3d1c 40%, #374524 100%)' }}>
      <div className="flex min-h-screen flex-col justify-between px-6 py-8">
        {/* Logo with tagline */}
        <div className="text-center">
          <span className="text-2xl font-black tracking-tight text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <span className="text-white">pin</span>
            <span style={{ color: oliveGreen }}>G</span>
            <span className="text-white">G</span>
            <span className="text-white">et</span>
          </span>
          <p className="text-[9px] font-semibold tracking-wider mt-0.5" style={{ color: oliveGreen }}>
            CHAT . ORDER . GET IT
          </p>
        </div>

        {mode === 'main' && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="card p-6 max-w-md w-full mx-auto">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 text-center">Welcome to pin<span style={{ color: '#808000' }}>G</span>Get</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">Sign in with your Google account</p>

              {error && <ErrorBanner message={error} />}

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Signing in...' : 'Sign In with Google'}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">or</span>
                </div>
              </div>

              <button
                onClick={() => { setRole('user'); setMode('signup'); }}
                className="btn-secondary w-full mb-3"
              >
                <User size={18} /> Sign Up as User
              </button>

              <button
                onClick={() => { setRole('dp'); setMode('signup'); }}
                className="btn-secondary w-full"
              >
                <Bike size={18} /> Sign Up as Delivery Partner
              </button>
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="card p-6 max-w-md w-full mx-auto">
              <button
                onClick={() => setMode('main')}
                className="text-sm text-primary-600 dark:text-primary-400 mb-4"
              >
                ← Back
              </button>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Sign Up as {role === 'dp' ? 'Delivery Partner' : 'User'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Fill in your details to get started</p>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="label flex items-center gap-1.5">
                    <User size={14} /> Full Name *
                  </label>
                  <input
                    className="input"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Phone size={14} /> Phone Number *
                  </label>
                  <input
                    className="input"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Home size={14} /> Address *
                  </label>
                  <input
                    className="input"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Your full address"
                    required
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5">
                    <MapPin size={14} /> Area Pincode *
                  </label>
                  <input
                    className="input"
                    value={pincode}
                    onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit pincode"
                    maxLength={6}
                    required
                  />
                  {pincodeChecking && <p className="mt-1.5 text-xs text-gray-400">Checking service area...</p>}
                  {!pincodeChecking && pincodeStatus && (
                    <div className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      pincodeStatus.served
                        ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                        : 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300'
                    }`}>
                      {pincodeStatus.served
                        ? <><CheckCircle size={13} /> We serve {pincodeStatus.area}{pincodeStatus.city ? `, ${pincodeStatus.city}` : ''}!</>
                        : <><XCircle size={13} /> Sorry, we don&apos;t serve this area yet.</>}
                    </div>
                  )}
                </div>

                {error && <ErrorBanner message={error} />}

                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loading ? 'Signing up...' : 'Complete Sign Up with Google'}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  You&apos;ll sign in with your Google account to complete registration
                </p>
              </form>
            </div>
          </div>
        )}

        {/* Bottom features */}
        <div className="mt-6 text-center text-xs text-white/40">
          By continuing you agree to our Terms &amp; Privacy Policy
        </div>

        <div
          className="overflow-hidden rounded-2xl border border-white/10"
          style={{ background: 'linear-gradient(135deg, #3a5228 0%, #4a6830 100%)' }}
        >
          <div className="grid grid-cols-4">
            {[
              { icon: <MessageCircle size={22} />, title: 'CHAT', sub: 'Easy Conversation' },
              { icon: <MapPin size={22} />, title: 'LOCATION', sub: 'Live Tracking' },
              { icon: <Bike size={22} />, title: 'DELIVERY', sub: 'Fast & Reliable' },
              { icon: <Package size={22} />, title: 'GET IT', sub: 'At Your Doorstep' },
            ].map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-1 px-1 py-4 text-center"
                style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                <span className="text-white">{f.icon}</span>
                <p className="mt-0.5 text-[10px] font-black tracking-wide text-white">{f.title}</p>
                <p className="text-[8px] font-semibold leading-tight text-white/80">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
