"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useUser, useClerk, useSession } from "@clerk/nextjs"

export type AuthUser = {
  id: string
  email: string
  name: string
  picture?: string
  provider: "google" | "email" | "guest"
}

type AuthContextType = {
  user: AuthUser | null
  isLoading: boolean
  isGuest: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  continueAsGuest: () => void
  signOut: () => Promise<void>
  linkGoogleAccount: () => Promise<{ success: boolean; error?: string }>
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const { session } = useSession()
  const clerk = useClerk()
  const [guestUser, setGuestUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Convert Clerk user to our AuthUser format
  const user: AuthUser | null = (() => {
    if (guestUser) return guestUser
    if (!clerkUser) return null

    const googleAccount = clerkUser.externalAccounts?.find((acc) => acc.provider === "google")
    const isGoogleUser = !!googleAccount

    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || "",
      name:
        clerkUser.fullName || clerkUser.firstName || clerkUser.primaryEmailAddress?.emailAddress?.split("@")[0] || "",
      picture: clerkUser.imageUrl,
      provider: isGoogleUser ? "google" : "email",
    }
  })()

  useEffect(() => {
    if (clerkLoaded) {
      // Check for guest mode
      const guestMode = localStorage.getItem("auth_guest_mode")
      if (guestMode === "true" && !clerkUser) {
        setGuestUser({
          id: "guest",
          email: "",
          name: "Guest",
          provider: "guest",
        })
      }
      setIsLoading(false)
    }
  }, [clerkLoaded, clerkUser])

  const signInWithGoogle = useCallback(async () => {
    localStorage.removeItem("auth_guest_mode")
    setGuestUser(null)

    // Redirect to Clerk's Google OAuth with calendar scopes
    clerk.redirectToSignIn({
      redirectUrl: "/",
      signInForceRedirectUrl: "/",
    })
  }, [clerk])

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      localStorage.removeItem("auth_guest_mode")
      setGuestUser(null)

      try {
        const result = await clerk.client?.signIn.create({
          identifier: email,
          password,
        })

        if (result?.status === "complete") {
          await clerk.setActive({ session: result.createdSessionId })
          return { success: true }
        }

        return { success: false, error: "Sign in failed" }
      } catch (error: any) {
        return { success: false, error: error.errors?.[0]?.message || error.message || "Sign in failed" }
      }
    },
    [clerk],
  )

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      localStorage.removeItem("auth_guest_mode")
      setGuestUser(null)

      try {
        const result = await clerk.client?.signUp.create({
          emailAddress: email,
          password,
          firstName: name.split(" ")[0],
          lastName: name.split(" ").slice(1).join(" ") || undefined,
        })

        if (result?.status === "complete") {
          await clerk.setActive({ session: result.createdSessionId })
          return { success: true }
        }

        // Handle email verification if needed
        if (result?.status === "missing_requirements") {
          await result.prepareEmailAddressVerification({ strategy: "email_code" })
          return { success: false, error: "Please check your email for a verification code." }
        }

        return { success: false, error: "Sign up failed" }
      } catch (error: any) {
        return { success: false, error: error.errors?.[0]?.message || error.message || "Sign up failed" }
      }
    },
    [clerk],
  )

  const continueAsGuest = useCallback(() => {
    localStorage.setItem("auth_guest_mode", "true")
    setGuestUser({
      id: "guest",
      email: "",
      name: "Guest",
      provider: "guest",
    })
  }, [])

  const signOut = useCallback(async () => {
    localStorage.removeItem("auth_guest_mode")
    localStorage.removeItem("onboarding_complete")
    setGuestUser(null)
    await clerk.signOut()
  }, [clerk])

  const linkGoogleAccount = useCallback(async () => {
    try {
      // Use Clerk's OAuth to link Google account
      const redirectUrl = `${window.location.origin}/`
      await clerk.redirectToSignIn({
        redirectUrl,
        signInForceRedirectUrl: redirectUrl,
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to link Google account" }
    }
  }, [clerk])

  const getToken = useCallback(async () => {
    return session?.getToken() ?? null
  }, [session])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isGuest: user?.provider === "guest",
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        continueAsGuest,
        signOut,
        linkGoogleAccount,
        getToken,
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
