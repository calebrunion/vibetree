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
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [])

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
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
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
      adjustTextareaHeight()
      window.scrollTo(0, document.body.scrollHeight)
    }
    if (!isOpen) {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop()
        setIsListening(false)
      }
    }
  }, [isOpen, isListening, adjustTextareaHeight])

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (trimmed) {
      try {
        await onSend(trimmed)
        await new Promise((resolve) => setTimeout(resolve, 50))
        await onEnter()
        setText('')
        onClose()
      } catch (error) {
        console.error('Failed to send text to terminal:', error)
      }
    }
  }, [text, onSend, onEnter, setText, onClose])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      void handleSend()
    },
    [handleSend]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-background border-t rounded-t-2xl p-4 animate-in slide-in-from-bottom duration-200">
        <form onSubmit={handleSubmit} className="flex items-start gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              adjustTextareaHeight()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            onBlur={(e) => {
              if (!e.relatedTarget || !e.currentTarget.form?.contains(e.relatedTarget)) {
                onClose()
              }
            }}
            placeholder="Type or use voice input..."
            className="flex-1 min-h-10 max-h-[200px] px-3 py-2 text-sm bg-muted border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:bg-background focus:border-white resize-none overflow-y-auto"
            rows={1}
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
