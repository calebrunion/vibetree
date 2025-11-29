import { useCallback, useEffect, useRef, useState } from 'react'

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

export default function VoiceInputDialog({
  isOpen,
  onClose,
  onSend,
  onEnter,
  text,
  setText,
}: {
  isOpen: boolean
  onClose: () => void
  onSend: (text: string) => void
  onEnter: () => void
  text: string
  setText: React.Dispatch<React.SetStateAction<string>>
}) {
  const [isListening, setIsListening] = useState(false)
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsVoiceSupported(!!SpeechRecognitionAPI)

    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex]
      if (result.isFinal) {
        const transcript = result[0].transcript
        setText((prev) => {
          const trimmed = prev.trim()
          if (trimmed) {
            return trimmed + ' ' + transcript
          }
          return transcript
        })
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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
    if (!isOpen) {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop()
        setIsListening(false)
      }
    }
  }, [isOpen, isListening])

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

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (trimmed) {
      onSend(trimmed)
      onEnter()
      setText('')
      onClose()
    }
  }, [text, onSend, onEnter, onClose])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      handleSend()
    },
    [handleSend]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-background border-t rounded-t-2xl p-4 animate-in slide-in-from-bottom duration-200">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => {
              if (!e.relatedTarget || !e.currentTarget.form?.contains(e.relatedTarget)) {
                onClose()
              }
            }}
            placeholder="Type or use voice input..."
            className="flex-1 h-10 px-3 text-sm bg-muted border rounded-lg focus:outline-none focus:ring-1 focus:ring-border"
            enterKeyHint="send"
          />
        </form>

        {isListening && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Listening...
          </div>
        )}
      </div>
    </div>
  )
}
