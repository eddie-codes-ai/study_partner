import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as db from '@/lib/db';
import { SUBJECTS } from '@/lib/seed';
import { shuffle } from '@/lib/shuffle';
import { useAppStore } from '@/lib/store';

const SUBJECT_BY_ID = new Map(SUBJECTS.map((s) => [s.id, s]));
const LENGTH_OPTIONS = [10, 20, 30];

// Options are shuffled at exam time so the correct answer isn't always in
// the same authored position — same reasoning as session.tsx.
function shuffleCardOptions(card: db.Card): db.Card {
  const order = shuffle(card.options.map((_, i) => i));
  return {
    ...card,
    options: order.map((i) => card.options[i]),
    correctIndex: order.indexOf(card.correctIndex),
  };
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Phase =
  | { name: 'setup' }
  | { name: 'question'; cards: db.Card[]; index: number; answers: (number | null)[]; startedAt: number }
  | { name: 'summary'; cards: db.Card[]; answers: (number | null)[]; durationSeconds: number };

export default function MockExamScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const grade = useAppStore((s) => s.grade);
  const refresh = useAppStore((s) => s.refresh);
  const gradeNum = grade ? Number(grade) : null;

  const [subjectId, setSubjectId] = useState<string | null>(null); // null = mixed
  const [length, setLength] = useState(10);
  const [phase, setPhase] = useState<Phase>({ name: 'setup' });
  const [elapsed, setElapsed] = useState(0);

  const available = useMemo(
    () => (gradeNum ? db.getExamCardCount(gradeNum, subjectId) : 0),
    [gradeNum, subjectId, phase.name] // phase.name so the count refreshes after leaving 'setup' and returning
  );
  const effectiveLength = Math.min(length, available);

  // Ticking clock while a question is on screen — cleared whenever the exam
  // isn't actively running so it doesn't keep counting on the summary/setup
  // screens.
  useEffect(() => {
    if (phase.name !== 'question') return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - phase.startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  function start() {
    if (!gradeNum || available === 0) return;
    const cards = db.getExamCards(gradeNum, subjectId, effectiveLength).map(shuffleCardOptions);
    setElapsed(0);
    setPhase({ name: 'question', cards, index: 0, answers: Array(cards.length).fill(null), startedAt: Date.now() });
  }

  function selectOption(i: number) {
    if (phase.name !== 'question') return;
    const answers = [...phase.answers];
    answers[phase.index] = i;
    setPhase({ ...phase, answers });
  }

  function advance() {
    if (phase.name !== 'question' || !gradeNum) return;
    const { cards, answers, index, startedAt } = phase;
    if (index < cards.length - 1) {
      setPhase({ name: 'question', cards, index: index + 1, answers, startedAt });
      return;
    }

    // Exam finished: score it, feed the same spaced-repetition + streak +
    // stars pipeline a normal session uses, then log the attempt so Parent
    // view can show a history of exam scores over time.
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    let correct = 0;
    cards.forEach((card, i) => {
      const isCorrect = answers[i] === card.correctIndex;
      if (isCorrect) correct += 1;
      db.recordAnswer(card.id, isCorrect);
    });
    db.completeSession();
    db.saveMockExamResult({ grade: gradeNum, subjectId, total: cards.length, correct, durationSeconds });
    refresh();
    setPhase({ name: 'summary', cards, answers, durationSeconds });
  }

  // --- Setup ---
  if (phase.name === 'setup') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={{ color: colors.textFaint, fontSize: 18 }}>✕</Text>
            </Pressable>
            <View style={{ width: 18 }} />
          </View>

          <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Mock exam</Text>
          <Text style={[styles.title, { color: colors.text }]}>Timed, exam-style practice</Text>
          <Text style={[styles.subtitle, { color: colors.textSoft }]}>
            No answers revealed until you finish — just like the real thing. You'll get a full review and score
            breakdown at the end.
          </Text>

          <Text style={[styles.label, { color: colors.textFaint }]}>Subject</Text>
          <View style={styles.chipGrid}>
            <Pressable
              onPress={() => setSubjectId(null)}
              style={[
                styles.subjectChip,
                {
                  borderColor: subjectId === null ? colors.tint : colors.line,
                  backgroundColor: subjectId === null ? colors.tintSoft : colors.surface,
                },
              ]}>
              <Text style={styles.chipEmoji}>🎯</Text>
              <Text style={[styles.chipLabel, { color: subjectId === null ? colors.tint : colors.textSoft }]}>
                Mixed
              </Text>
            </Pressable>
            {SUBJECTS.map((s) => {
              const selected = s.id === subjectId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSubjectId(s.id)}
                  style={[
                    styles.subjectChip,
                    {
                      borderColor: selected ? colors.tint : colors.line,
                      backgroundColor: selected ? colors.tintSoft : colors.surface,
                    },
                  ]}>
                  <Text style={styles.chipEmoji}>{s.emoji}</Text>
                  <Text style={[styles.chipLabel, { color: selected ? colors.tint : colors.textSoft }]} numberOfLines={1}>
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.textFaint }]}>Length</Text>
          <View style={styles.chipGrid}>
            {LENGTH_OPTIONS.map((n) => {
              const selected = n === length;
              return (
                <Pressable
                  key={n}
                  onPress={() => setLength(n)}
                  style={[
                    styles.lengthChip,
                    {
                      borderColor: selected ? colors.tint : colors.line,
                      backgroundColor: selected ? colors.tintSoft : colors.surface,
                    },
                  ]}>
                  <Text style={[styles.chipLabel, { color: selected ? colors.tint : colors.textSoft }]}>
                    {n} questions
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.availabilityHint, { color: colors.textFaint }]}>
            {available === 0
              ? "No practice questions yet for this subject — try Mixed, or add material for it first."
              : `${available} question${available === 1 ? '' : 's'} available — this exam will use ${effectiveLength}.`}
          </Text>

          <View style={{ flex: 1 }} />

          <Pressable
            disabled={available === 0}
            onPress={start}
            style={[styles.button, { backgroundColor: available > 0 ? colors.tint : colors.line }]}>
            <Text style={[styles.buttonLabel, { color: available > 0 ? colors.surface : colors.textFaint }]}>
              Start exam
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Question ---
  if (phase.name === 'question') {
    const card = phase.cards[phase.index];
    const subject = SUBJECT_BY_ID.get(card.subjectId);
    const selected = phase.answers[phase.index];
    const isLast = phase.index === phase.cards.length - 1;

    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          <View style={styles.topRow}>
            <Text style={{ color: colors.textFaint, fontSize: 13, fontWeight: '600' }}>
              Question {phase.index + 1} of {phase.cards.length}
            </Text>
            <Text style={[styles.timer, { color: colors.tint }]}>⏱ {formatDuration(elapsed)}</Text>
          </View>

          <Text style={[styles.chip, { backgroundColor: colors.tintSoft, color: colors.tint }]}>
            {subject ? `${subject.emoji} ${subject.name} · ${card.topic}` : card.topic}
          </Text>

          <Text style={[styles.question, { color: colors.text }]}>{card.question}</Text>

          <View style={styles.options}>
            {card.options.map((opt, i) => {
              const isSelected = i === selected;
              return (
                <Pressable
                  key={opt}
                  onPress={() => selectOption(i)}
                  style={[
                    styles.option,
                    {
                      borderColor: isSelected ? colors.tint : colors.line,
                      backgroundColor: isSelected ? colors.tintSoft : colors.surface,
                    },
                  ]}>
                  <Text style={[styles.optionText, { color: isSelected ? colors.tint : colors.text }]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flex: 1 }} />

          <Pressable
            disabled={selected === null}
            onPress={advance}
            style={[styles.button, { backgroundColor: selected !== null ? colors.tint : colors.line }]}>
            <Text style={[styles.buttonLabel, { color: selected !== null ? colors.surface : colors.textFaint }]}>
              {isLast ? 'Finish exam' : 'Next question →'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- Summary ---
  const { cards, answers, durationSeconds } = phase;
  const correctCount = cards.reduce((sum, c, i) => sum + (answers[i] === c.correctIndex ? 1 : 0), 0);
  const pct = Math.round((correctCount / cards.length) * 100);
  const banding =
    pct >= 80
      ? { emoji: '🌟', text: 'Excellent! This is exam-ready.' }
      : pct >= 60
      ? { emoji: '💪', text: 'Good effort — a bit more practice will help.' }
      : { emoji: '📚', text: "Let's practice more before the real thing." };

  // Group into per-topic accuracy so the weak spots are visible immediately,
  // not just after visiting the Parent view later.
  const byTopic = new Map<string, { topic: string; subjectName: string; total: number; correct: number }>();
  cards.forEach((c, i) => {
    const key = `${c.subjectId}-${c.topic}`;
    const entry = byTopic.get(key) ?? {
      topic: c.topic,
      subjectName: SUBJECT_BY_ID.get(c.subjectId)?.name ?? c.subjectId,
      total: 0,
      correct: 0,
    };
    entry.total += 1;
    if (answers[i] === c.correctIndex) entry.correct += 1;
    byTopic.set(key, entry);
  });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Exam complete</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {correctCount}/{cards.length} correct ({pct}%)
        </Text>

        <View style={[styles.insightCard, { backgroundColor: colors.tintSoft }]}>
          <Text style={[styles.insightText, { color: colors.text }]}>
            {banding.emoji} {banding.text}
          </Text>
          <Text style={[styles.insightMeta, { color: colors.tint }]}>Finished in {formatDuration(durationSeconds)}</Text>
        </View>

        <Text style={[styles.label, { color: colors.textFaint }]}>By topic</Text>
        <View style={styles.subjectList}>
          {Array.from(byTopic.values()).map((t) => (
            <View
              key={`${t.subjectName}-${t.topic}`}
              style={[styles.topicRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subjectName, { color: colors.text }]}>{t.topic}</Text>
                <Text style={[styles.subjectMeta, { color: colors.textFaint }]}>{t.subjectName}</Text>
              </View>
              <Text style={[styles.subjectAccuracy, { color: colors.text }]}>
                {t.correct}/{t.total}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textFaint }]}>Review answers</Text>
        <View style={styles.subjectList}>
          {cards.map((c, i) => {
            const gotIt = answers[i] === c.correctIndex;
            return (
              <View
                key={c.id}
                style={[
                  styles.reviewCard,
                  { backgroundColor: colors.surface, borderColor: gotIt ? colors.line : colors.gold },
                ]}>
                <Text style={[styles.reviewQuestion, { color: colors.text }]}>
                  {gotIt ? '✅' : '❌'} {c.question}
                </Text>
                <Text style={[styles.reviewAnswer, { color: colors.textSoft }]}>
                  Correct answer: {c.options[c.correctIndex]}
                </Text>
                <Text style={[styles.reviewExplanation, { color: colors.textFaint }]}>{c.explanation}</Text>
              </View>
            );
          })}
        </View>

        <Pressable style={[styles.button, { backgroundColor: colors.tint }]} onPress={() => router.back()}>
          <Text style={[styles.buttonLabel, { color: colors.surface }]}>Done</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: 20, gap: 12, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 8 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
  lengthChip: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  availabilityHint: { fontSize: 12, lineHeight: 17, marginTop: 4 },

  timer: { fontSize: 13, fontWeight: '700' },
  chip: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  question: { fontSize: 20, fontWeight: '800', lineHeight: 27, marginTop: 4 },
  options: { gap: 10, marginTop: 4 },
  option: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 15, fontWeight: '600' },

  insightCard: { borderRadius: 14, padding: 14, gap: 4 },
  insightText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  insightMeta: { fontSize: 12, fontWeight: '600' },

  subjectList: { gap: 8 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  subjectName: { fontSize: 13, fontWeight: '700' },
  subjectMeta: { fontSize: 11, marginTop: 1 },
  subjectAccuracy: { fontSize: 14, fontWeight: '800' },

  reviewCard: { borderRadius: 12, borderWidth: 1.5, padding: 12, gap: 4 },
  reviewQuestion: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  reviewAnswer: { fontSize: 12, fontWeight: '600' },
  reviewExplanation: { fontSize: 12, lineHeight: 17 },

  button: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
});
