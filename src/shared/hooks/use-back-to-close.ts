import { useEffect, useRef } from 'react'

let overlayCount = 0

/**
 * The phone's back button closes an open dialog or menu instead of leaving the page (or the app).
 * Opening adds a history entry with a marker; back pops it and closes. Closing any other way
 * removes the entry again, unless a navigation already put a new one on top.
 */
export function useBackToClose(isOpen: boolean, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    if (!isOpen) return
    overlayCount += 1
    const marker = `overlay-${overlayCount}`
    window.history.pushState({ ...window.history.state, overlay: marker }, '')

    const onPopState = () => {
      // Back on a dialog opened above this one only closes that one.
      if (window.history.state?.overlay === marker) return
      window.removeEventListener('popstate', onPopState)
      closeRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      // Closed by a link: the router writes the new URL in a microtask, so wait for it, then
      // only step back while our entry is still on top (never undo that navigation).
      window.setTimeout(() => {
        if (window.history.state?.overlay === marker) window.history.back()
      }, 0)
    }
  }, [isOpen])
}
