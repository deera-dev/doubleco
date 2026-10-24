import { env } from '@/shared/config/env'

export function cloudinaryImageUrl(publicId: string, transformation = 'f_auto,q_auto'): string {
  return `https://res.cloudinary.com/${env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload/${transformation}/${publicId}`
}
