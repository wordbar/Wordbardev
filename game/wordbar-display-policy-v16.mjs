/* Child-facing display optimisation with the Batch S8b syllable-preservation fix.
 * Linguistic analysis remains unchanged. A short written syllable is not an
 * orphan merely because it has one letter. Display merging is therefore
 * limited to two evidence-backed repairs: a confirmed unstressed leading
 * syllable and a trailing grammatical s.
 */

function cutsFromChunks(chunks) {
  const cuts = [];
  let at = 0;
  for (const chunk of chunks.slice(0, -1)) {
    at += chunk.length;
    cuts.push(at);
  }
  return cuts;
}

function signature(chunks) {
  return chunks.join("|");
}

function displayCost(chunks, analysisChunks, analysisCuts, preservedCuts) {
  const cuts = new Set(cutsFromChunks(chunks));
  let cost = 0;
  for (const chunk of chunks) {
    if (chunk.length === 1) cost += 12;
    if (!/[aeiouy]/.test(chunk)) cost += 100;
    if (chunk.length > 7) cost += (chunk.length - 7) * 2;
  }
  /* Chunk count alone is not a reason to erase a genuine spoken syllable. */
  if (chunks.length > 1) {
    const lengths = chunks.map(chunk => chunk.length);
    cost += (Math.max(...lengths) - Math.min(...lengths)) * 0.2;
  }
  const wordLength = analysisChunks.join("").length;
  for (const cut of analysisCuts) {
    if (!cuts.has(cut)) cost += preservedCuts.has(cut) ? 20 : 1 + (3 * (wordLength - cut) / wordLength);
  }
  return cost;
}

function mergedCandidates(chunks, preservedCuts, pronunciation) {
  const found = new Map([[signature(chunks), chunks.slice()]]);
  const queue = [chunks.slice()];
  while (queue.length && found.size < 96) {
    const current = queue.shift();
    const cuts = cutsFromChunks(current);
    for (let index = 0; index < current.length; index += 1) {
      /* Never merge an internal written syllable just because it is short.
         Gold and full-bank review showed that doing so consistently erased
         useful spelling information (sep|a|rate, veg|e|ta|ble, u|su|al).

         A leading one-letter chunk may merge only when structured
         pronunciation explicitly marks the first spoken syllable unstressed
         and the sound/chunk counts agree. A bare final s remains a grammatical
         display repair (train|er|s -> train|ers; short|s -> shorts). */
      const oneLetter = current[index].length === 1 && current.length > 1;
      const confirmedWeakLeading = oneLetter && index === 0 &&
        pronunciation?.syllableCount >= chunks.length &&
        pronunciation?.syllables?.[0]?.stressed === false;
      if (confirmedWeakLeading && !preservedCuts.has(cuts[index])) {
        const next = current.slice();
        next[index + 1] = next[index] + next[index + 1];
        next.splice(index, 1);
        const key = signature(next);
        if (!found.has(key)) { found.set(key, next); queue.push(next); }
      }
      if (oneLetter && index === current.length - 1 && current[index] === "s") {
        const next = current.slice();
        next[index - 1] += next[index];
        next.splice(index, 1);
        const key = signature(next);
        if (!found.has(key)) { found.set(key, next); queue.push(next); }
      }
    }
  }
  return [...found.values()];
}

export function optimiseDisplay(word, analysisChunks, { preservedCuts = [], pronunciation = null } = {}) {
  if (!Array.isArray(analysisChunks) || !analysisChunks.length || analysisChunks.join("") !== word) return null;
  const analysisCuts = cutsFromChunks(analysisChunks);
  const preserved = new Set(preservedCuts);
  const ranked = mergedCandidates(analysisChunks, preserved, pronunciation)
    .map(chunks => ({ chunks, score: displayCost(chunks, analysisChunks, analysisCuts, preserved) }))
    .sort((a, b) => a.score - b.score || signature(a.chunks).localeCompare(signature(b.chunks)));
  const best = ranked[0];
  const runnerUp = ranked.find(item => signature(item.chunks) !== signature(best.chunks)) || null;
  const margin = runnerUp ? runnerUp.score - best.score : Number.POSITIVE_INFINITY;
  const before = new Set(analysisCuts);
  const after = new Set(cutsFromChunks(best.chunks));
  const decisions = [...before].filter(cut => !after.has(cut)).map(cut => ({
    type: "merge-orphan-display-chunk",
    removedCut: cut,
    provenance: "batchS8b-evidence-gated-display-policy"
  }));
  return Object.freeze({
    analysisChunks: Object.freeze(analysisChunks.slice()),
    displayChunks: Object.freeze(best.chunks.slice()),
    changed: signature(analysisChunks) !== signature(best.chunks),
    decisions: Object.freeze(decisions),
    bestScore: best.score,
    runnerUpScore: runnerUp ? runnerUp.score : null,
    margin,
    confidence: margin >= 4 ? "high" : margin >= 2 ? "medium" : "low",
    candidateCount: ranked.length
  });
}
