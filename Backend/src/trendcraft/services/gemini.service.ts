import axios from 'axios';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Prefer current model; fallback to 1.5 if 2.5 is not available for the key
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export interface GenerateWithGeminiOptions {
  maxOutputTokens?: number;
  /** Ask for JSON output; model returns valid JSON when possible */
  responseMimeType?: 'application/json';
}

/**
 * Call Gemini generateContent. Returns generated text or null if key missing / API error.
 */
export async function generateWithGemini(
  prompt: string,
  options?: GenerateWithGeminiOptions
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY is missing or empty. Set it in Backend/.env and restart the server.');
    return null;
  }

  const maxOutputTokens = options?.maxOutputTokens ?? 1024;
  const generationConfig: Record<string, unknown> = {
    temperature: 0.7,
    maxOutputTokens,
  };
  if (options?.responseMimeType === 'application/json') {
    generationConfig.responseMimeType = 'application/json';
  }

  try {
    const { data } = await axios.post<GeminiGenerateResponse>(
      `${GEMINI_BASE}/models/${MODEL}:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        timeout: 30000,
      }
    );

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() ?? null;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const body = err.response?.data as { error?: { message?: string; status?: string } } | undefined;
      const msg = body?.error?.message ?? err.message;
      console.error('[Gemini] generateWithGemini failed:', status, msg);
      if (status === 404) {
        console.error('[Gemini] Model not found. Try GEMINI_MODEL=gemini-1.5-flash in .env if your key does not have access to gemini-2.5-flash.');
      }
    } else {
      console.error('[Gemini] generateWithGemini failed:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}
