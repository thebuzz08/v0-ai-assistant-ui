import { type NextRequest, NextResponse } from "next/server"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback"

export async function GET(request: NextRequest) {
  console.log("[v0] Google auth route called")
  console.log("[v0] GOOGLE_CLIENT_ID exists:", !!GOOGLE_CLIENT_ID)
  console.log("[v0] GOOGLE_REDIRECT_URI:", GOOGLE_REDIRECT_URI)

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "Google Client ID not configured" }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const permissionLevel = searchParams.get("permission") || "readonly"
  console.log("[v0] Permission level:", permissionLevel)

  // Base scopes for reading calendar
  const scopes = ["https://www.googleapis.com/auth/calendar.readonly"]

  // Add write scope if requested
  if (permissionLevel === "readwrite") {
    scopes.push("https://www.googleapis.com/auth/calendar.events")
  }

  console.log("[v0] Scopes:", scopes)

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
  authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", scopes.join(" "))
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "consent")
  authUrl.searchParams.set("state", `calendar_${permissionLevel}`)

  console.log("[v0] Auth URL:", authUrl.toString())

  return NextResponse.json({ authUrl: authUrl.toString() })
}
