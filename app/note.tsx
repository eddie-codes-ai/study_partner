import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as db from '@/lib/db';
import { SUBJECTS } from '@/lib/seed';
import { useAppStore } from '@/lib/store';

const SUBJECT_BY_ID = new Map(SUBJECTS.map((s) => [s.id, s.name]));

export default function NoteScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const { subject, topic } = useLocalSearchParams<{ subject: string; topic: string }>();
  const grade = useAppStore((s) => s.grade);

  const gradeNum = grade ? Number(grade) : null;
  const [note] = useState(() => (gradeNum && subject && topic ? db.getNote(gradeNum, subject, topic) : null));

  const subjectName = SUBJECT_BY_ID.get(subject) ?? '';

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
          </>
        ) : (
          <Text style={[styles.title, { color: colors.text }]}>No notes for this topic yet.</Text>
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
});
