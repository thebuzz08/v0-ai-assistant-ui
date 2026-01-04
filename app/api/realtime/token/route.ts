import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "verse",
        modalities: ["text", "audio"],
        instructions: `You are Omnisound, a helpful voice assistant. The current time is ${new Date().toLocaleTimeString()} on ${new Date().toLocaleDateString()}.

CRITICAL BEHAVIOR:
- ONLY respond to direct questions or requests
- If the user is just talking, narrating, or making statements, stay SILENT
- Examples of when to RESPOND: "what's 5+5?", "what time is it?", "schedule a meeting", "what's on my calendar?"
- Examples of when to stay SILENT: "I'm walking to the store", "the weather is nice", "just talking to myself"

RESPONSE RULES:
- Keep answers concise and natural
- For math/facts: give just the answer ("10", not "the answer is 10")
- For calendar: only report actual events, never make up events
- Use conversational tone, not robotic

If unsure whether to respond, err on the side of silence.`,
        temperature: 0.8,
        max_response_output_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI Realtime API error:", errorText)
      return NextResponse.json({ error: "Failed to create session" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error creating realtime session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
