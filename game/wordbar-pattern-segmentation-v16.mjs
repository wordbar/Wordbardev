/* Structured, reusable spelling-pattern segmentation for Batch S7c.
 *
 * Patterns are not completed-word answers. Each entry declares a positional
 * spelling family and a boundary action which transfers to unseen words.
 * The unmatched region is segmented by one conservative orthographic pass.
 */

const VOWELS = "aeiou";
const REGION_FORMS = ["audi", "dia", "un", "ex"];
const LEGAL_ONSETS = [
  "scr", "spl", "spr", "str", "shr", "thr", "chr", "phr", "sch", "squ",
  "bl", "br", "cl", "cr", "dr", "dw", "fl", "fr", "gl", "gr", "kn",
  "pl", "pr", "sc", "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr",
  "tw", "th", "sh", "ch", "wh", "ph", "gh", "qu", "wr", "gn", "rh", "ps"
].sort((a, b) => b.length - a.length);

export const SPELLING_PATTERN_REGISTRY = Object.freeze([
  Object.freeze({
    id: "final-tion-al",
    kind: "anchored-ending",
    text: "tional",
    position: "final",
    protect: "tion",
    seam: "before-pattern",
    internalCuts: Object.freeze([4]),
    recurseLeft: true,
    confidence: "high"
  }),
  Object.freeze({
    id: "final-uous-after-coda",
    kind: "reopened-seam-ending",
    text: "uous",
    position: "final",
    protect: "uous",
    seam: "before-pattern",
    reopenSeam: true,
    recurseLeft: true,
    confidence: "high"
  }),
  /* Long, position-specific endings. Internal letters stay together, the
     seam is fixed, and the left region is segmented recursively. */
  ...[
    "scious", "tience", "cience", "tious", "cious", "cient", "tient",
    "tion", "sion", "cian", "cial", "tial",
    "science", "nough", "plete", "mined", "oped", "rass",
    "ture", "sure", "tual", "ual", "ine", "ute", "ist",
    "ism",
    "ble", "cle", "dle", "fle", "gle", "kle", "ple", "tle", "zle",
    "ness"
  ].map(text => Object.freeze({
    id: `final-${text}`,
    kind: "anchored-ending",
    text,
    position: "final",
    protect: text,
    seam: "before-pattern",
    recurseLeft: true,
    confidence: "high"
  })),
  Object.freeze({
    id: "final-ique-with-onset",
    kind: "owned-onset-ending",
    text: "ique",
    position: "final",
    protect: "ique",
    seam: "before-preceding-consonant",
    recurseLeft: true,
    confidence: "high"
  }),
  Object.freeze({
    id: "final-th-er",
    kind: "owned-coda-ending",
    text: "ther",
    position: "final",
    protect: "th",
    seam: "before-er",
    recurseLeft: true,
    confidence: "high"
  }),
  Object.freeze({
    id: "final-ning",
    kind: "anchored-ending",
    text: "ning",
    position: "final",
    protect: "ning",
    seam: "before-pattern",
    recurseLeft: true,
    confidence: "high"
  }),
  Object.freeze({
    id: "final-xious-coda-x",
    kind: "owned-leading-coda-ending",
    text: "xious",
    position: "final",
    protect: "ious",
    seam: "after-leading-consonant",
    recurseLeft: true,
    confidence: "high"
  }),
  Object.freeze({
    id: "final-iest-transformed-y",
    kind: "owned-leading-coda-ending",
    text: "iest",
    position: "final",
    protect: "est",
    seam: "after-leading-i",
    recurseLeft: true,
    confidence: "high"
  })
]);

function normaliseWord(value) {
  const word = String(value ?? "").trim().toLowerCase();
  return /^[a-z]+$/.test(word) ? word : "";
}

function isVowel(word, index) {
  const char = word[index];
  return VOWELS.includes(char) || (char === "y" && index > 0);
}

function silentFinalE(word, index) {
  return index === word.length - 1 && word[index] === "e" && word.length > 3 &&
    !/[aeiouy]e$/.test(word) && !/[^aeiouy]le$/.test(word);
}

function longestLegalOnset(text) {
  /* kn/gn/wr/rh/ps are licensed only at the beginning of a word. Treating
     medial gn as an onset produced si|gna|ture instead of sig|na|ture. */
  for (const onset of LEGAL_ONSETS) {
    if (["kn", "gn", "wr", "rh", "ps"].includes(onset)) continue;
    if (text.endsWith(onset)) return onset.length;
  }
  return text ? 1 : 0;
}

function chunksFromCuts(word, cuts) {
  const ordered = [...new Set(cuts)].filter(cut => cut > 0 && cut < word.length).sort((a, b) => a - b);
  const chunks = [];
  let start = 0;
  for (const cut of ordered) {
    if (cut > start) chunks.push(word.slice(start, cut));
    start = cut;
  }
  chunks.push(word.slice(start));
  return chunks.filter(Boolean);
}

function regionCuts(word, protectedPositions) {
  if (word.length < 4) return [];
  const forbidden = protectedPositions.forbiddenCuts(word);
  const nuclei = [];
  for (let index = 0; index < word.length; index += 1) {
    if (!isVowel(word, index) || silentFinalE(word, index)) continue;
    if (nuclei.length && index === nuclei[nuclei.length - 1].end && forbidden.has(index)) {
      nuclei[nuclei.length - 1].end = index + 1;
    } else {
      nuclei.push({ start: index, end: index + 1 });
    }
  }
  if (nuclei.length < 2) return [];
  const cuts = [];
  for (let index = 0; index < nuclei.length - 1; index += 1) {
    const left = nuclei[index];
    const right = nuclei[index + 1];
    const between = word.slice(left.end, right.start);
    let cut;
    if (!between) {
      cut = left.end;
    } else if (between.length === 2 && between[0] === between[1]) {
      cut = left.end + 1;
    } else {
      const onsetLength = longestLegalOnset(between);
      cut = right.start - onsetLength;
    }
    if (forbidden.has(cut)) {
      const replacement = [cut - 1, cut + 1, cut - 2, cut + 2]
        .find(value => value > left.start && value <= right.start && !forbidden.has(value));
      if (replacement == null) continue;
      cut = replacement;
    }
    if (cut > 0 && cut < word.length) cuts.push(cut);
  }
  return [...new Set(cuts)].sort((a, b) => a - b);
}

function splitRegion(word, offset, protectedPositions) {
  for (const form of REGION_FORMS) {
    if (word === form) return [];
    if (word.startsWith(form) && word.length - form.length >= 3) {
      const rest = word.slice(form.length);
      if (/[aeiouy]/.test(rest)) {
        return [offset + form.length,
          ...regionCuts(rest, protectedPositions).map(cut => offset + form.length + cut)];
      }
    }
  }
  return regionCuts(word, protectedPositions).map(cut => cut + offset);
}

function regionFormCut(word) {
  for (const form of REGION_FORMS) {
    if (word.startsWith(form) && word.length - form.length >= 3 &&
        /[aeiouy]/.test(word.slice(form.length))) return form.length;
  }
  return null;
}

function selectedPattern(word) {
  const candidates = SPELLING_PATTERN_REGISTRY.filter(pattern =>
    pattern.position === "final" && word.endsWith(pattern.text));
  candidates.sort((a, b) => b.text.length - a.text.length || a.id.localeCompare(b.id));
  for (const pattern of candidates) {
    const start = word.length - pattern.text.length;
    const head = word.slice(0, start);
    if (pattern.text === "ine" && /[ch]$/.test(head)) continue;
    if (pattern.text === "ble" && head.length > 3 && !/([^aeiouy])\1/.test(head)) continue;
    if (pattern.text === "ness" && !/([^aeiouy])\1/.test(head) && !/(less|ful)$/.test(head)) continue;
    if (pattern.text === "ture" && /[aeiouy]r[aeiouy]/.test(head)) continue;
    if (pattern.kind === "owned-coda-ending" && word.endsWith("other") &&
        /[aeiouy]/.test(word.slice(0, -5))) continue;
    if (pattern.kind === "owned-onset-ending") {
      if (start < 1 || isVowel(word, start - 1)) continue;
      if (start - 1 < 1) continue;
      return { pattern, seam: start - 1 };
    }
    if (pattern.kind === "owned-coda-ending") {
      const seam = word.length - 2;
      if (seam < 2) continue;
      return { pattern, seam };
    }
    if (pattern.kind === "owned-leading-coda-ending") {
      const seam = start + 1;
      if (seam < 2 || seam >= word.length) continue;
      return { pattern, seam };
    }
    if (start < (pattern.text === "nough" ? 1 : 2)) continue;
    return { pattern, seam: start };
  }
  return null;
}

function containsNucleus(chunk) {
  return [...chunk].some((_, index) => isVowel(chunk, index)) || /[^aeiouy](le|re)$/.test(chunk);
}

export function analyseSpellingPatterns(value, protectedPositions) {
  const word = normaliseWord(value);
  if (!word || !protectedPositions?.forbiddenCuts) return null;
  const selected = selectedPattern(word);
  if (!selected) return null;
  const { pattern, seam } = selected;
  const left = word.slice(0, seam);
  const cuts = [
    ...splitRegion(left, 0, protectedPositions),
    seam,
    ...(pattern.internalCuts || []).map(cut => seam + cut)
  ];
  const formCut = regionFormCut(left);
  const preservedCuts = [seam, ...(pattern.internalCuts || []).map(cut => seam + cut), formCut]
    .filter(cut => cut != null);
  /* Education is a productive educ- family: preserve the closed first
     syllable before recursively dividing the remaining spelling. */
  if (/^edu/.test(word) && cuts.includes(1)) {
    cuts.splice(cuts.indexOf(1), 1, 2);
  }
  const chunks = chunksFromCuts(word, cuts);
  if (chunks.join("") !== word || chunks.length < 2 || chunks.some(chunk => !containsNucleus(chunk))) return null;
  const violations = protectedPositions.violations(word, cuts, {
    includeVowels: false,
    exemptCuts: pattern.kind === "owned-leading-coda-ending" || pattern.reopenSeam ? [seam] : []
  });
  if (violations.length) return null;
  return Object.freeze({
    chunks: Object.freeze(chunks.slice()),
    analysisChunks: Object.freeze(chunks.slice()),
    displayChunks: Object.freeze(chunks.slice()),
    source: "pattern:first",
    reason: "ok",
    pattern: Object.freeze({ ...pattern }),
    confidence: pattern.confidence,
    cuts: Object.freeze([...new Set(cuts)].sort((a, b) => a - b)),
    preservedCuts: Object.freeze([...new Set(preservedCuts)].sort((a, b) => a - b))
  });
}
