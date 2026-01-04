import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: Request) {
  try {
    const { text, stream } = await request.json()

    if (!text || text.trim().length < 2) {
      return Response.json({ isQuestion: false, answer: null })
    }

    const systemPrompt = `You are an ultra-fast voice assistant. Answer ALL questions instantly and concisely.

RULES:
1. ANSWER any question about facts, people, events, news, math, science, history, current events, etc.
2. Keep answers to 2-8 words maximum - just the raw answer, no fluff
3. Do NOT restate the question or add preamble
4. Use your knowledge to answer. For current events, give your best recent knowledge.
5. ONLY respond with NOT_A_QUESTION for statements that aren't questions at all (like "hello" or "the weather is nice")
6. ONLY respond with PERSONAL_QUESTION for questions specifically about the USER's personal life that you cannot possibly know (like "how am I feeling", "what were my grades", "who is my friend Sarah")

Examples:
- "What is 2+2?" → "4"
- "Who is Elon Musk?" → "Tesla and SpaceX CEO"
- "Capital of France?" → "Paris"  
- "What happened yesterday in the news?" → "Stock market rally, tech earnings"
- "What was Nvidia's Q3 revenue?" → "About 18 billion dollars"
- "Who won the Super Bowl last year?" → "Kansas City Chiefs"
- "What is something interesting?" → "James Webb telescope found new galaxies"
- "Hello" → "NOT_A_QUESTION"
- "The weather is nice" → "NOT_A_QUESTION"
- "How am I feeling today?" → "PERSONAL_QUESTION"
- "What were my grades?" → "PERSONAL_QUESTION"
- "Who is my friend Sarah?" → "PERSONAL_QUESTION"

IMPORTANT: If it's a question about the world, facts, people, events, or anything you can answer - ANSWER IT. Only refuse personal questions about the user's own life.`

    if (stream) {
      const chatStream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        stream: true,
        temperature: 0.3,
        max_tokens: 100, // Increased for longer answers
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          let fullText = ""
          for await (const chunk of chatStream) {
            const content = chunk.choices[0]?.delta?.content || ""
            if (content) {
              fullText += content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content, partial: fullText })}\n\n`))
            }
          }

          const isNotQuestion = fullText.trim() === "NOT_A_QUESTION" || fullText.trim() === "PERSONAL_QUESTION"
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
      max_tokens: 100,
    })

    const result = response.choices[0]?.message?.content?.trim() || ""
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
