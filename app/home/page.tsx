"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import {
  Volume2,
  MessageSquare,
  Play,
  Pause,
  Settings2,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  Mic,
  Calendar,
  FileText,
  Plus,
  Minus,
  GripVertical,
  Square,
} from "lucide-react"
import { useMicrophone } from "@/lib/microphone-context"
import { useRealtimeVoice } from "@/lib/realtime-voice-context"
import { useCalendar } from "@/lib/calendar-context"
import { useNotes } from "@/lib/notes-context"
import { useAuth } from "@/lib/auth-context"

type WidgetType = "transcript" | "instructions" | "calendar" | "notes"

const WIDGET_CONFIG: Record<WidgetType, { label: string; icon: typeof MessageSquare }> = {
  transcript: { label: "Live Transcript", icon: MessageSquare },
  instructions: { label: "Custom Instructions", icon: Settings2 },
  calendar: { label: "Calendar", icon: Calendar },
  notes: { label: "Quick Note", icon: FileText },
}

const DEFAULT_WIDGETS: WidgetType[] = ["transcript", "instructions"]

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()

  const {
    isListening: isListeningStandard,
    startListening: startListeningStandard,
    stopListening: stopListeningStandard,
    setOnConversationComplete,
    setNotesContext,
    setCalendarContext,
    transcript: transcriptStandard,
    interimTranscript,
    currentParagraph,
    isProcessing,
    isSpeaking: isSpeakingStandard,
    customInstructions: customInstructionsStandard,
    setCustomInstructions: setCustomInstructionsStandard,
  } = useMicrophone()

  const {
    isConnected: isRealtimeConnected,
    isListening: isListeningRealtime,
    audioLevel: audioLevelRealtime,
    connect: connectRealtime,
    disconnect: disconnectRealtime,
    transcript: transcriptRealtime,
    isSpeaking: isSpeakingRealtime,
    customInstructions: customInstructionsRealtime,
    setCustomInstructions: setCustomInstructionsRealtime,
  } = useRealtimeVoice()

  const { isConnected, events, fetchEvents, userInfo, getEventsForDate, checkConnectionStatus } = useCalendar()
  const { notes, addNote } = useNotes()

  const [useRealtimeMode, setUseRealtimeMode] = useState(false)

  const [showPulse, setShowPulse] = useState(false)
  const transcriptContainerRef = useRef<HTMLDivElement>(null)
  const [showInstructionsModal, setShowInstructionsModal] = useState(false)
  const [instructionsInput, setInstructionsInput] = useState("")
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeWidgets, setActiveWidgets] = useState<WidgetType[]>(DEFAULT_WIDGETS)
  const [showAddDropdown, setShowAddDropdown] = useState(false)

  // Notes recording state
  const [isRecordingNote, setIsRecordingNote] = useState(false)
  const [noteRecordingTime, setNoteRecordingTime] = useState(0)
  const [noteTranscript, setNoteTranscript] = useState("")
  const noteTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Calendar widget state
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date())
  const [showCalendarEvents, setShowCalendarEvents] = useState(false)

  // Drag state
  const [draggedWidget, setDraggedWidget] = useState<WidgetType | null>(null)
  const [dragOverWidget, setDragOverWidget] = useState<WidgetType | null>(null)

  const customInstructions = useRealtimeMode ? customInstructionsRealtime : customInstructionsStandard
  const setCustomInstructions = useRealtimeMode ? setCustomInstructionsRealtime : setCustomInstructionsStandard

  useEffect(() => {
    checkConnectionStatus()
  }, [checkConnectionStatus])

  useEffect(() => {
    const saved = localStorage.getItem("home_widgets")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.every((w) => Object.keys(WIDGET_CONFIG).includes(w))) {
          setActiveWidgets(parsed)
        }
      } catch (e) {
        console.error("Failed to parse saved widgets")
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("home_widgets", JSON.stringify(activeWidgets))
  }, [activeWidgets])

  useEffect(() => {
    if (showInstructionsModal) {
      setInstructionsInput(customInstructions || "")
    }
  }, [showInstructionsModal])

  // Note recording timer
  useEffect(() => {
    if (isRecordingNote) {
      noteTimerRef.current = setInterval(() => {
        setNoteRecordingTime((prev) => prev + 1)
      }, 1000)
    } else {
      if (noteTimerRef.current) {
        clearInterval(noteTimerRef.current)
      }
    }
    return () => {
      if (noteTimerRef.current) {
        clearInterval(noteTimerRef.current)
      }
    }
  }, [isRecordingNote])

  // Capture transcript for notes
  useEffect(() => {
    if (isRecordingNote && (currentParagraph || interimTranscript)) {
      setNoteTranscript((prev) => {
        const newText = (currentParagraph + " " + interimTranscript).trim()
        if (newText && !prev.endsWith(newText)) {
          return (prev + " " + newText).trim()
        }
        return prev
      })
    }
  }, [isRecordingNote, currentParagraph, interimTranscript])

  useEffect(() => {
    if (events && events.length > 0) {
      const formattedEvents = events.map((event) => {
        const startDate = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date || "")
        return {
          title: event.summary || "Untitled",
          date: startDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          time: event.start.dateTime
            ? startDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "All day",
          description: event.description || "",
          id: event.id,
          datetime: event.start.dateTime || event.start.date || "",
        }
      })
      setCalendarContext(formattedEvents)
    }
  }, [events, setCalendarContext])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  const getUserInitials = () => {
    // First try auth context user
    if (user?.name) {
      const names = user.name.split(" ")
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return names[0][0].toUpperCase()
    }
    // Fall back to calendar userInfo
    if (userInfo?.name) {
      const names = userInfo.name.split(" ")
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return userInfo.name[0].toUpperCase()
    }
    // Guest or unknown
    if (user?.provider === "guest") return "G"
    return "?"
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("useRealtimeMode")
      if (saved !== null) {
        setUseRealtimeMode(saved === "true")
      }
    }
  }, [])

  const isListening = useRealtimeMode ? isListeningRealtime : isListeningStandard
  const isSpeaking = useRealtimeMode ? isSpeakingRealtime : isSpeakingStandard
  const transcript = useRealtimeMode ? transcriptRealtime : transcriptStandard

  const handleToggle = async () => {
    if (useRealtimeMode) {
      // Realtime mode
      if (isListeningRealtime) {
        disconnectRealtime()
      } else {
        await connectRealtime()
      }
    } else {
      // Standard mode
      if (isListeningStandard) {
        stopListeningStandard()
      } else {
        await startListeningStandard()
      }
    }
  }

  const getStatusText = () => {
    if (isSpeaking) return "AI speaking..."
    if (useRealtimeMode) {
      if (isRealtimeConnected) return isListeningRealtime ? "Tap to pause" : "Tap to start"
      return "Connecting..."
    }
    if (isProcessing) return "Processing..."
    if (isListeningStandard) return "Tap to pause"
    return "Tap to start listening"
  }

  const handleSaveInstructions = () => {
    setCustomInstructions(instructionsInput)
    setShowInstructionsModal(false)
  }

  const toggleWidget = (widget: WidgetType) => {
    if (activeWidgets.includes(widget)) {
      setActiveWidgets((prev) => prev.filter((w) => w !== widget))
    } else {
      setActiveWidgets((prev) => [...prev, widget])
    }
    setShowAddDropdown(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleStartNoteRecording = async () => {
    setNoteTranscript("")
    setNoteRecordingTime(0)
    setIsRecordingNote(true)
    if (!isListening) {
      await handleToggle()
    }
  }

  const handleStopNoteRecording = async () => {
    setIsRecordingNote(false)
    if (noteTranscript.trim()) {
      await addNote({
        title: `Note ${new Date().toLocaleString()}`,
        content: noteTranscript.trim(),
        tags: ["voice-note"],
      })
    }
    setNoteTranscript("")
    setNoteRecordingTime(0)
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  const selectedDateEvents = getEventsForDate(calendarSelectedDate)

  // Drag handlers
  const handleDragStart = (widget: WidgetType) => {
    setDraggedWidget(widget)
  }

  const handleDragOver = (widget: WidgetType) => {
    if (draggedWidget && draggedWidget !== widget) {
      setDragOverWidget(widget)
    }
  }

  const handleDragEnd = () => {
    if (draggedWidget && dragOverWidget) {
      const newWidgets = [...activeWidgets]
      const draggedIndex = newWidgets.indexOf(draggedWidget)
      const dropIndex = newWidgets.indexOf(dragOverWidget)
      newWidgets.splice(draggedIndex, 1)
      newWidgets.splice(dropIndex, 0, draggedWidget)
      setActiveWidgets(newWidgets)
    }
    setDraggedWidget(null)
    setDragOverWidget(null)
  }

  const recentTranscripts = transcript.slice(-4)

  const renderWidget = (widget: WidgetType) => {
    const isBeingDragged = draggedWidget === widget
    const isDragOver = dragOverWidget === widget

    switch (widget) {
      case "transcript":
        return (
          <div
            key={widget}
            draggable={isEditMode}
            onDragStart={() => handleDragStart(widget)}
            onDragOver={(e) => {
              e.preventDefault()
              handleDragOver(widget)
            }}
            onDragEnd={handleDragEnd}
            onTouchStart={() => isEditMode && handleDragStart(widget)}
            onTouchEnd={handleDragEnd}
            className={`relative transition-all ${isBeingDragged ? "opacity-50 scale-95" : ""} ${isDragOver ? "border-2 border-[var(--apple-blue)] rounded-2xl" : ""}`}
          >
            <button
              onClick={() => !isEditMode && router.push("/live")}
              className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-3 text-left active:scale-[0.98] transition-transform"
            >
              {isEditMode && (
                <div className="absolute -top-2 -left-2 flex gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-zinc-400 flex items-center justify-center cursor-grab">
                    <GripVertical className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
              {isEditMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleWidget(widget)
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center z-10"
                >
                  <Minus className="w-3 h-3 text-white" />
                </button>
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--apple-blue)]" />
                  <span className="text-[var(--apple-blue)] text-sm font-medium">Live Transcript</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
              <div
                ref={transcriptContainerRef}
                className="space-y-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-3 max-h-40 overflow-y-auto"
              >
                {recentTranscripts.length === 0 && !currentParagraph && !interimTranscript ? (
                  <p className="text-sm text-zinc-500 text-center py-2">
                    {isListening ? "Listening... speak to see transcript" : "Tap to view full transcript"}
                  </p>
                ) : (
                  <>
                    {recentTranscripts.map((item, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span
                          className={`text-xs font-medium shrink-0 ${item.speaker === "assistant" ? "text-[var(--apple-blue)]" : "text-zinc-500"}`}
                        >
                          {item.speaker === "assistant" ? "AI:" : "You:"}
                        </span>
                        <p
                          className={`text-sm ${item.speaker === "assistant" ? "text-[var(--apple-blue)]" : "text-zinc-900 dark:text-zinc-100"}`}
                        >
                          {item.text}
                        </p>
                      </div>
                    ))}
                    {(currentParagraph || interimTranscript) && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-zinc-500 shrink-0 flex items-center gap-1">
                          <Mic className="w-3 h-3 animate-pulse" />
                          You:
                        </span>
                        <p className="text-sm text-zinc-900 dark:text-zinc-100">
                          {currentParagraph}
                          {currentParagraph && interimTranscript ? " " : ""}
                          <span className="text-zinc-500">{interimTranscript}</span>
                          <span className="animate-pulse">|</span>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </button>
          </div>
        )

      case "instructions":
        return (
          <div
            key={widget}
            draggable={isEditMode}
            onDragStart={() => handleDragStart(widget)}
            onDragOver={(e) => {
              e.preventDefault()
              handleDragOver(widget)
            }}
            onDragEnd={handleDragEnd}
            className={`relative transition-all ${isBeingDragged ? "opacity-50 scale-95" : ""} ${isDragOver ? "border-2 border-[var(--apple-blue)] rounded-2xl" : ""}`}
          >
            <button
              onClick={() => !isEditMode && setShowInstructionsModal(true)}
              className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-3 flex items-center gap-3 text-left"
            >
              {isEditMode && (
                <div className="absolute -top-2 -left-2 flex gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-zinc-400 flex items-center justify-center cursor-grab">
                    <GripVertical className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
              {isEditMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleWidget(widget)
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center z-10"
                >
                  <Minus className="w-3 h-3 text-white" />
                </button>
              )}
              <div className="w-10 h-10 rounded-xl bg-[var(--apple-blue)]/10 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-[var(--apple-blue)]" />
              </div>
              <div className="flex-1">
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">Custom Instructions</span>
                {customInstructions && (
                  <p className="text-xs text-zinc-500 truncate max-w-[200px]">{customInstructions}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        )

      case "notes":
        return (
          <div
            key={widget}
            draggable={isEditMode}
            onDragStart={() => handleDragStart(widget)}
            onDragOver={(e) => {
              e.preventDefault()
              handleDragOver(widget)
            }}
            onDragEnd={handleDragEnd}
            className={`relative transition-all ${isBeingDragged ? "opacity-50 scale-95" : ""} ${isDragOver ? "border-2 border-[var(--apple-blue)] rounded-2xl" : ""}`}
          >
            <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-3">
              {isEditMode && (
                <div className="absolute -top-2 -left-2 flex gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-zinc-400 flex items-center justify-center cursor-grab">
                    <GripVertical className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
              {isEditMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleWidget(widget)
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center z-10"
                >
                  <Minus className="w-3 h-3 text-white" />
                </button>
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--apple-blue)]" />
                  <span className="text-[var(--apple-blue)] text-sm font-medium">Quick Note</span>
                </div>
                <button onClick={() => router.push("/notes")} className="text-zinc-400">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {isRecordingNote ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatTime(noteRecordingTime)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{noteTranscript || "Listening..."}</p>
                  <button
                    onClick={handleStopNoteRecording}
                    className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center mx-auto active:scale-95 transition-transform"
                  >
                    <Square className="w-6 h-6 text-white fill-white" />
                  </button>
                  <p className="text-xs text-zinc-500 mt-2">Tap to stop & save</p>
                </div>
              ) : (
                <button
                  onClick={handleStartNoteRecording}
                  disabled={isEditMode}
                  className="w-full py-6 flex flex-col items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <div className="w-14 h-14 rounded-full bg-[var(--apple-blue)] flex items-center justify-center">
                    <Mic className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm text-zinc-500">Tap to record a note</p>
                </button>
              )}
            </div>
          </div>
        )

      case "calendar":
        return (
          <div
            key={widget}
            draggable={isEditMode}
            onDragStart={() => handleDragStart(widget)}
            onDragOver={(e) => {
              e.preventDefault()
              handleDragOver(widget)
            }}
            onDragEnd={handleDragEnd}
            className={`relative transition-all ${isBeingDragged ? "opacity-50 scale-95" : ""} ${isDragOver ? "border-2 border-[var(--apple-blue)] rounded-2xl" : ""}`}
          >
            <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-3">
              {isEditMode && (
                <div className="absolute -top-2 -left-2 flex gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-zinc-400 flex items-center justify-center cursor-grab">
                    <GripVertical className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
              {isEditMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleWidget(widget)
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center z-10"
                >
                  <Minus className="w-3 h-3 text-white" />
                </button>
              )}

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--apple-blue)]" />
                  <button
                    onClick={() => setShowCalendarEvents(false)}
                    className="text-[var(--apple-blue)] text-sm font-medium"
                  >
                    {calendarSelectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setCalendarSelectedDate(
                        new Date(calendarSelectedDate.getFullYear(), calendarSelectedDate.getMonth() - 1, 1),
                      )
                    }
                    className="p-1 text-zinc-400"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setCalendarSelectedDate(
                        new Date(calendarSelectedDate.getFullYear(), calendarSelectedDate.getMonth() + 1, 1),
                      )
                    }
                    className="p-1 text-zinc-400"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {!showCalendarEvents ? (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                      <div key={i} className="text-center text-xs text-zinc-500 font-medium py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(calendarSelectedDate).map((day, i) => {
                      if (!day) return <div key={i} />
                      const isToday = day.toDateString() === new Date().toDateString()
                      const isSelected = day.toDateString() === calendarSelectedDate.toDateString()
                      const hasEvents = getEventsForDate(day).length > 0
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setCalendarSelectedDate(day)
                            setShowCalendarEvents(true)
                          }}
                          disabled={isEditMode}
                          className={`aspect-square rounded-full flex items-center justify-center text-sm relative
                            ${isSelected ? "bg-[var(--apple-blue)] text-white" : isToday ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}
                          `}
                        >
                          {day.getDate()}
                          {hasEvents && !isSelected && (
                            <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[var(--apple-blue)]" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                      {calendarSelectedDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </h4>
                    <button onClick={() => router.push("/schedule")} className="text-xs text-[var(--apple-blue)]">
                      View All
                    </button>
                  </div>
                  {selectedDateEvents.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-4 text-center">No events</p>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {selectedDateEvents.map((event) => (
                        <div key={event.id} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{event.summary}</p>
                          {event.start.dateTime && (
                            <p className="text-xs text-zinc-500">
                              {new Date(event.start.dateTime).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const availableWidgets = (Object.keys(WIDGET_CONFIG) as WidgetType[]).filter((w) => !activeWidgets.includes(w))

  if (authLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
      >
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen pb-24 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom, var(--gradient-start) 0%, var(--gradient-start) 15%, var(--gradient-end) 45%, var(--gradient-end) 100%)`,
        }}
      />

      <header className="pt-14 px-6 pb-2 relative z-10 flex items-start justify-between">
        <h1 className="text-3xl font-bold text-white drop-shadow-sm">Summary</h1>
        <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white font-semibold text-sm border border-white/40">
          {getUserInitials()}
        </div>
      </header>

      <div className="px-6 relative z-10">
        <div className="flex items-center justify-between mb-3 mt-2">
          <h2 className="text-lg font-semibold text-white/90">Pinned</h2>
          <button onClick={() => setIsEditMode(!isEditMode)} className="text-white/90 text-sm font-medium">
            {isEditMode ? "Done" : "Edit"}
          </button>
        </div>

        {/* Audio widget - always shown, not editable */}
        <button
          onClick={handleToggle}
          className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm mb-3 text-left active:scale-[0.98] transition-transform"
        >
          {/* ... existing audio widget content ... */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[var(--apple-blue)]" />
              <span className="text-[var(--apple-blue)] text-sm font-medium">Audio</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-[var(--apple-blue)]/10 flex items-center justify-center">
              {isListening ? (
                <Pause className="w-3 h-3 text-[var(--apple-blue)]" />
              ) : (
                <Play className="w-3 h-3 text-[var(--apple-blue)] ml-0.5" />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {isListening ? "Playing" : "Paused"}
              </h3>
              <p className="text-sm text-zinc-500 flex items-center gap-1">
                {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                {getStatusText()}
              </p>
            </div>
            <div className="flex items-end gap-[3px] h-12">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="w-[6px] rounded-full transition-all duration-300"
                  style={{
                    height: isListening ? "100%" : "20%",
                    background: isListening ? `linear-gradient(to top, var(--apple-blue), #60a5fa)` : "#d1d5db",
                    animation: isListening ? `waveformBounce 0.8s ease-in-out infinite` : "none",
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </button>

        {activeWidgets.map((widget) => renderWidget(widget))}

        {availableWidgets.length > 0 && (
          <div className="relative flex justify-center mt-4">
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="w-12 h-12 rounded-full bg-[var(--apple-blue)] flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6 text-white" />
            </button>

            {showAddDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg overflow-hidden z-20">
                {availableWidgets.map((widget) => {
                  const config = WIDGET_CONFIG[widget]
                  const Icon = config.icon
                  return (
                    <button
                      key={widget}
                      onClick={() => toggleWidget(widget)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 last:border-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[var(--apple-blue)]/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-[var(--apple-blue)]" />
                      </div>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium">{config.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowInstructionsModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 animate-slide-up shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Custom Instructions</h2>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Add custom instructions for the AI to follow. These will be included in every response.
            </p>
            <textarea
              value={instructionsInput}
              onChange={(e) => setInstructionsInput(e.target.value)}
              placeholder="e.g., Always respond in a friendly tone. Call me by my name, Alex. Focus on productivity tips..."
              className="w-full h-40 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--apple-blue)]"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setInstructionsInput("")
                  setCustomInstructions("")
                  setShowInstructionsModal(false)
                }}
                className="flex-1 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium"
              >
                Clear
              </button>
              <button
                onClick={handleSaveInstructions}
                className="flex-1 py-3 rounded-xl bg-[var(--apple-blue)] text-white font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  )
}
