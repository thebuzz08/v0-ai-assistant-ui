import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text || text.trim().length < 2) {
      return Response.json({ isQuestion: false, answer: null })
    }

    const systemPrompt = `You are a voice assistant. Answer questions concisely.

RULES:
1. Only respond to questions or requests for information
2. Keep answers to 2-6 words maximum - just the raw answer
3. Do NOT restate the question or add preamble
4. If it's not a question, respond with "NOT_A_QUESTION"
5. If you genuinely don't know, respond with "UNKNOWN"

Examples:
- "What is 2+2?" → "4"
- "Who is Elon Musk?" → "Tesla CEO"
- "What time is it in Tokyo?" → Use search to find out
- "Hello" → "NOT_A_QUESTION"
- "The weather is nice" → "NOT_A_QUESTION"

User says: "${text}"

RESPOND ONLY WITH THE ANSWER:`

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: systemPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })

    const result = response.text?.trim() || ""

    const isNotQuestion = result === "NOT_A_QUESTION" || result === "UNKNOWN"

    return Response.json({
      isQuestion: !isNotQuestion,
      answer: isNotQuestion ? null : result,
    })
  } catch (error) {
    console.error("[v0] API Error:", error)
    return Response.json({ isQuestion: false, answer: null, error: String(error) }, { status: 500 })
  }
}
