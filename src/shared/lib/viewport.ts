const KEYBOARD_THRESHOLD = 120
const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, select'

function isEditing(): boolean {
  const active = document.activeElement
  return active instanceof HTMLElement && active.matches(EDITABLE)
}

export function installViewportTracking() {
  const viewport = window.visualViewport
  const root = document.documentElement
  let tallest = viewport?.height ?? window.innerHeight

  const update = () => {
    const height = viewport?.height ?? window.innerHeight
    if (!isEditing()) tallest = Math.max(height, window.innerHeight)
    const inset = viewport
      ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      : 0
    const isOpen =
      isEditing() && (inset > KEYBOARD_THRESHOLD || tallest - height > KEYBOARD_THRESHOLD)
    root.style.setProperty('--keyboard-inset', `${inset}px`)
    root.style.setProperty('--visual-height', `${height}px`)
    root.dataset.keyboard = isOpen ? 'open' : 'closed'
  }

  viewport?.addEventListener('resize', update)
  viewport?.addEventListener('scroll', update)
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', () => {
    tallest = 0
    update()
  })
  document.addEventListener('focusin', (event) => {
    update()
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.matches(EDITABLE)) return
    window.setTimeout(() => {
      update()
      if (root.dataset.keyboard === 'open')
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 350)
  })
  document.addEventListener('focusout', () => window.setTimeout(update, 50))
  update()
}
