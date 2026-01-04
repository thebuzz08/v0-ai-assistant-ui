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

  const checkForQuestionAndAnswer = useCallback(
    async (paragraph: string) => {
      if (!paragraph.trim()) return

      setIsProcessing(true)
      streamingTextRef.current = ""

      try {
        const response = await fetch("/api/check-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: paragraph, stream: true }),
        })

        if (!response.body) {
          setIsProcessing(false)
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullAnswer = ""
        let isQuestion = false
        let firstChunkSpoken = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          const lines = text.split("\n").filter((line) => line.startsWith("data: "))

          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.done) {
                isQuestion = data.isQuestion
                fullAnswer = data.answer || ""
              } else if (data.chunk) {
                streamingTextRef.current += data.chunk

                if (
                  !firstChunkSpoken &&
                  streamingTextRef.current.length > 2 &&
                  !streamingTextRef.current.startsWith("NOT_A_QUESTION") &&
                  !streamingTextRef.current.startsWith("UNKNOWN")
                ) {
                  firstChunkSpoken = true
                  // Clear for new input
                  currentParagraphRef.current = ""
                  setCurrentParagraph("")
                }
              }
            } catch {}
          }
        }

        // Final handling
        if (isQuestion && fullAnswer) {
          setTranscript((prev) => [
            ...prev,
            { speaker: "user", text: paragraph },
            { speaker: "assistant", text: fullAnswer },
          ])
          speakText(fullAnswer)
        }
      } catch (error) {
        console.error("[v0] Error checking question:", error)
      } finally {
        setIsProcessing(false)
        streamingTextRef.current = ""
      }
    },
    [speakText],
  )

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

        if (interimText) setInterimTranscript(interimText)

        if (finalTranscript) {
          setInterimTranscript("")
          const newParagraph = currentParagraphRef.current
            ? currentParagraphRef.current + " " + finalTranscript.trim()
            : finalTranscript.trim()

          currentParagraphRef.current = newParagraph
          setCurrentParagraph(newParagraph)

          if (checkQuestionTimeoutRef.current) clearTimeout(checkQuestionTimeoutRef.current)
          checkQuestionTimeoutRef.current = setTimeout(() => {
            checkForQuestionAndAnswer(newParagraph)
          }, 400)
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
    } catch (error) {
      console.error("[v0] Failed to start listening:", error)
      setHasPermission(false)
    }
  }, [checkForQuestionAndAnswer])

  const stopListening = useCallback(() => {
    isListeningRef.current = false

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    setInterimTranscript("")
    setCurrentParagraph("")
    currentParagraphRef.current = ""

    if (checkQuestionTimeoutRef.current) {
      clearTimeout(checkQuestionTimeoutRef.current)
      checkQuestionTimeoutRef.current = null
    }

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
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
      if (checkQuestionTimeoutRef.current) clearTimeout(checkQuestionTimeoutRef.current)
    }
  }, [])

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
