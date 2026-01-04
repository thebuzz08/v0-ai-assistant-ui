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

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioPlayerContextRef = useRef<AudioContext | null>(null)
  const customInstructionsRef = useRef("")
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null)

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
      // Stop the stream immediately - we just wanted to check permissions
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch (error) {
      console.error("[v0] Microphone permission denied:", error)
      return false
    }
  }, [])

  const setCustomInstructions = useCallback(
    (instructions: string) => {
      setCustomInstructionsState(instructions)
      customInstructionsRef.current = instructions
      if (typeof window !== "undefined") {
        localStorage.setItem("customInstructions", instructions)
      }

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

  const playAudioChunk = useCallback(async (base64Audio: string) => {
    try {
      if (!audioPlayerContextRef.current) {
        audioPlayerContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const pcm16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(pcm16.length)
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0
      }

      const audioBuffer = audioPlayerContextRef.current.createBuffer(1, float32.length, 24000)
      audioBuffer.getChannelData(0).set(float32)

      const source = audioPlayerContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioPlayerContextRef.current.destination)

      source.onended = () => {
        setIsSpeaking(false)
      }

      source.start(0)
      setIsSpeaking(true)
    } catch (error) {
      console.error("[v0] Error playing audio:", error)
      setIsSpeaking(false)
    }
  }, [])

  const float32ToPCM16Base64 = (float32Array: Float32Array): string => {
    const pcm16 = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    const uint8 = new Uint8Array(pcm16.buffer)
    let binary = ""
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    return btoa(binary)
  }

  const connect = useCallback(async () => {
    try {
      console.log("[v0] Connecting to OpenAI Realtime API...")

      const tokenResponse = await fetch("/api/realtime/token")
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json()
        console.error("[v0] Token error:", errorData)
        throw new Error(`Failed to get realtime token: ${errorData.details || errorData.error}`)
      }
      const tokenData = await tokenResponse.json()
      console.log("[v0] Token data received:", { model: tokenData.model, hasSecret: !!tokenData.client_secret })

      const clientSecret = tokenData.client_secret?.value

      if (!clientSecret) {
        console.error("[v0] No client secret in response:", tokenData)
        throw new Error("No client secret in response")
      }

      const model = tokenData.model || "gpt-4o-realtime-preview"
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`
      console.log("[v0] Connecting to WebSocket:", wsUrl)

      const ws = new WebSocket(wsUrl, ["realtime", `openai-insecure-api-key.${clientSecret}`])

      ws.addEventListener("open", async () => {
        console.log("[v0] WebSocket connected")
        setIsConnected(true)

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
                silence_duration_ms: 700,
              },
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1",
              },
              voice: "verse",
              temperature: 0.8,
              max_response_output_tokens: 1024,
            },
          }),
        )

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 24000,
          },
        })
        mediaStreamRef.current = stream

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

        await audioContext.audioWorklet.addModule(
          "data:text/javascript," +
            encodeURIComponent(`
              class AudioProcessor extends AudioWorkletProcessor {
                process(inputs) {
                  const input = inputs[0];
                  if (input && input[0]) {
                    this.port.postMessage(input[0]);
                  }
                  return true;
                }
              }
              registerProcessor('audio-processor', AudioProcessor);
            `),
        )

        const workletNode = new AudioWorkletNode(audioContext, "audio-processor")
        audioWorkletNodeRef.current = workletNode
        source.connect(workletNode)

        workletNode.port.onmessage = (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            const float32Audio = event.data
            const base64Audio = float32ToPCM16Base64(float32Audio)
            ws.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64Audio,
              }),
            )
          }
        }

        setIsListening(true)
        console.log("[v0] Audio streaming started")
      })

      ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case "conversation.item.input_audio_transcription.completed":
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
              if (message.delta) {
                playAudioChunk(message.delta)
              }
              break

            case "response.audio_transcript.delta":
              console.log("[v0] AI transcript delta:", message.delta)
              break

            case "response.audio_transcript.done":
              const assistantText = message.transcript
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
          }
        } catch (error) {
          console.error("[v0] Error parsing message:", error)
        }
      })

      ws.addEventListener("close", (event) => {
        console.log("[v0] WebSocket closed", event.code, event.reason)
        setIsConnected(false)
        setIsListening(false)
      })

      ws.addEventListener("error", (error) => {
        console.error("[v0] WebSocket error:", error)
      })

      wsRef.current = ws
    } catch (error) {
      console.error("[v0] Error connecting:", error)
      setIsConnected(false)
      setIsListening(false)
    }
  }, [calendarEvents, playAudioChunk])

  const disconnect = useCallback(() => {
    console.log("[v0] Disconnecting...")

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect()
      audioWorkletNodeRef.current = null
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

    if (audioPlayerContextRef.current) {
      audioPlayerContextRef.current.close()
      audioPlayerContextRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

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
