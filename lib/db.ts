import * as SQLite from 'expo-sqlite';

import { SEED_CARDS, SEED_VERSION, SUBJECTS } from './seed';

const db = SQLite.openDatabaseSync('kua.db');

export type Card = {
  id: string;
  subjectId: string;
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  intervalDays: number;
};

export type SubjectProgress = {
  id: string;
  name: string;
  emoji: string;
  stage: 'seed' | 'sprout' | 'tree';
  dueCount: number;
};

type CardRow = {
  id: string;
  subject_id: string;
  grade: number;
  topic: string;
  question: string;
  options: string;
  correct_index: number;
  explanation: string;
  interval_days: number;
};

// A correct answer moves a card to the next interval; a wrong answer always
// resets it to "review again tomorrow". Matches the rule described when the
// stack was chosen: wrong -> tomorrow, right -> +3 days, right again -> +7,
// capped at 14.
const NEXT_INTERVAL_ON_CORRECT: Record<number, number> = { 0: 3, 3: 7, 7: 14, 14: 14 };

export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      grade INTEGER NOT NULL DEFAULT 4,
      topic TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      explanation TEXT NOT NULL,
      due_at TEXT NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL,
      correct INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL
    );
  `);

  // Devices that seeded before the `grade` column existed need it added —
  // CREATE TABLE IF NOT EXISTS is a no-op on an already-existing table.
  const cardColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(cards)');
  if (!cardColumns.some((c) => c.name === 'grade')) {
    db.execSync('ALTER TABLE cards ADD COLUMN grade INTEGER NOT NULL DEFAULT 4');
  }

  syncSeedContent();
}

function syncSeedContent() {
  // Subjects are static and cheap to keep in sync regardless of seed version.
  for (const s of SUBJECTS) {
    db.runSync(
      `INSERT INTO subjects (id, name, emoji) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, emoji = excluded.emoji`,
      [s.id, s.name, s.emoji]
    );
  }

  const installedVersion = Number(getMeta('seed_version') ?? '0');
  const currentCardCount = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM cards')?.n ?? 0;
  // Reseed if the version is behind, OR if the row count doesn't match what
  // SEED_CARDS actually holds right now. The count check guards against a
  // torn reseed (seen in practice from a Fast Refresh race mid-edit) leaving
  // seed_version stamped ahead of what actually got written — without it,
  // that wedged state survives every later reload since the version check
  // alone would keep saying "already up to date."
  if (installedVersion >= SEED_VERSION && currentCardCount === SEED_CARDS.length) return;

  // Seed content changed since this device last synced. Cards are fully
  // replaced (old review history for them goes too); grade/streak/stars in
  // `meta` are untouched since they aren't derived from these rows.
  db.execSync('DELETE FROM reviews; DELETE FROM cards;');
  const now = new Date().toISOString();
  for (const c of SEED_CARDS) {
    db.runSync(
      `INSERT INTO cards (id, subject_id, grade, topic, question, options, correct_index, explanation, due_at, interval_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [c.id, c.subjectId, c.grade, c.topic, c.question, JSON.stringify(c.options), c.correctIndex, c.explanation, now]
    );
  }
  setMeta('seed_version', String(SEED_VERSION));
}

function getMeta(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

function setMeta(key: string, value: string) {
  db.runSync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export function getGrade(): string | null {
  return getMeta('grade');
}

export function setGrade(grade: string) {
  setMeta('grade', grade);
}

export function getStreak(): number {
  return Number(getMeta('streak_count') ?? '0');
}

export function getStars(): number {
  return Number(getMeta('stars_total') ?? '0');
}

function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    subjectId: row.subject_id,
    topic: row.topic,
    question: row.question,
    options: JSON.parse(row.options),
    correctIndex: row.correct_index,
    explanation: row.explanation,
    intervalDays: row.interval_days,
  };
}

export function getDueCards(grade: number, limit = 8, subjectId?: string): Card[] {
  // Compare against a JS-computed ISO string, not SQLite's datetime('now') —
  // that produces "2026-08-28 10:15:32" (space, no ms) while due_at is
  // stored as "2026-08-28T10:15:32.123Z" (toISOString()). Mixing the two
  // formats makes the <= comparison plain-text, and 'T' (0x54) sorts after
  // ' ' (0x20), so due_at always looked "later than now" — no card was ever
  // due. Both sides need the same format for the comparison to be correct.
  const nowIso = new Date().toISOString();
  const rows = subjectId
    ? db.getAllSync<CardRow>(
        'SELECT * FROM cards WHERE grade = ? AND subject_id = ? AND due_at <= ? ORDER BY due_at ASC LIMIT ?',
        [grade, subjectId, nowIso, limit]
      )
    : db.getAllSync<CardRow>(
        'SELECT * FROM cards WHERE grade = ? AND due_at <= ? ORDER BY due_at ASC LIMIT ?',
        [grade, nowIso, limit]
      );
  return rows.map(rowToCard);
}

export function recordAnswer(cardId: string, correct: boolean) {
  const card = db.getFirstSync<{ interval_days: number }>(
    'SELECT interval_days FROM cards WHERE id = ?',
    [cardId]
  );
  const prevInterval = card?.interval_days ?? 0;
  const nextInterval = correct ? NEXT_INTERVAL_ON_CORRECT[prevInterval] ?? 3 : 1;
  const dueAt = new Date(Date.now() + nextInterval * 86_400_000).toISOString();

  db.runSync('UPDATE cards SET interval_days = ?, due_at = ? WHERE id = ?', [
    nextInterval,
    dueAt,
    cardId,
  ]);
  db.runSync('INSERT INTO reviews (card_id, correct, reviewed_at) VALUES (?, ?, ?)', [
    cardId,
    correct ? 1 : 0,
    new Date().toISOString(),
  ]);

  if (correct) {
    setMeta('stars_total', String(getStars() + 2));
  }
}

// Called once when a session ends (not per card) — advances the streak at
// most once per calendar day.
export function completeSession() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const last = getMeta('last_study_date');
  if (last === todayKey) return;

  const yesterdayKey = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const streak = last === yesterdayKey ? getStreak() + 1 : 1;
  setMeta('streak_count', String(streak));
  setMeta('last_study_date', todayKey);
}

export function getSubjectProgress(grade: number): SubjectProgress[] {
  const nowIso = new Date().toISOString();
  const stats = db.getAllSync<{
    subject_id: string;
    avg_interval: number | null;
    total: number;
    due_count: number;
  }>(
    `SELECT subject_id,
            AVG(interval_days) as avg_interval,
            COUNT(*) as total,
            SUM(CASE WHEN due_at <= ? THEN 1 ELSE 0 END) as due_count
     FROM cards WHERE grade = ? GROUP BY subject_id`,
    [nowIso, grade]
  );
  const bySubject = new Map(stats.map((s) => [s.subject_id, s]));

  return SUBJECTS.map((s) => {
    const stat = bySubject.get(s.id);
    const avgInterval = stat?.avg_interval ?? 0;
    const stage: SubjectProgress['stage'] =
      !stat || stat.total === 0 || avgInterval < 1 ? 'seed' : avgInterval >= 7 ? 'tree' : 'sprout';
    return { id: s.id, name: s.name, emoji: s.emoji, stage, dueCount: stat?.due_count ?? 0 };
  });
}
