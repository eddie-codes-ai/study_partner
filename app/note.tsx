import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as db from '@/lib/db';
import { SUBJECTS } from '@/lib/seed';
import { useAppStore } from '@/lib/store';
import { explainMore, generateNote, TutorError } from '@/lib/tutor';

const SUBJECT_BY_ID = new Map(SUBJECTS.map((s) => [s.id, s.name]));

type AiState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; text: string };

export default function NoteScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const { subject, topic } = useLocalSearchParams<{ subject: string; topic: string }>();
  const grade = useAppStore((s) => s.grade);

  const gradeNum = grade ? Number(grade) : null;
  const [note] = useState(() => (gradeNum && subject && topic ? db.getNote(gradeNum, subject, topic) : null));
  const [ai, setAi] = useState<AiState>({ status: 'idle' });

  const subjectName = SUBJECT_BY_ID.get(subject) ?? '';

  async function handleGenerate() {
    if (!gradeNum) return;
    setAi({ status: 'loading' });
    try {
      const result = await generateNote(gradeNum, subjectName, topic);
      db.saveGeneratedNote(gradeNum, subject, topic, result.title, result.body);
      setAi({ status: 'done', text: result.body });
    } catch (err) {
      setAi({ status: 'error', message: err instanceof TutorError ? err.message : 'Something went wrong.' });
    }
  }

  async function handleExplainMore() {
    if (!gradeNum || !note) return;
    setAi({ status: 'loading' });
    try {
      const result = await explainMore(gradeNum, subjectName, topic, note.body);
      setAi({ status: 'done', text: result.explanation });
    } catch (err) {
      setAi({ status: 'error', message: err instanceof TutorError ? err.message : 'Something went wrong.' });
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.textFaint, fontSize: 18 }}>✕</Text>
          </Pressable>
          <View style={{ width: 18 }} />
        </View>

        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>
          {subjectName} · {topic}
        </Text>

        {note ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{note.title}</Text>
            {note.body.split('\n\n').map((paragraph, i) => (
              <Text key={i} style={[styles.paragraph, { color: colors.text }]}>
                {paragraph}
              </Text>
            ))}

            {ai.status === 'idle' && (
              <Pressable onPress={handleExplainMore} style={[styles.ghostButton, { borderColor: colors.tint }]}>
                <Text style={[styles.ghostButtonLabel, { color: colors.tint }]}>🪄 I don't understand — explain differently</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>No notes for this topic yet.</Text>
            {ai.status === 'idle' && (
              <Pressable onPress={handleGenerate} style={[styles.button, { backgroundColor: colors.tint }]}>
                <Text style={[styles.buttonLabel, { color: colors.surface }]}>✨ Generate a note with AI</Text>
              </Pressable>
            )}
          </>
        )}

        {ai.status === 'loading' && (
          <View style={[styles.aiCard, { backgroundColor: colors.tintSoft }]}>
            <ActivityIndicator color={colors.tint} />
            <Text style={[styles.aiHint, { color: colors.tint }]}>Thinking…</Text>
          </View>
        )}

        {ai.status === 'error' && (
          <View style={[styles.aiCard, { backgroundColor: colors.goldSoft }]}>
            <Text style={[styles.aiHint, { color: colors.gold }]}>{ai.message}</Text>
          </View>
        )}

        {ai.status === 'done' && (
          <View style={[styles.aiCard, { backgroundColor: colors.tintSoft }]}>
            <Text style={[styles.aiEyebrow, { color: colors.tint }]}>✨ AI explanation</Text>
            {ai.text.split('\n\n').map((paragraph, i) => (
              <Text key={i} style={[styles.paragraph, { color: colors.text }]}>
                {paragraph}
              </Text>
            ))}
            <Text style={[styles.aiDisclaimer, { color: colors.textFaint }]}>
              ⚠️ AI-generated — unlike the rest of Kua, this wasn't checked by a person. Double-check anything
              important with your teacher or textbook.
            </Text>
          </View>
        )}

        <View style={{ height: 12 }} />
        <Pressable
          onPress={() => router.replace(`/session?subject=${subject}&topic=${encodeURIComponent(topic)}`)}
          style={[styles.button, { backgroundColor: colors.tint }]}>
          <Text style={[styles.buttonLabel, { color: colors.surface }]}>Practice this topic →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  paragraph: { fontSize: 16, lineHeight: 24 },
  button: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  ghostButton: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, marginTop: 4 },
  ghostButtonLabel: { fontSize: 14, fontWeight: '700' },
  aiCard: { borderRadius: 14, padding: 16, gap: 8 },
  aiEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  aiHint: { fontSize: 14, fontWeight: '600' },
  aiDisclaimer: { fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
});
