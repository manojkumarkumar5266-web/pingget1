import { supabase } from './supabase'
import { compressImage } from './imageCompress'

/**
 * Upload a profile photo to storage and set profiles.photo_url.
 * Tries `avatars` first, then `media` fallback (some deploys only have media).
 * Saves photo_url via: direct update → update_own_photo_url RPC → update-profile-photo edge function.
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
  if (!dbErr) return url

  // Bypass recursive profiles UPDATE policies
  const { error: rpcErr } = await supabase.rpc('update_own_photo_url', { p_photo_url: url })
  if (!rpcErr) return url

  const { data: fnData, error: fnErr } = await supabase.functions.invoke('update-profile-photo', {
    body: { photo_url: url },
  })
  if (!fnErr && (fnData as any)?.success) return url

  const msg =
    dbErr.message ||
    rpcErr?.message ||
    fnErr?.message ||
    (fnData as any)?.error ||
    'Could not save photo to profile'
  if (/infinite recursion/i.test(msg)) {
    throw new Error(
      'Photo upload failed: profiles RLS recursion. Run supabase/APPLY_NOW_FIX_ACCEPT_AND_PHOTO.sql in Supabase SQL Editor, then retry.',
    )
  }
  throw new Error(msg)
}
