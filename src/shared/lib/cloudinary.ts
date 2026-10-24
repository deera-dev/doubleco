import { env } from '@/shared/config/env'

/*
 * Builds a public delivery URL from a Cloudinary public ID. Only the
 * cloud name is needed for this — it is not a secret. Signed operations
 * (uploads, deletes) need the API key/secret, which stay server-only and
 * belong in a Supabase Edge Function or Vercel serverless function, never
 * in this file.
 */
export function cloudinaryImageUrl(publicId: string, transformation = 'f_auto,q_auto'): string {
  return `https://res.cloudinary.com/${env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload/${transformation}/${publicId}`
}
