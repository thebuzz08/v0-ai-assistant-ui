"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { useNotes } from "@/lib/notes-context"
import { useCalendar, type CalendarEvent } from "@/lib/calendar-context"
import { useAuth } from "@/lib/auth-context"
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
  const { user } = useAuth()
  const { notes, getNotesForDate } = useNotes()
  const { events: calendarEvents, isConnected, isLoading, fetchEvents, getEventsForDate, connectGoogle } = useCalendar()

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

  // Check if user is email-only (needs to manually connect calendar)
  const isEmailUser = user?.provider === "email"

  const isSelected = false // Declare the variable here

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

  const handleDayClick = (day: number) => {
    setSelectedDay(day)
  }

  const selectedDate = new Date(currentYear, currentMonth, selectedDay)
  const dayEvents = getEventsForDate(selectedDate)
  const dayNotes = getNotesForDate(selectedDate)

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date) return
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      })

      if (response.ok) {
        setShowAddModal(false)
        setNewEvent({ title: "", date: "", time: "", duration: 60, description: "" })
        const startDate = new Date(currentYear, currentMonth, 1)
        const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        fetchEvents(startDate, endDate)
      }
    } catch (error) {
      console.error("Failed to add event:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await fetch("/api/calendar/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      })

      if (response.ok) {
        setShowEventModal(false)
        setSelectedEvent(null)
        const startDate = new Date(currentYear, currentMonth, 1)
        const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        fetchEvents(startDate, endDate)
      }
    } catch (error) {
      console.error("Failed to delete event:", error)
    }
  }

  const handleConnectCalendar = () => {
    connectGoogle("readwrite")
  }

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom, var(--gradient-start) 0%, var(--gradient-start) 15%, var(--gradient-end) 45%, var(--gradient-end) 100%)`,
        }}
      />

      {/* Relative z-10 positioning to keep content above gradient background */}
      <div className="relative z-10">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between p-4">
            <button onClick={prevMonth} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl font-semibold text-white">
              {MONTHS[currentMonth]} {currentYear}
            </h1>
            <button onClick={nextMonth} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 px-2 pb-2">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-white/70">
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Calendar grid */}
        <div className="px-2">
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before the first of the month */}
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1
              const date = new Date(currentYear, currentMonth, day)
              const isToday =
                day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
              const events = getEventsForDate(date)
              const hasEvents = events.length > 0

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${
                    day === selectedDay
                      ? "bg-[#1a7f7f] text-white shadow-lg scale-105"
                      : isToday
                        ? "bg-white/60 text-[#1a7f7f] font-bold"
                        : "hover:bg-white/40 text-gray-700"
                  }`}
                >
                  <span className="text-sm">{day}</span>
                  {hasEvents && (
                    <div className="flex gap-0.5 mt-0.5">
                      {events.slice(0, 3).map((event, i) => (
                        <div
                          key={i}
                          className={`w-1 h-1 rounded-full ${day === selectedDay ? "bg-white/80" : getEventColor(event.colorId)}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day events */}
        <div className="mt-4 px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </h2>
            {isConnected && (
              <button
                onClick={() => {
                  setNewEvent({
                    ...newEvent,
                    date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`,
                  })
                  setShowAddModal(true)
                }}
                className="p-2 bg-[#1a7f7f] text-white rounded-full hover:bg-[#15696a] transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#1a7f7f]" />
            </div>
          ) : dayEvents.length > 0 || dayNotes.length > 0 ? (
            <div className="space-y-2">
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => {
                    setSelectedEvent(event)
                    setShowEventModal(true)
                  }}
                  className="w-full text-left bg-white/80 backdrop-blur-sm rounded-xl p-3 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-1 h-full min-h-[40px] rounded-full ${event.colorId === selectedDay ? "bg-white/80" : getEventColor(event.colorId)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{event.summary}</p>
                      <p className="text-sm text-gray-500">{formatEventTime(event)}</p>
                      {event.location && <p className="text-xs text-gray-400 truncate mt-1">{event.location}</p>}
                    </div>
                  </div>
                </button>
              ))}
              {dayNotes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block bg-white/80 backdrop-blur-sm rounded-xl p-3 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-[#1a7f7f] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{note.title}</p>
                      <p className="text-sm text-gray-500 line-clamp-2">{note.content}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No events for this day</p>
            </div>
          )}
        </div>

        {/* Connect Calendar Banner - Only show for email users who haven't connected */}
        {!isConnected && isEmailUser && (
          <div className="fixed bottom-20 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1a7f7f]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-[#1a7f7f]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">Connect Google Calendar</p>
                <p className="text-sm text-gray-500">
                  Sync your events and let the assistant help manage your schedule
                </p>
              </div>
              <button
                onClick={handleConnectCalendar}
                className="px-4 py-2 bg-[#1a7f7f] text-white text-sm font-medium rounded-lg hover:bg-[#15696a] transition-colors flex-shrink-0"
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {/* Add Event Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
            <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">New Event</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a7f7f]"
                    placeholder="Event title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a7f7f]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a7f7f]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <select
                    value={newEvent.duration}
                    onChange={(e) => setNewEvent({ ...newEvent, duration: Number.parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a7f7f]"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a7f7f] resize-none"
                    rows={3}
                    placeholder="Add description..."
                  />
                </div>

                <button
                  onClick={handleAddEvent}
                  disabled={!newEvent.title || !newEvent.date || isSubmitting}
                  className="w-full py-4 bg-[#1a7f7f] text-white font-semibold rounded-xl hover:bg-[#15696a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Event"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Detail Modal */}
        {showEventModal && selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
            <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Event Details</h2>
                <button onClick={() => setShowEventModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`w-1 h-full min-h-[60px] rounded-full ${getEventColor(selectedEvent.colorId)}`} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{selectedEvent.summary}</h3>
                    <p className="text-gray-500">
                      {formatEventTime(selectedEvent)}
                      {getEventDuration(selectedEvent) > 0 && ` (${getEventDuration(selectedEvent)} min)`}
                    </p>
                  </div>
                </div>

                {selectedEvent.location && (
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="text-gray-800">{selectedEvent.location}</p>
                  </div>
                )}

                {selectedEvent.description && (
                  <div>
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="text-gray-800">{selectedEvent.description}</p>
                  </div>
                )}

                <button
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="w-full py-3 bg-red-50 text-red-500 font-medium rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Delete Event
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
