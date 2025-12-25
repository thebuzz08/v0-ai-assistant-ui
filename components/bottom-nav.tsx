"use client"

import { cn } from "@/lib/utils"
import { Home, Calendar, Settings, FileText } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const baseNavItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-border/50 pb-[env(safe-area-inset-bottom)] transform-gpu">
      <div className="flex items-center justify-around py-2 px-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {baseNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors duration-150 touch-manipulation select-none",
                isActive ? "text-[var(--apple-blue)]" : "text-muted-foreground active:text-foreground",
              )}
            >
              <item.icon className="w-6 h-6" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
