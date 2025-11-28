import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CornerDownLeft, Mic, MicOff } from 'lucide-react'
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

const KEYS = {
  ESC: '\x1b',
  ARROW_UP: '\x1b[A',
  ARROW_DOWN: '\x1b[B',
  ARROW_RIGHT: '\x1b[C',
  ARROW_LEFT: '\x1b[D',
  TAB: '\t',
  SHIFT_TAB: '\x1b[Z',
  CTRL_C: '\x03',
  ENTER: '\r',
}

export default function MobileTerminalToolbar() {
  const { getActiveProject, terminalSessions } = useAppStore()
  const { getAdapter } = useWebSocket()

  const [isListening, setIsListening] = useState(false)
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const sendKey = useCallback(async (key: string) => {
    const activeProject = getActiveProject()
    if (!activeProject?.selectedWorktree) return

    const sessionId = terminalSessions.get(activeProject.selectedWorktree)
    if (!sessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.writeToShell(sessionId, key)
    } catch (error) {
      console.error('Failed to send key:', error)
    }
  }, [getActiveProject, terminalSessions, getAdapter])

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
    setIsVoiceSupported(!!SpeechRecognitionAPI)

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

  if (!activeProject?.selectedWorktree) {
    return null
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 flex items-center bg-background border-t z-40">
      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-4 pl-2 pr-4 py-2">
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => sendKey(KEYS.CTRL_C)}
              className="px-2 py-2 text-xs font-medium bg-muted border rounded-md active:bg-accent text-red-600 dark:text-red-400"
            >
              ^C
            </button>
            <button
              onClick={() => sendKey(KEYS.ESC)}
              className="px-3 py-2 text-xs font-medium bg-muted border rounded-md active:bg-accent"
            >
              ESC
            </button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => sendKey(KEYS.ARROW_LEFT)}
              className="p-2 bg-muted border rounded-md active:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => sendKey(KEYS.ARROW_UP)}
              className="p-2 bg-muted border rounded-md active:bg-accent"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => sendKey(KEYS.ARROW_DOWN)}
              className="p-2 bg-muted border rounded-md active:bg-accent"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => sendKey(KEYS.ARROW_RIGHT)}
              className="p-2 bg-muted border rounded-md active:bg-accent"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => sendKey(KEYS.SHIFT_TAB)}
              className="px-2 py-2 text-xs font-medium bg-muted border rounded-md active:bg-accent"
            >
              ⇧TAB
            </button>
            <button
              onClick={() => sendKey(KEYS.TAB)}
              className="px-3 py-2 text-xs font-medium bg-muted border rounded-md active:bg-accent"
            >
              TAB
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 pl-4 pr-2 py-2 bg-background flex-shrink-0">
        {isVoiceSupported && (
          <button
            onClick={toggleVoiceInput}
            className={`p-2 border rounded-md active:bg-accent ${isListening ? "bg-red-100 dark:bg-red-900/30 border-red-500" : "bg-muted border-border"}`}
            title={isListening ? "Stop voice input" : "Start voice input"}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isListening ? (
              <Mic className="h-4 w-4 text-red-600 dark:text-red-400" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
          </button>
        )}
        <button
          onClick={() => sendKey(KEYS.ENTER)}
          className="p-2 bg-muted border rounded-md active:bg-accent"
          title="Send Enter"
          aria-label="Send Enter"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
