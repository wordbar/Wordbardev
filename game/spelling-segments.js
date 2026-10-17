/* WordBar spelling-chunk segmenter v15 — verified morpheme-first child-facing edition.
   Browser IIFE wrapper for the frozen, tested v14 algorithm. No dependencies.

   segment("punctual")        -> ["punc", "tual"] (diagnostic/raw result)
   segmentForGame("punctual") -> ["punc", "tual"] (safe child-facing result)
   segmentForGame("universe") -> ["universe"]     (uncertain: do not guess)

   Design rule: reviewed chunks are authoritative. Automatic chunks are shown
   to a child only when no retained boundary is low-confidence. Otherwise the
   whole word is returned. Reviewed overrides may intentionally make a
   word-specific exception to a general protected-unit rule.
*/
(function installWordBarSegments(global){
"use strict";
const V = "aeiou";
const PROTECTED_POSITIONS = global.WordBarProtectedPositions;
if (!PROTECTED_POSITIONS || typeof PROTECTED_POSITIONS.forbiddenCuts !== "function") {
  throw new Error("spelling-protected.js must load before spelling-segments.js");
}
const PROTECTED_ENDINGS = ["ique", "aque", "oque", "tion", "sion", "cian", "cial", "tial", "tious", "cious", "xious", "scious", "science", "cient", "tient", "cience", "tience", "tual", "sual", "dual", "nual", "ture", "sure", "ledge", "ridge", "dge", "tch", "gue", "que", "ble", "cle", "dle", "fle", "gle", "kle", "ple", "tle", "zle"];
const ONSETS = ["scr", "spl", "spr", "str", "thr", "shr", "chr", "phr", "sch", "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "sc", "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw", "dw", "qu", "ch", "sh", "th", "wh", "ph", "gh", "kn", "wr", "gn", "rh"];
const PREFIXES = ["be", "counter", "inter", "under", "trans", "super", "semi", "anti", "auto", "over", "fore", "dis", "mis", "pre", "sub", "non", "out", "con", "com", "pro", "per", "un", "re", "in", "im", "il", "ir", "en", "em", "de", "ex"];
const TRUE_SUFFIXES = ["ingly", "ments", "ness", "ment", "less", "ship", "hood", "ward", "ful", "ing", "est", "ly", "ed", "er", "s"];
const HIATUS = new Set(["area", "cereal", "chaos", "creat", "create", "cruel", "dial", "diet", "duel", "fluid", "fuel", "genius", "giant", "idea", "ideal", "lenient", "lion", "museum", "neon", "obedient", "piano", "poem", "poet", "quiet", "radio", "react", "real", "riot", "ruin", "science", "societ", "theatre", "trial", "video", "violin"]);
const COMBINING_PREFIXES = ["circum", "chrono", "psycho", "thermo", "biblio", "micro", "macro", "hydro", "astro", "multi", "pseudo", "hyper", "centi", "milli", "kilo", "deci", "terra", "photo", "proto", "tele", "auto", "poly", "mono", "para", "peri", "meta", "aqua", "bio", "geo"];
const COMBINING_SUFFIXES = ["logical", "scopic", "graphy", "phonic", "meter", "metre", "litre", "liter", "metry", "sphere", "script", "phobia", "graph", "scope", "phone", "logy", "naut", "cycle", "gram", "watt", "byte", "pathy"];
const COMPOUND_FIRST = ["every", "birth", "break", "breeze", "after", "under", "class", "school", "water", "light", "tooth", "some", "news", "play", "over", "foot", "back", "fire", "rain", "snow", "week", "home", "hand", "head", "earth", "down", "book", "door", "hide", "mush", "out", "sun", "any", "bed", "air", "tea", "up", "no"];
// Stems that genuinely take agentive -er / comparative -est. Without this the
// rule fires on sist|er, monst|er, thund|er, plast|er and ~30 similar words
// where "er" is not a suffix at all.
const AGENT_STEMS = new Set(["work","teach","farm","paint","sing","dance","build","write",
"speak","play","help","read","walk","run","jump","swim","lead","learn","own","sell","buy",
"win","drive","ride","clean","print","report","train","camp","bake","drum","garden","listen",
"open","travel","comput","begin","climb","catch","throw","kick","draw","design",
"invent","explore","publish","perform","record","manage","rule","hunt","fish","sail",
"carve","weave","brew","mine","view","join","keep","make","take",
"give","bring","send","think","reach","search","watch","match","touch","preach",
"strong","long","great","small","tall","fast","slow","kind","bright","dark","light","soft",
"hard","sharp","smooth","rough","fresh","quick","near","deep","high","low","rich",
"poor","young","old","warm","cool","weak","thick","thin","wide","short","loud","quiet","calm"]);
const COMPOUND_SECOND = ["ground", "paper", "brush", "melon", "where", "thing", "body", "place", "shine", "block", "bound", "work", "room", "ball", "pack", "fast", "noon", "time", "port", "tick", "one", "day", "bow", "man", "end", "cup"];
/* Reviewed chunks now live in spelling-chunks.js (loaded first). The algorithm
   below is frozen at v15; growing coverage is a data change, not a code change. */
const OVERRIDES = Object.assign(
  Object.create(null),
  (typeof window !== "undefined" && window.WordBarReviewedChunks) ||
  (typeof globalThis !== "undefined" && globalThis.WordBarReviewedChunks) || {}
);

const byLen = a => [...a].sort((x, y) => y.length - x.length);

/* v16: phonotactic onset legality. English cannot begin a word with mb-, ck-,
   nt-, pt-, dl- or ctu-, so a boundary creating such an onset is provably
   wrong and can be decided from spelling alone. Exemptions are required for
   syllabic -le and the protected -dge/-tch/-gue/-que endings, whose nucleus
   is a consonant rather than a vowel. */
const LEGAL_ONSETS = new Set(["bl","br","cl","cr","dr","dw","fl","fr","gl","gr","kn",
  "pl","pr","sc","sk","sl","sm","sn","sp","st","sw","tr","tw","th","sh","ch","wh","ph",
  "gh","qu","wr","gn","rh","ps","scr","spl","spr","str","shr","thr","chr","phr","sch","squ"]);
const SYLLABIC_ENDING = /^[bcdfgkpstz]{0,2}(le|re)$/;
const PROTECTED_ENDING_CHUNK = /^(dge|tch|cle|dle|ple|tle|zle|gle|kle|ble|fle|gue|que)$/;
function chunkOnset(chunk) {
  // y is a vowel here. V is "aeiou", so without this "ty" reads as a
  // two-consonant onset and pretty was repaired to prett|y.
  let i = 0;
  while (i < chunk.length && !V.includes(chunk[i]) && chunk[i] !== "y") i++;
  return chunk.slice(0, i);
}
function illegalOnset(chunk) {
  if (SYLLABIC_ENDING.test(chunk) || PROTECTED_ENDING_CHUNK.test(chunk)) return false;
  const o = chunkOnset(chunk);
  return o.length >= 2 && !LEGAL_ONSETS.has(o);
}
const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };

function normaliseWord(word) {
  const w = String(word ?? "").trim().toLowerCase();
  return /^[a-z]+$/.test(w) ? w : "";
}

function normaliseReviewedChunks(word, chunks) {
  if (!Array.isArray(chunks) || !chunks.length) return null;
  const cleaned = chunks.map(c => normaliseWord(c));
  if (cleaned.some(c => !c) || cleaned.join("") !== word) return null;
  return cleaned;
}

function isV(w, i) {
  const c = w[i];
  if (c === "e" && i === w.length - 2 && w[w.length - 1] === "d" && i > 0 &&
      !V.includes(w[i - 1]) && !"dt".includes(w[i - 1])) return false;
  if (c === "u" && i > 0 && "gq".includes(w[i - 1]) &&
      i + 1 < w.length && V.includes(w[i + 1])) return false;
  return V.includes(c) || (c === "y" && i > 0);
}

function forbidRange(f, start, end) {
  for (let i = start + 1; i < end; i++) f.add(i);
}

function forbidden(w) {
  const f = PROTECTED_POSITIONS.forbiddenCuts(w);
  for (const m of w.matchAll(/[gq]u[aeiou]/g)) {
    f.add(m.index + 1);
    f.add(m.index + 2);
  }
  // Reopen vowel boundaries only inside the matched hiatus expression. The
  // previous implementation reopened every vowel pair elsewhere in the word.
  for (const hiatus of HIATUS) {
    let from = 0;
    let at;
    while ((at = w.indexOf(hiatus, from)) >= 0) {
      for (let i = at + 1; i < at + hiatus.length; i++) {
        if (V.includes(w[i - 1]) && V.includes(w[i])) f.delete(i);
      }
      from = at + 1;
    }
  }
  for (const m of w.matchAll(/(?<=[^cstx])i[aeou]/g)) f.delete(m.index + 1);
  if (/^i[aeou]/.test(w)) f.delete(1);

  for (const ending of byLen(PROTECTED_ENDINGS)) {
    const head = w.slice(0, w.length - ending.length);
    if (w.endsWith(ending) && head.length >= 2 && /[aeiouy]/.test(head)) {
      forbidRange(f, w.length - ending.length, w.length);
      break;
    }
  }
  for (const unit of ["ie", "tual", "sual", "cial", "tial", "tion", "sion", "cious", "tious", "cient"]) {
    let from = 0;
    let at;
    while ((at = w.indexOf(unit, from)) >= 0) {
      if (!(unit === "ie" && at + 2 < w.length && V.includes(w[at + 2]))) {
        forbidRange(f, at, at + unit.length);
      }
      from = at + 1;
    }
  }
  if (w.endsWith("e") && w.length > 3 && !/(ee|ye|oe|ie)$/.test(w)) {
    for (let i = w.length - 2; i < w.length; i++) f.add(i);
  }

  // Protect a retained silent-e stem through one or more recognised suffixes.
  let end = w.length;
  for (let depth = 0; depth < 3; depth++) {
    const part = w.slice(0, end);
    const suffix = byLen(TRUE_SUFFIXES).find(s => part.endsWith(s) && part.length - s.length >= 3);
    if (!suffix) break;
    end -= suffix.length;
    const stem = w.slice(0, end);
    if (stem.endsWith("e") && stem.length >= 3) {
      for (let i = stem.length - 2; i < stem.length; i++) f.add(i);
    }
  }
  return f;
}

function vGroups(w, f) {
  const groups = [];
  let i = 0;
  while (i < w.length) {
    if (!isV(w, i)) {
      i++;
      continue;
    }
    const start = i;
    while (i < w.length && isV(w, i)) {
      if (i > start && !f.has(i)) break;
      i++;
    }
    groups.push([start, i]);
  }
  return groups;
}

function nSyll(w, f) {
  const groups = vGroups(w, f);
  let count = groups.length;
  if (w.endsWith("e") && count > 1 && !/(ee|ye|oe|ie|le)$/.test(w)) count--;
  if (w.length > 2 && w.endsWith("le") && !V.includes(w[w.length - 3])) count++;
  if (w.endsWith("ed") && w.length > 3 && !"dt".includes(w[w.length - 3]) &&
      !V.includes(w[w.length - 3])) count--;
  return Math.max(1, count);
}

const onsetLen = consonants => {
  for (const onset of byLen(ONSETS)) if (consonants.startsWith(onset)) return onset.length;
  return consonants ? 1 : 0;
};

function addBoundary(map, cut, confidence, reason, f, length, allowForbidden = false) {
  if (!(cut > 0 && cut < length) || (!allowForbidden && f.has(cut))) return;
  const current = map.get(cut);
  if (!current || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[current.confidence]) {
    map.set(cut, { cut, confidence, reason });
  }
}

function morphemeBoundaryDetails(w, f) {
  const boundaries = new Map();

  // Exact everyday compounds: both halves must be recognised. This avoids
  // treating a coincidental beginning such as "some-" as a universal rule.
  for (const first of byLen(COMPOUND_FIRST)) {
    if (!w.startsWith(first)) continue;
    const second = w.slice(first.length);
    if (COMPOUND_SECOND.includes(second)) {
      addBoundary(boundaries, first.length, "high", `compound:${first}+${second}`, f, w.length, true);
      break;
    }
  }

  // Greek/Latin combining forms transfer across unfamiliar school words.
  // Multiple boundaries are useful: autobiography -> auto|bio|graphy.
  const WEAK_COMBINING = new Set(["para", "aqua", "terra", "meta", "peri", "poly", "mono"]);
  for (const prefix of byLen(COMBINING_PREFIXES)) {
    if (w.startsWith(prefix) && w.length - prefix.length >= 3) {
      // para|dise and aqua|rium are coincidences, not morphemes. For the weak
      // forms the remainder must itself be a recognised part.
      if (WEAK_COMBINING.has(prefix)) {
        const rest = w.slice(prefix.length);
        const known = COMBINING_SUFFIXES.includes(rest) || COMPOUND_SECOND.includes(rest) ||
                      COMBINING_SUFFIXES.some(x => rest === x + "s" || rest === x + "y");
        if (!known) continue;
      }
      addBoundary(boundaries, prefix.length, "high", `combining-prefix:${prefix}`, f, w.length, true);
    }
  }
  for (const suffix of byLen(COMBINING_SUFFIXES)) {
    const cut = w.length - suffix.length;
    if (w.endsWith(suffix) && cut >= 3) {
      addBoundary(boundaries, cut, "high", `combining-suffix:${suffix}`, f, w.length, true);
    }
  }

  // A trusted start and ending can occasionally overlap around one letter,
  // producing a useless middle block such as tele|o|logy. In that conflict,
  // retain the exact word-final combining form and discard the earlier prefix
  // cut: teleo|logy. This keeps all letters and avoids a one-letter colour area.
  const orderedCuts = [...boundaries.keys()].sort((a, b) => a - b);
  for (let i = 0; i < orderedCuts.length - 1; i++) {
    const left = boundaries.get(orderedCuts[i]);
    const right = boundaries.get(orderedCuts[i + 1]);
    if (right.cut - left.cut === 1 &&
        left.reason.startsWith("combining-prefix:") &&
        right.reason.startsWith("combining-suffix:")) {
      boundaries.delete(left.cut);
    }
  }
  return boundaries;
}

function requiredBoundaryDetails(w, f) {
  const boundaries = new Map();

  for (const ending of byLen(PROTECTED_ENDINGS)) {
    const head = w.slice(0, w.length - ending.length);
    if (w.endsWith(ending) && head.length >= 2 && /[aeiouy]/.test(head)) {
      addBoundary(boundaries, head.length, "high", `protected-ending:${ending}`, f, w.length);
      break;
    }
  }

  // A spelling alone cannot prove that an initial letter string is a genuine
  // morpheme (for example, un- in universe), so prefix cuts are conservative.
  for (const prefix of byLen(PREFIXES)) {
    if (w.startsWith(prefix) && w.length - prefix.length >= 3) {
      /* v15: a doubled consonant straight after a candidate prefix means those
         letters belong to the stem, not to a prefix boundary. Without this the
         prefix cut wins and produces pre|tty, pre|ttier, de|ssert and be|llow.
         Removing the bogus boundary lets the ordinary VC|CV rule give the
         correct pret|ty, pret|tier, des|sert, bel|low. */
      const afterPrefix = w.slice(prefix.length);
      if (afterPrefix.length >= 2 && afterPrefix[0] === afterPrefix[1]
          && !"aeiou".includes(afterPrefix[0])) break;
      addBoundary(boundaries, prefix.length, "medium", `possible-prefix:${prefix}`, f, w.length);
      break;
    }
  }

  const suffixCuts = [];
  let end = w.length;
  let previousSuffix = null;
  const allowedSuffixChains = new Set(["ful+ness", "less+ness", "ful+ly", "less+ly"]);
  for (let depth = 0; depth < 2; depth++) {
    const part = w.slice(0, end);
    const suffix = byLen(TRUE_SUFFIXES).find(s => {
      const stemLength = part.length - s.length;
      const minimum = (s === "s" || s === "ed") ? 4 : 3;
      if (!(part.endsWith(s) && stemLength >= minimum)) return false;
      // "er"/"est" are only suffixes when what precedes them is a real base word.
      // "ly" must not split a consonant+l onset blend: sup|ply not supp|ly,
      // re|ply not rep|ly, sim|ply not simp|ly, no|bly not nob|ly.
      // Real bases keep their suffix: deep|ly, quick|ly, soft|ly.
      if (s === "ly" && stemLength >= 1) {
        const stem = part.slice(0, stemLength);
        const before = stem[stem.length - 1];
        if ("pbcfgkt".includes(before) && !AGENT_STEMS.has(stem) && !AGENT_STEMS.has(stem + "e")) return false;
      }
      if (s === "er" || s === "est") {
        const stem = part.slice(0, stemLength);
        const doubled = stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]
                        && !V.includes(stem[stem.length - 1]);
        if (!AGENT_STEMS.has(stem) && !AGENT_STEMS.has(stem + "e") && !doubled) return false;
      }
      return depth === 0 || allowedSuffixChains.has(`${s}+${previousSuffix}`);
    });
    if (!suffix) break;

    let cut = end - suffix.length;
    if ((suffix === "s" || suffix === "ed") &&
        nSyll(part, forbidden(part)) === nSyll(part.slice(0, part.length - suffix.length), forbidden(part.slice(0, part.length - suffix.length)))) {
      break;
    }

    const shiftedForDouble = ["ing", "ed", "er", "est"].includes(suffix) &&
      cut >= 2 && w[cut - 1] === w[cut - 2] && !V.includes(w[cut - 1]);
    const reliableDouble = shiftedForDouble && suffix !== "er";
    if (shiftedForDouble) cut--;

    suffixCuts.push({ cut, suffix, shiftedForDouble, reliableDouble });
    end = cut;
    previousSuffix = suffix;
  }

  const isSuffixChain = suffixCuts.length > 1;
  for (const item of suffixCuts) {
    const level = (item.reliableDouble || isSuffixChain) ? "high" : "medium";
    const reason = item.shiftedForDouble ? `doubled-suffix:${item.suffix}` :
      isSuffixChain ? `suffix-chain:${item.suffix}` : `possible-suffix:${item.suffix}`;
    addBoundary(boundaries, item.cut, level, reason, f, w.length);
  }
  return boundaries;
}

function candidateBoundaryDetails(w, f) {
  const groups = vGroups(w, f);
  const boundaries = new Map();
  for (let index = 0; index < groups.length - 1; index++) {
    const left = groups[index];
    const right = groups[index + 1];
    const consonantStart = left[1];
    const consonantEnd = right[0];
    const count = consonantEnd - consonantStart;
    let cut;
    let level;
    let reason;

    if (count === 0) {
      cut = consonantStart;
      level = "high";
      reason = "reviewed-hiatus-rule";
    } else if (count === 1) {
      cut = (left[1] - left[0]) === 1 ? consonantStart : consonantStart + 1;
      level = "low";
      reason = "single-medial-consonant";
    } else {
      const consonants = w.slice(consonantStart, consonantEnd);
      if (count === 2 && (["th", "sh", "ch", "ph", "wh", "gh", "ck", "qu"].includes(consonants) ||
                          /^[bcdfgkpt][lr]$/.test(consonants))) {
        cut = consonantStart;
      } else if (count === 2) {
        cut = consonantStart + 1;
      } else {
        cut = consonantEnd - Math.max(1, onsetLen(consonants.slice(1)));
      }
      level = "medium";
      reason = count === 2 ? "two-consonant-division" : "consonant-cluster-division";
    }

    for (const coda of ["tch", "dge", "ck"]) {
      const at = w.indexOf(coda, Math.max(0, consonantStart - 1));
      if (at >= 0 && at < consonantEnd && at <= consonantStart) {
        cut = at + coda.length;
        break;
      }
    }

    if (f.has(cut)) {
      const moved = [cut - 1, cut + 1, cut - 2, cut + 2]
        .find(x => !f.has(x) && x >= consonantStart && x <= consonantEnd);
      cut = moved;
      level = "low";
      reason = "moved-from-protected-position";
    }
    addBoundary(boundaries, cut, level, reason, f, w.length);
  }
  return boundaries;
}

/* v16: repair an illegal onset by sliding the boundary rightwards, refusing to
   stop inside a protected position. Uses the SAME forbidden set the analysis
   built, so genuine hiatus (cre|ate, po|et, qui|et) and compound joins
   (home|work) are untouched — those positions are not in f. */
function repairOnsets(w, chunks, f) {
  const r = chunks.slice();
  const moved = new Map();          // newCut -> originalCut
  for (let i = 1; i < r.length; i++) {
    let guard = 0;
    const from = r.slice(0, i).reduce((n, c) => n + c.length, 0);
    let pos = from;
    while ((illegalOnset(r[i]) || f.has(pos)) && r[i].length > 1 && guard++ < 5) {
      r[i - 1] += r[i][0];
      r[i] = r[i].slice(1);
      pos++;
    }
    if (pos !== from) moved.set(pos, from);
  }
  const out = r.filter(Boolean);
  if (out.join("") !== w) return { chunks, moved: new Map() };
  /* A repair that strands a one-letter final chunk has made things worse, not
     better: glasses -> glasse|s, shelves -> shelve|s. Abandon the repair for
     that word and keep the original chunks. */
  if (out.length > 1 && out[out.length - 1].length === 1) {
    return { chunks, moved: new Map() };
  }
  return { chunks: out, moved };
}

function chunksFromCuts(w, cuts) {
  const chunks = [];
  let at = 0;
  for (const cut of cuts) {
    if (cut > at) {
      chunks.push(w.slice(at, cut));
      at = cut;
    }
  }
  chunks.push(w.slice(at));

  const hasVowel = chunk => [...chunk].some((_, i) => isV(chunk, i) || V.includes(chunk[i]));
  const merged = [];
  for (const chunk of chunks.filter(Boolean)) {
    if (merged.length && !hasVowel(chunk)) merged[merged.length - 1] += chunk;
    else if (merged.length && !hasVowel(merged[merged.length - 1])) merged[merged.length - 1] += chunk;
    else merged.push(chunk);
  }
  return merged.length ? merged : [w];
}

function finalCutsFromChunks(chunks) {
  const cuts = [];
  let at = 0;
  for (let i = 0; i < chunks.length - 1; i++) {
    at += chunks[i].length;
    cuts.push(at);
  }
  return cuts;
}

function automaticAnalysis(w) {
  const f = forbidden(w);
  if (nSyll(w, f) <= 1) {
    return { chunks: [w], boundaries: [], confidence: "high", source: "automatic-whole" };
  }

  // Morphemes are resolved before vowel division and kept intact. This fixes
  // both excessive suppression (tele|phone) and wrong medium-confidence cuts
  // (new|spap|er) without relaxing the low-confidence gate.
  const morphemes = morphemeBoundaryDetails(w, f);
  if (morphemes.size) {
    const cuts = [...morphemes.keys()].sort((a, b) => a - b);
    const chunks = chunksFromCuts(w, cuts);
    const boundaries = finalCutsFromChunks(chunks).map(cut => morphemes.get(cut) ?? {
      cut,
      confidence: "low",
      reason: "unclassified-morpheme-boundary"
    });
    const confidence = boundaries.length ? boundaries.reduce(
      (lowest, boundary) => CONFIDENCE_RANK[boundary.confidence] < CONFIDENCE_RANK[lowest] ? boundary.confidence : lowest,
      "high"
    ) : "medium";
    return { chunks, boundaries, confidence, source: "automatic-morpheme" };
  }

  const required = requiredBoundaryDetails(w, f);
  const candidate = candidateBoundaryDetails(w, f);
  const requiredCuts = [...required.keys()].sort((a, b) => a - b);
  const spanEdges = [0, ...requiredCuts, w.length];

  // Do not subdivide a short root or affix merely to make more colour blocks.
  for (const cut of [...candidate.keys()]) {
    if (requiredCuts.some(requiredCut => Math.abs(requiredCut - cut) <= 1)) {
      candidate.delete(cut);
      continue;
    }
    for (let i = 0; i < spanEdges.length - 1; i++) {
      if (cut > spanEdges[i] && cut < spanEdges[i + 1] && spanEdges[i + 1] - spanEdges[i] <= 5) {
        candidate.delete(cut);
        break;
      }
    }
  }

  const all = new Map(required);
  for (const [cut, detail] of candidate) {
    if (!all.has(cut)) all.set(cut, detail);
  }
  const proposedCuts = [...all.keys()].filter(cut => !f.has(cut)).sort((a, b) => a - b);
  // v16: repair illegal onsets on the vowel-division path only. Morpheme
  // boundaries (handled above) are meaning-bearing and are never slid.
  const repaired = repairOnsets(w, chunksFromCuts(w, proposedCuts), f);
  const chunks = repaired.chunks;
  const retainedCuts = finalCutsFromChunks(chunks);
  /* A repaired boundary inherits the confidence of the cut it came from — the
     repair CORRECTS a position, it does not weaken the evidence. Without this
     transfer every repaired word fell to "low" and was suppressed, which
     regressed pretty and really to whole words. */
  const boundaries = retainedCuts.map(cut => {
    const origin = repaired.moved.has(cut) ? repaired.moved.get(cut) : cut;
    const detail = all.get(cut) ?? all.get(origin);
    if (!detail) return { cut, confidence: "low", reason: "unclassified-boundary" };
    return { ...detail, cut, reason: origin === cut ? detail.reason : `${detail.reason}+onset-repair` };
  });
  const confidence = boundaries.length ? boundaries.reduce(
    (lowest, boundary) => CONFIDENCE_RANK[boundary.confidence] < CONFIDENCE_RANK[lowest] ? boundary.confidence : lowest,
    "high"
  ) : "medium";
  return { chunks, boundaries, confidence, source: "automatic" };
}

/**
 * Returns raw diagnostic chunks. Child-facing screens should use
 * segmentForGame() instead.
 */
function segment(word, reviewedChunks = null) {
  return analyse(word, reviewedChunks).chunks.slice();
}

/**
 * Returns segmentation metadata. Optional reviewedChunks supports a future
 * WordBar library field such as ["punc", "tual"]. Invalid custom chunks are
 * ignored safely.
 */
function analyse(word, reviewedChunks = null) {
  const w = normaliseWord(word);
  if (!w) {
    return {
      word: "",
      chunks: [],
      displayChunks: [],
      boundaries: [],
      confidence: "low",
      source: "invalid",
      safeToDisplay: false
    };
  }

  const custom = normaliseReviewedChunks(w, reviewedChunks);
  // Never read an inherited Object.prototype member as a reviewed entry.
  // Without this guard, valid inputs such as "constructor" resolve to a
  // function and crash on reviewed.slice().
  const builtIn = Object.prototype.hasOwnProperty.call(OVERRIDES, w) ? OVERRIDES[w] : null;
  const reviewed = custom || builtIn;
  if (reviewed) {
    const chunks = reviewed.slice();
    return {
      word: w,
      chunks,
      displayChunks: chunks.slice(),
      boundaries: finalCutsFromChunks(chunks).map(cut => ({
        cut,
        confidence: "high",
        reason: custom ? "custom-reviewed" : "curated-override"
      })),
      confidence: "high",
      source: custom ? "custom-reviewed" : "curated-override",
      safeToDisplay: true
    };
  }

  const result = automaticAnalysis(w);

  /* Trusted-base suffix reuse.

     The compound and combining-form tables match exactly, so adding an
     everyday ending loses the morpheme: "newspaper" resolves to news|paper but
     "newspapers" falls back to the whole word, and "toothbrushes" was cut as
     toothb|ru|shes. A teacher still sees the base word through the ending.

     If removing a spelling-preserving ending reveals a base the engine already
     segments from a TRUSTED source (reviewed chunks or a recognised morpheme),
     reuse that segmentation and append the ending. Only endings that leave the
     base spelling untouched are allowed, so no doubling, e-deletion or y->i
     case can be mis-analysed. */
  /* Suffix reuse now runs even when the word already resolves as a morpheme,
     because the base test below is strict enough to protect thermo|meter on
     its own. The previous blanket guard was too broad: it also blocked
     tele|phone|s, photo|graph|s and geo|graph|er|s. */
  const reused = reuseTrustedBase(w);
  if (reused) {
    const boundaries = [];
    let at = 0;
    for (const chunk of reused.slice(0, -1)) {
      at += chunk.length;
      boundaries.push({ cut: at, confidence: "high", reason: "trusted-base-suffix-reuse" });
    }
    return {
      word: w,
      chunks: reused.slice(),
      displayChunks: reused.slice(),
      boundaries,
      confidence: "high",
      source: "automatic-morpheme",
      safeToDisplay: true
    };
  }

  const safeToDisplay = result.confidence !== "low";
  return {
    word: w,
    chunks: result.chunks.slice(),
    displayChunks: safeToDisplay ? result.chunks.slice() : [w],
    boundaries: result.boundaries.map(boundary => ({ ...boundary })),
    confidence: result.confidence,
    source: result.source,
    safeToDisplay
  };
}

/* Endings that never alter the spelling of the base they attach to. */
/* "ers" is deliberately absent: recursion discovers "er" then "s", which keeps
   one rule instead of two and gives photo|graph|er|s the same shape as
   photo|graph|er. */
const REUSABLE_ENDINGS = ["ing", "es", "ed", "er", "s"];

/* A base is trustworthy only on POSITIVE evidence about its ending or its
   whole shape - never because it merely starts with a combining form.
   That distinction is what separates photo|graph (ends in a recognised
   combining suffix, real) from thermo|met (only starts with "thermo", a
   fragment). Trusting prefixes produced thermo|met|er. */
const TRUSTED_BASE_REASON = /compound:|combining-suffix:|protected-ending:/;

function trustedBaseChunks(base, allowReviewedBase = true) {
  if (allowReviewedBase && Object.prototype.hasOwnProperty.call(OVERRIDES, base)) return OVERRIDES[base].slice();
  // Exact, unchanged agent/adjective stem: farm -> farm|er|s, sing -> sing|er|s.
  // Spelling-changing stems (writ<-write, danc<-dance, runn<-run) are absent
  // from the list, so those are left to the ordinary rules.
  if (AGENT_STEMS.has(base)) return [base];
  const analysis = automaticAnalysis(base);
  if (analysis.confidence !== "high" || analysis.chunks.length < 2) return null;
  // A combining PREFIX and SUFFIX often land on the same cut (tele|phone), so
  // only one reason survives on the boundary. Test the base's ending directly
  // rather than relying on which reason was recorded.
  const endsInCombiningForm = COMBINING_SUFFIXES.some(
    suffix => base.endsWith(suffix) && base.length - suffix.length >= 3);
  const positive = endsInCombiningForm
    || (analysis.boundaries || []).some(b => TRUSTED_BASE_REASON.test(b.reason || ""));
  return positive ? analysis.chunks.slice() : null;
}

function reuseTrustedBase(w, depth = 0, allowReviewedBase = true) {
  if (depth > 3 || w.length < 6) return null;
  for (const ending of REUSABLE_ENDINGS) {
    if (!w.endsWith(ending)) continue;
    const base = w.slice(0, w.length - ending.length);
    if (base.length < 4) continue;
    // "s" after s/x/z/ch/sh is really "es"; skip so brushes is not brushe + s.
    if (ending === "s" && /(s|x|z|ch|sh)$/.test(base)) continue;
    const chunks = trustedBaseChunks(base, allowReviewedBase) || reuseTrustedBase(base, depth + 1, allowReviewedBase);
    if (chunks && chunks.join("") === base) {
      return chunks.length > 1 || AGENT_STEMS.has(base) ? [...chunks, ending] : null;
    }
  }
  return null;
}

/**
 * Runs only transferable spelling rules. Curated completed-word answers are
 * deliberately excluded, including reviewed answers reused through a base
 * word. v16 uses this API to measure genuine generalisation separately from
 * exception-assisted child-facing coverage.
 */
function analyseRulesOnly(word) {
  const w = normaliseWord(word);
  if (!w) {
    return {
      word: "", chunks: [], displayChunks: [], boundaries: [],
      confidence: "low", source: "invalid", safeToDisplay: false
    };
  }
  const result = automaticAnalysis(w);
  const reused = reuseTrustedBase(w, 0, false);
  if (reused) {
    const boundaries = [];
    let at = 0;
    for (const chunk of reused.slice(0, -1)) {
      at += chunk.length;
      boundaries.push({ cut: at, confidence: "high", reason: "trusted-rule-base-suffix-reuse" });
    }
    return {
      word: w,
      chunks: reused.slice(),
      displayChunks: reused.slice(),
      boundaries,
      confidence: "high",
      source: "automatic-rule-morpheme",
      safeToDisplay: true
    };
  }
  const safeToDisplay = result.confidence !== "low";
  return {
    word: w,
    chunks: result.chunks.slice(),
    displayChunks: safeToDisplay ? result.chunks.slice() : [w],
    boundaries: result.boundaries.map(boundary => ({ ...boundary })),
    confidence: result.confidence,
    source: `rule-only:${result.source}`,
    safeToDisplay
  };
}

function confidence(word, reviewedChunks = null) {
  return analyse(word, reviewedChunks).confidence;
}

/** Conservative child-facing segmentation. */
function segmentSafe(word, reviewedChunks = null) {
  return analyse(word, reviewedChunks).displayChunks.slice();
}

/** Use once per word and reuse the returned chunks in both Rounds 1 and 2. */
function segmentForGame(word, reviewedChunks = null) {
  return segmentSafe(word, reviewedChunks);
}

/** Independent visual cue; doubled letters do not alter chunk boundaries. */
function doubleLetterRanges(word) {
  const w = normaliseWord(word);
  if (!w) return [];
  const ranges = [];
  for (let i = 1; i < w.length; i++) {
    if (w[i] === w[i - 1]) ranges.push({ start: i - 1, end: i + 1, letters: w.slice(i - 1, i + 1) });
  }
  return ranges;
}

function isValidReviewedSegmentation(word, chunks) {
  const w = normaliseWord(word);
  return Boolean(w && normaliseReviewedChunks(w, chunks));
}

/** Lightweight startup/CI validation for the bundled reviewed dictionary. */
function verifyBuiltInData() {
  const issues = [];
  for (const [word, chunks] of Object.entries(OVERRIDES)) {
    if (!normaliseReviewedChunks(word, chunks)) issues.push(word);
  }
  return {
    reviewedWordCount: Object.keys(OVERRIDES).length,
    valid: issues.length === 0,
    issues
  };
}

/** Coverage is a product-quality metric: suppression is safe, but not free. */
function summariseCoverage(words) {
  const summary = {
    total: 0,
    segmented: 0,
    whole: 0,
    suppressedLowConfidence: 0,
    reviewed: 0,
    morphemeResolved: 0,
    invalid: 0
  };
  for (const value of words ?? []) {
    const info = analyse(value);
    summary.total++;
    if (!info.word) {
      summary.invalid++;
      continue;
    }
    if (info.displayChunks.length > 1) summary.segmented++;
    else summary.whole++;
    if (!info.safeToDisplay) summary.suppressedLowConfidence++;
    if (info.source === "curated-override" || info.source === "custom-reviewed") summary.reviewed++;
    if (info.source === "automatic-morpheme") summary.morphemeResolved++;
  }
  summary.suppressionRate = summary.total ? summary.suppressedLowConfidence / summary.total : 0;
  return summary;
}

global.WordBarSegments=Object.freeze({
  segment,
  analyse,
  analyseRulesOnly,
  confidence,
  segmentSafe,
  segmentForGame,
  doubleLetterRanges,
  isValidReviewedSegmentation,
  verifyBuiltInData,
  summariseCoverage
});
})(window);
