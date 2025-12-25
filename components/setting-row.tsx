"use client"

import { AppleToggle } from "./apple-toggle"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface SettingRowProps {
  icon: ReactNode
  title: string
  subtitle?: string
  type: "toggle" | "link" | "info" | "custom"
  value?: boolean | string
  onToggle?: (value: boolean) => void
  onClick?: () => void
  destructive?: boolean
  customElement?: ReactNode
}

export function SettingRow({
  icon,
  title,
  subtitle,
  type,
  value,
  onToggle,
  onClick,
  destructive = false,
  customElement,
}: SettingRowProps) {
  const content = (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 transition-colors rounded-xl">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            destructive ? "bg-destructive/10 text-destructive" : "bg-[var(--apple-blue)]/10 text-[var(--apple-blue)]",
          )}
        >
          {icon}
        </div>
        <div>
          <span className={cn("font-medium", destructive ? "text-destructive" : "text-foreground")}>{title}</span>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      {type === "toggle" && typeof value === "boolean" && onToggle && (
        <AppleToggle enabled={value} onToggle={onToggle} />
      )}

      {type === "link" && (
        <div className="flex items-center gap-2">
          {typeof value === "string" && <span className="text-sm text-muted-foreground">{value}</span>}
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      )}

      {type === "info" && typeof value === "string" && <span className="text-sm text-muted-foreground">{value}</span>}

      {type === "custom" && customElement}
    </div>
  )

  if ((type === "link" || type === "custom") && onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    )
  }

  return content
}
