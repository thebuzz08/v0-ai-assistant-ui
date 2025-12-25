"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sparkles, Mail, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react"

type AuthMode = "login" | "signup" | "email-login" | "email-signup"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    user,
    isLoading: authLoading,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    continueAsGuest,
  } = useAuth()

  const initialMode = searchParams.get("mode") === "email" ? "email-login" : "login"
  const [mode, setMode] = useState<AuthMode>(initialMode as AuthMode)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      const onboardingComplete = localStorage.getItem("onboarding_complete") === "true"
      router.replace(onboardingComplete ? "/home" : "/")
    }
  }, [authLoading, user, router])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError("")
    await signInWithGoogle()
  }

  const handleAppleSignIn = async () => {
    setIsLoading(true)
    setError("")
    await signInWithApple()
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (mode === "email-signup") {
      if (!name.trim()) {
        setError("Name is required")
        setIsLoading(false)
        return
      }
      const result = await signUpWithEmail(email, password, name)
      if (result.success) {
        setSignUpSuccess(true)
      } else {
        setError(result.error || "Sign up failed")
      }
    } else {
      const result = await signInWithEmail(email, password)
      if (result.success) {
        window.location.href = "/"
      } else {
        setError(result.error || "Please verify your email to log in.")
      }
    }

    setIsLoading(false)
  }

  const handleGuest = () => {
    continueAsGuest()
    router.push("/")
  }

  if (authLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
      >
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </main>
    )
  }

  if (user) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
      >
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </main>
    )
  }

  if (signUpSuccess) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
        style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
      >
        <div className="w-full max-w-sm">
          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-lg text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Check Your Email</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
              We sent a confirmation link to <strong>{email}</strong>. Please click the link to verify your account.
            </p>
            <button
              onClick={() => {
                setSignUpSuccess(false)
                setMode("email-login")
              }}
              className="w-full py-3 rounded-xl text-white font-semibold transition-colors"
              style={{ backgroundColor: "var(--apple-blue)" }}
            >
              Back to Login
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
    >
      <div className="w-full max-w-sm animate-spring-in relative z-10">
        {(mode === "email-login" || mode === "email-signup") && (
          <button
            onClick={() => setMode("login")}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-40 bg-white" />
            <div className="relative w-20 h-20 rounded-2xl bg-white/90 dark:bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-xl">
              <Sparkles className="w-10 h-10" style={{ color: "var(--apple-blue)" }} />
            </div>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-lg">
          {(mode === "login" || mode === "signup") && (
            <>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 text-center">
                {mode === "login" ? "Welcome Back" : "Create Account"}
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 text-center">
                {mode === "login" ? "Sign in to continue" : "Sign up to get started"}
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-3 w-full py-3.5 px-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continue with Google
                </button>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                <span className="text-xs text-zinc-400">or</span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              </div>

              <button
                onClick={() => setMode(mode === "login" ? "email-login" : "email-signup")}
                className="flex items-center justify-center gap-3 w-full py-3.5 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Mail className="w-5 h-5" />
                Continue with Email
              </button>

              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-6">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="font-medium hover:underline"
                  style={{ color: "var(--apple-blue)" }}
                >
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </>
          )}

          {(mode === "email-login" || mode === "email-signup") && (
            <>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 text-center">
                {mode === "email-login" ? "Sign In" : "Create Account"}
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 text-center">
                {mode === "email-login" ? "Enter your credentials" : "Fill in your details"}
              </p>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {mode === "email-signup" && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-12"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    className={`text-sm text-center p-3 rounded-xl ${
                      error.includes("verify your email")
                        ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                        : "text-red-500"
                    }`}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl text-white font-semibold transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: "var(--apple-blue)" }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {mode === "email-login" ? "Signing In..." : "Creating Account..."}
                    </>
                  ) : mode === "email-login" ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-6">
                {mode === "email-login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setMode(mode === "email-login" ? "email-signup" : "email-login")}
                  className="font-medium hover:underline"
                  style={{ color: "var(--apple-blue)" }}
                >
                  {mode === "email-login" ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </>
          )}
        </div>

        {(mode === "login" || mode === "signup") && (
          <button
            onClick={handleGuest}
            className="w-full mt-4 py-3 text-white/80 hover:text-white font-medium transition-colors"
          >
            Continue as Guest
          </button>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
        >
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
