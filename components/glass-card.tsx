"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface GlassCardProps {
  children: ReactNode
  className?: string
  strong?: boolean
}

export function GlassCard({ children, className, strong = false }: GlassCardProps) {
  return (
    <div className={cn("rounded-3xl p-6 transform-gpu", strong ? "glass-strong" : "glass", className)}>{children}</div>
  )
}
