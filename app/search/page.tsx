"use client"

import { useState } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { SearchIcon, Clock, Mic } from "lucide-react"

const recentSearches = ["meeting with John", "project deadline", "coffee preferences", "doctor appointment"]

const suggestedQueries = [
  "What did I discuss yesterday?",
  "Action items from meetings",
  "People I met this week",
  "Upcoming reminders",
]

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [isListening, setIsListening] = useState(false)

  return (
    <main className="min-h-screen bg-white dark:bg-black pb-24">
      {/* Gradient Header */}
      <div className="bg-gradient-to-b from-blue-400 via-blue-300 to-white dark:from-blue-600 dark:via-blue-900 dark:to-black pt-14 px-6 pb-8">
        <h1 className="text-3xl font-bold text-white drop-shadow-sm">Search</h1>
        <p className="text-white/80">Find anything in your memories</p>
      </div>

      <div className="px-6 space-y-6 -mt-2">
        {/* Search Input */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
          <SearchIcon className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            type="text"
            placeholder="Search your memories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400"
          />
          <button
            onClick={() => setIsListening(!isListening)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? "bg-blue-500 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>

        {/* Recent Searches */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Recent Searches</h2>
          <div className="space-y-2">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => setQuery(search)}
                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <Clock className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-900 dark:text-white">{search}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Suggested Queries */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Try asking...</h2>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setQuery(suggestion)}
                className="px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Search Results Placeholder */}
        {query && (
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Results</h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 text-center shadow-sm">
              <p className="text-zinc-500">Searching for &ldquo;{query}&rdquo;...</p>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
