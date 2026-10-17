/* Browser integration shell for WordBar v16 — Batch S8b offline Pet Pop.
 *
 * The candidate engine is loaded, initialised, cacheable offline and available
 * to Pet Pop. It preserves the reviewed S7c course behavior and resolves every
 * valid course word as either usefully segmented or intentionally whole.
 */

import { createV16Segmenter } from "./wordbar-segmenter-v16.mjs?v=batchS8b";
import { createPronunciationProvider } from "./wordbar-pronunciation-v16.mjs?v=batchS8b";

const global = globalThis;
const stable = global.WordBarSegments;
const protectedPositions = global.WordBarProtectedPositions;
const pronunciationProvider = createPronunciationProvider(global.WordBarPhonics || {});
const candidate = createV16Segmenter({ stable, segments: stable, pronunciationProvider, protectedPositions });

const CHILD_FACING_V16_ENABLED = true;
/* Retained for comparison links and backwards-compatible reviewer bookmarks. */
const QA_PREVIEW_V16_ENABLED = (() => {
  try {
    return new URLSearchParams(global.location?.search || "").get("segmenter") === "v16-preview";
  } catch (error) {
    return false;
  }
})();
const EFFECTIVE_V16_ENABLED = CHILD_FACING_V16_ENABLED || QA_PREVIEW_V16_ENABLED;
const cache = new Map();

function normaliseWord(value) {
  const word = String(value ?? "").trim().toLowerCase();
  return /^[a-z]+$/.test(word) ? word : "";
}

function doubleLetterRanges(word) {
  return typeof stable.doubleLetterRanges === "function" ? stable.doubleLetterRanges(word) : [];
}

function describe(value, reviewedChunks = null) {
  const word = normaliseWord(value);
  if (!word) return Object.freeze({ word, chunks: Object.freeze([]), doubleRanges: Object.freeze([]), source: "invalid", resolution: "invalid" });
  const cacheKey = reviewedChunks ? null : word;
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);

  const stableChunks = stable.segmentForGame(word, reviewedChunks);
  let experimental = null;
  let ruleOnly = null;
  try {
    ruleOnly = candidate.engine(word);
    experimental = candidate.analyseWithReviewedFallback(word, ruleOnly);
  } catch (error) {
    experimental = null;
    ruleOnly = null;
  }
  const candidateChunks = experimental?.chunks?.join("") === word ? experimental.chunks.slice() : stableChunks.slice();
  const selected = EFFECTIVE_V16_ENABLED && !reviewedChunks ? candidateChunks : stableChunks.slice();
  const result = Object.freeze({
    schemaVersion: 1,
    word,
    chunks: Object.freeze(selected),
    analysisChunks: Object.freeze(experimental?.analysisChunks?.slice() || stableChunks.slice()),
    candidateChunks: Object.freeze(candidateChunks),
    ruleOnlyChunks: Object.freeze(ruleOnly?.chunks?.slice() || []),
    stableChunks: Object.freeze(stableChunks.slice()),
    doubleRanges: Object.freeze(doubleLetterRanges(word).slice()),
    resolution: selected.length > 1 ? "segmented" : "whole",
    source: EFFECTIVE_V16_ENABLED && !reviewedChunks
      ? (QA_PREVIEW_V16_ENABLED ? "v16-qa-preview" : "v16")
      : "stable-staged",
    candidateSource: experimental?.source || "candidate-unavailable",
    ruleOnlySource: ruleOnly?.source || "rule-candidate-unavailable",
    ruleTrace: Object.freeze(ruleOnly?.trace?.slice() || [])
  });
  if (cacheKey) cache.set(cacheKey, result);
  return result;
}

function segmentForGame(word, reviewedChunks = null) {
  return describe(word, reviewedChunks).chunks.slice();
}

function precompute(values) {
  return Array.from(values || [], value => describe(typeof value === "string" ? value : value?.display));
}

const runtime = Object.freeze({
  schemaVersion: 1,
  build: "batchS8b",
  childFacingV16Enabled: CHILD_FACING_V16_ENABLED,
  qaPreviewV16Enabled: QA_PREVIEW_V16_ENABLED,
  effectiveV16Enabled: EFFECTIVE_V16_ENABLED,
  activationStatus: "released-offline-petpop-course-segmenter",
  describe,
  precompute,
  segmentForGame,
  doubleLetterRanges,
  candidateForGame(word) { return describe(word).candidateChunks.slice(); },
  ruleOnlyForGame(word) { return describe(word).ruleOnlyChunks.slice(); },
  stableForGame(word) { return describe(word).stableChunks.slice(); },
  clearCache() { cache.clear(); }
});

global.WordBarSegmentsV16 = Object.freeze({
  engine: candidate.engine,
  analyseScored: candidate.analyseScored,
  analyseWithReviewedFallback: candidate.analyseWithReviewedFallback,
  trace: candidate.trace,
  soundCuts: candidate.soundCuts,
  segmentForGame(word) { return runtime.candidateForGame(word); },
  doubleLetterRanges
});
global.WordBarSpellingRuntime = runtime;
global.dispatchEvent(new CustomEvent("wordbar-spelling-runtime-ready", {
  detail: {
    build: runtime.build,
    childFacingV16Enabled: runtime.childFacingV16Enabled,
    qaPreviewV16Enabled: runtime.qaPreviewV16Enabled
  }
}));
