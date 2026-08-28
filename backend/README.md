# Kua tutor backend

A small Cloudflare Worker that sits between the app and an LLM, so the app
never holds an API key directly. Three endpoints, all POST, all requiring an
`X-Kua-App-Secret` header matching the `APP_SHARED_SECRET` secret:

- `POST /generate-note` — `{ grade, subject, topic }` → `{ title, body }`
- `POST /generate-questions` — `{ grade, subject, topic, count? }` → `{ cards: [...] }`
- `POST /explain-more` — `{ grade, subject, topic, previousText, studentQuestion? }` → `{ explanation }`

Runs on **Cloudflare Workers AI** (free tier: 10,000 neurons/day, resets
daily, no billing needed) using `@cf/meta/llama-3.1-8b-instruct-fast` with
JSON-schema structured output. Swap the `MODEL` constant in `src/index.ts` if
you ever want a different Workers AI model, or a paid provider like Claude —
the request/response shapes the app expects (`lib/tutor.ts`) won't need to
change either way.

## Mock mode — test for free before touching any AI model

Set `MOCK_MODE=true` (locally in `.dev.vars`, or in production via
`wrangler secret put MOCK_MODE`) and every endpoint returns canned fake data
instantly, without calling Workers AI at all. Use this to verify the whole
pipeline — deploy, the app's fetch calls, loading/error UI states — before
spending any of the free daily neuron allowance.

## Local dev

```
cp .dev.vars.example .dev.vars   # then fill in APP_SHARED_SECRET
npx wrangler dev
```

## Deploy

```
npx wrangler login
npx wrangler deploy
npx wrangler secret put APP_SHARED_SECRET   # any random string; remember it for the app's .env
npx wrangler secret put MOCK_MODE           # "true" to test for free, "false" (or unset) for real generation
```

`wrangler deploy` prints the live URL (`https://kua-tutor-backend.<you>.workers.dev`) —
put that in the app's `.env` as `EXPO_PUBLIC_TUTOR_API_URL`, alongside the
same `APP_SHARED_SECRET` value as `EXPO_PUBLIC_TUTOR_APP_SECRET`.
