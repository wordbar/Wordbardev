/* Weighted sound-to-spelling alignment for Batch S7c.
 *
 * Each spelling vowel group may host zero, one or two spoken syllables when
 * orthographic evidence permits it.  The best and runner-up complete mappings
 * are retained so ambiguity is measurable rather than hidden by rule order.
 * Hiatus is inferred from the pronunciation's syllable surplus over written
 * vowel nuclei; no completed-word hiatus list is used.
 */

const VOWELS = "aeiouy";
const COMMON_VOWEL_TEAMS = new Set([
  "ai", "ay", "au", "aw", "ea", "ee", "ei", "ey", "ie", "oa", "oe",
  "oi", "oo", "ou", "oy", "ue", "ui"
]);

function normaliseWord(value) {
  const word = String(value ?? "").trim().toLowerCase();
  return /^[a-z]+$/.test(word) ? word : "";
}

function isVowel(word, index) {
  const letter = word[index];
  if (letter === "y" && index === 0) return false;
  if (letter === "u" && index > 0 && "gq".includes(word[index - 1]) &&
      index + 1 < word.length && VOWELS.includes(word[index + 1])) return false;
  return VOWELS.includes(letter);
}

export function spellingVowelGroups(value) {
  const word = normaliseWord(value);
  if (!word) return [];
  const groups = [];
  let index = 0;
  while (index < word.length) {
    if (!isVowel(word, index)) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < word.length && isVowel(word, index)) index += 1;
    groups.push(Object.freeze({ start, end: index, text: word.slice(start, index) }));
  }
  return groups;
}

function likelySilentFinalE(word, group) {
  if (group.end !== word.length || group.text !== "e" || !word.endsWith("e")) return false;
  if (/(ee|ie|oe|ye)$/.test(word)) return false;
  const syllabicEnding = /(le|re)$/.test(word) && word.length > 2 && !VOWELS.includes(word[word.length - 3]);
  return !syllabicEnding;
}

function minimumNuclei(word, groups) {
  return groups.reduce((count, group) => count + (likelySilentFinalE(word, group) ? 0 : 1), 0);
}

function choicesFor(word, group, syllableSurplus, groupIndex, groupCount) {
  const choices = [{ count: 1, cost: likelySilentFinalE(word, group) ? 1 : 0, reason: "one-nucleus" }];
  if (likelySilentFinalE(word, group)) choices.push({ count: 0, cost: 0.05, reason: "silent-final-e" });
  /* Adjacent written vowels may represent separate spoken nuclei only when
     the supplied pronunciation proves that extra nuclei are required. If
     several groups could carry the surplus, the retained runner-up exposes
     that ambiguity instead of selecting a word-specific answer. */
  const followedByR = word[group.end] === "r";
  const terminalRhotic = followedByR && groupIndex === groupCount - 1;
  const followsDemotedGu = group.start >= 2 && word[group.start - 1] === "u" &&
    "gq".includes(word[group.start - 2]);
  if (syllableSurplus > 0 && group.text.length >= 2 && !terminalRhotic && !followsDemotedGu) {
    for (let internalOffset = 1; internalOffset < group.text.length; internalOffset += 1) {
      const left = group.text.slice(0, internalOffset);
      const right = group.text.slice(internalOffset);
      const preservedTeam = COMMON_VOWEL_TEAMS.has(left) || COMMON_VOWEL_TEAMS.has(right);
      choices.push({
        count: 2,
        internalOffset,
        cost: 0.1 + Math.max(0, group.text.length - 2) * 0.1 +
          (followedByR ? 0.2 : 0) - (preservedTeam ? 0.15 : 0),
        reason: "pronunciation-supported-hiatus"
      });
    }
  }
  return choices;
}

function signature(assignments) {
  return assignments.map(item => `${item.count}:${item.internalOffset || 0}:${item.reason}`).join(",");
}

export function alignSoundToSpelling(value, pronunciation) {
  const word = normaliseWord(value);
  if (!word || !pronunciation || !Number.isInteger(pronunciation.syllableCount)) return null;
  const groups = spellingVowelGroups(word);
  if (!groups.length) return null;
  const minimum = minimumNuclei(word, groups);
  const syllableSurplus = pronunciation.syllableCount - minimum;
  if (syllableSurplus < 0) return null;

  const candidates = [];
  function visit(index, used, cost, assignments) {
    if (used > pronunciation.syllableCount) return;
    if (index === groups.length) {
      if (used === pronunciation.syllableCount) {
        candidates.push({ cost, assignments: assignments.slice() });
      }
      return;
    }
    for (const choice of choicesFor(word, groups[index], syllableSurplus, index, groups.length)) {
      assignments.push(Object.freeze({ ...choice, groupIndex: index }));
      visit(index + 1, used + choice.count, cost + choice.cost, assignments);
      assignments.pop();
    }
  }
  visit(0, 0, 0, []);
  if (!candidates.length) return null;

  candidates.sort((a, b) => a.cost - b.cost || signature(a.assignments).localeCompare(signature(b.assignments)));
  const best = candidates[0];
  const runnerUp = candidates.find(item => signature(item.assignments) !== signature(best.assignments)) || null;
  const margin = runnerUp ? runnerUp.cost - best.cost : Number.POSITIVE_INFINITY;
  const internalCuts = [];
  for (const assignment of best.assignments) {
    if (assignment.count === 2) {
      internalCuts.push(groups[assignment.groupIndex].start + (assignment.internalOffset || 1));
    }
  }
  return Object.freeze({
    word,
    groups,
    assignments: Object.freeze(best.assignments.slice()),
    bestCost: best.cost,
    runnerUpCost: runnerUp ? runnerUp.cost : null,
    margin,
    confidence: margin >= 0.2 ? "high" : margin >= 0.1 ? "medium" : "low",
    internalCuts: Object.freeze(internalCuts),
    minimumNuclei: minimum,
    syllableSurplus,
    candidateCount: candidates.length
  });
}
