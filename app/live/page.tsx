"use client"

import { useEffect, useRef } from "react"
import { GlassCard } from "@/components/glass-card"
import { StatusIndicator } from "@/components/status-indicator"
import { TranscriptItem } from "@/components/transcript-item"
import { BottomNav } from "@/components/bottom-nav"
import { Waveform } from "@/components/waveform"
import { Pause, Play, Volume2, VolumeX, Loader2, Mic } from "lucide-react"
import { useMicrophone } from "@/lib/microphone-context"

export default function LiveFeedPage() {
  const {
    isListening: micListening,
    audioLevel,
    startListening: startMic,
    stopListening: stopMic,
    transcript: transcripts,
    interimTranscript,
    isProcessing,
    aiEnabled,
    setAiEnabled,
    isSpeaking,
    currentParagraph,
  } = useMicrophone()

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcripts, interimTranscript, currentParagraph])

  const handleToggle = async () => {
    if (micListening) {
      stopMic()
    } else {
      await startMic()
    }
  }

  const toggleAI = () => {
    setAiEnabled(!aiEnabled)
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-14 px-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Live Feed</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAI}
              className={`p-2 rounded-full transition-colors ${
                aiEnabled ? "bg-[var(--apple-blue)] text-white" : "bg-secondary text-muted-foreground"
              }`}
              title={aiEnabled ? "AI responses enabled" : "AI responses disabled"}
            >
              {aiEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <StatusIndicator status={micListening ? "active" : "inactive"} label={micListening ? "Active" : "Paused"} />
          </div>
        </div>
      </header>

      <div className="px-6 space-y-4">
        {/* Live Waveform Card */}
        <GlassCard className="p-5" strong>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground">
                {micListening
                  ? isSpeaking
                    ? "AI Speaking..."
                    : interimTranscript
                      ? "Hearing you..."
                      : "Listening..."
                  : "Paused"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {micListening
                  ? isProcessing
                    ? "Generating AI response..."
                    : "Speak naturally - instant transcription"
                  : "Tap play to start listening"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isProcessing && <Loader2 className="w-5 h-5 text-[var(--apple-blue)] animate-spin" />}
              {micListening && !isProcessing && <Mic className="w-5 h-5 text-[var(--apple-green)] animate-pulse" />}
              <button
                onClick={handleToggle}
                className="w-12 h-12 rounded-full bg-[var(--apple-blue)] flex items-center justify-center transition-transform active:scale-95"
              >
                {micListening ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
              </button>
            </div>
          </div>
          <Waveform isRecording={micListening} audioLevel={audioLevel} />
        </GlassCard>

        {/* Transcript List */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-3">Transcript</h2>
          {transcripts.length === 0 && !interimTranscript && !currentParagraph ? (
            <GlassCard className="p-6 text-center">
              <p className="text-muted-foreground">
                {micListening ? "Listening... speak to see transcripts" : "Start listening to see transcripts"}
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {transcripts.map((item, index) => (
                <TranscriptItem
                  key={index}
                  speaker={item.speaker}
                  text={item.text}
                  timestamp={item.timestamp}
                  confidence={item.confidence}
                />
              ))}
              {(currentParagraph || interimTranscript) && (
                <GlassCard className="p-3 border-[var(--apple-blue)]/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--apple-blue)]/20 flex items-center justify-center shrink-0">
                      <Mic className="w-4 h-4 text-[var(--apple-blue)] animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {/* Show accumulated paragraph + interim text */}
                        {currentParagraph}
                        {currentParagraph && interimTranscript ? " " : ""}
                        {interimTranscript && <span className="text-muted-foreground">{interimTranscript}</span>}
                        <span className="animate-pulse">|</span>
                      </p>
                    </div>
                  </div>
                </GlassCard>
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
