"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { useNotes } from "@/lib/notes-context"
import { useCalendar, type CalendarEvent } from "@/lib/calendar-context"
import { ChevronLeft, ChevronRight, Plus, FileText, Loader2, Calendar, X, Trash2 } from "lucide-react"
import Link from "next/link"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const EVENT_COLORS: Record<string, string> = {
  "1": "bg-[#7986cb]",
  "2": "bg-[#33b679]",
  "3": "bg-[#8e24aa]",
  "4": "bg-[#e67c73]",
  "5": "bg-[#f6c026]",
  "6": "bg-[#f5511d]",
  "7": "bg-[#039be5]",
  "8": "bg-[#616161]",
  "9": "bg-[#3f51b5]",
  "10": "bg-[#0b8043]",
  "11": "bg-[#d60000]",
  default: "bg-[var(--apple-blue)]",
}

function getEventColor(colorId?: string): string {
  return EVENT_COLORS[colorId || "default"] || EVENT_COLORS.default
}

function formatEventTime(event: CalendarEvent): string {
  if (event.start.dateTime) {
    const date = new Date(event.start.dateTime)
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  }
  return "All day"
}

function getEventDuration(event: CalendarEvent): number {
  if (event.start.dateTime && event.end.dateTime) {
    const start = new Date(event.start.dateTime)
    const end = new Date(event.end.dateTime)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  }
  return 0
}

export default function SchedulePage() {
  const today = new Date()
  const router = useRouter()
  const { notes, getNotesForDate } = useNotes()
  const { events: calendarEvents, isConnected, isLoading, fetchEvents, getEventsForDate } = useCalendar()

  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDay, setSelectedDay] = useState(today.getDate())

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    duration: 60,
    description: "",
  })

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

  useEffect(() => {
    if (isConnected) {
      const startDate = new Date(currentYear, currentMonth, 1)
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
      fetchEvents(startDate, endDate)
    }
  }, [currentMonth, currentYear, isConnected, fetchEvents])

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const selectedDate = new Date(currentYear, currentMonth, selectedDay)
  const selectedEvents = getEventsForDate(selectedDate)
  const selectedNotes = getNotesForDate(selectedDate)

  const isToday = (day: number) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
  }

  const hasEvents = (day: number) => {
    const date = new Date(currentYear, currentMonth, day)
    return getEventsForDate(date).length > 0
  }

  const hasNotes = (day: number) => {
    const date = new Date(currentYear, currentMonth, day)
    return getNotesForDate(date).length > 0
  }

  const handleNoteClick = (noteId: string) => {
    router.push(`/notes?id=${noteId}`)
  }

  const handleOpenAddModal = () => {
    const selectedDate = new Date(currentYear, currentMonth, selectedDay)
    setNewEvent({
      title: "",
      date: selectedDate.toISOString().split("T")[0],
      time: "09:00",
      duration: 60,
      description: "",
    })
    setShowAddModal(true)
  }

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEvent.title,
          date: newEvent.date,
          time: newEvent.time || null,
          duration: newEvent.duration,
          description: newEvent.description,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      if (response.ok) {
        setShowAddModal(false)
        const startDate = new Date(currentYear, currentMonth, 1)
        const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        await fetchEvents(startDate, endDate)
      }
    } catch (error) {
      console.error("Failed to create event:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/calendar/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: selectedEvent.id }),
      })

      if (response.ok) {
        setShowEventModal(false)
        setSelectedEvent(null)
        const startDate = new Date(currentYear, currentMonth, 1)
        const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        await fetchEvents(startDate, endDate)
      }
    } catch (error) {
      console.error("Failed to delete event:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen pb-24 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom, var(--gradient-start) 0%, var(--gradient-start) 10%, var(--gradient-end) 35%, var(--gradient-end) 100%)`,
        }}
      />

      {/* Header */}
      <header className="pt-14 px-6 pb-2 flex items-center justify-between relative z-10">
        <h1 className="text-3xl font-bold text-white drop-shadow-sm">Schedule</h1>
        <button
          onClick={handleOpenAddModal}
          disabled={!isConnected}
          className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center disabled:opacity-50 border border-white/40"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </header>

      <div className="px-6 relative z-10">
        <div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm mb-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {MONTHS[currentMonth]} {currentYear}
              </h2>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            <button
              onClick={nextMonth}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const selected = day === selectedDay
              const todayDay = isToday(day)
              const hasEvent = hasEvents(day)
              const hasNote = hasNotes(day)

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-full flex flex-col items-center justify-center text-sm font-medium transition-all relative ${
                    selected
                      ? "bg-[var(--apple-blue)] text-white"
                      : todayDay
                        ? "bg-[var(--apple-blue)]/20 text-[var(--apple-blue)]"
                        : "text-foreground hover:bg-muted"
                  }`}
                >
                  {day}
                  {(hasEvent || hasNote) && !selected && (
                    <div className="absolute bottom-1 flex gap-0.5">
                      {hasEvent && <div className="w-1 h-1 rounded-full bg-[var(--apple-blue)]" />}
                      {hasNote && <div className="w-1 h-1 rounded-full bg-[var(--apple-orange)]" />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-[var(--apple-blue)]" />
              Events
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-[var(--apple-orange)]" />
              Notes
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              {selectedDay === today.getDate() && currentMonth === today.getMonth()
                ? "Today"
                : `${MONTHS[currentMonth]} ${selectedDay}`}
            </h2>
          </div>

          <div className="p-4 space-y-3 min-h-[200px]">
            {/* Notes Section */}
            {selectedNotes.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                <div className="space-y-2">
                  {selectedNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 bg-muted/50 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => handleNoteClick(note.id)}
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--apple-orange)]/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[var(--apple-orange)]" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground text-sm">{note.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {note.duration} · {note.mainIdeas?.length || 0} topics
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events Section */}
            {!isConnected ? (
              <Link href="/settings" className="block">
                <div className="p-6 text-center bg-muted/30 rounded-xl">
                  <Calendar className="w-10 h-10 text-[var(--apple-blue)] mx-auto mb-2" />
                  <p className="text-foreground font-medium text-sm mb-1">Connect Google Calendar</p>
                  <p className="text-muted-foreground text-xs">Tap to sync your schedule</p>
                </div>
              </Link>
            ) : selectedEvents.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Events</h3>
                {selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-muted/50 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className={`w-1 h-12 rounded-full ${getEventColor(event.colorId)}`} />
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground text-sm">{event.summary}</h3>
                      <p className="text-xs text-muted-foreground">
                        {formatEventTime(event)}
                        {getEventDuration(event) > 0 && ` · ${getEventDuration(event)} min`}
                      </p>
                      {event.location && <p className="text-xs text-muted-foreground truncate">{event.location}</p>}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : selectedNotes.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-muted-foreground text-sm">No events or notes</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white dark:bg-card w-full max-w-lg rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">New Event</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Event title"
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[var(--apple-blue)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Date</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground outline-none focus:ring-2 focus:ring-[var(--apple-blue)]"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Time</label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-muted text-foreground outline-none focus:ring-2 focus:ring-[var(--apple-blue)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Duration (minutes)</label>
                <select
                  value={newEvent.duration}
                  onChange={(e) => setNewEvent({ ...newEvent, duration: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground outline-none focus:ring-2 focus:ring-[var(--apple-blue)]"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Description (optional)</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Add description..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[var(--apple-blue)] resize-none"
                />
              </div>

              <button
                onClick={handleCreateEvent}
                disabled={!newEvent.title.trim() || isSubmitting}
                className="w-full py-3 rounded-xl bg-[var(--apple-blue)] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Event"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white dark:bg-card w-full max-w-lg rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Event Details</h2>
              <button
                onClick={() => {
                  setShowEventModal(false)
                  setSelectedEvent(null)
                }}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-1 h-16 rounded-full ${getEventColor(selectedEvent.colorId)}`} />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">{selectedEvent.summary}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatEventTime(selectedEvent)}
                    {getEventDuration(selectedEvent) > 0 && ` · ${getEventDuration(selectedEvent)} min`}
                  </p>
                  {selectedEvent.location && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedEvent.location}</p>
                  )}
                  {selectedEvent.description && (
                    <p className="text-sm text-foreground mt-3">{selectedEvent.description}</p>
                  )}
                </div>
              </div>

              <button
                onClick={handleDeleteEvent}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-destructive/10 text-destructive font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Delete Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  )
}
