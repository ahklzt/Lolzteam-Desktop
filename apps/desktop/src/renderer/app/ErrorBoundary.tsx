import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] неперехваченная ошибка', error, info)
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Что-то пошло не так</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
