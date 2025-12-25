"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { createClient, resetClient } from "@/lib/supabase/client"
import type { User, SupabaseClient } from "@supabase/supabase-js"

export type AuthUser = {
  id: string
  email: string
  name: string
  picture?: string
  provider: "google" | "apple" | "email" | "guest"
  hasPassword?: boolean
  googleCalendarConnected?: boolean
}

type AuthContextType = {
  user: AuthUser | null
  supabaseUser: User | null
  isLoading: boolean
  isGuest: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  continueAsGuest: () => void
  signOut: () => Promise<void>
  linkGoogleAccount: () => Promise<{ success: boolean; error?: string }>
  addPassword: (password: string) => Promise<{ success: boolean; error?: string }>
  checkHasPassword: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const initRef = useRef(false)
  const mountedRef = useRef(true)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      try {
        supabaseRef.current = createClient()
      } catch (error) {
        console.error("[v0] Failed to create Supabase client:", error)
        return null
      }
    }
    return supabaseRef.current
  }, [])

  const toAuthUser = useCallback((supaUser: User): AuthUser => {
    const provider = supaUser.app_metadata?.provider
    const isGoogleUser = provider === "google"
    const hasPassword =
      supaUser.app_metadata?.providers?.includes("email") || supaUser.identities?.some((i) => i.provider === "email")

    return {
      id: supaUser.id,
      email: supaUser.email || "",
      name: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.email?.split("@")[0] || "",
      picture: supaUser.user_metadata?.avatar_url || supaUser.user_metadata?.picture,
      provider: isGoogleUser ? "google" : provider === "apple" ? "apple" : "email",
      hasPassword: hasPassword || false,
      googleCalendarConnected: isGoogleUser,
    }
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    mountedRef.current = true

    const initAuth = async () => {
      try {
        if (typeof window !== "undefined") {
          const guestMode = localStorage.getItem("auth_guest_mode")
          if (guestMode === "true") {
            if (mountedRef.current) {
              setUser({
                id: "guest",
                email: "",
                name: "Guest",
                provider: "guest",
              })
              setIsLoading(false)
            }
            return
          }
        }

        const supabase = getSupabase()
        if (!supabase) {
          console.error("[v0] Supabase client not available")
          if (mountedRef.current) setIsLoading(false)
          return
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("[v0] Session error:", sessionError.message)
          if (mountedRef.current) setIsLoading(false)
          return
        }

        if (session?.user && mountedRef.current) {
          setSupabaseUser(session.user)
          setUser(toAuthUser(session.user))
        }

        if (mountedRef.current) setIsLoading(false)

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (!mountedRef.current) return

          if (newSession?.user) {
            setSupabaseUser(newSession.user)
            setUser(toAuthUser(newSession.user))
          } else if (event === "SIGNED_OUT") {
            setUser(null)
            setSupabaseUser(null)
          }

          setIsLoading(false)
        })

        return () => {
          subscription.unsubscribe()
        }
      } catch (error) {
        console.error("[v0] Auth init error:", error)
        if (mountedRef.current) setIsLoading(false)
      }
    }

    initAuth()

    return () => {
      mountedRef.current = false
    }
  }, [toAuthUser, getSupabase])

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return

    localStorage.removeItem("auth_guest_mode")

    const redirectUrl =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "https://omnisound.xyz/auth/callback"

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
      },
    })
  }, [getSupabase])

  const signInWithApple = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return

    localStorage.removeItem("auth_guest_mode")

    const redirectUrl =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "https://omnisound.xyz/auth/callback"

    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: redirectUrl },
    })
  }, [getSupabase])

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase()
      if (!supabase) return { success: false, error: "Authentication service unavailable" }

      localStorage.removeItem("auth_guest_mode")

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          return {
            success: false,
            error: "Please verify your email before signing in. Check your inbox for the verification link.",
          }
        }
        return { success: false, error: error.message }
      }

      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut()
        return {
          success: false,
          error: "Please verify your email before signing in. Check your inbox for the verification link.",
        }
      }

      return { success: true }
    },
    [getSupabase],
  )

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      const supabase = getSupabase()
      if (!supabase) return { success: false, error: "Authentication service unavailable" }

      localStorage.removeItem("auth_guest_mode")

      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : "https://omnisound.xyz/auth/callback"

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || redirectUrl,
          data: { full_name: name, name },
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data.user?.identities?.length === 0) {
        return {
          success: false,
          error: "An account with this email already exists. Please sign in with Google or use your password.",
        }
      }

      return { success: true }
    },
    [getSupabase],
  )

  const continueAsGuest = useCallback(() => {
    localStorage.setItem("auth_guest_mode", "true")
    document.cookie = "auth_guest_mode=true; path=/; max-age=31536000; SameSite=Lax"
    setUser({
      id: "guest",
      email: "",
      name: "Guest",
      provider: "guest",
    })
  }, [])

  const signOut = useCallback(async () => {
    try {
      const supabase = getSupabase()
      localStorage.removeItem("auth_guest_mode")
      localStorage.removeItem("onboarding_complete")
      document.cookie = "auth_guest_mode=; path=/; max-age=0"
      document.cookie = "onboarding_complete=; path=/; max-age=0"
      document.cookie = "google_calendar_connected=; path=/; max-age=0"
      if (supabase) {
        await supabase.auth.signOut()
      }
      resetClient()
      supabaseRef.current = null
      setUser(null)
      setSupabaseUser(null)
    } catch (error) {
      console.error("[v0] Sign out error:", error)
      setUser(null)
      setSupabaseUser(null)
    }
  }, [getSupabase])

  const linkGoogleAccount = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return { success: false, error: "Authentication service unavailable" }

    const redirectUrl =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "https://omnisound.xyz/auth/callback"

    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  }, [getSupabase])

  const addPassword = useCallback(
    async (password: string) => {
      const supabase = getSupabase()
      if (!supabase) return { success: false, error: "Authentication service unavailable" }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    },
    [getSupabase],
  )

  const checkHasPassword = useCallback(async () => {
    if (!supabaseUser) return false
    return (
      supabaseUser.app_metadata?.providers?.includes("email") ||
      supabaseUser.identities?.some((i) => i.provider === "email") ||
      false
    )
  }, [supabaseUser])

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        isLoading,
        isGuest: user?.provider === "guest",
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        signUpWithEmail,
        continueAsGuest,
        signOut,
        linkGoogleAccount,
        addPassword,
        checkHasPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
