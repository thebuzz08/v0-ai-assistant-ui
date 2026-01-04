"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import type { SpeechRecognitionInterface, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "some-library" // Hypothetical import for missing types

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInterface
    webkitSpeechRecognition: new () => SpeechRecognitionInterface
  }
}

export interface TranscriptEntry {
  speaker: "user" | "assistant"
  text: string
}

interface MicrophoneContextType {
  isListening: boolean
  hasPermission: boolean | null
  audioLevel: number
  requestPermission: () => Promise<boolean>
  startListening: () => Promise<void>
  stopListening: () => void
  transcript: TranscriptEntry[]
  interimTranscript: string
  isProcessing: boolean
  isSpeaking: boolean
  currentParagraph: string
}

const MicrophoneContext = createContext<MicrophoneContextType | null>(null)

export function MicrophoneProvider({ children }: { children: ReactNode }) {
  const [isListening, setIsListening] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [interimTranscript, setInterimTranscript] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentParagraph, setCurrentParagraph] = useState("")

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null)
  const currentParagraphRef = useRef("")
  const checkQuestionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isListeningRef = useRef(false)
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const streamingTextRef = useRef("")
  const speakQueueRef = useRef<string[]>([])
  const isSpeakingQueueRef = useRef(false)

  // Find best voice on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    const findBestVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) return

      const preferredVoices = ["Samantha", "Alex", "Ava", "Karen", "Microsoft Aria", "Google US English"]
      for (const preferred of preferredVoices) {
        const voice = voices.find((v) => v.name.includes(preferred) && v.lang.startsWith("en"))
        if (voice) {
          bestVoiceRef.current = voice
          return
        }
      }
      const anyEnglish = voices.find((v) => v.lang.startsWith("en"))
      if (anyEnglish) bestVoiceRef.current = anyEnglish
    }

    findBestVoice()
    window.speechSynthesis.onvoiceschanged = findBestVoice
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  const processSpeeechQueue = useCallback(() => {
    if (isSpeakingQueueRef.current || speakQueueRef.current.length === 0) return

    const text = speakQueueRef.current.shift()
    if (!text) return

    isSpeakingQueueRef.current = true
    const utterance = new SpeechSynthesisUtterance(text)
    if (bestVoiceRef.current) utterance.voice = bestVoiceRef.current
    utterance.rate = 1.1 // Slightly faster for snappier responses
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      isSpeakingQueueRef.current = false
      if (speakQueueRef.current.length > 0) {
        processSpeeechQueue()
      } else {
        setIsSpeaking(false)
      }
    }
    utterance.onerror = () => {
      isSpeakingQueueRef.current = false
      setIsSpeaking(false)
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const speakText = useCallback((text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      speakQueueRef.current = []
      isSpeakingQueueRef.current = false

      // Speak immediately
      const utterance = new SpeechSynthesisUtterance(text)
      if (bestVoiceRef.current) utterance.voice = bestVoiceRef.current
      utterance.rate = 1.1
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckedTextRef = useRef("")
  const isCheckingRef = useRef(false)

  const checkForQuestionAndAnswer = useCallback(
    async (paragraph: string) => {
      if (!paragraph.trim() || isCheckingRef.current) return
      if (paragraph === lastCheckedTextRef.current) return // Don't re-check same text

      isCheckingRef.current = true
      lastCheckedTextRef.current = paragraph

      try {
        const response = await fetch("/api/check-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: paragraph }),
        })

        const data = await response.json()

        // If incomplete, just wait for more input
        if (!data.isComplete) {
          isCheckingRef.current = false
          return
        }

        // If complete and has answer, respond
        if (data.isQuestion && data.answer) {
          // Stop polling while we process the answer
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          setIsProcessing(true)

          // Clear transcript for next input
          currentParagraphRef.current = ""
          setCurrentParagraph("")
          lastCheckedTextRef.current = ""

          setTranscript((prev) => [
            ...prev,
            { speaker: "user", text: paragraph },
            { speaker: "assistant", text: data.answer },
          ])
          speakText(data.answer)

          // Resume polling after speaking
          setTimeout(() => {
            if (isListeningRef.current) {
              startPolling()
            }
            setIsProcessing(false)
          }, 500)
        } else {
          // Complete but not a question - clear and continue
          currentParagraphRef.current = ""
          setCurrentParagraph("")
          lastCheckedTextRef.current = ""
        }
      } catch (error) {
        console.error("[v0] Error checking question:", error)
      } finally {
        isCheckingRef.current = false
      }
    },
    [speakText],
  )

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return

    console.log("[v0] Starting polling for questions")
    pollingIntervalRef.current = setInterval(() => {
      const currentText = currentParagraphRef.current
      if (currentText && currentText.trim().length > 2) {
        console.log("[v0] Polling check:", currentText)
        checkForQuestionAndAnswer(currentText)
      }
    }, 500)
  }, [checkForQuestionAndAnswer])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log("[v0] Stopping polling")
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(average / 255)
        animationFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()

      isListeningRef.current = true
      setIsListening(true)
      setHasPermission(true)

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        console.error("[v0] Web Speech API not supported")
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ""
        let interimText = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimText += result[0].transcript
          }
        }

        const combinedText = currentParagraphRef.current
          ? currentParagraphRef.current + (finalTranscript ? " " + finalTranscript.trim() : "")
          : finalTranscript.trim()

        if (finalTranscript) {
          currentParagraphRef.current = combinedText
          setCurrentParagraph(combinedText)
          setInterimTranscript("")
        } else if (interimText) {
          // Show interim as part of current paragraph for display
          setInterimTranscript(interimText)
          // Also include interim in polling check
          const fullText = combinedText ? combinedText + " " + interimText : interimText
          setCurrentParagraph(fullText)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("[v0] Speech recognition error:", event.error)
        if (event.error === "not-allowed") setHasPermission(false)
      }

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start()
          } catch {}
        }
      }

      recognition.start()
      recognitionRef.current = recognition

      startPolling()
    } catch (error) {
      console.error("[v0] Failed to start listening:", error)
      setHasPermission(false)
    }
  }, [startPolling])

  const stopListening = useCallback(() => {
    isListeningRef.current = false

    stopPolling()

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    setInterimTranscript("")
    setCurrentParagraph("")
    currentParagraphRef.current = ""
    lastCheckedTextRef.current = ""

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    setAudioLevel(0)
    setIsListening(false)
  }, [stopPolling])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
      stopPolling()
    }
  }, [stopPolling])

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      mediaStreamRef.current = stream
      setHasPermission(true)
      return true
    } catch (error) {
      console.error("[v0] Failed to request permission:", error)
      setHasPermission(false)
      return false
    }
  }, [])

  return (
    <MicrophoneContext.Provider
      value={{
        isListening,
        hasPermission,
        audioLevel,
        requestPermission,
        startListening,
        stopListening,
        transcript,
        interimTranscript,
        isProcessing,
        isSpeaking,
        currentParagraph,
      }}
    >
      {children}
    </MicrophoneContext.Provider>
  )
}

export function useMicrophone() {
  const context = useContext(MicrophoneContext)
  if (!context) {
    throw new Error("useMicrophone must be used within a MicrophoneProvider")
  }
  return context
}
