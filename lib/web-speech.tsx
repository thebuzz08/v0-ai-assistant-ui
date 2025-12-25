"use client"

import { useState, useRef, useCallback, useEffect } from "react"

// Extend Window interface for WebkitSpeechRecognition
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

interface UseWebSpeechOptions {
  onInterimResult?: (transcript: string) => void
  onFinalResult?: (transcript: string) => void
  onError?: (error: string) => void
  continuous?: boolean
  language?: string
}

export function useWebSpeech(options: UseWebSpeechOptions = {}) {
  const { onInterimResult, onFinalResult, onError, continuous = true, language = "en-US" } = options

  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isRestartingRef = useRef(false)

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null
    setIsSupported(!!SpeechRecognitionAPI)
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      onError?.("Speech recognition not supported in this browser")
      return false
    }

    // Stop existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      isRestartingRef.current = false
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ""
      let finalTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (interimTranscript) {
        onInterimResult?.(interimTranscript)
      }

      if (finalTranscript) {
        onFinalResult?.(finalTranscript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignore aborted errors (happens when we manually stop)
      if (event.error === "aborted") return

      // Handle no-speech gracefully - just restart
      if (event.error === "no-speech") {
        if (isListening && !isRestartingRef.current) {
          isRestartingRef.current = true
          setTimeout(() => {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.start()
              } catch {
                // Ignore if already started
              }
            }
          }, 100)
        }
        return
      }

      onError?.(event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      // Auto-restart if we're supposed to be listening
      if (isListening && continuous && !isRestartingRef.current) {
        isRestartingRef.current = true
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch {
              // Ignore if already started
            }
          }
        }, 100)
      } else if (!isRestartingRef.current) {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      return true
    } catch (error) {
      onError?.("Failed to start speech recognition")
      return false
    }
  }, [continuous, language, onError, onFinalResult, onInterimResult, isListening])

  const stopListening = useCallback(() => {
    isRestartingRef.current = false
    setIsListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  }
}
