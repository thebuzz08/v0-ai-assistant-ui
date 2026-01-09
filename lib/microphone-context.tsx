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
  const ttsUnlockedRef = useRef(false)

  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const processingLockRef = useRef(false)

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
    const utterance = new SpeechSynthesisUtterance("")
    utterance.volume = 0
    utterance.onend = () => {
      ttsUnlockedRef.current = true
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !text.trim()) return

    // Clean text for TTS
    const cleanText = text.replace(/[*_#`]/g, "").trim()
    if (!cleanText) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    if (bestVoiceRef.current) utterance.voice = bestVoiceRef.current
    utterance.rate = 1.2
    utterance.volume = 1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const speakBufferRef = useRef("")
  const speakChunk = useCallback((token: string, isLast: boolean) => {
    if (!("speechSynthesis" in window)) return

    speakBufferRef.current += token

    const shouldSpeak = isLast || /[.!?,]/.test(speakBufferRef.current.slice(-1))

    if (shouldSpeak && speakBufferRef.current.trim()) {
      const textToSpeak = speakBufferRef.current.replace(/[*_#`]/g, "").trim()
      if (textToSpeak) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        if (bestVoiceRef.current) utterance.voice = bestVoiceRef.current
        utterance.rate = 1.2
        utterance.volume = 1
        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => {
          if (!window.speechSynthesis.pending) setIsSpeaking(false)
        }
        window.speechSynthesis.speak(utterance)
      }
      speakBufferRef.current = ""
    }
  }, [])

  const answerQuestion = useCallback(
    async (question: string, fullUserText: string) => {
      // Use lock to prevent any concurrent calls
      if (processingLockRef.current) return
      processingLockRef.current = true

      setIsProcessing(true)

      // Add user entry and clear state IMMEDIATELY
      setTranscript((prev) => [...prev, { speaker: "user", text: fullUserText }])
      currentParagraphRef.current = ""
      setCurrentParagraph("")
      setInterimTranscript("")

      try {
        const response = await fetch("/api/check-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question }),
        })

        if (!response.ok || !response.body) {
          throw new Error("API error")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullResponse = ""
        let assistantEntryAdded = false
        speakBufferRef.current = ""

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
                  fullResponse += parsed.token

                  if (!assistantEntryAdded) {
                    setTranscript((prev) => [...prev, { speaker: "assistant", text: fullResponse }])
                    assistantEntryAdded = true
                  } else {
                    setTranscript((prev) => {
                      const updated = [...prev]
                      updated[updated.length - 1] = { speaker: "assistant", text: fullResponse }
                      return updated
                    })
                  }

                  speakChunk(parsed.token, false)
                }
              } catch {}
            }
          }
        }

        speakChunk("", true)
      } catch (error) {
        console.error("[v0] Answer error:", error)
      } finally {
        setIsProcessing(false)
        processingLockRef.current = false
      }
    },
    [speakChunk],
  )

  const checkAndAnswer = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || trimmed.length < 5 || processingLockRef.current) return

      try {
        const response = await fetch(`/api/check-question?text=${encodeURIComponent(trimmed)}`)
        const data = await response.json()

        if (data.isComplete && data.question && !processingLockRef.current) {
          answerQuestion(data.question, trimmed)
        }
      } catch (error) {
        console.error("[v0] Check error:", error)
      }
    },
    [answerQuestion],
  )

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
      if (!SpeechRecognition) return

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"
      recognition.maxAlternatives = 1

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (processingLockRef.current) return

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

        // Clear any existing timer
        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current)
          pauseTimerRef.current = null
        }

        if (finalText) {
          // Append final text to paragraph
          currentParagraphRef.current = currentParagraphRef.current
            ? currentParagraphRef.current + " " + finalText.trim()
            : finalText.trim()
          setCurrentParagraph(currentParagraphRef.current)
          setInterimTranscript("")
        } else if (interimText) {
          setInterimTranscript(interimText)
        }

        // Get full text including interim
        const fullText = currentParagraphRef.current
          ? currentParagraphRef.current + (interimText ? " " + interimText : "")
          : interimText

        if (fullText.trim().length > 5) {
          pauseTimerRef.current = setTimeout(() => {
            if (!processingLockRef.current) {
              checkAndAnswer(fullText.trim())
            }
          }, 200)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("[v0] Recognition error:", event.error)
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
      console.error("[v0] Start error:", error)
      setHasPermission(false)
    }
  }, [checkAndAnswer, unlockTTS])

  const stopListening = useCallback(() => {
    isListeningRef.current = false

    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = null
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    setInterimTranscript("")
    setCurrentParagraph("")
    currentParagraphRef.current = ""
    processingLockRef.current = false

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
