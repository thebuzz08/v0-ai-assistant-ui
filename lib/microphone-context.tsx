"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { useCalendar } from "./calendar-context"
import { useNotes } from "./notes-context"

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInterface
    webkitSpeechRecognition: new () => SpeechRecognitionInterface
  }
}

interface MicrophoneContextType {
  isListening: boolean
  hasPermission: boolean | null
  audioLevel: number
  requestPermission: () => Promise<boolean>
  startListening: () => Promise<void>
  stopListening: () => void
  transcript: TranscriptEntry[]
  addTranscriptEntry: (entry: TranscriptEntry) => void
  interimTranscript: string
  isProcessing: boolean
  aiEnabled: boolean
  setAiEnabled: (enabled: boolean) => void
  isSpeaking: boolean
  currentParagraph: string
  onConversationComplete?: (text: string) => void
  setOnConversationComplete: (callback: ((text: string) => void) | undefined) => void
  setNotesContext: (notes: Array<{ title: string; date: string; summary: string }>) => void
  setCalendarContext: (
    events: Array<{ title: string; date: string; time: string; description?: string; id?: string }>,
  ) => void
  safetyMode: boolean
  setSafetyMode: (enabled: boolean) => void
  incrementStat: (
    stat: "conversations" | "aiResponses" | "calendarEventsCreated" | "calendarEventsDeleted" | "wordsTranscribed",
    amount?: number,
  ) => void
  customInstructions: string
  setCustomInstructions: (instructions: string) => void
  useDeepgram: boolean
  setUseDeepgram: (useDeepgram: boolean) => void
}

export interface TranscriptEntry {
  speaker: "user" | "assistant" | "other"
  text: string
  timestamp: string
  confidence?: number
  speakerId?: number
}

const MicrophoneContext = createContext<MicrophoneContextType | null>(null)

export function MicrophoneProvider({ children }: { children: ReactNode }) {
  const [isListening, setIsListening] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [interimTranscript, setInterimTranscript] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentParagraph, setCurrentParagraph] = useState("")
  const [safetyMode, setSafetyModeState] = useState(true)
  const [customInstructions, setCustomInstructionsState] = useState("")
  const [useDeepgram, setUseDeepgram] = useState(true) // Use Deepgram by default

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null)
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null)
  const currentParagraphRef = useRef("")
  const checkQuestionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isCheckingRef = useRef(false)
  const conversationHistoryRef = useRef<Array<{ role: "user" | "assistant"; text: string }>>([])
  const isListeningRef = useRef(false)
  const checkForQuestionAndAnswerRef = useRef<(text: string) => Promise<void>>(async () => {})
  const onConversationCompleteRef = useRef<((text: string) => void) | undefined>(undefined)
  const isRestartingRef = useRef(false)
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const notesContextRef = useRef<Array<{ title: string; date: string; summary: string }>>([])
  const calendarContextRef = useRef<
    Array<{ title: string; date: string; time: string; description?: string; id?: string }>
  >([])
  const pendingDeletionRef = useRef<any>(null)
  const pendingBulkDeletionRef = useRef<any>(null)
  const lastMentionedEventRef = useRef<any>(null)
  const lastCreatedEventsRef = useRef<any[]>([])
  const pendingSpecificDeletionRef = useRef<any[]>([])
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const customInstructionsRef = useRef("")
  const recentContextRef = useRef<string[]>([]) // Track recent context for follow-up questions (but don't resend for new questions)
  const smoothedDataRef = useRef<number[]>(new Array(32).fill(128))

  const statsRef = useRef({
    conversations: 0,
    totalMinutes: 0,
    calendarEventsCreated: 0,
    calendarEventsDeleted: 0,
    noteSessions: 0,
    aiResponses: 0,
    wordsTranscribed: 0,
  })
  const listeningStartTimeRef = useRef<number | null>(null)
  const processorRef = useRef<any>(null)

  const clientCache = new Map<string, { answer: string; timestamp: number }>()
  const CLIENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  function getClientCacheKey(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "")
  }

  function getClientCachedResponse(text: string): string | null {
    const key = getClientCacheKey(text)
    const cached = clientCache.get(key)
    if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.answer
    }
    return null
  }

  function setClientCachedResponse(text: string, answer: string): void {
    // Only cache short factual answers
    if (answer.length < 50) {
      const key = getClientCacheKey(text)
      clientCache.set(key, { answer, timestamp: Date.now() })
      if (clientCache.size > 50) {
        const firstKey = clientCache.keys().next().value
        if (firstKey) clientCache.delete(firstKey)
      }
    }
  }

  const setNotesContext = useCallback((notes: Array<{ title: string; date: string; summary: string }>) => {
    notesContextRef.current = notes
  }, [])

  const setCalendarContext = useCallback(
    (events: Array<{ title: string; date: string; time: string; description?: string; id?: string }>) => {
      calendarContextRef.current = events
    },
    [],
  )

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    const findBestVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) return

      const preferredVoices = [
        "Samantha",
        "Alex",
        "Ava",
        "Tom",
        "Karen",
        "Microsoft Aria",
        "Microsoft Jenny",
        "Google US English",
      ]

      for (const preferred of preferredVoices) {
        const voice = voices.find(
          (v) => v.name.includes(preferred) && (v.lang.startsWith("en-US") || v.lang.startsWith("en")),
        )
        if (voice) {
          bestVoiceRef.current = voice
          return
        }
      }

      const localUSVoice = voices.find((v) => v.lang === "en-US" && v.localService)
      if (localUSVoice) {
        bestVoiceRef.current = localUSVoice
        return
      }

      const anyUSVoice = voices.find((v) => v.lang.startsWith("en-US"))
      if (anyUSVoice) {
        bestVoiceRef.current = anyUSVoice
        return
      }

      const anyEnglishVoice = voices.find((v) => v.lang.startsWith("en"))
      if (anyEnglishVoice) {
        bestVoiceRef.current = anyEnglishVoice
      }
    }

    findBestVoice()
    window.speechSynthesis.onvoiceschanged = findBestVoice

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  const setOnConversationComplete = useCallback((callback: ((text: string) => void) | undefined) => {
    onConversationCompleteRef.current = callback
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setHasPermission(true)
      return true
    } catch (error) {
      console.log("[v0] Microphone permission denied:", error)
      setHasPermission(false)
      return false
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("safetyMode")
      if (stored !== null) {
        setSafetyModeState(stored === "true")
      }
    }
  }, [])

  const setSafetyMode = useCallback((enabled: boolean) => {
    setSafetyModeState(enabled)
    if (typeof window !== "undefined") {
      localStorage.setItem("safetyMode", String(enabled))
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("app_stats")
      if (stored) {
        statsRef.current = JSON.parse(stored)
      }
    }
  }, [])

  const saveStats = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("app_stats", JSON.stringify(statsRef.current))
    }
  }, [])

  const incrementStat = useCallback(
    (
      stat: "conversations" | "aiResponses" | "calendarEventsCreated" | "calendarEventsDeleted" | "wordsTranscribed",
      amount = 1,
    ) => {
      statsRef.current[stat] = (statsRef.current[stat] || 0) + amount
      saveStats()
    },
    [saveStats],
  )

  const { events: calendarEvents, fetchEvents, createEvent, deleteEvent } = useCalendar()
  const { notes } = useNotes()

  const checkForQuestionAndAnswer = useCallback(
    async (text: string) => {
      if (!aiEnabled) return
      if (isCheckingRef.current) return
      if (text.trim().length < 3) return

      console.log("[v0] checkForQuestionAndAnswer called with:", text)

      isCheckingRef.current = true
      setIsProcessing(true)

      const wordCount = text.trim().split(/\s+/).length
      incrementStat("wordsTranscribed", wordCount)

      try {
        const cachedAnswer = getClientCachedResponse(text)
        if (cachedAnswer) {
          console.log("[v0] Client cache hit:", text)

          const userEntry: TranscriptEntry = {
            speaker: "user",
            text: text.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          }
          setTranscript((prev) => [...prev, userEntry])

          const assistantEntry: TranscriptEntry = {
            speaker: "assistant",
            text: cachedAnswer,
            timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          }
          setTranscript((prev) => [...prev, assistantEntry])

          // Speak cached response immediately
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(cachedAnswer)
            if (bestVoiceRef.current) utterance.voice = bestVoiceRef.current
            utterance.rate = 1.05
            utterance.onstart = () => setIsSpeaking(true)
            utterance.onend = () => setIsSpeaking(false)
            window.speechSynthesis.speak(utterance)
          }

          recentContextRef.current = []
          setCurrentParagraph("")
          currentParagraphRef.current = ""
          isCheckingRef.current = false
          setIsProcessing(false)
          return
        }

        const looksLikeFollowUp = /^(and|also|what about|how about|tell me more|more about|why|but|so|then)\b/i.test(
          text.trim(),
        )

        const contextToSend =
          looksLikeFollowUp && recentContextRef.current.length > 0
            ? recentContextRef.current.slice(-2).join(" ") + " " + text
            : text

        console.log("[v0] Sending to API:", contextToSend)

        const response = await fetch("/api/check-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: contextToSend,
            conversationHistory: conversationHistoryRef.current.slice(-6),
            safetyMode,
            lastMentionedEvent: lastMentionedEventRef.current,
            lastCreatedEvents: lastCreatedEventsRef.current,
            notesContext: notesContextRef.current?.slice(0, 5),
            calendarEvents: calendarContextRef.current,
            customInstructions,
            pendingDeletion: pendingDeletionRef.current,
            pendingBulkDeletion: pendingBulkDeletionRef.current,
            pendingSpecificDeletion: pendingSpecificDeletionRef.current,
            localDateTime: {
              date: new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              }),
              time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              isoDate: new Date().toLocaleDateString("en-CA"), // YYYY-MM-DD format
            },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log("[v0] API response:", data)
          const {
            isQuestion,
            answer,
            pendingDeletion,
            pendingBulkDeletion,
            lastMentionedEvent,
            eventCreated,
            eventDeleted,
            lastCreatedEvents,
            pendingSpecificDeletion,
            scheduledEvent,
            refreshCalendar,
            cached,
          } = data

          if (isQuestion && answer && !cached) {
            setClientCachedResponse(text, answer)
          }

          if (eventCreated) {
            incrementStat("calendarEventsCreated")
          }
          if (eventDeleted) {
            incrementStat("calendarEventsDeleted")
          }

          pendingDeletionRef.current = pendingDeletion || null
          pendingBulkDeletionRef.current = pendingBulkDeletion || null
          pendingSpecificDeletionRef.current = pendingSpecificDeletion || []

          console.log("[v0] API response - lastMentionedEvent:", lastMentionedEvent)
          console.log("[v0] API response - lastCreatedEvents:", lastCreatedEvents)

          if (lastMentionedEvent) {
            console.log("[v0] Storing lastMentionedEvent:", lastMentionedEvent)
            lastMentionedEventRef.current = lastMentionedEvent
          }

          if (lastCreatedEvents !== undefined) {
            lastCreatedEventsRef.current = lastCreatedEvents
          }
          // If a single event was scheduled, add it to lastCreatedEvents
          if (scheduledEvent && eventCreated) {
            lastCreatedEventsRef.current = [
              ...lastCreatedEventsRef.current,
              {
                title: scheduledEvent.title,
                date: scheduledEvent.date,
                time: scheduledEvent.time,
              },
            ]
          }

          const userEntry: TranscriptEntry = {
            speaker: "user",
            text: text.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          }
          setTranscript((prev) => [...prev, userEntry])

          // Clear paragraph buffer for next input
          setCurrentParagraph("")
          currentParagraphRef.current = ""

          if (isQuestion && answer) {
            recentContextRef.current = []

            if (isSpeaking && "speechSynthesis" in window) {
              window.speechSynthesis.cancel()
              setIsSpeaking(false)
            }

            incrementStat("conversations")
            incrementStat("aiResponses")

            conversationHistoryRef.current.push({ role: "user", text: text.trim() })
            conversationHistoryRef.current.push({ role: "assistant", text: answer })
            if (conversationHistoryRef.current.length > 10) {
              conversationHistoryRef.current = conversationHistoryRef.current.slice(-10)
            }

            const assistantEntry: TranscriptEntry = {
              speaker: "assistant",
              text: answer,
              timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            }
            setTranscript((prev) => [...prev, assistantEntry])

            if ("speechSynthesis" in window) {
              window.speechSynthesis.cancel()

              const utterance = new SpeechSynthesisUtterance(answer)

              if (bestVoiceRef.current) {
                utterance.voice = bestVoiceRef.current
              }

              utterance.rate = 1.05
              utterance.pitch = 1.0
              utterance.volume = 1.0

              utterance.onstart = () => {
                setIsSpeaking(true)
              }
              utterance.onend = () => {
                setIsSpeaking(false)
                currentUtteranceRef.current = null
              }
              utterance.onerror = () => {
                setIsSpeaking(false)
                currentUtteranceRef.current = null
              }

              currentUtteranceRef.current = utterance
              speechSynthesisRef.current = utterance
              window.speechSynthesis.speak(utterance)
            }

            const fullConversation = `User: ${text.trim()}\nAssistant: ${answer}`
            if (onConversationCompleteRef.current) {
              onConversationCompleteRef.current(fullConversation)
            }

            if (refreshCalendar) {
              window.dispatchEvent(new CustomEvent("refreshCalendar"))
            }
          } else {
            recentContextRef.current.push(text.trim())
            // Keep only last 3 non-question segments
            if (recentContextRef.current.length > 3) {
              recentContextRef.current = recentContextRef.current.slice(-3)
            }
          }
        }
      } catch (error) {
        console.error("Error checking for question:", error)
      } finally {
        isCheckingRef.current = false
        setIsProcessing(false)
      }
    },
    [aiEnabled, incrementStat, isSpeaking, safetyMode, customInstructions],
  )

  useEffect(() => {
    checkForQuestionAndAnswerRef.current = checkForQuestionAndAnswer
  }, [checkForQuestionAndAnswer])

  const startListening = useCallback(async () => {
    listeningStartTimeRef.current = Date.now()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Improved audio settings for Deepgram
        },
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

      if (useDeepgram) {
        console.log("[v0] Starting Deepgram transcription")

        // Set up audio processor for streaming to Deepgram
        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        source.connect(processor)
        processor.connect(audioContext.destination)

        let audioChunks: Float32Array[] = []
        let lastSendTime = Date.now()

        processor.onaudioprocess = async (e) => {
          const inputData = e.inputBuffer.getChannelData(0)
          audioChunks.push(new Float32Array(inputData))

          // Send audio every 500ms
          if (Date.now() - lastSendTime > 500 && audioChunks.length > 0) {
            lastSendTime = Date.now()

            // Combine chunks
            const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
            const combined = new Float32Array(totalLength)
            let offset = 0
            for (const chunk of audioChunks) {
              combined.set(chunk, offset)
              offset += chunk.length
            }
            audioChunks = []

            // Convert float32 to int16 for Deepgram
            const int16 = new Int16Array(combined.length)
            for (let i = 0; i < combined.length; i++) {
              const s = Math.max(-1, Math.min(1, combined[i]))
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
            }

            try {
              const response = await fetch("/api/transcribe", {
                method: "POST",
                headers: {
                  "Content-Type": "application/octet-stream",
                },
                body: int16.buffer,
              })

              const data = await response.json()

              if (data.transcript && data.transcript.trim()) {
                if (data.isInterim) {
                  setInterimTranscript(data.transcript)
                } else {
                  setInterimTranscript("")
                  const newParagraph = currentParagraphRef.current
                    ? currentParagraphRef.current + " " + data.transcript.trim()
                    : data.transcript.trim()

                  currentParagraphRef.current = newParagraph
                  setCurrentParagraph(newParagraph)

                  if (checkQuestionTimeoutRef.current) {
                    clearTimeout(checkQuestionTimeoutRef.current)
                  }
                  checkQuestionTimeoutRef.current = setTimeout(() => {
                    checkForQuestionAndAnswerRef.current(newParagraph)
                  }, 700)
                }
              }
            } catch (error) {
              console.error("[v0] Deepgram transcription error:", error)
            }
          }
        }

        processorRef.current = processor
        return
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        console.log("[v0] Web Speech API not supported")
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

        if (interimText) {
          setInterimTranscript(interimText)
        }

        if (finalTranscript) {
          setInterimTranscript("")

          const newParagraph = currentParagraphRef.current
            ? currentParagraphRef.current + " " + finalTranscript.trim()
            : finalTranscript.trim()

          currentParagraphRef.current = newParagraph
          setCurrentParagraph(newParagraph)

          if (checkQuestionTimeoutRef.current) {
            clearTimeout(checkQuestionTimeoutRef.current)
          }
          checkQuestionTimeoutRef.current = setTimeout(() => {
            checkForQuestionAndAnswerRef.current(newParagraph)
          }, 700)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log("[v0] Speech recognition error:", event.error)
        if (event.error === "not-allowed") {
          setHasPermission(false)
        }
      }

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start()
          } catch (e) {
            console.log("[v0] Failed to restart recognition:", e)
          }
        }
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (error) {
      console.log("[v0] Failed to start listening:", error)
      setHasPermission(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (listeningStartTimeRef.current) {
      const minutes = Math.round((Date.now() - listeningStartTimeRef.current) / 60000)
      if (minutes > 0) {
        statsRef.current.totalMinutes = (statsRef.current.totalMinutes || 0) + minutes
        saveStats()
      }
      listeningStartTimeRef.current = null
    }

    isListeningRef.current = false
    isRestartingRef.current = false

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

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
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
  }, [saveStats])

  const addTranscriptEntry = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev, entry])
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedInstructions = localStorage.getItem("customInstructions")
      if (savedInstructions) {
        setCustomInstructionsState(savedInstructions)
        customInstructionsRef.current = savedInstructions
      }
    }
  }, [])

  const setCustomInstructions = useCallback((instructions: string) => {
    setCustomInstructionsState(instructions)
    customInstructionsRef.current = instructions
    if (typeof window !== "undefined") {
      localStorage.setItem("customInstructions", instructions)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      if (checkQuestionTimeoutRef.current) {
        clearTimeout(checkQuestionTimeoutRef.current)
      }
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
        addTranscriptEntry,
        interimTranscript,
        isProcessing,
        aiEnabled,
        setAiEnabled,
        isSpeaking,
        currentParagraph,
        setOnConversationComplete,
        setNotesContext,
        setCalendarContext,
        safetyMode,
        setSafetyMode,
        incrementStat,
        customInstructions,
        setCustomInstructions,
        useDeepgram,
        setUseDeepgram,
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
