"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { useCalendar } from "./calendar-context"
import type { TranscriptEntry } from "./microphone-context"

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
}

const RealtimeVoiceContext = createContext<RealtimeVoiceContextType | null>(null)

export function RealtimeVoiceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [customInstructions, setCustomInstructionsState] = useState("")

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const isPlayingRef = useRef(false)
  const customInstructionsRef = useRef("")

  const { events: calendarEvents } = useCalendar()

  // Load custom instructions from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("customInstructions")
      if (saved) {
        setCustomInstructionsState(saved)
        customInstructionsRef.current = saved
      }
    }
  }, [])

  const setCustomInstructions = useCallback(
    (instructions: string) => {
      setCustomInstructionsState(instructions)
      customInstructionsRef.current = instructions
      if (typeof window !== "undefined") {
        localStorage.setItem("customInstructions", instructions)
      }

      // Update session if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const systemPrompt = buildSystemPrompt(instructions, calendarEvents)
        wsRef.current.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions: systemPrompt,
            },
          }),
        )
      }
    },
    [calendarEvents],
  )

  const buildSystemPrompt = (customInst: string, events: any[]) => {
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

${customInst ? `USER'S CUSTOM INSTRUCTIONS:\n${customInst}\n` : ""}

CRITICAL BEHAVIOR:
- ONLY respond to direct questions or requests addressed to you
- If the user is just talking, narrating, or making statements not directed at you, stay SILENT
- Examples of when to RESPOND: "what's 5+5?", "what time is it?", "schedule a meeting", "what's on my calendar?"
- Examples of when to stay SILENT: "I'm walking to the store", "the weather is nice", "just talking to myself"

${calendarContext ? `YOUR CALENDAR:\n${calendarContext}\n\nIMPORTANT: Only mention events from this list. Never invent events.` : ""}

RESPONSE RULES:
- Keep answers concise and natural (1-2 sentences max)
- For math/facts: give just the answer ("10", not "the answer is 10")
- For calendar: only report actual events from YOUR CALENDAR list above
- Use conversational tone, not robotic

If unsure whether the user is talking TO you, err on the side of silence.`
  }

  const playAudioChunk = useCallback(async (audioData: ArrayBuffer) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 })
    }

    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData)
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)

      source.onended = () => {
        isPlayingRef.current = false
        // Play next in queue
        if (audioQueueRef.current.length > 0) {
          const next = audioQueueRef.current.shift()
          if (next) {
            isPlayingRef.current = true
            playAudioChunk(next)
          }
        } else {
          setIsSpeaking(false)
        }
      }

      source.start(0)
      setIsSpeaking(true)
    } catch (error) {
      console.error("[v0] Error playing audio:", error)
      isPlayingRef.current = false
      setIsSpeaking(false)
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      console.log("[v0] Connecting to OpenAI Realtime API...")

      // Get ephemeral token
      const tokenResponse = await fetch("/api/realtime/token")
      if (!tokenResponse.ok) {
        throw new Error("Failed to get realtime token")
      }
      const tokenData = await tokenResponse.json()
      const clientSecret = tokenData.client_secret?.value

      if (!clientSecret) {
        throw new Error("No client secret in response")
      }

      // Connect WebSocket
      const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`
      const ws = new WebSocket(wsUrl, ["realtime", `openai-insecure-api-key.${clientSecret}`])

      ws.addEventListener("open", async () => {
        console.log("[v0] WebSocket connected")
        setIsConnected(true)

        // Update session with custom instructions
        const systemPrompt = buildSystemPrompt(customInstructionsRef.current, calendarEvents || [])
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions: systemPrompt,
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              voice: "verse",
              temperature: 0.8,
              max_response_output_tokens: 1024,
            },
          }),
        )

        // Start audio capture
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 24000,
          },
        })
        mediaStreamRef.current = stream

        // Set up audio level monitoring
        const audioContext = new AudioContext({ sampleRate: 24000 })
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

        // Set up media recorder to send audio to OpenAI
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        })
        mediaRecorderRef.current = mediaRecorder

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const arrayBuffer = await event.data.arrayBuffer()
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
            ws.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64Audio,
              }),
            )
          }
        }

        mediaRecorder.start(100) // Send audio every 100ms
        setIsListening(true)
        console.log("[v0] Audio streaming started")
      })

      ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case "response.audio_transcript.delta":
              // User's speech being transcribed
              console.log("[v0] Transcript delta:", message.delta)
              break

            case "response.audio_transcript.done":
              // Final transcript from user
              const userText = message.transcript
              if (userText) {
                console.log("[v0] User said:", userText)
                setTranscript((prev) => [
                  ...prev,
                  {
                    speaker: "user",
                    text: userText,
                    timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
                  },
                ])
              }
              break

            case "response.audio.delta":
              // AI's audio response
              if (message.delta) {
                const audioData = Uint8Array.from(atob(message.delta), (c) => c.charCodeAt(0))
                const audioBuffer = audioData.buffer

                if (isPlayingRef.current) {
                  audioQueueRef.current.push(audioBuffer)
                } else {
                  isPlayingRef.current = true
                  playAudioChunk(audioBuffer)
                }
              }
              break

            case "response.text.delta":
              // AI's text response delta
              console.log("[v0] AI response delta:", message.delta)
              break

            case "response.text.done":
              // Final AI text response
              const assistantText = message.text
              if (assistantText) {
                console.log("[v0] AI said:", assistantText)
                setTranscript((prev) => [
                  ...prev,
                  {
                    speaker: "assistant",
                    text: assistantText,
                    timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
                  },
                ])
              }
              break

            case "response.done":
              console.log("[v0] Response complete")
              break

            case "error":
              console.error("[v0] Realtime API error:", message.error)
              break

            default:
              console.log("[v0] Unhandled message type:", message.type)
          }
        } catch (error) {
          console.error("[v0] Error parsing WebSocket message:", error)
        }
      })

      ws.addEventListener("close", () => {
        console.log("[v0] WebSocket closed")
        setIsConnected(false)
        setIsListening(false)
      })

      ws.addEventListener("error", (error) => {
        console.error("[v0] WebSocket error:", error)
        setIsConnected(false)
        setIsListening(false)
      })

      wsRef.current = ws
    } catch (error) {
      console.error("[v0] Error connecting to Realtime API:", error)
      setIsConnected(false)
      setIsListening(false)
    }
  }, [calendarEvents, playAudioChunk])

  const disconnect = useCallback(() => {
    console.log("[v0] Disconnecting from Realtime API...")

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
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

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    audioQueueRef.current = []
    isPlayingRef.current = false
    analyserRef.current = null
    setAudioLevel(0)
    setIsConnected(false)
    setIsListening(false)
    setIsSpeaking(false)
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
