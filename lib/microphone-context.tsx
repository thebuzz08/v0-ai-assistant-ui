"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "web-speech-api"

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
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
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const currentParagraphRef = useRef("")
  const isListeningRef = useRef(false)
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const isProcessingRef = useRef(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedTextRef = useRef("")

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

  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    if (bestVoiceRef.current) utterance.voice = bestVoiceRef.current
    utterance.rate = 1.1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const answerQuestion = useCallback(
    async (question: string) => {
      if (isProcessingRef.current) return

      isProcessingRef.current = true
      setIsProcessing(true)

      // Mark this question as processed
      lastProcessedTextRef.current = currentParagraphRef.current

      // Add user entry
      setTranscript((prev) => [...prev, { speaker: "user", text: question }])

      // Clear current paragraph for new input
      currentParagraphRef.current = ""
      setCurrentParagraph("")
      setInterimTranscript("")

      try {
        const response = await fetch("/api/check-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question }),
        })

        if (!response.ok) throw new Error("API error")

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No reader")

        const decoder = new TextDecoder()
        let fullText = ""
        let addedAssistantEntry = false
        let isNotQuestion = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.notQuestion) {
                  isNotQuestion = true
                  continue
                }
                if (parsed.token) {
                  fullText += parsed.token

                  if (!addedAssistantEntry) {
                    setTranscript((prev) => [...prev, { speaker: "assistant", text: fullText }])
                    addedAssistantEntry = true
                  } else {
                    setTranscript((prev) => {
                      const newTranscript = [...prev]
                      newTranscript[newTranscript.length - 1] = { speaker: "assistant", text: fullText }
                      return newTranscript
                    })
                  }
                }
              } catch {}
            }
          }
        }

        // If not a question, remove the user entry we added
        if (isNotQuestion) {
          setTranscript((prev) => prev.slice(0, -1))
        } else if (fullText) {
          speakText(fullText)
        }
      } catch (error) {
        console.error("[v0] Error:", error)
      } finally {
        isProcessingRef.current = false
        setIsProcessing(false)
      }
    },
    [speakText],
  )

  const checkForCompleteQuestion = useCallback(async () => {
    const text = currentParagraphRef.current.trim()

    // Skip if empty, too short, already processing, or already processed this text
    if (!text || text.length < 3 || isProcessingRef.current) return
    if (text === lastProcessedTextRef.current) return

    try {
      const response = await fetch(`/api/check-question?text=${encodeURIComponent(text)}`)
      const data = await response.json()

      if (data.isComplete && data.question) {
        // Found a complete question - answer it immediately
        answerQuestion(data.question)
      }
    } catch (error) {
      console.error("[v0] Polling error:", error)
    }
  }, [answerQuestion])

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
        let finalText = ""
        let interimText = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalText += result[0].transcript
          } else {
            interimText += result[0].transcript
          }
        }

        if (finalText) {
          currentParagraphRef.current = currentParagraphRef.current
            ? currentParagraphRef.current + " " + finalText.trim()
            : finalText.trim()
          setCurrentParagraph(currentParagraphRef.current)
          setInterimTranscript("")
        } else if (interimText) {
          setInterimTranscript(interimText)
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

      pollIntervalRef.current = setInterval(checkForCompleteQuestion, 500)
    } catch (error) {
      console.error("[v0] Failed to start listening:", error)
      setHasPermission(false)
    }
  }, [checkForCompleteQuestion])

  const stopListening = useCallback(() => {
    isListeningRef.current = false

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    setInterimTranscript("")
    setCurrentParagraph("")
    currentParagraphRef.current = ""
    lastProcessedTextRef.current = ""

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
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
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
