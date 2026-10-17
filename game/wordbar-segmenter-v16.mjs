/* WordBar sound-aware segmentation v16 — browser-ready Batch S8b candidate.
 *
 * This test-only engine separates linguistic analysis from child display,
 * selects a complete scored segmentation with a retained runner-up, and
 * declines near-ties. Batch S8b is selected by the production browser runtime.
 */

import { createPronunciationProvider } from "./wordbar-pronunciation-v16.mjs?v=batchS8b";
import { alignSoundToSpelling } from "./wordbar-sound-spelling-alignment-v16.mjs?v=batchS8b";
import { scoreCompleteSegmentations } from "./wordbar-segmentation-scoring-v16.mjs?v=batchS8b";
import { optimiseDisplay } from "./wordbar-display-policy-v16.mjs?v=batchS8b";
import { structuralEvidence } from "./wordbar-structural-evidence-v16.mjs?v=batchS8b";
import { analyseSpellingPatterns } from "./wordbar-pattern-segmentation-v16.mjs?v=batchS8b";

const VOWELS = "aeiouy";
const SYLLABIC_ENDING = /^[bcdfgkpstz]{0,2}(le|re)$/;

function normaliseWord(value) {
  const word = String(value ?? "").trim().toLowerCase();
  return /^[a-z]+$/.test(word) ? word : "";
}

function hasNucleus(chunk) {
  return [...chunk].some(character => VOWELS.includes(character)) || SYLLABIC_ENDING.test(chunk);
}

function chunksFromCuts(word, cuts) {
  const sorted = [...new Set(cuts)].filter(cut => cut > 0 && cut < word.length).sort((a, b) => a - b);
  const chunks = [];
  let at = 0;
  for (const cut of sorted) {
    if (cut > at) chunks.push(word.slice(at, cut));
    at = cut;
  }
  chunks.push(word.slice(at));
  return chunks.filter(Boolean);
}

function safeOrthographicFallback(analysis, word) {
  if (!analysis || analysis.displayChunks.length < 2) return false;
  return analysis.safeToDisplay === true && analysis.displayChunks.join("") === word;
}

function baselineMorphemeEvidence(analysis) {
  if (!analysis || analysis.source === "curated-override" || analysis.source === "custom-reviewed") return [];
  return (analysis.boundaries || [])
    .filter(boundary => boundary.confidence === "high" && !/possible-prefix/.test(boundary.reason || ""))
    .map(boundary => ({
      cut: boundary.cut,
      confidence: "high",
      reason: boundary.reason,
      provenance: /compound|combining/.test(boundary.reason || "")
        ? "validated-morphology"
        : "validated-spelling-structure",
      score: /compound|combining/.test(boundary.reason || "") ? -18 : -12
    }));
}

function mergeEvidence(baseline, structural) {
  const retainedBaseline = baseline.filter(item =>
    !structural.some(candidate => Math.abs(candidate.cut - item.cut) <= 1));
  const byCut = new Map();
  for (const item of [...retainedBaseline, ...structural]) {
    const previous = byCut.get(item.cut);
    if (!previous || (item.score ?? 0) < (previous.score ?? 0)) byCut.set(item.cut, item);
  }
  return [...byCut.values()].sort((a, b) => a.cut - b.cut);
}

function validatedMorphemeSeam(item) {
  return /morphology/.test(item?.provenance || "") ||
    /compound|combining|retained-e|derivational|suffix/.test(item?.reason || "");
}

function orthographicTieCost(chunks) {
  if (!Array.isArray(chunks) || chunks.length < 2 || chunks.some(chunk => chunk.length < 2)) {
    return Number.POSITIVE_INFINITY;
  }
  const lengths = chunks.map(chunk => chunk.length);
  const imbalance = Math.max(...lengths) - Math.min(...lengths);
  const vowelInitial = chunks.slice(1).filter(chunk => /^[aeiouy]/.test(chunk)).length;
  return imbalance + (vowelInitial * 0.5);
}

function mergeWeakPartsInsideRecognisedRegion(chunks) {
  let current = chunks.slice();
  while (current.length > 1) {
    const index = current.findIndex(chunk => chunk.length === 1);
    if (index < 0) break;
    const candidates = [];
    if (index > 0) {
      const left = current.slice();
      left[index - 1] += left[index];
      left.splice(index, 1);
      candidates.push(left);
    }
    if (index < current.length - 1) {
      const right = current.slice();
      right[index + 1] = right[index] + right[index + 1];
      right.splice(index, 1);
      candidates.push(right);
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => {
      const range = values => Math.max(...values.map(part => part.length)) -
        Math.min(...values.map(part => part.length));
      return range(a) - range(b) || a.join("|").localeCompare(b.join("|"));
    });
    current = candidates[0];
  }
  return current;
}

/* A validated morphological seam may be correct but too coarse on its own.
 * When pronunciation shows at least two more spoken syllables than the
 * structural result, refine long recognised regions with the existing safe
 * orthographic rules, then collapse any one-letter fragment only within that
 * already-recognised region. This yields transferable spellings such as
 * dia|phan|ous, ex|uber|ant and for|tuit|ous without completed-word answers. */
function refineStructuralAnalysis(word, structuralChunks, pronunciation, segments) {
  if (!Array.isArray(structuralChunks) || !pronunciation ||
      pronunciation.syllableCount - structuralChunks.length < 2) return structuralChunks;
  const refined = [];
  for (const chunk of structuralChunks) {
    if (chunk.length < 6) {
      refined.push(chunk);
      continue;
    }
    const analysis = segments.analyseRulesOnly?.(chunk);
    if (!analysis?.safeToDisplay || analysis.displayChunks?.length < 2 ||
        analysis.displayChunks.join("") !== chunk) {
      refined.push(chunk);
      continue;
    }
    refined.push(...mergeWeakPartsInsideRecognisedRegion(analysis.displayChunks));
  }
  return refined.length > structuralChunks.length && refined.join("") === word
    ? refined
    : structuralChunks;
}

function protectedCuts(word, protectedPositions, alignment, morphology) {
  const reopenCuts = [
    ...(alignment?.internalCuts || []),
    ...morphology.filter(validatedMorphemeSeam).map(item => item.cut)
  ];
  return protectedPositions.forbiddenCuts(word, { reopenCuts });
}

function displayResult(word, analysisChunks, morphology, pronunciation, extra = {}) {
  if (!analysisChunks || analysisChunks.join("") !== word) {
    return { chunks: null, analysisChunks: null, displayChunks: null,
      source: "INVARIANT-FAIL", reason: "declined", trace: extra.trace || [] };
  }
  const display = optimiseDisplay(word, analysisChunks, {
    preservedCuts: morphology
      .filter(validatedMorphemeSeam)
      .map(item => item.cut),
    pronunciation
  });
  if (!display || display.displayChunks.join("") !== word ||
      display.displayChunks.some(chunk => !hasNucleus(chunk))) {
    return { chunks: null, analysisChunks: null, displayChunks: null,
      source: "DISPLAY-FAIL", reason: "declined", trace: extra.trace || [] };
  }
  return {
    chunks: display.displayChunks.slice(),
    analysisChunks: analysisChunks.slice(),
    displayChunks: display.displayChunks.slice(),
    display,
    reason: display.displayChunks.length > 1 ? "ok" : "whole",
    ...extra
  };
}

export function createV16Segmenter({ segments, pronunciations, pronunciationProvider, protectedPositions }) {
  if (!segments || typeof segments.analyse !== "function") {
    throw new TypeError("createV16Segmenter requires the existing WordBarSegments API");
  }
  const provider = pronunciationProvider || createPronunciationProvider(pronunciations);
  if (!provider || typeof provider.get !== "function") {
    throw new TypeError("createV16Segmenter requires a structured pronunciation provider");
  }
  if (!protectedPositions || typeof protectedPositions.forbiddenCuts !== "function") {
    throw new TypeError("createV16Segmenter requires the shared protected-position model");
  }

  function analyseScored(value, options = {}) {
    const allowReviewedFallback = options.allowReviewedFallback === true;
    const trace = [];
    const step = (rule, verdict, reason, evidence = {}) => {
      trace.push(Object.freeze({ rule, verdict, reason, evidence: Object.freeze({ ...evidence }) }));
    };
    const word = normaliseWord(value);
    if (!word) return { chunks: null, source: "invalid", reason: "declined", trace };
    step("R1-normalise", "valid", "letters-only", { word });
    const reviewed = segments.analyse(word);
    const reviewedAvailable = reviewed.source === "curated-override" || reviewed.source === "custom-reviewed";
    step("R2-reviewed-reference", reviewedAvailable ? "available" : "absent",
      reviewedAvailable ? "held-for-decline-only" : "no-completed-word-answer");
    const baseline = typeof segments.analyseRulesOnly === "function"
      ? segments.analyseRulesOnly(word)
      : reviewed;

    const useReviewedFallback = reason => {
      if (!allowReviewedFallback || !reviewedAvailable) return null;
      step("R9-confidence", "fallback", reason, { source: reviewed.source });
      const result = displayResult(word, reviewed.displayChunks.slice(), [], provider.get(word), {
        source: "reviewed-decline-fallback",
        scoring: { fixedReviewedAnalysis: true },
        trace: Object.freeze(trace.slice())
      });
      return result.chunks ? result : null;
    };

    /* Exception first means reusable spelling families first, never completed
       word branches. A pattern must reconstruct the word and pass the shared
       protected-position check inside analyseSpellingPatterns().

       GUARD: no anchored-ending pattern may fire on a word the pronunciation
       data confirms is a single spoken syllable. This is a structural rule,
       not a word list -- it applies to the whole registry (~40 endings:
       -ute, -ist, -ine, -ble/-cle/-dle..., -tion, -ness and the rest), not
       to specific words. Found via route ("root", 1 syllable) matching
       final-ute and waist ("wayst", 1 syllable) matching final-ist: both
       were split purely because the LETTERS matched an ending pattern, with
       nothing checking whether the WORD had more than one syllable to
       divide in the first place. The sound-alignment stage two steps later
       already respects syllableCount correctly; this closes the same gap
       one stage earlier, where it was being bypassed entirely. */
    const knownMonosyllable = provider.get(word)?.syllableCount === 1;
    const patternResult = knownMonosyllable ? null : analyseSpellingPatterns(word, protectedPositions);
    if (knownMonosyllable) {
      step("R2-pattern-exceptions", "skip", "pronunciation-confirms-single-syllable",
        { syllableCount: 1 });
    }
    if (patternResult) {
      step("R2-pattern-exceptions", "accept", patternResult.pattern.id, {
        kind: patternResult.pattern.kind,
        cuts: patternResult.cuts.slice()
      });
      const patternMorphology = patternResult.preservedCuts.map(cut => ({
        cut,
        provenance: "validated-morphology",
        reason: `spelling-pattern:${patternResult.pattern.id}`
      }));
      const displayedPattern = displayResult(word, patternResult.analysisChunks,
        patternMorphology, provider.get(word), {
        source: "pattern:first",
        pattern: patternResult.pattern,
        confidence: patternResult.confidence,
        cuts: patternResult.cuts,
        preservedCuts: patternResult.preservedCuts,
        scoring: { patternFirst: true, patternId: patternResult.pattern.id },
        trace: Object.freeze(trace.slice())
      });
      if (displayedPattern.chunks) return displayedPattern;
      step("R2-pattern-exceptions", "reject", "display-policy-declined-pattern");
    }
    step("R2-pattern-exceptions", "continue", "no-high-confidence-pattern");

    const structural = structuralEvidence(word);
    const morphology = mergeEvidence(baselineMorphemeEvidence(baseline), structural);
    const pronunciation = provider.get(word);
    const alignment = pronunciation ? alignSoundToSpelling(word, pronunciation) : null;
    const forbidden = protectedCuts(word, protectedPositions, alignment, morphology);
    const safeMorphology = morphology.filter(item => !forbidden.has(item.cut));
    const structuralSafe = structural.filter(item => !forbidden.has(item.cut));
    const rawStructuralChunks = structuralSafe.length
      ? chunksFromCuts(word, structuralSafe.map(item => item.cut))
      : null;
    const structuralChunks = rawStructuralChunks
      ? refineStructuralAnalysis(word, rawStructuralChunks, pronunciation, segments)
      : null;
    step("R3-protected-positions", "computed", "shared-constraint-model", {
      forbiddenCuts: [...forbidden].sort((a, b) => a - b)
    });
    step("R4-morphology", safeMorphology.length ? "available" : "absent", "transferable-evidence", {
      cuts: safeMorphology.map(item => item.cut),
      structuralCuts: structuralSafe.map(item => item.cut),
      refinedStructuralChunks: structuralChunks?.join("|") || null
    });
    step("R5-pronunciation", pronunciation ? "available" : "absent",
      pronunciation?.source || "no-structured-pronunciation", {
        syllableCount: pronunciation?.syllableCount || 0
      });
    step("R6-nuclei", alignment ? "resolved" : "unresolved",
      alignment ? "sound-spelling-alignment" : "alignment-unavailable", {
        minimumNuclei: alignment?.minimumNuclei ?? null,
        syllableSurplus: alignment?.syllableSurplus ?? null
      });

    if (!pronunciation || !alignment || alignment.confidence === "low") {
      if (structuralChunks) {
        step("R7-boundary-placement", "structure", "sound-unavailable-or-ambiguous");
        const result = displayResult(word, structuralChunks, structuralSafe, pronunciation, {
          source: structuralChunks !== rawStructuralChunks ? "structure-only:refined-root" : "structure-only",
          scoring: { soundStatus: pronunciation ? "alignment-ambiguous" : "no-pronunciation" },
          trace: Object.freeze(trace.slice())
        });
        if (result.chunks) return result;
      }
      if (safeOrthographicFallback(baseline, word)) {
        step("R7-boundary-placement", "orthographic", "rule-only-baseline-fallback");
        const result = displayResult(word, baseline.displayChunks.slice(), safeMorphology, pronunciation, {
          source: `degraded:${pronunciation ? "alignment-failed" : "no-pronunciation"}`,
          scoring: { soundStatus: pronunciation ? "alignment-failed" : "no-pronunciation" },
          trace: Object.freeze(trace.slice())
        });
        if (result.chunks) return result;
      }
      const fallback = useReviewedFallback("rule-engine-declined-without-alignment");
      if (fallback) return fallback;
      step("R9-confidence", "decline", pronunciation ? "alignment-failed" : "no-pronunciation");
      return {
        chunks: null,
        analysisChunks: null,
        displayChunks: null,
        source: `degraded:${pronunciation ? "alignment-failed" : "no-pronunciation"}`,
        reason: "declined",
        trace: Object.freeze(trace.slice())
      };
    }

    step("R7-boundary-placement", "sound", "alignment-candidates", {
      confidence: alignment.confidence,
      internalCuts: alignment.internalCuts.slice()
    });
    const scoring = scoreCompleteSegmentations({
      word,
      alignment,
      syllables: pronunciation.syllables,
      morphology: safeMorphology,
      forbidden
    });
    step("R8-complete-scoring", scoring ? "ranked" : "failed", "whole-candidate-comparison", {
      candidateCount: scoring?.candidateCount || 0,
      margin: Number.isFinite(scoring?.margin) ? scoring.margin : null
    });
    if (!scoring || scoring.confidence === "low") {
      if (structuralChunks && structuralSafe.every(validatedMorphemeSeam)) {
        step("R9-confidence", "structure-fallback", "validated-morphology-breaks-sound-tie");
        const result = displayResult(word, structuralChunks, structuralSafe, pronunciation, {
          source: structuralChunks !== rawStructuralChunks
            ? "degraded:validated-structure-refined-root"
            : "degraded:validated-structure-near-tie",
          scoring,
          trace: Object.freeze(trace.slice())
        });
        if (result.chunks) return result;
      }
      if (pronunciation?.validated === true && scoring?.best && scoring?.runnerUp) {
        const options = [scoring.best, scoring.runnerUp].map(candidate => ({
          candidate,
          result: displayResult(word, candidate.chunks, safeMorphology, pronunciation, {
            source: "scored:reviewed-pronunciation-tiebreak",
            scoring,
            trace: Object.freeze(trace.slice())
          })
        })).filter(option => option.result.chunks);
        if (options.length === 2) {
          options.forEach(option => { option.tieCost = orthographicTieCost(option.result.chunks); });
          options.sort((a, b) => a.tieCost - b.tieCost);
          if (Number.isFinite(options[0].tieCost) && options[1].tieCost - options[0].tieCost >= 0.5) {
            step("R9-confidence", "accept", "reviewed-pronunciation-orthographic-tiebreak", {
              selectedCost: options[0].tieCost,
              rejectedCost: options[1].tieCost
            });
            options[0].result.trace = Object.freeze(trace.slice());
            return options[0].result;
          }
        }
      }
      if (safeOrthographicFallback(baseline, word)) {
        step("R9-confidence", "orthographic-fallback", "scoring-near-tie");
        const result = displayResult(word, baseline.displayChunks.slice(), safeMorphology, pronunciation, {
          source: "degraded:segmentation-near-tie",
          scoring,
          trace: Object.freeze(trace.slice())
        });
        if (result.chunks) return result;
      }
      const fallback = useReviewedFallback("rule-engine-near-tie");
      if (fallback) return fallback;
      step("R9-confidence", "decline", "segmentation-near-tie");
      return {
        chunks: null,
        analysisChunks: null,
        displayChunks: null,
        source: "degraded:segmentation-near-tie",
        reason: "declined",
        scoring,
        trace: Object.freeze(trace.slice())
      };
    }

    step("R9-confidence", "accept", scoring.confidence, { margin: scoring.margin });
    const scoredDisplay = displayResult(word, scoring.best.chunks, safeMorphology, pronunciation, {
      source: safeMorphology.length ? "scored:morph+sound" : "scored:sound",
      scoring: {
        bestScore: scoring.best.score,
        runnerUpScore: scoring.runnerUp?.score ?? null,
        margin: Number.isFinite(scoring.margin) ? scoring.margin : null,
        confidence: scoring.confidence,
        candidateCount: scoring.candidateCount,
        boundaries: scoring.best.boundaries
      },
      alignment: {
        confidence: alignment.confidence,
        bestCost: alignment.bestCost,
        runnerUpCost: alignment.runnerUpCost,
        margin: Number.isFinite(alignment.margin) ? alignment.margin : null
      },
      trace: Object.freeze(trace.slice())
    });
    /* A licensed compound or derivational seam is a complete candidate, not an
       unchecked early return. Once it has passed the shared protection and
       reconstruction gates, prefer it when the sound candidate merely adds
       smaller phonetic fragments. This keeps spelling-useful change|able and
       tooth|brush without letting morphology bypass the safety pipeline. */
    if (structuralChunks && structuralSafe.every(validatedMorphemeSeam)) {
      const structuralDisplay = displayResult(word, structuralChunks, structuralSafe, pronunciation, {
        source: "scored:structure-preferred",
        scoring: {
          soundCandidate: scoredDisplay.chunks?.slice() || null,
          soundConfidence: scoring.confidence,
          morphologyCuts: structuralSafe.map(item => item.cut)
        }
      });
      if (structuralDisplay.chunks &&
          (!scoredDisplay.chunks || structuralDisplay.chunks.length < scoredDisplay.chunks.length)) {
        step("R10-display", "accept", "simpler-validated-morphology");
        structuralDisplay.trace = Object.freeze(trace.slice());
        return structuralDisplay;
      }
    }
    if (scoredDisplay.chunks) {
      step("R10-display", "accept", scoredDisplay.display?.changed ? "stress-aware-simplification" : "analysis-preserved");
      scoredDisplay.trace = Object.freeze(trace.slice());
      return scoredDisplay;
    }
    /* Syllabic -le and borrowed endings can defeat the generic nucleus check.
       A previously safe child-facing analysis is a better fallback than
       discarding useful, already-verified structure. */
    if (safeOrthographicFallback(baseline, word)) {
      step("R10-display", "orthographic-fallback", "scored-invariant-failed");
      return displayResult(word, baseline.displayChunks.slice(), safeMorphology, pronunciation, {
        source: "degraded:scored-invariant-fallback",
        scoring: { candidate: scoring.best.chunks, confidence: scoring.confidence },
        trace: Object.freeze(trace.slice())
      });
    }
    const fallback = useReviewedFallback("scored-display-invariant-failed");
    if (fallback) return fallback;
    return scoredDisplay;
  }

  function soundCuts(value) {
    const result = analyseScored(value);
    if (!result.analysisChunks) return { cuts: null, reason: result.source, scoring: result.scoring || null };
    let at = 0;
    const cuts = result.analysisChunks.slice(0, -1).map(chunk => (at += chunk.length));
    return { cuts, reason: "ok", scoring: result.scoring || null };
  }

  function analyseWithReviewedFallback(value, precomputedRuleOnly = null) {
    const ruleOnly = precomputedRuleOnly?.trace ? precomputedRuleOnly : analyseScored(value);
    const word = normaliseWord(value);
    if (!word) return ruleOnly;
    const reviewed = segments.analyse(word);
    const reviewedAvailable = reviewed.source === "curated-override" || reviewed.source === "custom-reviewed";
    if (!reviewedAvailable) return ruleOnly;
    const agrees = ruleOnly.chunks?.join("") === word &&
      ruleOnly.analysisChunks?.join("|") === reviewed.displayChunks.join("|");
    if (agrees) return ruleOnly;
    const trace = [
      ...(ruleOnly.trace || []),
      Object.freeze({
        rule: "R11-reviewed-safety-fallback",
        verdict: "use-reviewed",
        reason: ruleOnly.chunks ? "rule-review-conflict" : "rule-engine-declined",
        evidence: Object.freeze({
          ruleCandidate: ruleOnly.analysisChunks?.join("|") || null,
          reviewedReference: reviewed.displayChunks.join("|")
        })
      })
    ];
    return displayResult(word, reviewed.displayChunks.slice(), [], provider.get(word), {
      source: "reviewed-safety-fallback",
      scoring: {
        fixedReviewedAnalysis: true,
        ruleCandidate: ruleOnly.analysisChunks?.slice() || null,
        ruleSource: ruleOnly.source
      },
      trace: Object.freeze(trace)
    });
  }

  return Object.freeze({
    engine: analyseScored,
    analyseScored,
    analyseWithReviewedFallback,
    trace(value) { return analyseScored(value).trace || []; },
    soundCuts
  });
}
