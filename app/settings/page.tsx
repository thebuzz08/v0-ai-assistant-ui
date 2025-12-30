"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/lib/auth-context"
import { useCalendar } from "@/lib/calendar-context"
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Loader2,
  LogOut,
  Moon,
  Sun,
  User,
  Volume2,
  Bell,
  Shield,
  HelpCircle,
  Scale,
} from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
  const router = useRouter()
  const { user, signOut, isLoading: authLoading } = useAuth()
  const { isConnected, userInfo, checkConnectionStatus, connectGoogle, disconnect } = useCalendar()
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    checkConnectionStatus()

    // Load saved theme preference
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [checkConnectionStatus])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await signOut()
    router.push("/login")
  }

  const handleDisconnectCalendar = async () => {
    setIsDisconnecting(true)
    await disconnect()
    setIsDisconnecting(false)
  }

  const handleConnectCalendar = () => {
    connectGoogle("readwrite")
  }

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else if (newTheme === "light") {
      document.documentElement.classList.remove("dark")
    } else {
      // System preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }

  if (!mounted || authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))` }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  // Check if user signed in with Google (calendar auto-connected via Clerk)
  const isGoogleUser = user?.provider === "google"

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom, var(--gradient-start) 0%, var(--gradient-start) 15%, var(--gradient-end) 45%, var(--gradient-end) 100%)`,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between p-4">
            <Link href="/home" className="p-2 -ml-2 hover:bg-white/20 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <h1 className="text-xl font-semibold text-white">Settings</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="px-4 space-y-6">
          {/* Profile Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1a7f7f] to-[#2da8a8] flex items-center justify-center overflow-hidden">
                {user?.picture ? (
                  <img
                    src={user.picture || "/placeholder.svg"}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-800">{user?.name || "User"}</h2>
                <p className="text-sm text-gray-500">{user?.email || "No email"}</p>
                {isGoogleUser && (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs text-[#1a7f7f] bg-[#1a7f7f]/10 px-2 py-0.5 rounded-full">
                    <Check className="w-3 h-3" />
                    Google Account
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Calendar Connection */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Calendar</h3>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isConnected ? "bg-green-100" : "bg-gray-100"
                    }`}
                  >
                    <Calendar className={`w-5 h-5 ${isConnected ? "text-green-600" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Google Calendar</p>
                    {isConnected ? (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {isGoogleUser ? "Connected via Google Sign-in" : `Connected as ${userInfo?.email || "user"}`}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Not connected</p>
                    )}
                  </div>
                </div>

                {isConnected ? (
                  isGoogleUser ? (
                    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">Auto-connected</span>
                  ) : (
                    <button
                      onClick={handleDisconnectCalendar}
                      disabled={isDisconnecting}
                      className="text-sm text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
                    >
                      {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disconnect"}
                    </button>
                  )
                ) : (
                  <button
                    onClick={handleConnectCalendar}
                    className="text-sm text-[#1a7f7f] hover:text-[#15696a] font-medium flex items-center gap-1"
                  >
                    Connect
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isGoogleUser && isConnected && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                  Your Google Calendar is automatically connected because you signed in with Google. To disconnect, you
                  would need to sign out and use a different account.
                </p>
              )}
            </div>
          </div>

          {/* Appearance */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Appearance</h3>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    {theme === "dark" ? (
                      <Moon className="w-5 h-5 text-purple-600" />
                    ) : (
                      <Sun className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Theme</p>
                    <p className="text-sm text-gray-500 capitalize">{theme}</p>
                  </div>
                </div>

                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  {(["light", "dark", "system"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        theme === t ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* More Settings */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">More</h3>
            </div>

            <div className="divide-y divide-gray-100">
              <button className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-800">Voice Settings</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="font-medium text-gray-800">Notifications</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <Link
                href="/privacy"
                className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-800">Privacy Policy</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>

              <Link
                href="/terms"
                className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Scale className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="font-medium text-gray-800">Terms of Service</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>

              <button className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-800">Help & Support</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </>
            )}
          </button>

          {/* Version */}
          <p className="text-center text-xs text-gray-400 pb-4">Version 1.0.0</p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
