"use client"

import { useCallback, useRef, useState, useEffect } from "react"

interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

interface UseSpeechRecognitionProps {
  onResult?: (result: SpeechRecognitionResult) => void
  onError?: (error: string) => void
  continuous?: boolean
  interimResults?: boolean
  lang?: string
}

export function useSpeechRecognition({
  onResult,
  onError,
  continuous = true,
  interimResults = true,
  lang = "en-US",
}: UseSpeechRecognitionProps = {}) {
  const [isSupported, setIsSupported] = useState(false)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const recognitionRef = useRef<any | null>(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)
  }, [])

  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      onError?.("Speech recognition not supported in this browser")
      return false
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = lang

    recognition.onstart = () => {
      setIsRecognizing(true)
    }

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1]
      const transcript = lastResult[0].transcript
      const confidence = lastResult[0].confidence
      const isFinal = lastResult.isFinal

      onResult?.({ transcript, confidence, isFinal })
    }

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        onError?.(event.error)
      }
    }

    recognition.onend = () => {
      setIsRecognizing(false)
      // Restart if still supposed to be listening
      if (recognitionRef.current === recognition) {
        try {
          recognition.start()
        } catch {
          // Ignore errors on restart
        }
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
  }, [continuous, interimResults, lang, onResult, onError])

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecognizing(false)
  }, [])

  return {
    isSupported,
    isRecognizing,
    startRecognition,
    stopRecognition,
  }
}

// Text-to-speech hook
export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported("speechSynthesis" in window)
  }, [])

  const speak = useCallback((text: string, options?: { rate?: number; pitch?: number; voice?: string }) => {
    if (!("speechSynthesis" in window)) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = options?.rate ?? 1
    utterance.pitch = options?.pitch ?? 1

    // Try to get a natural-sounding voice
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice =
      voices.find((v) => v.name.includes("Samantha") || v.name.includes("Google") || v.name.includes("Natural")) ||
      voices.find((v) => v.lang.startsWith("en"))

    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  return { isSpeaking, isSupported, speak, stop }
}

// Declare types for browser APIs
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}
