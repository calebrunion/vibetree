import { useCallback, useEffect, useState, useRef } from 'react'
import { useAppStore } from '../store'
import {
  connectGlobalAdapter,
  disconnectGlobalAdapter,
  getGlobalAdapter,
  isConnected,
  onGlobalAdapterConnected,
  onGlobalAdapterDisconnected,
} from '../adapters/globalWebSocketAdapter'
import { getServerWebSocketUrl } from '../services/portDiscovery'
import { getAuthenticatedWebSocketUrl } from '../services/authService'

export function useWebSocket() {
  const { setConnected, setConnecting, setReconnecting, setError } = useAppStore()

  // Local state to force re-renders when adapter changes
  const [adapterVersion, setAdapterVersion] = useState(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasConnectedOnce = useRef(false)

  const connect = useCallback(
    async (isReconnect = false) => {
      if (isConnected()) {
        console.log('🔌 Already connected to global adapter')
        return
      }

      if (isReconnect) {
        setReconnecting(true)
      } else {
        setConnecting(true)
      }
      setError(null)

      try {
        // Get WebSocket URL using dynamic port discovery
        const baseWsUrl = await getServerWebSocketUrl()

        // Add authentication if available
        const wsUrl = getAuthenticatedWebSocketUrl(baseWsUrl)

        console.log('🔌 Attempting WebSocket connection to:', wsUrl)

        await connectGlobalAdapter(wsUrl)

        setConnected(true)
        setConnecting(false)
        setReconnecting(false)
        hasConnectedOnce.current = true
        setAdapterVersion((prev) => prev + 1) // Force re-render
      } catch (error) {
        setConnecting(false)
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect'

        if (isReconnect) {
          console.log('🔄 Reconnection attempt failed, retrying in 2s...')
          reconnectTimeoutRef.current = setTimeout(() => {
            connect(true)
          }, 2000)
        } else {
          setReconnecting(false)
          setError(errorMessage)
        }

        console.error('💔 WebSocket connection failed with error:', error)
        console.error('💔 Error details:', {
          message: errorMessage,
          type: typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    },
    [setConnected, setConnecting, setReconnecting, setError]
  )

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting global WebSocket adapter')
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    hasConnectedOnce.current = false
    disconnectGlobalAdapter()
    setConnected(false)
    setReconnecting(false)
    setAdapterVersion((prev) => prev + 1) // Force re-render
  }, [setConnected, setReconnecting])

  const getAdapter = useCallback(() => {
    const adapter = getGlobalAdapter()
    console.log('🔍 getAdapter called, globalAdapter:', adapter)
    return adapter
  }, [adapterVersion]) // Re-run when adapter changes

  // Subscribe to global adapter state changes
  useEffect(() => {
    const unsubscribeConnected = onGlobalAdapterConnected(() => {
      console.log('🔌 Global adapter connected callback')
      setConnected(true)
      setReconnecting(false)
      hasConnectedOnce.current = true
      setAdapterVersion((prev) => prev + 1)
    })

    const unsubscribeDisconnected = onGlobalAdapterDisconnected(() => {
      console.log('💔 Global adapter disconnected callback')
      setConnected(false)
      setAdapterVersion((prev) => prev + 1)

      // Auto-reconnect if we had connected before
      if (hasConnectedOnce.current) {
        console.log('🔄 Connection lost, attempting to reconnect...')
        connect(true)
      }
    })

    return () => {
      unsubscribeConnected()
      unsubscribeDisconnected()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [setConnected, setReconnecting, connect])

  return {
    connect,
    disconnect,
    getAdapter,
  }
}
