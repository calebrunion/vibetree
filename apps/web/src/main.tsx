// import React from 'react';
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@vibetree/auth'
import App from './App'
import './styles/globals.css'

const serverUrl = `${window.location.protocol}//${window.location.hostname}:3002`

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Temporarily disable StrictMode to fix terminal character duplication
  // <React.StrictMode>
  <AuthProvider serverUrl={serverUrl}>
    <App />
  </AuthProvider>
  // </React.StrictMode>
)
