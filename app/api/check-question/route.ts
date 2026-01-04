import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: Request) {
  try {
    const { text, stream } = await request.json()

    if (!text || text.trim().length < 2) {
      return Response.json({ isQuestion: false, answer: null })
    }

    const systemPrompt = `You are an ultra-fast voice assistant. Answer instantly and concisely.

RULES:
1. Only respond to questions or requests for information
2. Keep answers to 2-6 words maximum - just the raw answer
3. Do NOT restate the question or add preamble
4. If it's not a question, respond with exactly: NOT_A_QUESTION
5. If you genuinely don't know, respond with exactly: UNKNOWN

Examples:
- "What is 2+2?" → "4"
- "Who is Elon Musk?" → "Tesla CEO"
- "Capital of France?" → "Paris"
- "Hello" → "NOT_A_QUESTION"
- "The weather is nice" → "NOT_A_QUESTION"`

    if (stream) {
      const chatStream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        stream: true,
        temperature: 0.3,
        max_tokens: 50,
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          let fullText = ""
          for await (const chunk of chatStream) {
            const content = chunk.choices[0]?.delta?.content || ""
            if (content) {
              fullText += content
              // Send each chunk immediately
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content, partial: fullText })}\n\n`))
            }
          }

          // Final message with completion status
          const isNotQuestion = fullText.trim() === "NOT_A_QUESTION" || fullText.trim() === "UNKNOWN"
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, isQuestion: !isNotQuestion, answer: isNotQuestion ? null : fullText.trim() })}\n\n`,
            ),
          )
          controller.close()
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    // Non-streaming fallback
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 50,
    })

    const result = response.choices[0]?.message?.content?.trim() || ""
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
