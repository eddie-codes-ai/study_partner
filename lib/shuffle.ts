// Fisher-Yates shuffle. Used at session time (not persisted) so replaying a
// topic doesn't show the same question order, and so answer options aren't
// always in their authored order — every card in lib/seed.ts happens to
// have the correct answer written as options[0] for authoring convenience,
// so without this, "always pick the first option" would score 100%.
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
