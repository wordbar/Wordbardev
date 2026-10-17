/* ============================================================
   DATA LOADER — tiered fetch so the game is playable almost
   instantly. "easy" loads first (blocking the boot screen only
   briefly); "core" and "stretch" stream in afterwards while the
   player is already serving their first customer.

   As of this build the word banks ship as masked binaries
   (data/wordbank-<tier>.wbdata) rather than plain .json, so that
   opening the file directly — devtools Network tab, pasting the
   URL, or poking at the service-worker cache — shows binary noise
   instead of the whole question bank.

   >>> READ THIS BEFORE TRUSTING IT <<<
   This is OBFUSCATION, NOT SECURITY. The unmasking key is a few
   lines below, inside the file the browser downloads. It has to
   be: the game must read its own data offline, with no server.
   Anyone who opens devtools and reads this function recovers the
   full word bank in minutes. It stops casual copying and dumb
   "grab every .json" scrapers. It stops nothing else. Do not
   build any product decision on top of it being private.

   Files are produced by tools/build-wbdata.mjs. The masking
   constants and the keystream below must stay byte-identical to
   that script or every deployed word bank becomes garbage.
   ============================================================ */
"use strict";

const BUILTIN_WORDS = [];
const QBANK = {};                 // word -> type -> [{text,ans,d:[3],explain}]
const ODD_ONE_OUT = [];
const ANALOGIES = [];             // word_pair
const RHYMES = [];
const LADDERS = [];
const HOMOPHONES = [];

const DataStatus = { easy:false, core:false, stretch:false };

/* Phase 3: the legacy globals remain the byte-compatible 11+ adapter, while
   Everyday loads into its own store and is selected only through the active
   profile's permanent courseId. */
const WORDBAR_FEATURES = Object.freeze({ everydayEnglish:true });
const COURSE_IDS = Object.freeze({ elevenPlus:"elevenPlus", everyday:"everyday" });
const COURSE_PACKS = Object.freeze({
  elevenPlus:Object.freeze({
    id:COURSE_IDS.elevenPlus,packVersion:"86g",baseUrl:"./data/",
    manifestUrl:"./data/manifest.json",
    manifestSha256:"7029925243dbb7933b49eb2e7f004e274f27775e9ed71ca9aaff7939d5e120b1"
  }),
  everyday:Object.freeze({
    id:COURSE_IDS.everyday,packVersion:"v1",baseUrl:"./data/everyday/v1/",
    manifestUrl:"./data/everyday/v1/manifest.json",
    manifestSha256:"6e73856b60a035e299767287af64a3c1909ee8b2ad6c32ed4282f1fb78252621"
  })
});

/* Phase 6: app-shell lifetime and course-data lifetime are deliberately
   separate. Only a manifest-verified, fully downloaded course version is
   recorded as current. Candidate bytes may exist in their versioned cache,
   but are never an offline authority until all three tiers pass. */
const COURSE_DATA_CACHE_PREFIX="wordbar-course-data-";
const COURSE_DATA_META_CACHE="wordbar-course-data-meta-v1";
const COURSE_DATA_META_PATH="./__wordbar_course_cache__/";

/* One course configuration is the authority for course-facing engine/UI
   behaviour. Later phases extend the same records for Kraken, learning
   surfaces, Kitchen and cache activation instead of scattering course tests. */
const EVERYDAY_CAFE_TYPES=Object.freeze([
  Object.freeze({id:"cloze",weight:0.90}),
  Object.freeze({id:"definition",weight:1.10}),
  Object.freeze({id:"category",weight:1.05}),
  Object.freeze({id:"collocation",weight:1.15}),
  Object.freeze({id:"third_person",weight:1.15}),
  Object.freeze({id:"past_tense",weight:1.15}),
  Object.freeze({id:"opposite",weight:1.05}),
  Object.freeze({id:"negative",weight:1.15}),
  Object.freeze({id:"scramble",weight:0.95}),
  Object.freeze({id:"question_form",weight:1.15}),
  Object.freeze({id:"phrasal",weight:1.10}),
  Object.freeze({id:"there_is",weight:1.10}),
  Object.freeze({id:"comparative",weight:1.10}),
  Object.freeze({id:"word_order",weight:1.15}),
  Object.freeze({id:"spelling",weight:0.95}),
  Object.freeze({id:"usage",weight:1.05}),
  Object.freeze({id:"quantifier",weight:1.10}),
  Object.freeze({id:"plural",weight:1.05}),
  Object.freeze({id:"article",weight:1.00}),
  Object.freeze({id:"preposition",weight:1.00})
]);
/* Phase 5 Kitchen registry. Each entry owns the authored source type, the
   durable statistics key and its course-facing label. The two answer=headword
   guards are data rules, not UI guesses. 11+ keeps Build 86g's exact rule:
   Synonym and Antonym are available in Scramble only. */
const ELEVEN_PLUS_KITCHEN_TYPES=Object.freeze([
  Object.freeze({type:"cloze",kind:"cloze",label:"Complete the sentence",statsLabel:"Cloze",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"definition",kind:"def",label:"Definition",statsLabel:"Definition",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"word_form",kind:"form",label:"Word form",statsLabel:"Word form",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"synonym",kind:"syn",label:"Similar meaning",statsLabel:"Synonym",modes:Object.freeze(["scramble"])}),
  Object.freeze({type:"antonym",kind:"ant",label:"Opposite meaning",statsLabel:"Antonym",modes:Object.freeze(["scramble"])})
]);
const EVERYDAY_KITCHEN_TYPES=Object.freeze([
  Object.freeze({type:"cloze",kind:"cloze",label:"Complete the sentence",statsLabel:"Cloze",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"definition",kind:"definition",label:"Definition",statsLabel:"Definition",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"category",kind:"category",label:"Category clue",statsLabel:"Category",answerMustEqualHeadword:true,modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"opposite",kind:"opposite",label:"Opposite meaning",statsLabel:"Opposite",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"comparative",kind:"comparative",label:"Comparative form",statsLabel:"Comparative",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"past_tense",kind:"past_tense",label:"Past tense",statsLabel:"Past tense",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"plural",kind:"plural",label:"Plural form",statsLabel:"Plural",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"third_person",kind:"third_person",label:"He / she / it form",statsLabel:"Third person",modes:Object.freeze(["conveyor","scramble","path"])}),
  Object.freeze({type:"preposition",kind:"preposition",label:"Preposition",statsLabel:"Preposition",answerMustEqualHeadword:true,modes:Object.freeze(["conveyor","scramble","path"])})
]);
const ELEVEN_PLUS_KRAKEN=Object.freeze([
  Object.freeze({id:"elevenPlus.kraken.1",count:1,emoji:"🌱",title:"Word Newbie"}),
  Object.freeze({id:"elevenPlus.kraken.15",count:15,emoji:"🔤",title:"Vibe Speller"}),
  Object.freeze({id:"elevenPlus.kraken.40",count:40,emoji:"📖",title:"Lore Keeper"}),
  Object.freeze({id:"elevenPlus.kraken.90",count:90,emoji:"🤓",title:"Certified Word Nerd"}),
  Object.freeze({id:"elevenPlus.kraken.160",count:160,emoji:"⚡",title:"Lexicon Legend"}),
  Object.freeze({id:"elevenPlus.kraken.250",count:250,emoji:"🧠",title:"Big Brain Energy"}),
  Object.freeze({id:"elevenPlus.kraken.360",count:360,emoji:"👑",title:"Word Royalty"}),
  Object.freeze({id:"elevenPlus.kraken.480",count:480,emoji:"👻",title:"Vocab Cryptid"}),
  Object.freeze({id:"elevenPlus.kraken.600",count:600,emoji:"🐲",title:"Dictionary Dragon"}),
  Object.freeze({id:"elevenPlus.kraken.730",count:730,emoji:"🐙",title:"THE WORD KRAKEN"}),
  Object.freeze({id:"elevenPlus.kraken.799",count:799,emoji:"🌌",title:"???",secret:true})
]);
const EVERYDAY_KRAKEN=Object.freeze([
  Object.freeze({id:"everyday.kraken.1",count:1,emoji:"🌱",title:"First Word"}),
  Object.freeze({id:"everyday.kraken.25",count:25,emoji:"💬",title:"Everyday Starter"}),
  Object.freeze({id:"everyday.kraken.75",count:75,emoji:"🫖",title:"Conversation Builder"}),
  Object.freeze({id:"everyday.kraken.150",count:150,emoji:"🧭",title:"Daily Life Learner"}),
  Object.freeze({id:"everyday.kraken.300",count:300,emoji:"🧩",title:"Phrase Finder"}),
  Object.freeze({id:"everyday.kraken.500",count:500,emoji:"🌍",title:"English Explorer"}),
  Object.freeze({id:"everyday.kraken.750",count:750,emoji:"✨",title:"Fluent Thinker"}),
  Object.freeze({id:"everyday.kraken.1000",count:1000,emoji:"🧠",title:"Language Navigator"}),
  Object.freeze({id:"everyday.kraken.1200",count:1200,emoji:"🏅",title:"Everyday Expert"}),
  Object.freeze({id:"everyday.kraken.1400",count:1400,emoji:"👑",title:"English Champion"}),
  Object.freeze({id:"everyday.kraken.1471",count:1471,emoji:"🐙",title:"???",secret:true})
]);
const COURSES=Object.freeze({
  elevenPlus:Object.freeze({
    id:COURSE_IDS.elevenPlus,displayName:"11+ Vocabulary",shortName:"11+",icon:"📚",
    description:"Build strong vocabulary for 11+ practice.",
    tierLabels:Object.freeze({easy:"Easy",core:"Core",stretch:"Stretch"}),
    cafe:Object.freeze({types:null,generatedSpelling:true,
      patience:Object.freeze({regular:20,vip:17,secret:23,review:32}),
      releaseWindow:null,speech:"headword"}),
    learning:Object.freeze({kraken:ELEVEN_PLUS_KRAKEN,
      achievementPolicy:Object.freeze({excludeCategories:Object.freeze([]),excludeIds:Object.freeze([])})}),
    kitchen:Object.freeze({types:ELEVEN_PLUS_KITCHEN_TYPES}),
    surfaces:Object.freeze({learning:true,kitchen:true})
  }),
  everyday:Object.freeze({
    id:COURSE_IDS.everyday,displayName:"Everyday English",shortName:"Everyday",icon:"💬",
    description:"Practise useful English for daily life.",
    tierLabels:Object.freeze({easy:"First Words",core:"Everyday",stretch:"Wider"}),
    cafe:Object.freeze({types:EVERYDAY_CAFE_TYPES,generatedSpelling:false,
      patience:Object.freeze({compact:28,sentence:40,vipAdjust:-3,secretAdjust:3,reviewAdjust:5}),
      /* phase10: null, matching 11+ — the whole bank is available from
         session one and difficulty comes from the Settings tier weights. */
      releaseWindow:null,speech:"answer"}),
    learning:Object.freeze({kraken:EVERYDAY_KRAKEN,
      /* Shared Café/return/fun trophies remain useful in both courses. The
         legacy 11+-only skill, ladder and Kitchen trophies are excluded and
         replaced by namespaced Everyday learning trophies in Phase 4. */
      achievementPolicy:Object.freeze({excludeCategories:Object.freeze(["skill","kitchen"]),
        excludeIds:Object.freeze(["ladder_5","ladder_15","ladder_30"])})}),
    kitchen:Object.freeze({types:EVERYDAY_KITCHEN_TYPES}),
    surfaces:Object.freeze({learning:true,kitchen:true})
  })
});

function _freshLoadStatus(disabled){
  return {
    state:disabled?"disabled":"idle", generation:0, active:false,
    tiers:{easy:"idle",core:"idle",stretch:"idle"},
    error:null, lastBaseUrl:null
  };
}
function _freshCourseStore(id, packVersion, disabled){
  return {
    id, packVersion, words:[], qbank:{}, oddOneOut:[], analogies:[],
    rhymes:[], ladders:[], homophones:[], questionRows:[], questionById:{},
    dataStatus:{easy:false,core:false,stretch:false},
    loading:_freshLoadStatus(disabled)
  };
}

const CourseData = {
  elevenPlus:{
    id:COURSE_IDS.elevenPlus, packVersion:COURSE_PACKS.elevenPlus.packVersion,
    words:BUILTIN_WORDS, qbank:QBANK, oddOneOut:ODD_ONE_OUT,
    analogies:ANALOGIES, rhymes:RHYMES, ladders:LADDERS,
    homophones:HOMOPHONES, questionRows:[], questionById:{}, dataStatus:DataStatus,
    loading:_freshLoadStatus(false)
  },
  everyday:_freshCourseStore(
    COURSE_IDS.everyday, COURSE_PACKS.everyday.packVersion,
    !WORDBAR_FEATURES.everydayEnglish
  )
};

class CourseDataLoadError extends Error{
  constructor(code,courseId,tier,message,cause){
    super(message); this.name="CourseDataLoadError"; this.code=code;
    this.courseId=courseId; this.tier=tier||null;
    if(cause!==undefined)this.cause=cause;
  }
}

let _courseLoadGeneration=0, _activeCourseLoad=null;

function courseDataFor(courseId){
  const store=Object.prototype.hasOwnProperty.call(CourseData,courseId)?CourseData[courseId]:null;
  if(!store) throw new CourseDataLoadError(
    "UNKNOWN_COURSE",courseId,null,`Unknown course: ${courseId}`
  );
  return store;
}

function getCourseLoadStatus(courseId){
  const status=courseDataFor(courseId).loading;
  return {
    state:status.state, generation:status.generation, active:status.active,
    tiers:{...status.tiers}, error:status.error?{...status.error}:null,
    lastBaseUrl:status.lastBaseUrl
  };
}

function _makeAbortController(){
  if(typeof AbortController!=="undefined")return new AbortController();
  const signal={aborted:false};
  return {signal,abort(){signal.aborted=true;}};
}

function _abortError(courseId,tier){
  const err=new CourseDataLoadError(
    "LOAD_ABORTED",courseId,tier,`${courseId} ${tier||"course"} load was superseded`
  );
  err.name="AbortError";
  return err;
}

function _assertCurrentLoad(context,tier){
  if(!context || context.signal.aborted || _activeCourseLoad!==context ||
     context.generation!==_courseLoadGeneration){
    throw _abortError(context&&context.courseId,tier);
  }
}

function cancelCourseDataLoad(){
  if(!_activeCourseLoad)return;
  const context=_activeCourseLoad, store=CourseData[context.courseId];
  context.controller.abort();
  if(store && store.loading.generation===context.generation){
    store.loading.active=false;
    if(store.loading.state==="loading")store.loading.state="idle";
  }
  _activeCourseLoad=null;
}

/* key fragment 1 of 3 — assembled in _wbSeed() */
const _WB_F1 = ["cr3ma", "-wb-"];

function _expandWord(row, tier){ return {id:row[0], w:row[0], t:tier, def:row[2], pos:row[3]}; }
function _expandQ(row){ return {text:row[0], ans:row[1], d:[row[2],row[3],row[4]], explain:row[5]}; }
function _expandCourseWord(row,tier,courseId){
  if(courseId===COURSE_IDS.elevenPlus)return _expandWord(row,tier);
  return {id:row[0],w:row[0],t:tier,def:row[2],pos:row[3],
    releaseOrder:row[4],theme:row[5],depth:row[6]};
}
function _expandCourseQ(row,courseId){
  const question=_expandQ(row);
  if(courseId!==COURSE_IDS.elevenPlus){
    question.id=row[6]; question.layout=row[7]; question.speechText=row[8];
    question.masteryCredit=row[9]; question.skillKey=row[10]||null;
  }
  return question;
}

function _validatePayload(payload,courseId,tier){
  if(!payload || !Array.isArray(payload.words) || !payload.qbank ||
     typeof payload.qbank!=="object"){
    throw new CourseDataLoadError(
      "INVALID_PACK",courseId,tier,`${courseId} ${tier} word bank has an invalid schema`
    );
  }
  for(const key of ["odd","wordpair","rhyme","ladder","homo"]){
    if(!Array.isArray(payload[key])){
      throw new CourseDataLoadError(
        "INVALID_PACK",courseId,tier,`${courseId} ${tier} word bank is missing ${key}`
      );
    }
  }
  if(courseId===COURSE_IDS.everyday){
    for(const [wid,types] of Object.entries(payload.qbank)){
      if(!types||typeof types!=="object")throw new CourseDataLoadError(
        "INVALID_PACK",courseId,tier,`${courseId} ${tier} has invalid questions for ${wid}`
      );
      for(const [type,rows] of Object.entries(types)){
        if(!EVERYDAY_CAFE_TYPES.some(entry=>entry.id===type)||!Array.isArray(rows)){
          throw new CourseDataLoadError(
            "INVALID_PACK",courseId,tier,`${courseId} ${tier} has an unknown question type: ${type}`
          );
        }
        for(const row of rows){
          const options=row&&[row[1],row[2],row[3],row[4]];
          if(!Array.isArray(row)||row.length<11||!row[6]||
             !["compact","sentence"].includes(row[7])||!row[8]||
             !["word","skill"].includes(row[9])||
             (row[9]==="skill"&&(!row[10]||!EVERYDAY_CAFE_TYPES.some(entry=>entry.id===row[10])))||
             !options.every(value=>typeof value==="string"&&value.trim())||
             new Set(options).size!==4){
            throw new CourseDataLoadError(
              "INVALID_PACK",courseId,tier,`${courseId} ${tier} has an invalid ${type} question for ${wid}`
            );
          }
        }
      }
    }
  }
}

function _mergeTierIntoStore(store,tier,payload){
  _validatePayload(payload,store.id,tier);
  payload.words.forEach(row=>store.words.push(_expandCourseWord(row,tier,store.id)));
  Object.entries(payload.qbank).forEach(([wid, types])=>{
    store.qbank[wid] = store.qbank[wid] || {};
    Object.entries(types).forEach(([type, rows])=>{
      const expanded=rows.map(row=>_expandCourseQ(row,store.id));
      store.qbank[wid][type] = expanded;
      if(store.id===COURSE_IDS.everyday){
        expanded.forEach(question=>{
          if(Object.prototype.hasOwnProperty.call(store.questionById,question.id)){
            throw new CourseDataLoadError(
              "INVALID_PACK",store.id,tier,`Duplicate Everyday question ID: ${question.id}`
            );
          }
          const record={id:question.id,wid,type,tier,question};
          store.questionRows.push(record);store.questionById[question.id]=record;
        });
      }
    });
  });
  payload.odd.forEach(r=>store.oddOneOut.push({id:r[0], t:tier, words:[r[1],r[2],r[3],r[4]], odd:r[5], why:r[6]}));
  payload.wordpair.forEach(r=>store.analogies.push({id:r[0], t:tier, text:r[1], ans:r[2], d:[r[3],r[4],r[5]], why:r[6]}));
  payload.rhyme.forEach(r=>store.rhymes.push({id:r[0], t:tier, text:r[1], say:r[2]||null, ans:r[3], d:[r[4],r[5],r[6]], why:r[7]}));
  payload.ladder.forEach(r=>store.ladders.push({id:r[0], t:tier, start:r[1], end:r[2], path:r[3]}));
  payload.homo.forEach(r=>store.homophones.push({id:r[0], t:tier, text:r[1], say:r[2], ans:r[3], d:[r[4],r[5],r[6]], why:r[7]}));
  store.dataStatus[tier] = true;
}

function _mergeTier(tier,payload){
  _mergeTierIntoStore(CourseData.elevenPlus,tier,payload);
}

/* key fragment 2 of 3 */
const _WB_F2 = ["st34m", "brew"];

/* Modern browsers gunzip natively; the masked .wbdata is a gzip
   stream underneath. Anything older (Safari < 16.4, Firefox < 113)
   falls back to the uncompressed .raw.wbdata twin, which is larger
   on the wire but needs no decompression at all. */
const _WB_CAN_GUNZIP = (typeof DecompressionStream !== "undefined");

function _wbSeed(tier){
  const s = _WB_F1.concat(_WB_F2, _WB_F3).join("") + "|" + tier;
  let h = 0x811c9dc5;                                   // FNV-1a basis
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/* xorshift32 keystream, XORed byte by byte. Self-inverse — the same
   call masks and unmasks. A single pass over bytes we have already
   downloaded: a few milliseconds for the largest tier, once at
   startup. Nothing per-question touches this. */
function _wbUnmask(bytes, tier){
  let x = _wbSeed(tier) || 0x1a2b3c4d;
  for(let i=0;i<bytes.length;i++){
    x ^= (x << 13); x >>>= 0;
    x ^= (x >>> 17);
    x ^= (x << 5);  x >>>= 0;
    bytes[i] ^= (x ^ (x >>> 24)) & 0xff;
  }
  return bytes;
}

/* key fragment 3 of 3 */
const _WB_F3 = ["l4tte", "-86-"];

async function _wbDecode(buffer, tier){
  const bytes = _wbUnmask(new Uint8Array(buffer), tier);
  if(!_WB_CAN_GUNZIP){
    return JSON.parse(new TextDecoder("utf-8").decode(bytes));
  }
  const gunzipped = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(gunzipped).text());
}

function _courseCacheName(courseId,packVersion){
  return `${COURSE_DATA_CACHE_PREFIX}${String(courseId).replace(/[^a-z0-9_-]/gi,"-")}-${String(packVersion).replace(/[^a-z0-9_.-]/gi,"-")}`;
}
function _cacheAvailable(){return typeof caches!=="undefined"&&typeof Response!=="undefined";}
function _bufferCopy(buffer){return buffer.slice(0);}
async function _sha256Hex(buffer){
  if(typeof crypto==="undefined"||!crypto.subtle||typeof crypto.subtle.digest!=="function"){
    throw new CourseDataLoadError("HASH_UNAVAILABLE",null,null,"This browser cannot verify WordBar course data");
  }
  const digest=await crypto.subtle.digest("SHA-256",buffer);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function _assertSha256(buffer,expected,courseId,tier){
  const actual=await _sha256Hex(buffer);
  if(actual!==expected)throw new CourseDataLoadError(
    "PACK_HASH_MISMATCH",courseId,tier,
    `${courseId} ${tier||"manifest"} failed its integrity check`
  );
}
async function _cacheRead(cacheName,url){
  if(!_cacheAvailable())return null;
  const response=await (await caches.open(cacheName)).match(url);
  return response&&response.ok!==false?await response.arrayBuffer():null;
}
async function _cacheWrite(cacheName,url,buffer,contentType){
  if(!_cacheAvailable())return false;
  try{
    const cache=await caches.open(cacheName);
    await cache.put(url,new Response(_bufferCopy(buffer),{headers:{"Content-Type":contentType||"application/octet-stream"}}));
    return true;
  }catch(_){return false;}
}
async function _readCourseCacheMeta(courseId){
  try{
    const buffer=await _cacheRead(COURSE_DATA_META_CACHE,`${COURSE_DATA_META_PATH}${courseId}.json`);
    if(!buffer)return null;
    const value=JSON.parse(new TextDecoder("utf-8").decode(buffer));
    return value&&value.schemaVersion===1&&value.courseId===courseId?value:null;
  }catch(_){return null;}
}
async function _writeCourseCacheMeta(meta){
  if(!_cacheAvailable())return false;
  const bytes=new TextEncoder().encode(JSON.stringify(meta));
  return _cacheWrite(COURSE_DATA_META_CACHE,`${COURSE_DATA_META_PATH}${meta.courseId}.json`,bytes.buffer,"application/json");
}
function _manifestPack(manifest,tier){
  const pack=manifest&&manifest.packs&&manifest.packs[tier];
  return pack&&pack[_WB_CAN_GUNZIP?"compressed":"raw"];
}
function _questionCount(payload){
  return Object.values(payload.qbank).reduce((total,types)=>
    total+Object.values(types).reduce((subtotal,rows)=>subtotal+rows.length,0),0);
}
function _validateManifest(manifest,expectedCourseId,expectedVersion){
  if(!manifest||manifest.schemaVersion!==1||manifest.courseId!==expectedCourseId||
     manifest.packVersion!==expectedVersion||!manifest.packs||!manifest.countsByTier){
    throw new CourseDataLoadError("INVALID_MANIFEST",expectedCourseId,null,
      `${expectedCourseId} course manifest is invalid`);
  }
  for(const tier of ["easy","core","stretch"]){
    const counts=manifest.countsByTier[tier],variant=_manifestPack(manifest,tier);
    if(!counts||!Number.isInteger(counts.words)||!Number.isInteger(counts.questions)||
       !variant||typeof variant.file!=="string"||!Number.isInteger(variant.bytes)||
       !/^[a-f0-9]{64}$/.test(variant.sha256||"")){
      throw new CourseDataLoadError("INVALID_MANIFEST",expectedCourseId,tier,
        `${expectedCourseId} ${tier} manifest entry is invalid`);
    }
  }
  return manifest;
}
function _validatePackPayload(payload,source,tier,byteLength){
  _validatePayload(payload,source.courseId,tier);
  const counts=source.manifest.countsByTier[tier],variant=_manifestPack(source.manifest,tier);
  if(byteLength!==variant.bytes||payload.words.length!==counts.words||
     _questionCount(payload)!==counts.questions||
     payload.words.some(row=>!Array.isArray(row)||row[1]!==tier)){
    throw new CourseDataLoadError("PACK_COUNT_MISMATCH",source.courseId,tier,
      `${source.courseId} ${tier} word bank failed schema, tier or count validation`);
  }
}
/* Build 86g-phase9: fetch() has no built-in timeout. A request that stalls
   after connecting — common on flaky mobile networks and behind a CDN edge —
   never resolves and never rejects, so the retry loop below never runs and the
   loading screen waits forever. Every network read is now bounded: on timeout
   the request is aborted and a NON-AbortError is thrown, so the caller's retry
   and CacheStorage fallback both engage normally. A genuine generation abort
   from the parent signal still surfaces as AbortError and still stops the load. */
const _NETWORK_TIMEOUT_MS=12000;
const _MANIFEST_TIMEOUT_MS=10000;
function _linkedAbortController(parentSignal){
  const controller=_makeAbortController();
  if(parentSignal){
    if(parentSignal.aborted){try{controller.abort();}catch(_){}}
    else if(typeof parentSignal.addEventListener==="function"){
      try{parentSignal.addEventListener("abort",()=>{try{controller.abort();}catch(_){}},{once:true});}catch(_){}
    }
  }
  return controller;
}
async function _networkBytes(url,signal,timeoutMs){
  const limit=Number.isFinite(timeoutMs)?timeoutMs:_NETWORK_TIMEOUT_MS;
  const controller=_linkedAbortController(signal);
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;try{controller.abort();}catch(_){}},limit);
  try{
    const response=await fetch(url,{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
    return await response.arrayBuffer();
  }catch(error){
    if(timedOut){
      const timeout=new Error(`${url} timed out after ${limit}ms`);
      timeout.code="NETWORK_TIMEOUT";
      throw timeout;
    }
    throw error;
  }finally{clearTimeout(timer);}
}
async function _manifestSourceFromRecord(courseId,record){
  if(!record||!record.packVersion||!record.baseUrl||!record.manifestUrl||!record.manifestSha256)return null;
  const cacheName=_courseCacheName(courseId,record.packVersion);
  const buffer=await _cacheRead(cacheName,record.manifestUrl);
  if(!buffer)return null;
  await _assertSha256(buffer,record.manifestSha256,courseId,null);
  const manifest=_validateManifest(JSON.parse(new TextDecoder("utf-8").decode(buffer)),courseId,record.packVersion);
  return {courseId,packVersion:record.packVersion,baseUrl:record.baseUrl,
    manifestUrl:record.manifestUrl,manifestSha256:record.manifestSha256,
    manifest,cacheName,cachedOnly:true};
}
/* Build 86g-phase9: a source whose baseUrl contains its own packVersion is
   content-addressed — new content is published under a new directory and a new
   URL, and _headers marks it immutable. Re-downloading it on every boot costs
   a full pack transfer and is one more chance to stall, so verified cached
   bytes are preferred for these. The SHA-256 check below still runs on
   whatever bytes are used, so a corrupted cache entry cannot be trusted.
   The 11+ pack lives at an unversioned ./data/ path and stays network-first. */
function _isVersionPinnedSource(source){
  return !!(source&&source.packVersion&&source.baseUrl&&
    String(source.baseUrl).indexOf("/"+source.packVersion+"/")!==-1);
}
async function _preferredManifestSource(context,options){
  const configured=COURSE_PACKS[context.courseId];
  const baseUrl=options.baseUrl||configured.baseUrl;
  const manifestUrl=options.manifestUrl||`${baseUrl}manifest.json`;
  const manifestSha256=options.manifestSha256||configured.manifestSha256;
  const cacheName=_courseCacheName(context.courseId,configured.packVersion);
  const pinned=_isVersionPinnedSource({packVersion:configured.packVersion,baseUrl});
  let buffer=null,fromCache=false;
  if(pinned){
    try{buffer=await _cacheRead(cacheName,manifestUrl);fromCache=!!buffer;}catch(_){buffer=null;fromCache=false;}
  }
  if(!buffer)buffer=await _networkBytes(manifestUrl,context.signal,_MANIFEST_TIMEOUT_MS);
  _assertCurrentLoad(context,null);
  await _assertSha256(buffer,manifestSha256,context.courseId,null);
  const manifest=_validateManifest(JSON.parse(new TextDecoder("utf-8").decode(buffer)),context.courseId,configured.packVersion);
  /* manifestFromCache records that this open needed no network for the
     manifest. Combined with all three tiers coming from cache it means the
     course is genuinely offline-ready, which is what promotes
     offlineReadyVersion — previously only the cachedOnly path could do that. */
  const source={courseId:context.courseId,packVersion:configured.packVersion,baseUrl,
    manifestUrl,manifestSha256,manifest,cacheName,cachedOnly:false,manifestFromCache:fromCache};
  if(!fromCache)await _cacheWrite(source.cacheName,manifestUrl,buffer,"application/json");
  return source;
}
async function _currentCachedSource(courseId){
  const meta=await _readCourseCacheMeta(courseId);
  const record=meta&&meta.current&&meta.versions&&meta.versions[meta.current];
  const source=await _manifestSourceFromRecord(courseId,record);
  if(source)source.meta=meta;
  return source;
}
async function _activateCourseSource(source,offlineRestart){
  if(!_cacheAvailable())return;
  const old=await _readCourseCacheMeta(source.courseId);
  const versions={...(old&&old.versions||{})};
  versions[source.packVersion]={packVersion:source.packVersion,baseUrl:source.baseUrl,
    manifestUrl:source.manifestUrl,manifestSha256:source.manifestSha256,
    cacheName:source.cacheName,verifiedAt:new Date().toISOString()};
  let current=old&&old.current||null,previous=old&&old.previous||null;
  let offlineReadyVersion=old&&old.offlineReadyVersion||null;
  if(current!==source.packVersion){
    previous=current;current=source.packVersion;offlineReadyVersion=null;
  }else if(offlineRestart){offlineReadyVersion=current;}
  const meta={schemaVersion:1,courseId:source.courseId,current,previous,offlineReadyVersion,versions};
  await _writeCourseCacheMeta(meta);
  /* A newly activated version keeps all older verified caches until it has
     itself completed an offline restart. Afterwards retain current+previous. */
  if(offlineReadyVersion===current){
    const keep=new Set([current,previous].filter(Boolean));
    for(const [version,record] of Object.entries(versions)){
      if(keep.has(version))continue;
      if(record.cacheName)await caches.delete(record.cacheName);
      delete versions[version];
    }
    await _writeCourseCacheMeta({...meta,versions});
  }
}

/* Returns a promise that resolves once "easy" is loaded — that's
   enough for session 0 (onboarding is easy-only anyway). Core and
   stretch are kicked off in parallel but not awaited by the
   caller; they attach to BUILTIN_WORDS etc as soon as they land. */
/* Build 86g-phase9: core and stretch download in parallel and were merged in
   whichever order they happened to finish. _mergeTierIntoStore only appends,
   so the order of BUILTIN_WORDS/QBANK — and therefore the order words are
   offered in — depended on a network race and varied between loads. Tiers now
   download in parallel but merge in a fixed easy → core → stretch order, so
   the decoded store is byte-identical on every load. */
const _TIER_MERGE_ORDER=["easy","core","stretch"];
function _releaseTierMergeGate(context,tier){
  if(context&&context.mergeSignals&&context.mergeSignals[tier]){
    const signal=context.mergeSignals[tier];
    context.mergeSignals[tier]=null;
    signal();
  }
}
async function _awaitTierMergeTurn(context,tier){
  if(!context||!context.mergeReady)return;
  const index=_TIER_MERGE_ORDER.indexOf(tier);
  if(index<=0)return;
  const previous=context.mergeReady[_TIER_MERGE_ORDER[index-1]];
  if(previous)await previous;
}
async function _fetchTierForCourse(context,source,tier,retries=2){
  const store=courseDataFor(context.courseId);
  if(store.dataStatus[tier]){
    store.loading.tiers[tier]="loaded";
    _releaseTierMergeGate(context,tier);
    return;
  }
  const pack=_manifestPack(source.manifest,tier);
  const url=source.baseUrl+pack.file;
  let lastErr;
  store.loading.tiers[tier]="loading";
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      _assertCurrentLoad(context,tier);
      let buffer=null,fromCache=source.cachedOnly;
      if(!source.cachedOnly&&_isVersionPinnedSource(source)){
        try{buffer=await _cacheRead(source.cacheName,url);fromCache=!!buffer;}catch(_){buffer=null;fromCache=false;}
      }
      if(!buffer&&!source.cachedOnly){
        fromCache=false;
        try{buffer=await _networkBytes(url,context.signal);}catch(error){lastErr=error;}
      }
      if(!buffer){buffer=await _cacheRead(source.cacheName,url);fromCache=true;}
      if(!buffer)throw lastErr||new Error(`${tier} word bank is not cached`);
      await _assertSha256(buffer,pack.sha256,context.courseId,tier);
      const payload=await _wbDecode(_bufferCopy(buffer),tier);
      _validatePackPayload(payload,source,tier,buffer.byteLength);
      /* fetch() may be supplied by an older browser/polyfill that ignores
         AbortSignal, so verify the generation again immediately before merge. */
      _assertCurrentLoad(context,tier);
      if(!fromCache)await _cacheWrite(source.cacheName,url,buffer,"application/octet-stream");
      /* Wait for the preceding tier to merge so append order is fixed. */
      await _awaitTierMergeTurn(context,tier);
      _assertCurrentLoad(context,tier);
      _mergeTierIntoStore(store,tier,payload);
      _releaseTierMergeGate(context,tier);
      context.verifiedTiers.add(tier);
      if(fromCache)context.loadedFromCache.add(tier);
      store.loading.tiers[tier]="loaded";
      return;
    }catch(err){
      if(err&&err.name==="AbortError"){_releaseTierMergeGate(context,tier);throw err;}
      lastErr=err;
      if(attempt<retries){
        await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
        _assertCurrentLoad(context,tier);
      }
    }
  }
  store.loading.tiers[tier]="error";
  /* A tier that gives up must still open the gate, or the next tier would
     wait on it forever. */
  _releaseTierMergeGate(context,tier);
  throw new CourseDataLoadError(
    "PACK_LOAD_FAILED",context.courseId,tier,
    `${context.courseId} ${tier} word bank failed to load`,lastErr
  );
}

/* Compatibility name retained for tests/tools that exercise the original
   tier fetcher directly. It participates in the same generation guard. */
function _fetchTier(baseUrl,tier,retries=2){
  if(!_activeCourseLoad || _activeCourseLoad.courseId!==COURSE_IDS.elevenPlus){
    const controller=_makeAbortController();
    _activeCourseLoad={courseId:COURSE_IDS.elevenPlus,
      generation:++_courseLoadGeneration,controller,signal:controller.signal};
  }
  const configured=COURSE_PACKS[COURSE_IDS.elevenPlus];
  return _preferredManifestSource(_activeCourseLoad,{baseUrl}).then(source=>
    _fetchTierForCourse(_activeCourseLoad,source,tier,retries));
}

function _publicLoadError(error,courseId,tier){
  return {
    code:error&&error.code||"PACK_LOAD_FAILED", courseId,
    tier:tier||error&&error.tier||null,
    message:error&&error.message||`${courseId} word bank failed to load`
  };
}

function loadCourseData(courseId,options){
  options=options||{};
  let store;
  try{store=courseDataFor(courseId);}catch(error){return Promise.reject(error);}
  if(courseId===COURSE_IDS.everyday && !WORDBAR_FEATURES.everydayEnglish){
    const error=new CourseDataLoadError(
      "COURSE_DISABLED",courseId,null,"Everyday English is disabled in this review build"
    );
    store.loading.state="disabled";
    store.loading.error=_publicLoadError(error,courseId,null);
    return Promise.reject(error);
  }

  if(_activeCourseLoad)cancelCourseDataLoad();
  const controller=_makeAbortController();
  const context={courseId,generation:++_courseLoadGeneration,controller,signal:controller.signal,
    verifiedTiers:new Set(),loadedFromCache:new Set(),source:null,mergeReady:{},mergeSignals:{}};
  for(const tierName of _TIER_MERGE_ORDER){
    context.mergeReady[tierName]=new Promise(resolve=>{context.mergeSignals[tierName]=resolve;});
  }
  _activeCourseLoad=context;
  const baseUrl=options.baseUrl||COURSE_PACKS[courseId].baseUrl;
  const retries=Number.isInteger(options.retries)?Math.max(0,options.retries):2;
  const status=store.loading;
  status.state="loading"; status.generation=context.generation;
  status.active=true; status.error=null; status.lastBaseUrl=baseUrl;
  for(const tier of ["easy","core","stretch"]){
    status.tiers[tier]=store.dataStatus[tier]?"loaded":"idle";
  }

  const fail=(error,tier)=>{
    if(_activeCourseLoad===context && status.generation===context.generation){
      status.active=false; status.state="error";
      status.error=_publicLoadError(error,courseId,tier);
    }
    throw error;
  };

  const prepare=async()=>{
    try{return await _preferredManifestSource(context,options);}
    catch(preferredError){
      _assertCurrentLoad(context,null);
      const cached=await _currentCachedSource(courseId);
      if(cached)return cached;
      if(preferredError&&preferredError.code)throw preferredError;
      throw new CourseDataLoadError("MANIFEST_LOAD_FAILED",courseId,null,
        `${courseId} course manifest failed to load`,preferredError);
    }
  };
  const easy=prepare().then(async source=>{
    context.source=source;store.packVersion=source.packVersion;
    try{return await _fetchTierForCourse(context,source,"easy",retries);}
    catch(preferredError){
      if(source.cachedOnly)throw preferredError;
      const cached=await _currentCachedSource(courseId);
      if(!cached||cached.packVersion===source.packVersion)throw preferredError;
      context.source=cached;store.packVersion=cached.packVersion;
      return _fetchTierForCourse(context,cached,"easy",0);
    }
  });
  return easy.then(()=>{
    _assertCurrentLoad(context,"easy");
    status.state="ready";
    const background=["core","stretch"].map(tier=>
      _fetchTierForCourse(context,context.source,tier,retries).catch(error=>{
        if(error&&error.name==="AbortError")return;
        if(_activeCourseLoad===context && status.generation===context.generation){
          status.state="partial";
          status.error=_publicLoadError(error,courseId,tier);
        }
      })
    );
    Promise.all(background).then(async()=>{
      if(_activeCourseLoad===context && status.generation===context.generation){
        try{
          if(status.tiers.core==="loaded"&&status.tiers.stretch==="loaded"){
            status.state="ready"; status.error=null;
            await _activateCourseSource(context.source,
              (context.source.cachedOnly||context.source.manifestFromCache)&&
              context.loadedFromCache.size===3);
          }
        }finally{status.active=false;}
      }
    });
  },error=>fail(error,"easy"));
}

function retryCourseData(courseId){
  const store=courseDataFor(courseId);
  return loadCourseData(courseId,{baseUrl:store.loading.lastBaseUrl||COURSE_PACKS[courseId].baseUrl});
}

function loadWordData(baseUrl){
  return loadCourseData(COURSE_IDS.elevenPlus,{baseUrl:baseUrl||COURSE_PACKS.elevenPlus.baseUrl});
}
