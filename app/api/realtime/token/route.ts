import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "verse",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI Realtime API error:", errorText)
      return NextResponse.json({ error: "Failed to create session", details: errorText }, { status: response.status })
    }

    const data = await response.json()
    console.log("[v0] Session created, model:", data.model)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error creating realtime session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
