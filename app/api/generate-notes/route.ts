import { NextResponse } from "next/server"

export const maxDuration = 60

interface TranscriptSegment {
  text: string
  startIndex: number
  endIndex: number
}

interface SupportingPoint {
  text: string
  transcriptRefs: number[] // indices into transcript segments
}

interface MainIdea {
  title: string
  bulletPoints: SupportingPoint[]
}

export async function POST(request: Request) {
  try {
    const { transcript, duration } = await request.json()

    if (!transcript || transcript.length < 20) {
      return NextResponse.json({ error: "Transcript too short" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript]
    const transcriptSegments: TranscriptSegment[] = []
    let currentIndex = 0

    sentences.forEach((sentence: string, index: number) => {
      const trimmed = sentence.trim()
      if (trimmed) {
        transcriptSegments.push({
          text: trimmed,
          startIndex: currentIndex,
          endIndex: currentIndex + trimmed.length,
        })
      }
      currentIndex += sentence.length
    })

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert note-taker. Analyze the transcript and create structured hierarchical notes.

The transcript has been split into ${transcriptSegments.length} numbered segments (0-indexed).

Your response must be valid JSON with this structure:
{
  "title": "Overall title (max 6 words)",
  "mainIdeas": [
    {
      "title": "Main Idea Title",
      "bulletPoints": [
        {
          "text": "Supporting point or detail",
          "transcriptRefs": [0, 3, 5]
        }
      ]
    }
  ],
  "actionItems": [
    {
      "text": "Action item description",
      "transcriptRefs": [2]
    }
  ],
  "tags": ["tag1", "tag2"]
}

Guidelines:
- Create 2-5 main ideas that capture major themes/topics
- Each main idea should have 2-5 bullet points with supporting details
- transcriptRefs should be arrays of segment indices (0-based) that support each point
- Focus on the most important information
- Keep bullet points concise but informative
- Action items are tasks or follow-ups mentioned (can be empty)

Here are the transcript segments for reference:
${transcriptSegments.map((seg, i) => `[${i}] ${seg.text}`).join("\n")}`,
          },
          {
            role: "user",
            content: `Create notes from this ${Math.floor(duration / 60)} minute ${duration % 60} second recording.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.log("[v0] OpenAI error:", error)
      return NextResponse.json({ error: "Failed to generate notes" }, { status: 500 })
    }

    const data = await response.json()
    let content = data.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ error: "No content generated" }, { status: 500 })
    }

    // Strip markdown code blocks
    content = content.trim()
    if (content.startsWith("```json")) {
      content = content.slice(7)
    } else if (content.startsWith("```")) {
      content = content.slice(3)
    }
    if (content.endsWith("```")) {
      content = content.slice(0, -3)
    }
    content = content.trim()

    try {
      const notes = JSON.parse(content)
      return NextResponse.json({
        ...notes,
        transcriptSegments,
      })
    } catch {
      console.log("[v0] Failed to parse notes JSON, content:", content)
      return NextResponse.json({
        title: "Recording Notes",
        mainIdeas: [],
        actionItems: [],
        tags: [],
        transcriptSegments,
      })
    }
  } catch (error) {
    console.error("[v0] Generate notes error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
