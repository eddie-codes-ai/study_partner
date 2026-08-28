import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as db from '@/lib/db';
import { SUBJECTS } from '@/lib/seed';
import { useAppStore } from '@/lib/store';

type Phase = 'question' | 'feedback' | 'summary';

const SUBJECT_BY_ID = new Map(SUBJECTS.map((s) => [s.id, s.name]));

export default function SessionScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const refresh = useAppStore((s) => s.refresh);
  const streak = useAppStore((s) => s.streak);
  const grade = useAppStore((s) => s.grade);
  const { subject } = useLocalSearchParams<{ subject?: string }>();

  // Snapshot the due cards once, at mount, so the list doesn't shift under
  // the student mid-session as due_at times update. Scoped to `subject` when
  // launched from a subject tile on Home, otherwise mixed across subjects.
  const [cards] = useState(() => (grade ? db.getDueCards(Number(grade), 8, subject) : []));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [starsEarned, setStarsEarned] = useState(0);

  const card = cards[index];
  const isLast = index === cards.length - 1;

  const subjectName = useMemo(
    () => (card ? SUBJECT_BY_ID.get(card.subjectId) ?? '' : ''),
    [card]
  );

  if (cards.length === 0) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.text }]}>Nothing due right now.</Text>
          <Pressable style={[styles.button, { backgroundColor: colors.tint }]} onPress={() => router.back()}>
            <Text style={[styles.buttonLabel, { color: colors.surface }]}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  function selectOption(i: number) {
    if (phase !== 'question') return;
    const correct = i === card.correctIndex;
    db.recordAnswer(card.id, correct);
    setSelected(i);
    setCorrectCount((c) => c + (correct ? 1 : 0));
    if (correct) setStarsEarned((s) => s + 2);
    setPhase('feedback');
  }

  function next() {
    if (isLast) {
      db.completeSession();
      refresh();
      setPhase('summary');
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setPhase('question');
  }

  if (phase === 'summary') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Session complete</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {correctCount === cards.length ? 'Nice work! ⭐⭐⭐' : 'Session complete ⭐'}
          </Text>

          <View style={styles.statsRow}>
            <Stat label="Correct" value={`${correctCount}/${cards.length}`} colors={colors} />
            <Stat label="Stars" value={`+${starsEarned}`} colors={colors} />
            <Stat label="Streak" value={`${streak}`} colors={colors} />
          </View>

          <View style={[styles.insightCard, { backgroundColor: colors.tintSoft }]}>
            <Text style={[styles.insightText, { color: colors.text }]}>
              {correctCount === cards.length
                ? `Full marks on ${subjectName} — this topic is getting strong.`
                : `${correctCount}/${cards.length} correct. Keep practicing to strengthen this topic.`}
            </Text>
          </View>

          <View style={{ flex: 1 }} />
          <Pressable style={[styles.button, { backgroundColor: colors.tint }]} onPress={() => router.back()}>
            <Text style={[styles.buttonLabel, { color: colors.surface }]}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.textFaint, fontSize: 18 }}>✕</Text>
          </Pressable>
          <Text style={{ color: colors.textFaint, fontSize: 13, fontWeight: '600' }}>
            Question {index + 1} of {cards.length}
          </Text>
          <View style={{ width: 18 }} />
        </View>

        <Text style={[styles.chip, { backgroundColor: colors.tintSoft, color: colors.tint }]}>
          {subjectName} · {card.topic}
        </Text>

        <Text style={[styles.question, { color: colors.text }]}>{card.question}</Text>

        <View style={styles.options}>
          {card.options.map((opt, i) => {
            const isCorrectOption = i === card.correctIndex;
            const isSelected = i === selected;
            let borderColor = colors.line;
            let backgroundColor = colors.surface;
            let textColor = colors.text;

            if (phase === 'feedback') {
              if (isCorrectOption) {
                borderColor = colors.tint;
                backgroundColor = colors.tintSoft;
                textColor = colors.tint;
              } else if (isSelected) {
                borderColor = colors.textFaint;
                textColor = colors.textFaint;
              }
            }

            return (
              <Pressable
                key={opt}
                onPress={() => selectOption(i)}
                style={[styles.option, { borderColor, backgroundColor }]}>
                <Text style={[styles.optionText, { color: textColor }]}>{opt}</Text>
                {phase === 'feedback' && isCorrectOption && <Text style={{ color: colors.tint }}>✓</Text>}
                {phase === 'feedback' && isSelected && !isCorrectOption && (
                  <Text style={{ color: colors.textFaint }}>✕</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {phase === 'feedback' && (
          <>
            <View style={[styles.feedbackBanner, { backgroundColor: colors.tintSoft }]}>
              <Text style={[styles.feedbackText, { color: colors.tint }]}>{card.explanation}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable style={[styles.button, { backgroundColor: colors.tint }]} onPress={next}>
              <Text style={[styles.buttonLabel, { color: colors.surface }]}>
                {isLast ? 'See results' : 'Next question →'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: (typeof Colors)['light'] }) {
  return (
    <View style={[stat.box, { backgroundColor: colors.background }]}>
      <Text style={[stat.value, { color: colors.text }]}>{value}</Text>
      <Text style={[stat.label, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

const stat = StyleSheet.create({
  box: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 11, marginTop: 2 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: 20, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  question: { fontSize: 20, fontWeight: '800', lineHeight: 27 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionText: { fontSize: 15, fontWeight: '600' },
  feedbackBanner: { borderRadius: 12, padding: 14 },
  feedbackText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  button: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10 },
  insightCard: { borderRadius: 14, padding: 14 },
  insightText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
