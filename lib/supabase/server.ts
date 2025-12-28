import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { auth } from "@clerk/nextjs/server"

// Create a Supabase client for server-side usage with Clerk auth
export async function createClient() {
  const { getToken } = await auth()

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    async accessToken() {
      return (await getToken()) ?? null
    },
  })
}

// Create a simple Supabase client without auth (for public operations)
export function createPublicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
