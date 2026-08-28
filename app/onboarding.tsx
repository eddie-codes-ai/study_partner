import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppStore } from '@/lib/store';

const GRADES = ['4', '5', '6'];

export default function OnboardingScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const setGrade = useAppStore((s) => s.setGrade);
  const [selected, setSelected] = useState<string | null>(null);

  const confirm = () => {
    if (!selected) return;
    setGrade(selected);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Kua</Text>
        <Text style={[styles.title, { color: colors.text }]}>Which grade are you in?</Text>

        <View style={styles.grades}>
          {GRADES.map((g) => {
            const isSelected = g === selected;
            return (
              <Pressable
                key={g}
                onPress={() => setSelected(g)}
                style={[
                  styles.gradeRow,
                  {
                    borderColor: isSelected ? colors.tint : colors.line,
                    backgroundColor: isSelected ? colors.tintSoft : colors.surface,
                  },
                ]}>
                <Text style={[styles.gradeLabel, { color: isSelected ? colors.tint : colors.text }]}>
                  Grade {g}
                </Text>
                {isSelected && <Text style={{ color: colors.tint, fontWeight: '700' }}>✓</Text>}
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          disabled={!selected}
          onPress={confirm}
          style={[styles.button, { backgroundColor: selected ? colors.tint : colors.line }]}>
          <Text style={[styles.buttonLabel, { color: selected ? colors.surface : colors.textFaint }]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, padding: 24, gap: 24 },
  eyebrow: { fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800' },
  grades: { gap: 12 },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  gradeLabel: { fontSize: 17, fontWeight: '700' },
  button: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
});
