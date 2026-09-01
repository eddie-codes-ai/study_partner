import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import * as db from '@/lib/db';
import { SUBJECTS } from '@/lib/seed';
import { useAppStore } from '@/lib/store';
import { extractTextFromImage, generateNote, generateQuestions, TutorError, type GeneratedQuestion } from '@/lib/tutor';

// Cap the longest edge before upload — keeps the request small/fast on a
// student's mobile data and well under the backend's size guard, without
// losing enough resolution to make the text unreadable to the model.
const MAX_PHOTO_DIMENSION = 1600;

type PhotoState =
  | { status: 'idle' }
  | { status: 'extracting'; uri: string }
  | { status: 'done'; uri: string }
  | { status: 'error'; message: string };

type FlowState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; title: string; body: string; cards: GeneratedQuestion[] }
  | { status: 'saved' };

export default function AddMaterialScreen() {
  const router = useRouter();
  const colors = Colors[useColorScheme()];
  const grade = useAppStore((s) => s.grade);
  const refresh = useAppStore((s) => s.refresh);

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [material, setMaterial] = useState('');
  const [flow, setFlow] = useState<FlowState>({ status: 'idle' });
  const [photo, setPhoto] = useState<PhotoState>({ status: 'idle' });

  const gradeNum = grade ? Number(grade) : null;
  const subject = SUBJECTS.find((s) => s.id === subjectId) ?? null;
  const canGenerate = !!gradeNum && !!subject && topic.trim().length > 0 && flow.status !== 'loading';

  async function handleGenerate() {
    if (!gradeNum || !subject) return;
    const cleanTopic = topic.trim();
    const cleanMaterial = material.trim() || undefined;
    setFlow({ status: 'loading' });
    try {
      const [note, questions] = await Promise.all([
        generateNote(gradeNum, subject.name, cleanTopic, cleanMaterial),
        generateQuestions(gradeNum, subject.name, cleanTopic, 6, cleanMaterial),
      ]);
      setFlow({ status: 'done', title: note.title, body: note.body, cards: questions.cards });
    } catch (err) {
      setFlow({ status: 'error', message: err instanceof TutorError ? err.message : 'Something went wrong.' });
    }
  }

  function handleSave() {
    if (!gradeNum || !subject || flow.status !== 'done') return;
    const cleanTopic = topic.trim();
    db.saveGeneratedNote(gradeNum, subject.id, cleanTopic, flow.title, flow.body);
    db.saveGeneratedCards(gradeNum, subject.id, cleanTopic, flow.cards);
    refresh();
    setFlow({ status: 'saved' });
  }

  async function handlePickPhoto(source: 'camera' | 'library') {
    // The whole flow is wrapped in one try/catch — permission requests and
    // the native picker can both throw (denied-forever on Android, no
    // camera on an emulator, user backgrounding mid-pick, etc.), and an
    // uncaught rejection here left `photo` stuck on 'idle' with zero visible
    // feedback, which read as "nothing happens when I upload a photo."
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhoto({
          status: 'error',
          message:
            source === 'camera'
              ? 'Kua needs camera access to take a photo. Check your phone\'s Settings and try again.'
              : 'Kua needs photo access to pick a photo. Check your phone\'s Settings and try again.',
        });
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
      if (result.canceled || !result.assets[0]) return;

      const picked = result.assets[0];
      setPhoto({ status: 'extracting', uri: picked.uri });

      // Downscale + compress before upload — a fresh phone photo is easily
      // 8-12MB, far more resolution than the model needs to read handwriting
      // or print, and slow to send on mobile data.
      const resized = await ImageManipulator.manipulateAsync(
        picked.uri,
        [{ resize: { width: MAX_PHOTO_DIMENSION } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!resized.base64) throw new TutorError("Couldn't process that photo. Please try again.");

      const { text } = await extractTextFromImage(resized.base64);
      if (!text) {
        setPhoto({
          status: 'error',
          message: "Couldn't find any readable text in that photo — try a clearer, well-lit shot.",
        });
        return;
      }
      setMaterial((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
      setPhoto({ status: 'done', uri: picked.uri });
    } catch (err) {
      setPhoto({
        status: 'error',
        message: err instanceof TutorError ? err.message : 'Something went wrong reading that photo. Please try again.',
      });
    }
  }

  function handleGoToTopic() {
    if (!subject) return;
    setSubjectId(null);
    setTopic('');
    setMaterial('');
    setFlow({ status: 'idle' });
    setPhoto({ status: 'idle' });
    router.push(`/topics?subject=${subject.id}`);
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[styles.eyebrow, { color: colors.textFaint }]}>Add material</Text>
          <Text style={[styles.title, { color: colors.text }]}>Turn your own notes into practice</Text>
          <Text style={[styles.subtitle, { color: colors.textSoft }]}>
            Name a topic your teacher covered — paste in your own notes if you have them, or leave that part blank
            and Kua will explain it generally.
          </Text>

          {flow.status === 'saved' ? (
            <View style={[styles.savedCard, { backgroundColor: colors.tintSoft }]}>
              <Text style={[styles.savedTitle, { color: colors.text }]}>✅ Saved to {subject?.name}</Text>
              <Text style={[styles.savedHint, { color: colors.textSoft }]}>
                "{topic.trim()}" now has a note and practice questions, right alongside your other topics.
              </Text>
              <Pressable onPress={handleGoToTopic} style={[styles.button, { backgroundColor: colors.tint }]}>
                <Text style={[styles.buttonLabel, { color: colors.surface }]}>Go study it →</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.textFaint }]}>Subject</Text>
              <View style={styles.subjectGrid}>
                {SUBJECTS.map((s) => {
                  const selected = s.id === subjectId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSubjectId(s.id)}
                      style={[
                        styles.subjectChip,
                        {
                          borderColor: selected ? colors.tint : colors.line,
                          backgroundColor: selected ? colors.tintSoft : colors.surface,
                        },
                      ]}>
                      <Text style={styles.subjectEmoji}>{s.emoji}</Text>
                      <Text style={[styles.subjectLabel, { color: selected ? colors.tint : colors.textSoft }]} numberOfLines={1}>
                        {s.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: colors.textFaint }]}>Topic</Text>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="e.g. The Water Cycle"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, { borderColor: colors.line, color: colors.text, backgroundColor: colors.surface }]}
              />

              <Text style={[styles.label, { color: colors.textFaint }]}>Your notes (optional)</Text>
              <TextInput
                value={material}
                onChangeText={setMaterial}
                placeholder="Paste or type what your teacher taught, or what's in your textbook…"
                placeholderTextColor={colors.textFaint}
                multiline
                numberOfLines={6}
                style={[
                  styles.input,
                  styles.textarea,
                  { borderColor: colors.line, color: colors.text, backgroundColor: colors.surface },
                ]}
              />

              {flow.status === 'idle' && (
                <Pressable
                  disabled={!canGenerate}
                  onPress={handleGenerate}
                  style={[styles.button, { backgroundColor: canGenerate ? colors.tint : colors.line }]}>
                  <Text style={[styles.buttonLabel, { color: canGenerate ? colors.surface : colors.textFaint }]}>
                    ✨ Generate note & questions
                  </Text>
                </Pressable>
              )}

              {flow.status === 'loading' && (
                <View style={[styles.aiCard, { backgroundColor: colors.tintSoft }]}>
                  <ActivityIndicator color={colors.tint} />
                  <Text style={[styles.aiHint, { color: colors.tint }]}>Thinking…</Text>
                </View>
              )}

              {flow.status === 'error' && (
                <View style={[styles.aiCard, { backgroundColor: colors.goldSoft }]}>
                  <Text style={[styles.aiHint, { color: colors.gold }]}>{flow.message}</Text>
                  <Pressable onPress={handleGenerate} style={[styles.ghostButton, { borderColor: colors.tint }]}>
                    <Text style={[styles.ghostButtonLabel, { color: colors.tint }]}>Try again</Text>
                  </Pressable>
                </View>
              )}

              {flow.status === 'done' && (
                <View style={[styles.aiCard, { backgroundColor: colors.tintSoft }]}>
                  <Text style={[styles.aiEyebrow, { color: colors.tint }]}>✨ {flow.title}</Text>
                  {flow.body.split('\n\n').map((paragraph, i) => (
                    <Text key={i} style={[styles.paragraph, { color: colors.text }]}>
                      {paragraph}
                    </Text>
                  ))}
                  <Text style={[styles.aiHint, { color: colors.tint }]}>
                    {flow.cards.length} practice question{flow.cards.length === 1 ? '' : 's'} ready.
                  </Text>
                  <Text style={[styles.aiDisclaimer, { color: colors.textFaint }]}>
                    ⚠️ AI-generated — unlike the rest of Kua, this wasn't checked by a person. Double-check anything
                    important with your teacher or textbook.
                  </Text>
                  <Pressable onPress={handleSave} style={[styles.button, { backgroundColor: colors.tint }]}>
                    <Text style={[styles.buttonLabel, { color: colors.surface }]}>Save to my topics</Text>
                  </Pressable>
                </View>
              )}

              <View style={[styles.option, { borderColor: colors.line }]}>
                <Text style={styles.optionEmoji}>📷</Text>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Photo of notes</Text>
                <Text style={[styles.optionBody, { color: colors.textSoft }]}>
                  Snap a page from your book — Kua will read the text into your notes above.
                </Text>

                {photo.status === 'extracting' && (
                  <View style={styles.photoRow}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                    <View style={styles.photoStatusRow}>
                      <ActivityIndicator color={colors.tint} />
                      <Text style={[styles.aiHint, { color: colors.tint }]}>Reading your photo…</Text>
                    </View>
                  </View>
                )}

                {photo.status === 'done' && (
                  <View style={styles.photoRow}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                    <View style={styles.photoStatusRow}>
                      <Text style={[styles.aiHint, { color: colors.tint }]}>✅ Added to your notes above</Text>
                    </View>
                  </View>
                )}

                {photo.status === 'error' && (
                  <Text style={[styles.aiHint, { color: colors.gold, marginTop: 4 }]}>{photo.message}</Text>
                )}

                {(photo.status === 'idle' || photo.status === 'error' || photo.status === 'done') && (
                  <View style={styles.photoButtonRow}>
                    <Pressable
                      onPress={() => handlePickPhoto('camera')}
                      style={[styles.ghostButton, { borderColor: colors.tint, flex: 1 }]}>
                      <Text style={[styles.ghostButtonLabel, { color: colors.tint }]}>
                        {photo.status === 'done' ? '📸 Retake' : '📸 Take photo'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handlePickPhoto('library')}
                      style={[styles.ghostButton, { borderColor: colors.tint, flex: 1 }]}>
                      <Text style={[styles.ghostButtonLabel, { color: colors.tint }]}>🖼️ Choose photo</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 20, gap: 12, paddingBottom: 60 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 6 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  subjectEmoji: { fontSize: 16 },
  subjectLabel: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 15 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  button: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  ghostButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    marginTop: 4,
  },
  ghostButtonLabel: { fontSize: 14, fontWeight: '700' },
  aiCard: { borderRadius: 14, padding: 16, gap: 8, marginTop: 4 },
  aiEyebrow: { fontSize: 14, fontWeight: '800' },
  aiHint: { fontSize: 14, fontWeight: '600' },
  aiDisclaimer: { fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
  paragraph: { fontSize: 15, lineHeight: 22 },
  savedCard: { borderRadius: 14, padding: 16, gap: 8, marginTop: 4 },
  savedTitle: { fontSize: 16, fontWeight: '800' },
  savedHint: { fontSize: 13, lineHeight: 19 },
  option: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    gap: 4,
    marginTop: 8,
  },
  optionEmoji: { fontSize: 22 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionBody: { fontSize: 13 },
  photoButtonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  photoThumb: { width: 48, height: 48, borderRadius: 8 },
  photoStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
});
