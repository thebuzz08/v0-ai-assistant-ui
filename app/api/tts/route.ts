import { NextRequest } from "next/server"

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// Rachel voice - clear, natural, fast
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
// Fastest model for low latency
const MODEL_ID = "eleven_flash_v2_5"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return new Response("No text provided", { status: 400 })
    }

    if (!ELEVENLABS_API_KEY) {
      return new Response("ElevenLabs API key not configured", { status: 500 })
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?optimize_streaming_latency=4`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.1,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error("[TTS] ElevenLabs error:", error)
      return new Response("TTS failed", { status: 500 })
    }

    // Stream the audio directly to the client
    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    console.error("[TTS] Error:", error)
    return new Response("TTS error", { status: 500 })
  }
}
