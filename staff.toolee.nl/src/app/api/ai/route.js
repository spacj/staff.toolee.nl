import { NextResponse } from 'next/server';

/**
 * POST /api/ai
 * Proxies AI requests to NVIDIA's API.
 * Body: { messages, feature }
 * feature: "schedule" | "insights" | "assistant"
 */

const SYSTEM_PROMPTS = {
  schedule: `You are an AI scheduling assistant for StaffHub, a staff management platform. 
Analyze the schedule data provided and give specific, actionable suggestions to optimize it.
Focus on: fair hour distribution, matching worker preferences, avoiding understaffing, overtime risks.
Be concise — use short bullet points. Format with markdown. Max 300 words.`,

  insights: `You are an AI analytics assistant for StaffHub. Analyze the worker/attendance data and provide:
- Performance patterns (attendance reliability, hours consistency)
- Cost optimization opportunities
- Team health indicators
Be specific with numbers. Use markdown. Max 250 words.`,

  assistant: `You are StaffHub AI, a helpful assistant for a staff management platform.
Help with: scheduling advice, labor law basics, team management tips, using StaffHub features.
Be concise, friendly, and practical. If asked about specific laws, note that rules vary by country.
Use short paragraphs. Max 200 words per response.`,
};

export async function POST(req) {
  try {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured (NVIDIA_API_KEY missing)' }, { status: 500 });
    }

    const { messages, feature = 'assistant' } = await req.json();
    const systemPrompt = SYSTEM_PROMPTS[feature] || SYSTEM_PROMPTS.assistant;

    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.6,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('NVIDIA API error:', res.status, err);
      return NextResponse.json({ error: `AI service error (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || 'No response generated.';

    return NextResponse.json({ content });
  } catch (err) {
    console.error('AI route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
