import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

// Intentionally a static stub: what happens after a photo/voice capture
// (AI-generated cards vs. pre-built decks) is still an open product
// decision — see memory/study-app-cbc-scope.md. Wire this up once that's
// settled instead of guessing at a pipeline now.
export default function AddMaterialScreen() {
  const colors = Colors[useColorScheme()];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.container}>
        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Add material</Text>
        <Text style={[styles.title, { color: colors.text }]}>Turn your own notes into practice</Text>

        <View style={[styles.option, { borderColor: colors.line }]}>
          <Text style={styles.optionEmoji}>📷</Text>
          <Text style={[styles.optionTitle, { color: colors.text }]}>Photo of notes</Text>
          <Text style={[styles.optionBody, { color: colors.textSoft }]}>Snap a page from your book</Text>
        </View>

        <View style={[styles.option, { borderColor: colors.line }]}>
          <Text style={styles.optionEmoji}>🎤</Text>
          <Text style={[styles.optionTitle, { color: colors.text }]}>Voice summary</Text>
          <Text style={[styles.optionBody, { color: colors.textSoft }]}>Talk through what you just learned</Text>
        </View>

        <Text style={[styles.note, { color: colors.textFaint }]}>
          Coming soon — how captured material turns into practice questions is still being decided.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 20, gap: 14 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  option: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    gap: 4,
    opacity: 0.75,
  },
  optionEmoji: { fontSize: 22 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionBody: { fontSize: 13 },
  note: { fontSize: 12, fontStyle: 'italic', marginTop: 6 },
});
