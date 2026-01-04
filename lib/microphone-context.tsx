"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react"

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
  const currentParagraphRef = useRef("")
  const isListeningRef = useRef(false)
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const isProcessingRef = useRef(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const answeredQuestionsRef = useRef<Set<string>>(new Set())

  // Deepgram refs
  const websocketRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

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

      const normalizedQuestion = question.toLowerCase().trim()
      if (answeredQuestionsRef.current.has(normalizedQuestion)) {
        return
      }

      answeredQuestionsRef.current.add(normalizedQuestion)

      isProcessingRef.current = true
      setIsProcessing(true)

      // Clear the current paragraph to prevent re-detection
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

        if (fullText) {
          speakText(fullText)
        }
      } catch (error) {
        console.error("[v0] Error:", error)
        answeredQuestionsRef.current.delete(normalizedQuestion)
      } finally {
        isProcessingRef.current = false
        setIsProcessing(false)
      }
    },
    [speakText],
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
    try {
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
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

      // Get Deepgram token and connect
      const tokenResponse = await fetch("/api/deepgram-token")
      const { apiKey, wsUrl } = await tokenResponse.json()

      const actualSampleRate = audioContext.sampleRate
      const finalWsUrl = wsUrl.replace("sample_rate=16000", `sample_rate=${actualSampleRate}`)

      const ws = new WebSocket(finalWsUrl, ["token", apiKey])
      websocketRef.current = ws

      ws.onopen = () => {
        console.log("[v0] Deepgram connected and authenticated")

        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        source.connect(processor)
        processor.connect(audioContext.destination)

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0)
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
            }
            ws.send(pcmData.buffer)
          }
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "Results") {
            const transcript = data.channel?.alternatives?.[0]?.transcript || ""

            if (transcript) {
              console.log("[v0] Transcript:", transcript, "is_final:", data.is_final)
              if (data.is_final) {
                currentParagraphRef.current = currentParagraphRef.current
                  ? currentParagraphRef.current + " " + transcript.trim()
                  : transcript.trim()
                setCurrentParagraph(currentParagraphRef.current)
                setInterimTranscript("")
              } else {
                setInterimTranscript(transcript)
              }
            }
          }

          if (data.type === "UtteranceEnd") {
            checkForCompleteQuestion()
          }
        } catch (e) {
          console.error("[v0] Failed to parse message:", e)
        }
      }

      ws.onerror = (error) => {
        console.error("[v0] Deepgram error:", error)
      }

      ws.onclose = (event) => {
        console.log("[v0] Deepgram disconnected, code:", event.code, "reason:", event.reason)
      }

      // Also poll periodically for questions mid-speech
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

    // Close Deepgram WebSocket
    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }

    // Stop processor
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
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
      if (websocketRef.current) websocketRef.current.close()
      if (processorRef.current) processorRef.current.disconnect()
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
