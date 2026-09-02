# Curriculum grounding tool

Kua's seeded notes/questions (`lib/seed.ts`) were originally written without
grounding in the real KICD curriculum design — see the Grade 5 Science
"Force & Energy" example below. This tool regenerates a topic's note +
questions grounded in the actual curriculum design text, so the output can
be checked against KICD's real scope before it ships, instead of trusting
an AI's general knowledge of "what a Grade 5 Force & Energy lesson probably
covers."

It mirrors how Eneza Education / M-Shule build content: a human gets the
official curriculum, breaks it into a structured source, and *then* content
gets written against that source — the only difference here is an AI writes
the first draft instead of a paid teacher, and a human still reviews before
anything is merged. **This tool never touches `lib/seed.ts` directly.**

## Workflow

### 1. Get the curriculum design PDF for that subject/grade

Official source: <https://kicd.ac.ke/cbc-materials/curriculum-designs/> (the
site is JS-heavy and the direct PDF links change — search
`site:kicd.ac.ke "GRADE-N" <subject> curriculum design pdf` if the listing
page doesn't turn up a real file).

### 2. Extract the text

```
pdftotext -layout downloaded.pdf out.txt
```

(`pdftotext` ships with poppler-utils — already available in this
environment. `brew install poppler` / `apt-get install poppler-utils`
elsewhere.)

### 3. Pull out the relevant sub-strand and save it as a material file

Curriculum design PDFs are laid out as tables (strand → sub-strand →
specific learning outcomes → suggested learning experiences → key inquiry
questions) that `pdftotext` mangles into broken lines. Don't feed the raw
mess in — copy out just the sub-strand's outcomes/content/inquiry questions
as clean prose or a short structured note. See
`materials/g5-science-sound-energy.txt` for the shape to aim for. This step
is manual on purpose: it's the one place a human actually reads the source
before anything downstream trusts it.

**Match KICD's sub-strand granularity, not Kua's existing topic names.**
KICD's Grade 5 "Force and Energy" strand is three sub-strands (Floating &
Sinking, Sound Energy, Heat Transfer); Kua currently has one "Force &
Energy" topic that doesn't actually match any of them (see below). Whether
to split Kua's topics to match is a product call, not something this tool
decides — it'll just tell you what's actually in the curriculum.

### 4. Generate

```
node scripts/curriculum/generate.mjs \
  --grade 5 --subject-id science --subject-name "Integrated Science" \
  --topic "Sound Energy" \
  --material scripts/curriculum/materials/g5-science-sound-energy.txt \
  --count 6
```

This calls the same `/generate-note` and `/generate-questions` endpoints
the app itself uses (deployed backend, real Workers AI — this costs neurons
same as a student using Add Material), grounded in the material file
instead of a bare topic name. It writes a review file to
`scripts/curriculum/output/<subject-id>-g<grade>-<topic-slug>.json`
containing both the proposed content **and** whatever's currently seeded
for that exact (subjectId, grade, topic) triple, if anything, and prints a
side-by-side summary to the terminal.

### 5. Review, then hand-merge

`scripts/curriculum/output/` is gitignored — it's scratch material for you
to read, not something that ships. If the proposed note/cards look right,
copy them into `lib/seed.ts` yourself (and bump `SEED_VERSION` so existing
devices pick up the change — see the comment at the top of that file).
Nothing here writes to `lib/seed.ts` automatically.

## Known finding: Grade 5 Science "Force & Energy" is off-curriculum

Kua's current seeded note for this topic covers simple machines (levers,
inclined planes), gravity, friction, and magnetism. The real KICD Grade 5
strand 3.0 "Force and Energy" doesn't mention any of those — it's Floating
& Sinking, Sound Energy, and Heat Transfer. Three material files for those
real sub-strands are already in `materials/` as working examples to run
through this tool.
