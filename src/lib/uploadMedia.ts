import { compressImage } from './imageCompress'
import { supabase } from './supabase'

/**
 * Upload an image/blob to the public `media` bucket with compression + content type.
 * Returns public URL or throws with a readable message.
 */
export async function uploadMediaFile(
  file: File | Blob,
  pathWithoutExt: string,
  opts?: { compress?: boolean; contentType?: string },
): Promise<string> {
  const compress = opts?.compress !== false
  let body: Blob = file
  let contentType = opts?.contentType || (file as File).type || 'application/octet-stream'
  let ext = 'bin'

  if (compress && (contentType.startsWith('image/') || !contentType || contentType === 'application/octet-stream')) {
    try {
      const asFile = file instanceof File ? file : new File([file], 'photo.jpg', { type: contentType || 'image/jpeg' })
      body = await compressImage(asFile)
      contentType = 'image/jpeg'
      ext = 'jpg'
    } catch {
      // keep original
    }
  } else if (contentType.includes('webm')) {
    ext = 'webm'
  } else if (contentType.includes('ogg')) {
    ext = 'ogg'
  } else if (contentType.includes('mp4') || contentType.includes('m4a')) {
    ext = 'm4a'
  } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    ext = 'jpg'
  } else if (contentType.includes('png')) {
    ext = 'png'
  } else if (contentType.includes('webp')) {
    ext = 'webp'
  } else if ((file as File).name?.includes('.')) {
    ext = (file as File).name.split('.').pop() || ext
  }

  const path = pathWithoutExt.endsWith(`.${ext}`) ? pathWithoutExt : `${pathWithoutExt}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, body, {
    upsert: true,
    contentType,
    cacheControl: '3600',
  })
  if (error) {
    throw new Error(error.message || 'Upload failed')
  }
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
