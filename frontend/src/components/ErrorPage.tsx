import { useRouteError } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

/** Shown instead of a blank/raw error screen if a page fails to render. */
export function ErrorPage() {
  const error = useRouteError() as Error | undefined
  return (
    <div className="error-page">
      <AlertTriangle size={28} />
      <h2>Something went wrong on this page</h2>
      <p className="muted">{error?.message ?? 'Unknown error'}</p>
      <div className="error-actions">
        <button type="button" className="btn primary" onClick={() => window.location.assign(window.location.pathname)}>Reload this page</button>
        <a className="btn default" href="/">Go to the client tracker</a>
      </div>
    </div>
  )
}
