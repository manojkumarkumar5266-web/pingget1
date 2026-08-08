import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Images } from '../lib/customImages'
import { isDpApp } from '../lib/appTarget'
import Brand from '../components/Brand'
import { CTA } from '../design/primitives'
import { pg } from '../design/tokens'

const LANDING_DONE_USER = 'pingget_landing_done'
const LANDING_DONE_DP = 'pingget_dp_landing_done'

export function landingDoneKey(dp: boolean) {
  return dp ? LANDING_DONE_DP : LANDING_DONE_USER
}

/** Get Started once — after this, signed-out users go straight to auth (no welcome again). */
export default function LandingPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const dp = isDpApp()

  useEffect(() => { setReady(true) }, [])

  const goAuth = () => {
    localStorage.setItem(landingDoneKey(dp), '1')
    navigate('/auth', { replace: true })
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden" style={{ background: pg.bg }}>
      <div className="absolute inset-0">
        <img src={Images.landingBackground} alt="" className="h-full w-full object-cover opacity-30" draggable={false} />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(5,5,5,0.2) 0%, ${pg.bg} 72%)` }}
        />
      </div>

      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-8 pt-10"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? 'none' : 'translateY(16px)',
          transition: 'all 0.45s ease',
        }}
      >
        <div className="flex justify-center">
          <Brand size="md" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-6">
          <img
            src={dp ? Images.welcomeDp : Images.welcome}
            alt=""
            className="mb-8 w-full max-h-[46vh] object-contain"
            style={{ background: 'transparent' }}
            draggable={false}
          />
          <h1 className="mb-3 text-center text-[34px] font-extrabold leading-[1.05] tracking-tight">
            {dp ? (
              <>Deliver nearby.<br />Earn daily.</>
            ) : (
              <>Ask anything.<br />Get it fast.</>
            )}
          </h1>
          <p className="mb-8 max-w-sm text-center text-[15px] leading-relaxed" style={{ color: pg.text3 }}>
            {dp
              ? 'Go online, accept requests around you, and track every delivery in one place.'
              : 'Instant or scheduled delivery from local partners — groceries, meds, parcels and more.'}
          </p>
          <CTA className="w-full text-base" onClick={goAuth}>
            Get Started <ArrowRight size={18} />
          </CTA>
        </div>

        <p className="text-center text-[11px]" style={{ color: pg.text4 }}>
          By continuing you agree to Terms & Privacy
        </p>
      </div>
    </div>
  )
}
