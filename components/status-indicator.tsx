"use client"

import { cn } from "@/lib/utils"

interface StatusIndicatorProps {
  status: "active" | "inactive" | "warning"
  label?: string
  className?: string
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn("w-2.5 h-2.5 rounded-full", {
          "bg-[var(--apple-green)] animate-pulse-soft": status === "active",
          "bg-muted-foreground/50": status === "inactive",
          "bg-amber-500 animate-pulse-soft": status === "warning",
        })}
      />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  )
}
