import { NextResponse } from "next/server"

// This endpoint provides a temporary Deepgram API key for client-side WebSocket connection
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "Deepgram API key not configured" }, { status: 500 })
  }

  // Return the API key for WebSocket connection
  return NextResponse.json({
    apiKey,
    wsUrl:
      "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true&utterance_end_ms=1000&vad_events=true&endpointing=300&encoding=linear16&sample_rate=16000",
  })
}
