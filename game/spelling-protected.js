/* WordBar protected spelling positions v16 — Batch S7c shared model.
 *
 * A cut is a position between letters: cut 1 in "knee" sits inside initial
 * "kn" and is protected.  Positional units matter: silent kn-/gn- are
 * initial patterns, not universal digraphs.  Treating medial "kn" as one
 * unit blocked frank|ness and allowed the fallback fran|kness.
 */
(function installWordBarProtectedPositions(global){
"use strict";

const GLOBAL_CONSONANT_UNITS = [
  "tch", "dge", "sch", "shr", "thr", "chr", "phr",
  "ph", "gh", "ck", "ch", "sh", "th", "wh", "qu"
];
const GLOBAL_VOWEL_UNITS = [
  "eigh", "ough", "augh", "aigh", "igh", "eau", "oul",
  "ai", "ay", "ea", "ee", "ei", "ey", "ie", "oa", "oe", "oi", "oo",
  "ou", "ow", "oy", "ue", "ui", "aw", "au", "ew"
];
/* High-value English spelling families. These are reusable grapheme/morpheme
   patterns, not completed-word answers. Keeping the internal letters together
   prevents outputs such as tio|nal while still allowing a validated morpheme
   seam to reopen an exact cut through the options passed to forbiddenCuts(). */
const GLOBAL_SPELLING_FAMILIES = [
  "scious", "tience", "cience", "tious", "cious",
  "tion", "sion", "cian", "cial", "tial", "xious", "cient", "tient"
];
const POSITIONAL_UNITS = [
  { unit: "kn", position: "initial", category: "consonant" },
  { unit: "gn", position: "initial", category: "consonant" },
  { unit: "wr", position: "initial", category: "consonant" },
  { unit: "rh", position: "initial", category: "consonant" },
  { unit: "ps", position: "initial", category: "consonant" },
  { unit: "mb", position: "final", category: "consonant" },
  { unit: "ng", position: "final", category: "consonant" },
  { unit: "nk", position: "final", category: "consonant" },
  { unit: "mn", position: "final", category: "consonant" }
];

function normaliseWord(value) {
  const word = String(value ?? "").trim().toLowerCase();
  return /^[a-z]+$/.test(word) ? word : "";
}

function matchesPosition(word, at, unit, position) {
  if (position === "initial") return at === 0;
  if (position === "final") return at + unit.length === word.length;
  return true;
}

function occurrences(value, options = {}) {
  const word = normaliseWord(value);
  if (!word) return [];
  const includeVowels = options.includeVowels !== false;
  const rules = [
    ...GLOBAL_CONSONANT_UNITS.map(unit => ({ unit, position: "any", category: "consonant" })),
    ...GLOBAL_SPELLING_FAMILIES.map(unit => ({ unit, position: "any", category: "spelling-family" })),
    ...(includeVowels
      ? GLOBAL_VOWEL_UNITS.map(unit => ({ unit, position: "any", category: "vowel" }))
      : []),
    ...POSITIONAL_UNITS
  ];
  const found = [];
  for (const rule of rules) {
    let from = 0;
    let at;
    while ((at = word.indexOf(rule.unit, from)) >= 0) {
      if (matchesPosition(word, at, rule.unit, rule.position)) {
        found.push(Object.freeze({
          unit: rule.unit,
          start: at,
          end: at + rule.unit.length,
          position: rule.position,
          category: rule.category
        }));
      }
      from = at + 1;
    }
  }
  /* Contextual consonantal u: guV/quV is one spelling/onset span for
     boundary safety. The live v15 segmenter already enforced this locally;
     Batch S3 makes the shared model authoritative for every candidate source. */
  for (const match of word.matchAll(/[gq]u[aeiouy]/g)) {
    found.push(Object.freeze({
      unit: match[0],
      start: match.index,
      end: match.index + match[0].length,
      position: "contextual",
      category: "consonant"
    }));
  }
  return found.sort((a, b) => a.start - b.start || b.unit.length - a.unit.length);
}

function forbiddenCuts(value, options = {}) {
  const cuts = new Set();
  for (const item of occurrences(value, options)) {
    for (let cut = item.start + 1; cut < item.end; cut += 1) cuts.add(cut);
  }
  for (const cut of options.reopenCuts || []) cuts.delete(cut);
  return cuts;
}

function violations(value, cuts, options = {}) {
  const exempt = new Set(options.exemptCuts || []);
  const result = [];
  for (const item of occurrences(value, options)) {
    for (const cut of cuts || []) {
      if (cut > item.start && cut < item.end && !exempt.has(cut)) {
        result.push(Object.freeze({ cut, unit: item.unit, category: item.category }));
      }
    }
  }
  return result;
}

global.WordBarProtectedPositions = Object.freeze({
  schemaVersion: 3,
  occurrences,
  forbiddenCuts,
  violations
});
})(window);
