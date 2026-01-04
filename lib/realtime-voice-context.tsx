"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { useCalendar } from "./calendar-context"

export interface TranscriptEntry {
  speaker: "user" | "assistant"
  text: string
  timestamp: string
}

interface RealtimeVoiceContextType {
  isConnected: boolean
  isListening: boolean
  audioLevel: number
  connect: () => Promise<void>
  disconnect: () => void
  transcript: TranscriptEntry[]
  isSpeaking: boolean
  customInstructions: string
  setCustomInstructions: (instructions: string) => void
  requestMicrophonePermission: () => Promise<boolean>
}

const RealtimeVoiceContext = createContext<RealtimeVoiceContextType | null>(null)

export function RealtimeVoiceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [customInstructions, setCustomInstructionsState] = useState("")

  const deepgramConnectionRef = useRef<any>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const customInstructionsRef = useRef("")
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const isProcessingRef = useRef(false)
  const lastTranscriptRef = useRef("")
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const { events: calendarEvents } = useCalendar()

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("customInstructions")
      if (saved) {
        setCustomInstructionsState(saved)
        customInstructionsRef.current = saved
      }
    }
  }, [])

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch (error) {
      console.error("[v0] Microphone permission denied:", error)
      return false
    }
  }, [])

  const setCustomInstructions = useCallback((instructions: string) => {
    setCustomInstructionsState(instructions)
    customInstructionsRef.current = instructions
    if (typeof window !== "undefined") {
      localStorage.setItem("customInstructions", instructions)
    }
  }, [])

  const buildSystemPrompt = useCallback((customInst: string, events: any[]) => {
    const currentTime = new Date().toLocaleTimeString()
    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })

    const calendarContext = events
      ?.slice(0, 10)
      .map((e) => `- ${e.title} at ${e.time} on ${e.date}`)
      .join("\n")

    return `You are Omnisound, a helpful voice assistant. Current time: ${currentTime} on ${currentDate}.

${customInst ? `USER'S CUSTOM INSTRUCTIONS (follow these strictly):\n${customInst}\n` : ""}

CRITICAL BEHAVIOR - When to Respond:
- ONLY respond to direct questions or requests addressed TO YOU
- Examples to RESPOND: "what's 5+5?", "who is the CEO of Apple?", "what's on my calendar?", "schedule a meeting", "what's the market cap of Apple?"
- Examples to respond SILENT: "I'm walking to the store", "the weather is nice", "just thinking out loud", "hmm interesting", "who is sarah" (unless you have context about Sarah in calendar/notes)

WHEN YOU NEED MORE INFORMATION:
- For questions about people/events/notes that might be in user's calendar or notes, you CAN answer if you see them in YOUR CALENDAR below
- For general knowledge questions (market cap, CEO, population, current events, facts), you MUST provide an answer - use your knowledge or indicate if you need to search
- NEVER say "I don't have that information" for general knowledge - always provide your best answer

${calendarContext ? `YOUR CALENDAR (ONLY these events exist):\n${calendarContext}\n\nIMPORTANT: Only mention events from THIS list. If no events match the query, say "nothing scheduled". Never invent events.` : ""}

RESPONSE RULES:
- For factual questions: Give ONLY the raw answer
  - "Tim Cook" NOT "The CEO of Apple is Tim Cook"
  - "Paris" NOT "The capital of France is Paris"
  - "4.4 trillion" NOT "The market cap is 4.4 trillion"
- For calendar queries: ONLY report events from YOUR CALENDAR list above
  - Use format "[event name] at [time]" - NEVER include dates or day names
  - "call with Clark at 8 PM" NOT "call with Clark on Saturday at 8:00 PM"
  - If no matching events: "nothing scheduled"
- For explanations: Keep it to 1-2 sentences maximum
- Be conversational and natural, not robotic
- NEVER start with "The answer is", "It is", "The [thing] is", etc.

If the user is NOT asking you something directly, respond with exactly: "SILENT"`
  }, [])

  const processAIResponse = useCallback(
    async (userText: string) => {
      if (isProcessingRef.current) return
      isProcessingRef.current = true

      try {
        const systemPrompt = buildSystemPrompt(customInstructionsRef.current, calendarEvents || [])

        console.log("[v0] Sending to AI:", userText)

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: userText }],
            systemPrompt,
          }),
        })

        if (!response.ok) {
          throw new Error(`AI API error: ${response.status}`)
        }

        const data = await response.json()
        const aiResponse = data.choices[0]?.message?.content?.trim()

        console.log("[v0] AI response:", aiResponse)

        const shouldStaySilent =
          !aiResponse || aiResponse.toUpperCase().replace(/[^A-Z]/g, "") === "SILENT" || aiResponse.length === 0

        if (!shouldStaySilent) {
          const newEntry: TranscriptEntry = {
            speaker: "assistant",
            text: aiResponse,
            timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          }
          setTranscript((prev) => [...prev, newEntry])

          if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(aiResponse)
            utterance.rate = 1.15
            utterance.pitch = 1.0
            utterance.volume = 1.0

            const voices = window.speechSynthesis.getVoices()
            const preferredVoice = voices.find((v) => v.name.includes("Samantha") || v.name.includes("Google"))
            if (preferredVoice) {
              utterance.voice = preferredVoice
            }

            utterance.onstart = () => setIsSpeaking(true)
            utterance.onend = () => setIsSpeaking(false)
            utterance.onerror = () => setIsSpeaking(false)

            speechSynthesisRef.current = utterance
            window.speechSynthesis.speak(utterance)
          }
        } else {
          console.log("[v0] AI chose to stay silent")
        }
      } catch (error) {
        console.error("[v0] Error processing AI response:", error)
      } finally {
        isProcessingRef.current = false
      }
    },
    [calendarEvents, buildSystemPrompt],
  )

  const connect = useCallback(async () => {
    try {
      console.log("[v0] Starting Deepgram streaming...")

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      })
      mediaStreamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 16000 })
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

      const response = await fetch("/api/deepgram/token", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to get Deepgram token")
      }

      const { token } = await response.json()

      const deepgramUrl = new URL("wss://api.deepgram.com/v1/listen")
      deepgramUrl.searchParams.append("encoding", "linear16")
      deepgramUrl.searchParams.append("sample_rate", "16000")
      deepgramUrl.searchParams.append("channels", "1")
      deepgramUrl.searchParams.append("model", "nova-2")
      deepgramUrl.searchParams.append("smart_format", "true")
      deepgramUrl.searchParams.append("interim_results", "true")
      deepgramUrl.searchParams.append("vad_events", "true")
      deepgramUrl.searchParams.append("endpointing", "300")

      const deepgramWs = new WebSocket(deepgramUrl.toString(), ["token", token])

      let keepAliveInterval: NodeJS.Timeout | null = null

      deepgramWs.onopen = () => {
        console.log("[v0] Deepgram WebSocket connected")
        setIsConnected(true)
        setIsListening(true)

        keepAliveInterval = setInterval(() => {
          if (deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify({ type: "KeepAlive" }))
          }
        }, 5000)

        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (deepgramWs.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0)
            const pcm16 = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]))
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
            }
            deepgramWs.send(pcm16.buffer)
          }
        }

        source.connect(processor)
        processor.connect(audioContext.destination)
      }

      deepgramWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const transcript = data.channel?.alternatives?.[0]?.transcript

          if (transcript && transcript.length > 0) {
            const isFinal = data.is_final

            if (isFinal) {
              console.log("[v0] Final transcript:", transcript)

              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current)
              }

              const newUserEntry: TranscriptEntry = {
                speaker: "user",
                text: transcript,
                timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
              }
              setTranscript((prev) => [...prev, newUserEntry])

              silenceTimerRef.current = setTimeout(() => {
                processAIResponse(transcript)
              }, 800)

              lastTranscriptRef.current = transcript
            }
          }
        } catch (error) {
          console.error("[v0] Error parsing Deepgram message:", error)
        }
      }

      deepgramWs.onerror = (error) => {
        console.error("[v0] Deepgram WebSocket error:", error)
        if (keepAliveInterval) clearInterval(keepAliveInterval)
      }

      deepgramWs.onclose = (event) => {
        console.log("[v0] Deepgram WebSocket closed", event.code, event.reason)
        if (keepAliveInterval) clearInterval(keepAliveInterval)
        setIsConnected(false)
        setIsListening(false)
      }

      deepgramConnectionRef.current = deepgramWs
    } catch (error) {
      console.error("[v0] Error connecting:", error)
      setIsConnected(false)
      setIsListening(false)
    }
  }, [processAIResponse])

  const disconnect = useCallback(() => {
    console.log("[v0] Disconnecting...")

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (deepgramConnectionRef.current) {
      deepgramConnectionRef.current.close()
      deepgramConnectionRef.current = null
    }

    analyserRef.current = null
    setAudioLevel(0)
    setIsConnected(false)
    setIsListening(false)
    setIsSpeaking(false)
    isProcessingRef.current = false
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return (
    <RealtimeVoiceContext.Provider
      value={{
        isConnected,
        isListening,
        audioLevel,
        connect,
        disconnect,
        transcript,
        isSpeaking,
        customInstructions,
        setCustomInstructions,
        requestMicrophonePermission,
      }}
    >
      {children}
    </RealtimeVoiceContext.Provider>
  )
}

export function useRealtimeVoice() {
  const context = useContext(RealtimeVoiceContext)
  if (!context) {
    throw new Error("useRealtimeVoice must be used within a RealtimeVoiceProvider")
  }
  return context
}
