import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function needsWebSearch(text: string): boolean {
  const searchKeywords = [
    "today",
    "yesterday",
    "this week",
    "this month",
    "this year",
    "recent",
    "latest",
    "current",
    "now",
    "2024",
    "2025",
    "2026",
    "news",
    "happened",
    "stock",
    "price",
    "weather",
    "score",
    "won",
    "died",
    "released",
    "announced",
    "launched",
  ]
  const lowerText = text.toLowerCase()
  return searchKeywords.some((keyword) => lowerText.includes(keyword))
}

async function searchTavily(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return ""

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 3,
      }),
    })

    const data = await response.json()
    if (data.results && data.results.length > 0) {
      return data.results.map((r: { title: string; content: string }) => `${r.title}: ${r.content}`).join("\n")
    }
    return ""
  } catch {
    return ""
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get("text")

  if (!text || text.trim().length < 5) {
    return Response.json({ isComplete: false, question: null })
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `Detect if there's a complete, answerable question in this speech. Return JSON only.

ANSWER these (return isComplete: true):
- Math: "what is 5+5", "how much is 17 times 4"
- Facts: "who is Elon Musk", "what's the capital of Japan"  
- Info: "what happened in the news", "how tall is the Eiffel Tower"
- Explanations: "why is the sky blue", "how does wifi work"

IGNORE these (return isComplete: false):
- Incomplete: "what is the", "who was"
- Greetings: "how are you", "hey siri", "what's up"
- Personal: "how was my day", "what should I do"
- Non-questions: "yeah okay", "so anyway", "I was thinking"
- Single words/numbers alone: "three", "what", "hello"

Extract the actual question, ignoring filler words like "yeah", "so", "um", "hey siri".

Return: {"isComplete": true/false, "question": "the extracted question" or null}`,
        },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 80,
      response_format: { type: "json_object" },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"isComplete": false, "question": null}')
    return Response.json(result)
  } catch (error) {
    console.error("[v0] Detection error:", error)
    return Response.json({ isComplete: false, question: null })
  }
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text || text.trim().length < 3) {
      return new Response("data: [DONE]\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      })
    }

    let searchContext = ""
    if (needsWebSearch(text)) {
      searchContext = await searchTavily(text)
    }

    const systemPrompt = `Ultra-concise voice assistant. Answer in 2-8 words only.

Rules:
- Direct answer, no preamble or explanation
- Use search results if provided for accuracy
- Numbers: just the number (e.g., "68" not "The answer is 68")
- Facts: key info only (e.g., "Tesla CEO" not "He is the CEO of Tesla")

${searchContext ? `\nSearch results:\n${searchContext}` : ""}`

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 40,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || ""
            if (token) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        } catch (error) {
          console.error("[v0] Stream error:", error)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("[v0] POST error:", error)
    return new Response("data: [DONE]\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    })
  }
}
