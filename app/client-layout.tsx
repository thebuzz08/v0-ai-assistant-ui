"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { MicrophoneProvider } from "@/lib/microphone-context"
import { NotesProvider } from "@/lib/notes-context"
import { CalendarProvider } from "@/lib/calendar-context"
import { AuthProvider } from "@/lib/auth-context"
import { RealtimeVoiceProvider } from "@/lib/realtime-voice-context"

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
    <AuthProvider>
      <CalendarProvider>
        <NotesProvider>
          <MicrophoneProvider>
            <RealtimeVoiceProvider>
              <ThemeProvider>{children}</ThemeProvider>
            </RealtimeVoiceProvider>
          </MicrophoneProvider>
        </NotesProvider>
      </CalendarProvider>
    </AuthProvider>
  )
}
