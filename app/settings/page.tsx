"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SettingRow } from "@/components/setting-row"
import { BottomNav } from "@/components/bottom-nav"
import { useCalendar } from "@/lib/calendar-context"
import { useMicrophone } from "@/lib/microphone-context"
import { useAuth } from "@/lib/auth-context"
import {
  Volume2,
  Bell,
  Moon,
  Shield,
  HelpCircle,
  Info,
  Trash2,
  Radio,
  Calendar,
  ExternalLink,
  X,
  Check,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  BarChart3,
  ShieldOff,
  LogOut,
  User,
  Lock,
} from "lucide-react"
import Link from "next/link"

function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-card rounded-3xl w-full max-w-sm shadow-xl animate-spring-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, signOut, isGuest, linkGoogleAccount, addPassword } = useAuth()
  const [settings, setSettings] = useState({
    whisperMode: true,
    notifications: true,
    darkMode: false,
  })

  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [pendingSafetyModeChange, setPendingSafetyModeChange] = useState<boolean | null>(null)
  const [showAddPasswordModal, setShowAddPasswordModal] = useState(false)
  const [showLinkGoogleModal, setShowLinkGoogleModal] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const {
    isConnected: calendarConnected,
    connectGoogle,
    disconnect: disconnectCalendar,
    isLoading: calendarLoading,
    calendarProvider,
    calendarPermission,
    canWriteEvents,
  } = useCalendar()
  const { safetyMode, setSafetyMode } = useMicrophone()
  const searchParams = useSearchParams()

  const isGoogleUser = user?.provider === "google"
  const calendarConnectedViaGoogle = isGoogleUser && user?.googleCalendarConnected
  const isCalendarConnected = calendarConnected || calendarConnectedViaGoogle

  useEffect(() => {
    const stored = localStorage.getItem("darkMode")
    if (stored !== null) {
      setSettings((prev) => ({ ...prev, darkMode: stored === "true" }))
    }
  }, [])

  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")

    if (success === "google_connected") {
      setActiveModal("calendar_success")
    } else if (error) {
      setActiveModal("calendar_error")
    }
  }, [searchParams])

  const updateSetting = (key: keyof typeof settings) => (value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    if (key === "darkMode") {
      localStorage.setItem("darkMode", String(value))
      if (value) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }

  const handleClearData = () => {
    localStorage.clear()
    setSettings({ whisperMode: true, notifications: true, darkMode: false })
    disconnectCalendar()
    document.documentElement.classList.remove("dark")
    setActiveModal(null)
  }

  const handleSafetyModeToggle = (value: boolean) => {
    if (!value) {
      setPendingSafetyModeChange(false)
      setActiveModal("safetyWarning")
    } else {
      setSafetyMode(true)
    }
  }

  const confirmSafetyModeChange = () => {
    if (pendingSafetyModeChange !== null) {
      setSafetyMode(pendingSafetyModeChange)
    }
    setPendingSafetyModeChange(null)
    setActiveModal(null)
  }

  const cancelSafetyModeChange = () => {
    setPendingSafetyModeChange(null)
    setActiveModal(null)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const handleAddPassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    const result = await addPassword(newPassword)
    if (result.success) {
      setPasswordSuccess(true)
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => {
        setShowAddPasswordModal(false)
        setPasswordSuccess(false)
      }, 2000)
    } else {
      setPasswordError(result.error || "Failed to add password")
    }
  }

  const handleLinkGoogle = async () => {
    const result = await linkGoogleAccount()
    if (!result.success) {
      alert(result.error || "Failed to link Google account")
    }
    setShowLinkGoogleModal(false)
  }

  return (
    <main className="flex-1 overflow-y-auto bg-background text-foreground">
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom, var(--gradient-start) 0%, var(--gradient-start) 15%, var(--gradient-end) 45%, var(--gradient-end) 100%)`,
        }}
      />

      <header className="pt-14 px-6 pb-6 relative z-10">
        <h1 className="text-3xl font-bold text-white drop-shadow-sm">Settings</h1>
      </header>

      <div className="px-6 space-y-6 relative z-10">
        <div>
          <h2 className="text-sm font-medium text-white/70 uppercase tracking-wide mb-2 px-4">Account</h2>
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--apple-blue)]/10 flex items-center justify-center">
                <User className="w-5 h-5 text-[var(--apple-blue)]" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{user?.name || "Guest"}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.email || (isGuest ? "Data stored locally only" : "Not signed in")}
                </p>
              </div>
            </div>
            {user && !isGuest && (
              <>
                <div className="border-t border-border" />
                {user.provider === "google" && !user.hasPassword && (
                  <SettingRow
                    icon={<Lock className="w-4 h-4" />}
                    title="Add Password"
                    subtitle="Enable email/password login"
                    type="link"
                    onClick={() => setShowAddPasswordModal(true)}
                  />
                )}
                {user.provider === "email" && (
                  <SettingRow
                    icon={<Link className="w-4 h-4" />}
                    title="Link Google Account"
                    subtitle="Sign in with Google and sync calendar"
                    type="link"
                    onClick={() => setShowLinkGoogleModal(true)}
                  />
                )}
              </>
            )}
            <div className="border-t border-border" />
            <SettingRow
              icon={<LogOut className="w-4 h-4" />}
              title={isGuest ? "Sign In" : "Sign Out"}
              subtitle={isGuest ? "Sign in to sync your data" : ""}
              type="link"
              onClick={() => (isGuest ? router.push("/login") : setActiveModal("signOut"))}
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-white/70 uppercase tracking-wide mb-2 px-4">Audio</h2>
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
            <SettingRow
              icon={<Volume2 className="w-4 h-4" />}
              title="Whisper Mode"
              subtitle="Quiet, discreet responses"
              type="toggle"
              value={settings.whisperMode}
              onToggle={updateSetting("whisperMode")}
            />
            <div className="border-t border-border" />
            <SettingRow
              icon={<Bell className="w-4 h-4" />}
              title="Notifications"
              type="toggle"
              value={settings.notifications}
              onToggle={updateSetting("notifications")}
            />
            <div className="border-t border-border" />
            <Link href="/live">
              <SettingRow
                icon={<Radio className="w-4 h-4" />}
                title="Live Feed"
                subtitle="View real-time transcription"
                type="link"
                onClick={() => {}}
              />
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground/70 uppercase tracking-wide mb-2 px-4">Integrations</h2>
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
            <SettingRow
              icon={<Calendar className="w-4 h-4" />}
              title="Google Calendar"
              subtitle={
                calendarConnectedViaGoogle
                  ? "Connected via Google Sign-in"
                  : isCalendarConnected
                    ? "Connected"
                    : "Sync your schedule"
              }
              type="custom"
              onClick={() => setActiveModal("calendar")}
              customElement={
                calendarLoading ? (
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                ) : isCalendarConnected ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                )
              }
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground/70 uppercase tracking-wide mb-2 px-4">Assistant</h2>
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
            <SettingRow
              icon={<ShieldCheck className="w-4 h-4" />}
              title="Safety Mode"
              subtitle="Confirm before deleting events"
              type="toggle"
              value={safetyMode}
              onToggle={handleSafetyModeToggle}
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground/70 uppercase tracking-wide mb-2 px-4">Appearance</h2>
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
            <SettingRow
              icon={<Moon className="w-4 h-4" />}
              title="Dark Mode"
              type="toggle"
              value={settings.darkMode}
              onToggle={updateSetting("darkMode")}
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground/70 uppercase tracking-wide mb-2 px-4">Privacy & Data</h2>
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
            <Link href="/data">
              <SettingRow
                icon={<BarChart3 className="w-4 h-4" />}
                title="Your Data"
                subtitle="View usage statistics"
                type="link"
                onClick={() => {}}
              />
            </Link>
            <div className="border-t border-border" />
            <SettingRow
              icon={<Shield className="w-4 h-4" />}
              title="Privacy Settings"
              type="link"
              onClick={() => setActiveModal("privacy")}
            />
            <div className="border-t border-border" />
            <SettingRow
              icon={<Trash2 className="w-4 h-4" />}
              title="Clear All Data"
              subtitle="Delete all memories, settings, and preferences"
              type="link"
              destructive
              onClick={() => setActiveModal("clearData")}
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground/70 uppercase tracking-wide mb-2 px-4">About</h2>
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden">
            <SettingRow
              icon={<HelpCircle className="w-4 h-4" />}
              title="Help & Support"
              type="link"
              onClick={() => setActiveModal("help")}
            />
            <div className="border-t border-border" />
            <SettingRow icon={<Info className="w-4 h-4" />} title="Version" type="info" value="1.0.0" />
          </div>
        </div>

        {/* Spacer for bottom nav */}
        <div className="h-24" />
      </div>

      <Modal isOpen={activeModal === "calendar"} onClose={() => setActiveModal(null)} title="Calendar">
        {isCalendarConnected ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <p className="text-foreground font-medium mb-1">Google Calendar Connected</p>
            <p className="text-sm text-muted-foreground mb-2">
              {calendarConnectedViaGoogle
                ? "Connected automatically via Google Sign-in"
                : canWriteEvents
                  ? "Full access - can view and add events"
                  : "View only access"}
            </p>
            {calendarConnectedViaGoogle ? (
              <p className="text-xs text-muted-foreground mb-6">
                To disconnect, sign out and sign in with email instead.
              </p>
            ) : (
              <button
                onClick={() => {
                  disconnectCalendar()
                  setActiveModal(null)
                }}
                className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors mt-4"
              >
                Disconnect Google Calendar
              </button>
            )}
          </div>
        ) : (
          <div className="py-4">
            <Calendar className="w-12 h-12 text-[var(--apple-blue)] mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1 text-center">Connect Your Calendar</p>
            <p className="text-sm text-muted-foreground mb-6 text-center">
              Allow the assistant to view and manage your calendar events.
            </p>
            <button
              onClick={() => connectGoogle("readwrite")}
              disabled={calendarLoading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--apple-blue)" }}
            >
              {calendarLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
          </div>
        )}
      </Modal>

      <Modal isOpen={activeModal === "calendar_success"} onClose={() => setActiveModal(null)} title="Success">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-foreground font-medium mb-1">Calendar Connected!</p>
          <p className="text-sm text-muted-foreground mb-4">Your calendar has been successfully linked.</p>
          <button
            onClick={() => setActiveModal(null)}
            className="w-full py-3 rounded-xl bg-[var(--apple-blue)] text-white font-medium"
          >
            Done
          </button>
        </div>
      </Modal>

      <Modal isOpen={activeModal === "calendar_error"} onClose={() => setActiveModal(null)} title="Connection Failed">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-foreground font-medium mb-1">Connection Failed</p>
          <p className="text-sm text-muted-foreground mb-4">Unable to connect to your calendar. Please try again.</p>
          <button
            onClick={() => setActiveModal(null)}
            className="w-full py-3 rounded-xl bg-muted text-foreground font-medium"
          >
            Close
          </button>
        </div>
      </Modal>

      <Modal isOpen={activeModal === "privacy"} onClose={() => setActiveModal(null)} title="Privacy Settings">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
            <div>
              <p className="text-foreground font-medium text-sm">Data Collection</p>
              <p className="text-xs text-muted-foreground">Allow anonymous usage data</p>
            </div>
            <button className="w-12 h-7 rounded-full bg-green-500 flex items-center px-1">
              <div className="w-5 h-5 rounded-full bg-white shadow ml-auto" />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
            <div>
              <p className="text-foreground font-medium text-sm">Voice Storage</p>
              <p className="text-xs text-muted-foreground">Store voice recordings locally</p>
            </div>
            <button className="w-12 h-7 rounded-full bg-green-500 flex items-center px-1">
              <div className="w-5 h-5 rounded-full bg-white shadow ml-auto" />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
            <div>
              <p className="text-foreground font-medium text-sm">Location Access</p>
              <p className="text-xs text-muted-foreground">For context-aware suggestions</p>
            </div>
            <button className="w-12 h-7 rounded-full bg-muted-foreground/30 flex items-center px-1">
              <div className="w-5 h-5 rounded-full bg-white shadow" />
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === "clearData"} onClose={() => setActiveModal(null)} title="Clear All Data">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-foreground font-medium mb-1">Are you sure?</p>
          <p className="text-sm text-muted-foreground mb-4">
            This will permanently delete all your memories, settings, and preferences. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveModal(null)}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium"
            >
              Cancel
            </button>
            <button onClick={handleClearData} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium">
              Delete All
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === "help"} onClose={() => setActiveModal(null)} title="Help & Support">
        <div className="space-y-3">
          <a href="#" className="block p-3 rounded-xl hover:bg-muted transition-colors">
            <p className="text-foreground font-medium text-sm">Getting Started Guide</p>
            <p className="text-xs text-muted-foreground">Learn the basics of using your assistant</p>
          </a>
          <a href="#" className="block p-3 rounded-xl hover:bg-muted transition-colors">
            <p className="text-foreground font-medium text-sm">FAQs</p>
            <p className="text-xs text-muted-foreground">Common questions and answers</p>
          </a>
          <a href="#" className="block p-3 rounded-xl hover:bg-muted transition-colors">
            <p className="text-foreground font-medium text-sm">Contact Support</p>
            <p className="text-xs text-muted-foreground">Get help from our team</p>
          </a>
          <a href="#" className="block p-3 rounded-xl hover:bg-muted transition-colors">
            <p className="text-foreground font-medium text-sm">Report a Bug</p>
            <p className="text-xs text-muted-foreground">Let us know about any issues</p>
          </a>
        </div>
      </Modal>

      <Modal isOpen={activeModal === "safetyWarning"} onClose={cancelSafetyModeChange} title="Disable Safety Mode">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
            <ShieldOff className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-foreground font-medium mb-1">Are you sure?</p>
          <p className="text-sm text-muted-foreground mb-4">
            With Safety Mode disabled, the AI assistant will delete, modify, or bulk-remove calendar events immediately
            without asking for confirmation.
          </p>
          <div className="flex gap-3">
            <button
              onClick={cancelSafetyModeChange}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium"
            >
              Cancel
            </button>
            <button
              onClick={confirmSafetyModeChange}
              className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-medium"
            >
              Disable
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === "signOut"} onClose={() => setActiveModal(null)} title="Sign Out">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
            <LogOut className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
          </div>
          <p className="text-foreground font-medium mb-1">Sign out of your account?</p>
          <p className="text-sm text-muted-foreground mb-4">You'll need to sign in again to access your synced data.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveModal(null)}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium"
            >
              Cancel
            </button>
            <button onClick={handleSignOut} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium">
              Sign Out
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddPasswordModal}
        onClose={() => {
          setShowAddPasswordModal(false)
          setNewPassword("")
          setConfirmPassword("")
          setPasswordError("")
          setPasswordSuccess(false)
        }}
        title="Add Password"
      >
        <div className="py-4">
          {passwordSuccess ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-foreground font-medium">Password added successfully!</p>
              <p className="text-sm text-muted-foreground mt-1">You can now sign in with email and password.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Add a password to your account to enable email/password sign-in alongside Google.
              </p>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setPasswordError("")
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setPasswordError("")
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground"
                />
                {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowAddPasswordModal(false)}
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPassword}
                  className="flex-1 py-3 rounded-xl bg-[var(--apple-blue)] text-white font-medium"
                >
                  Add Password
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={showLinkGoogleModal} onClose={() => setShowLinkGoogleModal(false)} title="Link Google Account">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
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
          </div>
          <p className="text-foreground font-medium mb-1">Link your Google account</p>
          <p className="text-sm text-muted-foreground mb-4">
            This will allow you to sign in with Google and automatically sync your Google Calendar.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLinkGoogleModal(false)}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleLinkGoogle}
              className="flex-1 py-3 rounded-xl bg-[var(--apple-blue)] text-white font-medium"
            >
              Link Google
            </button>
          </div>
        </div>
      </Modal>

      <BottomNav />
    </main>
  )
}
