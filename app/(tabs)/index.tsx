import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppStore } from '@/lib/store';

const STAGE_EMOJI = { seed: '🌱', sprout: '🌿', tree: '🌳' } as const;

export default function HomeScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const grade = useAppStore((s) => s.grade);
  const streak = useAppStore((s) => s.streak);
  const dueCount = useAppStore((s) => s.dueCount);
  const subjects = useAppStore((s) => s.subjects);
  const lastStudied = useAppStore((s) => s.lastStudied);
  const lastStudiedSubject = subjects.find((s) => s.id === lastStudied?.subjectId) ?? null;

  useEffect(() => {
    if (grade === null) {
      router.replace('/onboarding');
    }
  }, [grade, router]);

  if (grade === null) return null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.push('/onboarding')} hitSlop={8}>
            <Text style={[styles.greeting, { color: colors.textFaint }]}>Habari! 👋 Grade {grade} · change</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/parent')} hitSlop={8}>
            <Text style={[styles.greeting, { color: colors.textFaint }]}>👪 Parents</Text>
          </Pressable>
        </View>

        <View style={[styles.hero, { backgroundColor: colors.tintSoft }]}>
          <Text style={[styles.streak, { color: colors.gold }]}>🔥 {streak}-day streak</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {dueCount > 0 ? `${dueCount} card${dueCount === 1 ? '' : 's'} due today` : "You're all caught up!"}
          </Text>
          <Text style={[styles.heroHint, { color: colors.textSoft }]}>
            {dueCount > 0 ? 'Pick a subject below to start' : 'Come back tomorrow for more'}
          </Text>
        </View>

        {lastStudied && lastStudiedSubject && (
          <Pressable
            onPress={() =>
              router.push(
                `/session?subject=${lastStudied.subjectId}${
                  lastStudied.topic ? `&topic=${encodeURIComponent(lastStudied.topic)}` : ''
                }`
              )
            }
            style={[styles.examCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={styles.examEmoji}>{lastStudiedSubject.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.examTitle, { color: colors.text }]}>
                Continue {lastStudiedSubject.name}
                {lastStudied.topic ? ` · ${lastStudied.topic}` : ''}
              </Text>
              <Text style={[styles.examHint, { color: colors.textFaint }]}>Pick up right where you left off</Text>
            </View>
            <Text style={{ color: colors.tint, fontSize: 18 }}>→</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push('/mock-exam')}
          style={[styles.examCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={styles.examEmoji}>📝</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.examTitle, { color: colors.text }]}>Take a mock exam</Text>
            <Text style={[styles.examHint, { color: colors.textFaint }]}>Timed, exam-style — no peeking at answers</Text>
          </View>
          <Text style={{ color: colors.tint, fontSize: 18 }}>→</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { color: colors.textFaint }]}>Subjects</Text>
        <View style={styles.grid}>
          {subjects.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/topics?subject=${s.id}`)}
              style={[styles.cell, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {s.dueCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.gold }]}>
                  <Text style={styles.badgeText}>{s.dueCount}</Text>
                </View>
              )}
              <Text style={styles.cellEmoji}>{s.emoji}</Text>
              <Text style={[styles.cellLabel, { color: colors.textSoft }]} numberOfLines={2}>
                {s.name}
              </Text>
              <Text style={styles.cellStage}>{STAGE_EMOJI[s.stage]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 20, gap: 20, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 14, fontWeight: '600' },
  hero: { borderRadius: 18, padding: 18, gap: 6 },
  streak: { fontSize: 13, fontWeight: '700' },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  heroHint: { fontSize: 13, fontWeight: '600' },
  examCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  examEmoji: { fontSize: 24 },
  examTitle: { fontSize: 15, fontWeight: '700' },
  examHint: { fontSize: 12, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    width: '31%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  cellEmoji: { fontSize: 22 },
  cellLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  cellStage: { fontSize: 14 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#1E2A20' },
});
