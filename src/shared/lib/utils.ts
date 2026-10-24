import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/*
 * The standard shadcn/ui class-merging helper. Lets a component accept a
 * `className` override and resolves conflicting Tailwind classes (e.g.
 * `p-2` vs an overriding `p-4`) deterministically instead of both landing
 * in the DOM.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
