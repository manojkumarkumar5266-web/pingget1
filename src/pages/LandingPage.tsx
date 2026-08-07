import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import { Images } from '../lib/customImages'
import { IS_DP_APP } from '../lib/appTarget'
import { ArrowRight } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B0B0B]">
      <div className="absolute inset-0">
        <img
          src={Images.landingBackground}
          alt=""
          className="h-full w-full object-cover opacity-40"
          draggable={false}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-4">
        <div className={`flex flex-1 flex-col items-center justify-center max-w-md mx-auto w-full transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Brand size="xl" showTagline={false} className="mb-6" />

          <img
            src={Images.landingHero}
            alt=""
            className="mb-8 w-full max-w-xs object-contain"
            draggable={false}
          />

          <p className="mb-6 text-center text-sm text-white/55">
            {IS_DP_APP
              ? 'Earn by delivering in your neighbourhood.'
              : 'Order groceries, medicines, parcels and more.'}
          </p>

          <button
            onClick={() => navigate('/auth')}
            className="w-full rounded-2xl py-4 text-base font-bold shadow-lg transition-all active:scale-95"
            style={{ backgroundColor: '#A6B300', color: '#0B0B0B', boxShadow: '0 8px 24px rgba(166,179,0,0.35)' }}
          >
            Get Started <ArrowRight size={18} className="inline" />
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-white/40">
          By continuing you agree to our Terms &amp; Privacy Policy
        </div>
      </div>
    </div>
  )
}
