"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Mail, Loader2 } from "lucide-react"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const description = searchParams.get("description")

  const isAccountExistsError = error === "account_exists"

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))`,
      }}
    >
      <div className="w-full max-w-sm">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-lg text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">
            {isAccountExistsError ? "Account Already Exists" : "Authentication Error"}
          </h1>

          {isAccountExistsError ? (
            <>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                An account with this email already exists. Sign in with your email and password first, then you can link
                your Google account from Settings.
              </p>
              <div className="space-y-3">
                <Link
                  href="/login?mode=email"
                  className="inline-flex items-center justify-center w-full py-3 rounded-xl text-white font-semibold transition-colors gap-2"
                  style={{ backgroundColor: "var(--apple-blue)" }}
                >
                  <Mail className="w-5 h-5" />
                  Sign in with Email
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center w-full py-3 rounded-xl text-zinc-700 dark:text-zinc-300 font-medium transition-colors bg-zinc-100 dark:bg-zinc-800"
                >
                  Back to Login
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-2">
                {error || "An error occurred during sign in."}
              </p>
              {description && (
                <p className="text-zinc-400 dark:text-zinc-500 text-xs mb-6 break-words">{description}</p>
              )}
              {!description && <div className="mb-6" />}
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full py-3 rounded-xl text-white font-semibold transition-colors"
                style={{ backgroundColor: "var(--apple-blue)" }}
              >
                Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{
            background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))`,
          }}
        >
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </main>
      }
    >
      <AuthErrorContent />
    </Suspense>
  )
}
