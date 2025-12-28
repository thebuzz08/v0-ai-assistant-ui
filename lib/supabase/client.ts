"use client"

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

let supabaseInstance: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance
  }

  supabaseInstance = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return supabaseInstance
}

// Create a Supabase client with Clerk session token for RLS
export function createClerkSupabaseClient(getToken: () => Promise<string | null>) {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    async accessToken() {
      return (await getToken()) ?? null
    },
  })
}

export function resetClient() {
  supabaseInstance = null
}
