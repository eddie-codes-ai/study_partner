#!/usr/bin/env node
// Regenerates a note + practice questions for one (grade, subject, topic),
// grounded in a real KICD curriculum design excerpt instead of a bare topic
// name — see scripts/curriculum/README.md for the full workflow this is
// step 3 of.
//
// This never touches lib/seed.ts. It writes a review file to
// scripts/curriculum/output/ so a human compares it against what's
// currently seeded before anything gets merged by hand.
//
// Usage:
//   node scripts/curriculum/generate.mjs \
//     --grade 5 --subject-id science --subject-name "Integrated Science" \
//     --topic "Sound Energy" --material scripts/curriculum/materials/g5-science-sound-energy.txt

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? next : true;
    if (args[key] !== true) i++;
  }
  return args;
}

// The app loads .env via Expo's env plugin; this is a standalone Node
// script so it needs its own (deliberately minimal) parse of the same file.
function loadEnv(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

// Regex, not a real parser — safe here specifically because SeedNote/SeedCard
// object literals in lib/seed.ts never contain nested {}: `body`/`question`
// are plain strings and `options` is a flat string array. Don't reuse this
// against arbitrary TS.
function findCurrentSeed(seedSrc, subjectId, grade, topic) {
  const escapedTopic = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const notesSrc = seedSrc.slice(seedSrc.indexOf('SEED_NOTES'), seedSrc.indexOf('SEED_CARDS'));
  const cardsSrc = seedSrc.slice(seedSrc.indexOf('SEED_CARDS'));

  const noteRe = new RegExp(
    `\\{[^{}]*subjectId:\\s*'${subjectId}'[^{}]*grade:\\s*${grade}[^{}]*topic:\\s*'${escapedTopic}'[^{}]*\\}`,
    's'
  );
  const noteMatch = notesSrc.match(noteRe);
  const titleMatch = noteMatch?.[0].match(/title:\s*'([^']*)'/);
  const bodyMatch = noteMatch?.[0].match(/body:\s*"((?:[^"\\]|\\.)*)"/);

  const cardRe = new RegExp(
    `\\{[^{}]*subjectId:\\s*'${subjectId}'[^{}]*grade:\\s*${grade}[^{}]*topic:\\s*'${escapedTopic}'[^{}]*\\}`,
    'gs'
  );
  const cardCount = (cardsSrc.match(cardRe) ?? []).length;

  return {
    note: noteMatch ? { title: titleMatch?.[1] ?? '(unparsed)', body: bodyMatch?.[1]?.replace(/\\n/g, '\n') ?? '(unparsed)' } : null,
    cardCount,
  };
}

async function callTutor(apiUrl, secret, path, body) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Kua-App-Secret': secret },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? `${path} failed (${response.status})`);
  return payload;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['grade', 'subject-id', 'subject-name', 'topic', 'material'];
  const missing = required.filter((k) => !args[k]);
  if (missing.length > 0) {
    console.error(`Missing required args: ${missing.map((m) => `--${m}`).join(', ')}`);
    console.error(
      '\nUsage: node scripts/curriculum/generate.mjs --grade 5 --subject-id science --subject-name "Integrated Science" --topic "Sound Energy" --material path/to/material.txt [--count 6]'
    );
    process.exit(1);
  }

  const grade = Number(args.grade);
  const subjectId = args['subject-id'];
  const subjectName = args['subject-name'];
  const topic = args.topic;
  const count = args.count ? Number(args.count) : 6;
  const materialPath = args.material;

  if (!existsSync(materialPath)) {
    console.error(`Material file not found: ${materialPath}`);
    process.exit(1);
  }
  const material = readFileSync(materialPath, 'utf8').trim();

  const env = loadEnv(join(REPO_ROOT, '.env'));
  const apiUrl = env.EXPO_PUBLIC_TUTOR_API_URL;
  const secret = env.EXPO_PUBLIC_TUTOR_APP_SECRET;
  if (!apiUrl || !secret) {
    console.error('EXPO_PUBLIC_TUTOR_API_URL / EXPO_PUBLIC_TUTOR_APP_SECRET not found in .env');
    process.exit(1);
  }

  console.log(`Generating "${topic}" (Grade ${grade} ${subjectName}) from ${materialPath}...`);

  const [note, questions] = await Promise.all([
    callTutor(apiUrl, secret, '/generate-note', { grade, subject: subjectName, topic, material }),
    callTutor(apiUrl, secret, '/generate-questions', { grade, subject: subjectName, topic, count, material }),
  ]);

  const seedSrc = readFileSync(join(REPO_ROOT, 'lib', 'seed.ts'), 'utf8');
  const current = findCurrentSeed(seedSrc, subjectId, grade, topic);

  const result = {
    grade,
    subjectId,
    subjectName,
    topic,
    materialPath,
    generatedAt: new Date().toISOString(),
    proposed: { note, cards: questions.cards },
    current,
  };

  const outDir = join(__dirname, 'output');
  mkdirSync(outDir, { recursive: true });
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const outPath = join(outDir, `${subjectId}-g${grade}-${slug}.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`\nWrote ${outPath}\n`);
  console.log('─'.repeat(60));
  console.log('CURRENT' + (current.note ? '' : ' (nothing seeded for this exact topic)'));
  if (current.note) {
    console.log(`Title: ${current.note.title}`);
    console.log(current.note.body);
  }
  console.log(`Cards currently seeded: ${current.cardCount}`);
  console.log('─'.repeat(60));
  console.log('PROPOSED (grounded in the curriculum design excerpt)');
  console.log(`Title: ${note.title}`);
  console.log(note.body);
  console.log(`\n${questions.cards.length} practice questions generated.`);
  console.log('─'.repeat(60));
  console.log(`\nReview the full output in ${outPath}, then hand-merge into lib/seed.ts if it looks right.`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
