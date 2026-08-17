import { supabase } from './supabase'

/**
 * After DP account creation, sign in briefly so storage + profile RLS allow
 * uploading photo / aadhaar / licence, then leave the session (success screen).
 */
export async function uploadDpSignupDocuments(opts: {
  email: string
  password: string
  userId: string
  photoFile: File | null
  aadhaarFile: File | null
  licenseFile: File | null
  needsLicense: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const { email, password, userId, photoFile, aadhaarFile, licenseFile, needsLicense } = opts

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (signInError) {
    return { ok: false, error: signInError.message || 'Could not authenticate to upload documents' }
  }

  const upload = async (file: File, path: string, bucket: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined })
    if (error) throw new Error(error.message)
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  try {
    if (photoFile) {
      const photoUrl = await upload(photoFile, `${userId}/photo_${Date.now()}`, 'avatars')
      if (photoUrl) {
        await supabase.from('profiles').update({ photo_url: photoUrl }).eq('id', userId)
      }
    }
    if (aadhaarFile) {
      const aadhaarUrl = await upload(aadhaarFile, `${userId}/aadhaar_${Date.now()}`, 'media')
      if (aadhaarUrl) {
        await supabase.from('delivery_partners').update({ aadhaar_url: aadhaarUrl }).eq('user_id', userId)
      }
    }
    if (needsLicense && licenseFile) {
      const licenseUrl = await upload(licenseFile, `${userId}/license_${Date.now()}`, 'media')
      if (licenseUrl) {
        await supabase.from('delivery_partners').update({ driving_license_url: licenseUrl }).eq('user_id', userId)
      }
    }
  } catch (e: any) {
    await supabase.auth.signOut().catch(() => {})
    return { ok: false, error: e?.message || 'Document upload failed' }
  }

  // Stay signed out until admin approves — show success UI
  await supabase.auth.signOut().catch(() => {})
  return { ok: true }
}
