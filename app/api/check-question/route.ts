import { GoogleGenAI } from "@google/genai"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"

export const maxDuration = 30

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

const SIMPLE_QUESTION_PATTERNS = [
  /^\d+[\s]*[+\-*/x÷][\s]*\d+/, // math
  /^what is \d+/, // math questions
]

function isSimpleQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return SIMPLE_QUESTION_PATTERNS.some((pattern) => pattern.test(lower))
}

const responseCache = new Map<string, { answer: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCacheKey(text: string, calendarEventsCount: number): string {
  // Normalize text for better cache hits
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
  // Include calendar count to invalidate when events change
  return `${normalized}_${calendarEventsCount}`
}

function getCachedResponse(key: string): string | null {
  const cached = responseCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.answer
  }
  if (cached) {
    responseCache.delete(key)
  }
  return null
}

function setCachedResponse(key: string, answer: string): void {
  // Only cache objective answers (short, factual)
  if (answer.length < 100 && !answer.includes("calendar") && !answer.includes("schedule")) {
    responseCache.set(key, { answer, timestamp: Date.now() })
    // Limit cache size
    if (responseCache.size > 100) {
      const firstKey = responseCache.keys().next().value
      if (firstKey) responseCache.delete(firstKey)
    }
  }
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!response.ok) throw new Error("Failed to refresh token")
  return response.json()
}

async function getValidAccessToken() {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get("google_access_token")?.value
  const refreshToken = cookieStore.get("google_refresh_token")?.value

  if (!accessToken && !refreshToken) return null

  if (!accessToken && refreshToken) {
    try {
      const tokens = await refreshAccessToken(refreshToken)
      accessToken = tokens.access_token
    } catch {
      return null
    }
  }
  return accessToken
}

async function createCalendarEvent(
  accessToken: string,
  event: { title: string; date: string; time?: string; duration?: number; description?: string; recurrence?: string },
  userTimezone: string,
) {
  let startDateTime: string
  let endDateTime: string

  if (event.time) {
    startDateTime = `${event.date}T${event.time}:00`
    const endDate = new Date(`${event.date}T${event.time}:00`)
    endDate.setMinutes(endDate.getMinutes() + (event.duration || 60))
    endDateTime = `${event.date}T${endDate.toTimeString().slice(0, 5)}:00`
  } else {
    startDateTime = event.date
    endDateTime = event.date
  }

  const calendarEvent: any = event.time
    ? {
        summary: event.title,
        description: event.description || "",
        start: { dateTime: startDateTime, timeZone: userTimezone },
        end: { dateTime: endDateTime, timeZone: userTimezone },
      }
    : {
        summary: event.title,
        description: event.description || "",
        start: { date: startDateTime },
        end: { date: endDateTime },
      }

  if (event.recurrence) {
    calendarEvent.recurrence = [event.recurrence]
  }

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(calendarEvent),
  })

  return response.ok
}

async function deleteCalendarEvent(accessToken: string, eventId: string) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return response.ok || response.status === 204
}

async function bulkDeleteEvents(accessToken: string, timeMin: string, timeMax: string) {
  const fetchResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
      }),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  if (!fetchResponse.ok) return { success: false, deletedCount: 0, deletedTitles: [] }

  const data = await fetchResponse.json()
  const events = data.items || []

  if (events.length === 0) {
    return { success: true, deletedCount: 0, deletedTitles: [] }
  }

  const results = await Promise.all(
    events.map(async (event: any) => {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return { title: event.summary, success: response.ok || response.status === 204 }
    }),
  )

  const deletedTitles = results.filter((r) => r.success).map((r) => r.title)
  return { success: true, deletedCount: deletedTitles.length, deletedTitles }
}

async function findEventByTitle(accessToken: string, searchTerm: string, timeMin: string, timeMax: string) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
        q: searchTerm,
      }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!response.ok) return null

  const data = await response.json()
  return data.items || []
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      text,
      conversationHistory,
      safetyMode,
      lastMentionedEvent,
      lastCreatedEvents,
      notesContext,
      calendarEvents,
      customInstructions,
    } = body

    if (!text || text.trim().length < 3) {
      return Response.json({ isQuestion: false, answer: null })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

    let currentDateStr: string
    let currentTimeStr: string
    let timezoneStr: string
    let isoDate: string
    let tomorrowIso: string

    if (body.localDateTime) {
      currentDateStr = body.localDateTime.date
      currentTimeStr = body.localDateTime.time
      timezoneStr = body.localDateTime.timezone || "America/New_York"
      const dateParts = body.localDateTime.date.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d+)/)
      if (dateParts) {
        const monthNames = [
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
        const month = monthNames.indexOf(dateParts[2]) + 1
        const day = Number.parseInt(dateParts[3])
        const year = Number.parseInt(dateParts[4])
        isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

        const tomorrowDay = day + 1
        const daysInMonth = new Date(year, month, 0).getDate()
        if (tomorrowDay > daysInMonth) {
          const nextMonth = month === 12 ? 1 : month + 1
          const nextYear = month === 12 ? year + 1 : year
          tomorrowIso = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
        } else {
          tomorrowIso = `${year}-${String(month).padStart(2, "0")}-${String(tomorrowDay).padStart(2, "0")}`
        }
      } else {
        isoDate = body.localDateTime.isoDate || new Date().toISOString().split("T")[0]
        const [y, m, d] = isoDate.split("-").map(Number)
        const nextDay = d + 1
        const daysInMonth = new Date(y, m, 0).getDate()
        if (nextDay > daysInMonth) {
          const nextMonth = m === 12 ? 1 : m + 1
          const nextYear = m === 12 ? y + 1 : y
          tomorrowIso = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
        } else {
          tomorrowIso = `${y}-${String(m).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`
        }
      }
    } else {
      const now = new Date()
      currentTimeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      currentDateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      timezoneStr = "America/New_York"
      isoDate = now.toISOString().split("T")[0]
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`
    }

    const isSimple = isSimpleQuestion(text)
    const cacheKey = getCacheKey(text, calendarEvents?.length || 0)

    if (isSimple) {
      const cachedAnswer = getCachedResponse(cacheKey)
      if (cachedAnswer) {
        return Response.json({
          isQuestion: true,
          answer: cachedAnswer,
          lastMentionedEvent,
          lastCreatedEvents,
          cached: true,
        })
      }
    }

    if (body.pendingSpecificDeletion && body.pendingSpecificDeletion.length > 0) {
      const confirmationCheck = text.toLowerCase().trim()
      const isConfirmed = /^(yes|yeah|yep|sure|confirm|delete|go ahead|do it)/.test(confirmationCheck)
      const isDenied = /^(no|nope|cancel|never mind|don't|stop)/.test(confirmationCheck)

      if (isConfirmed) {
        const accessToken = await getValidAccessToken()
        if (accessToken) {
          const results = await Promise.all(
            body.pendingSpecificDeletion.map(async (event: any) => {
              if (event.id) {
                const response = await fetch(
                  `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`,
                  { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
                )
                return { title: event.title, success: response.ok || response.status === 204 }
              } else {
                const found = await findEventByTitle(
                  accessToken,
                  event.title,
                  `${event.date}T00:00:00Z`,
                  `${event.date}T23:59:59Z`,
                )
                if (found && found.length > 0) {
                  const response = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${found[0].id}`,
                    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
                  )
                  return { title: event.title, success: response.ok || response.status === 204 }
                }
                return { title: event.title, success: false }
              }
            }),
          )

          const deletedCount = results.filter((r) => r.success).length
          const deletedTitles = results.filter((r) => r.success).map((r) => r.title)

          return Response.json({
            isQuestion: true,
            answer:
              deletedCount > 0
                ? `Deleted ${deletedCount} event${deletedCount > 1 ? "s" : ""}.`
                : `Couldn't find those events.`,
            lastMentionedEvent: null,
            lastCreatedEvents: [],
            pendingSpecificDeletion: [],
            eventDeleted: deletedCount > 0,
          })
        }
        return Response.json({
          isQuestion: true,
          answer: `Couldn't delete. Try again.`,
          lastMentionedEvent: null,
          lastCreatedEvents: [],
          pendingSpecificDeletion: [],
        })
      } else if (isDenied) {
        return Response.json({
          isQuestion: true,
          answer: `Okay, cancelled.`,
          lastMentionedEvent: null,
          lastCreatedEvents: [],
          pendingSpecificDeletion: [],
        })
      }
    }

    if (body.pendingBulkDeletion) {
      const confirmationCheck = text.toLowerCase().trim()
      const isConfirmed = /^(yes|yeah|yep|sure|confirm|delete|go ahead|do it)/.test(confirmationCheck)
      const isDenied = /^(no|nope|cancel|never mind|don't|stop)/.test(confirmationCheck)

      if (isConfirmed) {
        const accessToken = await getValidAccessToken()
        if (accessToken) {
          const result = await bulkDeleteEvents(
            accessToken,
            body.pendingBulkDeletion.timeMin,
            body.pendingBulkDeletion.timeMax,
          )
          return Response.json({
            isQuestion: true,
            answer:
              result.deletedCount > 0
                ? `Deleted ${result.deletedCount} event${result.deletedCount > 1 ? "s" : ""}.`
                : `No events found to delete.`,
            lastMentionedEvent: null,
            eventDeleted: result.deletedCount > 0,
          })
        }
        return Response.json({
          isQuestion: true,
          answer: `Couldn't delete. Try again.`,
          lastMentionedEvent: null,
        })
      } else if (isDenied) {
        return Response.json({
          isQuestion: true,
          answer: `Okay, cancelled.`,
          lastMentionedEvent: null,
        })
      }
    }

    if (body.pendingDeletion) {
      const confirmationCheck = text.toLowerCase().trim()
      const isConfirmed = /^(yes|yeah|yep|sure|confirm|delete|go ahead|do it)/.test(confirmationCheck)
      const isDenied = /^(no|nope|cancel|never mind|don't|stop)/.test(confirmationCheck)

      if (isConfirmed) {
        const accessToken = await getValidAccessToken()
        if (accessToken && body.pendingDeletion.eventId) {
          const deleted = await deleteCalendarEvent(accessToken, body.pendingDeletion.eventId)
          return Response.json({
            isQuestion: true,
            answer: deleted ? `Deleted.` : `Couldn't delete.`,
            lastMentionedEvent: null,
            lastCreatedEvents: [],
            eventDeleted: deleted,
          })
        }
        return Response.json({
          isQuestion: true,
          answer: `Couldn't delete. Try again.`,
          lastMentionedEvent: null,
        })
      } else if (isDenied) {
        return Response.json({
          isQuestion: true,
          answer: `Okay, cancelled.`,
          lastMentionedEvent: null,
        })
      }
    }

    const calendarContext =
      calendarEvents && calendarEvents.length > 0
        ? calendarEvents
            .map(
              (e: any) =>
                `- "${e.title}" at ${e.time}${e.isoDate ? ` (${e.isoDate})` : ""}${e.id ? ` [ID:${e.id}]` : ""}`,
            )
            .join("\n")
        : "No calendar events available."

    const calendarKeywords =
      /schedule|calendar|meeting|appointment|event|remind|delete|remove|cancel|add|create|book|tomorrow|today|yesterday|this week|next week/i
    const isCalendarQuery =
      calendarKeywords.test(text) &&
      !/(who is|what is|how much|market cap|population|capital of|weather|news|price)/i.test(text)
    const needsCalendarCheck = calendarKeywords.test(text) || lastMentionedEvent || lastCreatedEvents.length > 0

    if (needsCalendarCheck) {
      const complexCheckPrompt = `Analyze if the user wants a COMPLEX calendar operation.

CURRENT TIME: ${currentTimeStr}
TODAY'S DATE: ${currentDateStr} (${isoDate})
TOMORROW'S DATE: ${tomorrowIso}

RECENT CONVERSATION:
${conversationHistory || "None"}

${lastCreatedEvents && lastCreatedEvents.length > 0 ? `EVENTS JUST CREATED:\n${lastCreatedEvents.map((e: any) => `- "${e.title}" at ${e.time}${e.id ? ` [ID:${e.id}]` : ""}`).join("\n")}` : ""}

${lastMentionedEvent ? `LAST DISCUSSED EVENT: "${lastMentionedEvent.title}" at ${lastMentionedEvent.time}${lastMentionedEvent.id ? ` [ID:${lastMentionedEvent.id}]` : ""}` : ""}

CALENDAR EVENTS:
${calendarContext}

USER SAID: "${text}"

Determine if this is:
1. CREATE: Creating a SINGLE new event (add meeting tomorrow, schedule call Friday 3pm)
2. RECURRING: Creating repeating events (daily standup, weekly meeting, etc.)
3. BULK_DELETE: Deleting multiple events by time range (clear tomorrow, delete next 2 hours)
4. SPECIFIC_DELETE: Deleting specific events referenced in conversation (delete those meetings, remove them, delete the events I just made)
5. SINGLE_DELETE: Deleting one specific event by name or reference (delete my dentist appointment, delete that)
6. NONE: Not a calendar operation

DATE RULES:
- "tomorrow" = ${tomorrowIso}
- "today" = ${isoDate}
TIME CONVERSION: noon=12:00, midnight=00:00, 1pm=13:00, 2pm=14:00, 3pm=15:00, 4pm=16:00, 5pm=17:00, 6pm=18:00, etc.

Return JSON only:
{
  "operation": "CREATE" | "RECURRING" | "BULK_DELETE" | "SPECIFIC_DELETE" | "SINGLE_DELETE" | "NONE",
  "create": { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM", "duration": number } | null,
  "recurring": { "title": string, "frequency": "DAILY"|"WEEKLY"|"MONTHLY", "time": "HH:MM", "startDate": "YYYY-MM-DD", "count": number, "dayOfWeek": string|null } | null,
  "bulkDelete": { "startTime": "ISO datetime", "endTime": "ISO datetime", "description": string } | null,
  "specificDelete": [{ "title": string, "date": "YYYY-MM-DD", "time": "HH:MM", "id": string|null }] | null,
  "singleDelete": { "eventTitle": string, "eventId": string|null } | null
}`

      const complexResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: complexCheckPrompt,
      })

      let complexData: any = { operation: "NONE" }
      try {
        const jsonMatch = complexResponse.text?.match(/\{[\s\S]*\}/)
        if (jsonMatch) complexData = JSON.parse(jsonMatch[0])
      } catch (e) {}

      if (complexData.operation === "CREATE" && complexData.create) {
        const c = complexData.create
        const accessToken = await getValidAccessToken()

        if (accessToken) {
          const created = await createCalendarEvent(
            accessToken,
            { title: c.title, date: c.date, time: c.time, duration: c.duration || 60 },
            timezoneStr,
          )

          if (created) {
            const createdEvent = {
              title: c.title,
              date: c.date,
              time: c.time,
              id: null,
            }
            return Response.json({
              isQuestion: true,
              answer: `Added ${c.title}.`,
              lastMentionedEvent: createdEvent,
              lastCreatedEvents: [...lastCreatedEvents, createdEvent],
              eventCreated: true,
              refreshCalendar: true,
            })
          }
        }
        return Response.json({
          isQuestion: true,
          answer: `Couldn't add event. Connect Google Calendar.`,
          lastMentionedEvent,
          lastCreatedEvents,
        })
      }

      if (complexData.operation === "RECURRING" && complexData.recurring) {
        const r = complexData.recurring
        const accessToken = await getValidAccessToken()

        if (accessToken) {
          const dayMap: any = {
            sunday: "SU",
            monday: "MO",
            tuesday: "TU",
            wednesday: "WE",
            thursday: "TH",
            friday: "FR",
            saturday: "SA",
          }
          const dayAbbrev = r.dayOfWeek ? dayMap[r.dayOfWeek.toLowerCase()] : null

          let rrule = ""
          if (r.frequency === "DAILY") rrule = `RRULE:FREQ=DAILY;COUNT=${r.count}`
          else if (r.frequency === "WEEKLY")
            rrule = `RRULE:FREQ=WEEKLY${dayAbbrev ? `;BYDAY=${dayAbbrev}` : ""};COUNT=${r.count}`
          else if (r.frequency === "MONTHLY") rrule = `RRULE:FREQ=MONTHLY;COUNT=${r.count}`

          const created = await createCalendarEvent(
            accessToken,
            { title: r.title, date: r.startDate, time: r.time, recurrence: rrule },
            timezoneStr,
          )

          if (created) {
            const events = await findEventByTitle(
              accessToken,
              r.title,
              `${r.startDate}T00:00:00Z`,
              new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            )

            const createdEvents =
              events?.slice(0, r.count).map((e: any) => ({
                title: e.summary,
                date: e.start?.date || e.start?.dateTime?.split("T")[0],
                time: e.start?.dateTime?.split("T")[1]?.slice(0, 5) || r.time,
                id: e.id,
              })) || []

            return Response.json({
              isQuestion: true,
              answer: `Created ${r.count} ${r.frequency.toLowerCase()} ${r.title} events.`,
              lastMentionedEvent: createdEvents[0] || null,
              lastCreatedEvents: createdEvents,
              eventCreated: true,
            })
          }
        }
        return Response.json({
          isQuestion: true,
          answer: `Couldn't create recurring events. Connect Google Calendar.`,
          lastMentionedEvent,
          lastCreatedEvents,
        })
      }

      if (complexData.operation === "BULK_DELETE" && complexData.bulkDelete) {
        const b = complexData.bulkDelete
        if (safetyMode) {
          return Response.json({
            isQuestion: true,
            answer: `Delete all events ${b.description}? Say yes to confirm.`,
            pendingBulkDeletion: { timeMin: b.startTime, timeMax: b.endTime },
            lastMentionedEvent,
            lastCreatedEvents,
          })
        } else {
          const accessToken = await getValidAccessToken()
          if (accessToken) {
            const result = await bulkDeleteEvents(accessToken, b.startTime, b.endTime)
            return Response.json({
              isQuestion: true,
              answer:
                result.deletedCount > 0
                  ? `Deleted ${result.deletedCount} event${result.deletedCount > 1 ? "s" : ""}.`
                  : `No events found to delete.`,
              lastMentionedEvent: null,
              lastCreatedEvents: [],
              eventDeleted: result.deletedCount > 0,
            })
          }
        }
      }

      if (complexData.operation === "SPECIFIC_DELETE" && complexData.specificDelete?.length > 0) {
        const events = complexData.specificDelete
        if (safetyMode) {
          return Response.json({
            isQuestion: true,
            answer: `Delete ${events.length} event${events.length > 1 ? "s" : ""}? Say yes to confirm.`,
            pendingSpecificDeletion: events,
            lastMentionedEvent,
            lastCreatedEvents: [],
          })
        } else {
          const accessToken = await getValidAccessToken()
          if (accessToken) {
            const results = await Promise.all(
              events.map(async (event: any) => {
                if (event.id) {
                  const response = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`,
                    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
                  )
                  return { success: response.ok || response.status === 204 }
                } else {
                  const found = await findEventByTitle(
                    accessToken,
                    event.title,
                    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
                  )
                  if (found?.length > 0) {
                    const response = await fetch(
                      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${found[0].id}`,
                      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
                    )
                    return { success: response.ok || response.status === 204 }
                  }
                  return { success: false }
                }
              }),
            )
            const deletedCount = results.filter((r) => r.success).length
            return Response.json({
              isQuestion: true,
              answer:
                deletedCount > 0
                  ? `Deleted ${deletedCount} event${deletedCount > 1 ? "s" : ""}.`
                  : `Couldn't find those events.`,
              lastMentionedEvent: null,
              lastCreatedEvents: [],
              eventDeleted: deletedCount > 0,
            })
          }
        }
      }

      if (complexData.operation === "SINGLE_DELETE" && complexData.singleDelete) {
        const s = complexData.singleDelete
        const eventId = s.eventId || lastMentionedEvent?.id
        const eventTitle = s.eventTitle || lastMentionedEvent?.title

        if (!eventId && !eventTitle) {
          return Response.json({
            isQuestion: true,
            answer: `Which event do you want to delete?`,
            lastMentionedEvent,
            lastCreatedEvents,
          })
        }

        if (safetyMode) {
          return Response.json({
            isQuestion: true,
            answer: `Delete ${eventTitle}? Say yes to confirm.`,
            pendingDeletion: { eventId, eventTitle },
            lastMentionedEvent,
            lastCreatedEvents,
          })
        } else {
          const accessToken = await getValidAccessToken()
          if (accessToken) {
            let deleteId = eventId
            if (!deleteId && eventTitle) {
              const found = await findEventByTitle(
                accessToken,
                eventTitle,
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
              )
              if (found?.length > 0) deleteId = found[0].id
            }
            if (deleteId) {
              const deleted = await deleteCalendarEvent(accessToken, deleteId)
              return Response.json({
                isQuestion: true,
                answer: deleted ? `Deleted.` : `Couldn't delete.`,
                lastMentionedEvent: null,
                lastCreatedEvents,
                eventDeleted: deleted,
              })
            }
          }
          return Response.json({
            isQuestion: true,
            answer: `Couldn't find that event.`,
            lastMentionedEvent,
            lastCreatedEvents,
          })
        }
      }
    }

    const useSimpleModel = isSimple && !needsCalendarCheck
    const model = "gemini-2.0-flash-lite"

    const systemPrompt = `You are a voice assistant. Answer questions asked to you.

CURRENT: ${currentTimeStr}, ${currentDateStr}
${customInstructions ? `\nUSER'S CUSTOM INSTRUCTIONS:\n${customInstructions}\n` : ""}

${conversationHistory ? `RECENT CONVERSATION:\n${conversationHistory}\n` : ""}
${lastMentionedEvent ? `LAST DISCUSSED EVENT: "${lastMentionedEvent.title}" at ${lastMentionedEvent.time}` : ""}
${calendarEvents?.length > 0 ? `\nYOUR CALENDAR:\n${calendarContext}` : ""}
${notesContext ? `\nYOUR NOTES:\n${notesContext}` : ""}

RULES:
1. Answer ANY question that is NOT about the user's personal life
2. Do NOT answer questions about: people the user knows personally, their schedule/appointments, their notes/private info, their relationships
3. Respond with ONLY the critical fact - NEVER restate the question or add preamble
4. Maximum 2-4 words for most answers - just the raw answer
5. For personal life questions (like "who is Sarah?" when referring to someone they know): Say "SILENT"
6. For public knowledge (famous people, facts, news, math): Always answer
7. Calendar events: "[event name] at [time]" only

Examples:
- Q: "What were Nvidia's Q3 earnings?" → "$57 billion" (NOT "Nvidia's Q3 revenue is $57 billion")
- Q: "Who is Elon Musk?" → "Tesla CEO" (NOT "Elon Musk is the CEO of Tesla")
- Q: "What is 2+2?" → "4" (NOT "The answer is 4")

User says: "${text}"

RESPOND ONLY WITH THE ANSWER, NOTHING ELSE:`

    const modelConfig: any = {}
    if (!needsCalendarCheck) {
      modelConfig.tools = [{ googleSearch: {} }]
    }

    const response = await ai.models.generateContent({
      model,
      contents: systemPrompt,
      config: modelConfig,
    })

    const result = response.text?.trim() || ""
    const shouldStaySilent = result.toUpperCase().replace(/[^A-Z]/g, "") === "SILENT" || result.length === 0

    const validateSearchResults = (answer: string, query: string): boolean => {
      const query_lower = query.toLowerCase()

      // Personal life patterns to stay silent on
      const personalPatterns = [
        /who is (my|the user's)/i,
        /tell me about (my|the user's)/i,
        /what.*my (friend|family|colleague|boss)/i,
      ]

      if (personalPatterns.some((p) => p.test(query))) return false

      // For everything else (public figures, facts, news, general knowledge), answer
      return true
    }

    if (!shouldStaySilent && isSimple && validateSearchResults(result, text)) {
      setCachedResponse(cacheKey, result)
    }

    let mentionedEvent = lastMentionedEvent
    if (!shouldStaySilent && calendarEvents?.length > 0) {
      const resultLower = result.toLowerCase()

      for (const event of calendarEvents) {
        if (!event.title) continue
        const titleLower = event.title.toLowerCase()

        if (
          resultLower.includes(titleLower) ||
          titleLower
            .split(/\s+/)
            .filter((w: string) => w.length > 2)
            .some((w: string) => resultLower.includes(w))
        ) {
          mentionedEvent = {
            title: event.title,
            date: event.date,
            time: event.time,
            id: event.id,
          }
          break
        }
      }

      if (/next|upcoming|soonest/.test(text.toLowerCase())) {
        const now = new Date()
        let closest: any = null
        let closestDiff = Number.POSITIVE_INFINITY

        for (const event of calendarEvents) {
          const eventTime = new Date(`${event.date}T${event.time || "00:00"}:00`)
          const diff = eventTime.getTime() - now.getTime()
          if (diff > 0 && diff < closestDiff) {
            closestDiff = diff
            closest = event
          }
        }

        if (closest) {
          mentionedEvent = {
            title: closest.title,
            date: closest.date,
            time: closest.time,
            id: closest.id,
          }
        }
      }
    }

    return Response.json({
      isQuestion: true,
      answer: shouldStaySilent ? null : result,
      lastMentionedEvent: mentionedEvent,
      lastCreatedEvents,
      model,
    })
  } catch (error) {
    console.error("[v0] API Error:", error)
    return Response.json({ isQuestion: false, answer: null, error: String(error) }, { status: 500 })
  }
}
