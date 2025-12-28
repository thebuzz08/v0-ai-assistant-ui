import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher([
  "/home(.*)",
  "/settings(.*)",
  "/notes(.*)",
  "/schedule(.*)",
  "/live(.*)",
  "/search(.*)",
  "/data(.*)",
  "/admin(.*)",
])

const isPublicRoute = createRouteMatcher(["/login(.*)", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  // Allow guest mode
  const guestMode = req.cookies.get("auth_guest_mode")?.value

  // Protect routes
  if (isProtectedRoute(req) && !userId && guestMode !== "true") {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users from login page
  if (req.nextUrl.pathname === "/login" && userId) {
    const onboardingComplete = req.cookies.get("onboarding_complete")?.value
    const url = req.nextUrl.clone()
    url.pathname = onboardingComplete === "true" ? "/home" : "/"
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users from root if onboarding is complete
  if (req.nextUrl.pathname === "/" && userId) {
    const onboardingComplete = req.cookies.get("onboarding_complete")?.value
    if (onboardingComplete === "true") {
      const url = req.nextUrl.clone()
      url.pathname = "/home"
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
