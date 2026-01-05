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
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You detect complete questions from speech. Return JSON: {"isComplete": true/false, "question": "extracted question" or null}

A COMPLETE question is one that:
1. Has enough context to give a meaningful answer (not just restating the question)
2. Is asking for information, calculation, or facts

EXTRACT these (isComplete: true):
- "what is 3+3" -> answer is "6" (not just "3+3")
- "what is 17 times 4" -> answer is "68"
- "who is Obama" -> answer is information about Obama
- "what's the capital of France" -> answer is "Paris"
- "what happened in the news" -> answer is news info

DO NOT extract (isComplete: false):
- "what is three" -> answer would just be "three" (meaningless)
- "what is the" -> incomplete, waiting for more
- "how are you" -> personal/greeting, not factual
- "yeah so anyway" -> not a question
- "hey Siri" -> just a wake word

Key test: Would the answer be DIFFERENT from the question itself? If yes, it's valid.

Speech may have filler words - ignore "yeah", "so", "hey Siri", "umm" and extract the actual question.`,
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

    const systemPrompt = `You are an ultra-fast voice assistant. Answer questions in 2-8 words max.

RULES:
1. Give the raw answer only, no preamble
2. If search results are provided, use them for accuracy
3. Answer ALL factual questions: math, science, history, current events, famous people, companies, etc.

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
