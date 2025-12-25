"use client"

import { useState, useEffect } from "react"
import { EarbudsAnimation } from "@/components/earbuds-animation"
import { Mic, Volume2, FileText, ArrowRight, Sparkles, Check, X, Loader2, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMicrophone } from "@/lib/microphone-context"
import { useCalendar } from "@/lib/calendar-context"
import { useAuth } from "@/lib/auth-context"

type OnboardingStep = "welcome" | "connect" | "calendar" | "permissions"

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [step, setStep] = useState<OnboardingStep>("welcome")
  const [permissionStatus, setPermissionStatus] = useState<{
    microphone: "pending" | "granted" | "denied" | "requesting"
    backgroundAudio: "pending" | "granted"
    transcription: "pending" | "granted"
  }>({
    microphone: "pending",
    backgroundAudio: "pending",
    transcription: "pending",
  })
  const [calendarConnecting, setCalendarConnecting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const { requestPermission } = useMicrophone()
  const { isConnected: calendarConnected, connectGoogle } = useCalendar()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      const complete = localStorage.getItem("onboarding_complete") === "true"
      if (complete && user) {
        router.replace("/home")
      }
    }
  }, [mounted, user, router])

  if (authLoading || !mounted) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
      >
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </main>
    )
  }

  if (!user) {
    return null
  }

  const isGoogleUser = user.provider === "google"
  const calendarAutoConnected = isGoogleUser

  const handleConnect = () => {
    if (calendarAutoConnected) {
      setStep("permissions")
    } else {
      setStep("calendar")
    }
  }

  const handleConnectCalendar = async () => {
    setCalendarConnecting(true)
    connectGoogle("readwrite")
  }

  const handleRequestMicrophone = async () => {
    setPermissionStatus((prev) => ({ ...prev, microphone: "requesting" }))
    const granted = await requestPermission()
    setPermissionStatus((prev) => ({
      ...prev,
      microphone: granted ? "granted" : "denied",
      backgroundAudio: granted ? "granted" : prev.backgroundAudio,
      transcription: granted ? "granted" : prev.transcription,
    }))
  }

  const allPermissionsGranted =
    permissionStatus.microphone === "granted" &&
    permissionStatus.backgroundAudio === "granted" &&
    permissionStatus.transcription === "granted"

  const handleComplete = () => {
    localStorage.setItem("onboarding_complete", "true")
    document.cookie = "onboarding_complete=true; path=/; max-age=31536000; SameSite=Lax"
    router.push("/home")
  }

  const steps = calendarAutoConnected
    ? (["welcome", "connect", "permissions"] as const)
    : (["welcome", "connect", "calendar", "permissions"] as const)

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
    >
      {step === "welcome" && (
        <div className="w-full max-w-sm animate-spring-in text-center relative z-10">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl opacity-40 bg-white" />
              <div className="relative w-20 h-20 rounded-2xl bg-white/90 dark:bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-xl">
                <Sparkles className="w-10 h-10" style={{ color: "var(--apple-blue)" }} />
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-lg">
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white mb-3 text-balance">
              Your Mind. Augmented.
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-base mb-8 text-pretty leading-relaxed">
              A proactive in-ear assistant that helps before you ask.
            </p>
            <button
              onClick={() => setStep("connect")}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-white font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--apple-blue)" }}
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {step === "connect" && (
        <div className="w-full max-w-sm animate-spring-in text-center relative z-10">
          <h1 className="text-3xl font-semibold text-white dark:text-white mb-2 drop-shadow-sm">Earbuds Recommended</h1>
          <p className="text-white/80 dark:text-white/70 mb-8 text-pretty">
            For the best experience, connect earbuds to enable whisper responses and hands-free use.
          </p>

          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-8 mb-8 shadow-lg">
            <EarbudsAnimation className="mx-auto" />
          </div>

          <button
            onClick={handleConnect}
            className="w-full py-4 rounded-2xl text-white font-semibold transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--apple-blue)" }}
          >
            Continue
          </button>
        </div>
      )}

      {step === "calendar" && (
        <div className="w-full max-w-sm animate-spring-in text-center relative z-10">
          <h1 className="text-3xl font-semibold text-white dark:text-white mb-2 drop-shadow-sm">Connect Calendar</h1>
          <p className="text-white/80 dark:text-white/70 mb-8 text-pretty">
            Connect your calendar to let the AI manage your schedule, add events, and check availability.
          </p>

          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-8 mb-8 shadow-lg">
            <div className="flex flex-col items-center">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 ${
                  calendarConnected ? "bg-green-100 dark:bg-green-500/20" : ""
                }`}
                style={
                  !calendarConnected
                    ? { backgroundColor: "color-mix(in srgb, var(--apple-blue) 20%, transparent)" }
                    : {}
                }
              >
                {calendarConnected ? (
                  <Check className="w-10 h-10 text-green-500" />
                ) : (
                  <Calendar className="w-10 h-10" style={{ color: "var(--apple-blue)" }} />
                )}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                {calendarConnected ? "Google Calendar connected!" : "Connect your Google Calendar"}
              </p>
              {!calendarConnected && (
                <button
                  onClick={handleConnectCalendar}
                  disabled={calendarConnecting}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {calendarConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Connect Google Calendar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => setStep("permissions")}
            className="w-full py-4 rounded-2xl text-white font-semibold transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--apple-blue)" }}
          >
            {calendarConnected ? "Continue" : "Skip for now"}
          </button>
        </div>
      )}

      {step === "permissions" && (
        <div className="w-full max-w-sm animate-spring-in relative z-10">
          <h1 className="text-3xl font-semibold text-white dark:text-white mb-2 text-center drop-shadow-sm">
            Enable Permissions
          </h1>
          <p className="text-white/80 dark:text-white/70 mb-8 text-center text-pretty">
            Tap each permission to enable it.
          </p>

          <div className="space-y-3 mb-8">
            {/* Microphone Permission */}
            <button
              onClick={handleRequestMicrophone}
              disabled={permissionStatus.microphone === "granted" || permissionStatus.microphone === "requesting"}
              className="w-full text-left"
            >
              <div
                className={`bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl flex items-center justify-between gap-4 p-4 transition-all duration-300 ${
                  permissionStatus.microphone === "granted"
                    ? "ring-2 ring-green-500/50"
                    : permissionStatus.microphone === "denied"
                      ? "ring-2 ring-red-500/50"
                      : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      permissionStatus.microphone === "granted"
                        ? "bg-green-100 dark:bg-green-500/20"
                        : permissionStatus.microphone === "denied"
                          ? "bg-red-100 dark:bg-red-500/20"
                          : ""
                    }`}
                    style={
                      permissionStatus.microphone === "pending" || permissionStatus.microphone === "requesting"
                        ? { backgroundColor: "color-mix(in srgb, var(--apple-blue) 20%, transparent)" }
                        : {}
                    }
                  >
                    <Mic
                      className={`w-5 h-5 ${
                        permissionStatus.microphone === "granted"
                          ? "text-green-500"
                          : permissionStatus.microphone === "denied"
                            ? "text-red-500"
                            : ""
                      }`}
                      style={
                        permissionStatus.microphone === "pending" || permissionStatus.microphone === "requesting"
                          ? { color: "var(--apple-blue)" }
                          : {}
                      }
                    />
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-white text-sm">Microphone Access</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">For live understanding.</p>
                  </div>
                </div>
                {permissionStatus.microphone === "requesting" ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : permissionStatus.microphone === "granted" ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : permissionStatus.microphone === "denied" ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : (
                  <div
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--apple-blue) 20%, transparent)",
                      color: "var(--apple-blue)",
                    }}
                  >
                    Tap to enable
                  </div>
                )}
              </div>
            </button>

            {/* Background Audio */}
            <div
              className={`bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl flex items-center justify-between gap-4 p-4 ${
                permissionStatus.backgroundAudio === "granted" ? "ring-2 ring-green-500/50" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    permissionStatus.backgroundAudio === "granted"
                      ? "bg-green-100 dark:bg-green-500/20"
                      : "bg-purple-100 dark:bg-purple-500/20"
                  }`}
                >
                  <Volume2
                    className={`w-5 h-5 ${
                      permissionStatus.backgroundAudio === "granted" ? "text-green-500" : "text-purple-500"
                    }`}
                  />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-white text-sm">Background Audio</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">To stay always on.</p>
                </div>
              </div>
              {permissionStatus.backgroundAudio === "granted" ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <div className="text-xs text-zinc-400">Auto-enabled</div>
              )}
            </div>

            {/* Transcription */}
            <div
              className={`bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl flex items-center justify-between gap-4 p-4 ${
                permissionStatus.transcription === "granted" ? "ring-2 ring-green-500/50" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    permissionStatus.transcription === "granted"
                      ? "bg-green-100 dark:bg-green-500/20"
                      : "bg-orange-100 dark:bg-orange-500/20"
                  }`}
                >
                  <FileText
                    className={`w-5 h-5 ${
                      permissionStatus.transcription === "granted" ? "text-green-500" : "text-orange-500"
                    }`}
                  />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-white text-sm">Transcription</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">To build your memory library.</p>
                </div>
              </div>
              {permissionStatus.transcription === "granted" ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <div className="text-xs text-zinc-400">Auto-enabled</div>
              )}
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={!allPermissionsGranted}
            className={`w-full py-4 rounded-2xl font-semibold transition-all ${
              allPermissionsGranted
                ? "text-white hover:opacity-90"
                : "bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
            }`}
            style={allPermissionsGranted ? { backgroundColor: "var(--apple-blue)" } : {}}
          >
            {allPermissionsGranted ? "Continue" : "Enable Microphone to Continue"}
          </button>
        </div>
      )}

      {/* Progress Dots */}
      <div className="flex items-center gap-3 mt-10 relative z-10">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all duration-500 ${
              step === s
                ? "w-8 bg-white"
                : steps.indexOf(step as (typeof steps)[number]) > i
                  ? "w-2 bg-white/80"
                  : "w-2 bg-white/30"
            }`}
          />
        ))}
      </div>
    </main>
  )
}
