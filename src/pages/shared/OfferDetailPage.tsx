import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Screen, CTA } from '../../design/primitives'
import { pg } from '../../design/tokens'
import { ArrowLeft, Megaphone } from 'lucide-react'

type Offer = {
  id: string
  title: string
  body: string | null
  image_url: string | null
  created_at: string
  type: string
  notification_type: string | null
}

/** Full offer / admin announcement detail (User + DP). */
export default function OfferDetailPage({ basePath }: { basePath: '/app' | '/dp' }) {
  const { offerId } = useParams<{ offerId: string }>()
  const navigate = useNavigate()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!offerId) return
    ;(async () => {
      const { data, error: err } = await supabase
        .from('notifications')
        .select('id, title, body, image_url, created_at, type, notification_type')
        .eq('id', offerId)
        .maybeSingle()
      if (err || !data) {
        setError(err?.message || 'Offer not found')
        setLoading(false)
        return
      }
      setOffer(data as Offer)
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', offerId)
      setLoading(false)
    })()
  }, [offerId])

  return (
    <Screen className="mx-auto max-w-lg animate-fade-in-up" pad={false}>
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]"
        style={{ background: 'rgba(7,8,11,0.94)', borderBottom: `1px solid ${pg.line}`, backdropFilter: 'blur(16px)' }}
      >
        <button
          type="button"
          onClick={() => navigate(`${basePath}/notifications`)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: pg.surface2, color: pg.text2 }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.lime }}>Offer</p>
          <p className="text-sm font-extrabold">Full details</p>
        </div>
      </div>

      <div className="px-4 py-5 pb-10">
        {loading ? (
          <p className="text-sm" style={{ color: pg.text3 }}>Loading…</p>
        ) : error || !offer ? (
          <div className="rounded-[22px] p-5" style={{ background: pg.surface, border: `1px solid ${pg.line}` }}>
            <p className="font-extrabold">Offer unavailable</p>
            <p className="mt-1 text-sm" style={{ color: pg.text3 }}>{error || 'This notification may have been deleted.'}</p>
            <CTA className="mt-4" onClick={() => navigate(`${basePath}/notifications`)}>Back to Alerts</CTA>
          </div>
        ) : (
          <article>
            {offer.image_url ? (
              <div
                className="mb-5 overflow-hidden rounded-[24px]"
                style={{ border: `1px solid ${pg.line}`, background: pg.surface }}
              >
                <img
                  src={offer.image_url}
                  alt=""
                  className="max-h-[55vh] w-full object-cover"
                />
              </div>
            ) : (
              <div
                className="mb-5 flex h-28 items-center justify-center rounded-[24px]"
                style={{ background: pg.limeDim, border: `1px solid rgba(196,214,0,0.25)` }}
              >
                <Megaphone size={28} style={{ color: pg.lime }} />
              </div>
            )}

            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: pg.text4 }}>
              {new Date(offer.created_at).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{offer.title}</h1>
            {offer.body && (
              <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: pg.text2 }}>
                {offer.body}
              </p>
            )}
          </article>
        )}
      </div>
    </Screen>
  )
}
