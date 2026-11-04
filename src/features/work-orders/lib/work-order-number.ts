import { labelKey } from '@/shared/lib/labels'

interface Original {
  number: string
  productCode: string
}

/** Whether the WO number was built from its product code, so it should follow the product. */
export function followsProduct(original: Original | null): boolean {
  return (
    original === null || original.number.toUpperCase().includes(original.productCode.toUpperCase())
  )
}

/** The product typed in the form is still the one the WO was saved with. */
export function isOriginalProduct(original: Original | null, product: string): boolean {
  return original !== null && labelKey(product) === labelKey(original.productCode)
}

/**
 * The WO number to put in the form, or null to leave it as it is. A new WO takes the suggestion;
 * an edit that changes the product takes the suggestion for the new product, and going back to
 * the original product restores the original number. Hand-typed numbers are never replaced.
 */
export function nextWorkOrderNumber({
  original,
  product,
  suggested,
  isTypedByHand,
}: {
  original: Original | null
  product: string
  suggested: string | undefined
  isTypedByHand: boolean
}): string | null {
  if (isTypedByHand || !followsProduct(original)) return null
  if (original && isOriginalProduct(original, product)) return original.number
  return suggested ?? null
}
