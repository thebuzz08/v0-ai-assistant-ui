import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text || text.trim().length < 2) {
      return Response.json({ isQuestion: false, answer: null })
    }

    const systemPrompt = `You are an ultra-fast voice assistant with real-time web search. Answer ALL questions instantly and concisely.

RULES:
1. ANSWER any question about facts, people, events, news, math, science, history, current events, etc.
2. Keep answers to 2-8 words maximum - just the raw answer, no fluff
3. Do NOT restate the question or add preamble
4. Use Google Search to get current, accurate information
5. ONLY respond with NOT_A_QUESTION for statements that aren't questions at all (like "hello" or "the weather is nice")
6. ONLY respond with PERSONAL_QUESTION for questions specifically about the USER's personal life that you cannot possibly know (like "how am I feeling", "what were my grades", "who is my friend Sarah")

Examples:
- "What is 2+2?" → "4"
- "Who is Elon Musk?" → "Tesla and SpaceX CEO"
- "Capital of France?" → "Paris"  
- "What happened yesterday in the news?" → [Use search for real answer]
- "What was Nvidia's Q3 revenue?" → [Use search for accurate figure]
- "Who won the Super Bowl last year?" → [Use search for current answer]
- "Hello" → "NOT_A_QUESTION"
- "How am I feeling today?" → "PERSONAL_QUESTION"

IMPORTANT: If it's a question about the world, facts, people, events - ANSWER IT with real data from search. Only refuse personal questions about the user's own life.`

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `${systemPrompt}\n\nUser question: ${text}`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
        maxOutputTokens: 100,
      },
    })

    const result = response.text?.trim() || ""
    const isNotQuestion = result === "NOT_A_QUESTION" || result === "PERSONAL_QUESTION"

    return Response.json({
      isQuestion: !isNotQuestion,
      answer: isNotQuestion ? null : result,
    })
  } catch (error) {
    console.error("[v0] API Error:", error)
    return Response.json({ isQuestion: false, answer: null, error: String(error) }, { status: 500 })
  }
}
