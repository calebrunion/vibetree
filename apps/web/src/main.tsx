// import React from 'react';
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@buddy/auth'
import App from './App'
import './styles/globals.css'

const serverPort = import.meta.env.VITE_SERVER_PORT || 3002
const serverUrl = `${window.location.protocol}//${window.location.hostname}:${serverPort}`

// Handle external links in PWA - open them in the system browser
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('a')
  if (!target) return

  const href = target.getAttribute('href')
  if (!href) return

  // Check if it's an external link (different origin or explicit external)
  try {
    const url = new URL(href, window.location.origin)
    const isExternal = url.origin !== window.location.origin
    const isExplicitExternal = target.getAttribute('target') === '_blank'

    if (isExternal || isExplicitExternal) {
      e.preventDefault()
      window.open(href, '_blank', 'noopener,noreferrer')
    }
  } catch {
    // Invalid URL, let it be handled normally
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Temporarily disable StrictMode to fix terminal character duplication
  // <React.StrictMode>
  <AuthProvider serverUrl={serverUrl}>
    <App />
  </AuthProvider>
  // </React.StrictMode>
)
