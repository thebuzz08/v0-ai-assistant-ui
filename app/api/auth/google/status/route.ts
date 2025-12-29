import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth, clerkClient } from "@clerk/nextjs/server"

export async function GET() {
  const cookieStore = await cookies()

  try {
    const { userId } = await auth()

    if (userId) {
      const client = await clerkClient()
      const tokenResponse = await client.users.getUserOauthAccessToken(userId, "oauth_google")

      if (tokenResponse.data && tokenResponse.data.length > 0) {
        const accessToken = tokenResponse.data[0].token

        // Get user info from Google using Clerk's token
        let userInfo = null
        try {
          const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (response.ok) {
            const data = await response.json()
            userInfo = {
              name: data.name,
              email: data.email,
              picture: data.picture,
            }
          }
        } catch (err) {
          console.error("Failed to fetch user info:", err)
        }

        return NextResponse.json({
          connected: true,
          hasAccessToken: true,
          hasRefreshToken: true,
          userInfo,
          permission: "readwrite", // Clerk manages token refresh
          provider: "clerk_google",
        })
      }
    }
  } catch (err) {
    // Clerk token not available, fall through to cookie check
    console.log("No Clerk Google token available, checking cookies")
  }

  const accessToken = cookieStore.get("google_access_token")
  const refreshToken = cookieStore.get("google_refresh_token")
  const permissionCookie = cookieStore.get("google_calendar_permission")
  const permission = permissionCookie?.value || "readonly"

  let userInfo = null
  if (accessToken?.value) {
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken.value}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        userInfo = {
          name: data.name,
          email: data.email,
          picture: data.picture,
        }
      }
    } catch (err) {
      console.error("Failed to fetch user info:", err)
    }
  }

  return NextResponse.json({
    connected: !!(accessToken || refreshToken),
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    userInfo,
    permission,
    provider: accessToken || refreshToken ? "cookie_google" : "none",
  })
}
