// Client for the AI tutor backend (backend/) — the one part of the app that
// calls a real LLM at runtime instead of using pre-built content. Unlike
// everything else in lib/db.ts, this needs network access and costs real
// money per call, so it's used deliberately (on-demand generation, or
// "explain differently") rather than as the default content source.
//
// Note on the shared secret: EXPO_PUBLIC_* vars are bundled into the app and
// technically extractable by a determined attacker — this is a lightweight
// gate against casual abuse of the endpoint, not real security. The actual
// Anthropic API key never leaves the backend.

const API_URL = process.env.EXPO_PUBLIC_TUTOR_API_URL;
const APP_SECRET = process.env.EXPO_PUBLIC_TUTOR_APP_SECRET;

export class TutorError extends Error {}

async function callTutor<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!API_URL || !APP_SECRET) {
    throw new TutorError('AI tutor is not configured yet (missing EXPO_PUBLIC_TUTOR_API_URL / _APP_SECRET).');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kua-App-Secret': APP_SECRET,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new TutorError('Could not reach the AI tutor. Check your internet connection and try again.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new TutorError(payload?.error ?? `Tutor request failed (${response.status}). Please try again.`);
  }

  return response.json() as Promise<T>;
}

export type GeneratedNote = {
  title: string;
  body: string;
};

export function generateNote(
  grade: number,
  subject: string,
  topic: string,
  material?: string
): Promise<GeneratedNote> {
  return callTutor<GeneratedNote>('/generate-note', { grade, subject, topic, material });
}

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export function generateQuestions(
  grade: number,
  subject: string,
  topic: string,
  count = 6,
  material?: string
): Promise<{ cards: GeneratedQuestion[] }> {
  return callTutor<{ cards: GeneratedQuestion[] }>('/generate-questions', { grade, subject, topic, count, material });
}

export function explainMore(
  grade: number,
  subject: string,
  topic: string,
  previousText: string,
  studentQuestion?: string
): Promise<{ explanation: string }> {
  return callTutor<{ explanation: string }>('/explain-more', {
    grade,
    subject,
    topic,
    previousText,
    studentQuestion,
  });
}
