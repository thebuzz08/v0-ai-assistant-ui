import { type NextRequest, NextResponse } from "next/server"

export const runtime = "edge"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { messages, systemPrompt } = await request.json()

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.5,
        max_tokens: 200,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Groq API error:", errorText)
      return NextResponse.json({ error: "AI service error" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
