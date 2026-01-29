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
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const processingLockRef = useRef(false)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  // ElevenLabs TTS - streams audio for low latency
  const speakWithElevenLabs = useCallback(async (text: string) => {
    if (!text.trim()) return
    
    setIsSpeaking(true)
    
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.replace(/[*_#`]/g, "").trim() }),
      })

      if (!response.ok || !response.body) {
        setIsSpeaking(false)
        return
      }

      // Create audio element and play streamed audio
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        URL.revokeObjectURL(audioElementRef.current.src)
      }
      
      const audio = new Audio(audioUrl)
      audioElementRef.current = audio
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }
      await audio.play()
    } catch (error) {
      console.error("[TTS] Error:", error)
      setIsSpeaking(false)
    }
  }, [])

  // Single unified function - sends text, gets detection + answer in one call
  const processText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length < 5 || processingLockRef.current) return
    
    processingLockRef.current = true
    setIsProcessing(true)
    
    // Clear state immediately to prevent duplicates
    const userText = trimmed
    currentParagraphRef.current = ""
    setCurrentParagraph("")
    setInterimTranscript("")

    try {
      const response = await fetch("/api/check-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText }),
      })

      // Check if it's a streaming response (question was answered) or JSON (no question)
      const contentType = response.headers.get("content-type") || ""
      
      if (contentType.includes("application/json")) {
        // No question detected - don't add to transcript
        setIsProcessing(false)
        processingLockRef.current = false
        return
      }

      if (!response.body) {
        setIsProcessing(false)
        processingLockRef.current = false
        return
      }

      // Stream response - question was detected
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ""
      let userEntryAdded = false
      let assistantEntryAdded = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6)
          if (data === "[DONE]") continue

          try {
            const parsed = JSON.parse(data)
            
            // First message contains the extracted question
            if (parsed.question && !userEntryAdded) {
              setTranscript(prev => [...prev, { speaker: "user", text: userText }])
              userEntryAdded = true
            }
            
            // Subsequent messages contain answer tokens
            if (parsed.token) {
              fullResponse += parsed.token
              
              if (!assistantEntryAdded) {
                setTranscript(prev => [...prev, { speaker: "assistant", text: fullResponse }])
                assistantEntryAdded = true
              } else {
                setTranscript(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { speaker: "assistant", text: fullResponse }
                  return updated
                })
              }
            }
          } catch {}
        }
      }

      // Speak the full response with ElevenLabs
      if (fullResponse.trim()) {
        speakWithElevenLabs(fullResponse)
      }
    } catch (error) {
      console.error("[Process] Error:", error)
    } finally {
      setIsProcessing(false)
      processingLockRef.current = false
    }
  }, [speakWithElevenLabs])

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
      if (!SpeechRecognition) return

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"
      recognition.maxAlternatives = 1

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (!isListeningRef.current) return

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

        // Clear any pending timer
        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current)
          pauseTimerRef.current = null
        }

        // Update interim display
        if (interimText) {
          setInterimTranscript(interimText)
        }

        // Handle final results
        if (finalText) {
          currentParagraphRef.current = currentParagraphRef.current
            ? currentParagraphRef.current + " " + finalText.trim()
            : finalText.trim()
          setCurrentParagraph(currentParagraphRef.current)
          setInterimTranscript("")

          // Set timer to process after brief pause (150ms for speed)
          const fullText = currentParagraphRef.current.trim()
          if (fullText.length > 5 && isListeningRef.current && !processingLockRef.current) {
            pauseTimerRef.current = setTimeout(() => {
              if (!processingLockRef.current && isListeningRef.current) {
                processText(fullText)
              }
            }, 150)
          }
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("[Recognition] Error:", event.error)
        if (event.error === "not-allowed") setHasPermission(false)
      }

      recognition.onend = () => {
        if (isListeningRef.current) {
          try { recognition.start() } catch {}
        }
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (error) {
      console.error("[Start] Error:", error)
      setHasPermission(false)
    }
  }, [processText])

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

    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }

    setInterimTranscript("")
    setCurrentParagraph("")
    currentParagraphRef.current = ""
    processingLockRef.current = false
    setIsSpeaking(false)

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
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
      if (audioElementRef.current) audioElementRef.current.pause()
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
    } catch {
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
