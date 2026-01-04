import { NextResponse } from "next/server"

// This endpoint provides a temporary Deepgram API key for client-side WebSocket connection
// In production, you'd want to use Deepgram's temporary keys API for better security
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "Deepgram API key not configured" }, { status: 500 })
  }

  // Return the API key for WebSocket connection
  // The client will connect directly to Deepgram's WebSocket
  return NextResponse.json({
    apiKey,
    // Deepgram WebSocket URL with recommended settings for low latency
    wsUrl:
      "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&utterance_end_ms=1000&vad_events=true&endpointing=300",
  })
}
