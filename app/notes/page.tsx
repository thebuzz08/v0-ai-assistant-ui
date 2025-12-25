"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { useNotes } from "@/lib/notes-context"
import { useCalendar } from "@/lib/calendar-context"
import { Mic, Square, Loader2, FileText, Clock, ChevronRight, ChevronDown, X, CalendarPlus } from "lucide-react"

function NotesContent() {
  const searchParams = useSearchParams()
  const noteIdFromUrl = searchParams.get("id")

  const {
    notes,
    isRecording,
    recordingDuration,
    recordingTranscript,
    startRecording,
    stopRecording,
    generateNotes,
    isGeneratingNotes,
    toggleActionItem,
  } = useNotes()

  const { extractAndCreateEvents, isConnected: isCalendarConnected } = useCalendar()

  const [selectedNote, setSelectedNote] = useState<string | null>(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [expandedIdeas, setExpandedIdeas] = useState<Set<number>>(new Set([0]))
  const [highlightedSegments, setHighlightedSegments] = useState<number[]>([])
  const [showTranscriptModal, setShowTranscriptModal] = useState(false)
  const [isExtractingEvents, setIsExtractingEvents] = useState(false)
  const [extractedEventsCount, setExtractedEventsCount] = useState<number | null>(null)

  useEffect(() => {
    if (noteIdFromUrl) {
      setSelectedNote(noteIdFromUrl)
      setExpandedIdeas(new Set([0]))
    }
  }, [noteIdFromUrl])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleStopAndGenerate = async () => {
    stopRecording()
    const note = await generateNotes()
    if (note) {
      setShowRecorder(false)
      setSelectedNote(note.id)

      if (isCalendarConnected && note.transcript) {
        setIsExtractingEvents(true)
        try {
          const count = await extractAndCreateEvents(note.transcript)
          setExtractedEventsCount(count)
          setTimeout(() => setExtractedEventsCount(null), 3000)
        } catch (error) {
          console.error("Failed to extract events:", error)
        } finally {
          setIsExtractingEvents(false)
        }
      }
    }
  }

  const toggleIdea = (index: number) => {
    setExpandedIdeas((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handlePointClick = (refs: number[]) => {
    setHighlightedSegments(refs)
    setShowTranscriptModal(true)
  }

  const handleBackToNotes = () => {
    setSelectedNote(null)
    setHighlightedSegments([])
    window.history.replaceState({}, "", "/notes")
  }

  const currentNote = notes.find((n) => n.id === selectedNote)

  return (
    <main className="min-h-screen pb-24 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom, var(--gradient-start) 0%, var(--gradient-start) 15%, var(--gradient-end) 45%, var(--gradient-end) 100%)`,
        }}
      />

      <header className="pt-14 px-6 pb-6 relative z-10">
        <h1 className="text-3xl font-bold text-white drop-shadow-sm">Notes</h1>
        <p className="text-white/80">Record and summarize conversations</p>
      </header>

      <div className="px-6 space-y-4 relative z-10">
        {/* Record Button */}
        {!showRecorder && !selectedNote && (
          <button
            onClick={() => setShowRecorder(true)}
            className="w-full py-4 rounded-2xl bg-[var(--apple-blue)] text-white font-semibold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity shadow-sm"
          >
            <Mic className="w-5 h-5" />
            New Recording
          </button>
        )}

        {/* Recording Interface */}
        {showRecorder && (
          <div className="bg-white dark:bg-card rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground"}`}
                />
                <span className="text-lg font-semibold text-foreground">
                  {isRecording ? "Recording..." : isGeneratingNotes ? "Generating Notes..." : "Ready to Record"}
                </span>
              </div>
              <span className="text-2xl font-mono text-foreground">{formatDuration(recordingDuration)}</span>
            </div>

            {recordingTranscript && (
              <div className="max-h-40 overflow-y-auto p-3 rounded-xl bg-muted">
                <p className="text-sm text-muted-foreground">{recordingTranscript}</p>
              </div>
            )}

            <div className="flex gap-3">
              {!isRecording && !isGeneratingNotes && (
                <>
                  <button
                    onClick={startRecording}
                    className="flex-1 py-3 rounded-xl bg-[var(--apple-blue)] text-white font-semibold flex items-center justify-center gap-2"
                  >
                    <Mic className="w-5 h-5" />
                    Start
                  </button>
                  <button
                    onClick={() => setShowRecorder(false)}
                    className="px-6 py-3 rounded-xl bg-muted text-foreground font-semibold"
                  >
                    Cancel
                  </button>
                </>
              )}

              {isRecording && (
                <button
                  onClick={handleStopAndGenerate}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  Stop & Generate Notes
                </button>
              )}

              {isGeneratingNotes && (
                <div className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-semibold flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Notes...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Note Detail View */}
        {selectedNote && currentNote && (
          <div className="space-y-4">
            <button
              onClick={handleBackToNotes}
              className="text-[var(--apple-blue)] font-medium flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Notes
            </button>

            <div className="bg-white dark:bg-card rounded-2xl p-5 space-y-4 shadow-sm">
              {/* Title */}
              <div>
                <h2 className="text-2xl font-bold text-foreground">{currentNote.title}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{currentNote.date}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {currentNote.duration}
                  </span>
                </div>
              </div>

              {/* Summary */}
              {currentNote.summary && (
                <div className="p-3 rounded-xl bg-[var(--apple-blue)]/10 border border-[var(--apple-blue)]/20">
                  <p className="text-sm text-foreground">{currentNote.summary}</p>
                </div>
              )}

              {/* Tags */}
              {currentNote.tags && currentNote.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentNote.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-[var(--apple-blue)]/10 text-[var(--apple-blue)] text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Main Ideas */}
              {currentNote.mainIdeas && currentNote.mainIdeas.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">Topics</h3>
                  {currentNote.mainIdeas.map((idea, ideaIndex) => (
                    <div key={ideaIndex} className="border border-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleIdea(ideaIndex)}
                        className="w-full p-4 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <h3 className="text-base font-semibold text-foreground text-left">{idea.title}</h3>
                        <ChevronDown
                          className={`w-5 h-5 text-muted-foreground transition-transform ${expandedIdeas.has(ideaIndex) ? "rotate-180" : ""}`}
                        />
                      </button>

                      {expandedIdeas.has(ideaIndex) && (
                        <div className="p-4 pt-2 space-y-2">
                          {idea.bulletPoints.map((point, pointIndex) => (
                            <button
                              key={pointIndex}
                              onClick={() => handlePointClick(point.transcriptRefs)}
                              className="w-full flex items-start gap-3 text-left p-2 rounded-lg hover:bg-muted transition-colors group"
                            >
                              <span className="text-[var(--apple-blue)] mt-0.5">•</span>
                              <span className="text-muted-foreground flex-1">{point.text}</span>
                              {point.transcriptRefs && point.transcriptRefs.length > 0 && (
                                <span className="text-xs text-[var(--apple-blue)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  View source
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Items */}
              {currentNote.actionItems && currentNote.actionItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Action Items</h3>
                  <div className="space-y-2">
                    {currentNote.actionItems.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handlePointClick(item.transcriptRefs)}
                        className="w-full flex items-start gap-3 text-left p-2 rounded-lg hover:bg-muted transition-colors group"
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleActionItem(currentNote.id, i)
                          }}
                          className="mt-1 accent-[var(--apple-blue)]"
                        />
                        <span
                          className={`flex-1 ${item.completed ? "line-through text-muted-foreground" : "text-muted-foreground"}`}
                        >
                          {item.text}
                        </span>
                        {item.transcriptRefs && item.transcriptRefs.length > 0 && (
                          <span className="text-xs text-[var(--apple-blue)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            View source
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* View Full Transcript Button */}
              <button
                onClick={() => {
                  setHighlightedSegments([])
                  setShowTranscriptModal(true)
                }}
                className="w-full py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
              >
                View Full Transcript
              </button>
            </div>
          </div>
        )}

        {/* Transcript Modal */}
        {showTranscriptModal && currentNote && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-card w-full max-w-lg min-h-[50vh] max-h-[80vh] rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col">
              <div className="sticky top-0 bg-white dark:bg-card p-4 border-b border-border flex items-center justify-between shrink-0">
                <h3 className="text-lg font-semibold text-foreground">
                  {highlightedSegments.length > 0 ? "Source from Transcript" : "Full Transcript"}
                </h3>
                <button
                  onClick={() => {
                    setShowTranscriptModal(false)
                    setHighlightedSegments([])
                  }}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>
              <div className="p-4 pb-8 overflow-y-auto flex-1">
                {currentNote.transcriptSegments && currentNote.transcriptSegments.length > 0 ? (
                  <div className="space-y-2">
                    {currentNote.transcriptSegments.map((segment, index) => {
                      const isHighlighted = highlightedSegments.includes(index)
                      return (
                        <p
                          key={index}
                          ref={
                            isHighlighted
                              ? (el) => {
                                  if (el && highlightedSegments[0] === index) {
                                    setTimeout(() => {
                                      el.scrollIntoView({ behavior: "smooth", block: "center" })
                                    }, 100)
                                  }
                                }
                              : undefined
                          }
                          className={`text-sm p-2 rounded-lg transition-colors ${
                            isHighlighted
                              ? "bg-[var(--apple-blue)]/10 text-foreground font-medium"
                              : highlightedSegments.length > 0
                                ? "text-muted-foreground/50"
                                : "text-muted-foreground"
                          }`}
                        >
                          {segment.text}
                        </p>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{currentNote.transcript}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes List */}
        {!showRecorder && !selectedNote && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Your Notes</h2>

            {notes.length === 0 ? (
              <div className="bg-white dark:bg-card rounded-2xl p-8 text-center shadow-sm">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No notes yet. Start a recording to create your first note.</p>
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white dark:bg-card rounded-2xl p-4 cursor-pointer hover:bg-muted/50 transition-colors shadow-sm"
                  onClick={() => setSelectedNote(note.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{note.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {note.summary || note.mainIdeas?.[0]?.title || "No summary available"}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{note.date}</span>
                        <span>{note.duration}</span>
                        {note.mainIdeas && <span>{note.mainIdeas.length} topics</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {(isExtractingEvents || extractedEventsCount !== null) && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="px-4 py-2 rounded-full bg-[var(--apple-blue)] text-white text-sm font-medium flex items-center gap-2 shadow-lg">
              {isExtractingEvents ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning for calendar events...
                </>
              ) : (
                <>
                  <CalendarPlus className="w-4 h-4" />
                  {extractedEventsCount === 0
                    ? "No events found"
                    : `Added ${extractedEventsCount} event${extractedEventsCount === 1 ? "" : "s"} to calendar`}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen pb-24 relative overflow-hidden">
          <div
            className="absolute inset-0 z-0"
            style={{
              background: `linear-gradient(to bottom, var(--gradient-start) 0%, var(--gradient-start) 15%, var(--gradient-end) 45%, var(--gradient-end) 100%)`,
            }}
          />
          <header className="pt-14 px-6 pb-6 relative z-10">
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">Notes</h1>
            <p className="text-white/80">Record and summarize conversations</p>
          </header>
          <div className="px-6 flex items-center justify-center py-20 relative z-10">
            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
          </div>
          <BottomNav />
        </main>
      }
    >
      <NotesContent />
    </Suspense>
  )
}
