"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface WaveformProps {
  isRecording: boolean
  audioLevel?: number
  className?: string
}

export function Waveform({ isRecording, audioLevel = 0, className }: WaveformProps) {
  const [bars, setBars] = useState(Array.from({ length: 24 }, () => Math.random()))

  useEffect(() => {
    if (!isRecording) return

    const interval = setInterval(() => {
      setBars((prev) => prev.map(() => 0.2 + Math.random() * 0.8 * (audioLevel > 0 ? audioLevel * 2 : 1)))
    }, 100)

    return () => clearInterval(interval)
  }, [isRecording, audioLevel])

  return (
    <div className={cn("flex items-center justify-center gap-1 h-16", className)}>
      {bars.map((height, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-all duration-150",
            isRecording ? "bg-[var(--apple-blue)]" : "bg-muted",
          )}
          style={{
            height: isRecording ? `${8 + height * 48}px` : "8px",
            opacity: isRecording ? 0.6 + height * 0.4 : 0.5,
          }}
        />
      ))}
    </div>
  )
}
