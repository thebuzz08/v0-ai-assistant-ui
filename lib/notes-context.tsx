"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"

export interface TranscriptSegment {
  text: string
  startIndex: number
  endIndex: number
}

export interface SupportingPoint {
  text: string
  transcriptRefs: number[]
}

export interface MainIdea {
  title: string
  bulletPoints: SupportingPoint[]
}

export interface ActionItem {
  text: string
  transcriptRefs: number[]
  completed?: boolean
}

export interface Note {
  id: string
  title: string
  date: string
  timestamp: number
  duration: string
  durationSeconds: number
  transcript: string
  transcriptSegments: TranscriptSegment[]
  mainIdeas: MainIdea[]
  actionItems: ActionItem[]
  tags?: string[]
  summary?: string // Added summary field for context
}

interface NotesContextType {
  notes: Note[]
  isRecording: boolean
  recordingDuration: number
  recordingTranscript: string
  recordingStartTime: number | null // Track when recording started
  startRecording: () => Promise<void>
  stopRecording: () => void
  generateNotes: () => Promise<Note | null>
  isGeneratingNotes: boolean
  deleteNote: (id: string) => void
  getNoteById: (id: string) => Note | undefined
  getNotesForDate: (date: Date) => Note[]
  toggleActionItem: (noteId: string, actionIndex: number) => void
  onNotesGenerated?: (transcript: string) => void
  setOnNotesGenerated: (callback: ((transcript: string) => void) | undefined) => void
  getRecentNotes: () => Array<{ title: string; date: string; summary: string }> // For AI context
}

const NotesContext = createContext<NotesContextType | null>(null)

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingTranscript, setRecordingTranscript] = useState("")
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false)
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null) //

  const recognitionRef = useRef<any>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef("")
  const isRecordingRef = useRef(false)
  const onNotesGeneratedRef = useRef<((transcript: string) => void) | undefined>(undefined)
  const recordingStartTimeRef = useRef<number | null>(null) //

  const setOnNotesGenerated = useCallback((callback: ((transcript: string) => void) | undefined) => {
    onNotesGeneratedRef.current = callback
  }, [])

  const getRecentNotes = useCallback(() => {
    return notes.slice(0, 5).map((note) => ({
      title: note.title,
      date: note.date,
      summary: note.summary || note.mainIdeas.map((idea) => idea.title).join(", "),
    }))
  }, [notes])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const startTime = Date.now() // Track start time
      recordingStartTimeRef.current = startTime
      setRecordingStartTime(startTime)

      setRecordingDuration(0)
      setRecordingTranscript("")
      transcriptRef.current = ""
      isRecordingRef.current = true

      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-US"

        recognition.onresult = (event: any) => {
          let fullTranscript = ""
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + " "
          }
          transcriptRef.current = fullTranscript.trim()
          setRecordingTranscript(fullTranscript.trim())
        }

        recognition.onerror = (event: any) => {
          if (event.error !== "aborted" && event.error !== "no-speech") {
            console.log("[v0] Notes recording error:", event.error)
          }
        }

        recognition.onend = () => {
          if (isRecordingRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch {
              // Ignore
            }
          }
        }

        recognitionRef.current = recognition
        recognition.start()
      }

      setIsRecording(true)
    } catch (error) {
      console.log("[v0] Failed to start notes recording:", error)
    }
  }, [])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    isRecordingRef.current = false

    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
  }, [])

  const generateNotes = useCallback(async (): Promise<Note | null> => {
    if (!transcriptRef.current || transcriptRef.current.length < 20) {
      console.log("[v0] Transcript too short to generate notes")
      return null
    }

    setIsGeneratingNotes(true)

    try {
      const response = await fetch("/api/generate-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptRef.current,
          duration: recordingDuration,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate notes")
      }

      const data = await response.json()
      const now = new Date()
      const startTime = recordingStartTimeRef.current || now.getTime()

      const topicTitles = data.mainIdeas ? data.mainIdeas.map((idea: MainIdea) => idea.title) : []
      const summary = topicTitles.slice(0, 3).join(", ") + (topicTitles.length > 3 ? "..." : "")

      const newNote: Note = {
        id: Date.now().toString(),
        title: data.title || "Untitled Recording",
        date: now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        timestamp: startTime,
        duration: formatDuration(recordingDuration),
        durationSeconds: recordingDuration,
        transcript: transcriptRef.current,
        transcriptSegments: data.transcriptSegments || [],
        mainIdeas: data.mainIdeas || [],
        actionItems: (data.actionItems || []).map((item: any) => ({
          ...item,
          completed: false,
        })),
        tags: data.tags || [],
        summary,
      }

      setNotes((prev) => [newNote, ...prev])

      try {
        const startDate = new Date(startTime)

        const localDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`
        const localTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

        await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Notes: ${summary || data.title || "Recording"}`,
            date: localDate,
            time: localTime,
            timezone: userTimezone,
            duration: Math.max(Math.ceil(recordingDuration / 60), 1),
            description: `Recording Summary:\n${summary}\n\nTopics Discussed:\n${topicTitles.map((t: string) => `• ${t}`).join("\n")}\n\nDuration: ${formatDuration(recordingDuration)}`,
          }),
        })
        console.log("[v0] Added note session to calendar at", localDate, localTime, userTimezone)
      } catch (calendarError) {
        console.log("[v0] Failed to add note to calendar:", calendarError)
      }

      try {
        const extractResponse = await fetch("/api/extract-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: transcriptRef.current,
            currentDateTime: new Date().toISOString(),
          }),
        })

        if (extractResponse.ok) {
          const extractData = await extractResponse.json()
          if (extractData.eventsAdded > 0) {
            console.log(`[v0] AI extracted and added ${extractData.eventsAdded} events from notes`)
          }
        }
      } catch (extractError) {
        console.log("[v0] Failed to extract events from notes:", extractError)
      }

      if (onNotesGeneratedRef.current) {
        onNotesGeneratedRef.current(transcriptRef.current)
      }

      setRecordingTranscript("")
      setRecordingDuration(0)
      setRecordingStartTime(null)
      recordingStartTimeRef.current = null
      transcriptRef.current = ""

      return newNote
    } catch (error) {
      console.error("[v0] Error generating notes:", error)
      return null
    } finally {
      setIsGeneratingNotes(false)
    }
  }, [recordingDuration])

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id))
  }, [])

  const getNoteById = useCallback(
    (id: string) => {
      return notes.find((note) => note.id === id)
    },
    [notes],
  )

  const getNotesForDate = useCallback(
    (date: Date) => {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000

      return notes.filter((note) => note.timestamp >= startOfDay && note.timestamp < endOfDay)
    },
    [notes],
  )

  const toggleActionItem = useCallback((noteId: string, actionIndex: number) => {
    setNotes((prev) =>
      prev.map((note) => {
        if (note.id === noteId) {
          const newActionItems = [...note.actionItems]
          newActionItems[actionIndex] = {
            ...newActionItems[actionIndex],
            completed: !newActionItems[actionIndex].completed,
          }
          return { ...note, actionItems: newActionItems }
        }
        return note
      }),
    )
  }, [])

  return (
    <NotesContext.Provider
      value={{
        notes,
        isRecording,
        recordingDuration,
        recordingTranscript,
        recordingStartTime,
        startRecording,
        stopRecording,
        generateNotes,
        isGeneratingNotes,
        deleteNote,
        getNoteById,
        getNotesForDate,
        toggleActionItem,
        setOnNotesGenerated,
        getRecentNotes,
      }}
    >
      {children}
    </NotesContext.Provider>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

export function useNotes() {
  const context = useContext(NotesContext)
  if (!context) {
    throw new Error("useNotes must be used within a NotesProvider")
  }
  return context
}
