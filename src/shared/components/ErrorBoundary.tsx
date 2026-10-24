import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors thrown by its children so one broken
 * component can't blank the whole screen. Route-level boundaries live in
 * `app/routes/__root.tsx`; wrap a risky feature in its own boundary when
 * it should fail independently of the rest of the page.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  override render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset)
    }

    return this.props.children
  }
}
