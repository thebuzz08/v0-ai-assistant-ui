import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Get Google access token from Clerk for users who signed in with Google
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ connected: false, error: "Not authenticated" }, { status: 401 })
    }

    const client = await clerkClient()

    // Try to get Google OAuth access token from Clerk
    const tokenResponse = await client.users.getUserOauthAccessToken(userId, "oauth_google")

    if (tokenResponse.data && tokenResponse.data.length > 0) {
      const token = tokenResponse.data[0].token
      return NextResponse.json({
        connected: true,
        token,
        provider: "clerk_google",
      })
    }

    return NextResponse.json({ connected: false, error: "No Google account linked" })
  } catch (error: any) {
    console.error("[v0] Error getting Google token from Clerk:", error)
    return NextResponse.json({
      connected: false,
      error: error.message || "Failed to get Google token",
    })
  }
}
