const INVALID = '[aria-invalid="true"], [data-invalid="true"]'
const FOCUSABLE = 'input:not([disabled]), textarea:not([disabled]), button:not([disabled])'

/** Scrolls to the first invalid field inside `root` (in page order) and puts the cursor in it. */
export function focusFirstInvalid(root: HTMLElement | null) {
  const target = root?.querySelector<HTMLElement>(INVALID)
  if (!target) return
  const focusable = target.matches(FOCUSABLE)
    ? target
    : target.querySelector<HTMLElement>(FOCUSABLE)
  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  focusable?.focus({ preventScroll: true })
}
