"use client"

import { GlassCard } from "./glass-card"
import { cn } from "@/lib/utils"

interface TranscriptItemProps {
  speaker: "user" | "other" | "assistant"
  text: string
  timestamp: string
  confidence?: number
  speakerId?: number
}

export function TranscriptItem({ speaker, text, timestamp, confidence, speakerId }: TranscriptItemProps) {
  const getSpeakerLabel = () => {
    if (speaker === "assistant") return "Assistant"
    if (speaker === "other") return "Speaker"
    // For user entries, show Speaker number if available
    if (speakerId !== undefined) {
      return `Speaker ${speakerId + 1}`
    }
    return "You"
  }

  const getSpeakerColor = () => {
    if (speaker === "assistant") return "text-[var(--apple-green)]"
    if (speaker === "other") return "text-muted-foreground"
    if (speakerId !== undefined) {
      const colors = [
        "text-[var(--apple-blue)]",
        "text-[var(--apple-purple)]",
        "text-[var(--apple-orange)]",
        "text-[var(--apple-pink)]",
        "text-[var(--apple-teal)]",
      ]
      return colors[speakerId % colors.length]
    }
    return "text-[var(--apple-blue)]"
  }

  const getBgColor = () => {
    if (speaker === "assistant") return "bg-[var(--apple-green)]/20"
    if (speaker === "other") return ""
    if (speakerId !== undefined) {
      const colors = [
        "bg-[var(--apple-blue)]/20",
        "bg-[var(--apple-purple)]/20",
        "bg-[var(--apple-orange)]/20",
        "bg-[var(--apple-pink)]/20",
        "bg-[var(--apple-teal)]/20",
      ]
      return colors[speakerId % colors.length]
    }
    return "bg-[var(--apple-blue)]/20"
  }

  return (
    <div className={cn("flex gap-3", speaker === "user" ? "justify-end" : "justify-start")}>
      <GlassCard className={cn("max-w-[80%] p-3", getBgColor())}>
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-xs font-medium", getSpeakerColor())}>{getSpeakerLabel()}</span>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          {confidence && <span className="text-xs text-muted-foreground/70">{Math.round(confidence * 100)}%</span>}
        </div>
        <p className="text-sm text-foreground leading-relaxed">{text}</p>
      </GlassCard>
    </div>
  )
}
