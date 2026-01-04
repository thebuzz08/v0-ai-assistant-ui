import { NextResponse } from "next/server"

export async function POST() {
  try {
    return NextResponse.json({
      token: process.env.DEEPGRAM_API_KEY,
    })
  } catch (error) {
    console.error("[v0] Error getting Deepgram token:", error)
    return NextResponse.json({ error: "Failed to get token" }, { status: 500 })
  }
}
