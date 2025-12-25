import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || "")}`,
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // Ignore errors in route handler
            }
          },
        },
      },
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      // Get the user to check provider
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const onboardingComplete = cookieStore.get("onboarding_complete")?.value === "true"

      // If signed in with Google, set calendar connected cookie
      if (user?.app_metadata?.provider === "google") {
        const redirectPath = onboardingComplete ? "/home" : "/"
        const response = NextResponse.redirect(`${origin}${redirectPath}`)
        response.cookies.set("google_calendar_connected", "true", {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        })
        return response
      }

      // For other providers, redirect based on onboarding status
      const redirectPath = onboardingComplete ? "/home" : "/"
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }

    // Exchange failed
    return NextResponse.redirect(
      `${origin}/auth/error?error=auth_callback_failed&description=${encodeURIComponent(exchangeError.message)}`,
    )
  }

  // No code provided
  return NextResponse.redirect(`${origin}/auth/error?error=no_code&description=No authorization code provided`)
}
