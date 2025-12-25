import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const state = searchParams.get("state")

  const isLoginFlow = state === "login"
  const isCalendarFlow = state?.startsWith("calendar_")
  const permissionLevel = isCalendarFlow ? state.replace("calendar_", "") : null

  const errorRedirect = isLoginFlow ? "/login" : "/settings"
  const successRedirect = isLoginFlow ? "/" : "/settings"

  if (error) {
    return NextResponse.redirect(new URL(`${errorRedirect}?error=google_auth_denied`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${errorRedirect}?error=no_code`, request.url))
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error("Token exchange failed:", errorData)
      return NextResponse.redirect(new URL(`${errorRedirect}?error=token_exchange_failed`, request.url))
    }

    const tokens = await tokenResponse.json()

    // Fetch user info
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    let userInfo = null
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json()
    }

    // Store tokens in cookies
    const cookieStore = await cookies()
    cookieStore.set("google_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
    })

    if (tokens.refresh_token) {
      cookieStore.set("google_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      })
    }

    // Store user info in a cookie (for auth status checks)
    if (userInfo) {
      cookieStore.set(
        "google_user_info",
        JSON.stringify({
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365, // 1 year
        },
      )
    }

    if (permissionLevel) {
      cookieStore.set("google_calendar_permission", permissionLevel, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      })
    }

    return NextResponse.redirect(new URL(`${successRedirect}?success=google_connected`, request.url))
  } catch (error) {
    console.error("Google auth error:", error)
    return NextResponse.redirect(new URL(`${errorRedirect}?error=auth_failed`, request.url))
  }
}
