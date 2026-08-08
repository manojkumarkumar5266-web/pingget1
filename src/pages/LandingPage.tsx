import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Images } from '../lib/customImages'
import { isDpApp } from '../lib/appTarget'
import { ArrowRight } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const dp = isDpApp()

  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B0B0B]">
      <div className="absolute inset-0">
        <img
          src={Images.landingBackground}
          alt=""
          className="h-full w-full object-cover opacity-35"
          draggable={false}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,11,11,0.55) 0%, #0B0B0B 78%)' }} />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-6">
        <div className={`mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <img
            src={dp ? Images.welcomeDp : Images.landingHero}
            alt=""
            className="mb-6 w-full max-h-[48vh] object-contain"
            style={{ background: 'transparent' }}
            draggable={false}
          />

          <h1 className="mb-2 text-center text-3xl font-extrabold tracking-tight text-white">
            {dp ? 'Deliver & Earn' : 'Ask. Order. Get it.'}
          </h1>
          <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-white/55">
            {dp
              ? 'Accept nearby requests and earn in your neighbourhood.'
              : 'Groceries, medicines, parcels — delivered by local partners.'}
          </p>

          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="btn-primary w-full text-base"
          >
            Get Started <ArrowRight size={18} className="inline" />
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-white/35">
          By continuing you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  )
}
