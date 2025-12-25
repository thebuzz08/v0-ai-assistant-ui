"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function EarbudsAnimation({ className }: { className?: string }) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(true), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn("relative w-48 h-48", className)}>
      {/* Subtle glowing background effect */}
      <div
        className={cn(
          "absolute inset-0 rounded-full transition-opacity duration-1000",
          isAnimating ? "opacity-60" : "opacity-0",
        )}
        style={{
          background: "radial-gradient(circle, var(--apple-cyan) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Left Earbud - Generic wireless earbud style */}
      <div
        className={cn(
          "absolute left-8 top-1/2 -translate-y-1/2 transition-all duration-700 ease-out",
          isAnimating ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6",
        )}
        style={{ transitionDelay: "200ms" }}
      >
        {/* Main body - oval bean shape */}
        <div className="relative">
          <svg width="50" height="70" viewBox="0 0 50 70" fill="none">
            {/* Earbud body */}
            <ellipse
              cx="25"
              cy="35"
              rx="20"
              ry="28"
              className="fill-neutral-200 dark:fill-neutral-800"
              stroke="url(#leftGradient)"
              strokeWidth="1"
            />
            {/* Inner shadow/depth */}
            <ellipse cx="25" cy="35" rx="16" ry="24" className="fill-neutral-100 dark:fill-neutral-700" />
            {/* Speaker grille */}
            <circle cx="25" cy="28" r="8" className="fill-neutral-300 dark:fill-neutral-600" />
            <circle cx="25" cy="28" r="5" className="fill-neutral-400 dark:fill-neutral-500" />
            {/* Touch surface highlight */}
            <ellipse cx="22" cy="42" rx="6" ry="10" className="fill-white/20 dark:fill-white/5" />
            <defs>
              <linearGradient id="leftGradient" x1="0" y1="0" x2="50" y2="70">
                <stop offset="0%" stopColor="var(--apple-cyan)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--apple-blue)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
          {/* Status LED */}
          <div
            className={cn(
              "absolute bottom-4 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all duration-500",
              isAnimating
                ? "bg-[var(--apple-green)] shadow-[0_0_10px_var(--apple-green)]"
                : "bg-neutral-400 dark:bg-neutral-600",
            )}
          />
        </div>
      </div>

      {/* Right Earbud - Generic wireless earbud style */}
      <div
        className={cn(
          "absolute right-8 top-1/2 -translate-y-1/2 transition-all duration-700 ease-out",
          isAnimating ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6",
        )}
        style={{ transitionDelay: "350ms" }}
      >
        {/* Main body - oval bean shape */}
        <div className="relative">
          <svg width="50" height="70" viewBox="0 0 50 70" fill="none">
            {/* Earbud body */}
            <ellipse
              cx="25"
              cy="35"
              rx="20"
              ry="28"
              className="fill-neutral-200 dark:fill-neutral-800"
              stroke="url(#rightGradient)"
              strokeWidth="1"
            />
            {/* Inner shadow/depth */}
            <ellipse cx="25" cy="35" rx="16" ry="24" className="fill-neutral-100 dark:fill-neutral-700" />
            {/* Speaker grille */}
            <circle cx="25" cy="28" r="8" className="fill-neutral-300 dark:fill-neutral-600" />
            <circle cx="25" cy="28" r="5" className="fill-neutral-400 dark:fill-neutral-500" />
            {/* Touch surface highlight */}
            <ellipse cx="28" cy="42" rx="6" ry="10" className="fill-white/20 dark:fill-white/5" />
            <defs>
              <linearGradient id="rightGradient" x1="50" y1="0" x2="0" y2="70">
                <stop offset="0%" stopColor="var(--apple-cyan)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--apple-blue)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
          {/* Status LED */}
          <div
            className={cn(
              "absolute bottom-4 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all duration-500",
              isAnimating
                ? "bg-[var(--apple-green)] shadow-[0_0_10px_var(--apple-green)]"
                : "bg-neutral-400 dark:bg-neutral-600",
            )}
          />
        </div>
      </div>

      {/* Connection waves */}
      {isAnimating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 border border-[var(--apple-cyan)]/30 rounded-full animate-ping" />
          <div
            className="absolute w-24 h-24 border border-[var(--apple-cyan)]/20 rounded-full animate-ping"
            style={{ animationDelay: "400ms" }}
          />
        </div>
      )}
    </div>
  )
}
