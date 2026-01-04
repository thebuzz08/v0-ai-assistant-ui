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
  const answeredQuestionsRef = useRef<Set<string>>(new Set())
  const ttsUnlockedRef = useRef(false)

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

  const unlockTTS = useCallback(() => {
    if (ttsUnlockedRef.current) return
    if (!("speechSynthesis" in window)) return

    // Create a silent utterance to unlock TTS on Safari
    const utterance = new SpeechSynthesisUtterance("")
    utterance.volume = 0
    utterance.onend = () => {
      ttsUnlockedRef.current = true
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    if (bestVoiceRef.current) utterance.voice = bestVoiceRef.current
    utterance.rate = 1.1
    utterance.volume = 1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = (e) => {
      console.error("[v0] TTS error:", e)
      setIsSpeaking(false)
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const speakChunk = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return
    if (!text.trim()) return

    const utterance = new SpeechSynthesisUtterance(text)
    if (bestVoiceRef.current) utterance.voice = bestVoiceRef.current
    utterance.rate = 1.15 // Slightly faster for snappier feel
    utterance.volume = 1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      // Only set speaking false if queue is empty
      if (window.speechSynthesis.pending === false) {
        setIsSpeaking(false)
      }
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const answerQuestion = useCallback(
    async (question: string) => {
      if (isProcessingRef.current) return

      const normalizedQuestion = question.toLowerCase().trim()
      if (answeredQuestionsRef.current.has(normalizedQuestion)) {
        return
      }

      answeredQuestionsRef.current.add(normalizedQuestion)

      isProcessingRef.current = true
      setIsProcessing(true)

      currentParagraphRef.current = ""
      setCurrentParagraph("")
      setInterimTranscript("")

      setTranscript((prev) => [...prev, { speaker: "user", text: question }])

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
        const spokenLength = 0
        let sentenceBuffer = ""

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
                if (parsed.token) {
                  fullText += parsed.token
                  sentenceBuffer += parsed.token

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

                  const sentenceEnd = sentenceBuffer.match(/[.!?]\s*$/)
                  const hasEnoughWords = sentenceBuffer.split(/\s+/).length >= 4

                  if (sentenceEnd || (hasEnoughWords && sentenceBuffer.includes(","))) {
                    const textToSpeak = sentenceBuffer.trim()
                    if (textToSpeak) {
                      speakChunk(textToSpeak)
                      sentenceBuffer = ""
                    }
                  }
                }
              } catch {}
            }
          }
        }

        if (sentenceBuffer.trim()) {
          speakChunk(sentenceBuffer.trim())
        }
      } catch (error) {
        console.error("[v0] Error:", error)
        answeredQuestionsRef.current.delete(normalizedQuestion)
      } finally {
        isProcessingRef.current = false
        setIsProcessing(false)
      }
    },
    [speakChunk],
  )

  const checkForCompleteQuestion = useCallback(async () => {
    const text = currentParagraphRef.current.trim()

    if (!text || text.length < 3 || isProcessingRef.current) return

    try {
      const response = await fetch(`/api/check-question?text=${encodeURIComponent(text)}`)
      const data = await response.json()

      if (data.isComplete && data.question) {
        const normalizedQuestion = data.question.toLowerCase().trim()
        if (answeredQuestionsRef.current.has(normalizedQuestion)) {
          return
        }

        answerQuestion(data.question)
      }
    } catch (error) {
      console.error("[v0] Polling error:", error)
    }
  }, [answerQuestion])

  const startListening = useCallback(async () => {
    unlockTTS()

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
      recognition.maxAlternatives = 3 // Add maxAlternatives for better accuracy

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = ""
        let interimText = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            const bestAlternative = result[0]
            // Only accept if confidence is decent (or if confidence not provided, accept anyway)
            if (bestAlternative.confidence === 0 || bestAlternative.confidence > 0.5) {
              finalText += bestAlternative.transcript
            }
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

      pollIntervalRef.current = setInterval(checkForCompleteQuestion, 200)
    } catch (error) {
      console.error("[v0] Failed to start listening:", error)
      setHasPermission(false)
    }
  }, [checkForCompleteQuestion, unlockTTS])

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
    answeredQuestionsRef.current.clear()

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
