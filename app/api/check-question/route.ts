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
  } catch (error) {
    console.error("[v0] Tavily search error:", error)
    return ""
  }
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text || text.trim().length < 2) {
      return Response.json({ isQuestion: false, answer: null })
    }

    let searchContext = ""
    if (needsWebSearch(text)) {
      searchContext = await searchTavily(text)
    }

    const systemPrompt = `You are an ultra-fast voice assistant. Answer ALL questions instantly in 2-8 words max.

RULES:
1. Just give the raw answer, no preamble
2. If search results are provided, use them for accuracy
3. ONLY respond "NOT_A_QUESTION" for statements/greetings like "hello" or "thanks"
4. ONLY respond "PERSONAL_QUESTION" for questions about the user's personal life you can't know (their grades, their feelings, their friends)
5. Answer ALL general knowledge, facts, math, science, news, current events, famous people, companies, etc.

${searchContext ? `\nSEARCH RESULTS:\n${searchContext}` : ""}`

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 50,
      stream: true,
    })

    // Create streaming response
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullText = ""

        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || ""
          if (token) {
            fullText += token
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
          }
        }

        // Check if it was a question
        const isNotQuestion = fullText.trim() === "NOT_A_QUESTION" || fullText.trim() === "PERSONAL_QUESTION"

        if (isNotQuestion) {
          // Send empty signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ notQuestion: true })}\n\n`))
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
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
    console.error("[v0] API Error:", error)
    return Response.json({ isQuestion: false, answer: null, error: String(error) }, { status: 500 })
  }
}
