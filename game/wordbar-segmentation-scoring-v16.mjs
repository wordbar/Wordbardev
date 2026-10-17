/* Complete-segmentation scorer for Batch S3.
 *
 * Lower scores are better. Every inter-nucleus boundary is selected as part
 * of one complete path; the best distinct path and runner-up are retained.
 * Both the left coda and right onset are compared with the pronunciation.
 */

const VOWELS = "aeiouy";
const SOUND_VOWELS = [
  "yoo", "air", "ear", "uh", "oh", "ah", "ee", "oo", "ay", "ey",
  "ow", "oy", "aw", "uu", "aa", "ii", "a", "e", "i", "o", "u", "y"
];
const SOUND_UNITS = ["tch", "dge", "sh", "ch", "th", "ng", "zh", "wh", "ph"];
const SPELLING_UNITS = [
  "tch", "dge", "sch", "shr", "thr", "chr", "phr", "ph", "gh", "ck",
  "ch", "sh", "th", "wh", "qu"
];
const LEGAL_ONSETS = new Set([
  "", "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q",
  "r", "s", "t", "v", "w", "x", "y", "z", "bl", "br", "cl", "cr", "dr",
  "dw", "fl", "fr", "gl", "gr", "kn", "pl", "pr", "sc", "sk", "sl", "sm",
  "sn", "sp", "st", "sw", "tr", "tw", "th", "sh", "ch", "wh", "ph", "gh",
  "qu", "wr", "gn", "rh", "ps", "scr", "spl", "spr", "str", "shr", "thr",
  "chr", "phr", "sch", "squ"
]);

export const SEGMENTATION_SCORE_WEIGHTS = Object.freeze({
  codaMismatch: 5,
  onsetMismatch: 5,
  illegalOnset: 12,
  protectedCut: Number.POSITIVE_INFINITY,
  doubledConsonantMatch: -4,
  doubledConsonantMiss: 5,
  strongMorphology: -14,
  oneLetterAnalysisChunk: 3,
  excessChunk: 1
});

function soundUnits(value) {
  const text = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  const units = [];
  for (let index = 0; index < text.length;) {
    const vowel = SOUND_VOWELS.find(item => text.startsWith(item, index));
    if (vowel) {
      units.push({ type: "vowel", text: vowel });
      index += vowel.length;
      continue;
    }
    const consonant = SOUND_UNITS.find(item => text.startsWith(item, index));
    if (consonant) {
      units.push({ type: "consonant", text: consonant });
      index += consonant.length;
    } else {
      units.push({ type: "consonant", text: text[index] });
      index += 1;
    }
  }
  return units;
}

function soundCodaCount(syllable) {
  const units = soundUnits(syllable);
  let lastVowel = -1;
  units.forEach((unit, index) => { if (unit.type === "vowel") lastVowel = index; });
  return lastVowel < 0 ? 0 : units.slice(lastVowel + 1).filter(unit => unit.type === "consonant").length;
}

function soundOnsetCount(syllable) {
  const units = soundUnits(syllable);
  const firstVowel = units.findIndex(unit => unit.type === "vowel");
  return (firstVowel < 0 ? units : units.slice(0, firstVowel))
    .filter(unit => unit.type === "consonant").length;
}

function spellingConsonantUnits(word, start, end) {
  const units = [];
  for (let index = start; index < end;) {
    const unit = SPELLING_UNITS.find(item => word.startsWith(item, index) && index + item.length <= end) || word[index];
    units.push({ start: index, end: index + unit.length, text: unit });
    index += unit.length;
  }
  return units;
}

function chunkOnset(chunk) {
  let index = 0;
  while (index < chunk.length && !VOWELS.includes(chunk[index])) index += 1;
  return chunk.slice(0, index);
}

function chunksFromCuts(word, cuts) {
  const sorted = [...new Set(cuts)].filter(cut => cut > 0 && cut < word.length).sort((a, b) => a - b);
  const chunks = [];
  let start = 0;
  for (const cut of sorted) {
    chunks.push(word.slice(start, cut));
    start = cut;
  }
  chunks.push(word.slice(start));
  return chunks;
}

function globalCost(chunks) {
  let cost = Math.max(0, chunks.length - 4) * SEGMENTATION_SCORE_WEIGHTS.excessChunk;
  for (const chunk of chunks) if (chunk.length === 1) cost += SEGMENTATION_SCORE_WEIGHTS.oneLetterAnalysisChunk;
  return cost;
}

function signature(cuts) {
  return [...new Set(cuts)].sort((a, b) => a - b).join(",");
}

export function scoreCompleteSegmentations({
  word,
  alignment,
  syllables,
  morphology = [],
  forbidden = new Set()
}) {
  const active = alignment.assignments
    .map((assignment, groupIndex) => ({ assignment, groupIndex }))
    .filter(item => item.assignment.count > 0);
  const requiredMorphology = morphology.filter(item => item.confidence === "high");
  const fixedCuts = alignment.internalCuts.slice();
  const contexts = [];
  let syllablesUsed = 0;

  for (let index = 0; index < active.length - 1; index += 1) {
    const current = active[index];
    const following = active[index + 1];
    syllablesUsed += current.assignment.count;
    const leftGroup = alignment.groups[current.groupIndex];
    const rightGroup = alignment.groups[following.groupIndex];
    const units = spellingConsonantUnits(word, leftGroup.end, rightGroup.start);
    const positions = [leftGroup.end, ...units.map(unit => unit.end)];
    const candidates = [];
    for (const cut of [...new Set(positions)]) {
      if (!(cut > 0 && cut < word.length) || forbidden.has(cut)) continue;
      const leftUnits = units.filter(unit => unit.end <= cut).length;
      const rightUnits = units.length - leftUnits;
      const codaTarget = soundCodaCount(syllables[Math.max(0, syllablesUsed - 1)]?.text);
      const onsetTarget = soundOnsetCount(syllables[syllablesUsed]?.text);
      const nextChunk = word.slice(cut, rightGroup.end);
      const writtenOnset = chunkOnset(nextChunk);
      const morphologyItem = requiredMorphology.find(item => item.cut === cut);
      let cost = Math.abs(leftUnits - codaTarget) * SEGMENTATION_SCORE_WEIGHTS.codaMismatch;
      cost += Math.abs(rightUnits - onsetTarget) * SEGMENTATION_SCORE_WEIGHTS.onsetMismatch;
      if (!LEGAL_ONSETS.has(writtenOnset)) cost += SEGMENTATION_SCORE_WEIGHTS.illegalOnset;
      const doubled = units.length >= 2 && units[0].text === units[1].text && units[0].text.length === 1;
      if (doubled) cost += cut === units[0].end
        ? SEGMENTATION_SCORE_WEIGHTS.doubledConsonantMatch
        : SEGMENTATION_SCORE_WEIGHTS.doubledConsonantMiss;
      if (morphologyItem) cost += morphologyItem.score ?? SEGMENTATION_SCORE_WEIGHTS.strongMorphology;
      candidates.push({
        cut,
        cost,
        provenance: morphologyItem ? ["sound", morphologyItem.provenance || "morphology"] : ["sound"],
        codaTarget,
        onsetTarget,
        writtenCodaUnits: leftUnits,
        writtenOnsetUnits: rightUnits,
        legalOnset: LEGAL_ONSETS.has(writtenOnset)
      });
    }
    if (!candidates.length) return null;
    contexts.push(candidates.sort((a, b) => a.cost - b.cost || a.cut - b.cut));
  }

  let paths = [{ cuts: fixedCuts.slice(), boundaries: [], cost: alignment.bestCost * 10 }];
  for (const candidates of contexts) {
    const next = [];
    for (const path of paths) {
      for (const candidate of candidates) {
        next.push({
          cuts: [...path.cuts, candidate.cut],
          boundaries: [...path.boundaries, candidate],
          cost: path.cost + candidate.cost
        });
      }
    }
    next.sort((a, b) => a.cost - b.cost || signature(a.cuts).localeCompare(signature(b.cuts)));
    paths = next.slice(0, 128);
  }

  const unique = new Map();
  for (const path of paths) {
    const cuts = [...new Set([...path.cuts, ...requiredMorphology.map(item => item.cut)])]
      .filter(cut => cut > 0 && cut < word.length && !forbidden.has(cut))
      .sort((a, b) => a - b);
    const key = signature(cuts);
    const morphologyCost = requiredMorphology
      .filter(item => !path.boundaries.some(boundary => boundary.cut === item.cut))
      .reduce((sum, item) => sum + (item.score ?? SEGMENTATION_SCORE_WEIGHTS.strongMorphology), 0);
    const chunks = chunksFromCuts(word, cuts);
    const scored = { ...path, cuts, chunks, score: path.cost + morphologyCost + globalCost(chunks) };
    const previous = unique.get(key);
    if (!previous || scored.score < previous.score) unique.set(key, scored);
  }
  const ranked = [...unique.values()].sort((a, b) => a.score - b.score || signature(a.cuts).localeCompare(signature(b.cuts)));
  if (!ranked.length) return null;
  const best = ranked[0];
  const runnerUp = ranked[1] || null;
  const margin = runnerUp ? runnerUp.score - best.score : Number.POSITIVE_INFINITY;
  return Object.freeze({
    best: Object.freeze(best),
    runnerUp: runnerUp ? Object.freeze(runnerUp) : null,
    margin,
    confidence: margin >= 4 ? "high" : margin >= 2 ? "medium" : "low",
    candidateCount: ranked.length
  });
}
