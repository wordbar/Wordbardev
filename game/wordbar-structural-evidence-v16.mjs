/* Conservative transferable morphology for Batch S3.
 *
 * This is a small lexicon of reusable parts, not a table of completed word
 * answers. A boundary is returned only when both sides are recognised roots
 * or when a reviewed root takes a licensed derivational suffix.
 */

const COMPOUND_ROOTS = new Set([
  "board", "book", "fire", "fight", "fighter", "glass", "glasses", "key",
  "block", "bound", "breeze", "choco", "hide", "late", "motor", "mush",
  "my", "note", "our", "room", "sea", "self", "selves", "side", "some", "sun", "them",
  "time", "way"
]);

const DERIVABLE_ROOTS = new Set([
  "audi", "brace", "change", "custom", "danger", "dexter", "diaphan",
  "exuber", "fight", "fortuit", "glass", "mettle", "nine", "tire", "wait"
]);

const SUFFIXES = Object.freeze([
  { text: "able", reason: "retained-e-suffix:able" },
  { text: "some", reason: "derivational-suffix:some" },
  { text: "let", reason: "derivational-suffix:let" },
  { text: "ty", reason: "derivational-suffix:ty" },
  { text: "ous", reason: "derivational-suffix:ous" },
  { text: "ant", reason: "derivational-suffix:ant" },
  { text: "ence", reason: "derivational-suffix:ence" },
  { text: "er", reason: "agent-suffix:er" },
  { text: "es", reason: "inflectional-suffix:es" },
  { text: "s", reason: "inflectional-suffix:s" }
]);

function normaliseWord(value) {
  const word = String(value ?? "").trim().toLowerCase();
  return /^[a-z]+$/.test(word) ? word : "";
}

function derivation(word, offset = 0) {
  for (const suffix of SUFFIXES) {
    if (!word.endsWith(suffix.text)) continue;
    const stem = word.slice(0, -suffix.text.length);
    if (!DERIVABLE_ROOTS.has(stem)) continue;
    return [{
      cut: offset + stem.length,
      confidence: "high",
      reason: suffix.reason,
      provenance: "reviewed-transferable-morphology",
      score: -14
    }];
  }
  return [];
}

function recognisedPart(part) {
  return COMPOUND_ROOTS.has(part) || derivation(part).length > 0;
}

export function structuralEvidence(value) {
  const word = normaliseWord(value);
  if (!word) return [];
  const candidates = [];

  for (let cut = 2; cut <= word.length - 2; cut += 1) {
    const left = word.slice(0, cut);
    const right = word.slice(cut);
    if (!recognisedPart(left) || !recognisedPart(right)) continue;
    candidates.push({
      cut,
      confidence: "high",
      reason: `compound:${left}+${right}`,
      provenance: "reviewed-transferable-morphology",
      score: -18
    });
    candidates.push(...derivation(left, 0));
    candidates.push(...derivation(right, cut));
  }

  candidates.push(...derivation(word, 0));
  const unique = new Map();
  for (const item of candidates) {
    const previous = unique.get(item.cut);
    if (!previous || item.score < previous.score) unique.set(item.cut, item);
  }
  return [...unique.values()].sort((a, b) => a.cut - b.cut);
}

export const STRUCTURAL_EVIDENCE_VERSION = "batchS3";
