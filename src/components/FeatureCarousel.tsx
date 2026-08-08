import Brand from './Brand'
import { Images } from '../lib/customImages'
import { pg } from '../design/tokens'

const FEATURES = [
  { title: 'Instant Delivery', subtitle: 'Local partners in minutes', image: Images.feature.card1 },
  { title: 'Advance Booking', subtitle: 'Plan up to 7 days ahead', image: Images.feature.card2 },
  { title: 'Order Your Way', subtitle: 'Describe any custom task', image: Images.feature.card3 },
  { title: 'Ask Anything', subtitle: 'Groceries to medicines', image: Images.feature.card4 },
  { title: 'Get Everything', subtitle: 'Multi-item, one partner', image: Images.feature.card5 },
  { title: 'Local Partners', subtitle: 'Trusted neighbourhood DPs', image: Images.feature.card6 },
  { title: 'Live Tracking', subtitle: 'Street map + status steps', image: Images.feature.card7 },
  { title: 'Chat & Pay', subtitle: 'Talk, pay, rate in-app', image: Images.feature.card8 },
  { title: 'Safe & Fast', subtitle: 'Verified delivery partners', image: Images.feature.card9 },
]

/** Full HD feature images — stacked, no carousel, no cropping borders */
export default function FeatureCarousel() {
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-3 px-0.5">
        <Brand size="sm" />
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: pg.lime }}>
            Discover
          </p>
          <h2 className="text-[18px] font-extrabold tracking-tight" style={{ color: pg.text2 }}>
            What’s on offer
          </h2>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {FEATURES.map((f) => (
          <article key={f.title} className="w-full">
            <img
              src={f.image}
              alt={f.title}
              className="w-full object-contain"
              style={{ background: 'transparent', display: 'block' }}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <div className="mt-2.5 px-0.5">
              <p className="text-[16px] font-extrabold tracking-tight">{f.title}</p>
              <p className="mt-0.5 text-xs" style={{ color: pg.text3 }}>{f.subtitle}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
