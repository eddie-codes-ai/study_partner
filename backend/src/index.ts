import { z } from 'zod';

export interface Env {
  AI: Ai;
  APP_SHARED_SECRET: string;
  MOCK_MODE?: string;
}

// Free tier: 10,000 neurons/day, resets daily at 00:00 UTC — no billing
// needed. One of the models confirmed to support JSON-schema structured
// output via response_format (see backend README).
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const NoteSchema = z.object({
  title: z.string(),
  body: z.string().min(80, 'note body too short to be a real explanation'),
});

// options.length(4) + correctIndex.max(3) together guarantee correctIndex
// always points at a real option — the model returned an out-of-range
// index (4, with only options[0..3]) during testing, which would have
// silently broken every "which option is correct" check in the app.
const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4, 'must have exactly 4 options'),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
});

const QuestionSetSchema = z.object({
  cards: z.array(QuestionSchema),
});

const ExplainSchema = z.object({
  explanation: z.string(),
});

// Plain JSON Schema mirrors of the Zod schemas above, for response_format —
// Workers AI's JSON mode wants a raw JSON Schema object, not a Zod instance.
const NOTE_JSON_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, body: { type: 'string' } },
  required: ['title', 'body'],
};

const QUESTION_SET_JSON_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'integer' },
          explanation: { type: 'string' },
        },
        required: ['question', 'options', 'correctIndex', 'explanation'],
      },
    },
  },
  required: ['cards'],
};

const EXPLAIN_JSON_SCHEMA = {
  type: 'object',
  properties: { explanation: { type: 'string' } },
  required: ['explanation'],
};

const MOCK = {
  note: { title: '[Mock] Fractions', body: 'This is a fake note returned by mock mode, so you can test the app end to end without spending any Workers AI neurons.\n\nSwitch MOCK_MODE off once you want real generated content.' },
  questions: {
    cards: [
      {
        question: '[Mock] What is 1/2 + 1/4?',
        options: ['1/6', '3/4', '2/4', '1/4'],
        correctIndex: 1,
        explanation: 'This is a fake explanation from mock mode.',
      },
    ],
  },
  explanation: { explanation: '[Mock] Here is a fake, simpler explanation — mock mode never calls Workers AI.' },
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Kua-App-Secret',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function systemPrompt(grade: number, subject: string, topic: string): string {
  return `You are a patient, encouraging tutor for a Grade ${grade} student in Kenya's CBC (Competency-Based Curriculum), currently studying "${topic}" in ${subject}.

Rules:
- Use simple, plain language appropriate for a 9-12 year old.
- Ground everything in the actual CBC ${subject} curriculum for Grade ${grade} — do not invent facts or go beyond this grade's level.
- Use Kenyan context and examples (Kenyan Shillings, local names, local places) where natural.
- Stay strictly on the topic of "${topic}". If the conversation drifts to anything unrelated or inappropriate, politely decline and redirect back to the topic.
- Do not share personal opinions on sensitive political, religious, or controversial matters beyond standard CBC curriculum content.
- Respond with JSON only, matching the required schema exactly.`;
}

// Workers AI's JSON mode is best-effort on a small open model — unlike
// Claude's structured outputs, nothing guarantees the shape matches. Parse
// defensively and validate with the Zod schema before trusting it.
function parseAndValidate<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  const candidate = typeof raw === 'string' ? safeJsonParse(raw) : raw;
  const result = schema.safeParse(candidate);
  return result.success ? result.data : null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function runModel(
  ai: Ai,
  system: string,
  user: string,
  jsonSchema: object,
  maxTokens: number
): Promise<unknown> {
  const result = await ai.run(MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_schema', json_schema: jsonSchema },
    max_tokens: maxTokens,
  });
  // Workers AI returns either a parsed object or a raw string in `.response`
  // depending on model/runtime version — handle both.
  return (result as { response?: unknown })?.response ?? result;
}

// When a student supplies their own material (Add Material feature), the
// generation should be grounded in that text rather than the model's
// general knowledge of the topic — this is what lets Kua turn a student's
// own notes into a note/questions, not just generate generic curriculum
// content under a custom topic name.
function materialClause(material?: string): string {
  if (!material) return '';
  return `The student has provided their own study material below — base your answer primarily on this material, in your own words, rather than inventing new content beyond it:\n"""\n${material}\n"""\n\n`;
}

async function generateNote(env: Env, grade: number, subject: string, topic: string, material?: string) {
  if (env.MOCK_MODE === 'true') return MOCK.note;
  const raw = await runModel(
    env.AI,
    systemPrompt(grade, subject, topic),
    `${materialClause(material)}Write a study note explaining "${topic}" for a Grade ${grade} ${subject} student. It must be at least 4 full sentences and 150-250 words total — a single short sentence is NOT acceptable, this needs to actually teach the concept with a worked example. Match the plain, encouraging tone of a good teacher. If the topic name has more than one part (e.g. joined by "&" or "and"), cover every part with its own sentence, not just the first.`,
    NOTE_JSON_SCHEMA,
    700
  );
  return parseAndValidate(NoteSchema, raw);
}

async function generateQuestions(env: Env, grade: number, subject: string, topic: string, count: number, material?: string) {
  if (env.MOCK_MODE === 'true') return MOCK.questions;
  const raw = await runModel(
    env.AI,
    systemPrompt(grade, subject, topic),
    `${materialClause(material)}Write ${count} multiple-choice practice questions on "${topic}" for a Grade ${grade} ${subject} student. Each question needs exactly 4 answer options and a one-sentence explanation of why the correct answer is right. Options must be short, bare answers (a number, a word, or a short phrase) — NOT full restated sentences like "The pattern is...". correctIndex must be 0, 1, 2, or 3, matching the position of the right answer in the options array. Vary which option index holds the correct answer across the questions — do not always put it first.`,
    QUESTION_SET_JSON_SCHEMA,
    // Roomy per-question budget (~150 tokens each) plus headroom for JSON
    // structure — the earlier default of 256 total cut a 4-question
    // response off mid-sentence.
    count * 180 + 300
  );
  return parseAndValidate(QuestionSetSchema, raw);
}

async function explainMore(
  env: Env,
  grade: number,
  subject: string,
  topic: string,
  previousText: string,
  studentQuestion?: string
) {
  if (env.MOCK_MODE === 'true') return MOCK.explanation;

  const followUp = studentQuestion
    ? `The student says: "${studentQuestion}". Explain the topic again, more simply, addressing what they're confused about. Use a different example than before. Earlier explanation for context: ${previousText}`
    : `The student didn't understand this earlier explanation: "${previousText}". Explain the topic again, more simply, using a different example than before.`;

  const raw = await runModel(env.AI, systemPrompt(grade, subject, topic), followUp, EXPLAIN_JSON_SCHEMA, 500);
  return parseAndValidate(ExplainSchema, raw);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method === 'GET') {
      return jsonResponse({ status: 'ok', mockMode: env.MOCK_MODE === 'true' });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (request.headers.get('X-Kua-App-Secret') !== env.APP_SHARED_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { grade, subject, topic } = body ?? {};
    if (!grade || !subject || !topic) {
      return jsonResponse({ error: 'grade, subject, and topic are required' }, 400);
    }

    try {
      let result: unknown;

      if (url.pathname === '/generate-note') {
        result = await generateNote(env, grade, subject, topic, body.material);
      } else if (url.pathname === '/generate-questions') {
        result = await generateQuestions(env, grade, subject, topic, body.count ?? 6, body.material);
      } else if (url.pathname === '/explain-more') {
        if (!body.previousText) {
          return jsonResponse({ error: 'previousText is required' }, 400);
        }
        result = await explainMore(env, grade, subject, topic, body.previousText, body.studentQuestion);
      } else {
        return jsonResponse({ error: 'Not found' }, 404);
      }

      if (result === null) {
        return jsonResponse(
          { error: "The tutor's response didn't come back in the right format. Please try again." },
          502
        );
      }

      return jsonResponse(result);
    } catch (err) {
      console.error(err);
      return jsonResponse({ error: 'Something went wrong generating content. Please try again.' }, 500);
    }
  },
};
