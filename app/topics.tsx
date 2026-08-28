import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as db from '@/lib/db';
import { SUBJECTS } from '@/lib/seed';
import { useAppStore } from '@/lib/store';

const SUBJECT_BY_ID = new Map(SUBJECTS.map((s) => [s.id, s.name]));

export default function TopicsScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const { subject } = useLocalSearchParams<{ subject: string }>();
  const grade = useAppStore((s) => s.grade);
  const subjects = useAppStore((s) => s.subjects);

  const gradeNum = grade ? Number(grade) : null;
  const [topics] = useState(() => (gradeNum && subject ? db.getTopicsForSubject(gradeNum, subject) : []));

  const subjectName = SUBJECT_BY_ID.get(subject) ?? '';
  const dueCount = useMemo(
    () => subjects.find((s) => s.id === subject)?.dueCount ?? 0,
    [subjects, subject]
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.textFaint, fontSize: 18 }}>✕</Text>
          </Pressable>
          <View style={{ width: 18 }} />
        </View>

        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>{subjectName}</Text>
        <Text style={[styles.title, { color: colors.text }]}>Topics</Text>

        {dueCount > 0 && (
          <Pressable
            onPress={() => router.push(`/session?subject=${subject}`)}
            style={[styles.reviewCard, { backgroundColor: colors.tintSoft }]}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              🔥 Continue today's review ({dueCount} due)
            </Text>
            <Text style={[styles.reviewHint, { color: colors.tint }]}>Mixed across all topics →</Text>
          </Pressable>
        )}

        <View style={styles.topicList}>
          {topics.map((t) => (
            <View key={t.topic} style={[styles.topicRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.topicName, { color: colors.text }]}>{t.topic}</Text>
                <Text style={[styles.topicMeta, { color: colors.textFaint }]}>{t.cardCount} cards</Text>
              </View>
              <View style={styles.topicActions}>
                <Pressable
                  onPress={() => router.push(`/note?subject=${subject}&topic=${encodeURIComponent(t.topic)}`)}
                  style={[styles.actionButton, styles.ghostButton, { borderColor: colors.tint }]}>
                  <Text style={[styles.actionLabel, { color: colors.tint }]}>Read</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/session?subject=${subject}&topic=${encodeURIComponent(t.topic)}`)}
                  style={[styles.actionButton, { backgroundColor: colors.tint }]}>
                  <Text style={[styles.actionLabel, { color: colors.surface }]}>Practice</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
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
  reviewCard: { borderRadius: 14, padding: 14, gap: 4 },
  reviewTitle: { fontSize: 14, fontWeight: '700' },
  reviewHint: { fontSize: 12, fontWeight: '600' },
  topicList: { gap: 10, marginTop: 4 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  topicName: { fontSize: 15, fontWeight: '700' },
  topicMeta: { fontSize: 12, marginTop: 2 },
  topicActions: { flexDirection: 'row', gap: 8 },
  actionButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  ghostButton: { borderWidth: 1.5 },
  actionLabel: { fontSize: 13, fontWeight: '700' },
});
