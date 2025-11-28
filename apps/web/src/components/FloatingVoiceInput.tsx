import { Mic, MicOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export default function FloatingVoiceInput() {
  const getActiveProject = useAppStore((state) => state.getActiveProject)
  const terminalSessions = useAppStore((state) => state.terminalSessions)
  const { getAdapter } = useWebSocket()

  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const sendTextToTerminal = useCallback(async (text: string) => {
    const activeProject = getActiveProject()
    if (!activeProject?.selectedWorktree) return

    const sessionId = terminalSessions.get(activeProject.selectedWorktree)
    if (!sessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.writeToShell(sessionId, text)
    } catch (error) {
      console.error('Failed to send text:', error)
    }
  }, [getActiveProject, terminalSessions, getAdapter])

  const sendTextRef = useRef(sendTextToTerminal)

  useEffect(() => {
    sendTextRef.current = sendTextToTerminal
  }, [sendTextToTerminal])

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognitionAPI)

    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex]
      if (result.isFinal) {
        const transcript = result[0].transcript
        sendTextRef.current(transcript)
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
    }
  }, [])

  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const activeProject = getActiveProject()

  if (!isSupported || !activeProject?.selectedWorktree) {
    return null
  }

  return (
    <button
      onClick={toggleVoiceInput}
      className={`md:hidden fixed bottom-4 right-4 p-2 bg-background border-2 rounded-md shadow-md hover:bg-accent transition-colors flex items-center justify-center z-40 ${isListening ? "bg-red-100 dark:bg-red-900/30 border-red-500" : "border-border"}`}
      title={isListening ? "Stop voice input" : "Start voice input"}
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
    >
      {isListening ? (
        <Mic className="h-4 w-4 text-red-600 dark:text-red-400" />
      ) : (
        <MicOff className="h-4 w-4" />
      )}
    </button>
  )
}
