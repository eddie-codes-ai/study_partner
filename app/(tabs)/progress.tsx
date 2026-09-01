import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppStore } from '@/lib/store';

const STAGE = {
  seed: { emoji: '🌱', label: 'Just started' },
  sprout: { emoji: '🌿', label: 'Growing' },
  tree: { emoji: '🌳', label: 'Strong' },
} as const;

export default function ProgressScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const subjects = useAppStore((s) => s.subjects);
  const stars = useAppStore((s) => s.stars);
  const streak = useAppStore((s) => s.streak);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Your garden</Text>
          <Pressable onPress={() => router.push('/parent')} hitSlop={8}>
            <Text style={[styles.parentLink, { color: colors.textFaint }]}>👪 Parents</Text>
          </Pressable>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Grows as each subject gets stronger</Text>

        <View style={styles.statRow}>
          <Text style={[styles.stat, { color: colors.gold }]}>🔥 {streak}-day streak</Text>
          <Text style={[styles.stat, { color: colors.gold }]}>⭐ {stars} stars</Text>
        </View>

        <View style={styles.grid}>
          {subjects.map((s) => {
            const stage = STAGE[s.stage];
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/topics?subject=${s.id}`)}
                style={[styles.cell, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                {s.dueCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.gold }]}>
                    <Text style={styles.badgeText}>{s.dueCount}</Text>
                  </View>
                )}
                <Text style={styles.emoji}>{stage.emoji}</Text>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {s.name}
                </Text>
                <Text style={[styles.stage, { color: colors.textFaint }]}>{stage.label}</Text>
                {s.accuracy !== null && (
                  <Text style={[styles.accuracy, { color: colors.tint }]}>
                    {s.accuracy}% · {s.answered} done
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 20, gap: 6, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  parentLink: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  statRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  stat: { fontSize: 14, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: {
    width: '31%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  emoji: { fontSize: 30 },
  name: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  stage: { fontSize: 11 },
  accuracy: { fontSize: 10, fontWeight: '700', marginTop: 2 },
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
