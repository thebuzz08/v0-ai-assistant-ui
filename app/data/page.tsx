"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, MessageSquare, Clock, Calendar, FileText, Mic, Brain, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useNotes } from "@/lib/notes-context"

interface Stats {
  conversations: number
  totalMinutes: number
  calendarEventsCreated: number
  calendarEventsDeleted: number
  noteSessions: number
  aiResponses: number
  wordsTranscribed: number
}

export default function DataPage() {
  const [stats, setStats] = useState<Stats>({
    conversations: 0,
    totalMinutes: 0,
    calendarEventsCreated: 0,
    calendarEventsDeleted: 0,
    noteSessions: 0,
    aiResponses: 0,
    wordsTranscribed: 0,
  })
  const { notes } = useNotes()

  useEffect(() => {
    // Load stats from localStorage
    const stored = localStorage.getItem("app_stats")
    if (stored) {
      setStats(JSON.parse(stored))
    }

    // Calculate note sessions from notes context
    if (notes.length > 0) {
      setStats((prev) => ({ ...prev, noteSessions: notes.length }))
    }
  }, [notes])

  const statCards = [
    {
      icon: MessageSquare,
      label: "Conversations",
      value: stats.conversations,
      color: "text-blue-500",
      bgColor: "bg-blue-100 dark:bg-blue-500/20",
    },
    {
      icon: Clock,
      label: "Minutes with AI",
      value: stats.totalMinutes,
      color: "text-purple-500",
      bgColor: "bg-purple-100 dark:bg-purple-500/20",
    },
    {
      icon: Brain,
      label: "AI Responses",
      value: stats.aiResponses,
      color: "text-pink-500",
      bgColor: "bg-pink-100 dark:bg-pink-500/20",
    },
    {
      icon: FileText,
      label: "Note Sessions",
      value: stats.noteSessions,
      color: "text-orange-500",
      bgColor: "bg-orange-100 dark:bg-orange-500/20",
    },
    {
      icon: Calendar,
      label: "Events Created",
      value: stats.calendarEventsCreated,
      color: "text-green-500",
      bgColor: "bg-green-100 dark:bg-green-500/20",
    },
    {
      icon: TrendingUp,
      label: "Events Modified",
      value: stats.calendarEventsDeleted,
      color: "text-red-500",
      bgColor: "bg-red-100 dark:bg-red-500/20",
    },
    {
      icon: Mic,
      label: "Words Transcribed",
      value: stats.wordsTranscribed.toLocaleString(),
      color: "text-cyan-500",
      bgColor: "bg-cyan-100 dark:bg-cyan-500/20",
    },
  ]

  return (
    <main className="min-h-screen bg-white dark:bg-black pb-12">
      {/* Gradient Header */}
      <div className="bg-gradient-to-b from-blue-400 via-blue-300 to-white dark:from-blue-600 dark:via-blue-900 dark:to-black pt-14 px-6 pb-8">
        <Link href="/settings" className="inline-flex items-center gap-1 text-white/80 mb-4 -ml-1">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Settings</span>
        </Link>
        <h1 className="text-3xl font-bold text-white drop-shadow-sm">Your Data</h1>
        <p className="text-white/80">Usage statistics and insights</p>
      </div>

      <div className="px-6 space-y-6 -mt-2">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.slice(0, 4).map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Secondary Stats */}
        <div>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3 px-1">Calendar Activity</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm">
            {statCards.slice(4, 6).map((stat, index) => (
              <div key={stat.label}>
                {index > 0 && <div className="border-t border-zinc-100 dark:border-zinc-800" />}
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-zinc-500">{stat.label}</div>
                    <div className="text-xl font-semibold text-zinc-900 dark:text-white">{stat.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transcription Stats */}
        <div>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3 px-1">Transcription</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${statCards[6].bgColor} flex items-center justify-center`}>
                <Mic className={`w-5 h-5 ${statCards[6].color}`} />
              </div>
              <div className="flex-1">
                <div className="text-sm text-zinc-500">{statCards[6].label}</div>
                <div className="text-xl font-semibold text-zinc-900 dark:text-white">{statCards[6].value}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 text-center">
            All data is stored locally on your device and is never shared with third parties.
          </p>
        </div>
      </div>
    </main>
  )
}
