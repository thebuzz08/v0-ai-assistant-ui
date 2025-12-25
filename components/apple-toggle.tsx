"use client"

import { cn } from "@/lib/utils"

interface AppleToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  disabled?: boolean
}

export function AppleToggle({ enabled, onToggle, disabled = false }: AppleToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onToggle(!enabled)}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        enabled ? "bg-[var(--apple-green)]" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-300 ease-out",
          "mt-0.5",
          enabled ? "translate-x-6.5 ml-0.5" : "translate-x-0.5",
        )}
      />
    </button>
  )
}
