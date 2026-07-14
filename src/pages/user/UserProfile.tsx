import { useAuth } from '../../context'
import { Avatar } from '../../components/ui'
import { Mail, Phone, MapPin, Globe, LogOut, Headphones } from 'lucide-react'

export default function UserProfile() {
  const { profile, signOut } = useAuth()

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="card mb-4 p-6 text-center animate-slide-up">
        <div className="mx-auto mb-3 w-fit">
          <Avatar url={profile?.photo_url} name={profile?.full_name || 'User'} size={80} />
        </div>
        <h2 className="text-xl font-bold text-white">{profile?.full_name}</h2>
        <p className="text-sm text-white/50 capitalize">{profile?.role} Account</p>
      </div>

      <div className="card divide-y divide-gray-100 dark:divide-gray-800">
        <div className="flex items-center gap-3 p-4">
          <Mail size={18} className="text-white/40" />
          <div>
            <p className="text-xs text-white/40">Email</p>
            <p className="text-sm font-medium text-white">{profile?.id && 'Verified account'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Phone size={18} className="text-white/40" />
          <div>
            <p className="text-xs text-white/40">Phone</p>
            <p className="text-sm font-medium text-white">{profile?.phone || 'Not set'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <MapPin size={18} className="text-white/40" />
          <div>
            <p className="text-xs text-white/40">Address</p>
            <p className="text-sm font-medium text-white">{profile?.address || 'Not set'}</p>
            <p className="text-xs text-white/40">{profile?.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Globe size={18} className="text-white/40" />
          <div>
            <p className="text-xs text-white/40">Language</p>
            <p className="text-sm font-medium text-white">{profile?.preferred_language === 'en' ? 'English' : profile?.preferred_language}</p>
          </div>
        </div>
      </div>

      {/* Customer Service */}
      <div className="card mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: '#e5ecda' }}>
            <Headphones size={16} style={{ color: '#556d34' }} />
          </div>
          <h3 className="text-sm font-bold text-white">Customer Service</h3>
        </div>
        <p className="mb-3 text-xs text-white/50">
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
