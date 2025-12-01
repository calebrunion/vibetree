/**
 * Service to dynamically discover server port
 */

let cachedServerPort: number | null = null

/**
 * Attempts to discover the server port by checking common ports
 */
async function discoverServerPort(): Promise<number> {
  if (cachedServerPort) {
    return cachedServerPort
  }

  // Use current hostname for discovery (supports network access)
  const hostname = window.location.hostname
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'

  // Start with configured port or default 3002 and check sequential ports
  const defaultPort = import.meta.env.VITE_SERVER_PORT ? parseInt(import.meta.env.VITE_SERVER_PORT) : 3002
  let startPort = defaultPort

  for (let i = 0; i < 50; i++) {
    // Check 50 sequential ports max
    const port = startPort + i
    try {
      const response = await fetch(`${protocol}//${hostname}:${port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(500), // 500ms timeout for faster discovery
      })

      if (response.ok) {
        cachedServerPort = port
        console.log(`✓ Discovered server port: ${port}`)
        return port
      }
    } catch (error) {
      // Continue trying next port
    }
  }

  // If discovery fails, fall back to environment variable or default
  const envPort = import.meta.env.VITE_SERVER_PORT
  if (envPort) {
    const port = parseInt(envPort)
    console.log(`📝 Using environment server port: ${port}`)
    return port
  }

  console.warn('⚠️ Could not discover server port, using fallback 3002')
  return 3002
}

/**
 * Gets the server WebSocket URL, discovering the port if needed
 */
export async function getServerWebSocketUrl(): Promise<string> {
  // Check if explicitly set via environment variable
  const explicitWsUrl = import.meta.env.VITE_WS_URL
  if (explicitWsUrl) {
    console.log(`📝 Using explicit WebSocket URL: ${explicitWsUrl}`)
    return explicitWsUrl
  }

  // Discover the port dynamically
  const port = await discoverServerPort()

  // Use current hostname for WebSocket URL (supports network access)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.hostname}:${port}`

  console.log(`🔌 Constructed WebSocket URL: ${wsUrl}`)
  return wsUrl
}

/**
 * Gets the server HTTP URL, discovering the port if needed
 */
export async function getServerHttpUrl(): Promise<string> {
  // Check if we can derive from WebSocket URL
  const explicitWsUrl = import.meta.env.VITE_WS_URL
  if (explicitWsUrl) {
    const httpUrl = explicitWsUrl.replace('ws://', 'http://').replace('wss://', 'https://')
    console.log(`📝 Using explicit HTTP URL: ${httpUrl}`)
    return httpUrl
  }

  // Discover the port dynamically
  const port = await discoverServerPort()

  // Use current hostname for HTTP URL (supports network access)
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  const httpUrl = `${protocol}//${window.location.hostname}:${port}`

  console.log(`🌐 Constructed HTTP URL: ${httpUrl}`)
  return httpUrl
}

/**
 * Reset cached server port (useful for testing or when server restarts)
 */
export function resetServerPortCache(): void {
  cachedServerPort = null
}
