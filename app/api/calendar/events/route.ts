import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth, clerkClient } from "@clerk/nextjs/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to refresh token")
  }

  return response.json()
}

async function getValidAccessToken(cookieStore: any) {
  // First try Clerk's Google OAuth token
  try {
    const { userId } = await auth()

    if (userId) {
      const client = await clerkClient()
      const tokenResponse = await client.users.getUserOauthAccessToken(userId, "oauth_google")

      if (tokenResponse.data && tokenResponse.data.length > 0) {
        return tokenResponse.data[0].token
      }
    }
  } catch (err) {
    // Clerk token not available, fall through to cookie check
  }

  // Fall back to cookie-based tokens
  let accessToken = cookieStore.get("google_access_token")?.value
  const refreshToken = cookieStore.get("google_refresh_token")?.value

  if (!accessToken && !refreshToken) {
    return null
  }

  if (!accessToken && refreshToken) {
    try {
      const tokens = await refreshAccessToken(refreshToken)
      accessToken = tokens.access_token

      cookieStore.set("google_access_token", tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: tokens.expires_in,
      })
    } catch (error) {
      console.error("Failed to refresh token:", error)
      return null
    }
  }

  return accessToken
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const accessToken = await getValidAccessToken(cookieStore)

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated", events: [] }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const timeMin = searchParams.get("timeMin") || new Date().toISOString()
  const timeMax = searchParams.get("timeMax") || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
        }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text()
      console.error("Calendar API error:", errorText)
      return NextResponse.json({ error: "Failed to fetch events", events: [] }, { status: calendarResponse.status })
    }

    const data = await calendarResponse.json()
    return NextResponse.json({ events: data.items || [] })
  } catch (error) {
    console.error("Calendar fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch events", events: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const accessToken = await getValidAccessToken(cookieStore)

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const { title, date, time, duration, description, timezone, recurrence } = await request.json()

    const userTimezone = timezone || "America/Chicago"

    let startDateTime: string
    let endDateTime: string

    if (time) {
      startDateTime = `${date}T${time}:00`
      const endDate = new Date(`${date}T${time}:00`)
      endDate.setMinutes(endDate.getMinutes() + (duration || 60))
      endDateTime = `${date}T${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}:00`
    } else {
      startDateTime = date
      endDateTime = date
    }

    const event: any = time
      ? {
          summary: title,
          description: description || "",
          start: {
            dateTime: startDateTime,
            timeZone: userTimezone,
          },
          end: {
            dateTime: endDateTime,
            timeZone: userTimezone,
          },
        }
      : {
          summary: title,
          description: description || "",
          start: { date: startDateTime },
          end: { date: endDateTime },
        }

    if (recurrence) {
      event.recurrence = [recurrence]
    }

    const calendarResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    })

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text()
      console.error("Calendar create error:", errorText)
      return NextResponse.json({ error: "Failed to create event" }, { status: calendarResponse.status })
    }

    const createdEvent = await calendarResponse.json()
    return NextResponse.json({ event: createdEvent })
  } catch (error) {
    console.error("Calendar create error:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies()
  const accessToken = await getValidAccessToken(cookieStore)

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const { action, eventIds, timeMin, timeMax } = await request.json()

    if (action === "bulkDelete") {
      if (eventIds && eventIds.length > 0) {
        const results = await Promise.all(
          eventIds.map(async (eventId: string) => {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            return { eventId, success: response.ok || response.status === 204 }
          }),
        )
        const deletedCount = results.filter((r) => r.success).length
        return NextResponse.json({ success: true, deletedCount })
      }

      if (timeMin && timeMax) {
        const fetchResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            new URLSearchParams({
              timeMin,
              timeMax,
              singleEvents: "true",
              orderBy: "startTime",
              maxResults: "100",
            }),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        )

        if (!fetchResponse.ok) {
          return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
        }

        const data = await fetchResponse.json()
        const events = data.items || []

        if (events.length === 0) {
          return NextResponse.json({ success: true, deletedCount: 0, message: "No events found in that time range" })
        }

        const results = await Promise.all(
          events.map(async (event: any) => {
            const response = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            )
            return { eventId: event.id, title: event.summary, success: response.ok || response.status === 204 }
          }),
        )

        const deletedCount = results.filter((r) => r.success).length
        const deletedTitles = results.filter((r) => r.success).map((r) => r.title)
        return NextResponse.json({ success: true, deletedCount, deletedTitles })
      }

      return NextResponse.json({ error: "Either eventIds or timeMin/timeMax required" }, { status: 400 })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("Calendar bulk operation error:", error)
    return NextResponse.json({ error: "Failed to perform bulk operation" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies()
  const accessToken = await getValidAccessToken(cookieStore)

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 })
    }

    const calendarResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!calendarResponse.ok && calendarResponse.status !== 204) {
      const errorText = await calendarResponse.text()
      console.error("Calendar delete error:", errorText)
      return NextResponse.json({ error: "Failed to delete event" }, { status: calendarResponse.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Calendar delete error:", error)
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }
}
