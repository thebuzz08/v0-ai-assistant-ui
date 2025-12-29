"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { useAuth } from "./auth-context"

// ... existing code for types ...

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  colorId?: string
  source?: "google" | "local"
}

export interface ExtractedEvent {
  title: string
  date: string
  time: string | null
  duration: number
  description: string
}

interface UserInfo {
  name: string
  email: string
  picture?: string
}

type CalendarProvider = "none" | "google"
type CalendarPermission = "readonly" | "readwrite"

interface CalendarContextType {
  events: CalendarEvent[]
  isConnected: boolean
  isLoading: boolean
  error: string | null
  userInfo: UserInfo | null
  calendarProvider: CalendarProvider
  calendarPermission: CalendarPermission | null
  canWriteEvents: boolean
  fetchEvents: (startDate: Date, endDate: Date) => Promise<void>
  connectGoogle: (permission?: CalendarPermission) => void
  disconnect: () => Promise<void>
  checkConnectionStatus: () => Promise<void>
  getEventsForDate: (date: Date) => CalendarEvent[]
  extractAndAddEvents: (text: string) => Promise<ExtractedEvent[]>
  addEventToCalendar: (event: ExtractedEvent) => Promise<boolean>
  deleteEvent: (eventId: string) => Promise<boolean>
  pendingEvents: ExtractedEvent[]
  clearPendingEvents: () => void
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined)

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingEvents, setPendingEvents] = useState<ExtractedEvent[]>([])
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [calendarProvider, setCalendarProvider] = useState<CalendarProvider>("none")
  const [calendarPermission, setCalendarPermission] = useState<CalendarPermission | null>(null)
  const { user } = useAuth()
  const initialCheckDone = useRef(false)
  const fetchingEvents = useRef(false)

  const canWriteEvents = calendarPermission === "readwrite"

  const checkConnectionStatus = useCallback(async () => {
    try {
      // Always check the API for actual Google Calendar tokens
      const response = await fetch("/api/auth/google/status")
      if (!response.ok) {
        setIsConnected(false)
        setCalendarProvider("none")
        return
      }

      const data = await response.json()

      if (data.connected) {
        setIsConnected(true)
        setCalendarProvider("google")
        setUserInfo(data.userInfo || null)
        setCalendarPermission(data.permission || "readonly")
        initialCheckDone.current = true
      } else {
        setIsConnected(false)
        setCalendarProvider("none")
        setCalendarPermission(null)
        setUserInfo(null)
      }
    } catch (err) {
      console.error("Failed to check connection status:", err)
      setIsConnected(false)
      setCalendarProvider("none")
    }
  }, [])

  useEffect(() => {
    if (user && user.provider !== "guest" && !initialCheckDone.current) {
      checkConnectionStatus()
    } else if (!user || user.provider === "guest") {
      // Reset state when no user
      setIsConnected(false)
      setCalendarProvider("none")
      setCalendarPermission(null)
      setEvents([])
      setUserInfo(null)
      initialCheckDone.current = false
      fetchingEvents.current = false
    }
  }, [user, checkConnectionStatus])

  useEffect(() => {
    if (isConnected && !fetchingEvents.current && events.length === 0) {
      fetchingEvents.current = true
      const now = new Date()
      const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const futureDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)

      fetch(`/api/calendar/events?timeMin=${pastDate.toISOString()}&timeMax=${futureDate.toISOString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.events) {
            setEvents(data.events.map((e: CalendarEvent) => ({ ...e, source: "google" })))
          }
        })
        .catch(console.error)
        .finally(() => {
          fetchingEvents.current = false
        })
    }
  }, [isConnected, events.length])

  const fetchEvents = useCallback(
    async (startDate: Date, endDate: Date) => {
      if (!isConnected) return

      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
        })

        const response = await fetch(`/api/calendar/events?${params}`)
        const data = await response.json()

        if (response.ok) {
          setEvents((data.events || []).map((e: CalendarEvent) => ({ ...e, source: "google" })))
        } else if (response.status === 401) {
          setIsConnected(false)
          setCalendarProvider("none")
          setCalendarPermission(null)
          setEvents([])
        } else {
          setError(data.error || "Failed to fetch events")
        }
      } catch (err) {
        console.error("Failed to fetch events:", err)
        setError("Failed to fetch events")
      } finally {
        setIsLoading(false)
      }
    },
    [isConnected],
  )

  const connectGoogle = useCallback(async (permission: CalendarPermission = "readwrite") => {
    try {
      const response = await fetch(`/api/auth/google?permission=${permission}`)
      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (err) {
      console.error("Failed to connect to Google:", err)
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await fetch("/api/auth/google/disconnect", { method: "POST" })
      setIsConnected(false)
      setCalendarProvider("none")
      setCalendarPermission(null)
      setEvents([])
      setUserInfo(null)
      initialCheckDone.current = false
      fetchingEvents.current = false
    } catch (err) {
      console.error("Failed to disconnect:", err)
    }
  }, [])

  const getEventsForDate = useCallback(
    (date: Date) => {
      const dateStr = date.toISOString().split("T")[0]
      return events.filter((event) => {
        const eventDate = event.start.dateTime
          ? new Date(event.start.dateTime).toISOString().split("T")[0]
          : event.start.date
        return eventDate === dateStr
      })
    },
    [events],
  )

  const extractAndAddEvents = useCallback(
    async (text: string): Promise<ExtractedEvent[]> => {
      if (!isConnected || !canWriteEvents) return []

      try {
        const currentDate = new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        const response = await fetch("/api/extract-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, currentDate }),
        })

        if (!response.ok) return []

        const data = await response.json()
        const extractedEvents: ExtractedEvent[] = data.events || []

        if (extractedEvents.length > 0) {
          for (const event of extractedEvents) {
            await addEventToCalendar(event)
          }

          const now = new Date()
          const futureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
          await fetchEvents(now, futureDate)
        }

        return extractedEvents
      } catch (error) {
        console.error("Error extracting events:", error)
        return []
      }
    },
    [isConnected, canWriteEvents, fetchEvents],
  )

  const addEventToCalendar = useCallback(
    async (event: ExtractedEvent): Promise<boolean> => {
      if (!isConnected || !canWriteEvents) return false

      try {
        const response = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        })

        return response.ok
      } catch (error) {
        console.error("Error adding event to calendar:", error)
        return false
      }
    },
    [isConnected, canWriteEvents],
  )

  const deleteEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      if (!isConnected || !canWriteEvents) return false

      try {
        const response = await fetch(`/api/calendar/events/${eventId}`, { method: "DELETE" })

        if (response.ok) {
          setEvents((prev) => prev.filter((e) => e.id !== eventId))
          return true
        }
        return false
      } catch (error) {
        console.error("Error deleting event:", error)
        return false
      }
    },
    [isConnected, canWriteEvents],
  )

  const clearPendingEvents = useCallback(() => {
    setPendingEvents([])
  }, [])

  return (
    <CalendarContext.Provider
      value={{
        events,
        isConnected,
        isLoading,
        error,
        userInfo,
        calendarProvider,
        calendarPermission,
        canWriteEvents,
        fetchEvents,
        connectGoogle,
        disconnect,
        checkConnectionStatus,
        getEventsForDate,
        extractAndAddEvents,
        addEventToCalendar,
        deleteEvent,
        pendingEvents,
        clearPendingEvents,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (context === undefined) {
    throw new Error("useCalendar must be used within a CalendarProvider")
  }
  return context
}
