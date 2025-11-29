import { useCallback, useEffect, useRef, useState } from 'react'
import NoSleep from 'nosleep.js'

type KeepAwakeMethod = 'wakeLock' | 'noSleep' | 'audio' | null

interface KeepAwakeState {
  isActive: boolean
  method: KeepAwakeMethod
  isSupported: boolean
}

export function useKeepAwake() {
  const [state, setState] = useState<KeepAwakeState>({
    isActive: false,
    method: null,
    isSupported: false,
  })

  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const noSleepRef = useRef<NoSleep | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const isRequestedRef = useRef(false)

  const hasWakeLockSupport = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  useEffect(() => {
    noSleepRef.current = new NoSleep()
    setState((prev) => ({
      ...prev,
      isSupported: true,
    }))

    return () => {
      noSleepRef.current?.disable()
      noSleepRef.current = null
    }
  }, [])

  const startSilentAudio = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return false

      audioContextRef.current = new AudioContextClass()
      const ctx = audioContextRef.current

      oscillatorRef.current = ctx.createOscillator()
      const gainNode = ctx.createGain()

      gainNode.gain.value = 0.001
      oscillatorRef.current.frequency.value = 1

      oscillatorRef.current.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillatorRef.current.start()

      return true
    } catch (err) {
      console.log('Silent audio failed:', err)
      return false
    }
  }, [])

  const stopSilentAudio = useCallback(() => {
    try {
      oscillatorRef.current?.stop()
      oscillatorRef.current?.disconnect()
      oscillatorRef.current = null
      audioContextRef.current?.close()
      audioContextRef.current = null
    } catch {
      // Ignore cleanup errors
    }
  }, [])

  const requestWakeLock = useCallback(async (): Promise<boolean> => {
    if (!hasWakeLockSupport) return false

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')

      wakeLockRef.current.addEventListener('release', () => {
        if (isRequestedRef.current) {
          setState((prev) => ({
            ...prev,
            isActive: prev.method !== 'wakeLock',
            method: prev.method === 'wakeLock' ? null : prev.method,
          }))
        }
      })

      return true
    } catch (err) {
      console.log('Wake lock request failed:', err)
      return false
    }
  }, [hasWakeLockSupport])

  const request = useCallback(async () => {
    if (state.isActive) return true

    isRequestedRef.current = true
    let method: KeepAwakeMethod = null

    const wakeLockSuccess = await requestWakeLock()
    if (wakeLockSuccess) {
      method = 'wakeLock'
    }

    try {
      noSleepRef.current?.enable()
      if (!method) method = 'noSleep'
    } catch (err) {
      console.log('NoSleep failed:', err)
    }

    const audioSuccess = startSilentAudio()
    if (audioSuccess && !method) {
      method = 'audio'
    }

    if (method) {
      setState({
        isActive: true,
        method,
        isSupported: true,
      })
      return true
    }

    return false
  }, [state.isActive, requestWakeLock, startSilentAudio])

  const release = useCallback(async () => {
    isRequestedRef.current = false

    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch {
        // Ignore release errors
      }
      wakeLockRef.current = null
    }

    noSleepRef.current?.disable()
    stopSilentAudio()

    setState((prev) => ({
      ...prev,
      isActive: false,
      method: null,
    }))
  }, [stopSilentAudio])

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isRequestedRef.current) {
        if (hasWakeLockSupport && !wakeLockRef.current) {
          await requestWakeLock()
        }

        if (audioContextRef.current?.state === 'suspended') {
          try {
            await audioContextRef.current.resume()
          } catch {
            // Ignore resume errors
          }
        }

        if (!audioContextRef.current && isRequestedRef.current) {
          startSilentAudio()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [hasWakeLockSupport, requestWakeLock, startSilentAudio])

  useEffect(() => {
    const handlePageShow = async (event: PageTransitionEvent) => {
      if (event.persisted && isRequestedRef.current) {
        await request()
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [request])

  useEffect(() => {
    return () => {
      wakeLockRef.current?.release()
      noSleepRef.current?.disable()
      stopSilentAudio()
    }
  }, [stopSilentAudio])

  return {
    isActive: state.isActive,
    method: state.method,
    isSupported: state.isSupported,
    request,
    release,
  }
}
