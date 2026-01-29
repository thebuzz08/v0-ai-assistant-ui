import Groq from "groq-sdk"

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error("GROQ_API_KEY not set")
  return new Groq({ apiKey, dangerouslyAllowBrowser: true })
}

function needsWebSearch(text: string | undefined): boolean {
  if (!text) return false
  const keywords = ["today", "yesterday", "news", "2024", "2025", "2026", "current", "latest", "recent", "price", "weather", "score", "won", "happened"]
  return keywords.some(k => text.toLowerCase().includes(k))
}

async function searchTavily(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return ""
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: 3 }),
    })
    const data = await res.json()
    return data.results?.map((r: { content: string }) => r.content).join(" ") || ""
  } catch { return "" }
}

// Single endpoint - detect + answer in one call for lowest latency
export async function POST(request: Request) {
  try {
    const { text } = await request.json()
    if (!text?.trim() || text.trim().length < 3) {
      return Response.json({ answered: false })
    }

    const groq = getGroqClient()

    // Step 1: Fast detection with smallest model
    const detectRes = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{
        role: "system",
        content: `You analyze speech to detect complete questions. Output JSON only.

###RULES###
Return {"answer": true, "q": "extracted question"} if the text contains a COMPLETE question that:
- Has a clear answer (math, facts, definitions, explanations)
- Is finished (not cut off mid-sentence)

Return {"answer": false} if:
- Incomplete: "what is the" "who is" (no subject/object)
- Greetings: "how are you" "what's up" "hey"
- Personal: "what should I" "how was my"
- Non-questions: statements, filler words

###EXAMPLES###
"what is 5 plus 5" -> {"answer": true, "q": "what is 5 plus 5"}
"who is elon musk" -> {"answer": true, "q": "who is elon musk"}
"hey what is the capital of france" -> {"answer": true, "q": "what is the capital of france"}
"what is the" -> {"answer": false}
"how are you doing" -> {"answer": false}
"yeah so anyway" -> {"answer": false}
"who is" -> {"answer": false}`
      }, { role: "user", content: text }],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    })

    const detection = JSON.parse(detectRes.choices[0]?.message?.content || '{"answer":false}')
    
    if (!detection.answer || !detection.q) {
      return Response.json({ answered: false })
    }

    const question = detection.q

    // Step 2: Get answer with optional web search
    let searchContext = ""
    if (needsWebSearch(question)) {
      searchContext = await searchTavily(question)
    }

    const answerStream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{
        role: "system",
        content: `Voice assistant. Give ultra-short answers (2-10 words max).

###RULES###
- Direct answer only, no preamble
- Numbers: just the number
- Facts: key info only
- If search results provided, use them for current info

${searchContext ? `###SEARCH RESULTS###\n${searchContext}` : ""}`
      }, { role: "user", content: question }],
      temperature: 0.1,
      max_tokens: 50,
      stream: true,
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ question })}\n\n`))
        for await (const chunk of answerStream) {
          const token = chunk.choices[0]?.delta?.content || ""
          if (token) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    })
  } catch (error) {
    console.error("[API] Error:", error)
    return Response.json({ answered: false })
  }
}
