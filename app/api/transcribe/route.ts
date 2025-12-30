import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY!)

    const connection = deepgram.listen.live({
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      punctuate: true,
      interim_results: true,
      endpointing: 300,
    })

    const body = await request.arrayBuffer()
    const audioData = new Uint8Array(body)

    return new Promise<NextResponse>((resolve) => {
      let transcript = ""
      let isInterim = true

      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("[v0] Deepgram connection opened")
        connection.send(audioData)
        connection.finish()
      })

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const result = data.channel?.alternatives?.[0]
        if (result) {
          transcript = result.transcript
          isInterim = !data.is_final
        }
      })

      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log("[v0] Deepgram connection closed")
        resolve(
          NextResponse.json({
            transcript,
            isInterim,
          }),
        )
      })

      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error("[v0] Deepgram error:", error)
        resolve(NextResponse.json({ error: "Transcription failed" }, { status: 500 }))
      })
    })
  } catch (error) {
    console.error("[v0] Transcription error:", error)
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 })
  }
}
