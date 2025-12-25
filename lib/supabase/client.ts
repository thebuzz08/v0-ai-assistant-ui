"use client"

// The PKCE verifier is stored in cookies by @supabase/ssr, which the server callback needs
import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

// Singleton instance - only created once when actually needed
let supabaseInstance: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance
  }

  // Create the client using @supabase/ssr for cookie-based PKCE
  supabaseInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return supabaseInstance
}

export function resetClient() {
  supabaseInstance = null
}
