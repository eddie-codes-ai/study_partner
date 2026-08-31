import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as db from '@/lib/db';
import type { ParentSummary } from '@/lib/db';
import { SUBJECTS } from '@/lib/seed';
import { useAppStore } from '@/lib/store';

const SUBJECT_BY_ID = new Map(SUBJECTS.map((s) => [s.id, s]));

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatExamDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const STAGE_LABEL = { seed: 'Just started', sprout: 'Growing', tree: 'Strong' } as const;

// Re-locks every time this screen is opened — unlocked state lives only in
// this component, never in the store or db, so leaving and coming back
// always asks for the PIN again.
type Gate =
  | { mode: 'create'; pin: string; confirm: string; error: string | null }
  | { mode: 'enter'; pin: string; error: string | null }
  | { mode: 'unlocked' };

function freshCreateGate(): Gate {
  return { mode: 'create', pin: '', confirm: '', error: null };
}

function freshEnterGate(): Gate {
  return { mode: 'enter', pin: '', error: null };
}

export default function ParentScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const grade = useAppStore((s) => s.grade);
  const gradeNum = grade ? Number(grade) : null;

  const [gate, setGate] = useState<Gate>(() => (db.getParentPin() ? freshEnterGate() : freshCreateGate()));
  const [summary, setSummary] = useState<ParentSummary | null>(null);

  useEffect(() => {
    if (gate.mode === 'unlocked' && gradeNum) {
      setSummary(db.getParentSummary(gradeNum));
    }
  }, [gate.mode, gradeNum]);

  function handleCreatePin() {
    if (gate.mode !== 'create') return;
    if (!/^\d{4}$/.test(gate.pin)) {
      setGate({ ...gate, error: 'PIN must be 4 digits.' });
      return;
    }
    if (gate.pin !== gate.confirm) {
      setGate({ ...gate, error: "PINs don't match." });
      return;
    }
    db.setParentPin(gate.pin);
    setGate({ mode: 'unlocked' });
  }

  function handleEnterPin() {
    if (gate.mode !== 'enter') return;
    if (gate.pin === db.getParentPin()) {
      setGate({ mode: 'unlocked' });
    } else {
      setGate({ mode: 'enter', pin: '', error: 'Wrong PIN. Try again.' });
    }
  }

  if (gate.mode !== 'unlocked') {
    const isCreate = gate.mode === 'create';
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.gateContainer}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.gateClose}>
            <Text style={{ color: colors.textFaint, fontSize: 18 }}>✕</Text>
          </Pressable>

          <Text style={styles.gateEmoji}>👪</Text>
          <Text style={[styles.gateTitle, { color: colors.text }]}>
            {isCreate ? 'Set a parent PIN' : 'Enter parent PIN'}
          </Text>
          <Text style={[styles.gateSubtitle, { color: colors.textSoft }]}>
            {isCreate
              ? "Choose a 4-digit PIN so this progress view stays between you and your child's teacher."
              : "Keeps this view just for you."}
          </Text>

          {isCreate && gate.mode === 'create' && (
            <>
              <TextInput
                value={gate.pin}
                onChangeText={(v) => setGate({ ...gate, pin: v.replace(/\D/g, '').slice(0, 4), error: null })}
                placeholder="New PIN"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={[styles.pinInput, { borderColor: colors.line, color: colors.text, backgroundColor: colors.surface }]}
              />
              <TextInput
                value={gate.confirm}
                onChangeText={(v) => setGate({ ...gate, confirm: v.replace(/\D/g, '').slice(0, 4), error: null })}
                placeholder="Confirm PIN"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={[styles.pinInput, { borderColor: colors.line, color: colors.text, backgroundColor: colors.surface }]}
              />
            </>
          )}

          {!isCreate && gate.mode === 'enter' && (
            <TextInput
              value={gate.pin}
              onChangeText={(v) => setGate({ mode: 'enter', pin: v.replace(/\D/g, '').slice(0, 4), error: null })}
              placeholder="PIN"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              autoFocus
              style={[styles.pinInput, { borderColor: colors.line, color: colors.text, backgroundColor: colors.surface }]}
            />
          )}

          {gate.error && <Text style={[styles.gateError, { color: colors.gold }]}>{gate.error}</Text>}

          <Pressable
            onPress={isCreate ? handleCreatePin : handleEnterPin}
            style={[styles.button, { backgroundColor: colors.tint }]}>
            <Text style={[styles.buttonLabel, { color: colors.surface }]}>{isCreate ? 'Set PIN' : 'Unlock'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!summary) return null;

  const maxCount = Math.max(1, ...summary.last7Days.map((d) => d.count));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.textFaint, fontSize: 18 }}>✕</Text>
          </Pressable>
          <Pressable onPress={() => setGate(freshCreateGate())} hitSlop={12}>
            <Text style={[styles.changePin, { color: colors.tint }]}>Change PIN</Text>
          </Pressable>
        </View>

        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Parent view</Text>
        <Text style={[styles.title, { color: colors.text }]}>Grade {summary.grade} progress</Text>

        <View style={styles.statRow}>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary.streak}</Text>
            <Text style={[styles.statLabel, { color: colors.textFaint }]}>day streak</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary.stars}</Text>
            <Text style={[styles.statLabel, { color: colors.textFaint }]}>stars earned</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary.totalAnswered}</Text>
            <Text style={[styles.statLabel, { color: colors.textFaint }]}>questions answered</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={styles.statEmoji}>🎯</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {summary.overallAccuracy === null ? '—' : `${summary.overallAccuracy}%`}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textFaint }]}>accuracy overall</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textFaint }]}>This week</Text>
        <View style={[styles.weekCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {summary.last7Days.map((d) => (
            <View key={d.day} style={styles.weekCol}>
              <View style={styles.weekBarTrack}>
                <View
                  style={[
                    styles.weekBar,
                    {
                      height: d.count > 0 ? 8 + (d.count / maxCount) * 44 : 4,
                      backgroundColor: d.count > 0 ? colors.tint : colors.line,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.weekLabel, { color: colors.textFaint }]}>{d.label}</Text>
              <Text style={[styles.weekCount, { color: colors.textSoft }]}>{d.count || ''}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textFaint }]}>By subject</Text>
        <View style={styles.subjectList}>
          {summary.subjects.map((s) => (
            <View key={s.id} style={[styles.subjectRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Text style={styles.subjectEmoji}>{s.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subjectName, { color: colors.text }]}>{s.name}</Text>
                <Text style={[styles.subjectMeta, { color: colors.textFaint }]}>{STAGE_LABEL[s.stage]}</Text>
              </View>
              <View style={styles.subjectStats}>
                <Text style={[styles.subjectAccuracy, { color: colors.text }]}>
                  {s.accuracy === null ? '—' : `${s.accuracy}%`}
                </Text>
                <Text style={[styles.subjectAnswered, { color: colors.textFaint }]}>
                  {s.answered} answered{s.dueCount > 0 ? ` · ${s.dueCount} due` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textFaint }]}>Could use a hand</Text>
        {summary.weakTopics.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.tintSoft }]}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Nothing flagged — accuracy looks solid across every topic practiced enough to tell.
            </Text>
          </View>
        ) : (
          <View style={styles.subjectList}>
            {summary.weakTopics.map((t) => (
              <View
                key={`${t.subjectId}-${t.topic}`}
                style={[styles.weakRow, { backgroundColor: colors.goldSoft, borderColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subjectName, { color: colors.text }]}>{t.topic}</Text>
                  <Text style={[styles.subjectMeta, { color: colors.textFaint }]}>{t.subjectName}</Text>
                </View>
                <View style={styles.subjectStats}>
                  <Text style={[styles.subjectAccuracy, { color: colors.gold }]}>{t.accuracy}%</Text>
                  <Text style={[styles.subjectAnswered, { color: colors.textFaint }]}>{t.attempts} tries</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textFaint }]}>Recent mock exams</Text>
        {summary.recentMockExams.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.tintSoft }]}>
            <Text style={[styles.emptyText, { color: colors.text }]}>No mock exams taken yet.</Text>
          </View>
        ) : (
          <View style={styles.subjectList}>
            {summary.recentMockExams.map((e) => {
              const subject = e.subjectId ? SUBJECT_BY_ID.get(e.subjectId) : null;
              const pct = Math.round((e.correct / e.total) * 100);
              return (
                <View key={e.id} style={[styles.subjectRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Text style={styles.subjectEmoji}>{subject ? subject.emoji : '🎯'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subjectName, { color: colors.text }]}>{subject ? subject.name : 'Mixed'}</Text>
                    <Text style={[styles.subjectMeta, { color: colors.textFaint }]}>
                      {formatExamDate(e.takenAt)} · {formatDuration(e.durationSeconds)}
                    </Text>
                  </View>
                  <View style={styles.subjectStats}>
                    <Text style={[styles.subjectAccuracy, { color: colors.text }]}>{pct}%</Text>
                    <Text style={[styles.subjectAnswered, { color: colors.textFaint }]}>
                      {e.correct}/{e.total}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[styles.footNote, { color: colors.textFaint }]}>
          Only visible with the PIN — your child can't open this from the app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 20, gap: 10, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  changePin: { fontSize: 13, fontWeight: '700' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 8 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },

  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  statTile: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
  },
  statEmoji: { fontSize: 20 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 8 },

  weekCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  weekCol: { alignItems: 'center', gap: 4, width: 32 },
  weekBarTrack: { height: 52, justifyContent: 'flex-end' },
  weekBar: { width: 14, borderRadius: 7 },
  weekLabel: { fontSize: 10, fontWeight: '700' },
  weekCount: { fontSize: 10, fontWeight: '600', minHeight: 12 },

  subjectList: { gap: 8 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  subjectEmoji: { fontSize: 20 },
  subjectName: { fontSize: 14, fontWeight: '700' },
  subjectMeta: { fontSize: 11, marginTop: 1 },
  subjectStats: { alignItems: 'flex-end' },
  subjectAccuracy: { fontSize: 15, fontWeight: '800' },
  subjectAnswered: { fontSize: 11, marginTop: 1 },

  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },

  emptyCard: { borderRadius: 14, padding: 14 },
  emptyText: { fontSize: 13, lineHeight: 19 },

  footNote: { fontSize: 11, textAlign: 'center', marginTop: 14 },

  // PIN gate
  gateContainer: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 10 },
  gateClose: { position: 'absolute', top: 8, left: 4, padding: 8 },
  gateEmoji: { fontSize: 36, marginBottom: 4 },
  gateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  gateSubtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 8, maxWidth: 280 },
  pinInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    width: 180,
  },
  gateError: { fontSize: 12, fontWeight: '600' },
  button: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', width: 180, marginTop: 6 },
  buttonLabel: { fontSize: 15, fontWeight: '700' },
});
