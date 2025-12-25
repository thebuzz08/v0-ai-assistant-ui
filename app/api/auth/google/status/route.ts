import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
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
  })
}
