"use client"

import { useRef, useEffect } from "react"
import { Mic, MicOff, Volume2 } from "lucide-react"
import { useMicrophone } from "@/lib/microphone-context"

export default function HomePage() {
  const {
    isListening,
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    currentParagraph,
    isProcessing,
    isSpeaking,
    audioLevel,
  } = useMicrophone()

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript, currentParagraph, interimTranscript])

  const handleToggle = async () => {
    if (isListening) {
      stopListening()
    } else {
      await startListening()
    }
  }

  const getStatusText = () => {
    if (isSpeaking) return "AI speaking..."
    if (isProcessing) return "Processing..."
    if (isListening) return "Listening..."
    return "Tap to start"
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white text-center">Voice AI</h1>
      </header>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcript.length === 0 && !currentParagraph && !interimTranscript ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-400 text-center">
              {isListening ? "Listening... speak to see transcript" : "Tap the mic to start"}
            </p>
          </div>
        ) : (
          <>
            {transcript.map((item, index) => (
              <div
                key={index}
                className={`p-3 rounded-2xl max-w-[85%] ${
                  item.speaker === "assistant"
                    ? "bg-[var(--apple-blue)] text-white ml-auto"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                }`}
              >
                <p className="text-sm">{item.text}</p>
              </div>
            ))}
            {(currentParagraph || interimTranscript) && (
              <div className="p-3 rounded-2xl max-w-[85%] bg-zinc-200 dark:bg-zinc-800">
                <p className="text-sm text-zinc-900 dark:text-white">
                  {currentParagraph}
                  {currentParagraph && interimTranscript ? " " : ""}
                  <span className="text-zinc-500">{interimTranscript}</span>
                  <span className="animate-pulse">|</span>
                </p>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </>
        )}
      </div>

      {/* Status */}
      <div className="text-center py-2">
        <span className="text-sm text-zinc-500 flex items-center justify-center gap-2">
          {isSpeaking && <Volume2 className="w-4 h-4 animate-pulse" />}
          {getStatusText()}
        </span>
      </div>

      {/* Mic Button */}
      <div className="p-6 flex justify-center">
        <button
          onClick={handleToggle}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            isListening ? "bg-red-500 hover:bg-red-600" : "bg-[var(--apple-blue)] hover:opacity-90"
          }`}
        >
          {/* Audio level ring */}
          {isListening && (
            <div
              className="absolute inset-0 rounded-full border-4 border-white/30 transition-transform"
              style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
            />
          )}
          {isListening ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
        </button>
      </div>
    </main>
  )
}
