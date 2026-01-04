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

function detectQuestion(text: string): { isComplete: boolean; question: string | null } {
  const lowerText = text.toLowerCase().trim()

  // Skip greetings and personal questions
  const skipPatterns = [
    /^(hi|hello|hey|thanks|thank you|bye|goodbye)/,
    /how are you/,
    /how('s| is) it going/,
    /what('s| is) up/,
    /how was your/,
    /what should i/,
  ]

  for (const pattern of skipPatterns) {
    if (pattern.test(lowerText)) {
      return { isComplete: false, question: null }
    }
  }

  // Question patterns to extract
  const questionPatterns = [
    // Math questions
    /what(?:'s| is) (\d+\s*[+\-*/x×]\s*\d+)/i,
    /how much is (\d+\s*[+\-*/x×]\s*\d+)/i,
    // What/who/when/where/why/how questions
    /(what(?:'s| is| are| was| were| did| does| do| has| have| can| could| would| will) [^?]+)/i,
    /(who(?:'s| is| are| was| were| did| does| do| has| have) [^?]+)/i,
    /(when(?:'s| is| are| was| were| did| does| do) [^?]+)/i,
    /(where(?:'s| is| are| was| were| did| does| do) [^?]+)/i,
    /(why(?:'s| is| are| was| were| did| does| do) [^?]+)/i,
    /(how(?:'s| is| are| was| were| did| does| do|many|much|long|far|often) [^?]+)/i,
    // Can/could/would questions
    /(can you [^?]+)/i,
    /(could you [^?]+)/i,
  ]

  for (const pattern of questionPatterns) {
    const match = text.match(pattern)
    if (match) {
      let question = match[1] || match[0]
      question = question.trim()

      // Check if question seems complete (has subject + verb or is math)
      if (/\d+\s*[+\-*/x×]\s*\d+/.test(question)) {
        return { isComplete: true, question: `what is ${question}` }
      }

      // Needs at least 3 words to be complete
      const words = question.split(/\s+/)
      if (words.length >= 3) {
        return { isComplete: true, question }
      }
    }
  }

  return { isComplete: false, question: null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get("text")

  if (!text || text.trim().length < 3) {
    return Response.json({ isComplete: false, question: null })
  }

  const result = detectQuestion(text)
  return Response.json(result)
}

export async function POST(request: Request) {
  const encoder = new TextEncoder()

  const createErrorStream = (message: string) => {
    return new Response(`data: ${JSON.stringify({ token: message })}\n\ndata: [DONE]\n\n`, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }

  try {
    // Validate Groq API key
    if (!process.env.GROQ_API_KEY) {
      console.error("[v0] GROQ_API_KEY is missing")
      return createErrorStream("Configuration error.")
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.text || typeof body.text !== "string") {
      console.error("[v0] Invalid request body:", body)
      return createErrorStream("Invalid request.")
    }

    const { text } = body

    if (text.trim().length < 2) {
      return Response.json({ isQuestion: false, answer: null })
    }

    let searchContext = ""
    if (needsWebSearch(text)) {
      try {
        searchContext = await searchTavily(text)
      } catch (e) {
        console.error("[v0] Search error:", e)
      }
    }

    const systemPrompt = `You are an ultra-fast voice assistant. Answer questions in 2-8 words max.

RULES:
1. Give the raw answer only, no preamble
2. If search results are provided, use them for accuracy
3. Answer ALL factual questions: math, science, history, current events, famous people, companies, etc.

${searchContext ? `\nSEARCH RESULTS:\n${searchContext}` : ""}`

    const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const stream = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 50,
      stream: true,
    })

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
          controller.close()
        } catch (streamError) {
          console.error("[v0] Stream error:", streamError)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: "Error." })}\n\n`))
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
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
    console.error("[v0] POST API Error:", error instanceof Error ? error.stack : error)
    return createErrorStream("Sorry, something went wrong.")
  }
}
