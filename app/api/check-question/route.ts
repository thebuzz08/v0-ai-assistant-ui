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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get("text")

  if (!text || text.trim().length < 3) {
    return Response.json({ isComplete: false, question: null })
  }

  try {
    // Fast completeness check with smaller model
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `Analyze if this speech transcript contains a COMPLETE question that can be answered.
Return JSON: {"isComplete": true/false, "question": "the complete question" or null}
- isComplete=true if there's a question that's finished being asked
- isComplete=false if the person is mid-sentence or hasn't finished their thought
- Extract just the question part if there's extra text

Examples:
"what is three plus three" -> {"isComplete": true, "question": "what is three plus three"}
"what is the" -> {"isComplete": false, "question": null}
"hey so I was wondering what" -> {"isComplete": false, "question": null}
"what time is it in Tokyo" -> {"isComplete": true, "question": "what time is it in Tokyo"}
"hello" -> {"isComplete": false, "question": null}
"thanks for that so what is" -> {"isComplete": false, "question": null}`,
        },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{"isComplete": false, "question": null}')
    return Response.json(result)
  } catch (error) {
    console.error("[v0] Completeness check error:", error)
    return Response.json({ isComplete: false, question: null })
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

        const isNotQuestion = fullText.trim() === "NOT_A_QUESTION" || fullText.trim() === "PERSONAL_QUESTION"

        if (isNotQuestion) {
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
