import { supabase } from './supabase'
import { compressImage } from './imageCompress'

/**
 * Upload a profile photo to storage and set profiles.photo_url.
 * Tries `avatars` first, then `media` fallback (some deploys only have media).
 */
export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  const compressed = await compressImage(file, 720, 0.72)
  const named = new File([compressed], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' })
  const path = `${userId}/avatar-${Date.now()}.jpg`

  const tryUpload = async (bucket: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, named, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    })
    if (error) throw error
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  let url: string
  try {
    url = await tryUpload('avatars')
  } catch (avatarsErr: any) {
    try {
      url = await tryUpload('media')
    } catch (mediaErr: any) {
      const msg = mediaErr?.message || avatarsErr?.message || 'Storage upload failed'
      throw new Error(msg)
    }
  }

  const { error: dbErr } = await supabase.from('profiles').update({ photo_url: url }).eq('id', userId)
  if (dbErr) {
    // Fallback when profiles UPDATE policies recurse
    const { error: rpcErr } = await supabase.rpc('update_own_photo_url', { p_photo_url: url })
    if (rpcErr) throw new Error(dbErr.message || rpcErr.message || 'Could not save photo to profile')
  }

  return url
}
