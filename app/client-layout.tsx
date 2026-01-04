"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { MicrophoneProvider } from "@/lib/microphone-context"

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("darkMode")
    if (stored !== null) {
      setDarkMode(stored === "true")
    }
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  return <>{children}</>
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <MicrophoneProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </MicrophoneProvider>
  )
}
