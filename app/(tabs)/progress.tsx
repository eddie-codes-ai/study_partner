import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const colors = Colors[useColorScheme()];
  const subjects = useAppStore((s) => s.subjects);
  const stars = useAppStore((s) => s.stars);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Your garden</Text>
        <Text style={[styles.title, { color: colors.text }]}>Grows as each subject gets stronger</Text>
        <Text style={[styles.stars, { color: colors.gold }]}>⭐ {stars} stars earned</Text>

        <View style={styles.grid}>
          {subjects.map((s) => {
            const stage = STAGE[s.stage];
            return (
              <View key={s.id} style={[styles.cell, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Text style={styles.emoji}>{stage.emoji}</Text>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {s.name}
                </Text>
                <Text style={[styles.stage, { color: colors.textFaint }]}>{stage.label}</Text>
              </View>
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
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  stars: { fontSize: 14, fontWeight: '700', marginBottom: 16 },
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
});
