import { useAuth } from '../../context'
import { Avatar, StarRating } from '../../components/ui'
import { Mail, Phone, MapPin, Bike, LogOut, Shield, Headphones } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase, DeliveryPartner } from '../../lib/supabase'

export default function DpProfile() {
  const { profile, signOut } = useAuth()
  const [dp, setDp] = useState<DeliveryPartner | null>(null)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('delivery_partners')
        .select('*')
        .eq('user_id', profile!.id)
        .maybeSingle()
      setDp(data as DeliveryPartner)
    }
    fetch()
  }, [profile])

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="card mb-4 p-6 text-center animate-slide-up">
        <div className="mx-auto mb-3 w-fit">
          <Avatar url={profile?.photo_url} name={profile?.full_name || 'DP'} size={80} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{profile?.full_name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Delivery Partner</p>
        {dp && dp.rating_count > 0 && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <StarRating value={dp.rating_avg} size={16} />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{dp.rating_avg.toFixed(1)} ({dp.rating_count})</span>
          </div>
        )}
        {dp && (
          <span className={`badge mt-3 ${dp.status === 'approved' ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'}`}>
            <Shield size={12} /> {dp.status}
          </span>
        )}
      </div>

      <div className="card divide-y divide-gray-100 dark:divide-gray-800">
        <div className="flex items-center gap-3 p-4">
          <Phone size={18} className="text-gray-400" />
          <div><p className="text-xs text-gray-400">Phone</p><p className="text-sm font-medium text-gray-900 dark:text-white">{profile?.phone || 'Not set'}</p></div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <MapPin size={18} className="text-gray-400" />
          <div><p className="text-xs text-gray-400">Address</p><p className="text-sm font-medium text-gray-900 dark:text-white">{profile?.address || 'Not set'}</p><p className="text-xs text-gray-400">{profile?.city}</p></div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Bike size={18} className="text-gray-400" />
          <div><p className="text-xs text-gray-400">Vehicle</p><p className="text-sm font-medium text-gray-900 dark:text-white">{dp?.vehicle_type || 'Bike'}</p></div>
        </div>
        {dp?.upi_id && (
          <div className="flex items-center gap-3 p-4">
            <span className="text-gray-400 text-sm font-bold">₹</span>
            <div><p className="text-xs text-gray-400">UPI ID</p><p className="text-sm font-medium text-gray-900 dark:text-white">{dp.upi_id}</p></div>
          </div>
        )}
      </div>

      {/* Customer Service */}
      <div className="card mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: '#e5ecda' }}>
            <Headphones size={16} style={{ color: '#556d34' }} />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Customer Service</h3>
        </div>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Send us an email with your request our customer care executive will reach out to you shortly.
        </p>
        <a
          href="mailto:pinggetin@gmail.com"
          className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors active:scale-[0.98]"
          style={{ backgroundColor: '#f0f5e9' }}
        >
          <Mail size={16} style={{ color: '#556d34' }} />
          <span className="text-sm font-semibold" style={{ color: '#3d5226' }}>pinggetin@gmail.com</span>
        </a>
      </div>

      <button onClick={() => signOut()} className="btn-danger mt-4 w-full">
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  )
}
