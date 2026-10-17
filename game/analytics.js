/* WordBar privacy-minded usage analytics — v7 (schema v3).
   Analytics is on by default and a grown-up can turn it off in Settings.
   No names, answers, words, free text, IP addresses or cross-device IDs are
   sent. Every event has a fixed list of allowed fields, and the collector
   checks them again. The device keeps a few counters (the UK week it was
   first used, the last UK day/week/month it reported) so returning players
   can be counted without any ID.

   S10b review fixes (Codex Phase 1 review, 1 Oct 2026):
   R02 retention cohort only for devices first seen on this tracking (legacy devices send none)
   R03 durable outbox: events are written before sending and removed only when acknowledged
   R04 per-tab session records; a tab holds a Web Lock while alive, so another tab never
       "recovers" a live session
   R05 one Europe/London calendar for day, ISO week, month and cohort; period roll-over is
       checked on return, session start and session end, reported as a counter-only event
   R07 Pet Pop sends no vocabulary accuracy
   R08 session_end carries had_error (0/1)
   R10 time excludes pause-sheet time as well as hidden time
   R12 quit stage: questions answered for "early", the real run size for "late", open-ended
       modes report open_ended
   D   errors counted by an inline <head> listener before this file loads are reported once */
/* S10c (Codex v3.1 review, 1 Oct 2026):
   N01 one sender for all tabs (Web Lock); events sent at page close are marked so no other tab resends them
   N02 a storage write that fails is reported, never treated as queued; best-effort direct send instead;
       counters and session records only advance once the event is queued or accepted
   N03 a send pass continues until every entry has been tried; failures retry with back-off (30 s to 5 min)
   N06 a session's error flag is kept in its record and used if the session is recovered
   +   one storage entry per queued event, so tabs can't overwrite each other's queue
   +   question types limited to the game's own fixed list ("other" for anything new) */
window.WordBarAnalytics = (() => {
  const ENDPOINT = "https://analytics.wordbar.net/collect";
  const BUILD = "86l-phase13-petpop12-faq4-analytics8-batchS12d";
  const CONSENT_KEY = "wordbar_analytics_choice_v1";
  const FIRST_KEY = "wordbar_analytics_first_v1";
  const COHORT_KEY = "wordbar_analytics_cohort_v1";
  const LEGACY_COUNT_KEY = "wordbar_analytics_opens_v1";
  const QUEUE_KEY = "wordbar_analytics_queue_v1";
  const MILESTONE_KEY = "wordbar_analytics_milestones_v1";
  const PERIOD_KEY = "wordbar_analytics_period_v1";
  const CHANNEL_KEY = "wordbar_analytics_channel_v1";
  const LEGACY_SESSION_KEY = "wordbar_analytics_session_v1";
  const SESSION_PREFIX = "wordbar_analytics_session_v2:";
  const STEPS_KEY = "wordbar_analytics_steps_v1";
  const SEEDED_KEY = "wordbar_analytics_seeded_v1";
  const Q_PREFIX = "wordbar_analytics_q:";
  const FIXED_KEYS = [FIRST_KEY, COHORT_KEY, LEGACY_COUNT_KEY, QUEUE_KEY, MILESTONE_KEY, PERIOD_KEY, CHANNEL_KEY, LEGACY_SESSION_KEY, STEPS_KEY, SEEDED_KEY];
  const RESUME_AS_NEW_OPEN_MS = 30 * 60 * 1000;
  const NO_LOCKS_RECOVERY_AGE_MS = 12 * 3600 * 1000;
  const MAX_ACTIVE_SECONDS = 3600;

  const own = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);
  const set = list => new Set(list);
  const V = {
    flag: set([0, 1]),
    mode: set(["normal", "time", "rush", "review", "kitchen", "pet_pop"]),
    result: set(["completed", "quit", "interrupted", "failed", "save_failed"]),
    difficulty: set(["auto", "junior", "word_master", "super_star"]),
    course: set(["everyday", "elevenPlus", "unknown"]),
    display_mode: set(["browser", "standalone"]),
    channel: set(["whatsapp", "facebook", "instagram", "google", "bing", "reddit", "tes", "site", "other", "direct", "unknown"]),
    accuracy_band: set(["under_40", "40_59", "60_79", "80_plus", "not_applicable"]),
    hint_band: set(["0", "1", "2_plus", "not_applicable"]),
    quit_band: set(["early", "middle", "late", "open_ended", "none"]),
    stars_band: set(["0", "1", "2", "3", "none"]),
    time_band: set(["before_school", "school_hours", "after_school", "evening", "late"]),
    step: set(["course_chosen", "profile_created", "first_game_started", "first_game_finished", "second_game_started"]),
    milestone: set([
      "first_session_completed", "first_review_completed", "first_kitchen_completed",
      "first_dish_unlocked", "first_pet_revealed", "pet_licence_bought", "first_pet_chosen",
      "first_trophy_earned", "first_save_exported", "pwa_installed_when_detectable",
    ]),
    error_code: set([
      "boot_failed", "course_data_failed", "save_failed", "import_failed", "audio_unavailable",
      "session_failed", "kitchen_failed", "service_worker_failed", "unexpected_error",
    ]),
    area: set(["boot", "course_data", "save", "import", "audio", "session", "kitchen", "service_worker", "unknown"]),
  };
  const isCohort = v => typeof v === "string" && /^\d{4}-W\d{2}$/.test(v);
  const isLang = v => typeof v === "string" && /^([a-z]{2}|other)$/.test(v);
  const isSeconds = v => Number.isInteger(v) && v >= 0 && v <= MAX_ACTIVE_SECONDS;
  const isWeekDays = v => Number.isInteger(v) && v >= 1 && v <= 7;
  const isFeatures = v => typeof v === "string" && /^A?C?K?P?R?S?T?V?$/.test(v);
  const KINDS = set(["syn", "spell", "odd", "analogy", "rhyme", "homophone", "ladder", "cloze", "question_form", "third_person", "past_tense", "negative", "phrasal", "comparative", "opposite", "word_order", "quantifier", "scramble", "there_is", "definition", "category", "plural", "article", "spelling", "collocation", "preposition", "usage", "other"]);
  const isKind = v => KINDS.has(v);
  const isCount = v => Number.isInteger(v) && v >= 0 && v <= 500;

  /* Event-specific outbound fields are a privacy boundary, not a server
     convenience: a future caller cannot add a spelling word, typed answer,
     profile field or other free text to a payload by accident. */
  const PERIOD_FIELDS = { first_ever: V.flag, first_today: V.flag, first_week: V.flag, first_month: V.flag, week_days: isWeekDays, cohort: isCohort, channel: V.channel, features: isFeatures };
  const FIELDS = Object.freeze({
    app_open: { ...PERIOD_FIELDS, open_from: V.channel, display_mode: V.display_mode, language: isLang },
    active: { ...PERIOD_FIELDS },
    session_start: { mode: V.mode, difficulty: V.difficulty, course: V.course, display_mode: V.display_mode, time_band: V.time_band },
    session_end: { mode: V.mode, result: V.result, active_seconds: isSeconds, accuracy_band: V.accuracy_band, hint_band: V.hint_band, quit_band: V.quit_band, stars_band: V.stars_band, had_error: V.flag, difficulty: V.difficulty, course: V.course, display_mode: V.display_mode },
    question_mix: { kind: isKind, mode: V.mode, course: V.course, total: isCount, correct: isCount },
    step: { step: V.step, course: V.course, difficulty: V.difficulty, cohort: isCohort },
    milestone: { milestone: V.milestone },
    error: { error_code: V.error_code, area: V.area, display_mode: V.display_mode },
  });
  /* Old-format (v2) events may still sit in a device's offline queue from the
     previous build. They are replayed once, unchanged; the collector still
     accepts that format. */
  const LEGACY_EVENTS = set(["landing_action", "game_open", "session_start", "session_end", "milestone", "faq_use", "game_error"]);

  let opened = false;
  let currentSession = null;
  let lifecycleBound = false;
  let consentOverride = null;
  let consentGeneration = 0;
  let flushing = null;
  let hiddenAt = 0;
  let snapshotTimer = null;
  let featureProvider = null;
  const pauses = new Set();
  const reportedErrors = new Set();
  const activeRequests = new Set();
  const inFlight = new Set();

  /* A random token for this page only. It names this tab's session record and
     lock on the device and is never put in an event. */
  const TAB = (() => { try { const a = new Uint32Array(2); crypto.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); } catch { return String(Math.random()).slice(2); } })();
  const SESSION_KEY = SESSION_PREFIX + TAB;
  const locks = (() => { try { return navigator.locks && typeof navigator.locks.request === "function" ? navigator.locks : null; } catch { return null; } })();
  if (locks) { try { locks.request("wordbar-tab-" + TAB, () => new Promise(() => {})).catch(() => {}); } catch {} }

  function storageGet(key, fallback = null) {
    try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; }
  }
  function storageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  function storageRemove(key) { try { localStorage.removeItem(key); } catch {} }
  function storageKeys() { try { return Object.keys(localStorage); } catch { return []; } }
  function readJSON(key, fallback) { try { const v = JSON.parse(storageGet(key, "")); return v ?? fallback; } catch { return fallback; } }

  function consentStatus() {
    let stored;
    try { stored = localStorage.getItem(CONSENT_KEY); } catch { return consentOverride || "unset"; }
    if (stored === "denied" || stored === "granted") return stored;
    return consentOverride || "unset";
  }
  function allowed() { return consentStatus() !== "denied"; }

  function clearLocalData() {
    FIXED_KEYS.forEach(storageRemove);
    storageKeys().filter(k => k.startsWith(SESSION_PREFIX) || k.startsWith(Q_PREFIX)).forEach(storageRemove);
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  }
  function stopForDenial() {
    consentOverride = "denied";
    consentGeneration += 1;
    currentSession = null;
    stopSnapshotTimer();
    activeRequests.forEach(controller => { try { controller.abort(); } catch {} });
    activeRequests.clear();
    inFlight.clear();
    clearLocalData();
  }
  try {
    window.addEventListener("storage", event => {
      if (!event || event.key !== CONSENT_KEY) return;
      if (event.newValue === "denied") stopForDenial();
      else if (event.newValue === "granted") { consentOverride = "granted"; consentGeneration += 1; }
    });
  } catch {}
  function setConsent(granted) {
    if (!granted) { storageSet(CONSENT_KEY, "denied"); stopForDenial(); return; }
    consentOverride = "granted";
    storageSet(CONSENT_KEY, "granted");
    consentGeneration += 1;
    opened = false;
    flush();
  }

  function displayMode() {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    return standalone ? "standalone" : "browser";
  }
  function languageCode() {
    const value = String(window.navigator.language || "").slice(0, 2).toLowerCase();
    return /^[a-z]{2}$/.test(value) ? value : "other";
  }
  function courseCode(value) { return value === "everyday" || value === "elevenPlus" ? value : "unknown"; }
  function difficultyCode(value) { return V.difficulty.has(value) ? value : "auto"; }

  /* Referrer and ?via= are reduced to a category. The full address is never kept or sent. */
  function sourceFromHost(host) {
    host = String(host || "").toLowerCase();
    if (!host) return "direct";
    if (/(^|\.)wordbar\.net$/.test(host)) return "site";
    if (/whatsapp/.test(host)) return "whatsapp";
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(host)) return "facebook";
    if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google";
    if (/(^|\.)bing\.com$/.test(host)) return "bing";
    if (/(^|\.)reddit\.com$/.test(host)) return "reddit";
    if (/(^|\.)tes\.com$/.test(host)) return "tes";
    return "other";
  }
  function referrerSource() {
    try { return document.referrer ? sourceFromHost(new URL(document.referrer).hostname) : "direct"; } catch { return "direct"; }
  }
  function takeViaParam() {
    try {
      const url = new URL(location.href);
      const via = url.searchParams.get("via");
      if (via === null) return null;
      url.searchParams.delete("via");
      history.replaceState(history.state, "", url.pathname + (url.search || "") + url.hash);
      return V.channel.has(via) && via !== "unknown" ? via : null;
    } catch { return null; }
  }

  /* ---- one UK calendar (R05) ---- */
  const pad = n => String(n).padStart(2, "0");
  let UK_DAY = null, UK_HOUR = null;
  try {
    UK_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
    UK_HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" });
  } catch {}
  function ukDay(ms) {
    if (UK_DAY) { const s = UK_DAY.format(new Date(ms)); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; }
    const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function ukHour(ms) { if (UK_HOUR) { const h = parseInt(UK_HOUR.format(new Date(ms)), 10); if (h >= 0 && h <= 23) return h; } return new Date(ms).getHours(); }
  function weekOfDay(day) {
    const [y, m, d] = day.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    const wd = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - wd);
    const yy = t.getUTCFullYear();
    return `${yy}-W${pad(Math.ceil(((t - Date.UTC(yy, 0, 1)) / 86400000 + 1) / 7))}`;
  }
  function timeBand(ms) { const h = ukHour(ms); return h >= 6 && h < 9 ? "before_school" : h >= 9 && h < 15 ? "school_hours" : h >= 15 && h < 18 ? "after_school" : h >= 18 && h < 21 ? "evening" : "late"; }
  const hourNow = () => Math.floor(Date.now() / 3600000) * 3600000;

  function cleanProps(event, props) {
    if (!own(FIELDS, event)) return null;
    const fields = FIELDS[event];
    if (!props || typeof props !== "object" || Array.isArray(props)) return null;
    const clean = {};
    for (const [key, rule] of Object.entries(fields)) {
      if (!own(props, key)) continue;
      const value = props[key];
      const ok = typeof rule === "function" ? rule(value) : rule.has(value);
      if (ok) clean[key] = value;
    }
    return clean;
  }
  const BUILD_RE = /^[a-zA-Z0-9._-]{1,64}$/;
  function cleanPayload(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.v === 3) {
      const props = cleanProps(payload.event, payload.props);
      if (!props) return null;
      const at = Number(payload.at);
      return { v: 3, app: "game", event: payload.event, at: Number.isFinite(at) ? at : hourNow(), build: BUILD_RE.test(payload.build || "") ? payload.build : BUILD, props };
    }
    if (LEGACY_EVENTS.has(payload.event) && payload.properties && typeof payload.properties === "object" && !Array.isArray(payload.properties)) {
      const properties = {};
      for (const [k, v] of Object.entries(payload.properties)) {
        if (/^[a-z_0-9]{1,40}$/.test(k) && (typeof v === "number" || (typeof v === "string" && /^[a-zA-Z0-9_.-]{0,64}$/.test(v)))) properties[k] = v;
      }
      return { event: payload.event, properties };
    }
    return null;
  }

  /* ---- durable outbox (R03, N01–N03) ----
     One storage entry per event (key prefix + time-sortable local id), so tabs
     never overwrite each other's queue. An entry is written before any network
     attempt and removed only when the collector acknowledges it (or rejects it
     as invalid). All normal sending happens under one shared Web Lock, so only
     one tab sends at a time. A pass keeps going until every entry has been
     tried; a failed attempt schedules a bounded retry (30 s doubling to 5 min).
     Page close: if online, the closing tab marks the event "closing" and sends
     it with keepalive. Other tabs leave a closing entry alone and, after 2
     minutes, treat it as delivered and remove it. If offline at close, nothing
     is sent and the entry waits for the next visit. Events sent at close are
     therefore at most once (one could be lost if that keepalive request fails);
     all others are at least once (a lost reply can still duplicate one).
     Local ids never leave the device. */
  const CLOSING_GRACE_MS = 2 * 60 * 1000;
  const MAX_QUEUE = 50;
  let seq = 0, retryTimer = null, retryDelay = 30000, dirty = false, lastPassRetry = false;
  const newId = () => Date.now().toString(36).padStart(9, "0") + "." + TAB + "." + (++seq);
  function queueKeys() { return storageKeys().filter(k => k.startsWith(Q_PREFIX)).sort(); }
  function readEntry(key) { const e = readJSON(key, null); return e && typeof e === "object" && e.p && typeof e.p === "object" ? e : null; }
  /* Entries left by the previous single-array queue are moved to one entry each. */
  function migrateLegacyQueue() {
    const raw = storageGet(QUEUE_KEY, null);
    if (raw === null) return;
    let q = null; try { q = JSON.parse(raw); } catch {}
    if (!Array.isArray(q)) { storageRemove(QUEUE_KEY); return; }
    let ok = true;
    for (const e of q.slice(-MAX_QUEUE)) { const p = e && typeof e === "object" && e.p ? e.p : e; if (p && typeof p === "object") ok = storageSet(Q_PREFIX + newId(), JSON.stringify({ p })) && ok; }
    if (ok) storageRemove(QUEUE_KEY);
  }
  /* Returns the entry's key, or null if the device would not store it (N02). */
  function enqueue(payload) {
    if (!allowed()) return null;
    const key = Q_PREFIX + newId();
    if (!storageSet(key, JSON.stringify({ p: payload }))) return null;
    const keys = queueKeys();
    if (keys.length > MAX_QUEUE) keys.slice(0, keys.length - MAX_QUEUE).forEach(storageRemove);
    return key;
  }

  async function send(payload, generation) {
    if (!allowed() || generation !== consentGeneration) return "drop";
    const safePayload = cleanPayload(payload);
    if (!safePayload) return "drop";
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    if (controller) activeRequests.add(controller);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(safePayload), keepalive: true, credentials: "omit", referrerPolicy: "no-referrer",
        signal: controller?.signal,
      });
      if (!allowed() || generation !== consentGeneration) return "drop";
      if (response.ok) return "sent";
      return response.status === 429 || response.status >= 500 ? "retry" : "drop";
    } catch {
      return allowed() && generation === consentGeneration ? "retry" : "drop";
    } finally {
      if (controller) activeRequests.delete(controller);
    }
  }
  async function deliverKey(key, generation) {
    if (inFlight.has(key)) return "busy";
    const entry = readEntry(key);
    if (!entry) { storageRemove(key); return "gone"; }
    if (entry.closing) {                                      // sent with keepalive when its page closed
      if (Date.now() - Number(entry.closing) > CLOSING_GRACE_MS) storageRemove(key);
      return "skip";
    }
    inFlight.add(key);
    try {
      const outcome = await send(entry.p, generation);
      if ((outcome === "sent" || outcome === "drop") && allowed() && generation === consentGeneration) storageRemove(key);
      return outcome;
    } finally { inFlight.delete(key); }
  }
  function scheduleRetry() {
    if (retryTimer) return;
    const wait = retryDelay;
    retryDelay = Math.min(300000, retryDelay * 2);
    try { retryTimer = setTimeout(() => { retryTimer = null; flush(); }, wait); } catch {}
  }
  async function drain() {
    const generation = consentGeneration, tried = new Set();
    lastPassRetry = false;
    for (;;) {
      if (!allowed() || generation !== consentGeneration || !navigator.onLine) return;
      const key = queueKeys().find(k => !tried.has(k));       // re-read each time: new entries join this pass (N03)
      if (!key) { retryDelay = 30000; return; }
      tried.add(key);
      if ((await deliverKey(key, generation)) === "retry") { lastPassRetry = true; scheduleRetry(); return; }
    }
  }
  /* One tab at a time sends (Web Lock), so tabs never send the same entry together (N01). */
  function flush() {
    if (!allowed() || !navigator.onLine) return Promise.resolve();
    if (flushing) { dirty = true; return flushing; }
    const pass = () => (locks ? locks.request("wordbar-outbox", () => drain()).catch(() => {}) : drain());
    flushing = (async () => {
      do { dirty = false; await pass(); } while (dirty && !lastPassRetry && allowed() && navigator.onLine);
    })().finally(() => { flushing = null; });
    return flushing;
  }
  /* Page closing: mark the entry so no other tab resends it, then send with keepalive. */
  function sendOnClose(key, payload) {
    if (!navigator.onLine) return;                           // offline: it waits in the outbox for the next visit
    if (!storageSet(key, JSON.stringify({ p: payload, closing: Date.now() }))) return;
    send(payload, consentGeneration).then(outcome => {
      if (outcome === "sent" || outcome === "drop") storageRemove(key);
      else storageSet(key, JSON.stringify({ p: payload }));   // still alive and it failed: clear the mark so it is retried
    });
  }

  /* queued: the event is safely in the outbox. done: resolves true once it is
     queued, or (if the device would not store it) once a direct send was accepted. */
  function trackNow(event, props = {}, at = null, { urgent = false } = {}) {
    const no = { queued: false, done: Promise.resolve(false) };
    if (!allowed() || !own(FIELDS, event)) return no;
    const clean = cleanProps(event, props);
    if (!clean) return no;
    const payload = { v: 3, app: "game", event, at: at || hourNow(), build: BUILD, props: clean };
    const key = enqueue(payload);
    if (key) {
      if (urgent) sendOnClose(key, payload); else flush();
      return { queued: true, done: Promise.resolve(true) };
    }
    const done = navigator.onLine ? send(payload, consentGeneration).then(o => o === "sent") : Promise.resolve(false);
    return { queued: false, done };
  }
  function track(event, props = {}, at = null, opts = {}) { return trackNow(event, props, at, opts).done; }
  /* Runs commit() once the event is queued or accepted; never on failure (N02). */
  function trackThen(event, props, commit, at = null, opts = {}) {
    const r = trackNow(event, props, at, opts);
    if (r.queued) { commit(); return; }
    r.done.then(ok => { if (ok) commit(); });
  }

  /* ---- opens and period flags (R05) ---- */
  function cohortInfo() {
    const cohort = storageGet(COHORT_KEY, "");
    let channel = storageGet(CHANNEL_KEY, "");
    if (!V.channel.has(channel)) channel = "unknown";
    return isCohort(cohort) ? { cohort, channel } : { channel };
  }
  /* Works out the period flags for now WITHOUT writing them. commit() records
     the new day/week/month once the event carrying them is queued (N02).
     week_days = distinct UK days played this ISO week, sent once per new day. */
  function periodDraft() {
    const now = Date.now();
    const d = ukDay(now), w = weekOfDay(d), m = d.slice(0, 7);
    const last = readJSON(PERIOD_KEY, {}) || {};
    const flags = { first_today: last.d === d ? 0 : 1, first_week: last.w === w ? 0 : 1, first_month: last.m === m ? 0 : 1 };
    const days = Array.isArray(last.days) && last.w === w ? last.days.filter(x => typeof x === "string").slice(0, 7) : [];
    if (!days.includes(d)) days.push(d);
    if (flags.first_today) {
      flags.week_days = Math.min(7, days.length);
      try { const f = featureProvider && featureProvider(); if (isFeatures(f)) flags.features = f; } catch {}
    }
    return { flags, commit: () => storageSet(PERIOD_KEY, JSON.stringify({ d, w, m, days })) };
  }
  function openDraft() {
    const via = takeViaParam();
    const from = referrerSource();
    const first = Number(storageGet(FIRST_KEY, "0"));
    const firstEver = !Number.isFinite(first) || first <= 0;
    const period = periodDraft();
    let info;
    if (firstEver) {
      /* Retention cohort and first-time steps only for devices first seen on this tracking (R02). */
      info = { cohort: weekOfDay(ukDay(Date.now())), channel: via || from };
    } else {
      info = cohortInfo();
    }
    const commit = () => {
      if (firstEver) {
        storageSet(FIRST_KEY, String(Date.now()));
        storageSet(COHORT_KEY, info.cohort);
        storageSet(CHANNEL_KEY, info.channel);
        storageSet(STEPS_KEY, JSON.stringify({ on: true, seen: [], starts: 0 }));
      } else if (!V.channel.has(storageGet(CHANNEL_KEY, ""))) storageSet(CHANNEL_KEY, "unknown");
      period.commit();
    };
    return { props: { first_ever: firstEver ? 1 : 0, ...period.flags, ...info, open_from: via ? "site" : from }, commit };
  }
  /* A UK day/week/month that changed while the game stayed open is counted
     with a counter-only "active" event, so it never adds an extra open. */
  let periodPending = false;
  function checkRollover() {
    if (!allowed() || !opened || periodPending) return;
    const last = readJSON(PERIOD_KEY, {}) || {};
    if (last.d === ukDay(Date.now())) return;
    const period = periodDraft();
    periodPending = true;
    trackThen("active", { first_ever: 0, ...period.flags, ...cohortInfo() }, period.commit);
    periodPending = false;
  }

  function initGameOpen() {
    if (!allowed() || opened) return;
    opened = true;
    bindLifecycle();
    migrateLegacyQueue();
    const draft = openDraft();
    trackThen("app_open", { ...draft.props, display_mode: displayMode(), language: languageCode() }, draft.commit);
    recoverSessions();
    if (displayMode() === "standalone") milestoneOnce("pwa_installed_when_detectable");
    try { if (window.__wbEarlyErrors > 0) error("unexpected_error", "boot"); } catch {}
  }

  /* ---- sessions ---- */
  function updateActiveTime() {
    const s = currentSession;
    if (!s) return;
    const now = performance.now();
    if (!s.wasHidden && !s.wasPaused) s.activeMs += Math.max(0, now - s.lastTick);
    s.lastTick = now;
    s.wasHidden = document.hidden;
    s.wasPaused = pauses.size > 0;
  }
  /* R10: the game reports its pause sheet; that time is not active play. */
  function pause(reason = "sheet") { updateActiveTime(); pauses.add(String(reason)); if (currentSession) currentSession.wasPaused = true; }
  function resume(reason = "sheet") { updateActiveTime(); pauses.delete(String(reason)); if (currentSession) currentSession.wasPaused = pauses.size > 0; }

  function saveSnapshot() {
    if (!currentSession || !allowed()) return;
    updateActiveTime();
    const s = currentSession;
    storageSet(SESSION_KEY, JSON.stringify({ mode: s.mode, difficulty: s.difficulty, course: s.course, activeMs: Math.round(s.activeMs), hadError: !!s.hadError, savedAt: Date.now() }));
  }
  function startSnapshotTimer() {
    stopSnapshotTimer();
    try { snapshotTimer = setInterval(() => { if (!document.hidden) saveSnapshot(); }, 30000); } catch {}
  }
  function stopSnapshotTimer() { if (snapshotTimer) { clearInterval(snapshotTimer); snapshotTimer = null; } }

  /* R04: a session record belongs to the tab that wrote it. While that tab is
     alive (even suspended in the background) it holds its Web Lock, so the
     record is left alone. Only records whose tab is gone are reported, once,
     as interrupted. Without Web Locks, only records older than 12 hours are
     recovered. */
  function interruptedFrom(snap) {
    const saved = Number(snap.savedAt);
    return {
      props: {
        mode: snap.mode, result: "interrupted", active_seconds: roundSeconds(Number(snap.activeMs) / 1000),
        accuracy_band: "not_applicable", hint_band: "not_applicable", quit_band: "none", stars_band: "none",
        ...(typeof snap.hadError === "boolean" ? { had_error: snap.hadError ? 1 : 0 } : {}),   // unknown for older records (N06)
        difficulty: difficultyCode(snap.difficulty), course: courseCode(snap.course), display_mode: displayMode(),
      },
      at: Math.floor(saved / 3600000) * 3600000,
    };
  }
  async function recoverSessions() {
    const work = async () => {
      if (!allowed()) return;
      let alive = null;
      if (locks && typeof locks.query === "function") {
        try { const st = await locks.query(); alive = new Set((st.held || []).map(l => l.name)); } catch { alive = null; }
      }
      const keys = storageKeys().filter(k => k === LEGACY_SESSION_KEY || (k.startsWith(SESSION_PREFIX) && k !== SESSION_KEY));
      for (const key of keys) {
        const snap = readJSON(key, null);
        const tab = key.startsWith(SESSION_PREFIX) ? key.slice(SESSION_PREFIX.length) : null;
        if (!snap || typeof snap !== "object" || !V.mode.has(snap.mode)) { storageRemove(key); continue; }
        const saved = Number(snap.savedAt);
        if (!Number.isFinite(saved) || Date.now() - saved > 7 * 86400000) { storageRemove(key); continue; }
        if (tab && alive && alive.has("wordbar-tab-" + tab)) continue;                  // that tab is still alive
        if (tab && !alive && Date.now() - saved < NO_LOCKS_RECOVERY_AGE_MS) continue;    // no Web Locks: be cautious
        const { props, at } = interruptedFrom(snap);
        trackThen("session_end", props, () => storageRemove(key), at);   // the record goes only once the event is safe
      }
    };
    if (locks) { try { await locks.request("wordbar-recover", work); } catch {} } else await work();
  }

  function endInterruptedSession() { if (currentSession) endSession({ result: "interrupted" }, { urgent: true }); }

  function bindLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        saveSnapshot();
      } else {
        updateActiveTime();
        if (hiddenAt && Date.now() - hiddenAt >= RESUME_AS_NEW_OPEN_MS) { opened = false; initGameOpen(); }
        else checkRollover();
        hiddenAt = 0;
        flush();
      }
    });
    window.addEventListener("online", flush);
    window.addEventListener("pagehide", event => {
      if (event && event.persisted) { updateActiveTime(); if (currentSession) { currentSession.wasHidden = true; saveSnapshot(); } return; }
      endInterruptedSession();
    });
    window.addEventListener("pageshow", event => {
      if (event && event.persisted && currentSession) { currentSession.lastTick = performance.now(); currentSession.wasHidden = document.hidden; }
    });
    window.addEventListener("appinstalled", () => milestoneOnce("pwa_installed_when_detectable"));
  }
  /* Unexpected script errors from WordBar's own files, once per kind per visit.
     Registered as soon as this file loads; the inline <head> counter covers
     errors before that. No message, stack or address is ever sent. */
  try {
    const ownFile = file => !file || String(file).startsWith(location.origin);
    window.addEventListener("error", e => { if (e && ownFile(e.filename) && !(e.target && e.target !== window)) error("unexpected_error", "unknown"); });
    window.addEventListener("unhandledrejection", () => error("unexpected_error", "unknown"));
  } catch {}

  function stepState() { const s = readJSON(STEPS_KEY, null); return s && typeof s === "object" && s.on === true && Array.isArray(s.seen) ? s : null; }
  function step(name, extra = {}) {
    if (!allowed() || !V.step.has(name)) return;
    const s = stepState();
    if (!s || s.seen.includes(name)) return;
    s.seen.push(name);
    storageSet(STEPS_KEY, JSON.stringify(s));
    const c = cohortInfo().cohort;
    track("step", { step: name, ...extra, ...(c ? { cohort: c } : {}) });
  }
  function countStart() {
    const s = stepState();
    if (!s) return;
    s.starts = (Number(s.starts) || 0) + 1;
    storageSet(STEPS_KEY, JSON.stringify(s));
    if (s.starts === 1) step("first_game_started");
    if (s.starts === 2) step("second_game_started");
  }

  function startSession(mode, difficulty = "auto", course = "unknown") {
    if (!allowed()) return;
    bindLifecycle();
    if (currentSession) endSession({ result: "interrupted" });
    checkRollover();
    pauses.clear();
    currentSession = {
      mode, difficulty: difficultyCode(difficulty), course: courseCode(course),
      activeMs: 0, lastTick: performance.now(), wasHidden: document.hidden, wasPaused: false, hadError: false,
    };
    saveSnapshot();
    startSnapshotTimer();
    track("session_start", { mode, difficulty: currentSession.difficulty, course: currentSession.course, display_mode: displayMode(), time_band: timeBand(Date.now()) });
    countStart();
  }

  function accuracyBand(correct, total) {
    if (!total) return "not_applicable";
    const rate = 100 * correct / total;
    return rate < 40 ? "under_40" : rate < 60 ? "40_59" : rate < 80 ? "60_79" : "80_plus";
  }
  function hintBand(count) { return count <= 0 ? "0" : count === 1 ? "1" : "2_plus"; }
  function roundSeconds(seconds) { return Math.min(MAX_ACTIVE_SECONDS, Math.max(0, Math.round((Number(seconds) || 0) / 30) * 30)); }
  /* R12: where a child stopped, for quit sessions only.
     - progress known (finite run): from 75% of the real run size is "late"; this wins
       for very short runs
     - otherwise 3 or fewer questions answered is "early", the rest "middle"
     - open-ended modes (Rush, Kitchen) never have a "late"; past 3 questions they are "open_ended" */
  function quitBand(result, answers, progress) {
    if (result !== "quit") return "none";
    const p = Number(progress);
    if (progress != null && Number.isFinite(p) && p >= 0.75) return "late";
    if ((Number(answers) || 0) <= 3) return "early";
    return progress == null ? "open_ended" : "middle";
  }

  function endSession({ result = "completed", questions = 0, correct = 0, hints = 0, answers = null, progress = null, petPop = null, kinds = null } = {}, { urgent = false } = {}) {
    if (!currentSession) return;
    updateActiveTime();
    const session = currentSession;
    currentSession = null;
    stopSnapshotTimer();
    const pet = session.mode === "pet_pop";
    const props = {
      mode: session.mode,
      result,
      active_seconds: roundSeconds(session.activeMs / 1000),
      accuracy_band: pet ? "not_applicable" : accuracyBand(correct, questions),   // R07
      hint_band: pet ? "not_applicable" : hintBand(hints),
      quit_band: quitBand(result, answers == null ? questions : answers, progress),
      stars_band: "none",
      had_error: session.hadError ? 1 : 0,
      difficulty: session.difficulty,
      course: session.course,
      display_mode: displayMode(),
    };
    if (pet && petPop && typeof petPop === "object") props.stars_band = [1, 2, 3].includes(Number(petPop.stars)) ? String(Number(petPop.stars)) : "0";
    /* The session record is removed only once the terminal event is queued or accepted (R03, N02). */
    trackThen("session_end", props, () => storageRemove(SESSION_KEY), null, { urgent });
    /* Question-type accuracy: counts per kind for this session, never which question or answer. */
    if (kinds && typeof kinds === "object" && !pet) {
      const merged = new Map();
      for (const [kind, v] of Object.entries(kinds).slice(0, 40)) {
        const k = KINDS.has(kind) ? kind : "other", cur = merged.get(k) || [0, 0];
        cur[0] += Math.max(0, Math.round(Number(v && v[0]) || 0)); cur[1] += Math.max(0, Math.round(Number(v && v[1]) || 0));
        merged.set(k, cur);
      }
      for (const [kind, [t, c]] of merged) {
        const total = Math.min(500, t), right = Math.min(total, c);
        if (total > 0) track("question_mix", { kind, mode: session.mode, course: session.course, total, correct: right }, null, { urgent });
      }
    }
    if (result === "completed") step("first_game_finished");
    checkRollover();
  }

  /* ---- milestones ---- */
  function seen() { const s = readJSON(MILESTONE_KEY, []); return Array.isArray(s) ? s : []; }
  function milestone(name) { return track("milestone", { milestone: name }); }
  function milestoneOnce(name) {
    if (!allowed() || !V.milestone.has(name)) return Promise.resolve(false);
    const list = seen();
    if (list.includes(name)) return Promise.resolve(false);
    list.push(name);
    storageSet(MILESTONE_KEY, JSON.stringify(list.slice(-30)));
    return milestone(name);
  }
  function seedMilestones(names) {
    if (!allowed() || storageGet(SEEDED_KEY, "") === "1") return;
    const list = seen();
    (names || []).forEach(n => { if (V.milestone.has(n) && !list.includes(n)) list.push(n); });
    storageSet(MILESTONE_KEY, JSON.stringify(list.slice(-30)));
    storageSet(SEEDED_KEY, "1");
  }
  function noteMilestones(names) {
    if (!allowed() || storageGet(SEEDED_KEY, "") !== "1") return;
    (names || []).forEach(n => milestoneOnce(n));
  }
  function setFeatureProvider(fn) { featureProvider = typeof fn === "function" ? fn : null; }

  function faq() { return Promise.resolve(false); }   /* kept for older callers; FAQ use is tracked on the website */

  function error(error_code, area = "unknown") {
    const code = V.error_code.has(error_code) ? error_code : "unexpected_error";
    const where = V.area.has(area) ? area : "unknown";
    if (currentSession && !currentSession.hadError) { currentSession.hadError = true; saveSnapshot(); }   // N06
    const key = code + "|" + where;
    if (reportedErrors.has(key)) return Promise.resolve(false);
    reportedErrors.add(key);
    return track("error", { error_code: code, area: where, display_mode: displayMode() });
  }

  return {
    consentStatus, setConsent, initGameOpen, startSession, endSession, pause, resume,
    milestone, milestoneOnce, seedMilestones, noteMilestones, setFeatureProvider, step,
    faq, error, track, flush, displayMode,
  };
})();
