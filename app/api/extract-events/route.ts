import { NextResponse } from "next/server"
import { google } from "googleapis"
import { cookies } from "next/headers"

export const maxDuration = 30

async function getExistingEvents(): Promise<{ summary: string; start: string }[]> {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("google_access_token")?.value

    if (!accessToken) return []

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })

    const calendar = google.calendar({ version: "v3", auth: oauth2Client })

    const now = new Date()
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days ahead

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: futureDate.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
    })

    return (response.data.items || []).map((event) => ({
      summary: event.summary || "",
      start: event.start?.dateTime || event.start?.date || "",
    }))
  } catch (error) {
    console.log("[v0] Error fetching existing events:", error)
    return []
  }
}

export async function POST(request: Request) {
  try {
    const { text, currentDate } = await request.json()

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ events: [] })
    }

    const existingEvents = await getExistingEvents()
    const existingEventsContext =
      existingEvents.length > 0
        ? `\nEXISTING CALENDAR EVENTS (do NOT create duplicates):\n${existingEvents.map((e) => `- "${e.summary}" at ${e.start}`).join("\n")}\n`
        : ""

    const currentTime = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Today is ${currentDate}. Current time is ${currentTime}.

You are an intelligent assistant that detects ANY activities, plans, or events mentioned in conversation that the user would benefit from having on their calendar.

EXTRACT events when someone mentions:
- Anything happening at a specific or implied time: "dinner in an hour", "meeting at 3", "gym later today"
- Future plans even if vague: "I should call mom tomorrow", "need to finish this by Friday"
- Activities with others: "lunch with Sarah", "picking up kids at 5"
- Deadlines or reminders: "project due Monday", "pay rent by the 1st"
- Relative time references: "in a few hours", "later tonight", "this afternoon", "soon"
  - "in an hour" = 1 hour from current time
  - "in a few hours" = 2-3 hours from current time
  - "later" or "later today" = 3-4 hours from current time
  - "tonight" = 7pm-9pm today
  - "this afternoon" = 2pm-5pm today
  - "tomorrow" = same time tomorrow or 9am if no time specified

DO NOT extract:
- Events that already exist in the calendar (check duplicates below)
- Past events that already happened
- Hypothetical or conditional plans ("if I have time", "maybe")
- General statements without any time implication
${existingEventsContext}
For each event, provide:
- title: Short descriptive title (e.g., "Dinner", "Call Mom", "Gym")
- date: ISO date string (YYYY-MM-DD)
- time: Time in HH:MM format (24h). Calculate from current time if relative (e.g., "in an hour")
- duration: Duration in minutes (default 60, use 30 for calls, 90 for meals)
- description: Context from conversation that would be helpful to remember

Be GENEROUS in extracting events - if someone mentions doing something at any point in the future, it's probably worth adding to their calendar.

Respond with JSON only:
{"events": [{"title": "...", "date": "...", "time": "...", "duration": 60, "description": "..."}]}

If no calendar-worthy events found, respond: {"events": []}

Transcript:
${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000,
          },
        }),
      },
    )

    if (!response.ok) {
      console.error("[v0] Gemini API error:", await response.text())
      return NextResponse.json({ events: [] })
    }

    const data = await response.json()
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

    // Parse JSON from response
    let cleanedText = resultText.trim()
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.slice(7)
    }
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.slice(3)
    }
    if (cleanedText.endsWith("```")) {
      cleanedText = cleanedText.slice(0, -3)
    }
    cleanedText = cleanedText.trim()

    try {
      const parsed = JSON.parse(cleanedText)
      const events = parsed.events || []

      const filteredEvents = events.filter((event: { title: string; date: string; time: string }) => {
        const eventDateTime = event.time ? `${event.date}T${event.time}` : event.date
        const isDuplicate = existingEvents.some((existing) => {
          const existingLower = existing.summary.toLowerCase()
          const newLower = event.title.toLowerCase()
          const sameDay = existing.start.startsWith(event.date)
          const similarTitle = existingLower.includes(newLower) || newLower.includes(existingLower)
          return sameDay && similarTitle
        })
        if (isDuplicate) {
          console.log("[v0] Filtered duplicate event:", event.title)
        }
        return !isDuplicate
      })

      console.log("[v0] Extracted events:", filteredEvents)
      return NextResponse.json({ events: filteredEvents })
    } catch {
      console.error("[v0] Failed to parse events JSON:", cleanedText)
      return NextResponse.json({ events: [] })
    }
  } catch (error) {
    console.error("[v0] Extract events error:", error)
    return NextResponse.json({ events: [] })
  }
}
