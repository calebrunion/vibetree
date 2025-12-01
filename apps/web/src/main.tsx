// import React from 'react';
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@buddy/auth'
import App from './App'
import './styles/globals.css'

const serverPort = import.meta.env.VITE_SERVER_PORT || 3002
const serverUrl = `${window.location.protocol}//${window.location.hostname}:${serverPort}`

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Temporarily disable StrictMode to fix terminal character duplication
  // <React.StrictMode>
  <AuthProvider serverUrl={serverUrl}>
    <App />
  </AuthProvider>
  // </React.StrictMode>
)
