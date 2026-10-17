/* ============================================================
   ENGINE — storage, state, SRS, question generation, economy,
   audio, TTS, SVG felt-craft renderer
   Word/question data now comes from the real 799-word bank via
   data-loader.js (BUILTIN_WORDS / QBANK / ODD_ONE_OUT / ANALOGIES
   / RHYMES / LADDERS / HOMOPHONES), loaded before boot.
   ============================================================ */

/* ---------- Storage compatibility surface ----------
   persistence.js owns all save writes. Store remains only as the small
   read-only capability flag used by the existing profile screen. */
const Store=Object.freeze({get persistent(){return WordBarPersistence.persistent;}});

/* ---------- Profiles & state ---------- */
/* motion default follows the device preference (QA a11y 14.5); the
   player can still override it in Settings, which wins thereafter. */
const _osReducedMotion = (typeof matchMedia==="function") && matchMedia("(prefers-reduced-motion: reduce)").matches;
const DEFAULT_SETTINGS = {sound:true, music:true, musicTrack:"happyHours", voice:true, celebVoice:true, diff:"auto", motion:_osReducedMotion?"reduced":"full", text:"normal", font:"standard", theme:"sunny", lightingMode:"auto", revealSecs:"20", petSounds:true, voiceGender:"female", pronunciation:"uk", voicePick:"", voiceRate:0.92, batterySaver:false, showMasteryBadge:true};

/* Build 65 Kitchen release. Kitchen is available by default. Testers may add
   ?kitchen=0 as a temporary kill switch without changing saved progress. */
const KITCHEN_SCHEMA_VERSION=8;
const KITCHEN_ENABLED=!(typeof location!=="undefined"&&new URLSearchParams(location.search||"").get("kitchen")==="0");
const KITCHEN_CONFIG=Object.freeze({
  correctRequired:7,
  submittedMistakesAllowed:2,
  timers:Object.freeze({easy:300,core:300,stretch:300}),
  dailyPaidCompletions:4,
  extraLetterCost:100,
  pronunciationCost:200,
  /* Batch 4 laboratory deck: the intended 3 Conveyor / 2 Scramble /
     2 Path mix. The first six slots are shuffled and Path stays round 7. */
  modeDeck:Object.freeze(["conveyor","conveyor","conveyor","scramble","scramble","path","path"]),
  /* Build 81: every recipe remains playable, but the first four paid
     completions of the local day share one global allowance. A recipe
     can still pay only once per day. Later wins are free practice, and
     an unpaid first win keeps its first-reward eligibility for a future
     paid completion. */
  rewardTips:Object.freeze({
    easy:Object.freeze({first:250,redo:125,perfectFirst:50,perfectRedo:25}),
    core:Object.freeze({first:350,redo:175,perfectFirst:70,perfectRedo:35}),
    stretch:Object.freeze({first:450,redo:225,perfectFirst:90,perfectRedo:45})
  })
});
function kitchenTypeRules(courseId=COURSE_IDS.elevenPlus){
  const course=COURSES[courseId]||COURSES.elevenPlus;
  return course.kitchen?.types||ELEVEN_PLUS_KITCHEN_TYPES;
}
function freshKitchenQuestionKinds(courseId=COURSE_IDS.elevenPlus){
  return kitchenTypeRules(courseId).reduce((out,rule)=>{
    if(!Object.prototype.hasOwnProperty.call(out,rule.kind))out[rule.kind]={starts:0,correct:0,wrong:0};
    return out;
  },{});
}
function freshKitchenState(courseId=COURSE_IDS.elevenPlus){
  return {
    v:KITCHEN_SCHEMA_VERSION,
    unlockedFoods:[...KITCHEN_CLASSIC_FOODS],
    firstRewardedFoods:[],
    rewardedToday:{},
    dailyRewardDay:null,
    dailyRewardCount:0,
    bestByFood:{},
    lastAttemptByFood:{},
    foodServeCounts:{},
    stats:{
      challengesStarted:0,challengesWon:0,perfectWins:0,firstAttemptWins:0,correct:0,wrong:0,
      modeCorrect:{conveyor:0,scramble:0,path:0},
      modeResults:{conveyor:{starts:0,successes:0,mistakes:0,activeMs:0},scramble:{starts:0,successes:0,mistakes:0,activeMs:0},path:{starts:0,successes:0,mistakes:0,activeMs:0}},
      questionKinds:freshKitchenQuestionKinds(courseId),
      failReasons:{timeout:0,mistakes:0,emptyPool:0,abandoned:0},
      pathDrags:0,conveyorMoves:0,
      fallbacks:{},dropOffRound:{}
    },
    tutorial:{completed:false,skipped:false}
  };
}
/* Build 85: pet idles are driven by time-of-day and live session state.
   The retired 0-100 happiness/content score is deliberately absent. */
const DEFAULT_PET_SYSTEM = Object.freeze({licenceOwned:false,activePetId:null});
function freshPetSystem(){return {...DEFAULT_PET_SYSTEM};}
const SPELLING_GAME_SCHEMA_VERSION=2;
const SPELLING_REVIEW_DAYS=Object.freeze([2,7,21,60]);
const PET_POP_REWARD_CONFIG=Object.freeze({dailyPaidSessions:4,word:3,memoryInTime:2,session:3,perfect:2,max:20});
const SPELLING_TROPHIES=Object.freeze([
  ["spelling.playtime_begins","Playtime Begins","Finish 1 Pet Pop session.","sessions",1],
  ["spelling.patio_pal","Patio Pal","Finish 5 Pet Pop sessions.","sessions",5],
  ["spelling.pet_pack_regular","Pet Pack Regular","Finish 10 Pet Pop sessions.","sessions",10],
  ["spelling.pop_time_pro","Pop-Time Pro","Finish 25 Pet Pop sessions.","sessions",25],
  ["spelling.playtime_legend","Playtime Legend","Finish 50 Pet Pop sessions.","sessions",50],
  ["spelling.letter_scout","Letter Scout","Play 10 unique spelling words.","uniqueWords",10],
  ["spelling.word_fetcher","Word Fetcher","Play 25 unique spelling words.","uniqueWords",25],
  ["spelling.spelling_explorer","Spelling Explorer","Play 50 unique spelling words.","uniqueWords",50],
  ["spelling.word_collector","Word Collector","Play 100 unique spelling words.","uniqueWords",100],
  ["spelling.dictionary_adventurer","Dictionary Adventurer","Play 250 unique spelling words.","uniqueWords",250],
  ["spelling.memory_spark","Memory Spark","Complete 3 Memory words in time.","memoryInTime",3],
  ["spelling.memory_hopper","Memory Hopper","Complete 15 Memory words in time.","memoryInTime",15],
  ["spelling.memory_hound","Memory Hound","Complete 50 Memory words in time.","memoryInTime",50],
  ["spelling.memory_lion","Memory Lion","Complete 100 Memory words in time.","memoryInTime",100],
  ["spelling.memory_master","Memory Master","Complete 250 Memory words in time.","memoryInTime",250],
  ["spelling.clean_paws","Clean Paws","Earn 1 Perfect Pop session.","perfectSessions",1],
  ["spelling.tidy_tails","Tidy Tails","Earn 5 Perfect Pop sessions.","perfectSessions",5],
  ["spelling.perfect_pack","Perfect Pack","Earn 15 Perfect Pop sessions.","perfectSessions",15],
  ["spelling.high_five","High Five","Reach a Pet Pop combo of 5.","bestCombo",5],
  ["spelling.tail_tap_ten","Tail-Tap Ten","Reach a Pet Pop combo of 10.","bestCombo",10],
  ["spelling.fever_friend","Fever Friend","Trigger Fever 10 times.","feverCount",10],
  ["spelling.old_friend","Old Friend","Recall 10 due spelling words.","retrievalSuccesses",10],
  ["spelling.long_memory","Long Memory","Recall 50 due spelling words.","retrievalSuccesses",50],
  ["spelling.eleven_plus_star","11+ Spelling Star","Play 100 unique 11+ words.","elevenPlusUnique",100],
  ["spelling.everyday_star","Everyday Spelling Star","Play 100 unique Everyday words.","everydayUnique",100]
].map(([id,title,desc,metric,goal])=>Object.freeze({id,title,desc,metric,goal,cat:"spelling"})));
function freshSpellingWordState(){return {plays:0,memorySuccesses:0,memoryInTime:0,wrongTaps:0,overtimeCount:0,lastWrongTaps:0,lastOvertimeCount:0,needsPractice:false,retrievalSuccesses:0,lastPlayedAt:0,nextDueAt:0};}
function freshSpellingCourseState(){return {sessions:0,completedWords:0,uniqueWords:[],memoryInTime:0,perfectSessions:0,bestCombo:0,bestScore:0,feverCount:0,retrievalSuccesses:0,petsSeen:[],recentWordIds:[],rewardedSessionKeys:[],rewardDay:null,rewardCount:0,completedOutcomeKeys:[],completedSessionKeys:[],words:{}};}
function freshSpellingGameState(){return {version:SPELLING_GAME_SCHEMA_VERSION,trophies:{},courses:{elevenPlus:freshSpellingCourseState(),everyday:freshSpellingCourseState()}};}
function spellingMetric(profile,metric){
  const game=profile&&profile.spellingGame&&profile.spellingGame.courses?profile.spellingGame:freshSpellingGameState(),courses=game.courses;
  const a=courses.elevenPlus||freshSpellingCourseState(),b=courses.everyday||freshSpellingCourseState();
  if(metric==="bestCombo")return Math.max(a.bestCombo||0,b.bestCombo||0);
  if(metric==="uniqueWords")return (a.uniqueWords||[]).length+(b.uniqueWords||[]).length;
  if(metric==="elevenPlusUnique")return (a.uniqueWords||[]).length;
  if(metric==="everydayUnique")return (b.uniqueWords||[]).length;
  return Math.max(0,Number(a[metric])||0)+Math.max(0,Number(b[metric])||0);
}
function spellingTrophyProgress(profile,trophy){const value=spellingMetric(profile,trophy.metric);return {value,goal:trophy.goal,complete:value>=trophy.goal};}
function checkSpellingTrophies(profile,now=Date.now()){
  if(!profile.spellingGame||profile.spellingGame.version!==SPELLING_GAME_SCHEMA_VERSION)profile.spellingGame=cleanSpellingGameState(profile.spellingGame);
  const earned=profile.spellingGame.trophies||(profile.spellingGame.trophies={}),fresh=[];
  for(const trophy of SPELLING_TROPHIES){if(!earned[trophy.id]&&spellingTrophyProgress(profile,trophy).complete){earned[trophy.id]=now;fresh.push(trophy)}}
  return fresh;
}
function cleanSpellingCourseState(raw,courseId,{strict=false}={}){
  const out=freshSpellingCourseState(),source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const clamp=(value,max=9999999)=>{value=Number(value);return Number.isFinite(value)?Math.max(0,Math.min(max,Math.round(value))):0};
  const known=id=>typeof id==="string"&&courseCatalogHasWord(courseId,id);
  const cleanIds=(value,limit,label)=>{
    if(!Array.isArray(value))return [];
    const result=[];for(const id of value){
      if(known(id)){if(!result.includes(id))result.push(id)}
      else if(strict&&typeof id==="string")throw new Error(`${label} contains a word outside ${courseId}: ${id}`);
      if(result.length>=limit)break;
    }return result;
  };
  for(const key of ["sessions","completedWords","memoryInTime","perfectSessions","bestCombo","bestScore","feverCount","retrievalSuccesses"])out[key]=clamp(source[key]);
  out.uniqueWords=cleanIds(source.uniqueWords,3000,"Spelling unique words");
  out.recentWordIds=cleanIds(source.recentWordIds,9,"Spelling recent words");
  out.petsSeen=Array.isArray(source.petsSeen)?[...new Set(source.petsSeen.filter(id=>typeof id==="string"&&PETS.some(pet=>pet.id===id)))].slice(0,PETS.length):[];
  const cleanKeys=(value,limit)=>Array.isArray(value)?[...new Set(value.filter(key=>typeof key==="string"&&key.length>=3&&key.length<=180))].slice(-limit):[];
  out.rewardedSessionKeys=cleanKeys(source.rewardedSessionKeys,120);
  out.rewardDay=typeof source.rewardDay==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(source.rewardDay)?source.rewardDay:null;
  out.rewardCount=Math.min(PET_POP_REWARD_CONFIG.dailyPaidSessions,clamp(source.rewardCount));
  out.completedOutcomeKeys=cleanKeys(source.completedOutcomeKeys,600);
  out.completedSessionKeys=cleanKeys(source.completedSessionKeys,200);
  if(source.words&&typeof source.words==="object"&&!Array.isArray(source.words)){
    for(const [id,record] of Object.entries(source.words).slice(0,3000)){
      if(!known(id)){if(strict)throw new Error(`Spelling history contains a word outside ${courseId}: ${id}`);continue}
      if(!record||typeof record!=="object"||Array.isArray(record))continue;
      const word=freshSpellingWordState();
      for(const key of ["plays","memorySuccesses","memoryInTime","wrongTaps","overtimeCount","lastWrongTaps","lastOvertimeCount","retrievalSuccesses"])word[key]=clamp(record[key]);
      word.needsPractice=record.needsPractice===true||word.lastWrongTaps>0||word.lastOvertimeCount>0;
      word.memorySuccesses=Math.min(word.plays,word.memorySuccesses);word.memoryInTime=Math.min(word.memorySuccesses,word.memoryInTime);word.retrievalSuccesses=Math.min(word.plays,word.retrievalSuccesses);
      word.lastPlayedAt=clamp(record.lastPlayedAt,Date.now()+10*365*86400000);word.nextDueAt=clamp(record.nextDueAt,Date.now()+10*365*86400000);out.words[id]=word;
    }
  }
  out.uniqueWords=[...new Set([...out.uniqueWords,...Object.keys(out.words)])].slice(0,3000);
  return out;
}
function cleanSpellingGameState(raw,options){
  const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{},courses=source.courses&&typeof source.courses==="object"?source.courses:{};
  const trophyIds=new Set(SPELLING_TROPHIES.map(trophy=>trophy.id)),trophies={};
  if(source.trophies&&typeof source.trophies==="object"&&!Array.isArray(source.trophies))for(const [id,when] of Object.entries(source.trophies)){
    const stamp=Number(when);if(trophyIds.has(id)&&Number.isFinite(stamp)&&stamp>0)trophies[id]=Math.round(stamp);
  }
  return {version:SPELLING_GAME_SCHEMA_VERSION,trophies,courses:{
    elevenPlus:cleanSpellingCourseState(courses.elevenPlus,COURSE_IDS.elevenPlus,options),
    everyday:cleanSpellingCourseState(courses.everyday,COURSE_IDS.everyday,options)
  }};
}
function spellingCourseState(profile,courseId=profile&&profile.courseId){
  if(!profile)throw new Error("Pet Pop needs an active profile");
  if(!WORDBAR_KNOWN_COURSES.includes(courseId))throw new Error(`Unknown spelling course: ${courseId}`);
  if(!profile.spellingGame||profile.spellingGame.version!==SPELLING_GAME_SCHEMA_VERSION)profile.spellingGame=cleanSpellingGameState(profile.spellingGame);
  return profile.spellingGame.courses[courseId];
}
function applyPetPopWordOutcome(profile,courseId,outcome,outcomeKey,now=Date.now()){
  const course=spellingCourseState(profile,courseId),key=String(outcomeKey||"");
  if(!key||key.length>180)throw new Error("Pet Pop outcome key is invalid");
  if(course.completedOutcomeKeys.includes(key))return {applied:false,duplicate:true,course};
  const id=String(outcome&&outcome.id||"");if(!courseCatalogHasWord(courseId,id))throw new Error(`Pet Pop outcome is outside ${courseId}: ${id}`);
  const old=course.words[id]||freshSpellingWordState(),wasDue=old.plays>0&&old.nextDueAt>0&&old.nextDueAt<=now;
  const wrong=Math.max(0,Math.min(9999,Math.round(Number(outcome.wrongTaps)||0))),overtime=Math.max(0,Math.min(3,Math.round(Number(outcome.overtimeCount)||0)));
  const inTime=!!outcome.memoryInTime,clean=inTime&&wrong===0&&overtime===0;
  const word={...old,plays:old.plays+1,memorySuccesses:old.memorySuccesses+1,memoryInTime:old.memoryInTime+(inTime?1:0),wrongTaps:old.wrongTaps+wrong,overtimeCount:old.overtimeCount+overtime,lastWrongTaps:wrong,lastOvertimeCount:overtime,needsPractice:!clean,lastPlayedAt:now};
  if(clean){const step=SPELLING_REVIEW_DAYS[Math.min(word.memorySuccesses-1,SPELLING_REVIEW_DAYS.length-1)];word.nextDueAt=now+step*86400000;if(wasDue){word.retrievalSuccesses++;course.retrievalSuccesses++}}
  else word.nextDueAt=now;
  course.words[id]=word;course.completedWords++;if(inTime)course.memoryInTime++;
  if(!course.uniqueWords.includes(id))course.uniqueWords.push(id);
  course.recentWordIds=course.recentWordIds.filter(value=>value!==id);course.recentWordIds.push(id);course.recentWordIds=course.recentWordIds.slice(-9);
  course.completedOutcomeKeys.push(key);course.completedOutcomeKeys=course.completedOutcomeKeys.slice(-600);
  return {applied:true,duplicate:false,dueReturn:wasDue,clean,word,course};
}
function petPopDayKey(now=Date.now()){const date=new Date(now),y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");return `${y}-${m}-${d}`;}
function petPopRewardFor(result){
  const outcomes=Array.isArray(result&&result.results)?result.results:[];if(outcomes.length!==3)return {amount:0,perfect:false,stars:0};
  const inTime=outcomes.filter(item=>item.memoryInTime).length,perfect=inTime===3&&outcomes.every(item=>!item.wrongTaps&&!item.overtimeCount);
  const amount=Math.min(PET_POP_REWARD_CONFIG.max,outcomes.length*PET_POP_REWARD_CONFIG.word+inTime*PET_POP_REWARD_CONFIG.memoryInTime+PET_POP_REWARD_CONFIG.session+(perfect?PET_POP_REWARD_CONFIG.perfect:0));
  return {amount,perfect,stars:perfect?3:inTime===3?2:1,inTime};
}
function applyPetPopSessionReward(profile,course,result,sessionKey,now=Date.now()){
  const calculated=petPopRewardFor(result),day=petPopDayKey(now),outcomes=Array.isArray(result&&result.results)?result.results:[];
  if(!calculated.amount)return {...calculated,paid:0,reason:"incomplete",dailyPaid:course.rewardDay===day?course.rewardCount:0};
  if(course.rewardDay!==day){course.rewardDay=day;course.rewardCount=0}
  const ids=outcomes.map(item=>String(item&&item.id||"")).filter(Boolean).sort();
  const fingerprint=`${day}:${ids.join(",")}`;
  if(ids.length!==3)return {...calculated,paid:0,reason:"incomplete",dailyPaid:course.rewardCount};
  if(course.rewardedSessionKeys.includes(fingerprint))return {...calculated,paid:0,reason:"same-words",dailyPaid:course.rewardCount};
  if(course.rewardCount>=PET_POP_REWARD_CONFIG.dailyPaidSessions)return {...calculated,paid:0,reason:"daily-cap",dailyPaid:course.rewardCount};
  earn(calculated.amount,profile,{persistNow:false});course.rewardCount++;
  course.rewardedSessionKeys.push(fingerprint);course.rewardedSessionKeys=course.rewardedSessionKeys.slice(-120);
  return {...calculated,paid:calculated.amount,reason:"paid",dailyPaid:course.rewardCount,sessionKey};
}
function applyPetPopSessionOutcome(profile,courseId,result,sessionKey,now=Date.now()){
  const course=spellingCourseState(profile,courseId),key=String(sessionKey||"");
  if(!key||key.length>180)throw new Error("Pet Pop session key is invalid");
  if(course.completedSessionKeys.includes(key))return {applied:false,duplicate:true,course};
  const outcomes=Array.isArray(result&&result.results)?result.results:[];
  const rewardPreview=petPopRewardFor(result);
  course.sessions++;course.bestCombo=Math.max(course.bestCombo,Math.max(0,Math.round(Number(result&&result.bestCombo)||0)));course.bestScore=Math.max(course.bestScore,Math.max(0,Math.round(Number(result&&result.score)||0)));
  course.feverCount+=Math.max(0,Math.min(999,Math.round(Number(result&&result.feverCount)||0)));
  if(rewardPreview.perfect)course.perfectSessions++;
  const pets=Array.isArray(result&&result.petIdsSeen)?result.petIdsSeen:[];course.petsSeen=[...new Set([...course.petsSeen,...pets.filter(id=>PETS.some(pet=>pet.id===id))])];
  course.completedSessionKeys.push(key);course.completedSessionKeys=course.completedSessionKeys.slice(-200);
  const reward=applyPetPopSessionReward(profile,course,result,key,now),freshTrophies=checkSpellingTrophies(profile,now);
  return {applied:true,duplicate:false,course,reward,freshTrophies};
}
function newProfile(name, avatarId, courseId=COURSE_IDS.elevenPlus){
  if(!WORDBAR_KNOWN_COURSES.includes(courseId))throw new Error(`Unknown course: ${courseId}`);
  return {v:2,name,avatar:avatarId,created:Date.now(),
    courseId,
    tips:120, lifetime:120,                       // welcome float, honest & visible
    owned:["apron_cherry"], placed:{avatar:{apron:"apron_cherry"},cafe:{},pet:{}},
    words:{},                                     // per-word SRS: {seen,streak,interval,due,right,wrong}
    custom:[], hidden:[],
    sessions:0, shifts:[],                        // shifts: session history for bests + grown-up summary
    best:{acc:0,streak:0,tips:0,timeChallenge:0},
    streakLife:0, metFox:false, metOwl:false, metProf:false, petsMet:[],
    playDays:[],                                  // ISO date strings, for return-based achievements
    reviewStreakDays:0,lastReviewDate:null,        // cross-session review habit (local dates)
    _unlocksSeen:0,_unlockStepVersion:300,         // permanent reveal floor for economy rescaling
    _themesSeen:["sunny"],_legacyThemeMigrationDone:true, // new profiles use current theme thresholds only
    achievements:{},                              // id -> unlock timestamp
    _krakenRankId:null,_dailyWord:null,            // stable course rank + local-day word
    petSystem:freshPetSystem(),                    // permanent licence + selected café companion
    spellingGame:freshSpellingGameState(),        // Pet Pop spelling evidence, separate from meaning SRS
    kitchen:freshKitchenState(courseId),           // Build 65 Kitchen collection, analytics and challenge state
    settings:{...DEFAULT_SETTINGS}};
}
let SAVE = WordBarPersistence.getInitialSave() || {profiles:[],active:-1};
let LAST_PERSIST_RESULT=null;
function persist(){LAST_PERSIST_RESULT=WordBarPersistence.persistLive(SAVE);const ok=!!LAST_PERSIST_RESULT.ok;
  /* S10a analytics: a failed save is reported once per visit; new milestones are read from the saved profile. */
  if(window.WordBarAnalytics){try{if(!ok)WordBarAnalytics.error("save_failed","save");else if(typeof wbMilestoneNames==="function"&&SAVE.profiles[SAVE.active])WordBarAnalytics.noteMilestones(wbMilestoneNames(SAVE.profiles[SAVE.active]));}catch(e){}}
  return ok;}
function P(){ return SAVE.profiles[SAVE.active]; }
function activeCourseId(){return P()?.courseId||COURSE_IDS.elevenPlus;}
function activeCourseConfig(){return COURSES[activeCourseId()]||COURSES.elevenPlus;}
function activeCourseStore(){return courseDataFor(activeCourseId());}
function activeTierLabel(tier){return activeCourseConfig().tierLabels[tier]||tier;}

function resetProgress(){
  const p=P(); if(!p) return;
  const {name,avatar,courseId} = p;
  const fresh=newProfile(name,avatar,courseId);
  /* A progress reset must not erase a carefully-built custom avatar. */
  if(avatar==="custom"&&p.customLook) fresh.customLook=JSON.parse(JSON.stringify(p.customLook));
  const candidate=cloneSaveValue(SAVE);
  candidate.profiles[candidate.active] = fresh;
  const committed=WordBarPersistence.persistLive(candidate);
  if(!committed.ok)return false;
  SAVE=committed.value;
  return true;
}

/* ---------- Word access (builtin minus hidden, plus custom) ----------
   BUILTIN_WORDS/QBANK arrive progressively (easy tier first, then
   core+stretch) via data-loader.js — allWords() simply reflects
   whatever has landed so far, which is always a valid, playable set. */
function allWords(){ const p=P(),store=p?activeCourseStore():CourseData.elevenPlus;
  if(!p)return store.words;
  return store.words.filter(w=>!p.hidden.includes(w.id)).concat(p.custom); }
function wordState(id){ const p=P(); if(!p.words[id]) p.words[id]={seen:0,streak:0,interval:0,due:0,right:0,wrong:0}; return p.words[id]; }

/* ---------- Spaced repetition ----------
   Correct: interval steps 2d → 5d → 12d → 30d. A wrong
   answer brings a word back sooner without erasing a long history:
   it drops out of Mastered, moves down one step where possible, and
   has its interval halved.
   Selection: overdue reviews first, then new words, then the
   soonest-due — never a word answered in the last 8 picks. */
const SRS_STEPS = [2,5,12,30];
function srsRecord(id, correct){
  const s = wordState(id); s.seen++;
  if(correct){ s.right++; s.streak++; s.interval = SRS_STEPS[Math.min(s.streak-1, SRS_STEPS.length-1)]; }
  else { s.wrong++; s.streak = Math.min(2,Math.max(0,s.streak-1)); s.interval = Math.floor(s.interval/2); }
  s.due = Date.now() + s.interval*86400000;
}
function questionHasWordMastery(q){return !!(q&&q.wid&&q.masteryCredit!=="skill");}
function recordAuthoredQuestionOutcome(q,correct){
  const p=P();if(!p||!q)return;
  if(q.courseId===COURSE_IDS.everyday){
    const practice=p.everydayPractice||(p.everydayPractice={types:{},skills:{}});
    const typeKey=q.authoredType||q.kind;
    const type=practice.types[typeKey]||(practice.types[typeKey]={starts:0,correct:0,wrong:0});
    type.starts++;type[correct?"correct":"wrong"]++;
    if(q.skillKey){
      const skill=practice.skills[q.skillKey]||(practice.skills[q.skillKey]={starts:0,correct:0,wrong:0,priority:0});
      skill.starts++;skill[correct?"correct":"wrong"]++;
      skill.priority=correct?Math.max(0,(skill.priority||0)-1):(skill.priority||0)+1;
    }
  }
  if(questionHasWordMastery(q))srsRecord(q.wid,correct);
}
function masteryStage(id){
  const s = P().words[id];
  if(!s || s.seen===0) return "new";
  /* 3 correct in a row = mastered (this is also exactly when the
     SRS interval reaches its 12-day step, so the two now agree —
     the old streak>=4 && interval>=12 combination was effectively
     unreachable in normal play, which left the Kraken ladder's
     first rung permanently locked). */
  if(s.streak>=3) return "mastered";
  if(s.streak>=2) return "confident";
  return "learning";
}
function masteredCount(){
  const p=P();if(!p)return 0;
  const customIds=new Set((p.custom||[]).map(w=>w.id));
  return Object.keys(p.words).filter(id=>(customIds.has(id)||courseCatalogHasWord(p.courseId,id))&&masteryStage(id)==="mastered").length;
}
const recentWords=[], recentTypes=[], recentQuestionIds=[];
function noteRecent(wid,type,questionId){ recentWords.push(wid); if(recentWords.length>8)recentWords.shift();
  recentTypes.push(type); if(recentTypes.length>3)recentTypes.shift();
  if(questionId){recentQuestionIds.push(questionId);if(recentQuestionIds.length>12)recentQuestionIds.shift();} }
/* QA (v21 review, P2): these three tracking arrays are shared engine
   state, not part of any profile — so switching profiles or starting a
   new shift must clear them, or one child's recent words/accuracy can
   leak into another's session (or a new shift can inherit the last
   session's word-repeat exclusions). Call at both those points. */
function resetAdaptiveState(){ recentWords.length=0; recentTypes.length=0;recentQuestionIds.length=0;rollingResults.length=0; }

/* ---------- Difficulty ---------- */
const rollingResults=[];
function noteResult(ok){ rollingResults.push(ok); if(rollingResults.length>10) rollingResults.shift(); }
function currentTierWeights(){
  const p=P(), o=p.settings.diff;
  /* A real spread from the very first session — the old easy-only
     onboarding made early play feel samey and too gentle. */
  const raw =
    p.sessions===0 ? {easy:.6,core:.35,stretch:.05} :
    o==="easy"   ? {easy:.7,core:.3,stretch:0} :
    o==="core"   ? {easy:.15,core:.6,stretch:.25} :
    o==="stretch"? {easy:0,core:.3,stretch:.7} :
    (p.sessions===1) ? {easy:.45,core:.4,stretch:.15} :
    ((rollingResults.length? rollingResults.filter(Boolean).length/rollingResults.length : .7)>=.85) ? {easy:.1,core:.45,stretch:.45} :
    ((rollingResults.length? rollingResults.filter(Boolean).length/rollingResults.length : .7)>=.6)  ? {easy:.25,core:.5,stretch:.25} :
    {easy:.5,core:.4,stretch:.1};
  /* QA (v21 review, P1): renormalise across LOADED tiers only — core
     and stretch banks arrive after easy, so early in a slow-connection
     session their weight would otherwise just fall through to
     pickWord()'s null fallback rather than reflecting a real choice. */
  const status=activeCourseStore().dataStatus;
  if(status && !(status.core&&status.stretch)){
    const w={easy:raw.easy, core:status.core?raw.core:0, stretch:status.stretch?raw.stretch:0};
    const tot=w.easy+w.core+w.stretch;
    if(tot>0) return {easy:w.easy/tot, core:w.core/tot, stretch:w.stretch/tot};
  }
  return raw;
}
function pickTier(){ const w=currentTierWeights(), r=Math.random();
  return r<w.easy?"easy":(r<w.easy+w.core?"core":"stretch"); }

function pickWord(tier){
  const now=Date.now(), pool=allWords().filter(w=>w.t===tier && !recentWords.includes(w.id));
  const src = pool.length? pool : allWords().filter(w=>w.t===tier);
  if(!src.length) return null;
  const due = src.filter(w=>{const s=P().words[w.id]; return s && s.seen>0 && s.due<=now;});
  if(due.length) return due[Math.floor(Math.random()*due.length)];
  const fresh = src.filter(w=>!P().words[w.id] || P().words[w.id].seen===0);
  if(fresh.length) return fresh[Math.floor(Math.random()*fresh.length)];
  return src.slice().sort((a,b)=>(P().words[a.id]?.due??0)-(P().words[b.id]?.due??0))[0] || src[0];
}

/* ---------- Review mode ----------
   A focused practice pool — words actually encountered before that
   aren't mastered yet (overdue reviews, words still being learned
   or only shakily confident). Deliberately excludes both brand-new
   words (never attempted — nothing to "review" yet) and mastered
   ones, so the count genuinely means "needs more practice," not
   "every word in existence." Ignores the tier-weighted random mix
   used elsewhere; this mode exists specifically to put trouble
   words back in front of the player rather than leave them to
   come up by chance. */
const REVIEW_POOL_CAP=50, REVIEW_FRONT_SLICE=15;
function reviewPriority(a,b){
  const A=P().words[a.id]||{},B=P().words[b.id]||{};
  const streakDiff=(A.streak||0)-(B.streak||0);
  if(streakDiff)return streakDiff;                 // least familiar first
  const wrongDiff=(B.wrong||0)-(A.wrong||0);
  if(wrongDiff)return wrongDiff;                   // most lifetime misses next
  return (A.due||0)-(B.due||0);                    // then most overdue
}
function reviewCandidates(){
  return allWords().filter(w=>{const st=masteryStage(w.id);return st==="learning"||st==="confident";});
}
/* Build 86g-phase8: this ran reviewPriority() as the comparator, so every one
   of the ~O(n log n) comparisons did two P().words lookups — thousands per
   call, and the call happens per question in Review plus on the menu and
   topbar. Decorating once and sorting on the precomputed keys reads the same
   three fields in the same order, and Array.prototype.sort is stable, so the
   resulting pool is identical member-for-member and order-for-order. */
function reviewPool(){
  const p=P(),words=p?p.words:{};
  const rows=reviewCandidates().map(w=>{const s=words[w.id]||{};
    return {w,streak:s.streak||0,wrong:s.wrong||0,due:s.due||0};});
  rows.sort((A,B)=>(A.streak-B.streak)||(B.wrong-A.wrong)||(A.due-B.due));
  return rows.slice(0,REVIEW_POOL_CAP).map(row=>row.w);
}
/* Build 86g-phase8: reviewPool() filters and re-sorts the whole candidate
   list (1,471 words in Everyday), and review mode calls pickWordForReview up
   to 14 times inside a single makeQuestion(). No SRS state can change during
   that call, so the pool is built once per question instead of up to 28 times.
   The memo is only live inside makeQuestion(): a direct call from anywhere
   else still builds a fresh pool, so nothing can read a stale list. */
let _REVIEW_POOL_MEMO=null,_REVIEW_POOL_MEMO_ACTIVE=false;
function reviewPoolForPick(){
  if(!_REVIEW_POOL_MEMO_ACTIVE)return reviewPool();
  return _REVIEW_POOL_MEMO||(_REVIEW_POOL_MEMO=reviewPool());
}
function pickWordForReview(){
  const all=reviewPoolForPick();
  const pool=all.filter(w=>!recentWords.includes(w.id));
  const src = pool.length? pool : all;
  if(!src.length) return null;
  const front=src.slice(0,Math.min(REVIEW_FRONT_SLICE,src.length));
  return front[Math.floor(Math.random()*front.length)];
}

/* ---------- Question generation ----------
   Every question is pre-authored in the real bank (no on-the-fly
   invention). A word only offers a type when the bank actually
   has data for it — sparse types (word_form/affix/scramble) are
   skipped naturally when pickOne() returns null. Answer options
   are ALWAYS re-shuffled here, at generation time — never stored
   in a fixed position. */
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};

function promptContainsWholeAnswer(text,answer){
  const plain=String(text||"").replace(/<[^>]*>/g," ").toLowerCase();
  const target=String(answer||"").trim().toLowerCase();
  if(!target)return false;
  const escaped=target.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(plain);
}
function pickOne(w, type, kind, small){
  const qbank=activeCourseStore().qbank;
  const list = qbank[w.id] && qbank[w.id][type];
  if(!list || !list.length) return null;
  const safe = kind==="def" ? list.filter(q=>!promptContainsWholeAnswer(q.text,q.ans)) : list;
  if(!safe.length) return null;
  const q = safe[Math.floor(Math.random()*safe.length)];
  return {kind, wid:w.id, tier:w.t, say:w.w, text:q.text,
           opts:shuffle([q.ans,...q.d]), ans:q.ans, explain:q.explain, small:!!small};
}
const QGEN = {
  syn(w){ return pickOne(w,"synonym","syn"); },
  ant(w){ return pickOne(w,"antonym","ant"); },
  def(w){ return pickOne(w,"definition","def"); },
  cloze(w){ return pickOne(w,"cloze","cloze"); },
  usage(w){ return pickOne(w,"usage","usage",true); },
  miss(w){ return pickOne(w,"spelling","miss"); },
  form(w){ return pickOne(w,"word_form","form"); },
  affix(w){ return pickOne(w,"affix","affix",true); },
  scramble(w){ return pickOne(w,"scramble","scramble"); },
  /* "Pick the correct spelling" — generated on the fly from the word
     itself, so it works for the whole word bank and adds variety beyond
     the pre-authored bank. Distractors are classic 11+ traps:
     doubled/undoubled consonants, swapped vowel pairs, common
     letter-sound substitutions. Options shuffled, never fixed. */
  spell(w){
    if(!w || !w.w || w.w.length<4 || /\s|-/.test(w.w)) return null;
    const word=w.w.toLowerCase(), traps=new Set();
    const V="aeiou";
    // 1) double a single consonant / undouble a double
    const dbl=word.match(/([b-df-hj-np-tv-z])\1/);
    if(dbl) traps.add(word.replace(dbl[0],dbl[1]));
    else{ for(let i=1;i<word.length-1;i++){ const ch=word[i];
      if(!V.includes(ch)&&word[i-1]!==ch&&word[i+1]!==ch){ traps.add(word.slice(0,i)+ch+word.slice(i)); break; } } }
    // 2) swap an adjacent vowel pair (recieve-style)
    for(let i=0;i<word.length-1;i++){ if(V.includes(word[i])&&V.includes(word[i+1])&&word[i]!==word[i+1]){
      traps.add(word.slice(0,i)+word[i+1]+word[i]+word.slice(i+2)); break; } }
    // 3) common substitutions
    const subs=[["ie","ei"],["ei","ie"],["ance","ence"],["ence","ance"],["able","ible"],["ible","able"],["ary","ery"],["tion","sion"],["sion","tion"],["our","or"],["s","c"],["c","s"],["a","e"],["e","a"],["ou","o"],["i","y"],["y","i"]];
    for(const [a,b] of subs){ if(traps.size>=5) break;
      const i=word.indexOf(a); if(i>0){ const t=word.slice(0,i)+b+word.slice(i+a.length); if(t!==word) traps.add(t); } }
    // 4) fallback: swap one vowel for a different vowel (keeps 4 options possible for every word)
    if(traps.size<3){ for(let i=1;i<word.length;i++){ if(traps.size>=3) break;
      if(V.includes(word[i])){ for(const v of V){ if(v!==word[i]){ const t=word.slice(0,i)+v+word.slice(i+1); if(t!==word&&!traps.has(t)){ traps.add(t); break; } } } } } }
    traps.delete(word);
    const wrong=[...traps].slice(0,3);
    /* Always a full 2×2 grid — three-option spelling questions made
       the difficulty uneven vs the authored bank (QA finding). */
    if(wrong.length<3) return null;
    const opts=[word,...wrong];
    for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}
    return {kind:"spell",wid:w.id,tier:w.t,say:w.w,small:true,
      text:`Which is the correct spelling? <i>(${esc(w.def)})</i>`,
      opts, ans:word,
      explain:`<b>${word}</b> is the correct spelling.`};
  },
  odd(_,tier){ const pool=activeCourseStore().oddOneOut.filter(o=>o.t===tier); if(!pool.length) return null;
    const o=pool[Math.floor(Math.random()*pool.length)];
    return {kind:"odd",wid:null,puz:o.id,tier,say:null,
    text:`Three of these words belong together. Tap the <b>odd one out</b>:`,
    opts:shuffle(o.words),ans:o.odd,explain:o.why}; },
  analogy(_,tier){ const pool=activeCourseStore().analogies.filter(a=>a.t===tier); if(!pool.length) return null;
    const a=pool[Math.floor(Math.random()*pool.length)];
    return {kind:"analogy",wid:null,puz:a.id,tier,say:null,
    text:a.text, opts:shuffle([a.ans,...a.d]), ans:a.ans, explain:a.why}; },
  rhyme(_,tier){ const pool=activeCourseStore().rhymes.filter(r=>r.t===tier); if(!pool.length) return null;
    const r=pool[Math.floor(Math.random()*pool.length)];
    return {kind:"rhyme",wid:null,puz:r.id,tier,say:r.say,
    text:r.text, opts:shuffle([r.ans,...r.d]), ans:r.ans, explain:r.why}; },
  homophone(_,tier){ const pool=activeCourseStore().homophones.filter(h=>h.t===tier); if(!pool.length) return null;
    const h=pool[Math.floor(Math.random()*pool.length)];
    return {kind:"homophone",wid:null,puz:h.id,tier,say:h.say,
    text:h.text, opts:shuffle([h.ans,...h.d]), ans:h.ans, explain:h.why}; },
  ladder(_,tier){ const pool=activeCourseStore().ladders.filter(l=>l.t===tier&&l.path.length>=3); if(!pool.length) return null; /* <3 rungs would be all auto-complete */
    const l=pool[Math.floor(Math.random()*pool.length)];
    return {kind:"ladder",wid:null,puz:l.id,tier,say:null,ladder:l}; }
};
const STANDALONE_KINDS = ["odd","analogy","rhyme","ladder","homophone"];
const WORD_TIED_KINDS = ["syn","ant","def","cloze","usage","miss","form","affix","scramble","spell"];

/* ---------- Everyday authored-question registry ----------
   Phase 1 already supplied the stable IDs, row layout, speech text and
   reviewed credit decision. Runtime selection consumes that metadata without
   reclassifying it or generating substitute questions. */
/* Build 86g-phase10: the session-paced release window is removed. Everyday
   now matches 11+, where the whole word bank is available from the first
   session (COURSES.elevenPlus.cafe.releaseWindow is null) and difficulty is
   governed solely by the Settings tier weights. Previously "Super Star" did
   nothing for roughly the first eleven sessions because no stretch-tier word
   had been released yet to draw from. releaseWindow is now null for both
   courses; this function is kept so any caller still asking for a limit gets
   the honest answer (the full bank) rather than a stale figure. */
function everydayReleaseWordLimit(){
  return activeCourseStore().words.length;
}
let EVERYDAY_SELECTION_CACHE=null;
function everydaySelectionContext(){
  const store=activeCourseStore(),p=P(),limit=everydayReleaseWordLimit();
  const key=`${SAVE.active}:${store.questionRows.length}:${limit}:${(p.hidden||[]).slice().sort().join(",")}`;
  if(EVERYDAY_SELECTION_CACHE?.key===key)return EVERYDAY_SELECTION_CACHE;
  const hidden=new Set(p.hidden||[]),ordered=store.words.filter(w=>!hidden.has(w.id)).slice()
    .sort((a,b)=>(a.releaseOrder??Number.MAX_SAFE_INTEGER)-(b.releaseOrder??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id));
  const released=new Set(ordered.slice(0,limit).map(w=>w.id)),rows=store.questionRows.filter(record=>released.has(record.wid));
  const byTier={easy:[],core:[],stretch:[]},byWord=new Map(),byWordCredit=new Map();
  rows.forEach(record=>{
    byTier[record.tier].push(record);
    if(!byWord.has(record.wid))byWord.set(record.wid,[]);byWord.get(record.wid).push(record);
    if(record.question.masteryCredit==="word"){
      if(!byWordCredit.has(record.wid))byWordCredit.set(record.wid,[]);byWordCredit.get(record.wid).push(record);
    }
  });
  EVERYDAY_SELECTION_CACHE={key,released,rows,byTier,byWord,byWordCredit};
  return EVERYDAY_SELECTION_CACHE;
}
function everydayReleasedWordIds(){
  return new Set(everydaySelectionContext().released);
}
function everydayQuestionRows({tier=null,wid=null,wordCreditOnly=false,ignoreRelease=false,context=null}={}){
  const store=activeCourseStore();
  if(store.id!==COURSE_IDS.everyday)return [];
  if(ignoreRelease)return store.questionRows.filter(record=>(!tier||record.tier===tier)&&(!wid||record.wid===wid)&&
    (!wordCreditOnly||record.question.masteryCredit==="word"));
  /* Build 86g-phase8: one question makes up to 14 selection attempts and the
     released set cannot change between them, so the caller resolves the
     context once instead of recomputing masteredCount()/the release limit on
     every attempt. Omitting it keeps the original per-call behaviour. */
  context=context||everydaySelectionContext();
  if(wid){
    const rows=(wordCreditOnly?context.byWordCredit:context.byWord).get(wid)||[];
    return tier?rows.filter(record=>record.tier===tier):rows;
  }
  const rows=tier?(context.byTier[tier]||[]):context.rows;
  return wordCreditOnly?rows.filter(record=>record.question.masteryCredit==="word"):rows;
}
function everydayTypeEntry(type){return COURSES.everyday.cafe.types.find(entry=>entry.id===type)||null;}
function weightedPick(items,weightOf){
  if(!items.length)return null;
  const weights=items.map(item=>Math.max(0,Number(weightOf(item))||0));
  const total=weights.reduce((sum,value)=>sum+value,0);
  if(total<=0)return items[Math.floor(Math.random()*items.length)];
  let cursor=Math.random()*total;
  for(let index=0;index<items.length;index++){cursor-=weights[index];if(cursor<=0)return items[index];}
  return items[items.length-1];
}
function normaliseEverydayQuestion(record){
  if(!record||!everydayTypeEntry(record.type))return null;
  const q=record.question;
  return {id:q.id,questionId:q.id,courseId:COURSE_IDS.everyday,kind:record.type,authoredType:record.type,
    rendererKind:"choice",wid:record.wid,tier:record.tier,say:q.speechText,speechText:q.speechText,
    text:q.text,opts:shuffle([q.ans,...q.d]),ans:q.ans,explain:q.explain,
    layout:q.layout,small:q.layout==="sentence",masteryCredit:q.masteryCredit,skillKey:q.skillKey||null};
}
/* Forced-selection hook used by the release gate: it still passes through the
   real registry and normaliser, so the reachability test cannot count dead
   rows that gameplay would be unable to render. */
function everydayQuestionById(questionId){
  const record=activeCourseStore().questionById[questionId];
  return normaliseEverydayQuestion(record);
}
function chooseEverydayRecord(rows){
  if(!rows.length)return null;
  let candidates=rows.filter(record=>!recentQuestionIds.includes(record.id)&&!recentWords.includes(record.wid));
  if(!candidates.length)candidates=rows.filter(record=>!recentQuestionIds.includes(record.id));
  if(!candidates.length)candidates=rows;
  /* Build 86g-phase10: match 11+'s pickWord(), which surfaces due-for-review
     words first and never-seen words second, so every word in the bank is
     eventually reached instead of relying on uniform chance. Previously an
     already-mastered word was exactly as likely as one never asked, so with
     1,471 words some could go untouched indefinitely. The narrowing is only
     applied when that stage actually has candidates, so the type-spread and
     weighting below are unchanged whenever it doesn't apply. */
  const progress=P()?.words||{};
  const due=Date.now();
  const dueRows=candidates.filter(record=>{const st=progress[record.wid];return st&&st.seen>0&&st.due<=due;});
  const unseenRows=candidates.filter(record=>{const st=progress[record.wid];return !st||!st.seen;});
  if(dueRows.length)candidates=dueRows;
  else if(unseenRows.length)candidates=unseenRows;
  const grouped=new Map();
  candidates.forEach(record=>{if(!grouped.has(record.type))grouped.set(record.type,[]);grouped.get(record.type).push(record);});
  let groups=[...grouped.entries()].map(([type,records])=>({type,records,entry:everydayTypeEntry(type)})).filter(x=>x.entry);
  const spread=groups.filter(group=>!recentTypes.includes(group.type));if(spread.length)groups=spread;
  const group=weightedPick(groups,item=>item.entry.weight*Math.sqrt(item.records.length));
  return group?group.records[Math.floor(Math.random()*group.records.length)]:null;
}
function makeEverydayQuestion(){
  const inReview=typeof SHIFT!=="undefined"&&SHIFT&&SHIFT.mode==="review";
  const context=everydaySelectionContext();
  if(inReview){
    for(let attempt=0;attempt<14;attempt++){
      const word=pickWordForReview();if(!word)break;
      const record=chooseEverydayRecord(everydayQuestionRows({wid:word.id,wordCreditOnly:true,context}));
      const question=normaliseEverydayQuestion(record);
      if(question){noteRecent(question.wid,question.kind,question.id);return question;}
    }
    return null;
  }
  for(let attempt=0;attempt<14;attempt++){
    const record=chooseEverydayRecord(everydayQuestionRows({tier:pickTier(),context}));
    const question=normaliseEverydayQuestion(record);
    if(question){noteRecent(question.wid,question.kind,question.id);return question;}
  }
  const question=normaliseEverydayQuestion(chooseEverydayRecord(everydayQuestionRows({context})));
  if(question)noteRecent(question.wid,question.kind,question.id);
  return question;
}
/* Which types are on the menu — introduced gradually so a first
   session isn't overwhelming, gated honestly by whether any data
   has loaded yet for that kind. */
function availableTypes(){
  const p=P();
  if(p.courseId===COURSE_IDS.everyday){
    const loaded=new Set(activeCourseStore().questionRows.map(record=>record.type));
    return COURSES.everyday.cafe.types.map(entry=>entry.id).filter(type=>loaded.has(type));
  }
  /* Full variety almost immediately — only the word-ladder (its own
     special UI) waits for session two. */
  let types=["syn","ant","def","cloze","usage","odd","analogy","rhyme","homophone","miss","spell","scramble"];
  if(p.sessions>=1) types.push("ladder","form","affix");
  return types;
}
function makeQuestion(){
  /* Opens the per-question review-pool memo (see reviewPoolForPick) and always
     closes it, so no caller can ever observe a pool from an earlier question. */
  const outer=_REVIEW_POOL_MEMO_ACTIVE;
  _REVIEW_POOL_MEMO_ACTIVE=true;_REVIEW_POOL_MEMO=null;
  try{return makeQuestionForCourse();}
  finally{_REVIEW_POOL_MEMO_ACTIVE=outer;_REVIEW_POOL_MEMO=null;}
}
function makeQuestionForCourse(){
  if(activeCourseId()===COURSE_IDS.everyday)return makeEverydayQuestion();
  const inReview = typeof SHIFT!=="undefined" && SHIFT && SHIFT.mode==="review";
  const avail = inReview ? availableTypes().filter(t=>WORD_TIED_KINDS.includes(t)) : availableTypes();
  let types = avail.filter(t=>!recentTypes.includes(t) || Math.random()<.25);
  if(!types.length) types = avail.length? avail : WORD_TIED_KINDS;
  for(let attempt=0; attempt<14; attempt++){
    const type = types[Math.floor(Math.random()*types.length)];
    if(inReview){
      const w = pickWordForReview(); if(!w) continue;
      const q = QGEN[type](w);
      if(q){ noteRecent(q.wid,q.kind); return q; }
      continue;
    }
    const tier = pickTier();
    let q;
    if(STANDALONE_KINDS.includes(type)) q = QGEN[type](null,tier);
    else { const w = pickWord(tier); if(!w) continue; q = QGEN[type](w); }
    if(q){ noteRecent(q.wid,q.kind); return q; }
  }
  const w = inReview ? (pickWordForReview()||allWords()[0]) : (pickWord(pickTier())||allWords()[0]);
  if(!w) return null;
  const q = QGEN.syn(w) || QGEN.def(w); if(q) noteRecent(q.wid,q.kind); return q;
}

/* ---------- Customer & ticket assembly ----------
   The word tier drives who walks in — the customer is an honest
   reflection of the questions in the ticket. */
function customerFor(tiers, streak, excluded){
  const p=P(), top = tiers.includes("stretch")?"stretch":(tiers.includes("core")?"core":"easy");
  let pool;
  /* Real special guests: once a session is underway, at most one themed
     visitor may appear. They stay rare, use the existing unlock system,
     and are chosen before the normal tier logic so they feel distinct
     instead of blending into the ordinary VIP/Secret rotation. */
  const shiftLive = typeof SHIFT!=="undefined" && SHIFT;
  const specialEligible = shiftLive && SHIFT.served>=3 && !SHIFT.specialGuestUsed;
  if(specialEligible && Math.random()<.12){
    pool = CUSTOMERS.filter(c=>c.special);
  }
  /* QA (v21 review, P2): this used to read `this._owlUsed` from a plain
     function call — `this` is `window` here (no "use strict"), so the
     flag was always undefined and the "only once" guard never engaged.
     SHIFT.owlUsed is the real per-shift flag; set below once he's picked. */
  const owlAvailable = typeof SHIFT!=="undefined" && SHIFT && !SHIFT.owlUsed;
  if(!pool && streak>=5 && owlAvailable && Math.random()<.6){ pool=CUSTOMERS.filter(c=>c.id==="owl"); if(typeof SHIFT!=="undefined"&&SHIFT) SHIFT.owlUsed=true; }
  else if(!pool && top==="stretch"){
    pool = CUSTOMERS.filter(c=>c.tier==="secret"&&c.id!=="owl"&&!c.special);
    if(Math.random()<.5 || !pool.length) pool = CUSTOMERS.filter(c=>c.tier==="vip"&&!c.special);
  } else if(!pool && top==="core"){
    pool = Math.random()<.3 ? CUSTOMERS.filter(c=>c.tier==="vip"&&!c.special) : CUSTOMERS.filter(c=>c.tier==="regular");
  } else if(!pool) pool = CUSTOMERS.filter(c=>c.tier==="regular");
  if(!pool.length) pool = CUSTOMERS.filter(c=>c.tier==="regular");
  /* Spread the cast out: never pick anyone already in the queue,
     being served, or seen in the last few tickets — no more two
     Callums queueing side by side. Falls back to the full pool if
     exclusions would empty it. */
  /* Locked characters must never wander in before their reveal.
     If a whole tier pool is still locked (e.g. a stretch ticket while
     every secret customer is unrevealed), fall back to unlocked
     REGULARS — the 20-strong starting roster guarantees this pool is
     never empty — rather than quietly keeping the locked pool. */
  const un=unlockedIds().customer;
  let open=pool.filter(c=>un.has(c.id));
  if(!open.length) open=CUSTOMERS.filter(c=>c.tier==="regular"&&un.has(c.id));
  pool=open;
  if(excluded && excluded.length){
    const avoid=new Set(excluded);
    const spread=pool.filter(c=>!avoid.has(c.id));
    if(spread.length) pool=spread;
  }
  const chosen=pool[Math.floor(Math.random()*pool.length)];
  if(chosen&&chosen.special&&typeof SHIFT!=="undefined"&&SHIFT) SHIFT.specialGuestUsed=true;
  return chosen;
}
function buildTicket(streak, excluded){
  const first = makeQuestion();
  const cust = customerFor([first?first.tier:"easy"], streak, excluded);
  const qs=first?[first]:[];
  const n = cust.tier==="regular"?1:2;
  let guard=0;
  while(qs.length<n && guard++<20){ const q=makeQuestion(); if(q) qs.push(q); }
  if(!qs.length){ qs.push({kind:"syn",wid:null,tier:"easy",say:null,text:"Loading more words…",opts:["ok","ok2","ok3","ok4"],ans:"ok",explain:"More words are on their way."}); }
  const dk=pickTicketDrink(cust);
  const fd=pickTicketFood(cust);
  return {cust, qs, drink: dk.name, drinkKind: dk.kind, drinkColor: dk.color, drinkEmoji: dk.emoji,
          food: fd};
}
function themeDrink(){ const t=THEMES[P().settings.theme]||THEMES.sunny;
  return t.drinks[Math.floor(Math.random()*t.drinks.length)]; }
/* Pick a drink for this ticket: about half the time the customer
   orders their stated usual (when it reads like a real drink name);
   otherwise a kind loosely paired to their personality, with a
   colour drawn at random from that kind's palette. */
/* Food side: ~45% of tickets (75% in the Park Food Truck theme),
   loosely paired to personality. Ice cream carries its flavour
   colour so every cone looks different. */
function cafeEligibleFoodIds(p=P()){
  const classic=[...KITCHEN_CLASSIC_FOODS];
  /* Build 65: unlocked Kitchen dishes join the existing food pool while the
     overall probability of receiving food remains unchanged. */
  if(!KITCHEN_ENABLED||!p||!p.kitchen)return classic;
  const unlocked=Array.isArray(p.kitchen.unlockedFoods)?p.kitchen.unlockedFoods:classic;
  return [...new Set([...classic,...unlocked])].filter(id=>FOOD_KINDS[id]);
}
function pickTicketFood(cust){
  const p=P(),isTruck=p.settings.theme==="foodtruck";
  if(Math.random() > (isTruck?.75:.45)) return null;
  const eligible=cafeEligibleFoodIds(p);
  const preferred=(PERSONALITY_FOODS[cust.personality]||[]).filter(id=>eligible.includes(id));
  const kinds=preferred.length?preferred:eligible;
  const kind=kinds[Math.floor(Math.random()*kinds.length)]||"chips";
  const fk=FOOD_KINDS[kind]||FOOD_KINDS.chips;
  if(kind==="icecream"){
    const [flav,col]=fk.flavors[Math.floor(Math.random()*fk.flavors.length)];
    return {kind, name:flav+" Ice Cream", color:col, emoji:fk.emoji};
  }
  return {kind, name:fk.names[Math.floor(Math.random()*fk.names.length)], color:fk.color, emoji:fk.emoji};
}
function cafeEligibleDrinkKinds(p=P()){
  const base=Object.keys(DRINK_KINDS).filter(k=>!['smoothie','fizz'].includes(k));
  if(!KITCHEN_ENABLED||!p||!p.kitchen)return base;
  const unlocked=new Set(Array.isArray(p.kitchen.unlockedFoods)?p.kitchen.unlockedFoods:[]);
  return [...base,...['smoothie','fizz'].filter(k=>unlocked.has(k))];
}
function pickTicketDrink(cust){
  const p=P(),eligible=cafeEligibleDrinkKinds(p);
  const usualOk = cust.usual && /^[A-Z]/.test(cust.usual) && cust.usual.length<32 && !/^(something|whatever|the)/i.test(cust.usual);
  let name, kind;
  const usualKind=usualOk?inferDrinkKind(cust.usual):null;
  /* Honour a customer's stated usual only when that drink family has
     been unlocked. Before Smoothies or Fizzy Drinks are learned, route
     the ticket to an available drink instead of serving locked content. */
  if(usualOk&&eligible.includes(usualKind)){ name=cust.usual; kind=usualKind; }
  else{
    const preferred=(PERSONALITY_DRINKS[cust.personality]||["juice"]).filter(k=>eligible.includes(k));
    const kinds=preferred.length?preferred:eligible.length?eligible:["juice"];
    kind=kinds[Math.floor(Math.random()*kinds.length)];
    const kd=DRINK_KINDS[kind]||DRINK_KINDS.juice;
    name = kd.names ? kd.names[Math.floor(Math.random()*kd.names.length)] : themeDrink();
  }
  const kd=DRINK_KINDS[kind]||DRINK_KINDS.juice;
  return {name, kind, color: kd.colors[Math.floor(Math.random()*kd.colors.length)], emoji: kd.emoji};
}

/* ---------- Economy ---------- */
const BASE_TIP={easy:8,core:12,stretch:18};
/* ---------- Patience ----------
   Replaces the old lives system entirely. Every customer carries
   their own patience budget (seconds) that ticks down while their
   question is on screen; running out loses that ticket (customer
   leaves unhappy) but never ends the session — a slow player only
   ever loses individual tickets, not the whole session. VIPs are
   a touch more impatient; secret-tier customers a touch more
   forgiving, to match their more mysterious, unhurried character. */
const PATIENCE_BY_TIER = {regular:20, vip:17, secret:23};
function ticketTip(ticket, perfect, streak){
  let tip = ticket.qs.reduce((s,q)=>s+(BASE_TIP[q.tier]||8),0);
  if(!perfect) tip = Math.max(3, Math.round(tip*.4));
  if(ticket.cust.tier==="vip") tip=Math.round(tip*1.5);
  if(ticket.cust.tier==="secret") tip=Math.round(tip*2);
  if(perfect) tip += Math.min(10, streak*2);
  return tip;
}
function earn(n,profile=P(),{persistNow=true}={}){if(!profile)return 0;profile.tips+=n;profile.lifetime+=n;if(persistNow)persist();return n;}

/* ============ Sequential unlock system ============
   Every 300 LIFETIME coins earned reveals exactly ONE new face —
   alternating customer, pet, customer, pet — from a fixed sequence.
   The player starts with 20 regular customers and 5 common pets.
   Build 80 also keeps a permanent reveal floor, so rescaling the step
   never takes an already-revealed customer or pet away. */
const UNLOCK_STEP=300;
const START_PETS=["dog","cat","parrot","rabbit","duck","pugclassic"];
function startCustomerIds(){ return CUSTOMERS.filter(c=>c.tier==="regular").slice(0,20).map(c=>c.id); }
function customerUnlockOrder(){
  const regs=CUSTOMERS.filter(c=>c.tier==="regular").slice(20).map(c=>c.id);
  const vipsAll=CUSTOMERS.filter(c=>c.tier==="vip").map(c=>c.id);
  const newbies=["ninja","king","queen","viking","baller","striker","linebacker"].filter(id=>vipsAll.includes(id));
  const vips=vipsAll.filter(id=>!newbies.includes(id));
  /* sprinkle the brand-new characters through the vip stretch */
  const mixed=[]; let n=0;
  vips.forEach((id,i)=>{ mixed.push(id); if(i%3===2 && n<newbies.length) mixed.push(newbies[n++]); });
  while(n<newbies.length) mixed.push(newbies[n++]);
  const secretsAll=CUSTOMERS.filter(c=>c.tier==="secret").map(c=>c.id);
  const finale=secretsAll.filter(id=>/fox|owl|adeyemi|carto|clock/.test(id));
  const secrets=secretsAll.filter(id=>!finale.includes(id));
  return [...regs, ...mixed, ...secrets, ...finale];
}
function petUnlockOrder(){
  const locked=PETS.map(p=>p.id).filter(id=>!START_PETS.includes(id));
  const pref=["pig","squirrel","pug","dachshund","penguin","raccoon","koala","redpanda","pigeon","panda","chicken","lion","tiger"];
  return pref.filter(id=>locked.includes(id)).concat(locked.filter(id=>!pref.includes(id)));
}
let __unlockSeq=null;
function unlockSequence(){
  if(__unlockSeq) return __unlockSeq;
  const cs=customerUnlockOrder(), ps=petUnlockOrder(), seq=[];
  let i=0,j=0;
  while(i<cs.length||j<ps.length){
    if(i<cs.length) seq.push({type:"customer",id:cs[i++]});
    if(j<ps.length) seq.push({type:"pet",id:ps[j++]});
  }
  return (__unlockSeq=seq);
}
function unlocksEarned(){
  const live=Math.floor((P().lifetime||0)/UNLOCK_STEP);
  return Math.max(live,Math.max(0,Number(P()._unlocksSeen)||0));
}
function unlockedIds(){
  const u={customer:new Set(startCustomerIds()),pet:new Set(START_PETS)};
  unlockSequence().slice(0,unlocksEarned()).forEach(x=>u[x.type].add(x.id));
  return u;
}
function nextUnlockInfo(){
  const seq=unlockSequence(), n=unlocksEarned();
  if(n>=seq.length) return null;
  const at=(n+1)*UNLOCK_STEP, have=P().lifetime||0;
  return {item:seq[n], at, toGo:at-have};
}
/* Returns unlock entries newly crossed since last check; caller celebrates. */
function checkUnlocks(){
  const p=P(), seq=unlockSequence();
  const n=Math.min(unlocksEarned(),seq.length);
  /* Old-save migration (QA WB17-03): a profile from before _unlocksSeen
     existed has already lived through everything its lifetime coins
     unlocked — mark them revealed silently rather than replaying up to
     54 debut ceremonies back-to-back (≈1 minute of blocked play). */
  if(p._unlocksSeen===undefined){ p._unlocksSeen=n; persist(); return []; }
  const seen=Math.min(p._unlocksSeen,seq.length);
  if(n<=seen) return [];
  const fresh=seq.slice(seen,n);
  p._unlocksSeen=n; persist();
  return fresh;
}

/* ---------- Audio ----------
   Build 39 already moved background music onto one persistent HTML
   audio element and kept WebAudio only for short effects. Build 40
   extends that system with four longer pre-rendered tracks; it does
   not replace or duplicate the existing audio lifecycle. */
/* Build 86g-phase10: the Settings music selector renders in this object's
   key order, so Happy Hours is listed first here to place it at the top of
   the list. It is also the new default for fresh profiles (see
   DEFAULT_SETTINGS). Existing saves keep whatever track they chose. */
const MUSIC_TRACKS = {
  happyHours: {name:"Happy Hours",  file:"happy-hours.mp3"},
  cosyCorner: {name:"Cosy Corner",  file:"cosy-corner.mp3"},
  kyotoGarden:{name:"Kyoto Garden", file:"kyoto-garden.mp3"},
  mySunrise:  {name:"My Sunrise",   file:"my-sunrise.mp3"}
};
const MUSIC_TRACK_MIGRATION = {
  calm:"cosyCorner",
  cosy:"kyotoGarden",
  playful:"happyHours",
  kyoto:"mySunrise"
};
function normaliseMusicTrackId(id){
  if(MUSIC_TRACKS[id]) return id;
  return MUSIC_TRACK_MIGRATION[id]||"happyHours";
}

/* Shared local-time helpers. Lighting uses the phone's own clock:
   day 06:00–20:00 inclusive; night 20:01–05:59. Build 42 also
   divides the same local clock into morning / afternoon / night for
   optional customer greetings, so both systems share one source. */
function cafeClockPeriod(date=new Date()){
  const minutes=date.getHours()*60+date.getMinutes();
  return minutes>=360&&minutes<=1200?"day":"night";
}
function cafeLightingPeriod(date=new Date(),settings=P()?.settings){
  const mode=settings&&settings.lightingMode;
  return mode==="day"||mode==="night"?mode:cafeClockPeriod(date);
}
function cafeDialoguePeriod(date=new Date()){
  const minutes=date.getHours()*60+date.getMinutes();
  if(minutes>=360&&minutes<720)return "morning";
  if(minutes>=720&&minutes<=1200)return "afternoon";
  return "night";
}
function nextCafeLightingBoundary(date=new Date()){
  const nextMorning=new Date(date.getFullYear(),date.getMonth(),date.getDate(),6,0,0,0);
  const nextNight=new Date(date.getFullYear(),date.getMonth(),date.getDate(),20,1,0,0);
  if(date<nextMorning)return nextMorning;
  if(date<nextNight)return nextNight;
  nextMorning.setDate(nextMorning.getDate()+1);
  return nextMorning;
}
const AudioKit=(()=>{
  let ctx=null, musicEl=null, musicId="", previewEl=null, previewTimer=null;
  let ambientWanted=false, activeNodes=0, suspendTimer=null, ambientRamp=null;
  let ambientIntense=false;
  /* S9a: café music pauses while a word is spoken, then carries on. iPhone
     ignores a web page's volume setting, so lowering it is not enough there. */
  let speechHold=0,speechHoldTimer=null;

  /* Build 39 audio lifecycle, retained in Build 40:
     - no permanent 0.05-second silent loop;
     - background music is pre-rendered and decoded by the browser's
       normal media pipeline instead of continuously synthesised;
     - WebAudio wakes only for a real effect and suspends again after
       the final scheduled node ends. This keeps the audible character
       of the game while allowing an idle iPhone audio path to sleep. */
  const C=()=>{
    if(!ctx){ try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} }
    if(ctx && ctx.state==="suspended"){
      try{const r=ctx.resume();if(r&&r.catch)r.catch(()=>{});}catch(e){}
    }
    return ctx;
  };
  function scheduleSuspend(delay=850){
    clearTimeout(suspendTimer);
    suspendTimer=setTimeout(()=>{
      if(ctx&&activeNodes===0&&ctx.state==="running"){try{ctx.suspend();}catch(e){}}
    },delay);
  }
  function trackNode(node){
    activeNodes++;
    node.addEventListener("ended",()=>{
      activeNodes=Math.max(0,activeNodes-1);
      if(activeNodes===0)scheduleSuspend();
    },{once:true});
  }
  function ensureMusicEl(){
    if(!musicEl){
      musicEl=document.createElement("audio");
      musicEl.setAttribute("playsinline","");
      musicEl.preload="auto";musicEl.loop=true;musicEl.volume=.34;
    }
    return musicEl;
  }
  const ambientTarget=()=>ambientIntense?.5:.34;
  function rampAmbient(){
    if(!musicEl)return;
    const target=ambientTarget();
    if(ambientRamp){clearInterval(ambientRamp);ambientRamp=null;}
    const start=typeof musicEl.volume==="number"?musicEl.volume:.34;
    const steps=8;let step=0;
    ambientRamp=setInterval(()=>{
      step++;
      const value=start+(target-start)*(step/steps);
      try{musicEl.volume=Math.max(0,Math.min(1,value));}catch(e){}
      if(step>=steps){clearInterval(ambientRamp);ambientRamp=null;}
    },32);
  }
  const selectedTrackId=()=>normaliseMusicTrackId(P()?.settings.musicTrack);
  function playAmbient(){
    if(!ambientWanted||!musicOn()||document.hidden||speechHold>0)return;
    const id=selectedTrackId(),el=ensureMusicEl();
    if(musicId!==id){
      el.pause();musicId=id;el.src=`audio/${MUSIC_TRACKS[id].file}?v=85`;el.currentTime=0;el.load();
    }
    try{const pr=el.play();if(pr&&pr.catch)pr.catch(()=>{});}catch(e){}
  }
  function pauseAmbient(reset=false){
    if(!musicEl)return;
    try{musicEl.pause();if(reset)musicEl.currentTime=0;}catch(e){}
  }
  function stopPreview(){
    clearTimeout(previewTimer);previewTimer=null;
    if(previewEl){try{previewEl.pause();previewEl.currentTime=0;}catch(e){}}
    previewEl=null;
  }
  function sleepAudio(){
    pauseAmbient(false);stopPreview();clearTimeout(suspendTimer);
    if(ctx&&ctx.state==="running"){try{ctx.suspend();}catch(e){}}
  }
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)sleepAudio();else playAmbient();
  });
  window.addEventListener("pagehide",sleepAudio,{passive:true});
  window.addEventListener("pageshow",playAmbient,{passive:true});
  function tone(f,dur,type="sine",gain=.12,when=0,slide=0){
    const c=C(); if(!c) return;
    gain*=1.6; /* phone speakers are quiet — global lift */
    const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+when;
    o.type=type;o.frequency.setValueAtTime(f,t);
    if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.015);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(c.destination);trackNode(o);o.start(t);o.stop(t+dur+.05);
  }
  /* Filtered white-noise bursts — the missing ingredient for animal
     sounds. Pure oscillators can only beep; barks, clucks and roars
     are mostly NOISE shaped by a filter and an envelope. */
  function noise(dur,gain=.2,when=0,freq=800,q=1,type="bandpass"){
    const c=C(); if(!c) return;
    const len=Math.max(1,Math.floor(c.sampleRate*dur));
    const buf=c.createBuffer(1,len,c.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    const src=c.createBufferSource(); src.buffer=buf;
    const f=c.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q;
    const g=c.createGain(); const t=c.currentTime+when;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain*1.6,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    src.connect(f); f.connect(g); g.connect(c.destination); trackNode(src); src.start(t); src.stop(t+dur+.02);
  }
  const sfxOn=()=>!!P()?.settings.sound;
  const musicOn=()=>!!P()?.settings.music;
  /* S12a: WordBar Dictation's sound chain as of E10 (src/audio.js), so both
     games sound the same. Each note is [startOffset s, fromHz, toHz,
     duration s, wave, gain]. Every cue has a loudness TRIM (dB) so it lands
     in one band, measured through this chain and a phone-speaker filter
     (tools: wb-loudness): main cues -13 dB, small UI cues -18, mistakes -16.
     WB_CUES_BEGIN */
  const DICT_CUES={
    tap:[[0,440,440,.08,'triangle',.08]],
    correct:[[0,900,320,.05,'sine',.14],[.04,784,784,.18,'triangle',.13],[.12,1175,1175,.22,'triangle',.12]],
    'correct-combo':[[0,900,320,.05,'sine',.14],[.04,784,784,.16,'triangle',.13],[.11,1175,1175,.16,'triangle',.12],[.18,1568,1568,.26,'triangle',.11]],
    'correct-gold':[[0,900,320,.05,'sine',.14],[.04,1047,1047,.14,'triangle',.12],[.10,1319,1319,.14,'triangle',.12],[.16,1568,1568,.14,'triangle',.11],[.22,2093,2093,.3,'triangle',.1]],
    wrong:[[0,587,587,.15,'triangle',.2],[0,1174,1174,.13,'square',.018],[.16,440,415,.26,'triangle',.2],[.16,880,830,.24,'square',.018]],
    'streak-fanfare':[[0,900,320,.05,'sine',.14],[.04,784,784,.1,'triangle',.12],[.12,1047,1047,.1,'triangle',.12],[.2,1319,1319,.1,'triangle',.12],[.28,1568,1568,.38,'triangle',.12],[.28,784,784,.38,'triangle',.06]],
    round:[[0,523,523,.14,'triangle',.1],[.09,659,659,.14,'triangle',.1],[.18,784,784,.22,'triangle',.1]],
    result:[[0,523,523,.14,'triangle',.1],[.09,659,659,.14,'triangle',.1],[.18,784,784,.14,'triangle',.1],[.27,1047,1047,.34,'triangle',.1]],
    /* Dictation E9.12: a finished colour chunk (climbs an arpeggio per chunk),
       the word's "ta-da", and the soft last-seconds tick */
    'chunk-note':[[0,523,523,.2,'triangle',.11],[0,1046,1046,.14,'sine',.035],[.02,784,784,.16,'sine',.03]],
    tada:[[0,523,523,.14,'triangle',.17],[.06,659,659,.14,'triangle',.17],[.12,784,784,.14,'triangle',.17],[.2,1047,1047,.45,'triangle',.18],[.2,1568,1568,.45,'sine',.06]],
    tick:[[0,1400,900,.035,'triangle',.07],[0,2800,1800,.02,'sine',.015]],
    /* S12a (WordBar): a letter placed (climbs a step for each filled slot), a
       letter taken back, the word filled ("ready to check"), coins earned,
       coins spent, an impatient customer, and a warning (Rush Hour queue). */
    'letter-pop':[[0,520,980,.07,'sine',.18],[0,1040,1960,.04,'sine',.03]],
    'letter-back':[[0,760,440,.08,'sine',.14]],
    ready:[[0,784,784,.12,'triangle',.11],[.08,1175,1175,.24,'triangle',.11],[.08,1568,1568,.2,'sine',.03]],
    coin:[[0,1319,1319,.06,'triangle',.12],[.05,1760,1760,.16,'triangle',.11]],
    'coin-big':[[0,1319,1319,.06,'triangle',.12],[.05,1760,1760,.1,'triangle',.11],[.11,2093,2093,.24,'triangle',.1],[.11,1047,1047,.24,'sine',.04]],
    spend:[[0,1175,1175,.06,'triangle',.12],[.06,880,880,.12,'triangle',.11]],
    impatient:[[0,760,690,.07,'triangle',.12],[.09,690,620,.08,'triangle',.1]],
    warn:[[0,660,660,.09,'square',.04],[0,660,660,.09,'triangle',.1],[.13,660,660,.09,'square',.04],[.13,660,660,.09,'triangle',.1]]
  };
  const DICT_TRIM={tap:15.5,correct:3.3,'correct-combo':1.5,'correct-gold':1.3,wrong:-5.8,'streak-fanfare':-1.4,round:3.9,result:3,'chunk-note':12.4,tada:-3.9,tick:19.3,
    'letter-pop':8,'letter-back':7.3,ready:3.4,coin:3.1,'coin-big':1.7,spend:5.1,impatient:3.3,warn:0.1};
  /* WB_CUES_END */
  /* Sounds must not pile up. A cue that starts while a MORE important one is
     playing plays at half level; the same cue again within 70 ms is skipped.
     S12b (review S12A-B01): at most 3 cue groups really sound at once. At the
     cap a newcomer that is not more important is dropped; a more important
     one first fades out (30 ms) and stops the least important group playing. */
  const DICT_PRIORITY={'streak-fanfare':4,tada:4,'chunk-note':3,'correct-gold':3,'coin-big':3,correct:2,'correct-combo':2,result:2,round:2,ready:2,coin:2};
  const STACK_GAIN=.5,REPEAT_S=.07,MAX_AT_ONCE=3,EVICT_FADE=.03;let playingCues=[];
  const DICT_LEVEL=5*50/100;   /* Dictation: SFX_MAX 5 × default 50% */
  let fxBus=null,fxBusCtx=null;
  function dictBus(c){
    if(fxBus&&fxBusCtx===c)return fxBus;
    const g=c.createGain();let out=g;
    /* Dictation E9: a gentle safety net (4:1 above -10 dB, slow release); the
       old 20:1 squashed stacked sounds and pumped the next ones down. */
    try{const k=c.createDynamicsCompressor();k.threshold.value=-10;k.knee.value=6;k.ratio.value=4;k.attack.value=.003;k.release.value=.25;g.connect(k);out=k;}catch(e){}
    out.connect(c.destination);g.gain.value=DICT_LEVEL;fxBus=g;fxBusCtx=c;return g;
  }
  function dictNote(c,t0,[at,from,to,dur,wave,gain],scale=1){
    const t=t0+at,o=c.createOscillator(),g=c.createGain();gain*=scale;
    o.type=wave;o.frequency.setValueAtTime(from,t);if(to!==from)o.frequency.exponentialRampToValueAtTime(to,t+dur);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(dictBus(c));trackNode(o);o.addEventListener("ended",()=>{try{o.disconnect();g.disconnect();}catch(e){}},{once:true});
    o.start(t);o.stop(t+dur+.02);
    return {o,g};
  }
  /* fade a playing cue group out quickly and stop it (its oscillators end, so
     node counting and disconnects run through the normal "ended" path) */
  function evictCue(c,group){
    const now=c.currentTime;
    for(const {o,g} of group.nodes){
      try{g.gain.cancelScheduledValues(now);g.gain.setValueAtTime(Math.max(.0001,g.gain.value||.0001),now);g.gain.exponentialRampToValueAtTime(.0001,now+EVICT_FADE);}catch(e){}
      try{o.stop(now+EVICT_FADE+.005);}catch(e){}
    }
    group.end=Math.min(group.end,now+EVICT_FADE);
  }
  /* Combo: climbs a little (max +5 semitones), then grows richer; chunk notes
     climb a major arpeggio; letter pops climb a major scale per filled slot. */
  const CHUNK_STEPS=[0,4,7,12,16,19],POP_STEPS=[0,2,4,5,7,9,11,12];
  function cueShift(name,streak,step){
    if(name==="correct-combo")return Math.pow(2,Math.min(Math.max(streak-3,0)*2,5)/12);
    if(name==="chunk-note")return Math.pow(2,CHUNK_STEPS[Math.min(Math.max((step|0)-1,0),CHUNK_STEPS.length-1)]/12);
    if(name==="letter-pop")return Math.pow(2,POP_STEPS[Math.min(Math.max((step|0)-1,0),POP_STEPS.length-1)]/12);
    return 1;
  }
  function comboLayers(name,streak,shift){
    const out=[];
    if(name==="correct-combo"){if(streak>=5)out.push([.18,1047*shift,1047*shift,.24,'sine',.04]);if(streak>=8)out.push([.04,392*shift,392*shift,.3,'triangle',.06]);}
    return out;
  }
  function playCue(name,streak=0,step=0){
    const notes=DICT_CUES[name];if(!notes)return;
    const c=C();if(!c)return;
    try{
      const shift=cueShift(name,streak,step),all=notes.map(n=>shift===1?n:[n[0],n[1]*shift,n[2]*shift,n[3],n[4],n[5]]).concat(comboLayers(name,streak,shift));
      const t0=c.currentTime+.002,prio=DICT_PRIORITY[name]||1;let stack=1;
      playingCues=playingCues.filter(x=>x.end>c.currentTime);
      if(playingCues.some(x=>x.name===name&&t0-x.start<REPEAT_S))return;
      if(playingCues.length>=MAX_AT_ONCE){
        const lower=playingCues.filter(x=>x.prio<prio).sort((a,b)=>a.prio-b.prio||a.start-b.start);
        if(!lower.length)return;                       // equal or less important: dropped
        const victim=lower[0];evictCue(c,victim);playingCues=playingCues.filter(x=>x!==victim);
      }
      if(playingCues.some(x=>x.prio>prio))stack=STACK_GAIN;
      const group={name,prio,start:t0,end:t0+Math.max(...all.map(n=>n[0]+n[3])),nodes:[]};
      const scale=Math.pow(10,(DICT_TRIM[name]||0)/20)*stack;
      all.forEach(n=>group.nodes.push(dictNote(c,t0,n,scale)));
      playingCues.push(group);
      try{if(Array.isArray(window.__wbCueLog))window.__wbCueLog.push(name);}catch(e){}   /* tests only */
    }catch(e){/* sound never blocks play */}
  }
  const correctCueFor=(streak,gold)=>gold?"correct-gold":streak>=5&&streak%5===0?"streak-fanfare":streak>=3?"correct-combo":"correct";
  /* iPhone: Web Audio is muted by the ring/silent switch. As in Dictation,
     ask for a "playback" audio session on the first tap so effects and the
     voice are heard in silent mode; children turn sounds off in Settings or ⏸. */
  function playbackSession(){try{const s=navigator.audioSession;if(s&&s.type!=="playback")s.type="playback";}catch(e){}}
  document.addEventListener("pointerdown",playbackSession,{once:true,capture:true,passive:true});
  document.addEventListener("keydown",playbackSession,{once:true,capture:true});
  return {
    unlock(){playbackSession();if(sfxOn()||P()?.settings.petSounds!==false)C();playAmbient();},
    /* S9c: one entry point for the Dictation cues. */
    cue(name,{streak=0,step=0}={}){if(sfxOn())playCue(name,streak,step);},
    answer(correct,{streak=0,gold=false}={}){if(!sfxOn())return;const n=correct?correctCueFor(streak,gold):"wrong";playCue(n,streak);return n;},
    correctCueFor,
    sync(){
      if(ambientWanted&&musicOn())playAmbient();else pauseAmbient(false);
      if(activeNodes===0)scheduleSuspend(120);
    },
    /* S12a: the Dictation tap at Dictation's small-cue level (-18 dB). The
       old tap was about 11 dB quieter and a phone speaker barely played it. */
    tap(){ if(sfxOn()) playCue("tap"); },
    correct(){ if(!sfxOn())return; const r=Math.floor(Math.random()*3);
      if(r===0){tone(523,.12,"sine",.12);tone(659,.12,"sine",.12,.09);tone(784,.2,"sine",.12,.18);}
      else if(r===1){tone(587,.12,"sine",.12);tone(740,.18,"sine",.12,.1);}
      else{tone(494,.1,"sine",.1);tone(659,.1,"sine",.11,.08);tone(988,.22,"sine",.1,.16);}},
    wrong(){ if(sfxOn()) tone(330,.25,"sine",.08,0,262); },
    coin(big){ if(sfxOn()) playCue(big?"coin-big":"coin"); },
    star(){ if(!sfxOn())return; [523,659,784,1047].forEach((f,i)=>tone(f,.18,"sine",.1,i*.11)); },
    milestone(){ if(!sfxOn())return; [392,494,587,784,988].forEach((f,i)=>tone(f,.22,"sine",.1,i*.1)); },
    impatient(){ if(sfxOn()) playCue("impatient"); },
    celebrate(){ if(!sfxOn())return; [523,659,784,988,1175,1568].forEach((f,i)=>tone(f,.16,"sine",.09,i*.07)); },
    kitchenIngredient(step=1){ if(!sfxOn())return; const base=620+Math.min(7,Math.max(1,step))*38;tone(base,.07,"triangle",.07);tone(base*1.25,.09,"sine",.055,.055);noise(.035,.035,0,1500,1.8); },
    kitchenUnlock(){ if(!sfxOn())return; tone(392,.12,"sine",.08);tone(523,.14,"sine",.09,.09);tone(659,.16,"sine",.09,.18);tone(988,.24,"sine",.08,.3);noise(.08,.035,.27,2200,2.5); },
    /* Pet sounds are their own feature now — an independent toggle
       (settings.petSounds), noticeably louder than ordinary UI
       effects since they're a deliberate "tap the pet" delight. */
    pet(species,good){ const p=P(); if(p && p.settings.petSounds===false) return;
      /* Each call layers a noise burst (the "body" of the sound) with
         a pitch-sliding tone (the "voice") — beeps alone never read
         as animals, which is why the old dog/duck sounded wrong. */
      const bark=(w)=>{noise(.1,.5,w,650,1.1);tone(230,.11,"sawtooth",.3,w,95);};
      if(species==="dog"){ good? (bark(0),bark(.19)) : (noise(.28,.2,0,450,1,"lowpass"),tone(420,.3,"sine",.16,0,250)); } /* ruff-ruff! / whimper */
      else if(species==="cat"){ good? (tone(520,.16,"sine",.24,0,780),tone(780,.32,"sine",.22,.16,430)) : tone(500,.2,"sine",.14,0,380); } /* mee-oww */
      else if(species==="duck"){ const quack=(w)=>{tone(270,.13,"sawtooth",.3,w,175);tone(540,.13,"square",.13,w,350);noise(.05,.16,w,1300,2);}; quack(0); quack(.19); if(!good)quack(.42); } /* qwa qwa */
      else if(species==="chicken"){ for(let i=0;i<3;i++){noise(.05,.34,i*.11,950,2);tone(620,.055,"square",.2,i*.11,390);} tone(760,.22,"square",.26,.37,420); noise(.2,.22,.37,1100,1.4); } /* buk-buk-buk-KAW */
      else if(species==="pigeon"){ tone(430,.17,"sine",.28,0,295); noise(.14,.07,0,320,1,"lowpass"); tone(430,.17,"sine",.28,.23,295); } /* coo-coo */
      else if(species==="lion"){ noise(.55,.3,0,190,.8,"lowpass"); tone(115,.5,"sawtooth",.26,0,68); tone(88,.42,"sawtooth",.16,.1,58); } /* little roar */
      else if(species==="parrot"){ tone(1050,.09,"square",.22,0,1700); noise(.05,.14,0,2400,3); tone(1400,.12,"square",.2,.13,850); }
      else if(species==="rabbit"){ noise(.06,.3,0,150,1,"lowpass"); noise(.06,.3,.14,140,1,"lowpass"); } /* thump thump */
      else if(species==="koala"){ tone(180,.22,"sawtooth",.2,0,120); noise(.18,.12,.05,300,1,"lowpass"); } /* sleepy grumble */
      else if(species==="redpanda"){ tone(900,.08,"sine",.24,0,1300); tone(1100,.09,"sine",.22,.12,800); } /* squeaky huff */
      else if(species==="panda"){ tone(340,.18,"sawtooth",.24,0,230); tone(300,.2,"sine",.16,.2,200); } /* soft bleat */
      else if(species==="penguin"){ tone(700,.1,"square",.22,0,1050); tone(880,.12,"square",.2,.13,600); noise(.06,.12,0,2000,3); } /* trumpet squawk */
      else if(species==="raccoon"){ for(let i=0;i<4;i++) tone(950+i*80,.05,"square",.16,i*.07,700); } /* chitter trill */
      else if(species==="pig"){ const oink=(w)=>{tone(210,.12,"sawtooth",.3,w,130);noise(.09,.3,w,500,1.6);}; oink(0); oink(.2); } /* oink oink */
      else if(species==="squirrel"){ for(let i=0;i<3;i++) tone(1250,.05,"square",.2,i*.09,1600); } /* chip chip chip */
      else if(species==="tiger"){ noise(.4,.26,0,240,.9,"lowpass"); tone(140,.35,"sawtooth",.24,0,85); } /* proud chuff */
      else if(species==="pug"||species==="pugclassic"){ noise(.09,.4,0,420,1.3,"lowpass"); tone(160,.1,"sawtooth",.26,0,90); noise(.09,.4,.18,380,1.3,"lowpass"); tone(150,.1,"sawtooth",.24,.18,85); } /* snort snort */
      else if(species==="dachshund"){ const yip=(w)=>{noise(.06,.4,w,900,1.4);tone(420,.08,"sawtooth",.28,w,220);}; yip(0); yip(.15); if(good)yip(.3); } /* eager yips */
      else { tone(220,.08,"sine",.18); } },
    test(kind){ /* Settings "try it" buttons — bypass toggles so the
       user can verify their device actually produces sound */
      if(kind==="pet"){ tone(600,.07,"square",.2);tone(750,.07,"square",.2,.09); }
      else if(kind==="music"){ tone(392,.3,"sine",.14);tone(523.25,.3,"sine",.14,.32);tone(659.25,.45,"sine",.14,.64); }
      else { playCue("correct"); } },   /* S9c: Sound effects test = the Dictation chime */
    chatter(text){ if(!sfxOn()||!text)return;
      const n=Math.min(14, Math.round(text.length/4));
      for(let i=0;i<n;i++) tone(360+Math.random()*220,.05,"square",.055,i*.055); },
    /* Long pre-rendered tracks use HTML media playback, avoiding
       continuous creation of oscillator and gain nodes during play. */
    ambientStart(){ambientWanted=true;playAmbient();rampAmbient();},
    speechStart(){speechHold++;pauseAmbient(false);clearTimeout(speechHoldTimer);
      speechHoldTimer=setTimeout(()=>{speechHold=0;playAmbient();},15000);},   // safety: never stay silent
    speechEnd(){speechHold=Math.max(0,speechHold-1);if(!speechHold){clearTimeout(speechHoldTimer);speechHoldTimer=null;playAmbient();}},
    ambientStop(){ambientWanted=false;ambientIntense=false;pauseAmbient(true);},
    /* Lifts the ambient track for a moment of excitement (Pet Pop Fever).
       Volume only — no pitch or rate change, which would sound wrong on a
       pre-rendered track. Ramps over ~260ms so it swells rather than
       jumping, and always settles back to the base level. */
    ambientIntensity(on){
      ambientIntense=!!on;rampAmbient();
    },
    previewTrack(trackId){
      stopPreview();
      const id=normaliseMusicTrackId(trackId);
      previewEl=document.createElement("audio");previewEl.setAttribute("playsinline","");
      previewEl.src=`audio/${MUSIC_TRACKS[id].file}?v=85`;previewEl.preload="auto";previewEl.volume=.42;
      try{const pr=previewEl.play();if(pr&&pr.catch)pr.catch(()=>{});}catch(e){}
      previewTimer=setTimeout(stopPreview,3600);
    }
  };
})();

/* ---------- TTS: pronunciation + celebration/encouragement voice ----------
   Real pronunciation via the browser's speech synthesis (UK voice
   preferred); the written guide alongside it comes from the reviewed
   PHONICS table (see phonics.js), never from spelling rules. Celebration voice is a SEPARATE toggle from pronunciation
   — a player might want one without the other. It speaks short,
   genuinely encouraging lines at real moments (a perfect ticket, an
   achievement, a streak) rather than on every answer, so it stays a
   delight rather than a nag. */
const CELEBRATION_LINES = ["Brilliant!","Well done!","You're on fire!","Fantastic work!","Amazing!",
  "Keep it up!","Wonderful!","Superb!","Nailed it!","You're a star!","Lovely work!","Excellent!"];
const ANIMAL_VOICE_LINES = {
  dog:["Woof! Great job!","Bark bark, well done!","Woof woof, brilliant!"],
  cat:["Meow, nicely done.","Purrfect!","Meow meow, lovely."],
  parrot:["Squawk! Brilliant!","Well done, well done!","Squawk, clever one!"],
  rabbit:["Nice work — hop hop hooray!","Binky-hop, well done!"],
  lion:["Roar! Mighty work!","A roar of approval!","Rawr, word champion!"],
  pigeon:["Coo coo, very good!","Coo! Top marks!"],
  chicken:["Buk buk buk-KAW! Egg-cellent!","Cluck cluck, well done!"],
  duck:["Quack quack, wonderful!","Quack! That's the one!"]
};
/* Voice choice honours the settings.voiceGender preference.
   NB: the male test uses \bmale\b — a bare /male/i would also match
   the word "Female" (it's a substring), silently inverting the
   setting on many devices. Preferred-gender British voices first,
   then any-English preferred gender, then neutral fallbacks. */
/* Build 86g-phase10: pronunciation is selected with a BCP 47 language tag
   (RFC 5646) — "en-GB" for British English and "en-US" for American English,
   the standard identifiers the Web Speech API itself matches voices against.
   Both the utterance's `lang` and the chosen `voice` are derived from the
   same tag so they can never disagree; previously `lang` was hardcoded to
   "en-GB" even when the fallback chain had selected a non-GB voice, which is
   undefined behaviour across browsers. */
const PRONUNCIATION_LOCALES = {uk:"en-GB", us:"en-US"};
function pronunciationLocale(){
  const p=P();
  return PRONUNCIATION_LOCALES[(p&&p.settings&&p.settings.pronunciation)]||"en-GB";
}
/* S9a: voice choice copied from WordBar Dictation (D8.2).
   - One setting = accent + gender (settings.pronunciation + settings.voiceGender),
     shown in Settings as a single "Voice" list: British/US × Female/Male.
   - UK and US voices only. Never: Kathy, the old robotic voices, Apple's novelty
     voices. Apple's older "Eloquence" voices only if nothing else exists, except
     British Shelley, the British alternative on iPhone.
   - Gender first, then accent, then preferred names, Premium/Enhanced, on-device.
   - iPhone/iPad don't give websites their natural British female voices, so
     British Female there is Samantha (US); "Try another voice" offers Shelley.
   - settings.voicePick = "<preset>|<voiceURI>" remembers a "Try another voice"
     choice; it is ignored as soon as the accent/gender changes. */
const FEMALE_VOICE_HINT=/\bfemale\b|Samantha|Ava|Allison|Susan|Zira|Jenny|Aria|Michelle|Nicole|Victoria|Karen|Nicky|Kathy|Sonia|Libby|Kate|Serena|Martha|Hazel|Stephanie|Moira|Tessa|Fiona|Amy|Emma|Olivia|Emily|Alice|Shelley|Grandma|Google US English\b/i;
const MALE_VOICE_HINT=/\bmale\b|Alex\b|Aaron|Fred|Guy|Eric|Christopher|Roger|Steffan|Tom\b|Nathan|Junior|Daniel|Arthur|George|Ryan|Oliver|Thomas|James|Gordon|Eddy|Reed|Rocko|Grandpa|David|Mark\b|Rishi/i;
const VOICE_BLOCKED=/\b(Kathy|Agnes|Albert|Bruce|Fred|Junior|Princess|Ralph|Vicki|Victoria|Bad News|Good News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;
const VOICE_ELOQUENCE=/\b(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;
const VOICE_PREFER={"en-gb|female":["Kate","Serena","Stephanie","Martha","Libby","Sonia","Hazel"],"en-us|female":["Samantha","Ava","Allison","Susan","Zoe","Nicky"],
  "en-gb|male":["Daniel","Arthur","Oliver","George","Ryan"],"en-us|male":["Alex","Aaron","Tom","Evan","Nathan"]};
const VOICE_PRESETS=[["uk-female","British — Female"],["uk-male","British — Male"],["us-female","US — Female"],["us-male","US — Male"]];
function voiceSignature(voice){return `${voice&&voice.name||""} ${voice&&voice.voiceURI||""} ${voice&&voice.gender||""}`}
const voiceLang=v=>String(v&&v.lang||"").replace("_","-").toLowerCase();
const voiceIsRobotic=v=>VOICE_ELOQUENCE.test(String(v&&v.name||""));
const voiceIsBritishShelley=v=>/\bShelley\b/i.test(String(v&&v.name||""))&&voiceLang(v)==="en-gb";
function usableVoices(list){
  const en=(list||[]).filter(v=>/^en([-_]|$)/i.test(v.lang||""));
  const ok=v=>!VOICE_BLOCKED.test(String(v.name||""));
  let natural=en.filter(v=>ok(v)&&(!voiceIsRobotic(v)||voiceIsBritishShelley(v)));
  if(natural.length&&natural.every(voiceIsBritishShelley))natural=[];
  const eloq=en.filter(v=>ok(v)&&voiceIsRobotic(v));
  const pool=natural.length?natural:eloq.length?eloq:en;
  const ukus=pool.filter(v=>/^en[-_](gb|us)$/i.test(v.lang||""));
  return ukus.length?ukus:pool;
}
function currentVoicePreset(){
  const s=(P()&&P().settings)||{};
  return `${s.pronunciation==="us"?"us":"uk"}-${s.voiceGender==="male"?"male":"female"}`;
}
function rankVoices(list,presetId){
  const [acc,gender]=String(presetId||currentVoicePreset()).split("-");
  const lang=acc==="us"?"en-us":"en-gb";
  const want=gender==="male"?MALE_VOICE_HINT:FEMALE_VOICE_HINT,avoid=gender==="male"?FEMALE_VOICE_HINT:MALE_VOICE_HINT;
  const tier=v=>{const s=voiceSignature(v);return want.test(s)?0:!avoid.test(s)?1:2;};
  const nameRank=v=>{const names=VOICE_PREFER[`${voiceLang(v)}|${gender==="male"?"male":"female"}`]||[];const n=String(v.name||"");const i=names.findIndex(x=>new RegExp(`\\b${x}\\b`,"i").test(n));return i<0?99:i;};
  const quality=v=>{const s=`${v.name||""} ${v.voiceURI||""}`;return /premium/i.test(s)?0:/enhanced/i.test(s)?1:2;};
  return usableVoices(list).map((v,i)=>({v,i})).sort((a,b)=>tier(a.v)-tier(b.v)||(voiceIsRobotic(a.v)?1:0)-(voiceIsRobotic(b.v)?1:0)
    ||(voiceLang(a.v)===lang?0:1)-(voiceLang(b.v)===lang?0:1)||nameRank(a.v)-nameRank(b.v)||quality(a.v)-quality(b.v)
    ||((a.v.localService!==false)?0:1)-((b.v.localService!==false)?0:1)||a.i-b.i).map(x=>x.v);
}
function pickVoice(vs,locale){
  const preset=currentVoicePreset(),list=Array.isArray(vs)?vs:[];
  const pick=String((P()&&P().settings&&P().settings.voicePick)||"");
  if(pick.startsWith(preset+"|")){const uri=pick.slice(preset.length+1);const chosen=usableVoices(list).find(v=>v.voiceURI===uri);if(chosen)return chosen;}
  return rankVoices(list,preset)[0]||null;
}
function isAppleTouchDevice(){const n=typeof navigator!=="undefined"?navigator:{};return /iPhone|iPad|iPod/.test(n.userAgent||"")||(n.platform==="MacIntel"&&n.maxTouchPoints>1);}
/* Plain-English note under the Voice choice (same wording as Dictation). */
function voiceNoteText(){
  if(!Voice.supported())return "This browser has no spoken voice, so words can't be read aloud.";
  const voices=speechSynthesis.getVoices();if(!voices.length)return "Waiting for this device’s voices…";
  const v=pickVoice(voices);if(!v)return "No English voice was found on this device.";
  const preset=currentVoicePreset(),wantLang=preset.startsWith("us")?"en-us":"en-gb";
  const accent=l=>/^en-gb$/.test(l)?"British":/^en-us$/.test(l)?"US":l;
  const who=`${String(v.name).replace(/\s*\(.*\)\s*$/,"")} (${accent(voiceLang(v))})`;
  const genderOk=(preset.endsWith("male")&&!preset.endsWith("female")?MALE_VOICE_HINT:FEMALE_VOICE_HINT).test(voiceSignature(v));
  if(voiceIsRobotic(v))return `Using ${who}. This is one of Apple’s older voices, so it sounds a little robotic.`;
  if(isAppleTouchDevice()&&preset==="uk-female"&&voiceLang(v)!=="en-gb")return `iPhone and iPad don’t let websites use Apple’s natural British female voices, so ${who} reads the words. For a British accent, tap “Try another voice” to use Shelley (British, a little robotic).`;
  if(voiceLang(v)===wantLang&&genderOk)return `Using ${who}${v.localService===false?", an online voice":""}.`;
  let note=`Closest voice on this device: ${who}.`;
  if(!isAppleTouchDevice()&&voiceLang(v)!=="en-gb"&&wantLang==="en-gb")note+=" For a British voice on Android, add English (UK) in Settings → Text-to-speech.";
  return note;
}
/* "Try another voice": next voice of the same gender (else any), remembered. */
function nextVoicePick(){
  const p=P();if(!p||!Voice.supported())return null;
  const preset=currentVoicePreset(),voices=speechSynthesis.getVoices();
  const want=preset.endsWith("-male")?MALE_VOICE_HINT:FEMALE_VOICE_HINT;
  const ranked=rankVoices(voices,preset);let pool=ranked.filter(v=>want.test(voiceSignature(v)));
  if(pool.length<2)pool=ranked;if(pool.length<2)return null;
  const cur=pickVoice(voices),i=pool.findIndex(v=>cur&&v.voiceURI===cur.voiceURI),n=pool[(i+1)%pool.length];
  p.settings.voicePick=`${preset}|${n.voiceURI}`;persist();return n;
}
/* Returns a lang/voice pair that always agree, so an utterance can never be
   tagged en-GB while speaking with an American voice or vice versa. */
function voiceSelection(voices){
  const lang=pronunciationLocale();
  const voice=pickVoice(Array.isArray(voices)?voices:speechSynthesis.getVoices(),lang);
  return {lang: (voice&&voice.lang) || lang, voice};
}
const Voice={
  /* Capability + preference gates (audio QA #1–3): `supported` is a
     one-off API check; `available` also honours the player's voice
     toggle. UI that offers pronunciation (and pays listening rewards)
     must check available() first — a silent button must never exist,
     let alone pay coins. */
  supported(){ return ("speechSynthesis" in window)&&("SpeechSynthesisUtterance" in window); },
  available(){ const p=P(); return this.supported() && !!(p&&p.settings.voice); },
  _cancelSpeech(){
    clearTimeout(this._voiceRetry);this._voiceRetry=null;
    clearTimeout(this._voiceWatchdog);this._voiceWatchdog=null;
    this._voiceRequest=(this._voiceRequest||0)+1;
    try{speechSynthesis.cancel();}catch(e){}
    const finish=this._pendingVoiceResolve;this._pendingVoiceResolve=null;
    if(finish)finish("cancelled");
  },
  cancel(){
    this._cancelSpeech();
  },
  speak(text,options){return this.speakAsync(text,options);},
  speakAsync(text,{rate,pitch=1.05,timeoutMs=0}={}){
    if(rate==null){const r=Number(P()&&P().settings&&P().settings.voiceRate);rate=Number.isFinite(r)?r:.92;}
    if(!this.available()||!String(text||"").trim())return Promise.resolve("unavailable");
    this._cancelSpeech();
    const request=this._voiceRequest,spoken=String(text).trim();
    return new Promise(resolve=>{
      let settled=false;
      let held=false;
      const finish=reason=>{
        if(settled)return;settled=true;
        if(held){held=false;try{AudioKit.speechEnd();}catch(e){}}
        clearTimeout(this._voiceRetry);this._voiceRetry=null;
        clearTimeout(this._voiceWatchdog);this._voiceWatchdog=null;
        if(this._pendingVoiceResolve===finish)this._pendingVoiceResolve=null;
        resolve(reason);
      };
      this._pendingVoiceResolve=finish;
    /* Some browsers expose an empty voice list for a short time after the
       page opens. My Words can be reached before `voiceschanged` fires; if
       speech starts then, the browser uses its default voice instead of the
       player's selected gender. Wait briefly for the inventory, then use the
       same selected voice as every other pronunciation surface. */
    const speakWhenReady=attempt=>{
      if(request!==this._voiceRequest||!this.available()){finish("cancelled");return;}
      try{
        const voices=speechSynthesis.getVoices();
        if(!voices.length&&attempt<8){
          this._voiceRetry=setTimeout(()=>speakWhenReady(attempt+1),125);
          return;
        }
        this._voiceRetry=null;
        const u=new SpeechSynthesisUtterance(spoken);u.rate=Math.max(.5,Math.min(1.5,Number(rate)||.92));u.pitch=Math.max(.5,Math.min(1.5,Number(pitch)||1.05));
        /* explicit lang — device default may be non-English (audio QA #1);
           paired with its voice so the two always agree (phase10). */
        const sel=voiceSelection(voices); u.lang=sel.lang; u.voice=sel.voice;
        u.onend=()=>finish("ended");u.onerror=()=>finish("error");
        if(!held){held=true;try{AudioKit.speechStart();}catch(e){}}
        speechSynthesis.speak(u);
        const watchdog=Number(timeoutMs)>0?Number(timeoutMs):Math.max(2500,Math.min(12000,spoken.length*260+2200));
        this._voiceWatchdog=setTimeout(()=>{try{speechSynthesis.cancel();}catch(e){}finish("timeout");},watchdog);
      }catch(e){finish("error");}
    };
    speakWhenReady(0);
    });
  },
  preview(text){ if(!this.supported())return; /* settings "Try it" works even with the toggle off, like the other test buttons */
    this.cancel();try{
      const r=Number(P()&&P().settings&&P().settings.voiceRate);
      const u=new SpeechSynthesisUtterance(text); u.rate=Number.isFinite(r)?r:.92; u.pitch=1.05;
      try{AudioKit.speechStart();}catch(e){}let done=false;const end=()=>{if(done)return;done=true;try{AudioKit.speechEnd();}catch(e){}};
      u.onend=end;u.onerror=end;setTimeout(end,12000);
      const sel=voiceSelection(); u.lang=sel.lang; u.voice=sel.voice;
      speechSynthesis.speak(u);
    }catch(e){}},
  /* S9a: iPhone only lets a page speak after a tap. A silent space spoken on the
     first tap unlocks speech, so later words (started from timers) aren't lost. */
  prime(){ if(!this.supported()||this._primed)return; try{const u=new SpeechSynthesisUtterance(" ");u.volume=0;speechSynthesis.speak(u);this._primed=true;}catch(e){} },
  celebrate(){ const p=P(); if(!p?.settings.celebVoice||!("speechSynthesis" in window))return;
    this.cancel();try{
      const line=CELEBRATION_LINES[Math.floor(Math.random()*CELEBRATION_LINES.length)];
      const u=new SpeechSynthesisUtterance(line); u.rate=1; u.pitch=1.1;
      const sel=voiceSelection(); u.lang=sel.lang; u.voice=sel.voice;
      speechSynthesis.speak(u);
    }catch(e){}},
  animal(species){ const p=P(); if(!p?.settings.celebVoice||!("speechSynthesis" in window))return;
    this.cancel();try{
      const lines=ANIMAL_VOICE_LINES[species]||["Great job!"];
      const line=lines[Math.floor(Math.random()*lines.length)];
      const u=new SpeechSynthesisUtterance(line); u.rate=1.05;
      const sel=voiceSelection(); u.lang=sel.lang; u.voice=sel.voice;
      u.pitch = species==="parrot"?1.4 : species==="cat"?1.2 : species==="lion"?.8 : 1;
      speechSynthesis.speak(u);
    }catch(e){}}
};
if("speechSynthesis" in window) speechSynthesis.getVoices();
/* S9a: prime speech on the first tap of each visit (and after returning to the app). */
if(typeof document!=="undefined"){
  const primeOnTap=()=>{try{Voice.prime();}catch(e){}};
  document.addEventListener("pointerdown",primeOnTap,{capture:true,passive:true});
  document.addEventListener("keydown",primeOnTap,{capture:true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)Voice._primed=false;});
}

function phoneticOf(word){
  /* Reviewed guides only (QA P0): look up the curated PHONICS table.
     Returns "" for anything unknown — callers hide the written guide
     and the 🔊 button still speaks the word. Never guess from
     spelling: a wrong guide printed for a child is worse than none. */
  if(!word) return "";
  return (typeof PHONICS!=="undefined" && PHONICS[String(word).toLowerCase()]) || "";
}

/* ---------- Achievements & the Word Kraken mastery ladder ----------
   Cosmetic only — no coin rewards, so achievements never compete
   with or trivialise the coin-based theme unlocks. The full
   ladder is shown up-front (so players can see the road ahead);
   only the final secret tier stays hidden until truly earned. */
/* Rescaled for the expanded 799-word bank (verified count) — one
   extra rung so the climb keeps a steady rhythm to the top. */
const WORD_KRAKEN_LADDER = COURSES.elevenPlus.learning.kraken;
function krakenLadder(courseId=activeCourseId()){
  return (COURSES[courseId]||COURSES.elevenPlus).learning.kraken;
}
function krakenTier(courseId=activeCourseId()){
  const m=masteredCount(),ladder=krakenLadder(courseId);let cur=null,next=ladder[0];
  for(const t of ladder){if(m>=t.count)cur=t;else{next=t;break;}if(t===ladder[ladder.length-1])next=null;}
  return {mastered:m,current:cur,next:m>=ladder[ladder.length-1].count?null:next};
}

/* NOTE: the old "Learning" trophy category (word-mastery milestones)
   was removed deliberately — it duplicated the Word Kraken ladder,
   which is the single home for mastery ranks now. Old earned ids
   simply stop displaying; nothing breaks. */
const ACHIEVEMENTS = [
  {id:"first_correct",  cat:"play",   title:"First Ten",                  desc:"Get 10 answers right.",                       check:p=>(p._lifetimeCorrect||0)>=10},
  {id:"answers_50",     cat:"play",   title:"50 questions answered",      desc:"Warming up nicely.",                         check:p=>(p._lifetimeAnswers||0)>=50},
  {id:"answers_250",    cat:"play",   title:"250 questions answered",     desc:"A proper regular.",                          check:p=>(p._lifetimeAnswers||0)>=250},
  {id:"answers_1000",   cat:"play",   title:"1,000 questions answered",   desc:"Extraordinary dedication.",                  check:p=>(p._lifetimeAnswers||0)>=1000},
  {id:"streak_10",      cat:"play",   title:"10-streak",                  desc:"Ten correct in a row, same session.",        check:p=>(p._bestSessionStreak||0)>=10},
  {id:"return_3",       cat:"return", title:"Welcome back",               desc:"Played on 3 different days.",                check:p=>(p.playDays||[]).length>=3},
  {id:"return_7",       cat:"return", title:"A real regular",             desc:"Played on 7 different days.",                check:p=>(p.playDays||[]).length>=7},
  {id:"normal_done",    cat:"mode",   title:"Shift complete",             desc:"Finish a Normal session.",                   check:p=>(p._normalDone||0)>=1},
  {id:"time_done",      cat:"mode",   title:"Beat the clock",             desc:"Finish a Time Challenge session.",           check:p=>(p._timeDone||0)>=1},
  {id:"time_beat_best",  cat:"mode",  title:"Personal best!",             desc:"Beat your own Time Challenge score.",        check:p=>(p._timeBeatOwnBest||0)>=1},
  {id:"review_done",    cat:"mode",   title:"Caught up",                  desc:"Finish a Review session.",                   check:p=>(p._reviewDone||0)>=1},
  {id:"first_theme",    cat:"fun",    title:"New look",                   desc:"Unlock your first café theme.",              check:p=>Object.keys(THEMES).some(k=>k!=="sunny"&&((p.lifetime||0)>=THEMES[k].unlock||(p._themesSeen||[]).includes(k)))},
  {id:"met_pet",        cat:"fun",    title:"New friend!",                desc:"Meet the surprise café pet.",                check:p=>(p.petsMet||[]).length>=1},
  {id:"all_themes",     cat:"fun",    title:"Collector",                  desc:"Unlock every café theme.",                   check:p=>Object.keys(THEMES).every(k=>(p.lifetime||0)>=THEMES[k].unlock||(p._themesSeen||[]).includes(k))},
  /* ---- expansion set: so there is always a next trophy in sight ---- */
  {id:"answers_100",    cat:"play",   title:"Century Answerer",           desc:"Answer 100 questions.",                      check:p=>(p._lifetimeAnswers||0)>=100},
  {id:"answers_500",    cat:"play",   title:"Question Crusher",           desc:"Answer 500 questions.",                      check:p=>(p._lifetimeAnswers||0)>=500},
  {id:"answers_2500",   cat:"play",   title:"Unstoppable",                desc:"Answer 2,500 questions.",                    check:p=>(p._lifetimeAnswers||0)>=2500},
  {id:"streak_5",       cat:"play",   title:"High Five",                  desc:"Five correct in a row, same session.",       check:p=>(p._bestSessionStreak||0)>=5},
  {id:"streak_20",      cat:"play",   title:"Twenty Terrific",            desc:"Twenty correct in a row, same session.",     check:p=>(p._bestSessionStreak||0)>=20},
  {id:"perfect_1",      cat:"play",   title:"Flawless Shift",             desc:"Finish a session with 100% accuracy (3+ customers).", check:p=>(p._perfectSessions||0)>=1},
  {id:"perfect_5",      cat:"play",   title:"Perfection Habit",           desc:"Five flawless sessions.",                    check:p=>(p._perfectSessions||0)>=5},
  /* ---- 2026 expansion: +10 playing ---- */
  {id:"correct_100",    cat:"play",   title:"Hundred Club",               desc:"Get 100 answers right (lifetime).",          check:p=>(p._lifetimeCorrect||0)>=100},
  {id:"correct_1000",   cat:"play",   title:"Word Machine",               desc:"Get 1,000 answers right (lifetime).",        check:p=>(p._lifetimeCorrect||0)>=1000},
  {id:"answers_5000",   cat:"play",   title:"Five Thousand?!",            desc:"Answer 5,000 questions. Astonishing.",       check:p=>(p._lifetimeAnswers||0)>=5000},
  {id:"streak_15",      cat:"play",   title:"Fifteen on Fire",            desc:"Fifteen correct in a row, same session.",    check:p=>(p._bestSessionStreak||0)>=15},
  {id:"streak_30",      cat:"play",   title:"Thirty & Thriving",          desc:"Thirty correct in a row, same session.",     check:p=>(p._bestSessionStreak||0)>=30},
  {id:"perfect_10",     cat:"play",   title:"Ten out of Ten (out of Ten)",desc:"Ten flawless sessions.",                     check:p=>(p._perfectSessions||0)>=10},
  {id:"perfect_25",     cat:"play",   title:"Perfection Collection",      desc:"Twenty-five flawless sessions.",             check:p=>(p._perfectSessions||0)>=25},
  {id:"sessions_10",    cat:"play",   title:"Ten Shifts Deep",            desc:"Play 10 sessions.",                          check:p=>(p.sessions||0)>=10},
  {id:"sessions_50",    cat:"play",   title:"Shift Supervisor",           desc:"Play 50 sessions.",                          check:p=>(p.sessions||0)>=50},
  {id:"tips_best_150",  cat:"play",   title:"Big Tipper Magnet",          desc:"Earn 150 tips in a single session.",         check:p=>(p.best&&p.best.tips||0)>=150},
  {id:"return_14",      cat:"return", title:"Fortnight Friend",           desc:"Play on 14 different days.",                 check:p=>(p.playDays||[]).length>=14},
  {id:"return_30",      cat:"return", title:"Monthly Regular",            desc:"Play on 30 different days.",                 check:p=>(p.playDays||[]).length>=30},
  {id:"weekend_3",      cat:"return", title:"Weekend Warrior",            desc:"Play 3 weekend sessions.",                   check:p=>(p._weekendSessions||0)>=3},
  {id:"rush_done",      cat:"mode",   title:"Rush Survivor",              desc:"Serve 10 customers in one Rush Hour.",       check:p=>(p.best&&p.best.rush||0)>=10},
  {id:"rush_25",        cat:"mode",   title:"Rush Master",                desc:"Serve 25 customers in one Rush Hour.",       check:p=>(p.best&&p.best.rush||0)>=25},
  {id:"time_15",        cat:"mode",   title:"Speed Demon",                desc:"Serve 15 customers in one Time Challenge.",  check:p=>(p._timeBestServed||0)>=15},
  {id:"review_5",       cat:"mode",   title:"Revision Pro",               desc:"Finish 5 review sessions.",                  check:p=>(p._reviewCount||0)>=5},
  {id:"ladder_5",       cat:"mode",   title:"Ladder Climber",             desc:"Solve 5 word ladders.",                      check:p=>(p._laddersDone||0)>=5},
  /* ---- 2026 expansion: +10 modes ---- */
  {id:"all_modes",      cat:"mode",   title:"Tried Everything Once",      desc:"Play Normal, Time Challenge, Rush Hour AND Review.", check:p=>(p._normalDone||0)>=1&&(p._timeDone||0)>=1&&(p._rushDone||0)>=1&&(p._reviewDone||0)>=1},
  {id:"normal_10",      cat:"mode",   title:"Regular Rhythm",             desc:"Finish 10 Normal sessions.",                 check:p=>(p._normalDone||0)>=10},
  {id:"time_10",        cat:"mode",   title:"Clockwork Barista",          desc:"Finish 10 Time Challenges.",                 check:p=>(p._timeDone||0)>=10},
  {id:"rush_5runs",     cat:"mode",   title:"Rush Regular",               desc:"Brave Rush Hour 5 times.",                   check:p=>(p._rushDone||0)>=5},
  {id:"rush_15",        cat:"mode",   title:"Peak Hour Pro",              desc:"Serve 15 customers in one Rush Hour.",       check:p=>(p.best&&p.best.rush||0)>=15},
  {id:"rush_40",        cat:"mode",   title:"Queue Whisperer",            desc:"Serve 40 customers in one Rush Hour.",       check:p=>(p.best&&p.best.rush||0)>=40},
  {id:"time_20",        cat:"mode",   title:"Lightning Service",          desc:"Serve 20 customers in one Time Challenge.",  check:p=>(p._timeBestServed||0)>=20},
  {id:"review_15",      cat:"mode",   title:"Repeat Revision Royalty",    desc:"Finish 15 review sessions.",                 check:p=>(p._reviewCount||0)>=15},
  {id:"ladder_15",      cat:"mode",   title:"Sky Climber",                desc:"Solve 15 word ladders.",                     check:p=>(p._laddersDone||0)>=15},
  {id:"ladder_30",      cat:"mode",   title:"Ladder to the Moon",         desc:"Solve 30 word ladders.",                     check:p=>(p._laddersDone||0)>=30},
  {id:"pets_5",         cat:"regulars",title:"Petting Zoo",               desc:"Say hello to 5 different pets.",             check:p=>(p.petsMet||[]).length>=5},
  {id:"pets_all",       cat:"regulars",title:"Best Friend of ALL",        desc:"Say hello to every pet.",                    check:p=>(p.petsMet||[]).length>=PETS.length},
  {id:"cust_15",        cat:"regulars",title:"Friendly Face",             desc:"Serve 15 different customers.",              check:p=>(p._custServed||[]).length>=15},
  {id:"cust_all",       cat:"regulars",title:"Knows Everybody",           desc:"Serve every single customer.",               check:p=>(p._custServed||[]).length>=CUSTOMERS.length},
  {id:"unlock_5",       cat:"regulars",title:"Door's Open",               desc:"Reveal 5 new faces at the café.",            check:p=>Math.min(p._unlocksSeen||0,unlockSequence().length)>=5},
  {id:"unlock_all",     cat:"regulars",title:"Full House",                desc:"Reveal every customer and pet there is.",    check:p=>(p._unlocksSeen||0)>=unlockSequence().length},
  {id:"foods_all",      cat:"regulars",title:"Menu Explorer",             desc:"Serve all five Classic Menu foods.",          check:p=>LEGACY_CLASSIC_MENU_FOODS.every(id=>(p._foodsTried||[]).includes(id))},
  /* ---- Kitchen expansion trophies: kept separate so legacy mode and
     Menu Explorer requirements never change after an update. ---- */
  {id:"kitchen_first", cat:"kitchen",title:"First Course",                 desc:"Unlock your first Kitchen recipe.",    check:p=>KITCHEN_CHALLENGE_FOODS.filter(f=>p.kitchen?.unlockedFoods?.includes(f.id)).length>=1},
  {id:"kitchen_5",     cat:"kitchen",title:"Kitchen Apprentice",           desc:"Unlock 5 Kitchen recipes.",           check:p=>KITCHEN_CHALLENGE_FOODS.filter(f=>p.kitchen?.unlockedFoods?.includes(f.id)).length>=5},
  {id:"kitchen_10",    cat:"kitchen",title:"Sous-Chef",                    desc:"Unlock 10 Kitchen recipes.",          check:p=>KITCHEN_CHALLENGE_FOODS.filter(f=>p.kitchen?.unlockedFoods?.includes(f.id)).length>=10},
  {id:"kitchen_all",   cat:"kitchen",title:"Head Chef",                    desc:"Unlock every Kitchen recipe.",      check:p=>KITCHEN_CHALLENGE_FOODS.every(f=>p.kitchen?.unlockedFoods?.includes(f.id))},
  {id:"kitchen_perfect",cat:"kitchen",title:"Clean Cook",                  desc:"Win one Kitchen challenge with no mistakes.", check:p=>(p.kitchen?.stats?.perfectWins||0)>=1},
  {id:"kitchen_perfect_5",cat:"kitchen",title:"Perfect Prep",              desc:"Win 5 Kitchen challenges with no mistakes.",  check:p=>(p.kitchen?.stats?.perfectWins||0)>=5},
  {id:"kitchen_fast",  cat:"kitchen",title:"Beat the Heat",               desc:"Win a Kitchen challenge with 30 seconds left.",check:p=>Object.values(p.kitchen?.bestByFood||{}).some(b=>(b?.bestCorrect||0)>=7&&(b?.bestRemaining||0)>=30)},
  {id:"conveyor_25",   cat:"kitchen",title:"Conveyor Captain",            desc:"Get 25 Letter Conveyor answers correct.",     check:p=>(p.kitchen?.stats?.modeCorrect?.conveyor||0)>=25},
  {id:"scramble_25",   cat:"kitchen",title:"Scramble Specialist",          desc:"Get 25 Word Scramble answers correct.",       check:p=>(p.kitchen?.stats?.modeCorrect?.scramble||0)>=25},
  {id:"path_25",       cat:"kitchen",title:"Pathfinder Chef",              desc:"Get 25 Word Path answers correct.",           check:p=>(p.kitchen?.stats?.modeCorrect?.path||0)>=25},
  {id:"drinks_all",     cat:"regulars",title:"Thirsty Work",              desc:"Serve every kind of drink.",                 check:p=>(p._drinksTried||[]).length>=Object.keys(DRINK_KINDS).length},
  {id:"tips_1000",      cat:"fun",    title:"Tip Jar Tycoon",             desc:"Earn 1,000 lifetime coins.",                  check:p=>(p.lifetime||0)>=1000},
  /* ---- 2026 expansion: +10 fun & collecting ---- */
  {id:"tips_2500",      cat:"fun",    title:"Coin Mountain",              desc:"Earn 2,500 lifetime coins.",                  check:p=>(p.lifetime||0)>=2500},
  {id:"tips_5000",      cat:"fun",    title:"Café Tycoon",                desc:"Earn 5,000 lifetime coins.",                  check:p=>(p.lifetime||0)>=5000},
  {id:"tips_10000",     cat:"fun",    title:"The Golden Barista",         desc:"Earn 10,000 lifetime coins. Legendary.",      check:p=>(p.lifetime||0)>=10000},
  {id:"shop_2",         cat:"fun",    title:"First Treats",               desc:"Own 4 shop items.",                          check:p=>(p.owned||[]).length>=4},
  {id:"shop_6",         cat:"fun",    title:"Shopping Spree",             desc:"Own 6 shop items.",                          check:p=>(p.owned||[]).length>=6},
  {id:"shop_legendary", cat:"fun",    title:"Legendary Taste",            desc:"Own a Legendary shop item.",                 check:p=>(p.owned||[]).some(id=>{const it=SHOP.find(s=>s.id===id);return it&&it.tier==="Legendary";})},
  {id:"decor_3",        cat:"fun",    title:"Interior Designer",          desc:"Have 4 café decorations placed at once.",    check:p=>Object.keys((p.placed&&p.placed.cafe)||{}).length>=4},
  {id:"avatar_2",       cat:"fun",    title:"Dressed for Service",        desc:"Wear 3 avatar accessories at once.",         check:p=>Object.keys((p.placed&&p.placed.avatar)||{}).length>=3},
  {id:"themes_3",       cat:"fun",    title:"Redecorator",                desc:"Unlock 3 café themes.",                      check:p=>Object.keys(THEMES).filter(k=>THEMES[k].unlock>0&&((p.lifetime||0)>=THEMES[k].unlock||(p._themesSeen||[]).includes(k))).length>=3},
  {id:"listen_25",      cat:"fun",    title:"Keen Listener",              desc:"Tap the 🔊 pronunciation button 25 times.",  check:p=>(p._pronunClicks||0)>=25},
  {id:"spell_10",       cat:"skill",  title:"Spelling Bee",               desc:"Get 10 spelling questions right.",           check:p=>((p._typeRight||{}).spell||0)>=10},
  {id:"analogy_10",     cat:"skill",  title:"Analogy Ace",                desc:"Get 10 analogy questions right.",            check:p=>((p._typeRight||{}).analogy||0)>=10},
  {id:"rhyme_10",       cat:"skill",  title:"Rhyme Ranger",               desc:"Get 10 rhyme questions right.",              check:p=>((p._typeRight||{}).rhyme||0)>=10}
];
function everydayCorrectFor(p,keys){
  const types=p.everydayPractice?.types||{};
  return keys.reduce((total,key)=>total+Math.max(0,Number(types[key]?.correct)||0),0);
}
const EVERYDAY_ACHIEVEMENTS = Object.freeze([
  Object.freeze({id:"everyday.cloze_25",cat:"skill",title:"Context Catcher",desc:"Get 25 Everyday cloze questions right.",check:p=>everydayCorrectFor(p,["cloze"])>=25}),
  Object.freeze({id:"everyday.skill_practice_25",cat:"skill",title:"Usage Builder",desc:"Get 25 skill-practice questions right.",check:p=>Object.values(p.everydayPractice?.skills||{}).reduce((n,x)=>n+Math.max(0,Number(x?.correct)||0),0)>=25}),
  Object.freeze({id:"everyday.inflections_25",cat:"skill",title:"Form Finder",desc:"Get 25 word-form questions right.",check:p=>everydayCorrectFor(p,["third_person","past_tense","comparative","plural"])>=25}),
  Object.freeze({id:"everyday.sentences_25",cat:"skill",title:"Sentence Builder",desc:"Get 25 sentence-building questions right.",check:p=>everydayCorrectFor(p,["negative","question_form","there_is","word_order"])>=25}),
  Object.freeze({id:"everyday.type_explorer_10",cat:"skill",title:"Everyday Explorer",desc:"Get an answer right in 10 different Everyday question types.",check:p=>Object.values(p.everydayPractice?.types||{}).filter(x=>(Number(x?.correct)||0)>0).length>=10})
]);
function courseAchievementCatalog(courseId=activeCourseId()){
  const course=COURSES[courseId]||COURSES.elevenPlus;
  const policy=course.learning.achievementPolicy,excludedCats=new Set(policy.excludeCategories),excludedIds=new Set(policy.excludeIds);
  const legacy=ACHIEVEMENTS.filter(a=>!excludedCats.has(a.cat)&&!excludedIds.has(a.id));
  return courseId===COURSE_IDS.everyday?legacy.concat(EVERYDAY_ACHIEVEMENTS):legacy;
}
/* Runs after any state change that could unlock something; returns
   newly-unlocked achievements (for the caller to celebrate). */
function checkAchievements(){
  const p=P(); if(!p) return [];
  if(!activeCourseConfig().surfaces.learning)return [];
  const fresh=[];
  courseAchievementCatalog().forEach(a=>{
    if(p.achievements[a.id]) return;
    if(a.check(p)){ p.achievements[a.id]=Date.now(); fresh.push(a); }
  });
  const kt=krakenTier();
  const rankChanged=kt.current&&(p.courseId===COURSE_IDS.everyday?p._krakenRankId!==kt.current.id:p._krakenTier!==kt.current.count);
  if(rankChanged){
    p._krakenTier=kt.current.count;
    if(p.courseId===COURSE_IDS.everyday)p._krakenRankId=kt.current.id;
    fresh.push({id:p.courseId===COURSE_IDS.everyday?kt.current.id:"kraken_"+kt.current.count,cat:"kraken",title:kt.current.title,desc:`${kt.current.count} words mastered.`,emoji:kt.current.emoji,kraken:true});
  }
  if(fresh.length) persist();
  return fresh;
}
function notePlayToday(){
  const p=P(); const today=learningLocalDayKey();
  if(!p.playDays.includes(today)){ p.playDays.push(today); persist(); }
}
/* ---------- Daily touch ----------
   A small, one-off warmth per day — never a streak-loss mechanic.
   The word is picked deterministically per course and then persisted
   against the local calendar day so later tier loads cannot move it. */
function isFirstMenuViewToday(){
  const p=P(); if(!p) return false;
  const today=learningLocalDayKey();
  return !(p.playDays||[]).includes(today);
}
function learningLocalDayKey(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function wordOfTheDay(){
  const p=P();if(!p)return null;
  const today=learningLocalDayKey(),stored=p._dailyWord;
  if(stored&&stored.day===today&&stored.courseId===p.courseId&&!p.hidden.includes(stored.id)){
    const word=activeCourseStore().words.find(w=>w.id===stored.id)||(p.custom||[]).find(w=>w.id===stored.id);
    if(word)return word;
  }
  /* Easy is the only blocking tier at boot. Pinning the first choice to
     that loaded tier means core/stretch background completion cannot move
     today's word, and the same word is available immediately after reload. */
  const words=allWords().filter(w=>w.t==="easy");if(!words.length)return null;
  let hash=0,key=`${p.courseId}:${today}`;for(let i=0;i<key.length;i++)hash=(hash*31+key.charCodeAt(i))>>>0;
  const word=words[hash%words.length];p._dailyWord={day:today,courseId:p.courseId,id:word.id};persist();return word;
}

/* ---------- Felt-craft SVG renderer ----------
   Parametric characters: shared body plan, per-character colours,
   hairstyle, accessory; expression state drives eyes + mouth. */
const FELT_FILTER = `
<filter id="wob" x="-20%" y="-20%" width="140%" height="140%">
  <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6"/>
</filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="g"/>
  <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .05 0" result="ga"/>
  <feComposite in="ga" in2="SourceGraphic" operator="atop"/></filter>`;

/* ============================================================
   CHARACTER ART v2 — "refined felt-craft" per the
   wordbar-character-drawing skill. Canonical anatomy:
   head ellipse (50,44) rx20.5 ry22 · short neck 61→70 ·
   ONE-PIECE garment (collar+shoulders+sleeves+torso, single
   outline) · circle hands at the cuffs · layered hair framing
   the face to ear level · headwear bands never below y32
   (brows start ~y34) · gradients for skin/hair/top/iris ·
   ink #2E2440.
   ============================================================ */
const INK="#2E2440";
let __svgUid=0;
function shade(hex,f){ /* f>0 lighten toward white, f<0 darken */
  const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  if(f>=0){r+=(255-r)*f;g+=(255-g)*f;b+=(255-b)*f;}else{r*=1+f;g*=1+f;b*=1+f;}
  return "#"+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");
}
/* Layered hair. Every style = base mass framing the face to ~y50,
   plus structure strokes and a crown highlight. `g` is the url()
   of this render's hair gradient; `c` the flat hair colour for
   strand strokes. Headwear crowns/bands all stop at y<=32. */

/* ---- shared beard kit (2026 character fine-tune) ----
   The v2 beard hugs the chin: it attaches right under the moustache
   (no bare-chin gap), is widest at the jaw (~y50, half-width ~19.5)
   and tapers steadily to a small chin point (~y79.5). Because faceSVG
   always draws AFTER hairSVG, the mouth paints on top at every
   expression — no mouth-window notch is needed. */
function _stacheSVG(g){
  /* lowered ~2 units (2026 rev B): it was crowding the mouth */
  return `<path d="M39 57.5 Q44 53 49.2 56.2 L49.2 58.4 Q44.6 55.8 40.2 59.6 Z" fill="${g}" stroke="${INK}" stroke-width="1"/>
  <path d="M61 57.5 Q56 53 50.8 56.2 L50.8 58.4 Q55.4 55.8 59.8 59.6 Z" fill="${g}" stroke="${INK}" stroke-width="1"/>`;
}
function _beardWideSVG(c,g){
  /* rev B: whole beard shifted ~2 units lower and the inner rim dips
     to y64 so the mouth (neutral line ~y60.6) sits clear on skin —
     the fur frames the mouth rather than crowding it */
  return `<path d="M31 52 Q31.8 60 35.3 64.5 Q38.3 72.5 43 78.5 Q46.5 81 50 81 Q53.5 81 57 78.5 Q61.7 72.5 64.7 64.5 Q68.2 60 69 52 Q60 63 50 64 Q40 63 31 52 Z" fill="${g}" stroke="${INK}" stroke-width="1.2"/>
  <path d="M41 73.5 Q50 78.5 59 73.5" fill="none" stroke="${shade(c,-.3)}" stroke-width="1" opacity=".55"/>
  <path d="M44.5 69.5 q5.5 2.8 11 0" fill="none" stroke="${shade(c,.22)}" stroke-width="0.9" opacity=".4"/>`;
}
function hairSVG(style,c,extra,g){
  g=g||c;
  const dome=(hl)=>`<path d="M20.5 50 Q17 8 50 7 Q83 8 79.5 50 L73 50 Q75 ${hl} 50 ${hl-1} Q25 ${hl} 27 50 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>`;
  const shine=`<path d="M27 32 Q36 15 50 14" fill="none" stroke="${shade(c,.35)}" stroke-width="1.4" opacity=".7" stroke-linecap="round"/>`;
  const wisps=`<path d="M28.6 42 q-2.2 2 -3.2 4.6 M71.4 42 q2.2 2 3.2 4.6" stroke="${c}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  switch(style){
    case "crop": /* crew cut — ONE connected shape (top + tapered sideburns):
         no background gap can show through, and the sheen stroke is
         low-contrast so dark hair never reads as white-streaked */
      return `<path d="M27.5 41.5 L27 31 Q26 11 50 10 Q74 11 73 31 L72.5 41.5 Q70.6 43.2 69.3 41.2 L68.4 35 Q61 27.5 50 27.5 Q39 27.5 31.6 35 L30.9 41.2 Q29.4 43.2 27.5 41.5 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M36 16 Q42 11.5 50 11" fill="none" stroke="${shade(c,.22)}" stroke-width="1.2" opacity=".45" stroke-linecap="round"/>`;
    case "flop": /* quiff — connected base + swoosh that overlaps INTO the
         base so no white seam is possible between the two shapes */
      return `<path d="M28.5 40.5 L28 30 Q27 13 50 12 Q73 13 72 30 L71.5 40.5 Q69.7 42.2 68.5 40.2 L67.8 34 Q60 27 50 27 Q40 27 32.2 34 L31.8 40.2 Q30.3 42.2 28.5 40.5 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M31 29 Q31 7 45 4.5 Q59 2 63 11 Q58 10 54 12.5 Q64 15.5 67 29 Q56 22.5 47 24 Q38 25.5 31 29 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M36 20 Q39 9 49 7" fill="none" stroke="${shade(c,.22)}" stroke-width="1.3" opacity=".45" stroke-linecap="round"/>`;
    case "side": /* side part — one connected mass with tapered sides,
         visible parting line and directional comb strokes */
      return `<path d="M26.6 41.5 L26 32 Q24 10 50 9 Q76 10 74 32 L73.4 41.5 Q71.6 43.2 70.3 41.2 L69.4 34.5 Q65.5 25.5 58.5 25 L41.5 25 Q33.8 26.5 30.6 34.5 L30.2 41.2 Q28.4 43.2 26.6 41.5 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M41.5 10.5 Q41 17 41.5 24" stroke="${shade(c,-.42)}" stroke-width="1.3" opacity=".85" fill="none"/>
        <path d="M44 12 Q54 11 63 15 M44 17 Q54 16.5 62 20" fill="none" stroke="${shade(c,.22)}" stroke-width="1.1" opacity=".45" stroke-linecap="round"/>
        <path d="M38 12.5 Q32 14 29 19" fill="none" stroke="${shade(c,.22)}" stroke-width="1.1" opacity=".4" stroke-linecap="round"/>`;
    case "bob": /* flicked bob with a soft curtain fringe — the hairline
         dips unevenly instead of a smooth arch, plus a side parting */
      return `<path d="M19 58 Q15 6 50 5 Q85 6 81 58 L84 61 Q79 66 72 62 L70 58 L70 42 Q71.5 30 62 27.6 Q56 26.4 51 29.5 Q46 26.2 39 27.8 Q28.8 30 30 42 L30 58 L28 62 Q21 66 16 61 L19 58 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M44 7.5 Q43.6 14 44 20" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".75" fill="none"/>
        <path d="M46.5 9.5 Q57 9 64 15 M40.5 10 Q33 12.5 29 19" fill="none" stroke="${shade(c,.22)}" stroke-width="1.1" opacity=".42" stroke-linecap="round"/>
        <path d="M31 56 Q30 46 31.5 40 M69 56 Q70 46 68.5 40" stroke="${shade(c,-.35)}" stroke-width="1.1" opacity=".55" fill="none"/>`;
    case "curls": /* curly bob: varied curl clusters (not a uniform arch),
         bottom curls framing the cheeks, little swirl marks inside */
      return [ [29,23,8.5],[37,13,7],[49,9.5,8],[61,12,7],[70,21,8.5],[24,34,7],[76,33,7.6],[22,45,6],[78,44,6.4] ].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${g}" stroke="${INK}" stroke-width="1.1"/>`).join("")+dome(30)
        +`<path d="M44 10 Q43.6 15 44 19" stroke="${shade(c,-.4)}" stroke-width="1.1" opacity=".7" fill="none"/>
        <path d="M33 18 q-3.4 1.2 -3 4.6 q0.4 2.6 3 2.4 M63 14 q3.4 1 3.2 4.4 q-0.2 2.6 -2.8 2.6 M24 40 q-2.8 1 -2.4 3.8 q0.3 2.2 2.6 2" fill="none" stroke="${shade(c,-.3)}" stroke-width="1" opacity=".55"/>
        <path d="M40 12 q5 -2.6 10 -0.6" fill="none" stroke="${shade(c,.22)}" stroke-width="1" opacity=".4"/>`;
    case "bun": /* natural pulled-back bun: centre parting, hair swept
         toward the bun on both sides, loose strands framing the face */
      return `<circle cx="50" cy="11.5" r="7.2" fill="${g}" stroke="${INK}" stroke-width="1.4"/><path d="M46 9 q4 -3.6 7.4 0.6 q2 2.6 -0.6 4.6" fill="none" stroke="${shade(c,-.25)}" stroke-width="1.2" opacity=".8"/><path d="M45 17.5 q5 2.4 10 0 l0.6 2.6 q-5.6 2.6 -11.2 0 Z" fill="${extra||'#D8547A'}" stroke="${INK}" stroke-width="1"/>`+dome(30)
        +`<path d="M50 8.5 Q50 15 50 20" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".8" fill="none"/>
        <path d="M47 11 Q38 15 32 25 M53 11 Q62 15 68 25" fill="none" stroke="${shade(c,-.28)}" stroke-width="1.1" opacity=".55"/>
        <path d="M46 15 Q40 21 36 29 M54 15 Q60 21 64 29" fill="none" stroke="${shade(c,.22)}" stroke-width="1" opacity=".4"/>
        <path d="M31 44 Q29.5 35 36 30.5 M69 44 Q70.5 35 64 30.5" fill="none" stroke="${shade(c,-.25)}" stroke-width="1.1" opacity=".7"/><path d="M29 41 q-3.4 6.5 -0.8 13 q1.9 1.4 2.8 -0.3 q-2 -5.6 0 -11 Z" fill="${g}" stroke="${INK}" stroke-width="0.9"/><path d="M71 41 q3.4 6.5 0.8 13 q-1.9 1.4 -2.8 -0.3 q2 -5.6 0 -11 Z" fill="${g}" stroke="${INK}" stroke-width="0.9"/>`;
    case "plait": /* natural side-parted hair flowing into a chunky braid
         with visible weave marks */
      return dome(30)+`<path d="M43 9 Q42.6 16 43 22" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".8" fill="none"/>
        <path d="M45.5 11 Q56 11 64 17 M45.5 16 Q56 16 63 21.5" fill="none" stroke="${shade(c,.22)}" stroke-width="1" opacity=".42"/>
        <path d="M40 11.5 Q33 14 29.5 21" fill="none" stroke="${shade(c,.22)}" stroke-width="1" opacity=".38"/>
        <circle cx="72" cy="52" r="6" fill="${g}" stroke="${INK}" stroke-width="1.1"/><circle cx="73.6" cy="61.5" r="5.4" fill="${g}" stroke="${INK}" stroke-width="1.1"/><circle cx="74.8" cy="70" r="4.7" fill="${g}" stroke="${INK}" stroke-width="1.1"/>
        <path d="M69 49.5 l6 3.4 M70.6 58.6 l6 3.2 M72 67.4 l5.4 3" stroke="${shade(c,-.35)}" stroke-width="1.1" opacity=".7"/>
        <circle cx="75.8" cy="77" r="2.9" fill="${extra||'#D8547A'}" stroke="${INK}" stroke-width="1"/><path d="M29 41 q-3.4 6.5 -0.8 13 q1.9 1.4 2.8 -0.3 q-2 -5.6 0 -11 Z" fill="${g}" stroke="${INK}" stroke-width="0.9"/><path d="M71 41 q3.4 6.5 0.8 13 q-1.9 1.4 -2.8 -0.3 q2 -5.6 0 -11 Z" fill="${g}" stroke="${INK}" stroke-width="0.9"/>`;
    case "puffs": return `<circle cx="27" cy="17" r="11" fill="${g}" stroke="${INK}" stroke-width="1.3"/><circle cx="73" cy="17" r="11" fill="${g}" stroke="${INK}" stroke-width="1.3"/>
        <path d="M21 13 q4.5 -4.5 10 -2 M67 13 q4.5 -4.5 10 -2" fill="none" stroke="${shade(c,.22)}" stroke-width="1.1" opacity=".45"/>
        <path d="M23 21 q4 3 8.5 1.6 M77 21 q-4 3 -8.5 1.6" fill="none" stroke="${shade(c,-.28)}" stroke-width="1" opacity=".5"/>`+dome(31)
        +`<path d="M50 8 Q50 15 50 21" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".8" fill="none"/>
        <path d="M47.5 10.5 Q39 13 33.5 20 M52.5 10.5 Q61 13 66.5 20" fill="none" stroke="${shade(c,-.28)}" stroke-width="1" opacity=".5"/>
        <path d="M31 42.5 q-2.6 2.6 -3 5.8 M69 42.5 q2.6 2.6 3 5.8" stroke="${c}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    case "buzz": /* close buzz cut, kept completely within the head */
      return `<path d="M29 34 Q28 16 50 14 Q72 16 71 34 Q62 27 50 27 Q38 27 29 34 Z" fill="${g}" stroke="${INK}" stroke-width="1.3"/>
        <path d="M34 23 Q42 17 50 17 M50 17 Q59 17 66 23" fill="none" stroke="${shade(c,.26)}" stroke-width="1" opacity=".42" stroke-linecap="round"/>`;
    case "shortquiff": /* compact masculine quiff, no overhang beyond skull */
      return `<path d="M28 40 L27.5 31 Q27 16 50 14 Q73 16 72.5 31 L72 40 Q70 42 68.5 39 L68 34 Q59 27 50 27 Q41 27 32 34 L31.5 39 Q30 42 28 40 Z" fill="${g}" stroke="${INK}" stroke-width="1.35"/>
        <path d="M32 29 Q34 10 48 8 Q61 7 65 17 Q57 14 52 18 Q60 20 65 29 Q55 24 47 25 Q39 26 32 29 Z" fill="${g}" stroke="${INK}" stroke-width="1.35"/>
        <path d="M38 21 Q43 11 52 10" fill="none" stroke="${shade(c,.28)}" stroke-width="1.1" opacity=".45" stroke-linecap="round"/>`;
    case "bald": /* fully bald, with only a soft scalp highlight */
      return `<path d="M34 28 Q40 20 49 19" fill="none" stroke="#FFF" stroke-width="1.5" opacity=".25" stroke-linecap="round"/>`;
    case "ponytail": /* pulled-back female style with connected ponytail */
      return dome(31)+`<path d="M50 8 Q50 15 50 22" stroke="${shade(c,-.4)}" stroke-width="1.15" opacity=".72"/>
        <path d="M46 10 Q38 14 32 25 M54 10 Q62 14 68 25" fill="none" stroke="${shade(c,.2)}" stroke-width="1" opacity=".42"/>
        <path d="M70 27 Q83 31 82 47 Q80 61 70 66 Q75 55 71 46 Q66 37 70 27 Z" fill="${g}" stroke="${INK}" stroke-width="1.3"/>
        <path d="M68 28 Q72 24 76 28 L75 34 Q71 32 68 35 Z" fill="${extra||'#D8547A'}" stroke="${INK}" stroke-width="1"/>`;
    case "longwave": /* long soft waves, shaped to frame rather than hide the face */
      return `<path d="M19 62 Q15 9 50 6 Q85 9 81 62 Q78 72 70 68 L69 43 Q69 29 61 27 Q55 25 50 29 Q45 25 39 27 Q31 29 31 43 L30 68 Q22 72 19 62 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M42 9 Q42 16 42.5 23" stroke="${shade(c,-.4)}" stroke-width="1.15" opacity=".7"/>
        <path d="M26 43 Q20 51 25 61 M74 43 Q80 51 75 61 M29 54 Q23 61 28 67 M71 54 Q77 61 72 67" fill="none" stroke="${shade(c,-.25)}" stroke-width="1.15" opacity=".62" stroke-linecap="round"/>`;
    case "twinbraids": /* centre-parted hair with two compact braids */
      return dome(31)+`<path d="M50 8 Q50 15 50 22" stroke="${shade(c,-.4)}" stroke-width="1.15" opacity=".75"/>
        <path d="M47 10 Q38 14 32 24 M53 10 Q62 14 68 24" fill="none" stroke="${shade(c,.2)}" stroke-width="1" opacity=".4"/>
        ${[48,57,66].map((y,i)=>`<circle cx="${27-i*.5}" cy="${y}" r="${5.2-i*.5}" fill="${g}" stroke="${INK}" stroke-width="1"/>`).join("")}
        ${[48,57,66].map((y,i)=>`<circle cx="${73+i*.5}" cy="${y}" r="${5.2-i*.5}" fill="${g}" stroke="${INK}" stroke-width="1"/>`).join("")}
        <circle cx="26" cy="73" r="2.6" fill="${extra||'#D8547A'}" stroke="${INK}" stroke-width=".9"/><circle cx="74" cy="73" r="2.6" fill="${extra||'#D8547A'}" stroke="${INK}" stroke-width=".9"/>`;
    /* ---- S9e: 12 new barista hairstyles. Same anatomy as the others:
       mass reaches x≈20–80 and comes down to ear level (y≈50), hairline
       across the forehead at y≈27–31, darker parting/structure strokes and
       light highlight strokes. Styles ending in _h are the tidy "under a
       hat" versions (no bun / crest / volume poking through). ---- */
    case "afro": return [[22,44,8],[20.5,33,9],[24.5,22,9.5],[32.5,13.5,9.5],[43,9.6,9.5],[57,9.6,9.5],[67.5,13.5,9.5],[75.5,22,9.5],[79.5,33,9],[78,44,8]]
        .map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${g}" stroke="${INK}" stroke-width="1.1"/>`).join("")
        +`<path d="M15.5 50 Q13 5 50 4 Q87 5 84.5 50 L71.5 50 Q73.5 29.5 50 28.5 Q26.5 29.5 28.5 50 Z" fill="${g}"/>
        <path d="M28.5 50 Q26.5 29.5 50 28.5 Q73.5 29.5 71.5 50" fill="none" stroke="${INK}" stroke-width="1.3"/>
        <path d="M30 20 q-2.4 1.6 -1.6 4.2 M41 12.5 q-2.6 .8 -2.4 3.6 M60 12.5 q2.6 .8 2.4 3.6 M71 20 q2.4 1.6 1.6 4.2 M23 36 q-1.8 1.8 -.6 4.2 M77 36 q1.8 1.8 .6 4.2" fill="none" stroke="${shade(c,-.32)}" stroke-width="1" opacity=".55" stroke-linecap="round"/>
        <path d="M37 17.5 q6 -4 13 -3.6" fill="none" stroke="${shade(c,.26)}" stroke-width="1.2" opacity=".42" stroke-linecap="round"/>`;
    case "afro_h": return [[21.5,44,7.6],[21,34.5,8],[79,34.5,8],[78.5,44,7.6]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${g}" stroke="${INK}" stroke-width="1.1"/>`).join("")+dome(30);
    case "pixie": return `<path d="M27.5 42.5 L27 30.5 Q26 10 50 9.5 Q74 10 73 30.5 L72.5 42.5 Q70.5 44 69.3 41.2 L68.6 34 Q62.5 28.4 55.5 28.6 L41 30.8 Q33.6 32.2 31.3 36 L30.8 41.3 Q29.3 44 27.5 42.5 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M30.2 35.5 Q31.5 17 49 14.6 Q64.5 13.4 70.5 24.5 Q61 20.6 53 24.2 Q44.5 28.4 37.2 37.4 Q33.4 35.4 30.2 35.5 Z" fill="${g}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M27.4 41 l-1.6 3.4 l3 -1.2 M72.6 41 l1.6 3.4 l-3 -1.2" fill="${g}" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>
        <path d="M36 25 Q44 18.5 56 18.4 M40 30.5 Q47 23.8 58 22.6" fill="none" stroke="${shade(c,-.3)}" stroke-width="1" opacity=".5" stroke-linecap="round"/>
        <path d="M37 13.8 Q44 10.5 52 10.6" fill="none" stroke="${shade(c,.24)}" stroke-width="1.2" opacity=".45" stroke-linecap="round"/>`;
    case "spacebuns": return `<circle cx="34" cy="10.5" r="7.6" fill="${g}" stroke="${INK}" stroke-width="1.3"/><circle cx="66" cy="10.5" r="7.6" fill="${g}" stroke="${INK}" stroke-width="1.3"/>
        <path d="M30.5 8.5 q3.4 -3.2 7.2 -.6 q1.8 2.2 -.4 4 M62.5 8.5 q3.4 -3.2 7.2 -.6 q1.8 2.2 -.4 4" fill="none" stroke="${shade(c,-.28)}" stroke-width="1.1" opacity=".7"/>
        <path d="M29.5 16 q4.6 2.2 9.2 0 l.5 2.4 q-5 2.4 -10.2 0 Z M61.3 16 q4.6 2.2 9.2 0 l.5 2.4 q-5 2.4 -10.2 0 Z" fill="${extra||'#D8547A'}" stroke="${INK}" stroke-width=".9"/>`+dome(30)
        +`<path d="M50 8 Q50 15 50 21" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".8" fill="none"/>
        <path d="M47.5 10 Q41 13 37 18.5 M52.5 10 Q59 13 63 18.5" fill="none" stroke="${shade(c,-.28)}" stroke-width="1" opacity=".5"/>
        <path d="M31 43 q-2.6 2.6 -3 5.8 M69 43 q2.6 2.6 3 5.8" stroke="${c}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    case "spacebuns_h": return dome(30)+`<path d="M50 8 Q50 15 50 21" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".8" fill="none"/>`;
    case "sidebraid": return dome(30)+`<path d="M58 9 Q58.4 16 58 22" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".8" fill="none"/>
        <path d="M55.5 11 Q45 11 36 17.5 M55.5 16 Q45 16.5 37.5 22" fill="none" stroke="${shade(c,.22)}" stroke-width="1" opacity=".42"/>
        ${[[27.6,50,5.6],[29.4,58.8,5.3],[31.2,67.2,5],[33,75.2,4.6],[34.4,82.4,4.1]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${g}" stroke="${INK}" stroke-width="1.05"/>`).join("")}
        <path d="M24.5 47.2 l6 3.6 M26.4 56.2 l5.8 3.4 M28.4 64.8 l5.4 3.2 M30.4 72.9 l5 3 M32 80.4 l4.4 2.6" stroke="${shade(c,-.35)}" stroke-width="1" opacity=".7"/>
        <circle cx="35.4" cy="87.6" r="2.5" fill="${extra||'#D8547A'}" stroke="${INK}" stroke-width=".9"/>
        <path d="M34.2 89.6 q.6 3 -.6 5.2 q2 -1.4 2.8 -.2 q.4 -2.4 -.4 -4.6 Z" fill="${g}" stroke="${INK}" stroke-width=".8"/>
        <path d="M71 41 q3.4 6.5 .8 13 q-1.9 1.4 -2.8 -.3 q2 -5.6 0 -11 Z" fill="${g}" stroke="${INK}" stroke-width=".9"/>`;
    case "topknot": return `<path d="M28 41 L27.6 31 Q27.4 14 50 13 Q72.6 14 72.4 31 L72 41 Q70.4 42.8 69 40.4 L68.2 34 Q61 27.6 50 27.6 Q39 27.6 31.8 34 L31 40.4 Q29.6 42.8 28 41 Z" fill="${g}" stroke="${INK}" stroke-width="1.35"/>
        <circle cx="50" cy="8.6" r="6.4" fill="${g}" stroke="${INK}" stroke-width="1.3"/>
        <path d="M46.8 7 q3.4 -3 6.4 .4 q1.6 2.2 -.6 3.8" fill="none" stroke="${shade(c,-.28)}" stroke-width="1.1" opacity=".7"/>
        <path d="M45.5 13.2 q4.5 2 9 0 l.5 2.3 q-5 2.2 -10 0 Z" fill="${shade(c,-.45)}" stroke="${INK}" stroke-width=".8"/>
        <path d="M47 16.5 Q40 18 33 25 M53 16.5 Q60 18 67 25" fill="none" stroke="${shade(c,-.28)}" stroke-width="1" opacity=".5"/>
        <path d="M38 19.5 Q43 16.4 48 16" fill="none" stroke="${shade(c,.24)}" stroke-width="1.1" opacity=".42" stroke-linecap="round"/>`;
    case "topknot_h": return `<path d="M28 41 L27.6 31 Q27.4 14 50 13 Q72.6 14 72.4 31 L72 41 Q70.4 42.8 69 40.4 L68.2 34 Q61 27.6 50 27.6 Q39 27.6 31.8 34 L31 40.4 Q29.6 42.8 28 41 Z" fill="${g}" stroke="${INK}" stroke-width="1.35"/>`;
    case "cornrows": return `<path d="M28.6 41 L28.2 31 Q28 14 50 13.4 Q72 14 71.8 31 L71.4 41 Q70 42.6 68.8 40.6 L68 34 Q61 27.8 50 27.8 Q39 27.8 32 34 L31.2 40.6 Q30 42.6 28.6 41 Z" fill="${g}" stroke="${INK}" stroke-width="1.35"/>
        ${[[34.6,32.2,37.4,16.2],[42,28.8,43.4,14.2],[50,27.9,50,13.6],[58,28.8,56.6,14.2],[65.4,32.2,62.6,16.2]].map(([x1,y1,x2,y2])=>{let s="";for(let i=0;i<5;i++){const t=i/5,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t,dy=(y2-y1)/5;s+=`<path d="M${(x-1.5).toFixed(1)} ${(y+dy*.15).toFixed(1)} Q${x.toFixed(1)} ${(y+dy*.85).toFixed(1)} ${(x+1.5).toFixed(1)} ${(y+dy*.15).toFixed(1)}" fill="none" stroke="${shade(c,-.38)}" stroke-width=".9" opacity=".8"/>`;}return s+`<path d="M${x1} ${y1} Q${((x1+x2)/2+(x1<50?-.8:x1>50?.8:0)).toFixed(1)} ${((y1+y2)/2).toFixed(1)} ${x2} ${y2}" fill="none" stroke="${shade(c,.22)}" stroke-width=".8" opacity=".4"/>`;}).join("")}`;
    case "locs": { const strand=(x,y1,y2,bend)=>`<path d="M${x-1.9} ${y1} Q${x-1.9+bend} ${(y1+y2)/2} ${x-1.7} ${y2} Q${x} ${y2+2.2} ${x+1.7} ${y2} Q${x+1.9+bend} ${(y1+y2)/2} ${x+1.9} ${y1} Z" fill="${g}" stroke="${INK}" stroke-width=".9"/><path d="M${x-1.4} ${(y1+(y2-y1)*.35).toFixed(1)} l2.8 .8 M${x-1.4} ${(y1+(y2-y1)*.68).toFixed(1)} l2.8 .8" stroke="${shade(c,-.35)}" stroke-width=".7" opacity=".6"/>`;
      return dome(30)+[[22.4,30,58,-1],[26.6,32,61,-.6],[30.6,40,60,-.3],[77.6,30,58,1],[73.4,32,61,.6],[69.4,40,60,.3]].map(s=>strand(...s)).join("")
        +`<path d="M50 8 Q50 14 50 20" stroke="${shade(c,-.4)}" stroke-width="1.1" opacity=".7" fill="none"/>
        <path d="M34 16 q3 5 2 11 M42 11 q2 6 1 12 M58 11 q-2 6 -1 12 M66 16 q-3 5 -2 11" fill="none" stroke="${shade(c,-.35)}" stroke-width="1" opacity=".55"/>
        <path d="M38 12.5 Q44 9.5 50 9.4" fill="none" stroke="${shade(c,.24)}" stroke-width="1.1" opacity=".42"/>`; }
    case "longstraight": return `<path d="M19 72 Q16 9 50 6 Q84 9 81 72 L70.2 72 L69.8 43 Q69.4 29.5 62 27.6 Q55.8 26.2 50 29.4 Q44.2 26.2 38 27.6 Q30.6 29.5 30.2 43 L29.8 72 Z" fill="${g}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M50 7.5 Q50 15 50 22" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".75" fill="none"/>
        <path d="M24 32 L23 70 M27 44 L26.4 70 M76 32 L77 70 M73 44 L73.6 70" fill="none" stroke="${shade(c,-.26)}" stroke-width="1" opacity=".5" stroke-linecap="round"/>
        <path d="M30 22 Q37 11.5 47 9.6 M53 9.6 Q63 11.5 70 22" fill="none" stroke="${shade(c,.24)}" stroke-width="1.2" opacity=".42" stroke-linecap="round"/>`;
    case "curtains": return `<path d="M23.5 49 Q20 10 50 8 Q80 10 76.5 49 L71.2 49 Q71.6 35 63 30.6 Q55.8 27.6 50 31 Q44.2 27.6 37 30.6 Q28.4 35 28.8 49 Z" fill="${g}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M50 9.5 Q50 20 50 30" stroke="${shade(c,-.4)}" stroke-width="1.2" opacity=".78" fill="none"/>
        <path d="M48.5 12 Q40 16 35.6 30.2 M51.5 12 Q60 16 64.4 30.2 M45 11 Q33 15 29 30 M55 11 Q67 15 71 30" fill="none" stroke="${shade(c,-.28)}" stroke-width="1" opacity=".5"/>
        <path d="M36 17 Q41 12 47 11" fill="none" stroke="${shade(c,.24)}" stroke-width="1.2" opacity=".42" stroke-linecap="round"/>`;
    case "spiky": return `<path d="M28 41 L27.6 31 Q27.4 14 50 13 Q72.6 14 72.4 31 L72 41 Q70.4 42.8 69 40.4 L68.2 34 Q61 27.6 50 27.6 Q39 27.6 31.8 34 L31 40.4 Q29.6 42.8 28 41 Z" fill="${g}" stroke="${INK}" stroke-width="1.35"/>
        <path d="M28.4 31 L25.6 17.6 L33.4 21 L33.6 8.6 L41.4 15.6 L45.4 4.6 L50.6 13.4 L56.6 4.8 L59.4 15.8 L67 8.8 L66.8 21 L74.4 17.4 L71.6 31 Q61 26.4 50 26.4 Q39 26.4 28.4 31 Z" fill="${g}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M36 21 L34.8 13.6 M45.8 17.6 L45.8 9 M55 17.6 L56 9.4 M64 21 L65.4 13.8" fill="none" stroke="${shade(c,.26)}" stroke-width="1" opacity=".45" stroke-linecap="round"/>`;
    case "spiky_h": case "fauxhawk_h": return `<path d="M28 41 L27.6 31 Q27.4 14 50 13 Q72.6 14 72.4 31 L72 41 Q70.4 42.8 69 40.4 L68.2 34 Q61 27.6 50 27.6 Q39 27.6 31.8 34 L31 40.4 Q29.6 42.8 28 41 Z" fill="${g}" stroke="${INK}" stroke-width="1.35"/>`;
    case "waves": return `<path d="M19 56 Q14 8 50 6 Q86 8 81 56 Q84.6 60.4 80.6 63.4 Q76.4 66.4 72.2 62.4 Q70.6 58.4 71 54 L70 43 Q70 30 62 27.6 Q56 26 50 30 Q43.6 25.6 37.4 28 Q30 31 30 43 L29 54 Q29.4 58.4 27.8 62.4 Q23.6 66.4 19.4 63.4 Q15.4 60.4 19 56 Z" fill="${g}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M43 8 Q42.6 14 43 21" stroke="${shade(c,-.4)}" stroke-width="1.15" opacity=".72" fill="none"/>
        <path d="M24 34 q-3 5 0 10 q3 5 0 10 M76 34 q3 5 0 10 q-3 5 0 10 M28 44 q-2.4 4 0 8 M72 44 q2.4 4 0 8" fill="none" stroke="${shade(c,-.28)}" stroke-width="1.05" opacity=".58" stroke-linecap="round"/>
        <path d="M45.5 10 Q57 10 64 16 M40 11 Q33 13.5 29 20" fill="none" stroke="${shade(c,.24)}" stroke-width="1.1" opacity=".42" stroke-linecap="round"/>`;
    case "fauxhawk": return `<path d="M29 36 Q28 17 50 15 Q72 17 71 36 Q62 28.4 50 28.4 Q38 28.4 29 36 Z" fill="${g}" stroke="${INK}" stroke-width="1.3"/>
        <path d="M40.5 28.4 Q39.4 13 44 6.4 L47.2 10.4 L50 3.2 L52.8 10.4 L56 6.4 Q60.6 13 59.5 28.4 Q55 26.6 50 26.6 Q45 26.6 40.5 28.4 Z" fill="${g}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M44.6 20 L45.2 11.6 M50 19 L50 7.6 M55.4 20 L54.8 11.6" fill="none" stroke="${shade(c,.26)}" stroke-width="1" opacity=".45" stroke-linecap="round"/>
        <path d="M33 30 Q35 22 40 19.5 M67 30 Q65 22 60 19.5" fill="none" stroke="${shade(c,-.3)}" stroke-width=".9" opacity=".45"/>`;
    case "beard": /* generic bearded style — snug hair fringe hugging the
         skull + the shared v2 chin-hugging beard. The four elder
         regulars now use their own bald variants below. */
      return `<path d="M31.5 32 Q50 20 68.5 32 L68.5 36 Q50 26.5 31.5 36 Z" fill="${g}" stroke="${INK}" stroke-width="1.3"/>`
        + _stacheSVG(g) + _beardWideSVG(c,g);
    case "bald_beard": /* Desmond — fully bald, gentle shine */
      return `<path d="M32 33 Q39 23.5 49 22.3" fill="none" stroke="#FFFFFF" stroke-width="1.6" opacity=".3" stroke-linecap="round"/>`
        + _stacheSVG(g) + _beardWideSVG(c,g);
    case "horseshoe_beard": /* Old Tam — thin horseshoe side tufts */
      return `<path d="M30.4 33.8 Q29 42 30.2 50 Q32 51.6 33.2 49.2 Q32.2 41.3 32.6 35 Q31.4 32.4 30.4 33.8 Z" fill="${g}" stroke="${INK}" stroke-width="1"/>
        <path d="M69.6 33.8 Q71 42 69.8 50 Q68 51.6 66.8 49.2 Q67.8 41.3 67.4 35 Q68.6 32.4 69.6 33.8 Z" fill="${g}" stroke="${INK}" stroke-width="1"/>`
        + _stacheSVG(g) + _beardWideSVG(c,g);
    case "chops_beard": /* Gustav — slim muttonchops flowing to the beard */
      return `<path d="M30.2 33.2 Q28.4 44 30.8 54.5 Q33 56.8 34.9 54.3 Q32.9 44 33.4 35 Q31.8 31.9 30.2 33.2 Z" fill="${g}" stroke="${INK}" stroke-width="1"/>
        <path d="M69.8 33.2 Q71.6 44 69.2 54.5 Q67 56.8 65.1 54.3 Q67.1 44 66.6 35 Q68.2 31.9 69.8 33.2 Z" fill="${g}" stroke="${INK}" stroke-width="1"/>`
        + _stacheSVG(g) + _beardWideSVG(c,g);
    case "wisps_beard": /* the Clockwinder — bald with a wispy combover */
      return `<path d="M35 26.5 Q45 21.5 58 24 M38 24 Q47 19.5 56 21.5 M42 22 Q49 18.5 54 19.8" fill="none" stroke="${c}" stroke-width="1.1" opacity=".85" stroke-linecap="round"/>`
        + _stacheSVG(g) + _beardWideSVG(c,g);

case "santahat": { const red=extra||"#C0392B", redD=shade(red,-.28), redL=shade(red,.22), fur="#F4F0E8", furD=shade(fur,-.22);
  return `<path d="M33 20 Q35 7 50 5.5 Q64 5 68 13.5 Q84 11.5 91 22 Q96 30.5 87 36.5 Q77 42.5 68 35.5 Q60 24 62 15.5 Q52 13 40 15.5 Q34 18 33 20 Z" fill="${red}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M37 15 Q43 8.5 51 7" fill="none" stroke="${redL}" stroke-width="1.2" opacity=".55" stroke-linecap="round"/>
    <path d="M75 22 Q84 27.5 80 34.5" fill="none" stroke="${redD}" stroke-width="1.1" opacity=".4"/>
    <circle cx="89.5" cy="37.5" r="5.2" fill="${fur}" stroke="${INK}" stroke-width="1.3"/>
    <circle cx="87.8" cy="35.3" r="1.4" fill="#FFF" opacity=".75"/>
    <path d="M30 30.5 Q28.5 8.5 50 7.5 Q71.5 8.5 70 30.5 Q50 24 30 30.5 Z" fill="${fur}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M30 26 Q50 19.5 70 26 L70 30 Q50 23.7 30 30 Z" fill="${furD}" stroke="${INK}" stroke-width="1.2"/>`
    + _stacheSVG(g) + _beardWideSVG(c,g); }
case "jiangshihat": { const capC=extra||"#1C1A22", red="#B23A2E", gold="#D8A521", feather="#3E8067";
  return dome(30)
    + `<path d="M20 28 Q18.5 12.5 50 11.5 Q81.5 12.5 80 28 Q65 20.5 50 21 Q35 20.5 20 28 Z" fill="${capC}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M25 25 Q37 15.5 50 15" fill="none" stroke="${shade(capC,.35)}" stroke-width="1.1" opacity=".5"/>
    <path d="M35.5 20 Q36 11 50 9.5 Q64 11 64.5 20 Q57.5 16 50 16 Q42.5 16 35.5 20 Z" fill="${red}" stroke="${INK}" stroke-width="1.3"/>
    <path d="M40 15.5 Q45 11.5 50 11" fill="none" stroke="${shade(red,.3)}" stroke-width="1" opacity=".5"/>
    <circle cx="50" cy="9.3" r="1.9" fill="${gold}" stroke="${INK}" stroke-width="0.9"/>
    <path d="M51 8 Q58 -1 66 -6 Q63 2 60 6 Q65 3 68 -1 Q64 8 57 11 Z" fill="${feather}" stroke="${INK}" stroke-width="1" opacity=".92"/>
    <ellipse cx="61" cy="1" rx="1.5" ry="2.4" fill="${shade(feather,-.3)}" transform="rotate(-35 61 1)"/>`
    + `<path d="M31 44 Q29.5 35 36 30.5 M69 44 Q70.5 35 64 30.5" fill="none" stroke="${shade(c,-.25)}" stroke-width="1.1" opacity=".6"/>`; }
case "explorerhat": { const felt=extra||"#8C6A42", band="#5C4028", feltD=shade(felt,-.28);
  return dome(30)
    + `<path d="M13 30 Q22 25.5 33 25.5 Q50 27 67 25.5 Q78 25.5 87 30 Q80 34.5 50 34.5 Q20 34.5 13 30 Z" fill="${felt}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M33 25 Q34 10 42 8.5 Q46 13 50 8.5 Q54 13 58 8.5 Q66 10 67 25 Q50 21 33 25 Z" fill="${felt}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M50 10 Q50 17 50 21" stroke="${feltD}" stroke-width="1.2" opacity=".55"/>
    <path d="M33.5 23.5 Q50 19.5 66.5 23.5 L66.5 27.5 Q50 23.2 33.5 27.5 Z" fill="${band}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M18 29.5 Q50 33.5 82 29.5" fill="none" stroke="${feltD}" stroke-width="1" opacity=".5"/>`; }
case "firehelmet": { const shell=extra||"#E8B33A", shellD=shade(shell,-.3), badge="#B23A2E";
  return dome(30)
    + `<path d="M14 31 Q18 26 30 25.5 Q50 27.5 70 25.5 Q82 26 86 31 Q78 34.5 50 34.5 Q22 34.5 14 31 Z" fill="${shell}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M31 26 Q31 9 50 8 Q69 9 69 26 Q50 21 31 26 Z" fill="${shell}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M50 8.5 L50 23" stroke="${shellD}" stroke-width="1.6" opacity=".7"/>
    <path d="M36 16 Q50 10 64 16" fill="none" stroke="${shade(shell,.3)}" stroke-width="1.3" opacity=".55"/>
    <path d="M43 24 L57 24 L55.5 31.5 Q50 34 44.5 31.5 Z" fill="${badge}" stroke="${INK}" stroke-width="1.2"/>
    <circle cx="50" cy="28" r="2" fill="#F2EFE8"/>`; }
case "beeveil": { const hat=extra||"#EFE8DA", hatD=shade(hat,-.22), mesh="#8C8C94";
  return dome(30)
    + `<path d="M31 31 Q31 27 34 26 L66 26 Q69 27 69 31 L69 56 Q50 62 31 56 Z" fill="${mesh}" opacity=".2" stroke="${mesh}" stroke-width="1.1"/>
    <path d="M34 32 L34 56 M42 30 L42 59 M50 29.5 L50 60 M58 30 L58 59 M66 32 L66 56" stroke="${mesh}" stroke-width="0.7" opacity=".45"/>
    <path d="M32 36 Q50 39 68 36 M32 44 Q50 47 68 44 M32 52 Q50 55 68 52" stroke="${mesh}" stroke-width="0.7" opacity=".45" fill="none"/>
    <path d="M11 29 Q20 24 32 24.5 Q50 26 68 24.5 Q80 24 89 29 Q80 33.5 50 33.5 Q20 33.5 11 29 Z" fill="${hat}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M33 25 Q33 11 50 10 Q67 11 67 25 Q50 20.5 33 25 Z" fill="${hat}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M33 22.5 Q50 18 67 22.5 L67 26 Q50 21.6 33 26 Z" fill="${hatD}" stroke="${INK}" stroke-width="1.1"/>`; }
case "librarianbun": { const pencil=extra||"#D8A521";
  return dome(30)
    + `<ellipse cx="50" cy="17" rx="11" ry="8.5" fill="${g}" stroke="${INK}" stroke-width="1.3"/>
    <ellipse cx="50" cy="17" rx="6" ry="4.4" fill="none" stroke="${shade(c,-.3)}" stroke-width="1" opacity=".6"/>
    <path d="M38 22 L62 11" stroke="${pencil}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M62 11 L65.5 9.5 L64.5 13 Z" fill="#E8C9A8" stroke="${INK}" stroke-width="0.9"/>
    <path d="M38.5 21.8 L36.5 22.8" stroke="#D9A0A8" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="40" cy="27.5" r="5.4" fill="none" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="60" cy="27.5" r="5.4" fill="none" stroke="${INK}" stroke-width="1.4"/>
    <path d="M45.4 27.5 L54.6 27.5" stroke="${INK}" stroke-width="1.3"/>
    <circle cx="40" cy="27.5" r="4.2" fill="#BCD4E0" opacity=".35"/><circle cx="60" cy="27.5" r="4.2" fill="#BCD4E0" opacity=".35"/>`; }
case "deerstalker": { const tweed=extra||"#9C8A62", tweedD=shade(tweed,-.3);
  return dome(30)
    + `<path d="M27 30 Q27 12 50 11 Q73 12 73 30 Q50 24 27 30 Z" fill="${tweed}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M22 26 Q26 20 33 21 Q31 27 30 31 Z" fill="${tweed}" stroke="${INK}" stroke-width="1.3"/>
    <path d="M78 26 Q74 20 67 21 Q69 27 70 31 Z" fill="${tweed}" stroke="${INK}" stroke-width="1.3"/>
    <path d="M35 18 L35 27 M43 15 L43 26 M50 14 L50 25 M57 15 L57 26 M65 18 L65 27" stroke="${tweedD}" stroke-width="1.1" opacity=".55"/>
    <path d="M30 20 Q50 14 70 20 M28.5 26 Q50 20 71.5 26" fill="none" stroke="${tweedD}" stroke-width="1.1" opacity=".5"/>
    <path d="M27 26.5 Q50 21.5 73 26.5 L73 30.5 Q50 25 27 30.5 Z" fill="${shade(tweed,.18)}" stroke="${INK}" stroke-width="1.2"/>`; }
case "boater": { const straw=extra||"#E8D49A", strawD=shade(straw,-.3), band="#B23A3A";
  return dome(30)
    + `<path d="M15 30 Q22 26 34 26 Q50 27.5 66 26 Q78 26 85 30 Q76 34 50 34 Q24 34 15 30 Z" fill="${straw}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M32 26.5 L32 14 Q50 11.5 68 14 L68 26.5 Q50 23 32 26.5 Z" fill="${straw}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M32 14 Q50 11.5 68 14" fill="none" stroke="${strawD}" stroke-width="1.2" opacity=".7"/>
    <path d="M32 21 Q50 18 68 21 L68 26 Q50 22.6 32 26 Z" fill="${band}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M68 23.5 Q76 25 79 31 Q73 29 67.5 26.5 Z" fill="${band}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M36 17 L36 25 M44 15.5 L44 24 M56 15.5 L56 24 M64 17 L64 25" stroke="${strawD}" stroke-width="0.8" opacity=".45"/>`; }
case "pilotcap": { const navy=extra||"#1E2A44", gold="#D8A521", navyL=shade(navy,.35);
  return dome(30)
    + `<path d="M30 27 Q29 11 50 10 Q71 11 70 27 Q50 21 30 27 Z" fill="${navy}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M28 27 Q50 22 72 27 L72 31 Q50 25.6 28 31 Z" fill="#141C2E" stroke="${INK}" stroke-width="1.3"/>
    <path d="M30 29.5 Q50 34 70 29.5" fill="none" stroke="${gold}" stroke-width="1.4" opacity=".9"/>
    <path d="M50 15 Q54 17 58 15 Q56 19 50 20 Q44 19 42 15 Q46 17 50 15 Z" fill="${gold}" stroke="${INK}" stroke-width="1"/>
    <circle cx="50" cy="17" r="2" fill="#B5342B" stroke="${INK}" stroke-width="0.9"/>
    <path d="M36 15 Q50 11 64 15" fill="none" stroke="${navyL}" stroke-width="1.2" opacity=".5"/>`; }
case "sunhat": { const straw=extra||"#E0C88C", strawD=shade(straw,-.3), ribbon="#5C8C6E";
  return dome(30)
    + `<path d="M8 30 Q18 23 32 24 Q50 26 68 24 Q82 23 92 30 Q78 36 50 36 Q22 36 8 30 Z" fill="${straw}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M32 24 Q32 12 50 11 Q68 12 68 24 Q50 19 32 24 Z" fill="${straw}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M32 21 Q50 16.5 68 21 L68 25 Q50 20.6 32 25 Z" fill="${ribbon}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M14 29 Q50 34 86 29" fill="none" stroke="${strawD}" stroke-width="1.1" opacity=".55"/>
    <circle cx="66" cy="21" r="4" fill="#E8A0BC" stroke="${INK}" stroke-width="1.1"/>
    <circle cx="66" cy="21" r="1.5" fill="#E8C44C"/>`; }
    case "cap": { const cap=extra||"#C0392B", cd=shade(cap,-.28);
      /* snug crown (rim ~x30.5-69.5, hugging the skull) + thin side
         hair tufts moved onto the head (2026 fine-tune: was 23-77) */
      /* 2026: side hair tufts removed — at the 34px queue-head size
         they read as little horns poking past the cap brim */
      return `<path d="M30.5 30 Q30 11 50 10.5 Q70 11 69.5 30 Q60 26 50 26 Q40 26 30.5 30 Z" fill="${cap}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M42 11.5 Q42.5 19 43.5 26.5 M58 11.5 Q57.5 19 56.5 26.5" fill="none" stroke="${cd}" stroke-width="1" opacity=".6"/>
        <circle cx="50" cy="9.6" r="1.8" fill="${cd}" stroke="${INK}" stroke-width="1"/>
        <path d="M31 29.5 Q50 23.5 69 29.5 L69 32.5 Q50 26.8 31 32.5 Z" fill="${cd}" stroke="${INK}" stroke-width="1.2"/>`; }
    case "beanie": { const b=extra||"#5C6B73";
      /* 2026: side tufts removed (read as horns at queue-head size) */
      return `<path d="M30 32 Q28.5 10 50 9 Q71.5 10 70 32 Q50 25.5 30 32 Z" fill="${b}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M30 27.5 Q50 21 70 27.5 L70 31.5 Q50 25.2 30 31.5 Z" fill="${shade(b,-.22)}" stroke="${INK}" stroke-width="1.2"/>
        <circle cx="50" cy="7" r="4.2" fill="${shade(b,.15)}" stroke="${INK}" stroke-width="1.2"/>`; }
    case "veil": { const v=(c==="#FFFFFF")?"#3E3A4A":c;
      /* trimmed ~8 units lower + narrowed so it frames the face naturally */
      return `<path d="M26 42 Q26 14 50 13 Q74 14 74 42 L74 72 Q69.5 76 65.5 72 L65.5 45 Q50 28.5 34.5 45 L34.5 72 Q30.5 76 26 72 Z" fill="${v}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M32.5 34.5 Q50 21.5 67.5 34.5 L67.5 38.8 Q50 27 32.5 38.8 Z" fill="#FBF7EE" stroke="${INK}" stroke-width="1.1"/>
        <path d="M29.5 54 L29.5 68 M70.5 54 L70.5 68" stroke="${shade(v,-.3)}" stroke-width="1" opacity=".5"/>`; }
    case "hijab": { const h=extra||c;
      return `<path d="M22 38 Q22 7 50 6 Q78 7 78 38 L78 60 Q74 68 67 63 L67 42 Q50 25 33 42 L33 63 Q26 68 22 60 Z" fill="${h}" stroke="${INK}" stroke-width="1.4"/><path d="M33 60 Q50 72 67 60 L67 66 Q50 78 33 66 Z" fill="${shade(h,-.15)}" stroke="${INK}" stroke-width="1.2"/><path d="M27 30 Q38 15 52 14" fill="none" stroke="${shade(h,.25)}" stroke-width="1.3" opacity=".6" stroke-linecap="round"/><path d="M30 48 Q29 42 32 37" stroke="${shade(h,-.3)}" stroke-width="1" opacity=".5" fill="none"/>`; }
    case "hood": { const h=extra||"#2A2438";
      /* rev B: crown trimmed to ~6 units above the skull and rounded —
         reads as fabric resting on the head, not a tall peak */
      return `<path d="M24.5 44 Q24.5 17 50 16 Q75.5 17 75.5 44 L75.5 69 Q70 73.5 64.5 69 L64.5 45.5 Q50 30 35.5 45.5 L35.5 69 Q30 73.5 24.5 69 Z" fill="${h}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M36.5 43 Q50 30 63.5 43" fill="none" stroke="${shade(h,-.35)}" stroke-width="2" opacity=".6"/>
        <path d="M29.5 26 Q38 18.5 50 17.5" fill="none" stroke="${shade(h,.25)}" stroke-width="1.2" opacity=".5" stroke-linecap="round"/>`; }
    case "ears": return `<path d="M28 28 L21 6 L42 17 Z" fill="${g}" stroke="${INK}" stroke-width="1.3"/><path d="M72 28 L79 6 L58 17 Z" fill="${g}" stroke="${INK}" stroke-width="1.3"/><path d="M27 10 L24 14 L33 16 Z" fill="#F4E3D0"/><path d="M73 10 L76 14 L67 16 Z" fill="#F4E3D0"/>`+dome(30);
    case "widowspeak": /* curtains now overlap the cheeks by ~1.5 units —
         the old inner window (27-73) left a see-through slit beside the
         face (head edge is 29.5/70.5). Peak still clears the brows. */
      return `<path d="M24.5 50 Q22 10 50 9 Q78 10 75.5 50 L69 50 Q71 27 57.5 26.5 L50 33.5 L42.5 26.5 Q29 27 31 50 Z" fill="${g}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M44.5 28 L50 33.5 L55.5 28" fill="none" stroke="${shade(c,-.3)}" stroke-width="1" opacity=".6"/>
        <path d="M28 32 Q35 16.5 49 15.5" fill="none" stroke="${shade(c,.35)}" stroke-width="1.4" opacity=".55" stroke-linecap="round"/>`;
    case "witchhat": { const w=extra||"#5C3E7A";
      return `<path d="M22 32 Q20 37 23.5 40.5 Q26.5 41.5 27.5 38 Q26 34 22 32 Z" fill="${g}" stroke="${INK}" stroke-width="1"/><path d="M78 32 Q80 37 76.5 40.5 Q73.5 41.5 72.5 38 Q74 34 78 32 Z" fill="${g}" stroke="${INK}" stroke-width="1"/><path d="M17 29 Q50 20 83 29 Q86 31.5 80 32 L20 32 Q14 31.5 17 29 Z" fill="${w}" stroke="${INK}" stroke-width="1.4"/><path d="M31 29.5 Q39 6 60 -6 Q54 12 64 29.5 Z" fill="${w}" stroke="${INK}" stroke-width="1.4"/><path d="M35 24 Q40 12 50 4" fill="none" stroke="${shade(w,.25)}" stroke-width="1.1" opacity=".55"/><rect x="36" y="23" width="24" height="5" rx="1.6" fill="#F2B33D" stroke="${INK}" stroke-width="0.9"/>`; }
    case "wizardhat": { const w=extra||"#3E5C8E";
      return `<path d="M18 29 Q50 20 82 29 Q85 31.5 79 32 L21 32 Q15 31.5 18 29 Z" fill="${w}" stroke="${INK}" stroke-width="1.4"/><path d="M34 29.5 Q45 4 52 -7 Q55 13 65 29.5 Z" fill="${w}" stroke="${INK}" stroke-width="1.4"/><path d="M47 6 l1.4 3 3.2.4 -2.4 2.1 .7 3.1 -2.9-1.6 -2.8 1.6 .6-3.1 -2.3-2.1 3.2-.4 Z" fill="#F2B33D"/><circle cx="57" cy="20" r="1.8" fill="#F2B33D"/>`+_beardWideSVG("#C9C2B4","#F0EDE7")+``; }
    case "spacehelmet": return `<path d="M31 30 Q30 15 50 14 Q70 15 69 30 Q60 24.5 50 24.5 Q40 24.5 31 30 Z" fill="${g}" stroke="${INK}" stroke-width="1.3"/><path d="M31 31 L30.6 38 Q32.6 39.4 33.8 37.8 L34 31.6 Z" fill="${g}" stroke="${INK}" stroke-width="1"/><path d="M69 31 L69.4 38 Q67.4 39.4 66.2 37.8 L66 31.6 Z" fill="${g}" stroke="${INK}" stroke-width="1"/><circle cx="50" cy="42" r="30" fill="#CFE6F2" opacity=".32" stroke="${INK}" stroke-width="2"/><path d="M28 28 Q37 14 50 13 Q63 14 72 28" fill="none" stroke="#FFF" stroke-width="3" opacity=".7" stroke-linecap="round"/><path d="M26 64 Q22 74 32 75 L68 75 Q78 74 74 64 L69 66 Q68 70 62 70 L38 70 Q32 70 31 66 Z" fill="#F0EDE7" stroke="${INK}" stroke-width="1.6"/><circle cx="76" cy="44" r="3.4" fill="#E04B3A" stroke="${INK}" stroke-width="1.3" class="lanternglow"/>`;
    case "piratehat": return dome(31)+`<path d="M13 30 Q27 9 50 9 Q73 9 87 30 Q68 23 50 24 Q32 23 13 30 Z" fill="#2E2A36" stroke="${INK}" stroke-width="1.6"/><path d="M18 27 Q32 13 50 12" fill="none" stroke="#4A4658" stroke-width="1.2" opacity=".7"/><circle cx="50" cy="16.5" r="3.8" fill="#FFF"/><path d="M46 21.5 q4 3 8 0" stroke="#FFF" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case "knighthelm": return `<path d="M23 54 Q19 6 50 5 Q81 6 77 54 L70.5 54 Q72.5 23 50 22 Q27.5 23 29.5 54 Z" fill="#AEB6C2" stroke="${INK}" stroke-width="1.6"/><path d="M27 16 Q37 8 50 7" fill="none" stroke="#D8DEE6" stroke-width="1.4" opacity=".7" stroke-linecap="round"/><circle cx="32" cy="38" r="1.3" fill="${INK}"/><circle cx="68" cy="38" r="1.3" fill="${INK}"/><circle cx="32" cy="48" r="1.3" fill="${INK}"/><circle cx="68" cy="48" r="1.3" fill="${INK}"/><path d="M46 7 Q50 -6 54 7 Q57 2 59 9 L52 12 Z" fill="#C0392B" stroke="${INK}" stroke-width="1.4"/>`;
    case "antenna": return `<path d="M20.5 50 Q17 10 50 9 Q83 10 79.5 50 L73 50 Q75 29 50 28 Q25 29 27 50 Z" fill="#8C93A8" stroke="${INK}" stroke-width="1.4"/><path d="M27 32 Q36 16 50 15" fill="none" stroke="#C4CCD6" stroke-width="1.3" opacity=".7" stroke-linecap="round"/><line x1="50" y1="11" x2="50" y2="0" stroke="${INK}" stroke-width="2.4"/><circle cx="50" cy="-1" r="3.8" fill="#E04B3A" stroke="${INK}" stroke-width="1.5" class="lanternglow"/><circle cx="29" cy="33" r="1.9" fill="${INK}"/><circle cx="71" cy="33" r="1.9" fill="${INK}"/>`;
    case "antennae2": return `<path d="M38 23 Q32 13 27 8.5" fill="none" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/><circle cx="26" cy="6.8" r="4" fill="#F2B33D" stroke="${INK}" stroke-width="1.4"/><path d="M62 23 Q68 13 73 8.5" fill="none" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/><circle cx="74" cy="6.8" r="4" fill="#F2B33D" stroke="${INK}" stroke-width="1.4"/>`;
    case "mummywrap": { const b="#EDE6DA", bd="#CBC2B0";
      return `<path d="M22 44 Q21 8 50 7 Q79 8 78 44 L78 52 Q74 57 70 52 L70 40 Q68 26 50 25.5 Q32 26 30 40 L30 52 Q26 57 22 52 Z" fill="${b}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M24 20 Q40 12 66 16 M23 28 Q46 20 75 26 M24 36 Q50 29 76 36 M28 13 Q45 8 62 11" fill="none" stroke="${bd}" stroke-width="1.6" opacity=".8"/>
        <path d="M30 41 Q40 36 50 37 M50 37 Q62 36 70 41" fill="none" stroke="${bd}" stroke-width="1.4" opacity=".7"/>
        <path d="M74 46 q7 3 5 11 q-1 5 -6 5 l-1.5 -3.5 q4 0 4 -3 q0.5 -5 -3.5 -6 Z" fill="${b}" stroke="${INK}" stroke-width="1.2"/>
        <path d="M76 52 l4 1" stroke="${bd}" stroke-width="1.2"/>`; }
    case "nemes": { const gold="#E8B93D", blue="#2C4368";
      /* dome snugged + solid gold at the temples (the old geometry left
         a see-through notch beside the head) + brow cobra */
      return `<path d="M27 50 Q26.5 14 50 13 Q73.5 14 73 50 L67 50 Q68.5 27 50 26.5 Q31.5 27 33 50 Z" fill="${gold}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M25 31 Q24 60 31.5 64 L37 60 Q32.5 51 33 33 Q30 28.5 25 31 Z" fill="${gold}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M75 31 Q76 60 68.5 64 L63 60 Q67.5 51 67 33 Q70 28.5 75 31 Z" fill="${gold}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M26.5 37 L33 37.5 M26 45 L33.5 46 M26.8 53 L34 55 M73.5 37 L67 37.5 M74 45 L66.5 46 M73.2 53 L66 55" stroke="${blue}" stroke-width="2.6"/>
        <path d="M33 26.5 Q50 20.5 67 26.5 L67 30.5 Q50 25 33 30.5 Z" fill="${blue}" stroke="${INK}" stroke-width="1.2"/>
        <path d="M46 16 Q50 12.5 54 16 L52.5 20 Q50 18.5 47.5 20 Z" fill="#3E8E87" stroke="${INK}" stroke-width="1"/>`; }
    case "headband": return dome(30)+`<path d="M26 27 Q38 21 50 21 Q62 21 74 27 L74 32.5 Q62 26.5 50 26.5 Q38 26.5 26 32.5 Z" fill="${extra||"#E04B3A"}" stroke="${INK}" stroke-width="1.3"/><path d="M29 28.5 Q40 23.5 52 23.6" fill="none" stroke="#FFF" stroke-width="1.1" opacity=".45"/>`;
    case "nflhelm": { const h=extra||"#3E5C8E";
      return `<path d="M22 46 Q20 9 50 8 Q80 9 78 46 L78 54 Q73 59 69 54 L69 40 Q67 26 50 25.5 Q33 26 31 40 L31 54 Q27 59 22 54 Z" fill="${h}" stroke="${INK}" stroke-width="1.5"/>
        <path d="M50 8 L50 25.5" stroke="${shade(h,-.3)}" stroke-width="2.4"/>
        <path d="M28 16 Q38 10 48 9.5" fill="none" stroke="${shade(h,.25)}" stroke-width="1.4" opacity=".7" stroke-linecap="round"/>
        <circle cx="26" cy="48" r="2.6" fill="#D8DEE6" stroke="${INK}" stroke-width="1"/><circle cx="74" cy="48" r="2.6" fill="#D8DEE6" stroke="${INK}" stroke-width="1"/>
        <path d="M26 49 Q30 62 42 63 L58 63 Q70 62 74 49" fill="none" stroke="#C4CCD6" stroke-width="3" opacity=".95"/>
        <path d="M32 56 L36 63 M46 52 L46 63 M56 52 L56 63 M68 56 L64 63" stroke="#C4CCD6" stroke-width="2.4" opacity=".95"/>`; }
    case "ninjahood": { const h=extra||"#3E3A4A";
      return `<path d="M20 44 Q19 6 50 5 Q81 6 80 44 L80 62 Q75 67 70 62 L70 42 Q50 26 30 42 L30 62 Q25 67 20 62 Z" fill="${h}" stroke="${INK}" stroke-width="1.4"/><path d="M32 40 Q50 27 68 40" fill="none" stroke="${shade(h,-.3)}" stroke-width="1.8" opacity=".6"/><path d="M64 12 L84 6 L82 12 L68 16 Z" fill="${shade(h,-.15)}" stroke="${INK}" stroke-width="1.1"/><path d="M25 16 Q34 7 46 6" fill="none" stroke="${shade(h,.22)}" stroke-width="1.2" opacity=".5" stroke-linecap="round"/>`; }
    case "crown": /* circlet resting on the hair (the old block crown
         floated wider than the skull) + v2 beard */
      return dome(30)+`<path d="M37 24.5 L40.5 12.5 L45.5 20.5 L50 9.5 L54.5 20.5 L59.5 12.5 L63 24.5 L64.5 29 Q50 25 35.5 29 Z" fill="#F2B33D" stroke="${INK}" stroke-width="1.4"/>
        <circle cx="40.5" cy="14.5" r="1.7" fill="#C0392B"/><circle cx="50" cy="11.5" r="1.7" fill="#3E5C8E"/><circle cx="59.5" cy="14.5" r="1.7" fill="#7FA65A"/>
        <path d="M36 25 Q50 21.2 64 25 L64.5 29 Q50 25 35.5 29 Z" fill="#D8A521" stroke="${INK}" stroke-width="1.1"/>`
        + _stacheSVG(g) + _beardWideSVG(c,g);
    case "queencrown": return `<circle cx="50" cy="10" r="6.6" fill="${g}" stroke="${INK}" stroke-width="1.4"/><path d="M46 8 q4 -3.2 7 0.6" fill="none" stroke="${shade(c,-.25)}" stroke-width="1.1" opacity=".8"/>`+dome(30)+`<path d="M31 44 Q29.5 35 36 30.5 M69 44 Q70.5 35 64 30.5" fill="none" stroke="${shade(c,-.25)}" stroke-width="1.1" opacity=".7"/><path d="M36 25 L40 15 L46 22 L50 12 L54 22 L60 15 L64 25 L62 28 L38 28 Z" fill="#EDE6E0" stroke="${INK}" stroke-width="1.3"/><circle cx="50" cy="17" r="1.7" fill="#D8547A"/><circle cx="41.5" cy="19.5" r="1.2" fill="#5B8FB5"/><circle cx="58.5" cy="19.5" r="1.2" fill="#5B8FB5"/>`;
    case "vikinghelm": /* helm hugs the skull (was 56 units wide vs a
         41-unit head); horns attach at the helm edge */
      return `<path d="M30 31.5 Q29 13 50 12 Q71 13 70 31.5 L70 34 Q50 28.5 30 34 Z" fill="#AEB6C2" stroke="${INK}" stroke-width="1.5"/>
        <path d="M30 31 Q50 25.5 70 31 L70 34 Q50 28.5 30 34 Z" fill="#8A94A2" stroke="${INK}" stroke-width="1.2"/>
        <circle cx="50" cy="17.5" r="1.5" fill="${INK}"/>
        <path d="M31.5 28 Q23.5 23 22.5 12 Q30 17 34 23.5 Z" fill="#EDE6E0" stroke="${INK}" stroke-width="1.4"/>
        <path d="M68.5 28 Q76.5 23 77.5 12 Q70 17 66 23.5 Z" fill="#EDE6E0" stroke="${INK}" stroke-width="1.4"/>
        <path d="M34 17.5 Q42 13.5 49 13.5" fill="none" stroke="#D8DEE6" stroke-width="1.3" opacity=".7" stroke-linecap="round"/>`
        + _stacheSVG(g) + _beardWideSVG(c,g);
    case "frizz": return [ [26,33,10],[32,16,8.5],[43,9,9.5],[57,10,8.5],[68,17,10],[74,33,8],[21,44,6.5],[79,43,7] ].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${g}" stroke="${INK}" stroke-width="1.1"/>`).join("")+dome(30)
        +`<path d="M34 14 q4 -3 8 -1.4 M55 11 q4.6 -1.6 8.4 1.4 M26 28 q-2.4 3 -1.6 6.6" fill="none" stroke="${shade(c,.22)}" stroke-width="1" opacity=".42"/>
        <path d="M46 12 Q45.6 16 46 20" stroke="${shade(c,-.35)}" stroke-width="1" opacity=".55" fill="none"/>`;
    default: return "";
  }
}
/* Accessories on the v2 anatomy. Chest sits y74–110; hands are the
   circles at (23.5,102.5)/(76.5,102.5); eyes at (41/59, 44.5).
   Face-covering accessories draw AFTER the face; masks use evenodd
   holes so the real blinking eyes show through. */
function accSVG(acc,c){
  switch(acc){

case "wateringcan": return `<path d="M64 94 L82 94 L80 114 L66 114 Z" fill="#5C8C6E" stroke="${INK}" stroke-width="1.4"/>
    <path d="M82 98 Q90 100 88 108" fill="none" stroke="#5C8C6E" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M64 98 L54 104 L54 108 L65 106" fill="#5C8C6E" stroke="${INK}" stroke-width="1.3"/>
    <ellipse cx="53" cy="106" rx="2.6" ry="3.4" fill="#4A7A5C" stroke="${INK}" stroke-width="1.1"/>
    <path d="M20 90 Q24 96 22 104 Q18 106 16 104 Q14 96 18 90 Z" fill="#C9CDD6" stroke="${INK}" stroke-width="1.3"/>
    <path d="M19 104 L19 116" stroke="#8C6432" stroke-width="3" stroke-linecap="round"/>`;
case "bookstack": return `<rect x="62" y="98" width="20" height="5" rx="1" fill="#8C3A3A" stroke="${INK}" stroke-width="1.2"/>
    <rect x="63" y="103" width="19" height="5" rx="1" fill="#2E6B7A" stroke="${INK}" stroke-width="1.2"/>
    <rect x="61" y="108" width="21" height="5" rx="1" fill="#7A6A2E" stroke="${INK}" stroke-width="1.2"/>
    <path d="M64 100.5 L80 100.5 M65 105.5 L80 105.5 M63 110.5 L80 110.5" stroke="#F2EFE8" stroke-width="1" opacity=".7"/>
    <rect x="16" y="100" width="9" height="6" rx="1.2" fill="#3A3038" stroke="${INK}" stroke-width="1.2"/>
    <rect x="18.5" y="94" width="4" height="6" rx="1.5" fill="#8C6A42" stroke="${INK}" stroke-width="1.1"/>`;
case "magnifier": return `<circle cx="76" cy="94" r="9.5" fill="#BCD4E0" opacity=".4" stroke="#C9A03C" stroke-width="2.2"/>
    <path d="M70 101 L62 112" stroke="#6E4A2E" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M71 89 Q76 86 81 89" fill="none" stroke="#F7F3EC" stroke-width="1.6" opacity=".8"/>
    <rect x="15" y="98" width="12" height="14" rx="1.5" fill="#E8DCC4" stroke="${INK}" stroke-width="1.3"/>
    <path d="M15 102 L27 102 M15 106 L27 106 M15 110 L24 110" stroke="#A89A88" stroke-width="0.9"/>
    <path d="M21 98 L21 112" stroke="#C4B49A" stroke-width="1"/>`;
case "oar": return `<path d="M78 56 L74 122" stroke="#B5763C" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M74 118 Q68 124 70 132 Q78 130 79 120 Z" fill="#8C5A32" stroke="${INK}" stroke-width="1.2"/>
    <path d="M78 58 Q84 54 82 48 Q76 50 77 56 Z" fill="#8C5A32" stroke="${INK}" stroke-width="1.1"/>`;
case "firehose": return `<path d="M76 74 L80 74 L80 92 L76 92 Z" fill="#C9CDD6" stroke="${INK}" stroke-width="1.3"/>
    <path d="M74 92 L82 92 L81 100 L75 100 Z" fill="#B23A2E" stroke="${INK}" stroke-width="1.3"/>
    <path d="M75 100 Q70 110 76 118 Q84 122 86 114" fill="none" stroke="#3A3038" stroke-width="4" stroke-linecap="round"/>
    <path d="M76 78 L80 78 M76 84 L80 84" stroke="#8C9098" stroke-width="1"/>`;
case "beeframe": return `<rect x="64" y="88" width="22" height="26" rx="1.5" fill="#C9A87C" stroke="${INK}" stroke-width="1.4"/>
    <rect x="67" y="92" width="16" height="18" fill="#E8B33A" stroke="${INK}" stroke-width="1"/>
    <path d="M70 95 l2.5 -1.5 2.5 1.5 0 3 -2.5 1.5 -2.5 -1.5 Z M76 95 l2.5 -1.5 2.5 1.5 0 3 -2.5 1.5 -2.5 -1.5 Z M73 101 l2.5 -1.5 2.5 1.5 0 3 -2.5 1.5 -2.5 -1.5 Z" fill="#C98F2A" stroke="${INK}" stroke-width="0.6"/>
    <ellipse cx="26" cy="88" rx="4" ry="2.8" fill="#E8B33A" stroke="${INK}" stroke-width="1.1"/>
    <path d="M24 87 L28 87 M24.5 89.5 L27.5 89.5" stroke="${INK}" stroke-width="0.9"/>
    <ellipse cx="24" cy="84.5" rx="3" ry="1.6" fill="#F2EFE8" opacity=".85" stroke="${INK}" stroke-width="0.7"/>`;
case "satchel": return `<path d="M39 75 L62 101" stroke="#6E4A2E" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="60" y="98" width="19" height="15" rx="2.5" fill="#8C6042" stroke="${INK}" stroke-width="1.5"/>
    <path d="M60 103 L79 103" stroke="#5C3A22" stroke-width="1.4"/>
    <rect x="66.5" y="100" width="6" height="5" rx="1" fill="#D8A521" stroke="${INK}" stroke-width="1.1"/>
    <rect x="15" y="98" width="16" height="6.5" rx="3" fill="#EFE2C8" stroke="${INK}" stroke-width="1.4" transform="rotate(-18 23 101)"/>
    <path d="M17 96.5 L17 105" stroke="#C4B08C" stroke-width="1" transform="rotate(-18 23 101)"/>`;
case "talisman": return `<path d="M46.5 25 L53.5 25 L54 34.5 Q50 37.5 46 34.5 Z" fill="#F2D675" stroke="${INK}" stroke-width="1.1"/>
    <path d="M47.3 28.3 Q50 27 52.7 28.3" stroke="#B23A3A" stroke-width="1" fill="none" opacity=".85"/>
    <path d="M47.6 31.6 Q50 30.3 52.4 31.6" stroke="#B23A3A" stroke-width="1" fill="none" opacity=".85"/>
    <circle cx="50" cy="35.1" r="1.2" fill="#B23A3A" opacity=".85"/>`;
case "santabelt": return `<path d="M33 95.5 Q50 99.5 67 95.5 L67 100.5 Q50 104.3 33 100.5 Z" fill="#2E2A36" stroke="${INK}" stroke-width="1.4"/>
    <rect x="45.3" y="96" width="9.4" height="7.6" rx="1.5" fill="#D8A521" stroke="${INK}" stroke-width="1.3"/>
    <rect x="48.3" y="98" width="3.4" height="3.8" fill="#2E2A36"/>`;
    case "pearls": return `<g stroke="${INK}" stroke-width="0.7" fill="#FBF7EE"><circle cx="42.5" cy="75.5" r="1.5"/><circle cx="45.5" cy="78.3" r="1.5"/><circle cx="48.4" cy="80" r="1.5"/><circle cx="51.6" cy="80" r="1.5"/><circle cx="54.5" cy="78.3" r="1.5"/><circle cx="57.5" cy="75.5" r="1.5"/></g><circle cx="29.5" cy="52.5" r="1.4" fill="#FBF7EE" stroke="${INK}" stroke-width="0.7"/><circle cx="70.5" cy="52.5" r="1.4" fill="#FBF7EE" stroke="${INK}" stroke-width="0.7"/>`;
    case "glasses": return `<circle class="lens" cx="41" cy="44.5" r="7" fill="none" stroke="${INK}" stroke-width="2"/><circle class="lens" cx="59" cy="44.5" r="7" fill="none" stroke="${INK}" stroke-width="2"/><line x1="48" y1="44.5" x2="52" y2="44.5" stroke="${INK}" stroke-width="2"/><line x1="34" y1="44" x2="30" y2="45" stroke="${INK}" stroke-width="1.8"/><line x1="66" y1="44" x2="70" y2="45" stroke="${INK}" stroke-width="1.8"/>`;
    case "glasses_square": return `<rect class="lens" x="33.5" y="38.5" width="15" height="12" rx="2.2" fill="none" stroke="${INK}" stroke-width="2"/><rect class="lens" x="51.5" y="38.5" width="15" height="12" rx="2.2" fill="none" stroke="${INK}" stroke-width="2"/><line x1="48.5" y1="44.5" x2="51.5" y2="44.5" stroke="${INK}" stroke-width="2"/><line x1="33.5" y1="43" x2="29.5" y2="44.5" stroke="${INK}" stroke-width="1.8"/><line x1="66.5" y1="43" x2="70.5" y2="44.5" stroke="${INK}" stroke-width="1.8"/>`;
    case "camera": return `<path d="M42 74 Q50 88 58 74" fill="none" stroke="#2E2A34" stroke-width="1.6"/><rect x="43" y="87" width="14" height="10" rx="1.5" fill="#3A3444" stroke="${INK}" stroke-width="1.2"/><circle cx="50" cy="92" r="3.4" fill="#1C1A22" stroke="${INK}" stroke-width="1"/><circle cx="50" cy="92" r="1.6" fill="#5B8FB5"/><rect x="53.4" y="85.6" width="2.6" height="1.8" fill="#3A3444"/>`;
    case "bag": return `<path d="M32 80 L72 105 L69.5 110.5 L29.5 85.5 Z" fill="#7A5A3E" stroke="${INK}" stroke-width="1.3"/><path d="M63 101 q5 -2 8 2 q1 4 -3 6 q-5 1.5 -8 -2 Z" fill="#8A6644" stroke="${INK}" stroke-width="1.2"/><circle cx="68" cy="106" r="1.1" fill="#D9C08E"/>`;
    case "cravat": return `<path d="M46 70.5 L50 81 L54 70.5 L52 69.5 L48 69.5 Z" fill="#FBF7EE" stroke="${INK}" stroke-width="0.9"/><circle cx="50" cy="71" r="1.6" fill="#F0EDE7" stroke="${INK}" stroke-width="0.8"/>`;
    case "book": return `<rect x="60" y="92" width="20" height="14" rx="2" fill="#7A3B3B" stroke="${INK}" stroke-width="1.2"/><line x1="70" y1="92" x2="70" y2="106" stroke="#FBF7EE" stroke-width="1.4"/><path d="M62.5 96 L67.5 96 M62.5 99 L67.5 99 M72.5 96 L77.5 96" stroke="#FBF7EE" stroke-width="0.8" opacity=".7"/>`;
    case "flower": return `<circle cx="31" cy="27" r="4" fill="#E07A9B"/><circle cx="27" cy="23.5" r="3.2" fill="#E07A9B"/><circle cx="35" cy="23.5" r="3.2" fill="#E07A9B"/><circle cx="31" cy="22.5" r="2.2" fill="#F2B33D"/>`;
    case "stethoscope": return `<path d="M43 72 Q43 92 50 93 Q57 92 57 72" fill="none" stroke="${INK}" stroke-width="2.2"/><circle cx="50" cy="96" r="3.6" fill="#9CCBDB" stroke="${INK}" stroke-width="1.3"/>`;
    case "bowtie": return `<path d="M50 72.5 L42 68 L42 77 Z" fill="#7A3B3B" stroke="${INK}" stroke-width="1"/><path d="M50 72.5 L58 68 L58 77 Z" fill="#7A3B3B" stroke="${INK}" stroke-width="1"/><circle cx="50" cy="72.5" r="2" fill="${INK}"/>`;
    case "pocketwatch": return `<path d="M50 88 Q56 90 60 95" fill="none" stroke="#D8A521" stroke-width="1.4" stroke-dasharray="2.4 1.6"/><circle cx="61.5" cy="97" r="4.4" fill="#D8A521" stroke="${INK}" stroke-width="1.2"/><line x1="61.5" y1="97" x2="61.5" y2="94.4" stroke="${INK}" stroke-width="1"/><line x1="61.5" y1="97" x2="63.4" y2="97.8" stroke="${INK}" stroke-width="0.9"/>`;
    case "headphones": return `<path d="M27 44 Q27 12 50 12 Q73 12 73 44" fill="none" stroke="${INK}" stroke-width="3.4"/><rect x="22.5" y="41" width="9" height="15" rx="4.2" fill="${INK}"/><rect x="24.5" y="43.5" width="5" height="10" rx="2.5" fill="#D8547A"/><rect x="68.5" y="41" width="9" height="15" rx="4.2" fill="${INK}"/><rect x="70.5" y="43.5" width="5" height="10" rx="2.5" fill="#D8547A"/>`;
    case "fangs": /* cape corners only — the teeth are drawn separately by
      fangsFor() so they can track each expression's mouth */
      return `<path d="M30 76 L19 65 L34 71.5 Z" fill="#2E2A36" stroke="${INK}" stroke-width="1.4"/><path d="M70 76 L81 65 L66 71.5 Z" fill="#2E2A36" stroke="${INK}" stroke-width="1.4"/>`;
    case "potion": return `<path d="M80 98 L85 98 L88.5 108 Q88.5 112.5 82.5 112.5 Q76.5 112.5 76.5 108 Z" fill="#7FA65A" opacity=".9" stroke="${INK}" stroke-width="1.5"/><rect x="80.6" y="93.6" width="4" height="5.4" fill="#8A5A2E" stroke="${INK}" stroke-width="1.1"/><circle cx="81" cy="105.5" r="1.2" fill="#FFF" opacity=".8"/><circle cx="84.6" cy="108" r="0.95" fill="#FFF" opacity=".7"/>`;
    case "wand": return `<line x1="78" y1="101" x2="89" y2="80" stroke="#8A5A2E" stroke-width="3" stroke-linecap="round"/><path d="M89 78 l1.4 3 3.2.4 -2.4 2.1 .7 3.1 -2.9-1.6 -2.8 1.6 .6-3.1 -2.3-2.1 3.2-.4 Z" fill="#F2B33D" stroke="${INK}" stroke-width="1" class="twinkle"/>`;
    case "flask": return `<path d="M80 94 L85 94 L89.5 106 Q90.5 111.5 82.5 111.5 Q74.5 111.5 75.5 106 Z" fill="#9CCBDB" opacity=".85" stroke="${INK}" stroke-width="1.5"/><path d="M77.5 104.5 Q82.5 101 87.5 104.5 L87.5 107 Q82.5 110.5 77.5 107 Z" fill="#6BC5B8"/><path d="M84.5 92 q1.8 -3.6 0 -6.2" stroke="#B9AEC6" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    case "eyepatch": return `<ellipse cx="41" cy="44.5" rx="6.6" ry="6" fill="#2E2A36" stroke="${INK}" stroke-width="1.5"/><path d="M34.6 42 L29 38.5 M47.4 42 L70 34.5" stroke="${INK}" stroke-width="1.8"/>`;
    case "heromask": return `<path fill-rule="evenodd" d="M29 38.5 Q50 32.5 71 38.5 L71 49.5 Q50 55.5 29 49.5 Z M33.8 44.5 a7.2 6.6 0 1 0 14.4 0 a7.2 6.6 0 1 0 -14.4 0 M51.8 44.5 a7.2 6.6 0 1 0 14.4 0 a7.2 6.6 0 1 0 -14.4 0" fill="#C0392B" opacity=".92" stroke="${INK}" stroke-width="1.3"/><path d="M50 84 l2.6 5.2 -3.5 4.4 5.2 7 -1.7-7 3.5-4.4 Z" fill="#F2B33D" stroke="${INK}" stroke-width="1"/>`;
    case "shield": return `<path d="M14 96 L31 96 L31 108 Q31 117 22.5 119.5 Q14 117 14 108 Z" fill="#5B8FB5" stroke="${INK}" stroke-width="1.8"/><path d="M18 101 L27 101 M22.5 98 L22.5 114" stroke="#F2B33D" stroke-width="2"/>`;
    case "flagpatch": /* neutral mission patch: navy circle, gold star, tiny rocket — no national flag */
      return `<circle cx="42" cy="87" r="5.6" fill="#2C4368" stroke="${INK}" stroke-width="1.2"/><path d="M42 82.8 l1.15 2.5 2.7 0.3 -2 1.85 0.55 2.65 -2.4 -1.35 -2.4 1.35 0.55 -2.65 -2 -1.85 2.7 -0.3 Z" fill="#F2B33D"/><path d="M38.6 90 l1.6 -2.4 1 0.7 -1.6 2.3 Z" fill="#EDE6E0"/>`;
    case "mummyface": { const b="#EDE6DA", bd="#CBC2B0";
      /* strips wrap the face leaving only the eye zone (y39-51) clear */
      return `<path d="M29 33 Q50 30 71 33.5 L71 38.5 Q50 35 29 38 Z" fill="${b}" opacity=".96" stroke="${INK}" stroke-width="1.1"/>
        <path d="M28.5 52 Q50 49.5 71.5 52.5 L71.5 58.5 Q50 55.5 28.5 58 Z" fill="${b}" opacity=".96" stroke="${INK}" stroke-width="1.1"/>
        <path d="M29 58.5 Q50 63 71 58.5 L71 65 Q50 69.5 29 65 Z" fill="${b}" opacity=".96" stroke="${INK}" stroke-width="1.1"/>
        <path d="M31 55 L44 54.2 M56 54.2 L69 55 M33 62.5 L46 63.6 M54 63.8 L67 62.6" stroke="${bd}" stroke-width="1" opacity=".8"/>
        <path d="M70 60 q6.5 2.5 5 9 q-1 4 -4.6 3.6 l-1 -3 q3 0.4 3.2 -2.4 q0.3 -3.6 -3 -4.4 Z" fill="${b}" stroke="${INK}" stroke-width="1"/>`; }
    case "ninjamask": return `<path d="M30 52 Q50 47 70 52 L70 62 Q50 70 30 62 Z" fill="#3E3A4A" opacity=".95" stroke="${INK}" stroke-width="1.3"/><path d="M34 56 Q50 52.5 66 56" fill="none" stroke="#5C5870" stroke-width="1" opacity=".6"/>`;
    case "ankh": return `<g stroke="#D8A521" stroke-width="3" fill="none" stroke-linecap="round"><ellipse cx="83" cy="80" rx="3.6" ry="4.6"/><line x1="83" y1="84.5" x2="83" y2="98"/><line x1="76.5" y1="89" x2="89.5" y2="89"/></g><ellipse cx="81.6" cy="78" rx="1" ry="1.4" fill="#FFF" opacity=".7"/>`;
    case "basketball": return `<circle cx="81" cy="99" r="8.6" fill="#E07B39" stroke="${INK}" stroke-width="1.5"/><path d="M72.4 99 L89.6 99 M81 90.4 L81 107.6 M75 92.5 Q81 99 75 105.5 M87 92.5 Q81 99 87 105.5" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".85"/>`;
    case "football": return `<circle cx="81" cy="100" r="8.2" fill="#FDFBF5" stroke="${INK}" stroke-width="1.5"/><path d="M81 96.6 l3.2 2.3 -1.2 3.8 -4 0 -1.2 -3.8 Z" fill="#2E2A36"/><path d="M81 96.6 L81 91.9 M84.2 98.9 L88.7 97.4 M83 102.7 L85.8 106.4 M79 102.7 L76.2 106.4 M77.8 98.9 L73.3 97.4" stroke="${INK}" stroke-width="1.1" opacity=".8"/>`;
    case "amfootball": return `<ellipse cx="81" cy="99" rx="9.4" ry="6.2" fill="#8A5A2E" stroke="${INK}" stroke-width="1.5" transform="rotate(-18 81 99)"/><path d="M75 97.4 Q81 94.4 87 95.6" fill="none" stroke="#FDFBF5" stroke-width="1.2" transform="rotate(-18 81 99)"/><path d="M78 97.2 L84 95.8 M79.4 98.6 L79 95.4 M81.4 98.1 L81 94.9 M83.4 97.6 L83 94.4" stroke="#FDFBF5" stroke-width="1.1" transform="rotate(-18 81 99)"/>`;
    case "sceptre": return `<line x1="80" y1="112" x2="86" y2="78" stroke="#D8A521" stroke-width="3.2" stroke-linecap="round"/><circle cx="86.6" cy="74.5" r="4.6" fill="#C0392B" stroke="${INK}" stroke-width="1.4"/><path d="M83.5 71 Q86.6 68 89.7 71" fill="none" stroke="#F2B33D" stroke-width="2" stroke-linecap="round"/><circle cx="85" cy="73" r="1" fill="#FFF" opacity=".8"/>`;
    case "bolts": return `<circle cx="31" cy="50" r="2.8" fill="#5C6B73" stroke="${INK}" stroke-width="1"/><circle cx="69" cy="50" r="2.8" fill="#5C6B73" stroke="${INK}" stroke-width="1"/><path d="M43 84 L57 84" stroke="#3A424C" stroke-width="1.2" stroke-dasharray="2.6 1.8"/><circle cx="46" cy="90" r="1" fill="#5FB0D8"/><circle cx="50" cy="90" r="1" fill="#E8891D"/><circle cx="54" cy="90" r="1" fill="#C0392B"/>`;
    default: return "";
  }
}
const IRIS_COLORS=["#6E4A2E","#4E6E8E","#4E7A55","#7A5C3E","#5C4E7A"];
function lookHash(look){ const s=((look&&look.skin)||"")+((look&&look.hair)||"")+((look&&look.top)||"");
  let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
function irisFor(look){
  /* Custom avatars keep a stable eye colour while clothes/hair change. */
  if(look&&typeof look.iris==="string") return look.iris;
  return IRIS_COLORS[lookHash(look)%IRIS_COLORS.length];
}
/* Per-character face variation. Story characters retain their
   deterministic palette-based individuality. Custom avatars instead
   use explicit controls, so changing skin, hair or clothing can never
   silently change eye shape, lashes, blink timing or mouth width. */
/* S9e: eye shapes available to the barista editor. Indexes 0–3 are the
   original shapes (2 is only used by story customers); 4–6 are new. */
const EYE_SHAPE_INDEX={round:0,tall:1,almond:3,sleepy:4,wide:5,upturned:6};
const LASH_STYLES=["classic","short","long","flick","none"];
/* Extra face options for the barista (all optional; missing = today's look). */
function faceExtras(look,base){
  const out={...base};
  if(look&&LASH_STYLES.includes(look.lashStyle)){out.lashStyle=look.lashStyle;out.lashes=look.lashStyle!=="none";}
  if(look&&typeof look.brows==="string")out.brows=look.brows;
  if(look&&typeof look.cheeks==="string")out.cheeks=look.cheeks;
  return out;
}
function faceVary(look){
  if(look&&look.eyeShape&&Object.prototype.hasOwnProperty.call(EYE_SHAPE_INDEX,look.eyeShape)){
    return faceExtras(look,{
      sizeMul:1,
      shape:EYE_SHAPE_INDEX[look.eyeShape],
      lashes:typeof look.lashes==="boolean"?look.lashes:!look.noLash,
      mouthW:1,
      blinkDur:"4.6",
      blinkDel:"0"
    });
  }
  /* S9c: a ready-made barista whose look was edited keeps its original
     face exactly (stored once as faceFix), so changing hair or skin colour
     never silently changes the eyes or mouth. */
  if(look&&look.faceFix&&typeof look.faceFix==="object"){
    const f=look.faceFix,n=(v,lo,hi,d)=>{v=Number(v);return Number.isFinite(v)&&v>=lo&&v<=hi?v:d;};
    return faceExtras(look,{sizeMul:n(f.sizeMul,.5,1.5,1),shape:[0,1,2,3].includes(f.shape)?f.shape:0,lashes:!!f.lashes,
      mouthW:n(f.mouthW,.5,1.5,1),blinkDur:String(n(f.blinkDur,1,10,4.6).toFixed(1)),blinkDel:String(n(f.blinkDel,0,10,0).toFixed(1))});
  }
  const h=lookHash(look);
  return {
    sizeMul: .88 + ((h>>>3)%5)*.075,
    shape:   (h>>>6)%3,
    lashes:  look.noLash ? false : ((h>>>9)%3)===0,
    mouthW:  .85 + ((h>>>12)%5)*.075,
    blinkDur:(3.8 + ((h>>>15)%30)/10).toFixed(1),
    blinkDel:(((h>>>20)%25)/10).toFixed(1)
  };
}
let EYE_CLIP_SEQ=0;
/* S9e: one place that knows how big an eye is drawn, for every shape and
   expression. Returns the half-width and how far the white of the eye
   reaches above and below the eye centre (y 44.5). Used to size glasses
   and to shrink the eyes when glasses are worn, so the eye always fits
   inside the lens. */
function eyeDims(shape,r,wide){
  let rx=r,ry=wide?r+1:r,up,down;
  if(shape===1)ry=r*1.16; else if(shape===2)ry=r*.78; else if(shape===3)ry=r*.72;
  if(shape===3){up=down=ry/2;}
  else if(shape===4){up=r*.42;down=r*.8;}
  else if(shape===5){rx=r*1.06;up=down=r*1.06+(wide?.6:0);}
  else if(shape===6){up=r*.66+1.3*r/4.7;down=r*.46+.9*r/4.7;}
  else {up=down=ry;}
  return {rx,up,down};
}
/* The biggest eye this face ever draws (all open-eye expressions). */
const EYE_EXPR_R=[[4.7,false],[4.4,false],[4.3,false],[4.2,false],[5.2,true]];
function eyeMaxBox(vary){
  const v=vary||{sizeMul:1,shape:0};let w=4.4,up=4,down=1;
  EYE_EXPR_R.forEach(([r,wide])=>{const d=eyeDims(v.shape,r*v.sizeMul,wide);w=Math.max(w,d.rx);up=Math.max(up,d.up);down=Math.max(down,d.down);});
  return {w,up,down};
}
/* Outline of the new shapes (4 sleepy, 5 wide, 6 upturned) as smooth
   sampled points, so the white, the iris clip, the lid and every lash
   anchor all use exactly the same edge. dir=-1 left eye, +1 right eye
   (the outer corner is on the dir side). */
function eyeOutline(shape,cx,cy,r,dir,wide){
  const d=eyeDims(shape,r,wide),rx=d.rx,N=18,U=[],L=[];
  const base=x=>{ if(shape!==6)return 0; const t=(x*dir/rx+1)/2; return (1-t)*(.9*r/4.7)+t*(-1.3*r/4.7); };
  const upA=shape===4?r*.42:shape===5?d.up:r*.66, dnA=shape===4?r*.8:shape===5?d.down:r*.46;
  for(let i=0;i<=N;i++){const x=-rx+2*rx*i/N,s=Math.sqrt(Math.max(0,1-(x/rx)*(x/rx)));
    const k=shape===4?Math.pow(s,.75):s;
    U.push([cx+x,cy+base(x)-upA*k]);L.push([cx+x,cy+base(x)+dnA*s]);}
  return {U,L,rx};
}
const ptsPath=(pts,close)=>pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(2)+" "+p[1].toFixed(2)).join(" ")+(close?" Z":"");
function eyePair(iris,{r=4.7,pupil=2,lookX=0,lookY=.5,wide=false}={},vary,hairC){
  /* Lashes are hair, visually — a fixed dark-purple stroke read as an
     odd "blue" against most hair colours. Darkening the actual hair
     colour keeps it legible (raw blonde/grey would be too faint) while
     genuinely matching. */
  const lashColor=hairC?shade(hairC,-.35):INK;
  const v=vary||{sizeMul:1,shape:0,lashes:false,blinkDur:"4.6",blinkDel:"0"};
  r=r*v.sizeMul; pupil=pupil*Math.sqrt(v.sizeMul);
  /* S9e: glasses — shrink the eye (never grow it) so the white of the eye
     always fits inside the lens, for every shape and expression. */
  if(v.fit){wide=false;const d=eyeDims(v.shape,r,wide);const k=Math.min(1,v.fit.w/d.rx,v.fit.up/d.up,v.fit.down/d.down);if(k<1){r*=k;pupil*=Math.max(.75,k);lookX*=k;lookY*=k;}}
  let ry = wide? r+1 : r;
  if(v.shape===1) ry=r*1.16; else if(v.shape===2) ry=r*.78; else if(v.shape===3) ry=r*.72;
  const almond=v.shape===3, newShape=v.shape>=4;
  const style=v.lashStyle||(v.lashes?"classic":"none");
  const strand=(x,y,dx,dy,w=1.1)=>`<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${dx.toFixed(2)} ${dy.toFixed(2)}" stroke="${lashColor}" stroke-width="${w}" stroke-linecap="round"/>`;
  /* Upper-edge point for lashes: s=0 outer corner … s=1 eye centre. */
  const upperPt=(cx,dir,s,outline)=>{
    if(outline){const n=outline.U.length-1,idx=dir>0?Math.round(n-(n/2)*s):Math.round((n/2)*s);return outline.U[Math.max(0,Math.min(n,idx))];}
    const t=0.5+dir*0.5*(1-s);
    if(almond)return [cx+r*(2*t-1), 44.5-2*ry*t*(1-t)];
    const halfW=r-0.4, Y0=43-ry*0.35, Yc=41.4-ry*0.55;
    return [cx+halfW*(2*t-1), Y0-2*(Y0-Yc)*t*(1-t)];
  };
  const lash=(cx,dir,outline)=>{
    if(style==="none")return "";
    const scale=r/4.7,vec=(m)=>[dir*0.6*m*scale,-0.8*m*scale];
    const set=(list,w)=>list.map(([s,m])=>{const [x,y]=upperPt(cx,dir,s,outline);const [dx,dy]=vec(m);return strand(x,y,dx,dy,w);}).join("");
    if(style==="classic"){
      /* Original lashes, unchanged: almond 3 strands, others 2. */
      if(almond)return set([[0.03,2.6],[0.34,2.3],[0.66,2.0]]);
      return set(newShape?[[0.06,2.6],[0.42,2.2]]:[[0.06,2.8],[0.42,2.4]]);
    }
    if(style==="short")return set(almond?[[0.03,1.6],[0.34,1.4],[0.66,1.2]]:[[0.06,1.7],[0.42,1.4]],1);
    if(style==="long")return set(almond?[[0.02,3.3],[0.26,3.0],[0.5,2.7],[0.74,2.3]]:[[0.04,3.4],[0.3,3.0],[0.58,2.5]]);
    /* flick: a winged curl from the outer corner plus one short lash */
    const [x,y]=upperPt(cx,dir,0,outline);
    return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(dir*1.9*scale).toFixed(2)} ${(-0.3*scale).toFixed(2)} ${(dir*3.2*scale).toFixed(2)} ${(-2.3*scale).toFixed(2)}" stroke="${lashColor}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`+set([[0.34,1.8]],1);
  };
  /* Almond eyes use a smaller iris and pupil than the round/tall eyes.
     S9e: EVERY shape is now clipped to its own white, so no gaze or
     expression offset can ever let the coloured eye spill outside. */
  let irisR=almond?Math.min(ry*.40,pupil*.95):pupil+1.1;
  let pupilR=almond?Math.min(irisR*.60,pupil*.58):pupil;
  let shineR=almond?.42:.8;
  const shineDX=almond?.5:.9;
  let irisY=44.5+(almond?lookY*.45:.4+lookY);
  if(v.shape===5){irisR=pupil+1.6;pupilR=pupil*1.05;shineR=.95;}
  if(v.shape===4){irisY=44.5+.9+lookY*.4;}
  if(v.shape===6){irisY=44.5+.1+lookY*.45;}
  /* S9e: the coloured part is never bigger than the eye opening it sits
     in (checked for every shape, size and expression). */
  if(newShape){const d=eyeDims(v.shape,r,wide),open=v.shape===6?r*1.12:d.up+d.down;irisR=Math.min(irisR,open*.46);pupilR=Math.min(pupilR,irisR*.64);shineR=Math.min(shineR,irisR*.3);}
  else if(!almond){irisR=Math.min(irisR,ry*.98);pupilR=Math.min(pupilR,irisR*.66);}
  const seq=++EYE_CLIP_SEQ;
  const one=(cx,dir)=>{
    const clipId=`eye-${seq}-${cx}`;
    let eyeShape,clipGeom,lid="",outline=null;
    if(almond){
      const almondPath=`M${(cx-r).toFixed(1)} 44.5 Q${cx} ${(44.5-ry).toFixed(1)} ${(cx+r).toFixed(1)} 44.5 Q${cx} ${(44.5+ry).toFixed(1)} ${(cx-r).toFixed(1)} 44.5 Z`;
      eyeShape=`<path class="sclera" d="${almondPath}" fill="#FFF" stroke="${INK}" stroke-width="1.2"/>`;clipGeom=`<path d="${almondPath}"/>`;
    }else if(newShape){
      outline=eyeOutline(v.shape,cx,44.5,r,dir,wide);
      const d=ptsPath([...outline.U,...outline.L.slice().reverse()],true);
      eyeShape=`<path class="sclera" d="${d}" fill="#FFF" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;clipGeom=`<path d="${d}"/>`;
      const lidPts=outline.U.slice(1,-1);
      lid=`<path d="${ptsPath(lidPts,false)}" stroke="${INK}" stroke-width="${v.shape===4?2:1.4}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }else{
      eyeShape=`<ellipse class="sclera" cx="${cx}" cy="44.5" rx="${r.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#FFF" stroke="${INK}" stroke-width="1.2"/>`;
      clipGeom=`<ellipse cx="${cx}" cy="44.5" rx="${r.toFixed(1)}" ry="${ry.toFixed(1)}"/>`;
      lid=`<path d="M${cx-r+0.4} ${(43-ry*0.35).toFixed(1)} Q${cx} ${(41.4-ry*0.55).toFixed(1)} ${cx+r-0.4} ${(43-ry*0.35).toFixed(1)}" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    }
    const clip=`<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${clipGeom}</clipPath></defs>`;
    const inner=`<circle class="iris" cx="${(cx+lookX).toFixed(1)}" cy="${irisY.toFixed(1)}" r="${irisR.toFixed(1)}" fill="${iris}"/>
      <circle cx="${(cx+lookX).toFixed(1)}" cy="${irisY.toFixed(1)}" r="${pupilR.toFixed(1)}" fill="#241D33"/>
      <circle cx="${(cx+lookX+shineDX).toFixed(1)}" cy="${(irisY-.75).toFixed(1)}" r="${shineR}" fill="#FFF"/>${v.shape===5?`<circle cx="${(cx+lookX-1.1).toFixed(1)}" cy="${(irisY+1).toFixed(1)}" r=".45" fill="#FFF"/>`:""}`;
    return `${clip}${eyeShape}<g clip-path="url(#${clipId})">${inner}</g>${lid}${lash(cx,dir,outline)}`;
  };
  return `<g class="blink" style="animation-duration:${v.blinkDur}s;animation-delay:${v.blinkDel}s">${one(41,-1)+one(59,1)}</g>`;
}
function faceSVG(expr, fox, iris, vary, skin, hairC){
  iris=iris||"#6E4A2E"; skin=skin||"#EFC7A2"; hairC=hairC||"#5A5148";
  const dk=shade(skin,-.45), browC=shade(hairC,-.25);
  const nose = fox? "" : `<path d="M49 46 Q47.8 50.5 48.6 52.6 Q49.6 54 51.4 53.2" fill="none" stroke="${dk}" stroke-width="1.3" opacity=".6" stroke-linecap="round"/>`;
  const brow=(dy=0,tilt=0)=>`<path d="M34.5 ${37+dy} Q39.5 ${34.2+dy-tilt} 44 ${36.6+dy}" stroke="${browC}" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M56 ${36.6+dy} Q60.5 ${34.2+dy-tilt} 65.5 ${37+dy}" stroke="${browC}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
  let eyes, mouth, brows="", blush="";
  switch(expr){
    case "delighted": {
      const lc=shade(hairC,-.35),ls=(vary&&vary.lashStyle)||((vary&&vary.lashes)?"classic":"none");
      /* S9e: closed (smiling) eyes use the same lash style as open eyes */
      const closedLashes=ls==="classic"?`<path d="M36.8 43.8 l-2.7 -2.1 M39.2 41.9 l-1.1 -2.9 M63.2 43.8 l2.7 -2.1 M60.8 41.9 l1.1 -2.9" stroke="${lc}" stroke-width="1.2" stroke-linecap="round"/>`
        :ls==="short"?`<path d="M36.8 43.8 l-1.6 -1.3 M39.2 41.9 l-.7 -1.8 M63.2 43.8 l1.6 -1.3 M60.8 41.9 l.7 -1.8" stroke="${lc}" stroke-width="1.1" stroke-linecap="round"/>`
        :ls==="long"?`<path d="M36.9 43.9 l-3.2 -2.5 M38.6 42.3 l-1.9 -3.1 M41 41.3 l-.4 -3.4 M63.1 43.9 l3.2 -2.5 M61.4 42.3 l1.9 -3.1 M59 41.3 l.4 -3.4" stroke="${lc}" stroke-width="1.15" stroke-linecap="round"/>`
        :ls==="flick"?`<path d="M36.8 45.2 q-1.9 -.4 -3.2 -2.4 M63.2 45.2 q1.9 -.4 3.2 -2.4" stroke="${lc}" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M39.4 41.9 l-.8 -2 M60.6 41.9 l.8 -2" stroke="${lc}" stroke-width="1.1" stroke-linecap="round"/>`:"";
      eyes=`<path d="M36.6 45.5 Q41 40.5 45.4 45.5" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M54.6 45.5 Q59 40.5 63.4 45.5" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>${closedLashes}`;
      brows=brow(-1.6);
      mouth=`<path d="M42.5 57.5 Q50 68.5 57.5 57.5 Q50 61.5 42.5 57.5 Z" fill="#6B2F35" stroke="${INK}" stroke-width="1.2"/><path d="M46 62.5 Q50 66 54 62.5 Q50 64.4 46 62.5 Z" fill="#D97B8E"/>`;
      blush=`<ellipse cx="33.5" cy="51" rx="4.2" ry="3" fill="#D96C6C" opacity=".4"/><ellipse cx="66.5" cy="51" rx="4.2" ry="3" fill="#D96C6C" opacity=".4"/>`; break; }
    case "happy":
      eyes=eyePair(iris,{},vary,hairC); brows=brow(0);
      mouth=`<path d="M44 58.6 Q50 62.4 56 58.6" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><path d="M44.8 59.6 Q50 64.8 55.2 59.6 Q50 62.6 44.8 59.6 Z" fill="#9E4A4A" stroke="#7A3535" stroke-width="0.8"/>`;
      blush=`<ellipse cx="33.5" cy="52" rx="3.8" ry="2.6" fill="#D96C6C" opacity=".28"/><ellipse cx="66.5" cy="52" rx="3.8" ry="2.6" fill="#D96C6C" opacity=".28"/>`; break;
    case "thinking":
      eyes=eyePair(iris,{lookX:1.8,lookY:-.8,r:4.3},vary,hairC);
      brows=`<path d="M34.5 37.5 Q39.5 35 44 38" stroke="${browC}" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M56 37.4 Q61 33.4 65.5 35.6" stroke="${browC}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
      mouth=`<path d="M45.5 61.5 Q49.5 60 53.5 62.3" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`; break;
    case "sad":
      eyes=eyePair(iris,{r:4.2,pupil:1.9,lookY:1.2},vary,hairC);
      brows=`<path d="M35 37.2 Q40 34.2 44.5 37.6" stroke="${browC}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M55.5 37.6 Q60 34.2 65 37.2" stroke="${browC}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
      mouth=`<path d="M43.5 63 Q50 57.8 56.5 63" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/><path d="M43.5 63 q-1 1.6 -1.8 2.4" stroke="${INK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`; break;
    case "wow":
      eyes=eyePair(iris,{r:5.2,pupil:2.2,wide:true,lookY:0},vary,hairC);
      brows=brow(-2.4);
      mouth=`<ellipse cx="50" cy="61.5" rx="4" ry="5.4" fill="#5E2F3A" stroke="${INK}" stroke-width="1.3"/><ellipse cx="50" cy="63.8" rx="2.2" ry="1.9" fill="#E07A9B"/>`; break;
    default:
      eyes=eyePair(iris,{r:4.4,pupil:1.9},vary,hairC); brows=brow(.4);
      mouth=`<path d="M44.5 59.8 Q50 63 55.5 59.8" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/><path d="M47 62.8 Q50 64 53 62.8" stroke="${dk}" stroke-width="0.9" fill="none" opacity=".4" stroke-linecap="round"/>`;
      blush=`<ellipse cx="33.5" cy="52" rx="3.4" ry="2.4" fill="#D96C6C" opacity=".2"/><ellipse cx="66.5" cy="52" rx="3.4" ry="2.4" fill="#D96C6C" opacity=".2"/>`;
  }
  /* S9e: eyebrow style and cheeks (barista options). Brows are restyled
     from the expression's own brow curve, so every expression keeps its
     meaning (raised, frowning …) in every style. */
  const bs=vary&&vary.brows;
  if(bs&&bs!=="natural"&&brows){
    brows=brows.replace(/d="M([\d.]+) ([\d.]+) Q([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)" stroke="([^"]+)" stroke-width="([\d.]+)"/g,(m,x1,y1,qx,qy,x2,y2,c,w)=>{
      x1=+x1;y1=+y1;qx=+qx;qy=+qy;x2=+x2;y2=+y2;w=+w;
      if(bs==="thin")w*=.6;
      else if(bs==="thick"){w*=1.6;const a=x1<x2?.4:-.4;x1+=a;x2-=a;}
      else if(bs==="arched")qy-=1.7;
      else if(bs==="straight")qy=(y1+y2)/2-.4;
      return `d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${c}" stroke-width="${w.toFixed(2)}"`;});
  }
  const ck=vary&&vary.cheeks;
  if(ck==="rosy")blush+=`<ellipse cx="33.5" cy="52" rx="4" ry="2.8" fill="#E06A7A" opacity=".32"/><ellipse cx="66.5" cy="52" rx="4" ry="2.8" fill="#E06A7A" opacity=".32"/>`;
  else if(ck==="freckles"){const f=[[-3,-1.2],[-.6,-1.9],[1.8,-1],[-2,1],[.6,.6],[2.8,1.3]];
    blush+=[33.8,66.2].map(cx=>f.map(([dx,dy])=>`<circle cx="${(cx+dx).toFixed(1)}" cy="${(51.6+dy).toFixed(1)}" r=".55" fill="${shade(skin,-.4)}" opacity=".75"/>`).join("")).join("");}
  const snout = fox? `<ellipse cx="50" cy="54" rx="8.6" ry="6.6" fill="#F4E3D0"/><ellipse cx="50" cy="51" rx="2.9" ry="2.2" fill="${INK}"/>` : "";
  const mw=(vary&&vary.mouthW)||1;
  if(mw!==1) mouth=`<g transform="translate(50 61) scale(${mw} 1) translate(-50 -61)">${mouth}</g>`;
  return snout+eyes+brows+nose+mouth+blush;
}
/* Shop wearables (slot "extra"). Split into body-layer pieces
   (necklace, belt, scarf, watch...) drawn with the chest details,
   and face-layer pieces (sunglasses, earrings, headset) drawn after
   the face so they sit on top. */
/* ---- S9d wearables (12 new shop items). Same anchor points as the
   existing items: hat bands end at y<=32 (above the brow line y~34),
   glasses on the eye line (y41.5-50), neck pieces at the collar, cape
   behind the one-piece body. Every material has its own colours/gradient
   (never the hair gradient). ---- */
function s9dStar(cx,cy,r){let d="";for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;d+=(i?"L":"M")+(cx+Math.cos(a)*rr).toFixed(2)+" "+(cy+Math.sin(a)*rr).toFixed(2)+" ";}return d+"Z";}
function s9dFlower(cx,cy,petal,centre){let s="";for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;s+=`<circle cx="${(cx+Math.cos(a)*2.3).toFixed(2)}" cy="${(cy+Math.sin(a)*2.3).toFixed(2)}" r="2.2" fill="${petal}" stroke="${INK}" stroke-width=".55"/>`;}
  return s+`<circle cx="${cx}" cy="${cy}" r="1.35" fill="${centre}" stroke="${INK}" stroke-width=".45"/>`;}
/* Headbands sit ON the hair: on very short hair they move down to the
   head so they never float above it. */
const S9D_BAND_DROP={bald:{headband_cat:11,crown_flowers:8},buzz:{headband_cat:4,crown_flowers:1}};
function s9dHatSVG(id,U,hairstyle){
  const drop=(S9D_BAND_DROP[hairstyle]||{})[id]||0;
  if(drop){const inner=s9dHatSVG(id,U,"");return inner?`<g transform="translate(0 ${drop})">${inner}</g>`:"";}
  switch(id){
    case "hat_bobble":{
      let ribs="";for(let i=1;i<12;i++){const t=i/12,x=21+58*t,y1=24.5-12*t*(1-t),y2=32-11*t*(1-t);ribs+=`M${x.toFixed(1)} ${(y1+1).toFixed(1)} L${x.toFixed(1)} ${(y2-.8).toFixed(1)} `;}
      return `<defs><linearGradient id="BH${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7DB4E6"/><stop offset="1" stop-color="#3E72A8"/></linearGradient></defs>
      <path d="M22.5 30 Q20.5 7.5 50 7 Q79.5 7.5 77.5 30 Z" fill="url(#BH${U})" stroke="${INK}" stroke-width="1.4"/>
      <path d="M36 27 Q34.5 16 40.5 9.5 M50 26 L50 7.8 M64 27 Q65.5 16 59.5 9.5" fill="none" stroke="#2F5E8E" stroke-width="1" opacity=".45"/>
      <path d="M23.2 19.5 Q50 12.5 76.8 19.5" fill="none" stroke="#F4EDE2" stroke-width="2.6" opacity=".95"/>
      <path d="M21 24.5 Q50 18.5 79 24.5 L78.5 32 Q50 26.5 21.5 32 Z" fill="#2F5E8E" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="${ribs}" stroke="#1F4468" stroke-width=".9" opacity=".55"/>
      <circle cx="50" cy="6.4" r="5.6" fill="#F4EDE2" stroke="${INK}" stroke-width="1.3"/>
      <path d="M46.5 4.5 q1.5 -1.4 3 0 M50.5 8.5 q1.6 -1.2 3 .2 M46.8 8.2 l1.2 .9" fill="none" stroke="#CFC6B6" stroke-width=".9" stroke-linecap="round"/>`;}
    case "hat_chef":
      return `<defs><linearGradient id="CH${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4DED3"/></linearGradient></defs>
      <path d="M29 23 C19 21.5 17.5 10 26.5 8.5 C28 2 37.5 .8 42.5 4.5 C46 1.2 54 1.2 57.5 4.5 C62.5 .8 72 2 73.5 8.5 C82.5 10 81 21.5 71 23 Z" fill="url(#CH${U})" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M39.5 7 Q38.5 14 37.8 21.5 M50 4.5 L50 21 M60.5 7 Q61.5 14 62.2 21.5" fill="none" stroke="#C9C1B2" stroke-width=".95"/>
      <path d="M28.5 32 Q50 28.5 71.5 32 L71 21.5 Q50 18.5 29 21.5 Z" fill="#F7F4EE" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M29.5 26.5 Q50 23.2 70.5 26.5" fill="none" stroke="#D9D2C5" stroke-width=".9"/>`;
    case "headband_cat":
      return `<path d="M26.5 35 Q25.5 10.5 50 10 Q74.5 10.5 73.5 35" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M26.5 35 Q25.5 10.5 50 10 Q74.5 10.5 73.5 35" fill="none" stroke="#E77FA6" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M30.5 19.5 L32 4 L43.5 13 Z M69.5 19.5 L68 4 L56.5 13 Z" fill="#3A3346" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M33.2 15.8 L33.9 8.6 L39.4 13 Z M66.8 15.8 L66.1 8.6 L60.6 13 Z" fill="#F0A0B8"/>`;
    case "crown_flowers":{
      const P=t=>[(1-t)*(1-t)*27+2*t*(1-t)*50+t*t*73,(1-t)*(1-t)*28+2*t*(1-t)*4+t*t*28];
      const cols=[["#F28DB2","#F2B33D"],["#F7D154","#E07B39"],["#FFFFFF","#F2B33D"],["#B79CE8","#F7D154"]];
      let leaves="",flowers="";
      for(let i=0;i<6;i++){const [x,y]=P((i+.5)/6);leaves+=`<ellipse cx="${x.toFixed(1)}" cy="${(y+.6).toFixed(1)}" rx="2.3" ry="1.1" fill="#6FA35A" stroke="${INK}" stroke-width=".45" transform="rotate(${(i<3?-25:25)} ${x.toFixed(1)} ${(y+.6).toFixed(1)})"/>`;}
      for(let i=0;i<7;i++){const [x,y]=P(i/6),c=cols[i%4];flowers+=s9dFlower(+x.toFixed(1),+y.toFixed(1),c[0],c[1]);}
      return `<path d="M27 28 Q50 4 73 28" fill="none" stroke="#4E7A3A" stroke-width="1.5"/>${leaves}${flowers}`;}
    case "hat_pirate":
      return `<defs><linearGradient id="PH${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A4358"/><stop offset="1" stop-color="#1F1A28"/></linearGradient></defs>
      <path d="M30 23.5 Q33.5 6.5 50 6 Q66.5 6.5 70 23.5 Z" fill="url(#PH${U})" stroke="${INK}" stroke-width="1.4"/>
      <path d="M45.5 20.5 L54.5 16.2 M45.5 16.2 L54.5 20.5" stroke="#F4F0E8" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="50" cy="13.4" r="3.3" fill="#F4F0E8" stroke="${INK}" stroke-width=".8"/><rect x="48" y="15.2" width="4" height="2.4" rx=".8" fill="#F4F0E8" stroke="${INK}" stroke-width=".7"/>
      <circle cx="48.8" cy="13.3" r=".8" fill="${INK}"/><circle cx="51.2" cy="13.3" r=".8" fill="${INK}"/>
      <path d="M16.5 31.5 Q18.5 21 30 22.5 Q50 17 70 22.5 Q81.5 21 83.5 31.5 Q66 25.5 50 27.5 Q34 25.5 16.5 31.5 Z" fill="url(#PH${U})" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M18.5 30 Q34 24.6 50 26.6 Q66 24.6 81.5 30" fill="none" stroke="#D8A521" stroke-width="1.3"/>`;
    default: return "";
  }
}
/* Pieces drawn BEHIND the body (new "back" slot). */
function s9dBackSVG(id,U){
  if(id!=="cape_hero")return "";
  return `<defs><linearGradient id="CP${U}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9E2B22"/><stop offset=".5" stop-color="#D84A3C"/><stop offset="1" stop-color="#9E2B22"/></linearGradient></defs>
    <path d="M38 74 Q27 88 17 124 Q33 129.5 50 128.5 Q67 129.5 83 124 Q73 88 62 74 Z" fill="url(#CP${U})" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M25.5 106 Q23.5 116 22 124.5 M74.5 106 Q76.5 116 78 124.5" fill="none" stroke="#7A1F18" stroke-width="1" opacity=".55"/>`;
}

function extraSVG(id,phase,U=0){
  if(phase==="back")return s9dBackSVG(id,U);
  if(phase==="body"){ switch(id){
    case "cape_hero": return `<circle cx="40.3" cy="75" r="2.1" fill="#F2B33D" stroke="${INK}" stroke-width="1"/><circle cx="59.7" cy="75" r="2.1" fill="#F2B33D" stroke="${INK}" stroke-width="1"/>`;
    case "scarf_rainbow":{const C=["#E5484D","#F28C38","#F7D154","#5DB35D","#4E8FCF"];
      let wrap="",tail="";C.forEach((c,i)=>{const y=64+i*1.6;wrap+=`<path d="M42 ${y} Q50 ${y+6} 58 ${y} L58 ${(y+1.7).toFixed(1)} Q50 ${(y+7.7).toFixed(1)} 42 ${(y+1.7).toFixed(1)} Z" fill="${c}"/>`;
        const a=74+i*3.6,b=a+3.6,lx=y2=>49-(y2-74)/18,rx=y2=>52+(y2-74)/18*3;tail+=`<path d="M${lx(a).toFixed(2)} ${a} L${rx(a).toFixed(2)} ${a} L${rx(b).toFixed(2)} ${b} L${lx(b).toFixed(2)} ${b} Z" fill="${c}"/>`;});
      return `${tail}<path d="M52 74 L55 92 Q51 94.5 48 92 L49 74 Z" fill="none" stroke="${INK}" stroke-width="1.3"/>${wrap}<path d="M42 64 Q50 70 58 64 L58 72 Q50 78 42 72 Z" fill="none" stroke="${INK}" stroke-width="1.3"/>
        <path d="M48.6 92.6 L48.2 95.4 M50.6 93.2 L50.6 96 M52.8 93.1 L53.3 95.8 M54.6 92.6 L55.4 95" stroke="${INK}" stroke-width=".9" stroke-linecap="round"/>`;}
    case "watch_classic": return `<path d="M18.6 100.2 Q23.5 96.6 28.4 100.2" fill="none" stroke="#8A5A2E" stroke-width="3.4"/><circle cx="23.5" cy="99" r="3.4" fill="#F4F0E8" stroke="${INK}" stroke-width="1.2"/><line x1="23.5" y1="99" x2="23.5" y2="96.9" stroke="${INK}" stroke-width="0.9"/><line x1="23.5" y1="99" x2="25" y2="99.7" stroke="${INK}" stroke-width="0.8"/>`;
    case "bracelet_beads": return `<g stroke="${INK}" stroke-width="0.8">${[72.6,74.9,77.4,79.7].map((x,i)=>`<circle cx="${x}" cy="${99.4-Math.abs(i-1.5)*0.9}" r="1.6" fill="${["#6BC5B8","#D8547A","#F2B33D","#7FA65A"][i]}"/>`).join("")}</g>`;
    case "necklace_heart": return `<path d="M43 72 Q50 79 57 72" fill="none" stroke="#D8A521" stroke-width="1.6"/><path d="M50 79 l-2.4 -2.2 q-1.6 -1.8 0 -3.2 q1.4 -1.1 2.4 0.3 q1 -1.4 2.4 -0.3 q1.6 1.4 0 3.2 Z" fill="#D8547A" stroke="${INK}" stroke-width="1"/>`;
    case "belt_buckle": return `<path d="M31.5 105 L68.5 105 L68.5 110 L31.5 110 Z" fill="#5C4033" stroke="${INK}" stroke-width="1.3"/><rect x="45.5" y="103.6" width="9" height="7.8" rx="1.6" fill="#D8A521" stroke="${INK}" stroke-width="1.3"/><rect x="48.5" y="105.6" width="3" height="3.8" fill="#5C4033"/>`;
    case "scarf_cosy": return `<path d="M42 64 Q50 70 58 64 L58 72 Q50 78 42 72 Z" fill="#7A3B3B" stroke="${INK}" stroke-width="1.3"/><path d="M52 74 L55 92 Q51 95 48 92 L49 74 Z" fill="#7A3B3B" stroke="${INK}" stroke-width="1.3"/><path d="M48.5 90.5 L54.5 90.5 M49 87 L54 87" stroke="#5E2F2F" stroke-width="1.1"/><path d="M44 68 Q50 72.5 56 68" fill="none" stroke="#5E2F2F" stroke-width="1" opacity=".6"/>`;
    case "bowtie_dapper": return `<path d="M50 72.5 L41.5 67.5 L41.5 77.5 Z" fill="#3E5C8E" stroke="${INK}" stroke-width="1.1"/><path d="M50 72.5 L58.5 67.5 L58.5 77.5 Z" fill="#3E5C8E" stroke="${INK}" stroke-width="1.1"/><circle cx="50" cy="72.5" r="2.2" fill="#2C4368" stroke="${INK}" stroke-width="0.9"/><circle cx="44.5" cy="70.5" r="0.8" fill="#FFF" opacity=".55"/><circle cx="55.5" cy="70.5" r="0.8" fill="#FFF" opacity=".55"/>`;
    default: return ""; } }
  switch(id){ /* face layer */
    case "sunglasses_heart":{const heart=cx=>`<path d="M${cx} 50.8 C${cx-8.6} 45 ${cx-8.2} 38.2 ${cx-3.8} 38.2 C${cx-1.8} 38.2 ${cx-.5} 39.4 ${cx} 40.8 C${cx+.5} 39.4 ${cx+1.8} 38.2 ${cx+3.8} 38.2 C${cx+8.2} 38.2 ${cx+8.6} 45 ${cx} 50.8 Z" class="lens" fill="#D63F76" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M${cx-4.6} 41.6 q1 -1.6 2.6 -1.4" fill="none" stroke="#FFF" stroke-width="1.1" opacity=".75" stroke-linecap="round"/>`;
      return `<path d="M34.2 41.6 L28.8 42.6 M65.8 41.6 L71.2 42.6" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><path d="M46.8 41.4 Q50 39.6 53.2 41.4" fill="none" stroke="${INK}" stroke-width="1.6"/>${heart(41)}${heart(59)}`;}
    case "pencil_ear": return `<g transform="translate(70.6 43.4) rotate(-56)"><rect x="0" y="-2.1" width="2.8" height="4.2" rx="1.1" fill="#E88A9B" stroke="${INK}" stroke-width=".8"/><rect x="2.6" y="-2.1" width="2.4" height="4.2" fill="#B8B8C4" stroke="${INK}" stroke-width=".8"/><rect x="5" y="-2.1" width="12.5" height="4.2" fill="#F2C94C" stroke="${INK}" stroke-width=".9"/><path d="M5 0 L17.5 0" stroke="#D9A826" stroke-width=".8"/><path d="M17.5 -2.1 L22.6 0 L17.5 2.1 Z" fill="#EDCFA4" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/><path d="M21 -.6 L22.6 0 L21 .6 Z" fill="${INK}"/></g>`;
    case "clips_star": return `<path d="${s9dStar(30.8,33,4.8)}" fill="#F7D154" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/><path d="${s9dStar(69.2,33,4.8)}" fill="#F28DB2" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/><circle cx="29.6" cy="31.6" r=".9" fill="#FFF" opacity=".85"/><circle cx="68" cy="31.6" r=".9" fill="#FFF" opacity=".85"/>`;
    case "sunglasses_cool": return `<path d="M33 41.5 L67 41.5" stroke="${INK}" stroke-width="2"/><path class="lens" d="M34 41.5 Q34 50 41 50 Q48 50 48 41.5 Z" fill="#2E2A36" stroke="${INK}" stroke-width="1.6"/><path class="lens" d="M52 41.5 Q52 50 59 50 Q66 50 66 41.5 Z" fill="#2E2A36" stroke="${INK}" stroke-width="1.6"/><path d="M36 43.5 q2 3 4.5 3.6" stroke="#8C93A8" stroke-width="1.2" fill="none" opacity=".8"/><path d="M54 43.5 q2 3 4.5 3.6" stroke="#8C93A8" stroke-width="1.2" fill="none" opacity=".8"/><line x1="34" y1="42" x2="30" y2="44" stroke="${INK}" stroke-width="1.6"/><line x1="66" y1="42" x2="70" y2="44" stroke="${INK}" stroke-width="1.6"/>`;
    case "earrings_gold": return `<circle cx="29.5" cy="53.5" r="2.6" fill="none" stroke="#D8A521" stroke-width="1.8"/><circle cx="70.5" cy="53.5" r="2.6" fill="none" stroke="#D8A521" stroke-width="1.8"/><circle cx="28.6" cy="51.6" r="0.7" fill="#FFF" opacity=".8"/><circle cx="69.6" cy="51.6" r="0.7" fill="#FFF" opacity=".8"/>`;
    case "headset_pro": return `<path d="M28 42 Q28 14 50 14 Q72 14 72 42" fill="none" stroke="#3E3A4A" stroke-width="3.2"/><rect x="24" y="40" width="8.5" height="13" rx="4" fill="#3E3A4A" stroke="${INK}" stroke-width="1"/><rect x="67.5" y="40" width="8.5" height="13" rx="4" fill="#3E3A4A" stroke="${INK}" stroke-width="1"/><path d="M30 52 Q34 62 43 62" fill="none" stroke="#3E3A4A" stroke-width="2.2"/><ellipse cx="45" cy="62" rx="2.8" ry="2" fill="#5C5870" stroke="${INK}" stroke-width="1"/>`;
    default: return "";
  }
}
/* v2 assembly — skill layer order: shadow → hands → neck → garment
   → chest details → ears → head → hair → face → accessories/hats. */

/* ---- Clothing system (2026): garment STYLE is interior detail drawn
   INSIDE the approved one-piece silhouette — the outline itself is
   never redrawn. Style and colour are independent: customers set
   look.garment = {style, palette}; the barista combines whichever
   garment_style / garment_colour shop items are placed. ---- */
const GARMENT_PALETTES={
  ocean:"#3E7CA6", berry:"#B23A5F", forest:"#4E7A4A", charcoal:"#3E3A4A", sand:"#C9A96A",
};
const GARMENT_BODY_PATH="M45.5 70 Q39 73.5 36.5 76.5 Q25.5 84 20.5 97 L26.8 99.9 Q31 90.5 33.8 85.8 Q31.2 92 29.9 100 L28.6 128 L71.4 128 L70.1 100 Q68.8 92 66.2 85.8 Q69 90.5 73.2 99.9 L79.5 97 Q74.5 84 63.5 76.5 Q61 73.5 54.5 70 Q50 74 45.5 70 Z";
const GARMENT_STYLES={
  /* S9d: hoodie — hood rim folded round the neckline, drawstrings, front
     pocket and ribbed hem; drawn inside the one-piece outline. */
  hoodie:(base)=>{const dk=shade(base,-.25),mid=shade(base,-.1);
    return `<path d="M37.5 75.5 Q41 70.8 45.5 70 Q50 74 54.5 70 Q59 70.8 62.5 75.5 Q56.5 84 50 84 Q43.5 84 37.5 75.5 Z" fill="${dk}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M40.5 75.6 Q50 82.5 59.5 75.6" fill="none" stroke="${shade(base,.15)}" stroke-width=".9" opacity=".7"/>
      <path d="M46.6 80.5 Q46 86 46.8 91.5 M53.4 80.5 Q54 86 53.2 91.5" fill="none" stroke="#F4EDE2" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="46.8" cy="92" r="1" fill="#F4EDE2" stroke="${INK}" stroke-width=".6"/><circle cx="53.2" cy="92" r="1" fill="#F4EDE2" stroke="${INK}" stroke-width=".6"/>
      <path d="M37.5 106 L62.5 106 L65.5 119 L34.5 119 Z" fill="${mid}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M39.2 107.5 Q36.6 112.5 36.2 117.6 M60.8 107.5 Q63.4 112.5 63.8 117.6" fill="none" stroke="${dk}" stroke-width="1.1"/>
      <path d="M29.2 122.6 L70.8 122.6" stroke="${dk}" stroke-width="1.1" opacity=".7"/>`;},
  /* S9d: striped jumper — soft stripes clipped to the garment outline. */
  stripes:(base,U=0)=>{const lt=shade(base,.34),rib=shade(base,-.22);let st="";for(let y=80.5;y<128;y+=7)st+=`<rect x="15" y="${y}" width="70" height="3.2" fill="${lt}"/>`;
    return `<defs><clipPath id="GS${U}"><path d="${GARMENT_BODY_PATH}"/></clipPath></defs><g clip-path="url(#GS${U})" opacity=".92">${st}</g>
      <path d="M45 71 Q50 74.5 55 71" fill="none" stroke="${rib}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M20.9 96.2 L27.2 99 M79.1 96.2 L72.8 99" stroke="${rib}" stroke-width="3" stroke-linecap="round"/>
      <path d="M29.2 124.4 L70.8 124.4" stroke="${rib}" stroke-width="1.2" opacity=".7"/>`;},
  tee:(base)=>{const rib=shade(base,-.22);
    return `<path d="M45 71 Q50 74.5 55 71" fill="none" stroke="${rib}" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="50" cy="90" r="3.2" fill="${shade(base,.22)}" opacity="0.55"/>`;},
  polo:(base)=>{const trim=shade(base,-.28), lite=shade(base,.2);
    return `<path d="M44 71 L41 76.5 L46.5 74 Z M56 71 L59 76.5 L53.5 74 Z" fill="${trim}" stroke="${INK}" stroke-width="1"/>
      <path d="M47.5 74 L47 92 L53 92 L52.5 74 Z" fill="${trim}" stroke="${INK}" stroke-width="0.9"/>
      <circle cx="50" cy="80" r="1.1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="85.5" r="1.1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <path d="M21.5 95 L27.5 98 M78.5 95 L72.5 98" stroke="${trim}" stroke-width="2.6" stroke-linecap="round"/>`;},
  shirt:(base)=>{const trim=shade(base,-.3), lite="#FBF7EE";
    return `<path d="M44 71 L39.5 78.5 L46.5 74.5 Z M56 71 L60.5 78.5 L53.5 74.5 Z" fill="${trim}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M47.5 75 L46.7 102 L53.3 102 L52.5 75 Z" fill="${trim}" stroke="${INK}" stroke-width="0.9"/>
      <circle cx="50" cy="79" r="1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="84" r="1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="89" r="1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="94" r="1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="99" r="1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <path d="M58 82 L65 82 L65 90 L58 90 Z" fill="none" stroke="${trim}" stroke-width="1"/>
      <path d="M60.5 82 L60.5 84.5" stroke="${trim}" stroke-width="0.8"/>
      <path d="M21.8 95.4 Q25 97 27.6 98.6 M78.2 95.4 Q75 97 72.4 98.6" stroke="${trim}" stroke-width="1.6" opacity="0.6" fill="none"/>`;},
  cardigan2:(base)=>{const trim=shade(base,-.28), lite="#FBF7EE";
    return `<path d="M41.5 72.5 L39 100 L46 100 L46 74.5 Z M58.5 72.5 L61 100 L54 100 L54 74.5 Z" fill="${trim}" stroke="${INK}" stroke-width="1"/>
      <path d="M46 73.5 L46 101 L54 101 L54 73.5 Z" fill="${shade(base,.08)}" opacity=".45"/>
      <circle cx="50" cy="79" r="1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="85" r="1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="91" r="1" fill="${lite}" stroke="${INK}" stroke-width="0.5"/>`;},
  gondolierstripe:(base)=>{const dark=shade(base,-.35), light="#FBF7EE";
    return `<path d="M35.5 74 L64.5 74 M35 81 L65 81 M34.5 88 L65.5 88 M34 95 L66 95" stroke="${light}" stroke-width="3.2" opacity=".9"/>
      <path d="M44 71 L41 76.5 L46.5 74 Z M56 71 L59 76.5 L53.5 74 Z" fill="${dark}" stroke="${INK}" stroke-width="1"/>`;},
  pilotstripes:(base)=>{const navy="#1E2A44", gold="#D8A521";
    return `<path d="M44 71 L39.5 78.5 L46.5 74.5 Z M56 71 L60.5 78.5 L53.5 74.5 Z" fill="${navy}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M47.5 75 L46.7 102 L53.3 102 L52.5 75 Z" fill="${navy}" stroke="${INK}" stroke-width="0.9"/>
      <circle cx="50" cy="79" r="1" fill="#FBF7EE" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="84" r="1" fill="#FBF7EE" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="50" cy="89" r="1" fill="#FBF7EE" stroke="${INK}" stroke-width="0.5"/>
      <path d="M35.5 78 L41.5 78 M35.5 81 L41.5 81 M35.5 84 L41.5 84 M35.5 87 L41.5 87" stroke="${gold}" stroke-width="1.6"/>
      <path d="M58.5 78 L64.5 78 M58.5 81 L64.5 81 M58.5 84 L64.5 84 M58.5 87 L64.5 87" stroke="${gold}" stroke-width="1.6"/>`;},
  dungarees:(base)=>{const strap=shade(base,-.28), shirt="#CFE6D0";
    return `<path d="M40 77 L60 77 L61.5 102 Q50 107 38.5 102 Z" fill="${base}" stroke="${INK}" stroke-width="1.2"/>
      <path d="M42.5 72 L46 77 M57.5 72 L54 77" stroke="${strap}" stroke-width="3" stroke-linecap="round"/>
      <rect x="46" y="86" width="8" height="7" rx="1.2" fill="${shirt}" stroke="${INK}" stroke-width="1"/>
      <circle cx="44.8" cy="78.5" r="1.2" fill="${strap}" stroke="${INK}" stroke-width="0.7"/>
      <circle cx="55.2" cy="78.5" r="1.2" fill="${strap}" stroke="${INK}" stroke-width="0.7"/>`;},
};

/* Expression-aware vampire fangs (2026 fine-tune): each pair hangs from
   that expression's actual lip line — into the open smile for
   "delighted", tucked into the little "O" for "wow". Wide enough to
   stay visible at the 84px in-game sprite size. Wrapped in the same
   mouth-width transform faceSVG applies so they track faceVary. */
function fangsFor(expr, vary){
  const P={
    neutral:  [46.7,53.3,60.6,2.8],
    happy:    [46.3,53.7,59.6,2.8],
    delighted:[46.3,53.7,58.9,3.1],
    thinking: [47.2,52.8,60.8,2.4],
    sad:      [46.7,53.3,61.0,2.4],
    wow:      [48.4,51.6,56.3,2.8],
  }[expr]||[46.7,53.3,60.6,2.8];
  const [x1,x2,y,len]=P, hw=expr==="wow"?0.95:1.0;
  /* track the mouth-width variation by POSITION only — the teeth keep
     their full width (a narrower mouth doesn't shrink the teeth, and
     compressed teeth all but vanish at the 84px sprite size) */
  const mw=(vary&&vary.mouthW)||1, sx=x=>50+(x-50)*mw;
  const tooth=x=>`<path d="M${x-hw} ${y} q${hw*0.7} ${len} ${hw+0.15} ${len*0.98} q${hw*0.75} -${len*0.15} ${hw*0.85} -${len}" fill="#FFFDF6" stroke="${INK}" stroke-width="0.7" stroke-linejoin="round"/>`;
  return tooth(sx(x1))+tooth(sx(x2));
}

function facialHairSVG(style, hair, skin){
  if(!style||style==="none")return "";
  const shortBeard=`<path d="M31.5 51 Q32 60 38 66 Q44 70 50 70 Q56 70 62 66 Q68 60 68.5 51 Q63 59 58 61 Q54 64 50 64 Q46 64 42 61 Q37 59 31.5 51 Z" fill="${hair}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M40 65 Q50 69 60 65" fill="none" stroke="${shade(hair,-.3)}" stroke-width=".9" opacity=".55"/>`;
  const longBeard=_beardWideSVG(hair,hair);
  if(style==="mustache")return _stacheSVG(hair);
  if(style==="beard_short")return shortBeard;
  if(style==="beard_short_mustache")return shortBeard+_stacheSVG(hair);
  if(style==="beard_long")return longBeard;
  if(style==="beard_long_mustache")return longBeard+_stacheSVG(hair);
  return "";
}

/* ---- S9e: barista glasses sized to the eyes ----
   Every style is built around the biggest eye this face ever draws
   (eyeMaxBox), and the eyes are then shrunk if needed so the white of the
   eye always sits inside the lens. Eye centres are (41,44.5) and
   (59,44.5); lens half-width is capped at 8.1 so the two lenses never touch. */
const GLASSES_STYLES=[["none","No glasses"],["glasses","Round"],["glasses_square","Square"],["glasses_oval","Oval"],["glasses_cateye","Cat-eye"],["glasses_halfrim","Half-rim"],["glasses_biground","Big round"],["glasses_rect","Rectangle"]];
const GLASSES_COLORS=[["#2E2440","Black"],["#7A4A2A","Tortoiseshell"],["#C0392B","Red"],["#3E6FB0","Blue"],["#D8547A","Pink"],["#C9A227","Gold"]];
const isGlassesStyle=a=>GLASSES_STYLES.some(([id])=>id===a&&id!=="none");
function glassesLens(style,box){
  const m=Math.max(box.w,box.up,box.down),mh=Math.max(box.up,box.down),cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  switch(style){
    case "glasses_biground":{const R=cl(m+2.4,7.2,8.1);return {kind:"circle",hw:R,up:R,down:R};}
    case "glasses_square":{const hw=cl(box.w+1.9,6.6,7.9),h=cl(mh+1.5,5.6,8.4);return {kind:"rect",hw,up:h,down:h,rx:2.2};}
    case "glasses_rect":{const hw=cl(box.w+2.3,7,8.1);return {kind:"rect",hw,up:cl(box.up+1.3,4.4,8.4),down:cl(box.down+1.3,4.4,8.4),rx:1.4};}
    case "glasses_oval":{const hw=cl(box.w+2.1,6.8,8.1),h=cl(mh+1.6,5,8.4);return {kind:"ellipse",hw,up:h,down:h};}
    case "glasses_cateye":{const hw=cl(box.w+2.1,6.8,7.6),h=cl(mh+1.6,5,8.4);return {kind:"cateye",hw,up:h,down:h};}
    case "glasses_halfrim":{const hw=cl(box.w+1.9,6.8,8.1),h=cl(mh+1.5,5,8.4);return {kind:"halfrim",hw,up:h,down:h,rx:2.4};}
    default:{const R=cl(m+1.7,6.2,8.1);return {kind:"circle",hw:R,up:R,down:R};}
  }
}
/* The eye must fit INSIDE the lens outline (frame line is ~2 wide). */
function glassesFit(L){
  /* concentric, axis-aligned: an eye no wider/taller than the lens minus
     the frame (and a small gap) sits fully inside it */
  const g=1.4;return {w:L.hw-g,up:L.up-g,down:L.down-g};
}
function glassesSVG2(style,color,L){
  const c=color||INK,cy=44.5,sw=1.9;
  const lens=(cx,dir)=>{
    if(L.kind==="circle")return `<circle class="lens" cx="${cx}" cy="${cy}" r="${L.hw.toFixed(2)}" fill="#FFFFFF" fill-opacity=".1" stroke="${c}" stroke-width="${sw}"/>`;
    if(L.kind==="ellipse")return `<ellipse class="lens" cx="${cx}" cy="${cy}" rx="${L.hw.toFixed(2)}" ry="${L.up.toFixed(2)}" fill="#FFFFFF" fill-opacity=".1" stroke="${c}" stroke-width="${sw}"/>`;
    if(L.kind==="rect")return `<rect class="lens" x="${(cx-L.hw).toFixed(2)}" y="${(cy-L.up).toFixed(2)}" width="${(2*L.hw).toFixed(2)}" height="${(L.up+L.down).toFixed(2)}" rx="${L.rx}" fill="#FFFFFF" fill-opacity=".1" stroke="${c}" stroke-width="${sw}"/>`;
    if(L.kind==="halfrim"){const x0=cx-L.hw,x1=cx+L.hw,y0=cy-L.up,y1=cy+L.down;
      return `<rect class="lens" x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${(2*L.hw).toFixed(2)}" height="${(L.up+L.down).toFixed(2)}" rx="${L.rx}" fill="#FFFFFF" fill-opacity=".1" stroke="${c}" stroke-width=".9" stroke-opacity=".55"/>
        <path d="M${x0.toFixed(2)} ${(y0+L.rx+1.4).toFixed(2)} L${x0.toFixed(2)} ${(y0+L.rx).toFixed(2)} Q${x0.toFixed(2)} ${y0.toFixed(2)} ${(x0+L.rx).toFixed(2)} ${y0.toFixed(2)} L${(x1-L.rx).toFixed(2)} ${y0.toFixed(2)} Q${x1.toFixed(2)} ${y0.toFixed(2)} ${x1.toFixed(2)} ${(y0+L.rx).toFixed(2)} L${x1.toFixed(2)} ${(y0+L.rx+1.4).toFixed(2)}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;}
    /* cat-eye: rounded bottom, the outer top corner swept up into a point */
    const o=dir,hw=L.hw,up=L.up,dn=L.down,f=v=>v.toFixed(2);
    return `<path class="lens" d="M${f(cx-o*hw)} ${f(cy)} Q${f(cx-o*hw)} ${f(cy+dn)} ${f(cx)} ${f(cy+dn)} Q${f(cx+o*hw)} ${f(cy+dn)} ${f(cx+o*hw)} ${f(cy-.3)} L${f(cx+o*(hw+1.3))} ${f(cy-up-1.2)} Q${f(cx+o*hw*.1)} ${f(cy-up-.5)} ${f(cx-o*hw*.78)} ${f(cy-up*.82)} Q${f(cx-o*hw)} ${f(cy-up*.55)} ${f(cx-o*hw)} ${f(cy)} Z" fill="#FFFFFF" fill-opacity=".1" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  };
  const ix1=41+L.hw,ix2=59-L.hw,by=L.kind==="halfrim"||L.kind==="cateye"?cy-L.up*.55:cy-.8;
  const bridge=`<path d="M${ix1.toFixed(2)} ${by.toFixed(2)} Q50 ${(by-1.6).toFixed(2)} ${ix2.toFixed(2)} ${by.toFixed(2)}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`;
  const ty=L.kind==="halfrim"||L.kind==="cateye"?cy-L.up*.6:cy-1;
  const temples=`<path d="M${(41-L.hw).toFixed(2)} ${ty.toFixed(2)} L29.6 ${(ty+1.2).toFixed(2)} M${(59+L.hw).toFixed(2)} ${ty.toFixed(2)} L70.4 ${(ty+1.2).toFixed(2)}" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
  const glint=`<path d="M${(41-L.hw*.55).toFixed(2)} ${(cy-L.up*.35).toFixed(2)} q1.2 -1.4 2.8 -1.6 M${(59-L.hw*.55).toFixed(2)} ${(cy-L.up*.35).toFixed(2)} q1.2 -1.4 2.8 -1.6" stroke="#FFFFFF" stroke-width="1" opacity=".55" fill="none" stroke-linecap="round"/>`;
  return `<g class="glasses2">${temples}${lens(41,-1)}${lens(59,1)}${bridge}${glint}</g>`;
}
/* Eye fit for items drawn over the eyes that the barista doesn't size:
   old customer glasses and the shop sunglasses (opaque, so a smaller eye
   underneath is never seen — it just can't peek out). */
const FIXED_EYEWEAR_FIT={glasses:{w:5,up:5,down:5},glasses_square:{w:5.6,up:4.3,down:4.3},sunglasses_cool:{w:5,up:1.4,down:4.2},sunglasses_heart:{w:4.2,up:1.6,down:3.6}};

/* S9e: tall hairstyles get a tidy version under a full hat. */
const S9E_FULL_HATS=["cap_scarlet","hat_bobble","hat_chef","hat_pirate"];
const S9E_TALL_HAIR=["afro","spacebuns","topknot","spiky","fauxhawk"];
function characterSVG(look, expr, opts={}){
  const {skin,hair,hairstyle,top,hijab,accessory,fox,facialHair} = look;
  const U=(++__svgUid);
  const apronItem = opts.apron ? SHOP.find(s=>s.id===opts.apron) : null;
  const hatItem = opts.hat ? SHOP.find(s=>s.id===opts.hat) : null;
  const badgeItem = opts.badge ? SHOP.find(s=>s.id===opts.badge) : null;
  /* garment: barista shop items (opts.gstyle/opts.gcolor are item ids)
     take priority; otherwise a customer's own look.garment; otherwise
     today's plain top. Style and colour resolve independently. */
  const gStyleItem = opts.gstyle ? SHOP.find(s=>s.id===opts.gstyle) : null;
  const gColorItem = opts.gcolor ? SHOP.find(s=>s.id===opts.gcolor) : null;
  const gStyle = gStyleItem ? gStyleItem.gs : (look.garment && look.garment.style) || null;
  const gTop = gColorItem ? gColorItem.c
    : (look.garment && GARMENT_PALETTES[look.garment.palette]) || top;
  const topD=shade(gTop,-.22);
  const faceAcc = isGlassesStyle(accessory)||accessory==="eyepatch"||accessory==="heromask"||accessory==="fangs"||accessory==="glasses"||accessory==="glasses_square"||accessory==="headphones"||accessory==="ninjamask"||accessory==="mummyface"||accessory==="talisman";
  const accBefore = (!faceAcc && accessory && accessory!=="none") ? accSVG(accessory) : "";
  /* S9e: barista glasses are sized to the eyes (glassesSVG2); story
     customers keep their original glasses. Anything worn over the eyes
     shrinks the eyes to fit (vary.fit), so no eye ever pokes out. */
  const isBarista=!!(look.eyeShape||look.faceFix);
  const shopEyes=(opts.extras||[]).find(id=>id==="sunglasses_cool"||id==="sunglasses_heart");
  const glassesOn=!shopEyes&&isGlassesStyle(accessory);
  const vary={...faceVary(look)};
  let glasses2="";
  if(shopEyes)vary.fit=FIXED_EYEWEAR_FIT[shopEyes];
  else if(glassesOn&&isBarista){const L=glassesLens(accessory,eyeMaxBox(vary));vary.fit=glassesFit(L);glasses2=glassesSVG2(accessory,look.glassesColor,L);}
  else if(accessory==="glasses"||accessory==="glasses_square")vary.fit=FIXED_EYEWEAR_FIT[accessory];
  else if(opts.glasses)vary.fit=FIXED_EYEWEAR_FIT.glasses;
  const accAfter  = (faceAcc&&!glasses2&&!(isGlassesStyle(accessory)&&!["glasses","glasses_square"].includes(accessory))) ? accSVG(accessory) : glasses2;
  return `<svg viewBox="0 0 100 130" width="${opts.w||96}" height="${Math.round((opts.w||96)*1.3)}" aria-hidden="true">
  <defs>
    <linearGradient id="T${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(gTop,.18)}"/><stop offset="1" stop-color="${shade(gTop,-.18)}"/></linearGradient>
    <linearGradient id="H${U}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(hair,.16)}"/><stop offset="1" stop-color="${shade(hair,-.18)}"/></linearGradient>
    <radialGradient id="S${U}" cx="0.42" cy="0.32" r="0.8"><stop offset="0" stop-color="${shade(skin,.12)}"/><stop offset="1" stop-color="${shade(skin,-.14)}"/></radialGradient>
  </defs>
  <g>
    <ellipse cx="50" cy="119" rx="27" ry="5.5" fill="#000" opacity="0.12"/>
    ${(opts.extras||[]).map(e=>extraSVG(e,"back",U)).join("")}
    <circle cx="23.5" cy="102.5" r="4.8" fill="url(#S${U})" stroke="${INK}" stroke-width="1.3"/>
    <circle cx="76.5" cy="102.5" r="4.8" fill="url(#S${U})" stroke="${INK}" stroke-width="1.3"/>
    <path d="M45.5 61 L45.5 70 Q50 73.5 54.5 70 L54.5 61 Z" fill="url(#S${U})"/>
    <path d="M45.5 62 Q50 67.5 54.5 62 L54.5 65 Q50 69.5 45.5 65 Z" fill="${shade(skin,-.45)}" opacity="0.4"/>
    <path d="M45.5 70 Q39 73.5 36.5 76.5 Q25.5 84 20.5 97 L26.8 99.9 Q31 90.5 33.8 85.8 Q31.2 92 29.9 100 L28.6 128 L71.4 128 L70.1 100 Q68.8 92 66.2 85.8 Q69 90.5 73.2 99.9 L79.5 97 Q74.5 84 63.5 76.5 Q61 73.5 54.5 70 Q50 74 45.5 70 Z" fill="url(#T${U})" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M20.9 96.2 L27.2 99 M79.1 96.2 L72.8 99" stroke="${topD}" stroke-width="3" stroke-linecap="round"/>
    <path d="M27 84.5 Q29.5 87 31.5 91 M73 84.5 Q70.5 87 68.5 91" stroke="${topD}" stroke-width="0.9" opacity=".45" fill="none" stroke-linecap="round"/>
    <path d="M35 96 Q35.8 110 35.3 123 M65 96 Q64.2 110 64.7 123" stroke="${topD}" stroke-width="1" opacity=".35" fill="none"/>
    ${gStyle&&GARMENT_STYLES[gStyle]?GARMENT_STYLES[gStyle](gTop,U):""}
    ${apronItem?`<path d="M40 77 L60 77 L62.5 103 Q50 109 37.5 103 Z" fill="${apronItem.c}" stroke="${INK}" stroke-width="1.4"/><path d="M43 77 L45 71 M57 77 L55 71" stroke="${INK}" stroke-width="1.6"/><path d="M43 90 L57 90 L57 99 Q50 102 43 99 Z" fill="${shade(apronItem.c,-.18)}" stroke="${INK}" stroke-width="1"/>`:""}
    ${badgeItem?`<circle cx="39" cy="84" r="4.4" fill="${badgeItem.c}" stroke="${INK}" stroke-width="1.3"/><path d="M39 81.4 L39.9 83.5 L42 83.5 L40.4 84.9 L41 87 L39 85.8 L37 87 L37.6 84.9 L36 83.5 L38.1 83.5 Z" fill="#FFF"/>`:""}
    ${accBefore}
    ${(opts.extras||(opts.extra?[opts.extra]:[])).map(e=>extraSVG(e,"body")).join("")}
    <ellipse cx="29.5" cy="46.5" rx="3" ry="4.4" fill="url(#S${U})" stroke="${INK}" stroke-width="1.3"/>
    <ellipse cx="70.5" cy="46.5" rx="3" ry="4.4" fill="url(#S${U})" stroke="${INK}" stroke-width="1.3"/>
    <ellipse cx="50" cy="44" rx="20.5" ry="22" fill="url(#S${U})" stroke="${INK}" stroke-width="1.5"/>
    <path d="M31 48 Q30 60 38 65" fill="none" stroke="${shade(skin,-.45)}" stroke-width="1.6" opacity="0.3" stroke-linecap="round"/>
    ${fox?`<path d="M36 56 Q43 63 50 63 Q57 63 64 56 L64 60 Q57 67 50 67 Q43 67 36 60 Z" fill="#F4E3D0"/>`:""}
    ${hairSVG(hatItem&&S9E_FULL_HATS.includes(hatItem.id)&&S9E_TALL_HAIR.includes(hairstyle)?hairstyle+"_h":hairstyle,hair,hijab,`url(#H${U})`)}
    ${facialHairSVG(facialHair,hair,skin)}
    ${faceSVG(expr,fox,irisFor(look),vary,skin,hair)}
    ${hairstyle==="nflhelm"?`<path d="M26 49 Q30 62 42 63 L58 63 Q70 62 74 49" fill="none" stroke="#C4CCD6" stroke-width="3.2" opacity=".98"/><path d="M32 55 L36 63 M46 53 L46 63 M56 53 L56 63 M68 55 L64 63" stroke="#C4CCD6" stroke-width="2.6" opacity=".98"/>`:""}
    ${opts.glasses&&accessory!=="glasses"&&accessory!=="glasses_square"?accSVG("glasses"):""}
    ${accAfter}
    ${accessory==="fangs"?fangsFor(expr,faceVary(look)):""}
    ${(opts.extras||(opts.extra?[opts.extra]:[])).map(e=>extraSVG(e,"face")).join("")}
    ${hatItem&&hatItem.id==="cap_scarlet"?`<path d="M22 31.5 Q21 10 50 9.5 Q79 10 78 31.5 Q64 26 50 26 Q36 26 22 31.5 Z" fill="#C0392B" stroke="${INK}" stroke-width="1.4"/><path d="M50 10 L50 26 M49 10.5 Q37 13 27 28 M51 10.5 Q63 13 73 28" fill="none" stroke="#8E2A20" stroke-width="1" opacity=".55"/><circle cx="50" cy="9.9" r="1.7" fill="#8E2A20" stroke="${INK}" stroke-width="0.8"/><path d="M27 27.5 Q50 21 73 27.5 Q71 32 50 32.4 Q29 32 27 27.5 Z" fill="#C0392B" stroke="${INK}" stroke-width="1.4"/>`:""}
    ${hatItem&&hatItem.id==="crown_lexicon"?`<path d="M36 14 L41 4 L46 11 L50 2 L54 11 L59 4 L64 14 L62 19 L38 19 Z" fill="#F2B33D" stroke="${INK}" stroke-width="1.6" class="${hatItem.anim?'shimmer':''}"/>`:""}
    ${hatItem?s9dHatSVG(hatItem.id,U,hairstyle):""}
    ${hatItem&&hatItem.id==="clip_daisy"?`<circle cx="33" cy="27" r="3.6" fill="#FFF" stroke="${INK}" stroke-width="0.9"/><circle cx="33" cy="27" r="1.6" fill="#F2B33D"/>`:""}
  </g></svg>`;
}

function _moodEyes(cx1, cx2, cy, r, mood){
  /* FOUR moods: "good" (happy arcs), "excited" (big open eyes),
     "normal" (calm small eyes) and anything else = concerned. */
  if(mood==="good")
    return `<path d="M${cx1-4} ${cy} Q${cx1} ${cy-5} ${cx1+4} ${cy}" stroke="#463A54" stroke-width="2" fill="none"/>
      <path d="M${cx2-4} ${cy} Q${cx2} ${cy-5} ${cx2+4} ${cy}" stroke="#463A54" stroke-width="2" fill="none"/>`;
  if(mood==="excited")
    /* big wide-open eyes with a bright catchlight — the "ooh!" face */
    return `<circle cx="${cx1}" cy="${cy-1}" r="5" fill="#FDFBF5" stroke="#463A54" stroke-width="1.5"/>
      <circle cx="${cx2}" cy="${cy-1}" r="5" fill="#FDFBF5" stroke="#463A54" stroke-width="1.5"/>
      <circle cx="${cx1}" cy="${cy-1}" r="3" fill="#463A54"/><circle cx="${cx2}" cy="${cy-1}" r="3" fill="#463A54"/>
      <circle cx="${cx1-1.2}" cy="${cy-2.4}" r="1.2" fill="#FFF"/><circle cx="${cx2-1.2}" cy="${cy-2.4}" r="1.2" fill="#FFF"/>`;
  if(mood==="normal")
    return `<circle cx="${cx1}" cy="${cy-2}" r="2.8" fill="#463A54"/><circle cx="${cx2}" cy="${cy-2}" r="2.8" fill="#463A54"/>
      <circle cx="${cx1-0.9}" cy="${cy-3}" r="0.9" fill="#FFF"/><circle cx="${cx2-0.9}" cy="${cy-3}" r="0.9" fill="#FFF"/>`;
  return `<circle cx="${cx1}" cy="${cy-1.5}" r="2.4" fill="#463A54"/><circle cx="${cx2}" cy="${cy-1.5}" r="2.4" fill="#463A54"/>
    <path d="M${cx1-3.6} ${cy-6.4} L${cx1+3} ${cy-4.8}" stroke="#463A54" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M${cx2+3.6} ${cy-6.4} L${cx2-3} ${cy-4.8}" stroke="#463A54" stroke-width="1.5" stroke-linecap="round"/>`;
}
function _cuteEyes(cx1, cx2, cy, r, mood){
  const hl = r*0.36;
  return `<circle cx="${cx1}" cy="${cy}" r="${r}" fill="#463A54"/><circle cx="${cx2}" cy="${cy}" r="${r}" fill="#463A54"/>
    <circle cx="${cx1-r*0.3}" cy="${cy-r*0.32}" r="${hl}" fill="#FFF"/><circle cx="${cx2-r*0.3}" cy="${cy-r*0.32}" r="${hl}" fill="#FFF"/>
    ${mood==="bad"?`<path d="M${cx1-r-1.2} ${cy-r-1.2} l${r*1.7} ${r*0.45} M${cx2+r+1.2} ${cy-r-1.2} l-${r*1.7} ${r*0.45}" stroke="#463A54" stroke-width="1.4" stroke-linecap="round"/>`:""}`;
}
function _blush(x1, x2, y, col="#E8A0A4"){
  return `<ellipse cx="${x1}" cy="${y}" rx="3.2" ry="2" fill="${col}" opacity=".38"/><ellipse cx="${x2}" cy="${y}" rx="3.2" ry="2" fill="${col}" opacity=".38"/>`;
}
function _cuteMouth(cx, y, mood, col="#463A54"){
  /* FOUR moods. This helper is shared by 26 species, so widening it here
     gives them all a real neutral and an excited gape at once — rather
     than 26 hand-written ternaries. The neutral keeps the same width as
     the happy smile (a shorter flat line reads as pasted-on); the
     excited gape is an open oval sized to that mouth. */
  if(mood==="good")
    return `<path d="M${cx-4} ${y} q4 3 8 0" stroke="${col}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  if(mood==="normal")
    return `<path d="M${cx-4} ${y+0.3} q4 1.2 8 0" stroke="${col}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  if(mood==="excited")
    return `<ellipse cx="${cx}" cy="${y+1.4}" rx="2.6" ry="3" fill="#8C4A54"/>`;
  return `<path d="M${cx-3.6} ${y+0.8} q3.6 -1.3 7.2 0" stroke="${col}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
}
const PET_ACCESSORY_SVG=Object.freeze({
  pet_shades_sunny:`<g class="pet-acc pet-acc-eyes">
    <ellipse cx="28" cy="30" rx="6.2" ry="5" fill="#2E2A36" stroke="#463A54" stroke-width="1.3"/><ellipse cx="44" cy="30" rx="6.2" ry="5" fill="#2E2A36" stroke="#463A54" stroke-width="1.3"/>
    <path d="M34.2 29 L37.8 29" stroke="#463A54" stroke-width="1.6"/><path d="M21.8 28.5 L17 27 M50.2 28.5 L55 27" stroke="#463A54" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M25.5 27.5 Q27.5 26.5 29.5 27.3 M41.5 27.5 Q43.5 26.5 45.5 27.3" stroke="#8CA8C9" stroke-width="1" opacity=".6" fill="none"/></g>`,
  pet_bowtie:`<g class="pet-acc pet-acc-neck"><path d="M28 53 L34 50 L34 57 Z" fill="#B23A5F" stroke="#463A54" stroke-width="1.3" stroke-linejoin="round"/><path d="M44 53 L38 50 L38 57 Z" fill="#B23A5F" stroke="#463A54" stroke-width="1.3" stroke-linejoin="round"/><circle cx="36" cy="53" r="2.2" fill="#8E2F4A" stroke="#463A54" stroke-width="1.1"/></g>`,
  pet_bobble_hat:`<g class="pet-acc pet-acc-hat"><path d="M20 20 Q19 5 36 4 Q53 5 52 20 Q44 15.5 36 15.5 Q28 15.5 20 20 Z" fill="#3E7CA6" stroke="#463A54" stroke-width="1.6"/><path d="M19 19 Q36 12 53 19 L53 22.5 Q36 15.5 19 22.5 Z" fill="#2E5C80" stroke="#463A54" stroke-width="1.4"/><path d="M24 17 Q30 12 36 11" stroke="#8CB8D6" stroke-width="1.2" opacity=".6" fill="none"/><circle cx="36" cy="4" r="3" fill="#F2E6D0" stroke="#463A54" stroke-width="1.3"/></g>`,
  pet_party_hat:`<g class="pet-acc pet-acc-hat"><path d="M36 2 L28 20 L44 20 Z" fill="#D8547A" stroke="#463A54" stroke-width="1.6" stroke-linejoin="round"/><path d="M31 14 L41 14 M32.5 9.5 L39.5 9.5" stroke="#F2E6D0" stroke-width="1.4" opacity=".85"/><circle cx="36" cy="2" r="2.6" fill="#F2B33D" stroke="#463A54" stroke-width="1.3"/></g>`,
  pet_flower_crown:`<g class="pet-acc pet-acc-hat"><path d="M18 19 Q36 8 54 19" stroke="#7A9B5E" stroke-width="2.2" fill="none" stroke-linecap="round"/><g fill="#F2C7D4" stroke="#463A54" stroke-width="1"><circle cx="20" cy="18.5" r="2.6"/><circle cx="29" cy="12" r="2.8"/><circle cx="36" cy="9.5" r="3"/><circle cx="43" cy="12" r="2.8"/><circle cx="52" cy="18.5" r="2.6"/></g><g fill="#F2B33D"><circle cx="20" cy="18.5" r="1"/><circle cx="29" cy="12" r="1.1"/><circle cx="36" cy="9.5" r="1.2"/><circle cx="43" cy="12" r="1.1"/><circle cx="52" cy="18.5" r="1"/></g></g>`,
  pet_scarf_cosy:`<g class="pet-acc pet-acc-neck"><path d="M19 47 Q36 53 53 47 L53 51.5 Q36 57.5 19 51.5 Z" fill="#7A3B3B" stroke="#463A54" stroke-width="1.5"/><path d="M31 51.5 L29 62 L34 60 L32.5 51.8 Z" fill="#7A3B3B" stroke="#463A54" stroke-width="1.3" stroke-linejoin="round"/><path d="M24 48.5 Q36 53.5 48 48.5" stroke="#9E5C5C" stroke-width="1.1" opacity=".6" fill="none"/></g>`,
  pet_pirate_bandana:`<g class="pet-acc pet-acc-hat"><path d="M17 20 Q16 8 36 6 Q56 8 55 20 Q52 15 36 15 Q20 15 17 20 Z" fill="#B23A5F" stroke="#463A54" stroke-width="1.6"/><path d="M53 17 L59 21 L54 23 Z" fill="#B23A5F" stroke="#463A54" stroke-width="1.3" stroke-linejoin="round"/><g fill="#F2E6D0" opacity=".9"><circle cx="26" cy="11" r="1.3"/><circle cx="34" cy="8.5" r="1.3"/><circle cx="42" cy="9.5" r="1.3"/></g></g>`,
  pet_tiny_crown:`<g class="pet-acc pet-acc-hat"><path d="M20 20 L23 8 L29 15 L36 5 L43 15 L49 8 L52 20 Z" fill="#F2B33D" stroke="#463A54" stroke-width="1.6" stroke-linejoin="round"/><circle cx="23" cy="8" r="1.6" fill="#B23A5F" stroke="#463A54" stroke-width="1"/><circle cx="36" cy="5" r="1.8" fill="#5B8FB5" stroke="#463A54" stroke-width="1"/><circle cx="49" cy="8" r="1.6" fill="#B23A5F" stroke="#463A54" stroke-width="1"/><path d="M22 20 L50 20" stroke="#D8A521" stroke-width="1.2" opacity=".7"/></g>`
});
function petSVG(pet, mood, w=64, worn={}){
  const [c1,c2]=pet.colors;
  /* NEW — preview only. `head` overrides the default round head, and
     `hideFace` suppresses the shared face so a species can place its
     own eyes/mouth to suit a non-round skull. The round head remains
     the default for every existing pet: the shape is now a per-species
     choice rather than a fixed constraint. Species that set a custom
     head are exempt from the eye-grid rule and MUST say why inline. */
  let head=null, hideFace=false;
  const face = mood==="good"
    ? `<path d="M24 30 Q28 25 32 30" stroke="#463A54" stroke-width="2" fill="none"/><path d="M40 30 Q44 25 48 30" stroke="#463A54" stroke-width="2" fill="none"/><path d="M30 38 Q36 44 42 38" stroke="#463A54" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : `<circle cx="28" cy="30" r="2.6" fill="#463A54"/><circle cx="44" cy="30" r="2.6" fill="#463A54"/><path d="M31 39 Q36 41 41 39" stroke="#463A54" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  let ears="",extra="",tail="";
  /* NEW — preview only, batch 13: REDRAWS of five original pets, to the
     current standard. Each gets the shared cute-face kit, a head shape
     suited to the species, and one researched signature — replacing
     the flat dot-eyes and generic round head of the originals. */
  if(pet.species==="dog"){ /* Redraw, rev C. Original ear ellipses restored
      exactly (cx20/52, cy18, rx7 ry11). No tail. Face small and centred
      on the circle, matching the original placement. */
    hideFace=true;
    ears=`<ellipse cx="20" cy="18" rx="7" ry="11" fill="${c2}" stroke="#463A54" stroke-width="2"/><ellipse cx="52" cy="18" rx="7" ry="11" fill="${c2}" stroke="#463A54" stroke-width="2"/>`;
    extra=`<ellipse cx="36" cy="38" rx="9" ry="7" fill="${c2}"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <ellipse cx="36" cy="36" rx="2.4" ry="1.9" fill="#241C22"/>
      ${mood==="good"?`<path d="M36 38 L36 39 M36 39 q-2.6 2 -5.2 0 M36 39 q2.6 2 5.2 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 38 L36 39.4 M32.4 39.4 q3.6 1.4 7.2 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:`<path d="M32 41 q4 -1.6 8 0" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round"/>`}
      ${_blush(23, 49, 37)}`;}
  else if(pet.species==="cat"){ /* Redraw, rev C. No tail. Small centred
      face; triangle ears kept close to the original silhouette. */
    hideFace=true;
    ears=`<path d="M19 20 L14 4 L31 13 Z" fill="${c1}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/><path d="M53 20 L58 4 L41 13 Z" fill="${c1}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M20 17.5 L17 8.5 L26.5 13.5 Z" fill="#E8A8B4" opacity=".7"/><path d="M52 17.5 L55 8.5 L45.5 13.5 Z" fill="#E8A8B4" opacity=".7"/>`;
    extra=`${_moodEyes(28, 44, 30, 3, mood)}
      <path d="M33.6 35 L38.4 35 L36 37.4 Z" fill="#E8899A" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${mood==="good"?`<path d="M36 37.4 L36 38.4 M36 38.4 q-2.6 2.2 -5.2 0 M36 38.4 q2.6 2.2 5.2 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 37.4 L36 38.8 M32.6 38.8 q3.4 1.3 6.8 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:`<path d="M32 40.4 q4 -1.6 8 0" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round"/>`}
      <path d="M28 36 l-9 -1.8 M28 38.4 l-9 1 M44 36 l9 -1.8 M44 38.4 l9 1" stroke="#463A54" stroke-width="1" opacity=".6"/>
      ${_blush(23, 49, 37)}`;}
  else if(pet.species==="duck"){ /* Redraw, rev C. No tail. Bill kept —
      Nigel approved it — but brought up so the face group sits centred. */
    hideFace=true;
    ears="";
    extra=`<path d="M26 35.5 Q36 32.5 46 35.5 Q47.5 41.5 41.5 44.5 Q36 46.5 30.5 44.5 Q24.5 41.5 26 35.5 Z" fill="${c2}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M27 38.8 Q36 36.5 45 38.8" fill="none" stroke="${shade(c2,-.3)}" stroke-width="1.1" opacity=".8"/>
      ${mood==="good"?`<path d="M34 45 Q36 46.6 38 45" fill="none" stroke="${shade(c2,-.4)}" stroke-width="1.5"/>`:mood==="normal"?`<path d="M34.2 45.2 L37.8 45.2" stroke="${shade(c2,-.4)}" stroke-width="1.5" stroke-linecap="round"/>`:`<path d="M34 45.8 Q36 44.4 38 45.8" fill="none" stroke="${shade(c2,-.4)}" stroke-width="1.5"/>`}
      ${_moodEyes(28, 44, 30, 3, mood)}
      ${_blush(23, 49, 36)}`;}
  else if(pet.species==="chicken"){ /* Redraw, rev C. No tail feathers.
      Comb and wattles kept small; drawn as a hen. */
    hideFace=true;
    ears="";
    extra=`<path d="M28 15 Q29 8 32.5 12.5 Q35.5 6 38 12.5 Q41 7 43.5 12.5 Q45 9 45 15 Q36 11 28 15 Z" fill="${c2}" stroke="#463A54" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M33.5 43 Q32.5 49 35 51 Q36.5 49 36 44 Z" fill="${c2}" stroke="#463A54" stroke-width="1.3"/>
      <path d="M38.5 43 Q39.5 49 37 51 Q35.5 49 36 44 Z" fill="${c2}" stroke="#463A54" stroke-width="1.3"/>
      <path d="M32.5 36 Q36 34 39.5 36 Q38.5 41.5 36 42.5 Q33.5 41.5 32.5 36 Z" fill="#E8B33A" stroke="#463A54" stroke-width="1.5"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      ${_blush(23, 49, 36)}`;}
  else if(pet.species==="pig"){ /* Redraw, rev C. Tail removed. Snout
      smaller and centred. */
    hideFace=true;
    ears=`<path d="M20 18 Q16 4 30 11 L28 19 Z" fill="${c1}" stroke="#463A54" stroke-width="2"/><path d="M52 18 Q56 4 42 11 L44 19 Z" fill="${c1}" stroke="#463A54" stroke-width="2"/>`;
    extra=`${_moodEyes(28, 44, 30, 3, mood)}
      <ellipse cx="36" cy="39" rx="7" ry="5.5" fill="${c2}" stroke="#463A54" stroke-width="1.6"/>
      <ellipse cx="33.8" cy="39" rx="1.3" ry="1.9" fill="#B5687A"/><ellipse cx="38.2" cy="39" rx="1.3" ry="1.9" fill="#B5687A"/>
      ${mood==="good"?`<path d="M31.5 45 q4.5 2.4 9 0" stroke="#B5687A" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M32 45.2 L40 45.2" stroke="#B5687A" stroke-width="1.4" stroke-linecap="round"/>`:`<path d="M32 46 q4 -1.6 8 0" stroke="#B5687A" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
      ${_blush(23, 49, 37, "#D9788C")}`;}
  else if(pet.species==="pug"){ /* Redraw. Signature: a flat wrinkled
      face with a dark mask muzzle and small folded "rose" ears. */
    hideFace=true;
    ears=`<path d="M17 20 Q13 8 28 12 Q26 20 25 27 Z" fill="#3A3038" stroke="#463A54" stroke-width="1.9"/><path d="M55 20 Q59 8 44 12 Q46 20 47 27 Z" fill="#3A3038" stroke="#463A54" stroke-width="1.9"/>`;
    extra=`<ellipse cx="36" cy="38" rx="12" ry="9" fill="#3A3038"/>
      <path d="M26 24 Q36 21 46 24" fill="none" stroke="${shade(c1,-.3)}" stroke-width="1.4" opacity=".6"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <ellipse cx="36" cy="36" rx="3" ry="2.4" fill="#15121A"/>
      ${mood==="good"?`<path d="M36 38.4 L36 39.4 M36 39.4 q-2.6 2 -5.2 0 M36 39.4 q2.6 2 5.2 0" stroke="#8C8494" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 38.4 L36 39.8 M32.6 39.8 q3.4 1.3 6.8 0" stroke="#8C8494" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:`<path d="M32 41.4 q4 -1.6 8 0" stroke="#8C8494" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      ${_blush(23, 49, 37)}`;}
  else if(pet.species==="pugclassic"){ /* Restored from the early WordBar
      pet set: round tan head, curled tail, brow wrinkles and dark muzzle.
      Build 78 gives this pug four genuinely distinct expressions rather
      than sending excited/normal/good through the same face. */
    hideFace=true;
    ears=`<path d="M20 20 Q13 10 19 7 Q25 8 29 14 L27 21 Z" fill="${c2}" stroke="#463A54" stroke-width="2.2" stroke-linejoin="round"/><path d="M52 20 Q59 10 53 7 Q47 8 43 14 L45 21 Z" fill="${c2}" stroke="#463A54" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M56 36 Q68 31 66 44 Q64 53 55 50 Q64 49 62 41 Q61 37 56 40 Z" fill="${c1}" stroke="#463A54" stroke-width="2.2" stroke-linejoin="round"/>`;
    extra=`<path d="M27 20 Q36 14.5 45 20 M28 23 Q36 18.5 44 23 M30 25.5 Q36 22 42 25.5" fill="none" stroke="${shade(c1,-.34)}" stroke-width="1.5" stroke-linecap="round" opacity=".72"/>
      ${mood==="normal"?_cuteEyes(28,44,30,4,mood):_moodEyes(28,44,30,4,mood)}
      <ellipse cx="36" cy="39" rx="10.5" ry="8" fill="${c2}" opacity=".92"/>
      <ellipse cx="36" cy="35.5" rx="3.2" ry="2.5" fill="#463A54"/>
      ${mood==="excited"
        ?`<ellipse cx="36" cy="43" rx="4.3" ry="4.8" fill="#7A3F4B" stroke="#463A54" stroke-width="1.4"/><path d="M33.2 44.5 Q36 47.5 38.8 44.5" fill="#E5798D"/>`
        :mood==="good"
          ?`<path d="M30.5 40.2 Q36 45.5 41.5 40.2" stroke="#463A54" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M36 43 Q39 46 42 43 Q39 48 36 45 Z" fill="#D8547A"/>`
          :mood==="bad"
            ?`<path d="M31.5 43 Q36 39.5 40.5 43" stroke="#463A54" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
            :`<path d="M31.5 41.5 Q36 43 40.5 41.5" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="parrot"){ /* Redraw. Signature: the hooked bill
      and a small crest. Bright plumage does the rest. */
    hideFace=true;
    ears="";
    extra=`<path d="M30 20 Q32 13 36 17 Q40 12 42 19 Q36 16.5 30 20 Z" fill="${c2}" stroke="#463A54" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M31 37 Q36 34 41 37 Q42 44.5 38 47.5 Q36 48.5 34 47.5 Q30 44.5 31 37 Z" fill="#E8B33A" stroke="#463A54" stroke-width="1.6"/>
      <path d="M34 46 Q36 48 38 46" fill="none" stroke="#C98F2A" stroke-width="1.2"/>
      <path d="M18 32 Q24 28 28 34 Q24 38 18 32 Z" fill="${c2}" opacity=".75"/><path d="M54 32 Q48 28 44 34 Q48 38 54 32 Z" fill="${c2}" opacity=".75"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      ${_blush(23, 49, 36)}`;}
  else if(pet.species==="rabbit"){ /* Redraw. Signature: long upright ears
      with pink inners, a small Y-shaped mouth and buck teeth. */
    hideFace=true;
    ears=`<ellipse cx="27" cy="13" rx="5.5" ry="12" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="45" cy="13" rx="5.5" ry="12" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <ellipse cx="27" cy="14" rx="2.6" ry="7.6" fill="#E8A8B4" opacity=".8"/><ellipse cx="45" cy="14" rx="2.6" ry="7.6" fill="#E8A8B4" opacity=".8"/>`;
    extra=`${_moodEyes(28, 44, 30, 3, mood)}
      <path d="M34 35.5 L38 35.5 L36 37.6 Z" fill="#E8899A" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${mood==="good"?`<path d="M36 37.6 L36 38.8 M36 38.8 q-2.6 2.2 -5.2 0 M36 38.8 q2.6 2.2 5.2 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 37.6 L36 39 M33 39 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:`<path d="M32.5 40.5 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      <path d="M27 37 l-8 -1.5 M27 39.4 l-8 1 M45 37 l8 -1.5 M45 39.4 l8 1" stroke="#463A54" stroke-width="0.9" opacity=".6"/>
      ${_blush(23, 49, 37)}`;}
  else if(pet.species==="lion"){ /* Redraw. Signature: the MANE ring
      around the whole head — drawn behind so the circle stays clean. */
    hideFace=true;
    ears=`<circle cx="58.5" cy="34.0" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="55.5" cy="45.2" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="47.2" cy="53.5" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="36.0" cy="56.5" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="24.8" cy="53.5" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="16.5" cy="45.2" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="13.5" cy="34.0" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="16.5" cy="22.8" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="24.7" cy="14.5" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="36.0" cy="11.5" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="47.2" cy="14.5" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><circle cx="55.5" cy="22.7" r="7" fill="${c2}" stroke="#463A54" stroke-width="1.7"/>
      <ellipse cx="20" cy="20" rx="5" ry="4.4" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><ellipse cx="52" cy="20" rx="5" ry="4.4" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`<ellipse cx="36" cy="38" rx="10" ry="7.5" fill="${shade(c1,.25)}"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <path d="M33.6 35 L38.4 35 L36 37.4 Z" fill="#463A54" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${mood==="good"?`<path d="M36 37.4 L36 38.6 M36 38.6 q-2.8 2.2 -5.6 0 M36 38.6 q2.8 2.2 5.6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 37.4 L36 39 M33 39 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:`<path d="M32.5 40.5 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      ${_blush(24, 48, 37)}`;}
  else if(pet.species==="pigeon"){ /* Redraw. Signature: the small
      triangular bill with its white cere, and the iridescent neck
      patch. No visible ears. */
    hideFace=true;
    ears="";
    extra=`<path d="M22 41 Q36 37.5 50 41 Q48 47 36 48.5 Q24 47 22 41 Z" fill="#5C8C7A" opacity=".55"/>
      <path d="M33 35 L39 35 L36 40 Z" fill="#E8A8A0" stroke="#463A54" stroke-width="1.3" stroke-linejoin="round"/>
      <ellipse cx="36" cy="34.5" rx="3.4" ry="1.6" fill="#F2EFE8" stroke="#463A54" stroke-width="1"/>
      ${_moodEyes(28, 44, 29, 3, mood)}
      <circle cx="28" cy="27" r="4.4" fill="none" stroke="#E8A03C" stroke-width="1.1" opacity=".8"/>
      <circle cx="44" cy="27" r="4.4" fill="none" stroke="#E8A03C" stroke-width="1.1" opacity=".8"/>
      ${_blush(22, 50, 38)}`;}
  else if(pet.species==="koala"){ /* Redraw. Signature: enormous fluffy
      round ears and a big dark leathery nose. */
    hideFace=true;
    ears=`<circle cx="13" cy="26" r="12" fill="${c1}" stroke="#463A54" stroke-width="2"/><circle cx="59" cy="26" r="12" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <circle cx="13" cy="26" r="7" fill="${c2}"/><circle cx="59" cy="26" r="7" fill="${c2}"/>
      <path d="M7 21 q4 -2 6 1 M53 21 q4 -2 6 1" fill="none" stroke="${shade(c2,-.25)}" stroke-width="1.1" opacity=".7"/>`;
    extra=`${_moodEyes(28, 44, 29, 3, mood)}
      <path d="M31 34 Q36 31 41 34 Q42 40 36 42 Q30 40 31 34 Z" fill="#3A3038" stroke="#463A54" stroke-width="1.4"/>
      <ellipse cx="34" cy="35.5" rx="1" ry="1.4" fill="#5C5460" opacity=".7"/><ellipse cx="38" cy="35.5" rx="1" ry="1.4" fill="#5C5460" opacity=".7"/>
      ${mood==="good"?`<path d="M31 45 q5 2.4 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M32.5 45 L39.5 45" stroke="#463A54" stroke-width="1.4" stroke-linecap="round"/>`:`<path d="M32 46 q4 -1.6 8 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      ${_blush(23, 49, 40)}`;}
  else if(pet.species==="redpanda"){ /* Redraw. Signature: white
      "eyebrow" patches and cheek fur against a rust face, plus pointed
      white-rimmed ears. */
    hideFace=true;
    ears=`<path d="M18 20 L13 6 L30 13 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9" stroke-linejoin="round"/><path d="M54 20 L59 6 L42 13 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9" stroke-linejoin="round"/>
      <path d="M19 17.5 L16 10 L25.5 13.5 Z" fill="#F2EFE8" opacity=".85"/><path d="M53 17.5 L56 10 L46.5 13.5 Z" fill="#F2EFE8" opacity=".85"/>`;
    extra=`<path d="M16 30 Q22 22 28 26 Q26 33 20 35 Z" fill="#F2EFE8" opacity=".9"/><path d="M56 30 Q50 22 44 26 Q46 33 52 35 Z" fill="#F2EFE8" opacity=".9"/>
      <ellipse cx="36" cy="38" rx="11" ry="8.5" fill="#F2EFE8"/>
      ${_moodEyes(28, 44, 29, 3, mood)}
      <ellipse cx="36" cy="35.5" rx="2.6" ry="2" fill="#241C22"/>
      ${mood==="good"?`<path d="M36 37.5 L36 38.6 M36 38.6 q-2.8 2.2 -5.6 0 M36 38.6 q2.8 2.2 5.6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 37.5 L36 39 M33 39 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:`<path d="M32.5 40.5 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      ${_blush(23, 49, 38)}`;}
  else if(pet.species==="panda"){ /* Redraw. Signature: black ear discs
      and the black teardrop eye patches on a white face. */
    hideFace=true;
    ears=`<circle cx="17" cy="16" r="9" fill="#2E2A32" stroke="#463A54" stroke-width="1.9"/><circle cx="55" cy="16" r="9" fill="#2E2A32" stroke="#463A54" stroke-width="1.9"/>`;
    extra=`<path d="M21 28 Q29 22 33 30 Q31 41 22 39 Q17 34 21 28 Z" fill="#2E2A32"/>
      <path d="M51 28 Q43 22 39 30 Q41 41 50 39 Q55 34 51 28 Z" fill="#2E2A32"/>
      ${_moodEyes(27, 45, 32, 3, mood)}
      <ellipse cx="36" cy="37" rx="3" ry="2.2" fill="#2E2A32"/>
      ${mood==="good"?`<path d="M36 39.2 L36 40.2 M36 40.2 q-2.8 2.2 -5.6 0 M36 40.2 q2.8 2.2 5.6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 39.2 L36 40.6 M33 40.6 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="42" rx="2.6" ry="3" fill="#8C4A54"/>`:`<path d="M32.5 42 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      ${_blush(23, 49, 38)}`;}
  else if(pet.species==="penguin"){ /* Original WordBar penguin restored,
      extended with excited and calm/content expressions. */
    hideFace=true;
    ears=`<ellipse cx="27" cy="55" rx="6" ry="3.4" fill="#F2A03D" stroke="#463A54" stroke-width="1.8"/><ellipse cx="45" cy="55" rx="6" ry="3.4" fill="#F2A03D" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`<ellipse cx="36" cy="42" rx="14" ry="12.5" fill="#FDFBF5"/>
      <ellipse cx="28.5" cy="30" rx="8" ry="7" fill="#FDFBF5"/><ellipse cx="43.5" cy="30" rx="8" ry="7" fill="#FDFBF5"/>
      ${mood==="excited"?`<circle cx="28.5" cy="30" r="4.7" fill="#463A54"/><circle cx="43.5" cy="30" r="4.7" fill="#463A54"/>`:`<circle cx="28.5" cy="30" r="4" fill="#463A54"/><circle cx="43.5" cy="30" r="4" fill="#463A54"/>`}
      <circle cx="27.3" cy="28.6" r="1.5" fill="#FFF"/><circle cx="42.3" cy="28.6" r="1.5" fill="#FFF"/>
      <circle cx="29.9" cy="31.4" r="0.7" fill="#FFF" opacity=".85"/><circle cx="44.9" cy="31.4" r="0.7" fill="#FFF" opacity=".85"/>
      ${mood==="bad"?`<path d="M24 25.6 l7 1.8 M48 25.6 l-7 1.8" stroke="#463A54" stroke-width="1.5" stroke-linecap="round"/>`:""}
      <path d="M32.8 34.5 L39.2 34.5 L36 38.8 Z" fill="#F2A03D" stroke="#463A54" stroke-width="1.2"/>
      ${mood==="good"?`<path d="M31 42.5 q5 3.2 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="43.5" rx="2.8" ry="3.3" fill="#8C4A54"/>`:mood==="normal"?`<path d="M31.5 43 q4.5 1.2 9 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:`<path d="M32 44 q4 -1.2 8 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
      <ellipse cx="21" cy="36" rx="2.7" ry="1.8" fill="#F2B8C6" opacity=".8"/><ellipse cx="51" cy="36" rx="2.7" ry="1.8" fill="#F2B8C6" opacity=".8"/>
      <path d="M13.5 28 Q10 40 17.5 47 Q21.5 43.5 19.8 35 Q18.2 29.5 13.5 28 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M58.5 28 Q62 40 54.5 47 Q50.5 43.5 52.2 35 Q53.8 29.5 58.5 28 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <circle cx="26" cy="17.5" r="1.2" fill="#FFF" opacity=".7"/><circle cx="30.5" cy="14.8" r="0.8" fill="#FFF" opacity=".7"/>`; }
  else if(pet.species==="raccoon"){ /* Redraw. Signature: the black BANDIT
      MASK across both eyes, on a pale face, with small round ears. */
    hideFace=true;
    ears=`<circle cx="17" cy="18" r="7.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><circle cx="55" cy="18" r="7.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="17" cy="18" r="3.8" fill="#EFE8DA" opacity=".7"/><circle cx="55" cy="18" r="3.8" fill="#EFE8DA" opacity=".7"/>`;
    extra=`<ellipse cx="36" cy="34" rx="20" ry="15" fill="#EFE8DA" opacity=".9"/>
      <path d="M18 28 Q26 23 33 28 Q33 35 26 36 Q18 35 18 28 Z" fill="#2E2A32"/>
      <path d="M54 28 Q46 23 39 28 Q39 35 46 36 Q54 35 54 28 Z" fill="#2E2A32"/>
      <path d="M30 24 Q36 21 42 24 Q36 26 30 24 Z" fill="#2E2A32" opacity=".85"/>
      ${_moodEyes(27, 45, 30, 3, mood)}
      <ellipse cx="36" cy="38" rx="2.6" ry="2" fill="#241C22"/>
      ${mood==="good"?`<path d="M36 40 L36 41 M36 41 q-2.6 2 -5.2 0 M36 41 q2.6 2 5.2 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 40 L36 41.4 M33 41.4 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="43" rx="2.4" ry="2.8" fill="#8C4A54"/>`:`<path d="M32.5 43 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      <path d="M27 39 l-9 -1.8 M27 41.4 l-9 1 M45 39 l9 -1.8 M45 41.4 l9 1" stroke="#463A54" stroke-width="0.9" opacity=".55"/>
      ${_blush(23, 49, 39)}`;}
  else if(pet.species==="squirrel"){ /* Redraw to match the round,
      child-friendly reference more closely: big connected curled tail,
      broad pale cheeks/muzzle and two tiny front teeth. */
    hideFace=true;
    ears=`<path d="M18 20 Q13 7 28 13 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9" stroke-linejoin="round"/><path d="M54 20 Q59 7 44 13 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9" stroke-linejoin="round"/>
      <path d="M20 17 Q17 10 25.5 13 Z" fill="${c2}" opacity=".72"/><path d="M52 17 Q55 10 46.5 13 Z" fill="${c2}" opacity=".72"/>`;
    tail=`<path d="M55 53 Q69 47 67 32 Q66 17 53 12 Q45 9 39 16 Q44 16 48 21 Q54 28 51 39 Q49 47 43 52" fill="none" stroke="${c1}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M55 53 Q69 47 67 32 Q66 17 53 12" fill="none" stroke="${c2}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" opacity=".62"/>`;
    extra=`<ellipse cx="36" cy="38.5" rx="13" ry="9.4" fill="${c2}"/>
      <ellipse cx="28" cy="39" rx="5.2" ry="4.6" fill="#F3E7D0"/><ellipse cx="44" cy="39" rx="5.2" ry="4.6" fill="#F3E7D0"/><ellipse cx="36" cy="40.4" rx="7.8" ry="5.6" fill="#F7ECDC"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <ellipse cx="36" cy="36.4" rx="2.4" ry="1.9" fill="#241C22"/>
      ${mood==="good"?`<path d="M36 38.8 L36 39.8 M36 39.8 q-2.6 2 -5.2 0 M36 39.8 q2.6 2 5.2 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 38.8 L36 40.2 M33 40.2 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="41.8" rx="2.4" ry="2.8" fill="#8C4A54"/>`:`<path d="M32.5 41.8 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      <rect x="33.8" y="38.2" width="1.7" height="2.7" rx=".5" fill="#FFF8F2" stroke="#CFC3B4" stroke-width=".35"/><rect x="36.5" y="38.2" width="1.7" height="2.7" rx=".5" fill="#FFF8F2" stroke="#CFC3B4" stroke-width=".35"/>
      <path d="M27 38 l-9 -1.8 M27 40.3 l-9 1 M45 38 l9 -1.8 M45 40.3 l9 1" stroke="#8C7A68" stroke-width="0.9" opacity=".7"/>
      ${_blush(23, 49, 38)}`;}
  else if(pet.species==="dachshund"){ /* Redraw. Signature: very long
      pendulous ears framing the whole head, and tan eyebrow dots — the
      classic black-and-tan marking. */
    hideFace=true;
    ears=`<ellipse cx="12" cy="34" rx="8" ry="18" fill="${shade(c1,-.25)}" stroke="#463A54" stroke-width="1.9"/><ellipse cx="60" cy="34" rx="8" ry="18" fill="${shade(c1,-.25)}" stroke="#463A54" stroke-width="1.9"/>`;
    extra=`<ellipse cx="36" cy="40" rx="11" ry="8.5" fill="${c2}"/>
      <ellipse cx="28" cy="24" rx="3.4" ry="2.4" fill="${c2}" opacity=".9"/><ellipse cx="44" cy="24" rx="3.4" ry="2.4" fill="${c2}" opacity=".9"/>
      ${_moodEyes(28, 44, 31, 3, mood)}
      <ellipse cx="36" cy="37.5" rx="2.8" ry="2.2" fill="#241C22"/>
      ${mood==="good"?`<path d="M36 39.7 L36 40.7 M36 40.7 q-2.6 2 -5.2 0 M36 40.7 q2.6 2 5.2 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 39.7 L36 41.1 M33 41.1 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="43" rx="2.4" ry="2.8" fill="#8C4A54"/>`:`<path d="M32.5 43 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      ${_blush(23, 49, 39)}`;}
  else if(pet.species==="tiger"){ /* Redraw. Signature: bold vertical
      STRIPES anchored at the head edge, a white muzzle, and rounded
      ears with white spots. */
    hideFace=true;
    ears=`<circle cx="17" cy="17" r="8" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><circle cx="55" cy="17" r="8" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="17" cy="17" r="3.8" fill="#2E2A32"/><circle cx="55" cy="17" r="3.8" fill="#2E2A32"/>
      <circle cx="17" cy="17" r="1.6" fill="#F2EFE8"/><circle cx="55" cy="17" r="1.6" fill="#F2EFE8"/>`;
    extra=`<path d="M13 26 L22 28 M12 34 L21 34 M14 42 L22 40 M59 26 L50 28 M60 34 L51 34 M58 42 L50 40 M30 14 L32 21 M42 14 L40 21" stroke="#2E2A32" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="36" cy="40" rx="12" ry="9" fill="#F5F1EA"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <path d="M33.4 36 L38.6 36 L36 38.6 Z" fill="#E8899A" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${mood==="good"?`<path d="M36 38.6 L36 39.8 M36 39.8 q-2.8 2.2 -5.6 0 M36 39.8 q2.8 2.2 5.6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 38.6 L36 40.2 M33 40.2 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="42" rx="2.6" ry="3" fill="#8C4A54"/>`:`<path d="M32.5 42 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      <path d="M26 39 l-10 -2 M26 41.6 l-10 1 M46 39 l10 -2 M46 41.6 l10 1" stroke="#463A54" stroke-width="0.9" opacity=".6"/>
      ${_blush(22, 50, 40)}`;}
  else if(pet.species==="frenchie"){ /* French Bulldog. Researched: the
      BAT EARS are the breed standard — upright, BROAD at the base and
      ROUNDED (blunt) at the tip, not pointed, and angled outward past
      the sides of the head. Plus a flat brachycephalic face with a
      wrinkled brow and a short pushed-in muzzle. */
    hideFace=true;
    ears=`<path d="M20 24 Q14 6 26 4 Q33 8 30 26 Z" fill="${c1}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M52 24 Q58 6 46 4 Q39 8 42 26 Z" fill="${c1}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M22 22 Q18 9 26 8 Q29 12 28 24 Z" fill="#D9A8A0" opacity=".65"/>
      <path d="M50 22 Q54 9 46 8 Q43 12 44 24 Z" fill="#D9A8A0" opacity=".65"/>`;
    extra=`<path d="M26 24 Q36 21 46 24" fill="none" stroke="${shade(c1,-.3)}" stroke-width="1.4" opacity=".6"/>
      <path d="M28 29 Q36 26.5 44 29" fill="none" stroke="${shade(c1,-.3)}" stroke-width="1.2" opacity=".5"/>
      <ellipse cx="36" cy="39" rx="11" ry="8" fill="${c2}"/>
      ${_moodEyes(28, 44, 31, 3.4, mood)}
      <ellipse cx="36" cy="36.5" rx="3" ry="2.3" fill="#241C22"/>
      ${_cuteMouth(36, 40, mood)}
      ${_blush(22, 50, 38)}`;}
  else if(pet.species==="corgi"){ /* Pembroke Welsh Corgi. Researched:
      large upright ears described as FOX-LIKE — bigger and more
      pointed than a Frenchie's rounded bat ears — over a fox face with
      a white blaze and pale muzzle. */
    hideFace=true;
    ears=`<path d="M19 22 L14 2 L32 13 Z" fill="${c1}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M53 22 L58 2 L40 13 Z" fill="${c1}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M20 19 L17 7 L27.5 13 Z" fill="#E8C4B4" opacity=".7"/><path d="M52 19 L55 7 L44.5 13 Z" fill="#E8C4B4" opacity=".7"/>`;
    extra=`<path d="M33 20 Q36 17 39 20 L38.5 33 Q36 35 33.5 33 Z" fill="${c2}" opacity=".95"/>
      <ellipse cx="36" cy="39" rx="11" ry="8" fill="${c2}"/>
      ${_moodEyes(28, 44, 31, 3.4, mood)}
      <ellipse cx="36" cy="36.5" rx="2.8" ry="2.2" fill="#241C22"/>
      ${_cuteMouth(36, 40, mood)}
      ${_blush(22, 50, 38)}`;}
  else if(pet.species==="hollandlop"){ /* Holland Lop. Researched: the
      LOPPED ears hanging limply beside the head are the breed's
      defining feature — the deliberate contrast with the existing
      upright-eared rabbit. One of the smallest lop breeds. */
    hideFace=true;
    ears=`<ellipse cx="12" cy="34" rx="8" ry="16" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <ellipse cx="60" cy="34" rx="8" ry="16" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <ellipse cx="12" cy="35" rx="4" ry="10.5" fill="#E8B4BC" opacity=".65"/>
      <ellipse cx="60" cy="35" rx="4" ry="10.5" fill="#E8B4BC" opacity=".65"/>`;
    extra=`${_moodEyes(28, 44, 30, 3.4, mood)}
      <path d="M34 35 L38 35 L36 37 Z" fill="#E8899A" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${mood==="good"?`<path d="M36 37 L36 38.2 M36 38.2 q-2.6 2.2 -5.2 0 M36 38.2 q2.6 2.2 5.2 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 37 L36 38.4 M33 38.4 q3 1.2 6 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="40" rx="2.4" ry="2.8" fill="#8C4A54"/>`:`<path d="M32.5 39.5 q3.5 -1.4 7 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      <path d="M27 36 l-8 -1.5 M27 38.4 l-8 1 M45 36 l8 -1.5 M45 38.4 l8 1" stroke="#463A54" stroke-width="0.9" opacity=".55"/>
      ${_blush(22, 50, 37)}`;}
  else if(pet.species==="guineapig"){ /* Guinea pig, Teddy breed: dense
      wiry coat, small rounded ears set low like petals, a blunt Roman
      nose and no visible tail. The coat rosettes are the Teddy read. */
    hideFace=true;
    ears=`<path d="M15 26 Q10 20 17 17 Q23 19 22 27 Z" fill="${c2}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M57 26 Q62 20 55 17 Q49 19 50 27 Z" fill="${c2}" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`<path d="M18 20 q4 -3 6 1 M48 20 q4 -3 6 1 M14 34 q4 -3 6 1 M52 34 q4 -3 6 1 M20 44 q4 -3 6 1 M46 44 q4 -3 6 1" stroke="${shade(c1,-.28)}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".6"/>
      <ellipse cx="36" cy="38" rx="10.5" ry="7.5" fill="${c2}"/>
      ${_moodEyes(28, 44, 30, 3.6, mood)}
      <ellipse cx="36" cy="35.5" rx="2.6" ry="2" fill="#C4788C"/>
      ${_cuteMouth(36, 39, mood)}
      ${_blush(22, 50, 37)}`;}
  else if(pet.species==="hamster"){ /* Syrian hamster: small round ears,
      big dark eyes and — the signature — bulging CHEEK POUCHES either
      side of the face, stuffed with food. */
    hideFace=true;
    ears=`<circle cx="18" cy="18" r="6.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><circle cx="54" cy="18" r="6.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="18" cy="18" r="3.4" fill="#E8B4BC" opacity=".7"/><circle cx="54" cy="18" r="3.4" fill="#E8B4BC" opacity=".7"/>`;
    extra=`<ellipse cx="19" cy="38" rx="8" ry="7.5" fill="${c1}" stroke="#463A54" stroke-width="1.6"/>
      <ellipse cx="53" cy="38" rx="8" ry="7.5" fill="${c1}" stroke="#463A54" stroke-width="1.6"/>
      <ellipse cx="36" cy="38" rx="11" ry="8" fill="${c2}"/>
      ${_moodEyes(28, 44, 30, 3.8, mood)}
      <ellipse cx="36" cy="35.5" rx="2.4" ry="1.9" fill="#C4788C"/>
      ${_cuteMouth(36, 39, mood)}
      <path d="M27 36 l-8 -1.5 M27 38.4 l-8 1 M45 36 l8 -1.5 M45 38.4 l8 1" stroke="#8C7A68" stroke-width="0.9" opacity=".6"/>
      ${_blush(23, 49, 40)}`;}
  else if(pet.species==="chinchilla"){ /* Chinchilla. Researched: large
      ROUND ears and large round eyes set WIDE APART (a rat's are beady
      and close together — that contrast is what keeps this distinct
      from the fancy rat), with prominent whiskers and dense silver fur. */
    hideFace=true;
    ears=`<ellipse cx="14" cy="20" rx="9" ry="10.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="58" cy="20" rx="9" ry="10.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="14" cy="20.5" rx="5" ry="6.2" fill="#D9B4BC" opacity=".6"/>
      <ellipse cx="58" cy="20.5" rx="5" ry="6.2" fill="#D9B4BC" opacity=".6"/>`;
    extra=`<ellipse cx="36" cy="38" rx="10.5" ry="7.5" fill="${c2}"/>
      ${_moodEyes(26.5, 45.5, 30, 3.8, mood)}
      <ellipse cx="36" cy="35.5" rx="2.4" ry="1.9" fill="#C4788C"/>
      ${_cuteMouth(36, 39, mood)}
      <path d="M26 36 l-10 -2 M26 38.6 l-10 1.2 M46 36 l10 -2 M46 38.6 l10 1.2" stroke="#8C8494" stroke-width="0.9" opacity=".7"/>
      ${_blush(21, 51, 37)}`;}
  else if(pet.species==="sugarglider"){ /* Sugar glider. Researched: huge
      dark eyes dominate a pointed face, with DARK RINGS around them and
      a DARK STRIPE running from the nose over the head — that stripe is
      the field mark. Rounded ears that swivel. */
    hideFace=true;
    ears=`<ellipse cx="16" cy="19" rx="7.5" ry="9" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="56" cy="19" rx="7.5" ry="9" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="16" cy="19.5" rx="4" ry="5.2" fill="#3A3644" opacity=".55"/>
      <ellipse cx="56" cy="19.5" rx="4" ry="5.2" fill="#3A3644" opacity=".55"/>`;
    extra=`<path d="M33 20 Q36 18 39 20 L38 36 Q36 38 34 36 Z" fill="#3A3644"/>
      <ellipse cx="36" cy="41" rx="10" ry="7" fill="${c2}"/>
      <ellipse cx="27" cy="29" rx="7" ry="7.5" fill="#3A3644" opacity=".85"/>
      <ellipse cx="45" cy="29" rx="7" ry="7.5" fill="#3A3644" opacity=".85"/>
      ${_moodEyes(27, 45, 30, 4.4, mood)}
      <ellipse cx="36" cy="38.5" rx="2.2" ry="1.7" fill="#241C22"/>
      ${_cuteMouth(36, 42, mood)}
      ${_blush(20, 52, 39)}`;}
  else if(pet.species==="fancyrat"){ /* Fancy rat. Researched: BEADY eyes
      set CLOSE together, large prominent ears, a pointed snout and long
      spreading whiskers — deliberately the opposite of the chinchilla's
      wide-set round eyes. Drawn hooded (dark cape, pale face). */
    hideFace=true;
    ears=`<circle cx="16" cy="21" r="8.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="56" cy="21" r="8.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="16" cy="21" r="4.6" fill="#D9A0A8" opacity=".65"/>
      <circle cx="56" cy="21" r="4.6" fill="#D9A0A8" opacity=".65"/>`;
    extra=`<path d="M15 26 Q36 16 57 26 Q36 22 15 26 Z" fill="${c1}" opacity=".85"/>
      <path d="M28 34 Q36 30 44 34 Q42 44 36 46 Q30 44 28 34 Z" fill="${c2}"/>
      ${_moodEyes(30, 42, 30, 3.2, mood)}
      <ellipse cx="36" cy="38" rx="2.2" ry="1.7" fill="#C4788C"/>
      ${_cuteMouth(36, 41, mood)}
      <path d="M29 38 l-11 -2 M29 40.6 l-11 1.4 M43 38 l11 -2 M43 40.6 l11 1.4" stroke="#8C7A72" stroke-width="0.9" opacity=".7"/>
      ${_blush(22, 50, 39)}`;}
  else if(pet.species==="ragdoll"){ /* Ragdoll cat. The COLOURPOINT mask
      — a darker face against a pale body — plus vivid blue eyes are the
      breed markers, and both read at sprite size, which is why this
      earns its own drawing rather than being a cat colour variant. */
    hideFace=true;
    ears=`<path d="M19 20 L14 4 L31 13 Z" fill="${c2}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M53 20 L58 4 L41 13 Z" fill="${c2}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M20 17.5 L17 8.5 L26.5 13.5 Z" fill="#D9A8B4" opacity=".7"/>
      <path d="M52 17.5 L55 8.5 L45.5 13.5 Z" fill="#D9A8B4" opacity=".7"/>`;
    extra=`<ellipse cx="36" cy="34" rx="15" ry="14" fill="${c2}" opacity=".9"/>
      <circle cx="28" cy="30" r="4.4" fill="#5C8CC4"/><circle cx="44" cy="30" r="4.4" fill="#5C8CC4"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <path d="M33.6 35 L38.4 35 L36 37.4 Z" fill="#E8899A" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${_cuteMouth(36, 38.6, mood)}
      <path d="M26 36 l-10 -2 M26 38.6 l-10 1 M46 36 l10 -2 M46 38.6 l10 1" stroke="#463A54" stroke-width="0.9" opacity=".6"/>
      ${_blush(22, 50, 37)}`;}
  else if(pet.species==="britshort"){ /* British Shorthair. The breed is
      defined by a very ROUND head with full chubby cheeks and big
      COPPER eyes — drawn with the cheeks pushed wider than the standard
      cat so it reads as the stocky teddy-bear breed. */
    hideFace=true;
    ears=`<path d="M21 22 L17 8 L32 15 Z" fill="${c1}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M51 22 L55 8 L40 15 Z" fill="${c1}" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M22 19.5 L19.5 12 L27.5 15.5 Z" fill="#D9A8B4" opacity=".65"/>
      <path d="M50 19.5 L52.5 12 L44.5 15.5 Z" fill="#D9A8B4" opacity=".65"/>`;
    extra=`<ellipse cx="20" cy="38" rx="9" ry="8" fill="${c2}" opacity=".65"/>
      <ellipse cx="52" cy="38" rx="9" ry="8" fill="${c2}" opacity=".65"/>
      <circle cx="28" cy="30" r="4.6" fill="#D98C3C"/><circle cx="44" cy="30" r="4.6" fill="#D98C3C"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <path d="M33.6 35 L38.4 35 L36 37.4 Z" fill="#C4788C" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${_cuteMouth(36, 38.6, mood)}
      <path d="M26 36 l-10 -2 M26 38.6 l-10 1 M46 36 l10 -2 M46 38.6 l10 1" stroke="#463A54" stroke-width="0.9" opacity=".55"/>
      ${_blush(21, 51, 38)}`;}
  else if(pet.species==="arcticfox"){ /* Arctic fox, winter coat.
      Researched: unlike other foxes it has SHORT, ROUNDED ears and a
      SHORT muzzle — reduced surface area for heat conservation. That
      inversion of the usual big-pointy-fox-ears is the identity, so it
      must not be drawn with a red fox's ears. Dense white winter coat. */
    hideFace=true;
    ears=`<circle cx="17" cy="19" r="8" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="55" cy="19" r="8" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="17" cy="19" r="4.2" fill="#D9C4CC" opacity=".55"/>
      <circle cx="55" cy="19" r="4.2" fill="#D9C4CC" opacity=".55"/>`;
    extra=`<path d="M14 30 q5 -4 8 1 M50 30 q5 -4 8 1 M13 40 q5 -4 8 1 M51 40 q5 -4 8 1" stroke="${shade(c1,-.12)}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="36" cy="38" rx="10.5" ry="7.5" fill="${c2}"/>
      ${_moodEyes(28, 44, 30, 3.4, mood)}
      <ellipse cx="36" cy="35.5" rx="2.6" ry="2" fill="#3A3038"/>
      ${_cuteMouth(36, 39, mood)}
      <path d="M27 36 l-9 -1.8 M27 38.4 l-9 1 M45 36 l9 -1.8 M45 38.4 l9 1" stroke="#B0AAB4" stroke-width="0.9" opacity=".7"/>
      ${_blush(22, 50, 37, "#D9A8B0")}`;}
  else if(pet.species==="snowleopard"){ /* Snow leopard. Pale smoky coat
      with dark ROSETTES (open rings, not solid spots), small rounded
      ears set wide, a short broad muzzle, and pale grey-green eyes —
      unusual among big cats, most of which have gold eyes. */
    hideFace=true;
    ears=`<path d="M20 20 Q17 8 31 14 Q28 20 27 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <path d="M52 20 Q55 8 41 14 Q44 20 45 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <path d="M22 18 Q20 11 27.5 14.5 Z" fill="#3A3644" opacity=".6"/>
      <path d="M50 18 Q52 11 44.5 14.5 Z" fill="#3A3644" opacity=".6"/>`;
    extra=`<circle cx="17" cy="30" r="3.4" fill="none" stroke="#3A3644" stroke-width="1.6" opacity=".8"/>
      <circle cx="55" cy="30" r="3.4" fill="none" stroke="#3A3644" stroke-width="1.6" opacity=".8"/>
      <circle cx="20" cy="42" r="3" fill="none" stroke="#3A3644" stroke-width="1.5" opacity=".75"/>
      <circle cx="52" cy="42" r="3" fill="none" stroke="#3A3644" stroke-width="1.5" opacity=".75"/>
      <circle cx="30" cy="22" r="2.6" fill="none" stroke="#3A3644" stroke-width="1.4" opacity=".7"/>
      <circle cx="42" cy="22" r="2.6" fill="none" stroke="#3A3644" stroke-width="1.4" opacity=".7"/>
      <ellipse cx="36" cy="39" rx="11" ry="8" fill="${c2}"/>
      <circle cx="28" cy="30" r="4.4" fill="#9EB4A8"/><circle cx="44" cy="30" r="4.4" fill="#9EB4A8"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <path d="M33.4 35.5 L38.6 35.5 L36 38 Z" fill="#C4788C" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${_cuteMouth(36, 39.4, mood)}
      ${_blush(22, 50, 38)}`;}
  else if(pet.species==="dikdik"){ /* Dik-dik, a tiny antelope. Signature:
      ENORMOUS eyes with a conspicuous dark PREORBITAL GLAND slit just
      in front of each one, a mobile elongated snout, and an upright
      TUFT of hair on the crown. Males carry small spike horns. */
    hideFace=true;
    ears=`<ellipse cx="14" cy="24" rx="7.5" ry="11" fill="${c1}" stroke="#463A54" stroke-width="1.9" transform="rotate(-18 14 24)"/>
      <ellipse cx="58" cy="24" rx="7.5" ry="11" fill="${c1}" stroke="#463A54" stroke-width="1.9" transform="rotate(18 58 24)"/>
      <path d="M30 16 Q32 6 34 14 Q36 4 38 14 Q40 6 42 16 Q36 13 30 16 Z" fill="${c2}" stroke="#463A54" stroke-width="1.4"/>
      <path d="M30 15 L28 6 M42 15 L44 6" stroke="#3A3038" stroke-width="2.4" stroke-linecap="round"/>`;
    extra=`<ellipse cx="36" cy="38.5" rx="8.5" ry="7" fill="${c2}"/>
      ${_moodEyes(27, 45, 30, 4.4, mood)}
      <path d="M22 31 q3.5 -1.5 4 2.5 q-3.5 1.5 -4 -2.5 Z" fill="#241C22" opacity=".85"/>
      <path d="M50 31 q-3.5 -1.5 -4 2.5 q3.5 1.5 4 -2.5 Z" fill="#241C22" opacity=".85"/>
      <ellipse cx="36" cy="36.5" rx="2.6" ry="2" fill="#241C22"/>
      ${_cuteMouth(36, 40, mood)}
      ${_blush(21, 51, 38)}`;}
  else if(pet.species==="wombat"){ /* Common wombat. Stocky, with small
      rounded ears set wide, tiny eyes, and a very BROAD bare nose pad
      that takes up most of the muzzle — the nose is the read. */
    hideFace=true;
    ears=`<circle cx="16" cy="20" r="6.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="56" cy="20" r="6.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="16" cy="20" r="3.4" fill="${c2}" opacity=".6"/>
      <circle cx="56" cy="20" r="3.4" fill="${c2}" opacity=".6"/>`;
    extra=`<ellipse cx="36" cy="39" rx="12" ry="8.5" fill="${c2}"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <ellipse cx="36" cy="37.5" rx="6.5" ry="4.4" fill="#3A3038"/>
      <ellipse cx="33.4" cy="37" rx="1.1" ry="1.5" fill="#5C5460" opacity=".8"/>
      <ellipse cx="38.6" cy="37" rx="1.1" ry="1.5" fill="#5C5460" opacity=".8"/>
      ${_cuteMouth(36, 42, mood)}
      ${_blush(22, 50, 39)}`;}
  else if(pet.species==="galago"){ /* Galago (bush baby). Signature: huge
      forward-facing eyes for night vision, and enormous THIN mobile
      ears that fold and swivel independently — bigger relative to the
      head than almost any other primate. */
    hideFace=true;
    ears=`<ellipse cx="12" cy="22" rx="9" ry="13" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <ellipse cx="60" cy="22" rx="9" ry="13" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M8 18 Q12 12 16 18 M56 18 Q60 12 64 18" fill="none" stroke="${shade(c1,-.3)}" stroke-width="1.2" opacity=".65"/>
      <path d="M8 26 Q12 21 16 26 M56 26 Q60 21 64 26" fill="none" stroke="${shade(c1,-.3)}" stroke-width="1.2" opacity=".6"/>`;
    extra=`<ellipse cx="36" cy="40" rx="9" ry="7" fill="${c2}"/>
      <circle cx="27" cy="30" r="8" fill="#3A3038" opacity=".22"/>
      <circle cx="45" cy="30" r="8" fill="#3A3038" opacity=".22"/>
      ${_moodEyes(27, 45, 30, 5.2, mood)}
      <ellipse cx="36" cy="37.5" rx="2.2" ry="1.7" fill="#241C22"/>
      ${_cuteMouth(36, 41, mood)}
      ${_blush(20, 52, 39)}`;}
  else if(pet.species==="coati"){ /* Coati. Researched: nicknamed the
      HOG-NOSED RACCOON — the long, flexible, slightly UPTURNED pig-like
      snout is what separates it from the raccoon and the raccoon dog,
      all three of which share a dark eye mask. White markings ring the
      eyes, nose and inner ears; ears are short and heavily furred. */
    hideFace=true;
    ears=`<circle cx="17" cy="20" r="6.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="55" cy="20" r="6.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="17" cy="20" r="3.2" fill="#F2EFE8" opacity=".8"/>
      <circle cx="55" cy="20" r="3.2" fill="#F2EFE8" opacity=".8"/>`;
    extra=`<path d="M20 29 Q28 24 34 29 Q33 36 26 36.5 Q20 35 20 29 Z" fill="#3A2E28"/>
      <path d="M52 29 Q44 24 38 29 Q39 36 46 36.5 Q52 35 52 29 Z" fill="#3A2E28"/>
      <ellipse cx="27.5" cy="29.5" rx="5" ry="5" fill="#F2EFE8" opacity=".85"/>
      <ellipse cx="44.5" cy="29.5" rx="5" ry="5" fill="#F2EFE8" opacity=".85"/>
      ${_moodEyes(27.5, 44.5, 30, 3, mood)}
      <path d="M31 36 Q36 33 41 36 Q41.5 41 38 43 Q36 44 34 43 Q30.5 41 31 36 Z" fill="#EFE8DA" stroke="#463A54" stroke-width="1.3"/>
      <ellipse cx="36" cy="35.5" rx="2.4" ry="1.8" fill="#241C22"/>
      ${_cuteMouth(36, 41, mood)}
      ${_blush(21, 51, 39)}`;}
  else if(pet.species==="raccoondog"){ /* Raccoon dog (tanuki). Shares the
      dark eye mask with raccoon and coati, so the distinction is drawn
      deliberately: a ROUND blunt canid face with a fluffy cheek ruff
      and a short muzzle — no upturned snout, no white nose ring. */
    hideFace=true;
    ears=`<path d="M18 20 Q15 9 28 13 Q25 19 24 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <path d="M54 20 Q57 9 44 13 Q47 19 48 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>`;
    extra=`<path d="M10 32 Q18 28 24 34 Q20 44 12 42 Q7 38 10 32 Z" fill="${c2}" opacity=".85"/>
      <path d="M62 32 Q54 28 48 34 Q52 44 60 42 Q65 38 62 32 Z" fill="${c2}" opacity=".85"/>
      <path d="M19 28 Q28 23 34 29 Q33 37 25 38 Q18 36 19 28 Z" fill="#2E2A32"/>
      <path d="M53 28 Q44 23 38 29 Q39 37 47 38 Q54 36 53 28 Z" fill="#2E2A32"/>
      ${_moodEyes(27.5, 44.5, 30, 3.2, mood)}
      <ellipse cx="36" cy="39" rx="9" ry="6.5" fill="${c2}"/>
      <ellipse cx="36" cy="36.5" rx="2.8" ry="2.1" fill="#241C22"/>
      ${_cuteMouth(36, 40, mood)}
      ${_blush(20, 52, 39)}`;}
  else if(pet.species==="pangolin"){ /* Pangolin. The overlapping keratin
      SCALES are the whole identity — the only mammal with them. Small
      head, tiny eyes, no external ear flaps, and a narrow snout. */
    hideFace=true;
    ears="";
    extra=`<path d="M16 22 q6 -6 10 1 q-6 6 -10 -1 Z M30 17 q6 -6 10 1 q-6 6 -10 -1 Z M44 22 q6 -6 10 1 q-6 6 -10 -1 Z" fill="${c2}" stroke="#463A54" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M12 33 q6 -6 10 1 q-6 6 -10 -1 Z M50 33 q6 -6 10 1 q-6 6 -10 -1 Z" fill="${c2}" stroke="#463A54" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M15 44 q6 -6 10 1 q-6 6 -10 -1 Z M47 44 q6 -6 10 1 q-6 6 -10 -1 Z" fill="${c2}" stroke="#463A54" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M29 33 Q36 29 43 33 Q42 43 36 46 Q30 43 29 33 Z" fill="${shade(c1,.25)}"/>
      ${_moodEyes(31, 41, 31, 2.6, mood)}
      <ellipse cx="36" cy="39" rx="2.2" ry="1.7" fill="#241C22"/>
      ${_cuteMouth(36, 42, mood)}
      ${_blush(24, 48, 40)}`;}
  else if(pet.species==="echidna"){ /* Short-beaked echidna. Signature: a
      coat of SPINES plus a long narrow tubular BEAK — a monotreme, so
      the beak is a snout rather than a bird's bill. Tiny eyes. */
    hideFace=true;
    const spike=(x,lean)=>`<path d="M${x-3} 28 L${x+lean*5} 8 L${x+3} 28 Z" fill="${c2}" stroke="#463A54" stroke-width="1.1" stroke-linejoin="round"/>`;
    ears=spike(15,-0.9)+spike(22,-0.5)+spike(29.5,-0.2)+spike(36,0)+spike(42.5,0.2)+spike(50,0.5)+spike(57,0.9);
    extra=`<path d="M14 31 Q36 24 58 31 Q36 27 14 31 Z" fill="${shade(c1,-.2)}"/>
      <path d="M31 34 Q36 31 41 34 L39.5 43 Q36 44.5 32.5 43 Z" fill="${shade(c1,.2)}" stroke="#463A54" stroke-width="1.4"/>
      ${_moodEyes(28, 44, 31, 2.6, mood)}
      <ellipse cx="36" cy="42" rx="1.9" ry="1.5" fill="#241C22"/>
      ${_cuteMouth(36, 38, mood)}
      ${_blush(22, 50, 37)}`;}
  else if(pet.species==="mara"){ /* Patagonian mara. A long-legged rodent
      built like a small deer: tall upright ears, large dark eyes and a
      blunt hare-like muzzle with a pale eye ring. */
    hideFace=true;
    ears=`<ellipse cx="22" cy="12" rx="5.5" ry="12" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="50" cy="12" rx="5.5" ry="12" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="22" cy="13" rx="2.6" ry="7.6" fill="${c2}" opacity=".7"/>
      <ellipse cx="50" cy="13" rx="2.6" ry="7.6" fill="${c2}" opacity=".7"/>`;
    extra=`<ellipse cx="28" cy="30" rx="6.4" ry="6" fill="${c2}" opacity=".85"/>
      <ellipse cx="44" cy="30" rx="6.4" ry="6" fill="${c2}" opacity=".85"/>
      <ellipse cx="36" cy="39" rx="9.5" ry="7" fill="${c2}"/>
      ${_moodEyes(28, 44, 30, 3.6, mood)}
      <ellipse cx="36" cy="36.5" rx="2.4" ry="1.9" fill="#241C22"/>
      ${_cuteMouth(36, 40, mood)}
      <path d="M27 37 l-9 -1.8 M27 39.4 l-9 1 M45 37 l9 -1.8 M45 39.4 l9 1" stroke="#8C7A68" stroke-width="0.9" opacity=".65"/>
      ${_blush(21, 51, 38)}`;}
  else if(pet.species==="sandcat"){ /* Sand cat. Researched: large
      TRIANGULAR ears set LOW on the sides, which gives the head its
      flat broad look — that low placement is the field mark separating
      it from every other small cat. Plus reddish streaks running from
      the eye corners across the cheeks, greenish-yellow eyes with a
      white ring, black nose tip and thick white cheek fur. */
    hideFace=true;
    ears=`<path d="M14 30 L10 16 L27 24 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9" stroke-linejoin="round"/>
      <path d="M58 30 L62 16 L45 24 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9" stroke-linejoin="round"/>
      <path d="M15 27.5 L12.5 19 L23 24 Z" fill="#F2EFE8" opacity=".8"/>
      <path d="M57 27.5 L59.5 19 L49 24 Z" fill="#F2EFE8" opacity=".8"/>
      <path d="M10 16 L13 20 M62 16 L59 20" stroke="#2E2A32" stroke-width="2.2" stroke-linecap="round"/>`;
    extra=`<ellipse cx="36" cy="39" rx="13" ry="8.5" fill="${c2}"/>
      <path d="M24 33 L16 37 M48 33 L56 37" stroke="#C4623C" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>
      <circle cx="28" cy="30" r="4.8" fill="#C4CC7A"/><circle cx="44" cy="30" r="4.8" fill="#C4CC7A"/>
      ${_moodEyes(28, 44, 30, 3, mood)}
      <path d="M33.6 35.5 L38.4 35.5 L36 38 Z" fill="#2E2A32" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${_cuteMouth(36, 39.4, mood)}
      <path d="M25 37 l-9 -1.8 M25 39.4 l-9 1 M47 37 l9 -1.8 M47 39.4 l9 1" stroke="#463A54" stroke-width="0.9" opacity=".55"/>
      ${_blush(22, 50, 38)}`;}
  else if(pet.species==="ocelot"){ /* Ocelot. Researched: its markings are
      CHAIN ROSETTES — elongated blotches linked into chains, not the
      isolated round spots of other small cats — plus two black cheek
      stripes and a white spot on the back of each ear. */
    hideFace=true;
    ears=`<path d="M19 20 L14 5 L31 14 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9" stroke-linejoin="round"/>
      <path d="M53 20 L58 5 L41 14 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9" stroke-linejoin="round"/>
      <path d="M20 17 L16.5 8 L26 13 Z" fill="#2E2A32" opacity=".85"/>
      <path d="M52 17 L55.5 8 L46 13 Z" fill="#2E2A32" opacity=".85"/>
      <circle cx="19.5" cy="12" r="2" fill="#F2EFE8"/><circle cx="52.5" cy="12" r="2" fill="#F2EFE8"/>`;
    extra=`<path d="M13 27 q4 -3 7 0 q-3 3.5 -7 0 Z M13 36 q4 -3 7 0 q-3 3.5 -7 0 Z M15 44 q4 -3 7 0 q-3 3.5 -7 0 Z" fill="none" stroke="#3A3038" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M59 27 q-4 -3 -7 0 q3 3.5 7 0 Z M59 36 q-4 -3 -7 0 q3 3.5 7 0 Z M57 44 q-4 -3 -7 0 q3 3.5 7 0 Z" fill="none" stroke="#3A3038" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M29 20 q4 -2.5 7 0.5 M36 20.5 q4 -2.5 7 0.5" fill="none" stroke="#3A3038" stroke-width="1.5"/>
      <ellipse cx="36" cy="39" rx="11" ry="8" fill="${c2}"/>
      <path d="M25 33 L18 36 M25 37 L18 40 M47 33 L54 36 M47 37 L54 40" stroke="#3A3038" stroke-width="1.6" stroke-linecap="round"/>
      ${_moodEyes(28, 44, 30, 3.2, mood)}
      <path d="M33.4 35.5 L38.6 35.5 L36 38 Z" fill="#C4788C" stroke="#463A54" stroke-width="1" stroke-linejoin="round"/>
      ${_cuteMouth(36, 39.4, mood)}
      ${_blush(22, 50, 38)}`;}
  else if(pet.species==="sloth"){ /* Sloth — REDRAW. The first attempt was
      rejected for using loose fringe strokes that were not anchored to
      any filled mass. Researched replacement: three-toed sloths have a
      real face pattern — a DARK BAND across the brow with an orange
      patch around it, and dark stripes running back from the eyes. The
      shaggy crown is now a filled hood shape, not floating strokes. */
    hideFace=true;
    ears="";
    extra=`<path d="M12 30 Q16 12 36 10 Q56 12 60 30 Q50 22 36 21 Q22 22 12 30 Z" fill="${shade(c1,-.25)}"/>
      <ellipse cx="36" cy="36" rx="19" ry="16" fill="${c2}"/>
      <path d="M17 27 Q36 20 55 27 Q36 24 17 27 Z" fill="#8C6A3C" opacity=".85"/>
      <path d="M18 29 Q28 25 33 31 Q31 37 22 36 Q16 33 18 29 Z" fill="#4A3A2E" opacity=".9"/>
      <path d="M54 29 Q44 25 39 31 Q41 37 50 36 Q56 33 54 29 Z" fill="#4A3A2E" opacity=".9"/>
      ${_moodEyes(27.5, 44.5, 30, 3.2, mood)}
      <ellipse cx="36" cy="37" rx="2.6" ry="2" fill="#3A2E28"/>
      ${mood==="good"?`<path d="M28 40.5 Q36 46 44 40.5" stroke="#6E5A42" stroke-width="1.6" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M28.5 41 q7.5 1.6 15 0" stroke="#6E5A42" stroke-width="1.6" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="42" rx="3" ry="3.4" fill="#8C4A54"/>`:`<path d="M29 42 q7 -1.8 14 0" stroke="#6E5A42" stroke-width="1.6" fill="none" stroke-linecap="round"/>`}
      ${_blush(21, 51, 39)}`;}
  else if(pet.species==="dog_legacy"){ears=`<ellipse cx="20" cy="18" rx="7" ry="11" fill="${c2}" stroke="#463A54" stroke-width="2"/><ellipse cx="52" cy="18" rx="7" ry="11" fill="${c2}" stroke="#463A54" stroke-width="2"/>`;extra=`<ellipse cx="36" cy="36" rx="5" ry="4" fill="${c2}"/><circle cx="36" cy="34" r="2.2" fill="#463A54"/>`;}
  else if(pet.species==="parrot"){ears="";extra=`<path d="M30 34 L36 42 L42 34 Z" fill="#F2B33D" stroke="#463A54" stroke-width="1.6"/><path d="M50 26 Q62 30 56 44 L48 40 Z" fill="${c2}" stroke="#463A54" stroke-width="1.6"/>`;}
  else if(pet.species==="meerkat"){ /* small rounded ears close to the
      head; signature dark eye-patches + pale muzzle, sandy tan body */
    ears=`<ellipse cx="19" cy="17" rx="6.5" ry="7" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="53" cy="17" rx="6.5" ry="7" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="19" cy="17" rx="3.2" ry="3.6" fill="${c2}"/><ellipse cx="53" cy="17" rx="3.2" ry="3.6" fill="${c2}"/>`;
    extra=`<ellipse cx="36" cy="38" rx="12" ry="9.5" fill="${c2}"/>
      <ellipse cx="27" cy="29.5" rx="5.2" ry="6" fill="#463A54" opacity=".88"/><ellipse cx="45" cy="29.5" rx="5.2" ry="6" fill="#463A54" opacity=".88"/>
      <circle cx="27" cy="30" r="2.4" fill="#F4E3D0"/><circle cx="45" cy="30" r="2.4" fill="#F4E3D0"/>
      <circle cx="27" cy="30" r="1.1" fill="#463A54"/><circle cx="45" cy="30" r="1.1" fill="#463A54"/>
      <ellipse cx="36" cy="38.5" rx="3" ry="2.3" fill="#463A54"/>
      ${mood==="good"?`<path d="M36 40.8 L36 42.8 M36 42.8 q-3 2.2 -6 0 M36 42.8 q3 2.2 6 0" stroke="#463A54" stroke-width="1.3" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 40.8 L36 42.6 M33.1 42.6 q2.9 1.1 5.8 0" stroke="#463A54" stroke-width="1.3" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<path d="M36 40.8 L36 42.6" stroke="#463A54" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="36" cy="44.7" rx="2.1" ry="2.5" fill="#8C4A54"/>`:`<path d="M31 43.6 q5 -1.3 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="capybara"){ /* blocky head, small low-set ears,
      big wide flat muzzle taking up most of the lower face, sleepy eyes */
    ears=`<ellipse cx="20" cy="15" rx="5" ry="4.4" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="52" cy="15" rx="5" ry="4.4" fill="${c1}" stroke="#463A54" stroke-width="2"/>`;
    extra=`<ellipse cx="36" cy="39.5" rx="15" ry="9.5" fill="${c2}" stroke="#463A54" stroke-width="1.6"/>
      <path d="M25 27 Q29 24 33 27" stroke="#463A54" stroke-width="2" fill="none"/><path d="M39 27 Q43 24 47 27" stroke="#463A54" stroke-width="2" fill="none"/>
      <circle cx="30" cy="38" r="1.6" fill="#463A54"/><circle cx="42" cy="38" r="1.6" fill="#463A54"/>
      ${mood==="good"?`<path d="M31 43.5 q5 3 10 0" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M31.5 43.9 q4.5 1.2 9 0" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="44.9" rx="3.2" ry="3.6" fill="#8C4A54"/>`:`<path d="M31.5 44.5 q4.5 -1 9 0" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="flamingo"){ /* no ears; signature down-curved
      black-tipped beak and a small head tuft, pink body */
    ears="";
    extra=`<path d="M22 30 Q10 34 8 42 Q7 48 14 48 Q20 47 24 40 Q28 34 34 34" fill="none" stroke="${c1}" stroke-width="7" stroke-linecap="round"/>
      <path d="M8 42 Q6 46 10 47 Q14 47 14 43 Q13 41 10 41 Z" fill="#463A54"/>
      <path d="M24 12 Q22 6 26 4" stroke="${c2}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      ${mood==="excited"?`<path d="M23.5 10 Q20 3 25 1" stroke="${c2}" stroke-width="2" fill="none" stroke-linecap="round"/>`:""}
      <ellipse cx="44" cy="30" rx="${mood==="excited"?4.1:3.6}" ry="${mood==="excited"?4.9:4.4}" fill="#463A54"/><circle cx="45.3" cy="28.4" r="1.1" fill="#FFF"/>
      ${mood==="bad"?`<path d="M39 24 l6 2" stroke="#463A54" stroke-width="1.3" stroke-linecap="round"/>`:""}
      ${mood==="good"?`<path d="M40 38 q6 2.6 12 0" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M41 39 q5 1 10 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="46" cy="40.5" rx="2.6" ry="3.1" fill="#8C4A54"/>`:`<path d="M41 40 q5 -1.2 10 0" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round"/>`}
      <ellipse cx="50" cy="36" rx="2.6" ry="1.8" fill="${c2}" opacity=".7"/>`; }
  else if(pet.species==="otter"){ /* small ears set low and wide, round
      face with a pale muzzle patch, whiskers, custom cute eyes */
    ears=`<ellipse cx="17" cy="22" rx="5.5" ry="5" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="55" cy="22" rx="5.5" ry="5" fill="${c1}" stroke="#463A54" stroke-width="2"/>`;
    extra=`<ellipse cx="36" cy="38.5" rx="13" ry="9.5" fill="${c2}"/>
      <circle cx="28" cy="29" r="4.2" fill="#463A54"/><circle cx="44" cy="29" r="4.2" fill="#463A54"/>
      <circle cx="26.7" cy="27.6" r="1.5" fill="#FFF"/><circle cx="42.7" cy="27.6" r="1.5" fill="#FFF"/>
      ${mood==="bad"?`<path d="M23.5 25 l8 2 M48.5 25 l-8 2" stroke="#463A54" stroke-width="1.5" stroke-linecap="round"/>`:""}
      <ellipse cx="36" cy="36" rx="3.2" ry="2.5" fill="#463A54"/>
      ${mood==="good"?`<path d="M36 38.6 L36 40.6 M36 40.6 q-3.2 2.3 -6.3 0 M36 40.6 q3.2 2.3 6.3 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M36 38.6 L36 40.4 M32.9 40.4 q3.1 1.2 6.2 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<path d="M36 38.6 L36 40.4" stroke="#463A54" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="36" cy="42.6" rx="2.5" ry="2.9" fill="#8C4A54"/>`:`<path d="M31 44 q5 -1.3 10 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      <path d="M22 38 l-7 -1.5 M22 41 l-7 1 M50 38 l7 -1.5 M50 41 l7 1" stroke="#8C8494" stroke-width="1" opacity=".8"/>`;}
  /* NEW — preview only, London Zoo batch 2 of 2 */
  else if(pet.species==="gorilla"){ /* small ears close to the head, heavy
      brow ridge, wide nose, lighter muzzle patch */
    ears=`<ellipse cx="16" cy="30" rx="5" ry="6.5" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="56" cy="30" rx="5" ry="6.5" fill="${c1}" stroke="#463A54" stroke-width="2"/>`;
    extra=`<path d="M21 27 Q36 20 51 27 L48 31 Q36 26 24 31 Z" fill="#463A54" opacity=".9"/>
      <ellipse cx="36" cy="46" rx="13" ry="10" fill="${c2}"/>
      <circle cx="27.5" cy="31" r="3.6" fill="#463A54"/><circle cx="44.5" cy="31" r="3.6" fill="#463A54"/>
      <circle cx="26.4" cy="29.8" r="1.2" fill="#FFF"/><circle cx="43.4" cy="29.8" r="1.2" fill="#FFF"/>
      <ellipse cx="31" cy="44" rx="3.2" ry="2.4" fill="#463A54"/><ellipse cx="41" cy="44" rx="3.2" ry="2.4" fill="#463A54"/>
      ${mood==="good"?`<path d="M27 50 Q36 55 45 50" stroke="#463A54" stroke-width="1.7" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M29 50.4 q7 1.4 14 0" stroke="#463A54" stroke-width="1.7" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="51.4" rx="3.6" ry="4" fill="#6E3A44"/>`:`<path d="M29 50.5 q7 -1.4 14 0" stroke="#463A54" stroke-width="1.7" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="tortoise"){ /* small wrinkly head/neck poking up
      from below; hexagonal scute pattern decorates the main shell-body */
    ears="";
    extra=`<path d="M25 20 Q22 10 30 6 Q40 3 44 10 Q47 16 42 22 Q36 26 30 24 Z" fill="${c2}" opacity=".85"/>
      <path d="M35 24 Q35 32 33 40" stroke="${c1}" stroke-width="9" stroke-linecap="round" fill="none"/>
      <ellipse cx="30" cy="14" rx="10" ry="9" fill="${c2}" stroke="#463A54" stroke-width="1.6"/>
      ${mood==="excited"?`<circle cx="26" cy="11.6" r="1.9" fill="#463A54"/><circle cx="34" cy="11.6" r="1.9" fill="#463A54"/>`:mood==="normal"?`<circle cx="26" cy="12" r="1.6" fill="#463A54"/><circle cx="34" cy="12" r="1.6" fill="#463A54"/>`:mood==="bad"?`<path d="M23 9.5 l5 1.6 M37 11.1 l4.7-1.6" stroke="#463A54" stroke-width="1.1" stroke-linecap="round"/><circle cx="26" cy="12.3" r="1.5" fill="#463A54"/><circle cx="34" cy="12.3" r="1.5" fill="#463A54"/>`:`<circle cx="26" cy="12" r="1.6" fill="#463A54"/><circle cx="34" cy="12" r="1.6" fill="#463A54"/>`}
      <circle cx="25.3" cy="11.2" r="0.6" fill="#FFF"/><circle cx="33.3" cy="11.2" r="0.6" fill="#FFF"/>
      <path d="M32 44 l6 -8 6 8 -6 6 Z M14 40 l7 -6 6 7 -6 7 Z M46 40 l7 -6 6 7 -6 7 Z M20 54 l7 -6 6 7 -6 6 Z M40 54 l7 -6 6 7 -6 6 Z" fill="none" stroke="#463A54" stroke-width="1.3" opacity=".55"/>
      ${mood==="good"?`<path d="M23 18 Q26 20 29 18" stroke="#463A54" stroke-width="1.3" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M23.5 18.2 q2.7 .8 5.4 0" stroke="#463A54" stroke-width="1.2" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="26.2" cy="18.8" rx="2.1" ry="2.4" fill="#8C4A54"/>`:`<path d="M23 19.2 q3 -1 6 0" stroke="#463A54" stroke-width="1.3" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="komodo"){ /* elongated grey-green snout, scale
      texture, slit pupils, forked tongue — first reptile signature */
    ears="";
    extra=`<path d="M18 40 Q8 42 8 48 Q8 52 14 51 Q19 49 23 42 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M8 49 L2 47 M8 51 L2 52" stroke="#C43D3D" stroke-width="1.4" stroke-linecap="round"/>
      <ellipse cx="37" cy="44" rx="15" ry="9" fill="${c1}" stroke="#463A54" stroke-width="1.6"/>
      <circle cx="15" cy="42" r="0.9" fill="#463A54"/><circle cx="21" cy="44" r="0.9" fill="#463A54"/><circle cx="28" cy="46" r="0.9" fill="#463A54"/><circle cx="36" cy="47" r="0.9" fill="#463A54"/><circle cx="44" cy="46" r="0.9" fill="#463A54"/>
      <ellipse cx="28" cy="30" rx="4.4" ry="5.2" fill="${c2}" stroke="#463A54" stroke-width="1.4"/><ellipse cx="44" cy="30" rx="4.4" ry="5.2" fill="${c2}" stroke="#463A54" stroke-width="1.4"/>
      <ellipse cx="28" cy="30.5" rx="1" ry="3.4" fill="#463A54"/><ellipse cx="44" cy="30.5" rx="1" ry="3.4" fill="#463A54"/>
      ${mood==="bad"?`<path d="M23 23 l8 2 M49 25 l-8 2" stroke="#463A54" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>`:""}
      <path d="M14 22 Q20 18 26 21 M46 21 Q52 18 58 22" stroke="#463A54" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>
      ${mood==="good"?`<path d="M30 39 q7 2.2 14 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M31 40 q6 1 12 0" stroke="#463A54" stroke-width="1.3" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="41.2" rx="2.6" ry="3.1" fill="#8C4A54"/>`:`<path d="M31 41.4 q6 -1.2 12 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="owl"){ /* big round forward eyes with a facial-
      disc ring, small hooked beak, optional ear-tufts */
    ears=`<path d="M18 14 Q14 4 24 8 Q22 14 20 18 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><path d="M54 14 Q58 4 48 8 Q50 14 52 18 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`<circle cx="26" cy="32" r="11" fill="${c2}" stroke="#463A54" stroke-width="1.6"/><circle cx="46" cy="32" r="11" fill="${c2}" stroke="#463A54" stroke-width="1.6"/>
      <circle cx="26" cy="32" r="6.4" fill="#463A54"/><circle cx="46" cy="32" r="6.4" fill="#463A54"/>
      <circle cx="24.4" cy="30.2" r="2" fill="#FFF"/><circle cx="44.4" cy="30.2" r="2" fill="#FFF"/>
      ${mood==="bad"?`<path d="M18 24 q8 -3 15 0 M39 24 q8 -3 15 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<circle cx="26" cy="32" r="2" fill="#FFF" opacity=".9"/><circle cx="46" cy="32" r="2" fill="#FFF" opacity=".9"/>`:""}
      <path d="M33 38 L39 38 L36 44 Z" fill="#F2B33D" stroke="#463A54" stroke-width="1.3"/>
      <path d="M14 44 Q10 52 16 58 Q20 54 18 46 Z M58 44 Q62 52 56 58 Q52 54 54 46 Z" fill="${c1}" opacity=".75"/>`;}
  /* NEW — preview only, London Zoo batch 3. All identity kept INSIDE the
     head ellipse with only ears protruding — matching the batch-1/2
     designs that worked, not the ones that pushed geometry outside it. */
  else if(pet.species==="zebra"){ /* stripes drawn like the tiger's (thick
      strokes anchored at the head edge), dark muzzle, upright ears */
    ears=`<ellipse cx="20" cy="15" rx="6" ry="8" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="52" cy="15" rx="6" ry="8" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="20" cy="15.5" rx="2.8" ry="4.6" fill="${c2}"/><ellipse cx="52" cy="15.5" rx="2.8" ry="4.6" fill="${c2}"/>`;
    extra=`<path d="M30 13 Q36 10 42 13 L41 20 Q36 17 31 20 Z" fill="${c2}"/>
      <path d="M13 27 L23 29 M12 35 L22 35 M14 43 L23 41 M59 27 L49 29 M60 35 L50 35 M58 43 L49 41 M31 16 L33 23 M41 16 L39 23" stroke="${c2}" stroke-width="2.8" stroke-linecap="round"/>
      <ellipse cx="36" cy="41" rx="9" ry="7" fill="${c2}"/>
      <ellipse cx="32.5" cy="40" rx="1.6" ry="1.2" fill="#463A54"/><ellipse cx="39.5" cy="40" rx="1.6" ry="1.2" fill="#463A54"/>
      ${mood==="good"?`<path d="M31 45 q5 3 10 0" stroke="#F4E3D0" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M31.5 45.4 q4.5 1.2 9 0" stroke="#F4E3D0" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="46.4" rx="2.8" ry="3.2" fill="#8C6A64"/>`:`<path d="M31.5 45.5 q4.5 -1 9 0" stroke="#F4E3D0" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="monkey"){ /* squirrel monkey: pale heart-shaped
      face mask with a dark cap band across the top, round side ears */
    ears=`<circle cx="15" cy="32" r="7" fill="${c1}" stroke="#463A54" stroke-width="2"/><circle cx="57" cy="32" r="7" fill="${c1}" stroke="#463A54" stroke-width="2"/><circle cx="15" cy="32" r="3.4" fill="${c2}"/><circle cx="57" cy="32" r="3.4" fill="${c2}"/>`;
    extra=`<ellipse cx="36" cy="38" rx="17" ry="16" fill="${c2}"/>
      <path d="M19 27 Q36 14 53 27 Q45 22 36 22 Q27 22 19 27 Z" fill="#463A54" opacity=".85"/>
      <ellipse cx="28.5" cy="33" rx="4" ry="4.6" fill="#463A54"/><ellipse cx="43.5" cy="33" rx="4" ry="4.6" fill="#463A54"/>
      <circle cx="27.3" cy="31.6" r="1.4" fill="#FFF"/><circle cx="42.3" cy="31.6" r="1.4" fill="#FFF"/>
      ${mood==="bad"?`<path d="M24 28.6 l7.5 1.8 M48 28.6 l-7.5 1.8" stroke="#463A54" stroke-width="1.4" stroke-linecap="round"/>`:""}
      <ellipse cx="36" cy="41.5" rx="3" ry="2" fill="#463A54"/>
      ${mood==="good"?`<path d="M30 45.5 q6 3.6 12 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M30 45.8 q6 1.5 12 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="46.6" rx="3" ry="3.4" fill="#8C4A54"/>`:`<path d="M31 46.5 q5 -1.2 10 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="hippo"){ /* pygmy hippo: enormous rounded muzzle
      filling the lower face (same approach as the capybara that worked),
      tiny ears, small eyes set high */
    ears=`<ellipse cx="21" cy="16" rx="4.6" ry="4" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="51" cy="16" rx="4.6" ry="4" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="21" cy="16" rx="2" ry="1.7" fill="${c2}"/><ellipse cx="51" cy="16" rx="2" ry="1.7" fill="${c2}"/>`;
    extra=`<ellipse cx="36" cy="38" rx="16.5" ry="9.5" fill="${c2}" stroke="#463A54" stroke-width="1.6"/>
      <circle cx="27" cy="27" r="3" fill="#463A54"/><circle cx="45" cy="27" r="3" fill="#463A54"/>
      <circle cx="26" cy="26" r="1.1" fill="#FFF"/><circle cx="44" cy="26" r="1.1" fill="#FFF"/>
      ${mood==="bad"?`<path d="M23 23.4 l6.5 1.6 M49 23.4 l-6.5 1.6" stroke="#463A54" stroke-width="1.4" stroke-linecap="round"/>`:""}
      <ellipse cx="29" cy="34.5" rx="2.6" ry="2" fill="#463A54"/><ellipse cx="43" cy="34.5" rx="2.6" ry="2" fill="#463A54"/>
      ${mood==="good"?`<path d="M27 41.5 Q36 47.5 45 41.5" stroke="#463A54" stroke-width="1.8" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M28 41.9 q8 1.8 16 0" stroke="#463A54" stroke-width="1.8" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<path d="M27 40 Q36 49.5 45 40 Q36 46.5 27 40 Z" fill="#8C4A54" stroke="#463A54" stroke-width="1.5"/>`:`<path d="M29 42.5 q7 -1.4 14 0" stroke="#463A54" stroke-width="1.8" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="bat"){ /* fruit bat: oversized rounded ears, pale
      snub muzzle, small fangs — wing hints kept inside the canvas */
    ears=`<path d="M17 22 Q9 6 24 10 Q23 18 22 24 Z" fill="${c1}" stroke="#463A54" stroke-width="2"/><path d="M55 22 Q63 6 48 10 Q49 18 50 24 Z" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <path d="M18.5 20 Q14 10 22 12" fill="${c2}" opacity=".8"/><path d="M53.5 20 Q58 10 50 12" fill="${c2}" opacity=".8"/>`;
    extra=`<ellipse cx="36" cy="37.5" rx="11.5" ry="9" fill="${c2}"/>
      <circle cx="28.5" cy="30" r="3.8" fill="#463A54"/><circle cx="43.5" cy="30" r="3.8" fill="#463A54"/>
      <circle cx="27.4" cy="28.8" r="1.3" fill="#FFF"/><circle cx="42.4" cy="28.8" r="1.3" fill="#FFF"/>
      ${mood==="bad"?`<path d="M24.5 26.4 l7 1.7 M47.5 26.4 l-7 1.7" stroke="#463A54" stroke-width="1.4" stroke-linecap="round"/>`:""}
      <ellipse cx="36" cy="35.5" rx="3.1" ry="2.3" fill="#463A54"/>
      ${mood==="good"?`<path d="M31 40.5 q5 3 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M32.5 41.1 l1 2.6 M39.5 41.1 l-1 2.6" stroke="#FDFBF5" stroke-width="1.6" stroke-linecap="round"/>`:mood==="normal"?`<path d="M31.5 40.9 q4.5 1.2 9 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="41.9" rx="2.6" ry="3" fill="#8C4A54"/><path d="M34.2 40.1 l0.7 2.2 M37.8 40.1 l-0.7 2.2" stroke="#FDFBF5" stroke-width="1.4" stroke-linecap="round"/>`:`<path d="M31 41.5 q5 -1.2 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
      <path d="M16 46 Q12 54 20 57 Q23 52 21 47 Z M56 46 Q60 54 52 57 Q49 52 51 47 Z" fill="${c1}" opacity=".7"/>`;}
  else if(pet.species==="frog"){ /* Darwin's frog: two big domed eyes set
      high, wide smiling mouth, pale throat patch — all inside the head */
    ears="";
    extra=`<ellipse cx="36" cy="45" rx="14" ry="9" fill="${c2}" opacity=".9"/>
      <circle cx="26" cy="24" r="8.5" fill="${c1}" stroke="#463A54" stroke-width="2"/><circle cx="46" cy="24" r="8.5" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <circle cx="26" cy="24.5" r="4.6" fill="#F2C84B"/><circle cx="46" cy="24.5" r="4.6" fill="#F2C84B"/>
      <ellipse cx="26" cy="24.5" rx="1.5" ry="4" fill="#463A54"/><ellipse cx="46" cy="24.5" rx="1.5" ry="4" fill="#463A54"/>
      <circle cx="24.4" cy="22.2" r="1.5" fill="#FFF" opacity=".9"/><circle cx="44.4" cy="22.2" r="1.5" fill="#FFF" opacity=".9"/>
      <circle cx="30" cy="34" r="1" fill="#463A54" opacity=".6"/><circle cx="42" cy="34" r="1" fill="#463A54" opacity=".6"/>
      ${mood==="good"?`<path d="M22 40 Q36 51 50 40" stroke="#463A54" stroke-width="2" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M24 41.5 q12 2.6 24 0" stroke="#463A54" stroke-width="2" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<path d="M24 40 Q36 50 48 40 Q36 47 24 40 Z" fill="#8C4A54" stroke="#463A54" stroke-width="1.6"/>`:`<path d="M25 44 q11 -2.4 22 0" stroke="#463A54" stroke-width="2" fill="none" stroke-linecap="round"/>`}
      <path d="M16 30 q4 -3 7 1 q-4 2.5 -7 -1 Z M56 30 q-4 -3 -7 1 q4 2.5 7 -1 Z M20 48 q4 -2 6 2 q-3 2.5 -6 -2 Z" fill="${c1}" opacity=".75"/>`;}
  /* NEW — preview only, London Zoo batch 4, rev C: features softened
     after review — rev B's signatures (giant ears, spiky mohawk, big
     tusks, chunky cheek pouches) were too loud. Each now reads at a
     glance without dominating the icon. Palette separation from rev B
     is kept; that was the part that worked. */
  else if(pet.species==="huntingdog"){ /* signature: large round ears and
      a soft tri-colour patch — ears sized down from rev B's r12 */
    ears=`<circle cx="15" cy="21" r="9" fill="${c1}" stroke="#463A54" stroke-width="2"/><circle cx="57" cy="21" r="9" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <circle cx="15" cy="21" r="4.6" fill="#463A54" opacity=".45"/><circle cx="57" cy="21" r="4.6" fill="#463A54" opacity=".45"/>`;
    extra=`<path d="M20 24 q8 -4 12 2 q-7 5 -12 -2 Z" fill="#463A54" opacity=".55"/>
      <path d="M52 24 q-8 -4 -12 2 q7 5 12 -2 Z" fill="#FDF6E8" opacity=".7"/>
      <ellipse cx="36" cy="42" rx="10.5" ry="8.5" fill="#FDF6E8" opacity=".95"/>
      ${_moodEyes(28, 44, 30.5, 3.8, mood)}
      <ellipse cx="36" cy="39.5" rx="3" ry="2.3" fill="#463A54"/>
      ${_cuteMouth(36, 43.5, mood)}
      ${_blush(21, 51, 40)}`;}
  else if(pet.species==="colobus"){ /* signature: white fur ring framing a
      dark face — inherent to the animal, kept, but face proportions
      brought back in line with the other pets */
    ears="";
    extra=`<ellipse cx="36" cy="33" rx="22.5" ry="21" fill="#FDF6E8"/>
      <ellipse cx="36" cy="35" rx="14.5" ry="14.5" fill="${c2}"/>
      <path d="M24 26 Q36 17.5 48 26 Q42 22 36 22 Q30 22 24 26 Z" fill="#FDF6E8"/>
      ${_moodEyes(30, 42, 32, 3.5, mood)}
      <ellipse cx="36" cy="38.5" rx="2.2" ry="1.7" fill="#FDF6E8" opacity=".75"/>
      ${_cuteMouth(36, 42, mood, "#FDF6E8")}
      ${_blush(25, 47, 39.5, "#C08894")}`;}
  else if(pet.species==="prairiedog"){ /* signature: small buck teeth and
      a soft muzzle — rev B's separate cheek-pouch lobes removed */
    ears=`<circle cx="16" cy="25" r="4.6" fill="${c1}" stroke="#463A54" stroke-width="2"/><circle cx="56" cy="25" r="4.6" fill="${c1}" stroke="#463A54" stroke-width="2"/>`;
    extra=`<ellipse cx="36" cy="38.5" rx="12.5" ry="9.5" fill="${c2}"/>
      ${_moodEyes(28, 44, 30, 3.8, mood)}
      <path d="M34.5 35 L37.5 35 L36 37 Z" fill="#463A54"/>
      ${mood==="good"?`<path d="M36 37 L36 38.4" stroke="#463A54" stroke-width="1.2" stroke-linecap="round"/><rect x="33.9" y="38.4" width="2" height="3.2" rx="0.6" fill="#FFF" stroke="#463A54" stroke-width="0.7"/><rect x="36.1" y="38.4" width="2" height="3.2" rx="0.6" fill="#FFF" stroke="#463A54" stroke-width="0.7"/>`:_cuteMouth(36,39,mood)}
      ${_blush(21, 51, 39)}`;}
  else if(pet.species==="warthog"){ /* signature: cool grey hide, modest
      tusks and a low mane ridge — both toned down from rev B */
    ears=`<path d="M17 20 Q13 9 24 12.5 Q22.5 18.5 21.5 24 Z" fill="${c1}" stroke="#463A54" stroke-width="2"/><path d="M55 20 Q59 9 48 12.5 Q49.5 18.5 50.5 24 Z" fill="${c1}" stroke="#463A54" stroke-width="2"/>`;
    extra=`<path d="M29 15 q3.5 -4 7 -0.5 q3.5 -3.5 7 0.5 L42 20.5 q-6 -2.5 -12 0 Z" fill="${c2}" opacity=".9"/>
      <ellipse cx="36" cy="43.5" rx="13" ry="9.5" fill="${c2}"/>
      ${_moodEyes(27.5, 44.5, 30.5, 3.7, mood)}
      <path d="M28.5 46.5 Q25 42.5 26.5 38.5 Q29.5 42.5 30 46.5 Z" fill="#FFF" stroke="#463A54" stroke-width="1.1"/><path d="M43.5 46.5 Q47 42.5 45.5 38.5 Q42.5 42.5 42 46.5 Z" fill="#FFF" stroke="#463A54" stroke-width="1.1"/>
      <ellipse cx="33" cy="41.5" rx="1.9" ry="1.5" fill="#463A54"/><ellipse cx="39" cy="41.5" rx="1.9" ry="1.5" fill="#463A54"/>
      ${_cuteMouth(36, 45.5, mood)}
      ${_blush(21, 51, 41, "#B894A0")}`;}
  else if(pet.species==="camel"){ /* signature: pale cream coat, small
      crown tuft and soft lashes — tuft flattened from rev B */
    ears=`<ellipse cx="17" cy="24" rx="4.4" ry="3.6" fill="${c1}" stroke="#463A54" stroke-width="2"/><ellipse cx="55" cy="24" rx="4.4" ry="3.6" fill="${c1}" stroke="#463A54" stroke-width="2"/>`;
    extra=`<path d="M27 18 q3 -6 6 -1 q3 -6.5 6 -1 q2.5 -5 4.5 2 L44 23.5 q-8 -3 -16 0 Z" fill="${c2}" stroke="#463A54" stroke-width="1.3"/>
      <ellipse cx="36" cy="43.5" rx="11.5" ry="9.5" fill="${c2}"/>
      ${_moodEyes(28, 44, 30.5, 3.7, mood)}
      <path d="M24.6 26.6 l-2 -2.2 M28 25.5 l-0.8 -2.4 M31.4 26.6 l1.8 -2.2 M40.6 26.6 l-1.8 -2.2 M44 25.5 l0.8 -2.4 M47.4 26.6 l2 -2.2" stroke="#463A54" stroke-width="1.1" stroke-linecap="round"/>
      <ellipse cx="32.5" cy="41" rx="1.8" ry="1.4" fill="#463A54"/><ellipse cx="39.5" cy="41" rx="1.8" ry="1.4" fill="#463A54"/>
      ${_cuteMouth(36, 45, mood)}
      <path d="M33.5 47 q2.5 3 5 0 Z" fill="${c1}" stroke="#463A54" stroke-width="0.9"/>
      ${_blush(21, 51, 41)}`;}
  /* NEW — preview only, London Zoo batch 5, rev B: redrawn from
     researched reference rather than memory. Corrections noted per
     species. Style still the approved rev C spec (restrained eyes,
     one catchlight, soft blush, one clear signature). */
  else if(pet.species==="chameleon"){ /* veiled chameleon. Corrections:
      the casque is a TALL sail/shark-fin crest (~5cm on a 45cm animal),
      not the low bump drawn before; eyes are cone-shaped turrets with a
      TINY central pupil, not large round eyes; body carries vertical
      colour bands. Casque occupies the "ears" slot — a head-top
      protrusion, same allowance ears get. */
    ears=`<path d="M28 15 Q31 1 38 2 Q45 3 46 15 Q37 10 28 15 Z" fill="${c2}" stroke="#463A54" stroke-width="1.6"/>
      <path d="M33 10 Q35 1 38 0" fill="none" stroke="${shade(c1,.3)}" stroke-width="1.2" opacity=".6" stroke-linecap="round"/>`;
    extra=`<path d="M22 26 L22 42 M30 18 L30 50 M42 18 L42 50 M50 26 L50 42" stroke="#E8D45C" stroke-width="4.5" opacity=".38" stroke-linecap="round"/>
      <path d="M26 22 L26 46 M46 22 L46 46" stroke="#5CC9C4" stroke-width="3.5" opacity=".3" stroke-linecap="round"/>
      <circle cx="25" cy="31" r="7.6" fill="${c1}" stroke="#463A54" stroke-width="1.6"/><circle cx="47" cy="31" r="7.6" fill="${c1}" stroke="#463A54" stroke-width="1.6"/>
      <circle cx="25" cy="31" r="4.6" fill="${c2}" opacity=".8"/><circle cx="47" cy="31" r="4.6" fill="${c2}" opacity=".8"/>
      <circle cx="25" cy="31" r="2.1" fill="#463A54"/><circle cx="47" cy="31" r="2.1" fill="#463A54"/>
      <circle cx="24.2" cy="30.2" r="0.8" fill="#FFF"/><circle cx="46.2" cy="30.2" r="0.8" fill="#FFF"/>
      ${mood==="bad"?`<path d="M16 24 l7 2 M56 24 l-7 2" stroke="#463A54" stroke-width="1.5" stroke-linecap="round"/>`:mood==="excited"?`<circle cx="25" cy="29.5" r="1.6" fill="#FFF" opacity=".9"/><circle cx="47" cy="29.5" r="1.6" fill="#FFF" opacity=".9"/>`:""}
      <path d="M27 43 q4 2 5 4 M45 43 q-4 2 -5 4" stroke="${shade(c1,-.25)}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".6"/>
      ${_cuteMouth(36, 41.5, mood)}
      ${_blush(19, 53, 42, "#D98CA0")}`;}
  else if(pet.species==="dartfrog"){ /* blue poison dart frog. Corrections:
      true colour is vivid cobalt (was too muted/grey); black spots sit
      mainly on the HEAD and back, not scattered evenly; eyes are large
      and jet black; limbs/lower body darker than the back. */
    ears="";
    extra=`<path d="M13 40 Q36 52 59 40 Q57 52 36 57 Q15 52 13 40 Z" fill="${shade(c1,-.3)}" opacity=".55"/>
      <circle cx="23" cy="25" r="7.4" fill="${c1}" stroke="#463A54" stroke-width="1.5"/><circle cx="49" cy="25" r="7.4" fill="${c1}" stroke="#463A54" stroke-width="1.5"/>
      ${_moodEyes(23, 49, 25.5, 4.4, mood)}
      <circle cx="36" cy="17" r="2.5" fill="#1A1626" opacity=".82"/>
      <circle cx="17" cy="34" r="2.2" fill="#1A1626" opacity=".8"/><circle cx="55" cy="34" r="2" fill="#1A1626" opacity=".8"/>
      <circle cx="29" cy="36" r="1.7" fill="#1A1626" opacity=".75"/><circle cx="44" cy="37" r="1.9" fill="#1A1626" opacity=".75"/>
      <circle cx="36" cy="30" r="1.4" fill="#1A1626" opacity=".7"/>
      <circle cx="24" cy="47" r="1.6" fill="#1A1626" opacity=".6"/><circle cx="48" cy="46" r="1.4" fill="#1A1626" opacity=".6"/>
      ${mood==="good"?`<path d="M26 44 Q36 51 46 44" stroke="#463A54" stroke-width="1.7" fill="none" stroke-linecap="round"/>`:`<path d="M28 46 q8 -2 16 0" stroke="#463A54" stroke-width="1.7" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="beardeddragon"){ /* central bearded dragon.
      Corrections: broad TRIANGULAR head with pronounced brow ridges;
      rows of thorny scales along the head sides, not just the jaw.
      Best find — the spiny throat "beard" is flared and turns BLACK as
      a threat display, so the grumpy mood now uses the animal's own
      real signal rather than an invented frown. */
    ears="";
    extra=`<path d="M14 30 Q36 14 58 30 Q36 24 14 30 Z" fill="${c2}" opacity=".5"/>
      <path d="M19 24 q4 -3.5 6 0.5 M53 24 q-4 -3.5 -6 0.5 M15 31 q4 -3.5 6 0.5 M57 31 q-4 -3.5 -6 0.5 M15 38 q4 -3.5 6 0.5 M57 38 q-4 -3.5 -6 0.5" stroke="${shade(c1,-.28)}" stroke-width="2.1" fill="none" stroke-linecap="round"/>
      <path d="M22 26 Q28 21 33 25" stroke="${shade(c1,-.35)}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M50 26 Q44 21 39 25" stroke="${shade(c1,-.35)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="36" cy="42" rx="12.5" ry="9" fill="${c2}"/>
      ${_moodEyes(28, 44, 31, 3.6, mood)}
      ${mood==="bad"
        ? `<path d="M20 45 Q36 62 52 45 Q52 56 36 59 Q20 56 20 45 Z" fill="#241F2E" stroke="#463A54" stroke-width="1.3"/>
           <path d="M24 50 q3 -3 5 0.5 M31 53 q3 -3 5 0.5 M38 53 q3 -3 5 0.5 M45 50 q3 -3 5 0.5" stroke="#4A4358" stroke-width="1.5" fill="none" stroke-linecap="round"/>
           <path d="M31 44 q5 -1.4 10 0" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
        : `<path d="M24 47 q3 -3 5 0.5 M30 50 q3 -3 5 0.5 M37 50 q3 -3 5 0.5 M43 47 q3 -3 5 0.5" stroke="${shade(c1,-.3)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
           ${_cuteMouth(36, 44, mood)}`}
      <ellipse cx="32.5" cy="40" rx="1.6" ry="1.2" fill="#463A54"/><ellipse cx="39.5" cy="40" rx="1.6" ry="1.2" fill="#463A54"/>
      ${_blush(20, 52, 40, "#D9927A")}`;}
  else if(pet.species==="armadillo"){ /* nine-banded armadillo.
      Corrections: ears are LARGE and pointed ("deer-like", and notably
      not armour-covered) — previously drawn as tiny nubs; the snout is
      long, pig-like and distinctly PINK against the grey-brown armour;
      eyes are small (poor eyesight). Head shield banding was correct
      and is kept. */
    ears=`<path d="M17 18 Q12 4 22 8 Q22 16 22.5 23 Z" fill="#D9A9A0" stroke="#463A54" stroke-width="1.8"/><path d="M55 18 Q60 4 50 8 Q50 16 49.5 23 Z" fill="#D9A9A0" stroke="#463A54" stroke-width="1.8"/>
      <path d="M18.5 16 Q16 8 21 10" fill="#C08C86" opacity=".7"/><path d="M53.5 16 Q56 8 51 10" fill="#C08C86" opacity=".7"/>`;
    extra=`<path d="M14 25 Q36 11 58 25 L58 20 Q36 7 14 20 Z" fill="${c2}" stroke="#463A54" stroke-width="1.3"/>
      <path d="M13 33 Q36 19 59 33 L59 27.5 Q36 14 13 27.5 Z" fill="${c2}" stroke="#463A54" stroke-width="1.3" opacity=".92"/>
      <path d="M26 19 L26 24 M36 15.5 L36 21 M46 19 L46 24 M28 26 L28 31.5 M44 26 L44 31.5" stroke="#463A54" stroke-width="0.9" opacity=".45"/>
      <ellipse cx="36" cy="47" rx="8.5" ry="7.5" fill="#D9A9A0" stroke="#463A54" stroke-width="1.3"/>
      ${_moodEyes(27, 45, 39, 3.1, mood)}
      <ellipse cx="36" cy="45.5" rx="3" ry="2.2" fill="#463A54"/>
      <ellipse cx="34.6" cy="45.3" rx="0.7" ry="1" fill="#D9A9A0" opacity=".55"/><ellipse cx="37.4" cy="45.3" rx="0.7" ry="1" fill="#D9A9A0" opacity=".55"/>
      ${_cuteMouth(36, 50.5, mood)}
      ${_blush(22, 50, 43)}`;}
  else if(pet.species==="aardvark"){ /* aardvark. Corrections: coat is
      yellowish-grey to reddish-brown — the previous pale PINK was
      simply wrong; ears are long and TUBULAR ("rabbit-like", up to
      8.5in, held upright); the snout is a blunt flat pig-like disc;
      eyes are small. */
    ears=`<ellipse cx="17" cy="13" rx="5" ry="12.5" fill="${c1}" stroke="#463A54" stroke-width="2" transform="rotate(-12 17 13)"/><ellipse cx="55" cy="13" rx="5" ry="12.5" fill="${c1}" stroke="#463A54" stroke-width="2" transform="rotate(12 55 13)"/>
      <ellipse cx="17" cy="14" rx="2.4" ry="8" fill="${c2}" transform="rotate(-12 17 14)"/><ellipse cx="55" cy="14" rx="2.4" ry="8" fill="${c2}" transform="rotate(12 55 14)"/>`;
    extra=`<ellipse cx="36" cy="40" rx="8.5" ry="7.5" fill="${c2}"/>
      <ellipse cx="36" cy="41.5" rx="6.6" ry="5" fill="#C9A9A0" stroke="#463A54" stroke-width="1.2"/>
      ${_moodEyes(27.5, 44.5, 34, 3.1, mood)}
      <ellipse cx="33.6" cy="40.8" rx="1.1" ry="1.5" fill="#463A54"/><ellipse cx="38.4" cy="40.8" rx="1.1" ry="1.5" fill="#463A54"/>
      ${_cuteMouth(36, 45, mood)}
      ${_blush(21, 51, 39)}`;}
  /* NEW — preview only, London Zoo batch 6. Researched BEFORE drawing.
     Three of these have real display behaviours that map onto the
     happy/grumpy moods, so grumpy uses the animal's own signal rather
     than an invented frown. */
  else if(pet.species==="lemur"){ /* ring-tailed lemur: white face, dark
      TRIANGULAR eye patches ("masked bandit"), black nose, grey muzzle,
      amber eyes, large angular cat-like white ears. */
    ears=`<path d="M15 20 Q11 6 25 11 Q22 18 21 25 Z" fill="#EFEAE2" stroke="#463A54" stroke-width="1.9"/><path d="M57 20 Q61 6 47 11 Q50 18 51 25 Z" fill="#EFEAE2" stroke="#463A54" stroke-width="1.9"/>
      <path d="M17.5 19 Q15 11 23 13.5" fill="#C9B9C4" opacity=".6"/><path d="M54.5 19 Q57 11 49 13.5" fill="#C9B9C4" opacity=".6"/>`;
    extra=`<ellipse cx="36" cy="36" rx="20" ry="18" fill="#F5F1EA"/>
      <path d="M14 24 Q36 15 58 24 Q36 21 14 24 Z" fill="${shade(c1,-.32)}" opacity=".8"/>
      <path d="M20 27 Q30 21 34 30.5 Q29 38.5 20 34.5 Z" fill="#2E2836"/><path d="M52 27 Q42 21 38 30.5 Q43 38.5 52 34.5 Z" fill="#2E2836"/>
      <circle cx="27.5" cy="30.5" r="3.4" fill="#E0A93C"/><circle cx="44.5" cy="30.5" r="3.4" fill="#E0A93C"/>
      <ellipse cx="27.5" cy="30.5" rx="1.5" ry="2.6" fill="#2E2836"/><ellipse cx="44.5" cy="30.5" rx="1.5" ry="2.6" fill="#2E2836"/>
      <circle cx="26.4" cy="29.1" r="1" fill="#FFF"/><circle cx="43.4" cy="29.1" r="1" fill="#FFF"/>
      ${mood==="bad"?`<path d="M20 24 l8 2.5 M52 24 l-8 2.5" stroke="#2E2836" stroke-width="1.5" stroke-linecap="round"/>`:mood==="excited"?`<circle cx="27.5" cy="29" r="1.6" fill="#FFF" opacity=".9"/><circle cx="44.5" cy="29" r="1.6" fill="#FFF" opacity=".9"/>`:""}
      <ellipse cx="36" cy="45.5" rx="7.5" ry="6.2" fill="#8E8894"/>
      <ellipse cx="36" cy="42.8" rx="3" ry="2.3" fill="#2E2836"/>
      ${_cuteMouth(36, 48, mood)}
      <path d="M27 46 l-8 -1.5 M27 48.5 l-8 1 M45 46 l8 -1.5 M45 48.5 l8 1" stroke="#8E8894" stroke-width="0.9" opacity=".7"/>`;}
  else if(pet.species==="loris"){ /* slender loris: the enormous eyes here
      are reference-driven, not the rev-B cuteness overshoot — the loris
      genuinely has the largest eyes relative to body size of any mammal
      (up to ~80% of skull width). Dark circumocular patches, a WHITE
      stripe from forehead to nose, large thin round ears. */
    ears=`<circle cx="14" cy="28" r="8.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><circle cx="58" cy="28" r="8.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="14" cy="28" r="4.8" fill="#C4A090" opacity=".7"/><circle cx="58" cy="28" r="4.8" fill="#C4A090" opacity=".7"/>`;
    extra=`<circle cx="25" cy="31" r="11" fill="#4A3A38" opacity=".9"/><circle cx="47" cy="31" r="11" fill="#4A3A38" opacity=".9"/>
      <path d="M33 17 Q36 14.5 39 17 L38.5 44 Q36 46 33.5 44 Z" fill="#F0E8DE"/>
      <circle cx="25" cy="31" r="7.6" fill="#5C3F2E"/><circle cx="47" cy="31" r="7.6" fill="#5C3F2E"/>
      <circle cx="25" cy="31" r="4.4" fill="#241C18"/><circle cx="47" cy="31" r="4.4" fill="#241C18"/>
      <circle cx="22.6" cy="28.4" r="2.4" fill="#FFF"/><circle cx="44.6" cy="28.4" r="2.4" fill="#FFF"/>
      <circle cx="27.4" cy="34" r="1.1" fill="#FFF" opacity=".7"/><circle cx="49.4" cy="34" r="1.1" fill="#FFF" opacity=".7"/>
      ${mood==="bad"?`<path d="M13 19 l9 3.4 M59 19 l-9 3.4" stroke="#463A54" stroke-width="1.6" stroke-linecap="round"/>`:mood==="excited"?`<circle cx="25" cy="28" r="2.2" fill="#FFF" opacity=".9"/><circle cx="47" cy="28" r="2.2" fill="#FFF" opacity=".9"/>`:""}
      <path d="M33.4 41.5 Q36 44 38.6 41.5 Q36 45.2 33.4 41.5 Z" fill="#463A54"/>
      ${_cuteMouth(36, 45.5, mood)}`;}
  else if(pet.species==="tamarin"){ /* golden lion tamarin: golden-orange
      mane covering the ears and framing a DARK, almost bare face. The
      mane edge is deliberately shaggy/radiating (long hairs), which is
      what stops it reading as a recolour of the colobus's smooth ring. */
    ears="";
    extra=`<path d="M36 7 L41 13 L47 9 L49 16 L57 16 L55 24 L62 29 L56 34 L60 41 L52 43 L52 50 L45 49 L42 56 L36 51 L30 56 L27 49 L20 50 L20 43 L12 41 L16 34 L10 29 L17 24 L15 16 L23 16 L25 9 L31 13 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8" stroke-linejoin="round"/>
      <ellipse cx="36" cy="33" rx="18" ry="16.5" fill="${c2}"/>
      <ellipse cx="36" cy="34" rx="11.5" ry="13" fill="#3E3038"/>
      ${_moodEyes(31.5, 40.5, 30.5, 3.1, mood)}
      <ellipse cx="36" cy="38.5" rx="2.2" ry="1.7" fill="#241C22"/>
      ${_cuteMouth(36, 42.5, mood, "#C4A090")}`;}
  else if(pet.species==="redriverhog"){ /* red river hog: russet coat with
      a bold black-and-white facial mask — white brows/eye rings and
      cheeks against a black muzzle and forehead — and long leaf-shaped
      ears ending in prominent WHITE TASSELS. The white crest erects
      when the animal is excited or threatened, so grumpy raises it. */
    ears=`<path d="M16 22 Q11 8 23 12 Q22 19 21 26 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><path d="M56 22 Q61 8 49 12 Q50 19 51 26 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M17 12 Q13 4 19 1 Q21 7 20.5 12 Z" fill="#F5F1EA" stroke="#463A54" stroke-width="1.3"/><path d="M55 12 Q59 4 53 1 Q51 7 51.5 12 Z" fill="#F5F1EA" stroke="#463A54" stroke-width="1.3"/>`;
    extra=`${mood==="bad"
        ? `<path d="M28 15 q2 -11 4 -1 q2 -11 4 -1 q2 -11 4 -1 q2 -10 4 0 L44 21 q-8 -3 -16 0 Z" fill="#F5F1EA" stroke="#463A54" stroke-width="1.2"/>`
        : `<path d="M28 17.5 q4 -5.5 8 -0.5 q4 -4.5 8 1.5 L44 22 q-8 -3 -16 0 Z" fill="#F5F1EA" stroke="#463A54" stroke-width="1.2"/>`}
      <path d="M13 29 Q36 19 59 29 Q36 25 13 29 Z" fill="#2E2836" opacity=".85"/>
      <ellipse cx="36" cy="46.5" rx="12" ry="9" fill="#2E2836"/>
      <ellipse cx="21" cy="38" rx="7" ry="6" fill="#F5F1EA" opacity=".92"/><ellipse cx="51" cy="38" rx="7" ry="6" fill="#F5F1EA" opacity=".92"/>
      <ellipse cx="27.5" cy="32.5" rx="6.4" ry="5.4" fill="#F5F1EA"/><ellipse cx="44.5" cy="32.5" rx="6.4" ry="5.4" fill="#F5F1EA"/>
      ${_moodEyes(27.5, 44.5, 32.5, 3.2, mood)}
      <ellipse cx="32" cy="45.5" rx="2.2" ry="1.7" fill="#151119"/><ellipse cx="40" cy="45.5" rx="2.2" ry="1.7" fill="#151119"/>
      ${mood==="good"?`<path d="M30 50.5 q6 3 12 0" stroke="#F5F1EA" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".85"/>`:`<path d="M31 51 q5 -1.2 10 0" stroke="#F5F1EA" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".85"/>`}`;}
  else if(pet.species==="porcupine"){ /* crested porcupine: black-and-white
      BANDED quills forming a crest from the top of the head back over
      the shoulders, which is RAISED when threatened — so grumpy stands
      the quills up. Small eyes and small rounded ears for the face size. */
    const qh = mood==="bad" ? 1.42 : 1.0;
    const quill=(x,lean)=>{const h=19*qh, tx=x+lean*h*0.34;
      return `<path d="M${x-2.8} 27 L${tx} ${27-h} L${x+2.8} 27 Z" fill="#F5F1EA" stroke="#463A54" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M${x-1.9+lean*h*0.11} ${27-h*0.3} l3.8 0 M${x-1.3+lean*h*0.21} ${27-h*0.58} l2.9 0" stroke="#2E2836" stroke-width="2" opacity=".92"/>`;};
    ears=quill(20,-0.6)+quill(28,-0.25)+quill(36,0)+quill(44,0.25)+quill(52,0.6)
      +`<ellipse cx="16" cy="34" rx="4" ry="3.4" fill="${c2}" stroke="#463A54" stroke-width="1.7"/><ellipse cx="56" cy="34" rx="4" ry="3.4" fill="${c2}" stroke="#463A54" stroke-width="1.7"/>`;
    extra=`<ellipse cx="36" cy="39" rx="11" ry="8" fill="${c2}"/>
      ${_moodEyes(29, 43, 33, 3, mood)}
      <ellipse cx="36" cy="37.5" rx="3.2" ry="2.4" fill="#241C22"/>
      ${mood==="good"?`<path d="M36 39.9 L36 41.4" stroke="#241C22" stroke-width="1.2" stroke-linecap="round"/><rect x="33.6" y="41.4" width="2.2" height="3.6" rx="0.7" fill="#F5F1EA" stroke="#463A54" stroke-width="0.7"/><rect x="36.2" y="41.4" width="2.2" height="3.6" rx="0.7" fill="#F5F1EA" stroke="#463A54" stroke-width="0.7"/>`:_cuteMouth(36,41.5,mood,"#C4B4A8")}
      <path d="M24 38 l-7 -1.5 M24 41 l-7 1 M48 38 l7 -1.5 M48 41 l7 1" stroke="#9A8C84" stroke-width="0.9" opacity=".7"/>`;}
  /* NEW — preview only, London Zoo batch 7. Researched before drawing. */
  else if(pet.species==="babirusa"){ /* babirusa ("pig-deer"): the upper
      canines grow UP THROUGH THE TOP OF THE SNOUT and curve back toward
      the forehead — an arc found in no other mammal, and the whole
      identity. Lower tusks also point upward. Nearly hairless, wrinkled
      grey-brown skin; small head, small eyes. */
    ears=`<path d="M19 21 Q15 10 26 14 Q24 20 23 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><path d="M53 21 Q57 10 46 14 Q48 20 49 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`<path d="M16 24 Q36 19 56 24 M15 31 Q36 27 57 31" stroke="${shade(c1,-.22)}" stroke-width="1.3" fill="none" opacity=".55"/>
      <ellipse cx="36" cy="42.5" rx="10" ry="7.5" fill="${c2}"/>
      ${_moodEyes(26, 46, 33, 3, mood)}
      <path d="M30 40 Q23 30 27 21" fill="none" stroke="#F0E6D4" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M42 40 Q49 30 45 21" fill="none" stroke="#F0E6D4" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M30 40 Q23 30 27 21" fill="none" stroke="#463A54" stroke-width="1.1" stroke-linecap="round" opacity=".5"/>
      <path d="M42 40 Q49 30 45 21" fill="none" stroke="#463A54" stroke-width="1.1" stroke-linecap="round" opacity=".5"/>
      <path d="M28.5 50 Q26 45 28 41" fill="none" stroke="#F0E6D4" stroke-width="2.6" stroke-linecap="round"/><path d="M43.5 50 Q46 45 44 41" fill="none" stroke="#F0E6D4" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="32.5" cy="41.5" rx="2.1" ry="1.6" fill="#463A54"/><ellipse cx="39.5" cy="41.5" rx="2.1" ry="1.6" fill="#463A54"/>
      ${_cuteMouth(36, 46, mood)}
      ${_blush(20, 52, 42)}`;}
  else if(pet.species==="iguana"){ /* green iguana: the large round pale
      SUBTYMPANIC SHIELD on each cheek is unique to this species and the
      fastest field ID — often outlined dark, and thought to work as a
      "bluff eye". Plus the hanging spiky DEWLAP under the chin and the
      row of soft dorsal spines from the nape back. Round pupils. */
    ears=`<path d="M22 14 l2.5 -7 2.5 7 Z M29 11 l2.5 -8 2.5 8 Z M36 9.5 l2.5 -8.5 2.5 8.5 Z M43 11 l2.5 -8 2.5 8 Z M50 14 l2.5 -7 2.5 7 Z" fill="${c2}" stroke="#463A54" stroke-width="1.2" stroke-linejoin="round"/>`;
    extra=`<path d="M18 26 q4 -2.5 6 1 M48 26 q4 -2.5 6 1 M16 34 q4 -2.5 6 1 M50 34 q4 -2.5 6 1" stroke="${shade(c1,-.3)}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M27 50 Q30 62 36 62 Q42 62 45 50 Q36 54 27 50 Z" fill="${c2}" stroke="#463A54" stroke-width="1.4"/>
      <path d="M30 58 l-2 3 M36 61 l0 3.5 M42 58 l2 3" stroke="#463A54" stroke-width="1.3" stroke-linecap="round"/>
      <ellipse cx="36" cy="39.5" rx="11" ry="7" fill="${c2}" opacity=".8"/>
      ${_moodEyes(27, 45, 31, 3.4, mood)}
      <circle cx="19" cy="42" r="6.2" fill="#EFE2B8" stroke="#463A54" stroke-width="1.6"/><circle cx="53" cy="42" r="6.2" fill="#EFE2B8" stroke="#463A54" stroke-width="1.6"/>
      <circle cx="19" cy="42" r="3" fill="#D9C48E" opacity=".7"/><circle cx="53" cy="42" r="3" fill="#D9C48E" opacity=".7"/>
      <ellipse cx="33" cy="37" rx="1.5" ry="1.1" fill="#463A54"/><ellipse cx="39" cy="37" rx="1.5" ry="1.1" fill="#463A54"/>
      ${_cuteMouth(36, 41.5, mood)}`;}
  else if(pet.species==="kinkajou"){ /* kinkajou ("honey bear"): round
      head, SHORT face, large round FORWARD-facing eyes (their eyeshine
      is famously orange), and small rounded ears set LOW to either side
      of the head — the low ear placement is what separates it from the
      other round-faced mammals. Golden-brown coat, dark muzzle. */
    ears=`<circle cx="13" cy="34" r="6.4" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><circle cx="59" cy="34" r="6.4" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <circle cx="13" cy="34" r="3.2" fill="${shade(c1,-.28)}" opacity=".7"/><circle cx="59" cy="34" r="3.2" fill="${shade(c1,-.28)}" opacity=".7"/>`;
    extra=`<ellipse cx="36" cy="38" rx="12" ry="9" fill="${c2}"/>
      <ellipse cx="36" cy="41" rx="7.5" ry="5.5" fill="#4A382E"/>
      ${_moodEyes(28, 44, 32, 4.2, mood)}
      <ellipse cx="36" cy="38.5" rx="2.8" ry="2.1" fill="#241C18"/>
      ${_cuteMouth(36, 43, mood, "#C4A48E")}
      ${_blush(21, 51, 39)}`;}
  else if(pet.species==="mongoose"){ /* banded mongoose: long POINTED
      snout and a narrow triangular face with SMALL ROUNDED ears — the
      combination is what separates it from the meerkat's upright stance
      and bigger eye-patches. The dark bands are really on the back, so
      showing them across the nape here is a deliberate stylisation to
      make the species readable in a head icon. */
    ears=`<ellipse cx="16" cy="27" rx="5" ry="4" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><ellipse cx="56" cy="27" rx="5" ry="4" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`<path d="M15 20 Q36 12 57 20 L56.5 23.5 Q36 16 15.5 23.5 Z" fill="#3E3630" opacity=".7"/>
      <path d="M13.5 27 Q36 19 58.5 27 L58 30.5 Q36 23 14 30.5 Z" fill="#3E3630" opacity=".7"/>
      <path d="M13 34 Q36 26 59 34 L58.5 37.5 Q36 30 13.5 37.5 Z" fill="#3E3630" opacity=".62"/>
      <path d="M27 36 Q36 32.5 45 36 Q42 44 36 46 Q30 44 27 36 Z" fill="${c2}"/>
      ${_moodEyes(28, 44, 36, 3.2, mood)}
      <ellipse cx="36" cy="39.5" rx="2.6" ry="2" fill="#C4785E"/>
      ${_cuteMouth(36, 43, mood)}
      <path d="M28 40.5 l-8 -1 M28 43 l-8 1.5 M44 40.5 l8 -1 M44 43 l8 1.5" stroke="#A89A88" stroke-width="0.9" opacity=".7"/>`;}
  else if(pet.species==="ferret"){ /* sable ferret: cream-beige undercoat
      with a dark brown "T-mask" band across the eyes and forehead — the
      mask is the classic marking. Triangular face, pointed nose, small
      rounded ears, pink nose. A genuine pet species as well as a zoo
      resident. */
    ears=`<ellipse cx="17" cy="22" rx="6" ry="5" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><ellipse cx="55" cy="22" rx="6" ry="5" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <ellipse cx="17" cy="22.5" rx="3" ry="2.4" fill="#8C7258" opacity=".6"/><ellipse cx="55" cy="22.5" rx="3" ry="2.4" fill="#8C7258" opacity=".6"/>`;
    extra=`<path d="M14 30 Q36 22 58 30 Q58 38 50 38 Q43 33 36 33 Q29 33 22 38 Q14 38 14 30 Z" fill="#5C4636" opacity=".9"/>
      <path d="M33 22 Q36 20 39 22 L38 31 Q36 32 34 31 Z" fill="#5C4636" opacity=".9"/>
      <ellipse cx="36" cy="42" rx="10.5" ry="8" fill="${c2}"/>
      ${_moodEyes(27.5, 44.5, 32, 3.4, mood)}
      <ellipse cx="36" cy="40.5" rx="2.6" ry="2" fill="#E0A0A8"/>
      ${_cuteMouth(36, 44.5, mood, "#8C7258")}
      <path d="M27 41 l-8 -1.5 M27 43.5 l-8 1 M45 41 l8 -1.5 M45 43.5 l8 1" stroke="#B0A08C" stroke-width="0.9" opacity=".7"/>
      ${_blush(21, 51, 42)}`;}
  /* NEW — preview only, London Zoo batch 8. Researched first AND built
     on a fixed layout grid, after measuring the earlier batches and
     finding the eye baseline had drifted across 18 units (y21-39) and
     eye spacing across 33 units. That inconsistency is why the set
     looked misaligned. Canonical grid used below, deviations only
     where the species genuinely demands it and noted inline:
        eyes      cx 27.5 / 44.5  (gap 17, symmetric about x=36)
        eye y     31              eye r 3.6
        nose      cx 36, cy 40    mouth cy 45
        muzzle    cx 36, cy 42    blush cx 21 / 51, cy 40
     Every paired element satisfies x_left + x_right = 72. */
  else if(pet.species==="tamandua"){ /* southern tamandua ("collared
      anteater"): pale blonde/tan with a BLACK VEST over the shoulders —
      the collar edge is what shows in a head icon. Long tubular snout
      curved DOWNWARD, small eyes (poor vision), rounded ears standing
      out from the sides of the head. */
    ears=`<ellipse cx="16" cy="24" rx="6.5" ry="7" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><ellipse cx="56" cy="24" rx="6.5" ry="7" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="16" cy="24" rx="3.4" ry="3.8" fill="#C4A882"/><ellipse cx="56" cy="24" rx="3.4" ry="3.8" fill="#C4A882"/>`;
    extra=`<path d="M13 47 Q36 41 59 47 Q59 58 36 58 Q13 58 13 47 Z" fill="#2E2836"/>
      <path d="M30 35 Q30 41 36 44 Q42 41 42 35 Z" fill="${c2}" stroke="#463A54" stroke-width="1.4"/>
      ${_moodEyes(27.5, 44.5, 31, 2.9, mood)}
      <ellipse cx="36" cy="42.5" rx="2.4" ry="1.8" fill="#241C22"/>
      ${_cuteMouth(36, 38.5, mood)}
      ${_blush(21, 51, 40)}`;}
  else if(pet.species==="okapi"){ /* okapi: velvety deep chocolate coat
      (almost purple) with PALE WHITE sides of the face and a dark
      muzzle; large upright rounded ears with a reddish cast; males
      carry short skin-covered ossicones. Leg stripes are on the body,
      not the head, so the face contrast carries the identity here. */
    ears=`<ellipse cx="13" cy="24" rx="7" ry="9.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><ellipse cx="59" cy="24" rx="7" ry="9.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="13" cy="24" rx="3.6" ry="5.6" fill="#A8705C"/><ellipse cx="59" cy="24" rx="3.6" ry="5.6" fill="#A8705C"/>
      <path d="M27 13 Q28 5 31 4 Q32 9 30 15 Z" fill="${c1}" stroke="#463A54" stroke-width="1.4"/><path d="M45 13 Q44 5 41 4 Q40 9 42 15 Z" fill="${c1}" stroke="#463A54" stroke-width="1.4"/>`;
    extra=`<ellipse cx="24" cy="36" rx="9" ry="12" fill="#F0E8DE" opacity=".92"/><ellipse cx="48" cy="36" rx="9" ry="12" fill="#F0E8DE" opacity=".92"/>
      <ellipse cx="36" cy="38.5" rx="9.5" ry="6.5" fill="#2E2028"/>
      ${_moodEyes(27.5, 44.5, 31, 3.6, mood)}
      <ellipse cx="33" cy="37" rx="1.8" ry="1.3" fill="#8C7068"/><ellipse cx="39" cy="37" rx="1.8" ry="1.3" fill="#8C7068"/>
      ${_cuteMouth(36, 41.5, mood, "#8C7068")}
      ${_blush(21, 51, 40, "#A8705C")}`;}
  else if(pet.species==="jumpingrat"){ /* Malagasy giant jumping rat:
      rabbit-like in build but rat-faced, with prominent POINTED ears
      (50-60mm — large for the head) and a coat that is grey-brown to
      reddish, DARKEST on the head, fading to white underneath. */
    ears=`<path d="M15 22 Q10 3 21 8 Q20 17 20.5 26 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><path d="M57 22 Q62 3 51 8 Q52 17 51.5 26 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <path d="M16.5 20 Q13 7 19.5 11" fill="#C4A8A0" opacity=".65"/><path d="M55.5 20 Q59 7 52.5 11" fill="#C4A8A0" opacity=".65"/>`;
    extra=`<path d="M14 28 Q36 18 58 28 Q36 24 14 28 Z" fill="${shade(c1,-.35)}" opacity=".8"/>
      <ellipse cx="36" cy="38.5" rx="11" ry="7.5" fill="${c2}"/>
      ${_moodEyes(27.5, 44.5, 31, 3.6, mood)}
      <ellipse cx="36" cy="35" rx="2.6" ry="2" fill="#C4788C"/>
      ${mood==="good"?`<path d="M36 37 L36 38.6" stroke="#463A54" stroke-width="1.2" stroke-linecap="round"/><rect x="33.7" y="38.6" width="2.2" height="3.6" rx="0.7" fill="#F5F1EA" stroke="#463A54" stroke-width="0.7"/><rect x="36.1" y="38.6" width="2.2" height="3.6" rx="0.7" fill="#F5F1EA" stroke="#463A54" stroke-width="0.7"/>`:_cuteMouth(36,40,mood)}
      <path d="M27 37 l-8 -1.5 M27 39.5 l-8 1 M45 37 l8 -1.5 M45 39.5 l8 1" stroke="#A89A8C" stroke-width="0.9" opacity=".7"/>
      ${_blush(21, 51, 40)}`;}
  else if(pet.species==="titi"){ /* red titi monkey — London Zoo's own
      description: "red, distinctly fluffy fur... small ears and a small
      grey face, with a rather flat nose". So: a fluffy rust-red halo,
      a SMALL grey face, and ears mostly buried in the side fur. */
    ears="";
    extra=`<path d="M36 9 L40 14 L46 11 L48 18 L55 19 L54 26 L60 31 L55 36 L58 43 L51 44 L50 51 L43 50 L40 56 L36 52 L32 56 L29 50 L22 51 L21 44 L14 43 L17 36 L12 31 L18 26 L17 19 L24 18 L26 11 L32 14 Z" fill="${c1}" stroke="#463A54" stroke-width="1.7" stroke-linejoin="round"/>
      <ellipse cx="36" cy="33" rx="16" ry="15" fill="${c2}"/>
      <ellipse cx="36" cy="34" rx="10.5" ry="11.5" fill="#8C8288"/>
      <path d="M26 24 Q36 18.5 46 24 Q40 21.5 36 21.5 Q32 21.5 26 24 Z" fill="#EFE6DC" opacity=".8"/>
      ${_moodEyes(31.5, 40.5, 31, 3, mood)}
      <ellipse cx="36" cy="38" rx="2.6" ry="1.6" fill="#463A54"/>
      ${_cuteMouth(36, 42, mood, "#5C5258")}`;}
  else if(pet.species==="llama"){ /* llama: long curved "banana" ears
      (the standard breed descriptor, and distinct from an alpaca's
      short spear ears), a long lean head, large oval eyes set WIDELY
      APART — so the eye spacing here deviates from the grid on purpose
      — and a SPLIT upper lip divided into two prehensile halves. */
    ears=`<path d="M20 24 Q13 6 22 2 Q28 8 25 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><path d="M52 24 Q59 6 50 2 Q44 8 47 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <path d="M21 21 Q17 9 22 6" fill="none" stroke="#B0947C" stroke-width="2.2" opacity=".6"/><path d="M51 21 Q55 9 50 6" fill="none" stroke="#B0947C" stroke-width="2.2" opacity=".6"/>`;
    extra=`<path d="M24 20 q4 -5 6 0 q4 -5 6 0 q4 -5 6 0 q4 -4 6 1 L48 26 q-12 -4 -24 0 Z" fill="${c2}" stroke="#463A54" stroke-width="1.3"/>
      <ellipse cx="36" cy="45" rx="9.5" ry="9" fill="${c2}"/>
      <ellipse cx="26" cy="31" rx="3.6" ry="4.4" fill="#463A54"/><ellipse cx="46" cy="31" rx="3.6" ry="4.4" fill="#463A54"/>
      <circle cx="24.9" cy="29.6" r="1.4" fill="#FFF"/><circle cx="44.9" cy="29.6" r="1.4" fill="#FFF"/>
      ${mood==="bad"?`<path d="M20 25 l8 2.4 M52 25 l-8 2.4" stroke="#463A54" stroke-width="1.5" stroke-linecap="round"/>`:""}
      <ellipse cx="32.5" cy="42" rx="1.9" ry="1.4" fill="#463A54"/><ellipse cx="39.5" cy="42" rx="1.9" ry="1.4" fill="#463A54"/>
      <path d="M36 46 L36 50" stroke="#463A54" stroke-width="1.3" stroke-linecap="round"/>
      ${mood==="good"?`<path d="M30 46.5 q6 3.5 12 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="normal"?`<path d="M31 46.8 q5 1.3 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:mood==="excited"?`<ellipse cx="36" cy="47.6" rx="2.4" ry="2.8" fill="#8C4A54"/>`:`<path d="M31 47.5 q5 -1.3 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
      ${_blush(21, 51, 40)}`;}
  /* NEW — preview only, London Zoo batch 9. Researched first, drawn to
     the same canonical grid as batch 8 (eyes y31, gap 17 about x=36;
     nose y40; mouth y45; blush x21/51 y40). Deviations noted inline. */
  else if(pet.species==="humboldt"){ /* Humboldt penguin: black head with
      a broad WHITE C-shaped band sweeping from behind the eye around to
      the throat, and large bare PINK skin patches around the eye and
      bill base (thermoregulation) — the pink is what separates it from
      every other black-and-white penguin. Bill dark with a pink base. */
    ears="";
    extra=`<path d="M14 32 Q14 12 36 11 Q58 12 58 32 Q58 46 50 52 Q50 34 36 33 Q22 34 22 52 Q14 46 14 32 Z" fill="#F5F1EA"/>
      <ellipse cx="24" cy="31" rx="8" ry="8.5" fill="#E8A0A8" opacity=".85"/><ellipse cx="48" cy="31" rx="8" ry="8.5" fill="#E8A0A8" opacity=".85"/>
      ${_moodEyes(27.5, 44.5, 31, 3.6, mood)}
      <path d="M31 36 Q36 33.5 41 36 Q36 44.5 31 36 Z" fill="#2E2A36" stroke="#463A54" stroke-width="1.2"/>
      <path d="M31.5 37.5 Q36 35.8 40.5 37.5" stroke="#E8A0A8" stroke-width="1.8" fill="none"/>`;}
  else if(pet.species==="rodrigues"){ /* Rodrigues fruit bat: a "flying
      fox" — long dog-like muzzle, LARGE eyes (they find food by sight,
      not echolocation), small wide-set triangular ears, and the golden
      MANTLE over head/neck/shoulders that gives its native name,
      "golden bat", against otherwise chestnut-black fur. */
    ears=`<path d="M15 22 Q11 9 24 13 Q22 19 21 25 Z" fill="${c2}" stroke="#463A54" stroke-width="1.8"/><path d="M57 22 Q61 9 48 13 Q50 19 51 25 Z" fill="${c2}" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`<path d="M13 30 Q36 15 59 30 Q36 24 13 30 Z" fill="${c2}"/>
      <path d="M16 38 Q36 28 56 38 Q36 32 16 38 Z" fill="${c2}" opacity=".6"/>
      <ellipse cx="36" cy="38" rx="8.5" ry="7" fill="${shade(c1,-.45)}"/>
      ${_moodEyes(27.5, 44.5, 31, 4.2, mood)}
      <ellipse cx="36" cy="35.5" rx="2.8" ry="2.1" fill="#241C22"/>
      ${mood==="good"?`<path d="M36 37.6 L36 39.1 M30 40.5 q6 3.4 12 0" stroke="#463A54" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M32.5 41.1 l0.9 2.4 M39.5 41.1 l-0.9 2.4" stroke="#FDFBF5" stroke-width="1.5" stroke-linecap="round"/>`:`<path d="M31 41 q5 -1.3 10 0" stroke="#463A54" stroke-width="1.3" fill="none" stroke-linecap="round"/>`}
      ${_blush(21, 51, 37, "#B0603C")}`;}
  else if(pet.species==="smallotter"){ /* Asian small-clawed otter — the
      world's smallest otter. Rounded head, SHORT broad muzzle, eyes set
      well FORWARD, small oval ears, and a distinctly WHITISH cheek/
      upper-lip/chin/throat against brown fur. Long coarse whiskers. */
    ears=`<ellipse cx="16" cy="24" rx="5" ry="4.2" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><ellipse cx="56" cy="24" rx="5" ry="4.2" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`<path d="M15 40 Q36 32 57 40 Q57 54 36 56 Q15 54 15 40 Z" fill="#EFE6DA"/>
      ${_moodEyes(27.5, 44.5, 31, 3.8, mood)}
      <ellipse cx="36" cy="40" rx="3.2" ry="2.4" fill="#463A54"/>
      ${mood==="good"?`<path d="M36 42.4 L36 44 M36 44 q-3.4 2.5 -6.8 0 M36 44 q3.4 2.5 6.8 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:`<path d="M31 45 q5 -1.4 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
      <path d="M25 41 l-9 -2 M25 44 l-9 1 M25 47 l-9 3.5 M47 41 l9 -2 M47 44 l9 1 M47 47 l9 3.5" stroke="#A89A88" stroke-width="0.9" opacity=".8"/>
      ${_blush(21, 51, 40)}`;}
  else if(pet.species==="wartypig"){ /* Visayan warty pig: three pairs of
      fleshy facial warts (protection from rivals' tusks), a prominent
      WHITE line across the bridge of the snout, and a spiky head tuft
      that grows into a mane — RAISED when threatened to look larger, so
      the grumpy mood stands the crest up. Critically endangered. */
    ears=`<path d="M17 21 Q13 9 25 13 Q23 19 22 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><path d="M55 21 Q59 9 47 13 Q49 19 50 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>`;
    extra=`${mood==="bad"
        ? `<path d="M27 16 q2 -13 4 -1 q2 -14 5 -1 q2 -14 5 -1 q2 -12 4 1 L45 22 q-9 -3 -18 0 Z" fill="#3A3640" stroke="#463A54" stroke-width="1.2"/>`
        : `<path d="M28 18 q3 -6 6 -0.5 q3 -6 6 0.5 q2 -4 3 1 L43 23 q-7 -2.5 -14 0 Z" fill="#3A3640" stroke="#463A54" stroke-width="1.2"/>`}
      <ellipse cx="36" cy="45" rx="13" ry="9.5" fill="${c2}"/>
      ${_moodEyes(27.5, 44.5, 31, 3.4, mood)}
      <ellipse cx="22" cy="36" rx="3.2" ry="2.4" fill="${c1}" stroke="#463A54" stroke-width="1.1"/><ellipse cx="50" cy="36" rx="3.2" ry="2.4" fill="${c1}" stroke="#463A54" stroke-width="1.1"/>
      <ellipse cx="20.5" cy="43" rx="2.8" ry="2.1" fill="${c1}" stroke="#463A54" stroke-width="1.1"/><ellipse cx="51.5" cy="43" rx="2.8" ry="2.1" fill="${c1}" stroke="#463A54" stroke-width="1.1"/>
      <path d="M23 40 Q36 36 49 40 L49 42.5 Q36 38.5 23 42.5 Z" fill="#F5F1EA" opacity=".95"/>
      <ellipse cx="32.5" cy="46" rx="2.1" ry="1.6" fill="#241C22"/><ellipse cx="39.5" cy="46" rx="2.1" ry="1.6" fill="#241C22"/>
      ${_cuteMouth(36, 50, mood)}`;}
  else if(pet.species==="emperortamarin"){ /* emperor tamarin: the long
      white DROOPING moustache sweeping back past the mouth corners is
      unique among tamarins and gives the species its name (after Kaiser
      Wilhelm II). Dark face, grizzled grey fur, plus the white chin
      beard of the bearded subspecies. Eyes sit slightly closer than the
      grid default — deliberate, it is a very small-faced monkey. */
    ears="";
    extra=`<path d="M14 30 Q36 14 58 30 Q36 22 14 30 Z" fill="${c2}" opacity=".7"/>
      <ellipse cx="36" cy="35" rx="14" ry="14.5" fill="#4A4048"/>
      ${_moodEyes(30.5, 41.5, 31, 3.2, mood)}
      <ellipse cx="36" cy="39" rx="2.4" ry="1.8" fill="#241C22"/>
      <path d="M33 42 Q22 43 12 52 Q24 48 33.5 44.5 Z" fill="#F7F3EC" stroke="#463A54" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M39 42 Q50 43 60 52 Q48 48 38.5 44.5 Z" fill="#F7F3EC" stroke="#463A54" stroke-width="1.1" stroke-linejoin="round"/>
      ${mood==="good"?`<path d="M32 45.5 q4 3 8 0" stroke="#C4B4AC" stroke-width="1.3" fill="none" stroke-linecap="round"/>`:`<path d="M32.5 46.5 q3.5 -1.2 7 0" stroke="#C4B4AC" stroke-width="1.3" fill="none" stroke-linecap="round"/>`}
      <path d="M30 49 Q36 56 42 49 Q36 53 30 49 Z" fill="#F7F3EC" opacity=".9"/>`;}
  /* NEW — preview only, batch 12: SHAPE-FITTED animals. These use the
     new per-species head override. Four of them are silhouette-identity
     animals that were previously rejected for not fitting the round
     crop — giraffe is a direct redo of one of those failures. Eyes
     leave the y31 grid where the skull demands it; each deviation is
     stated inline, per the declared-deviation rule. */
  else if(pet.species==="moose"){ /* Moose. Researched: antlers are
      PALMATE — "open-hand shaped", broad flat palms with tines like
      fingers, unlike any other deer. Also a large overhanging muzzle
      with a pendulous upper lip, and a throat "bell" (dewlap) present
      in BOTH sexes. VARIANT: drawn male — only bulls grow antlers.
      Head: long tapering skull, eyes at y26 (above grid) because the
      muzzle occupies the lower half. */
    head=`<path d="M22 26 Q22 12 36 12 Q50 12 50 26 Q50 40 46 50 Q42 60 36 60 Q30 60 26 50 Q22 40 22 26 Z" fill="${c1}" stroke="#463A54" stroke-width="2.2"/>`;
    hideFace=true;
    ears=`<ellipse cx="15" cy="28" rx="7.5" ry="4.4" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><ellipse cx="57" cy="28" rx="7.5" ry="4.4" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M20 22 Q9 18 4 9 Q13 13 19 11 Q11 7 9 2 Q17 6 22 6 Q19 3 21 1 Q26 8 28 16 Z" fill="${c2}" stroke="#463A54" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M52 22 Q63 18 68 9 Q59 13 53 11 Q61 7 63 2 Q55 6 50 6 Q53 3 51 1 Q46 8 44 16 Z" fill="${c2}" stroke="#463A54" stroke-width="1.6" stroke-linejoin="round"/>`;
    extra=`${_moodEyes(29, 43, 26, 3, mood)}
      <ellipse cx="36" cy="50" rx="9" ry="7.5" fill="${shade(c1,-.25)}"/>
      <ellipse cx="33" cy="48" rx="1.8" ry="1.3" fill="#241C22"/><ellipse cx="39" cy="48" rx="1.8" ry="1.3" fill="#241C22"/>
      ${mood==="good"?`<path d="M31 54 q5 3 10 0" stroke="#241C22" stroke-width="1.4" fill="none" stroke-linecap="round"/>`:`<path d="M31.5 55 q4.5 -1.2 9 0" stroke="#241C22" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
      <path d="M32 57 Q36 63.5 40 57 Q36 60.5 32 57 Z" fill="${c1}" stroke="#463A54" stroke-width="1.4"/>
      ${_blush(23, 49, 44)}`;}
  else if(pet.species==="giraffe"){ /* Giraffe — REDO. The first attempt
      failed because ossicones and a long muzzle would not fit a round
      crop. Now the head is drawn as the animal's real shape: a long
      narrow skull with a bulging brow, ossicones ABOVE the head, and
      the patchwork coat. Eyes at y28 with a wide gap, matching the
      genuinely wide-set giraffe skull. Both sexes have ossicones. */
    head=`<path d="M24 24 Q24 14 36 14 Q48 14 48 24 Q48 34 44 42 Q41 56 36 58 Q31 56 28 42 Q24 34 24 24 Z" fill="${c1}" stroke="#463A54" stroke-width="2.2"/>`;
    hideFace=true;
    ears=`<path d="M26 25 Q12 22 4 13 Q13 15 20 20 Q23 22 26 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><path d="M46 25 Q60 22 68 13 Q59 15 52 20 Q49 22 46 25 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M28 15 L26 7" stroke="${c1}" stroke-width="4.4" stroke-linecap="round"/><path d="M44 15 L46 7" stroke="${c1}" stroke-width="4.4" stroke-linecap="round"/>
      <circle cx="26" cy="5" r="3.6" fill="${c2}" stroke="#463A54" stroke-width="1.5"/><circle cx="46" cy="5" r="3.6" fill="${c2}" stroke="#463A54" stroke-width="1.5"/>`;
    extra=`<path d="M27 20 q4 -3 7 1 q-4 3 -7 -1 Z M45 20 q-4 -3 -7 1 q4 3 7 -1 Z M26 32 q4 -2.5 6 1.5 q-4 2.5 -6 -1.5 Z M46 32 q-4 -2.5 -6 1.5 q4 2.5 6 -1.5 Z" fill="${c2}" opacity=".8"/>
      ${_moodEyes(28.5, 43.5, 28, 3.2, mood)}
      <ellipse cx="36" cy="50" rx="7" ry="6" fill="#EFE0C4"/>
      <ellipse cx="33.5" cy="48.5" rx="1.5" ry="1.1" fill="#241C22"/><ellipse cx="38.5" cy="48.5" rx="1.5" ry="1.1" fill="#241C22"/>
      ${mood==="good"?`<path d="M32 53 q4 2.6 8 0" stroke="#8C7A5E" stroke-width="1.3" fill="none" stroke-linecap="round"/>`:`<path d="M32.5 53.5 q3.5 -1 7 0" stroke="#8C7A5E" stroke-width="1.3" fill="none" stroke-linecap="round"/>`}
      ${_blush(23, 49, 40, "#C99A8C")}`;}
  else if(pet.species==="toucan"){ /* Toco toucan. The bill is roughly a
      third of the bird's length and is drawn full size — it simply
      cannot live inside a round crop. Researched: despite the size it
      is very light, a rigid keratin shell over a foam-like cellular
      core. Bare coloured skin rings the eye. */
    head=`<path d="M20 30 Q20 14 36 14 Q52 14 52 30 Q52 46 36 50 Q20 46 20 30 Z" fill="${c1}" stroke="#463A54" stroke-width="2.2"/>`;
    hideFace=true;
    ears="";
    extra=`<path d="M50 26 Q66 24 71 34 Q66 44 50 40 Z" fill="#E8A020" stroke="#463A54" stroke-width="2" stroke-linejoin="round"/>
      <path d="M50 33 Q64 32 70 35" fill="none" stroke="#B5342B" stroke-width="1.8"/>
      <path d="M66 32 Q71 33 71 34 Q69 37 66 37 Z" fill="#2E2A32"/>
      <path d="M50 26 Q61 26 68 30" fill="none" stroke="#F2C84B" stroke-width="1.6" opacity=".8"/>
      <ellipse cx="31" cy="28" rx="6.5" ry="7" fill="#5CC4D9" opacity=".85"/><ellipse cx="41" cy="28" rx="6.5" ry="7" fill="#5CC4D9" opacity=".85"/>
      ${_moodEyes(31, 41, 28, 3.4, mood)}
      <path d="M22 42 Q36 48 50 42" fill="none" stroke="${shade(c1,.3)}" stroke-width="2" opacity=".5"/>
      ${mood==="bad"?`<path d="M24 20 l8 3" stroke="#463A54" stroke-width="1.6" stroke-linecap="round"/>`:""}`;}
  else if(pet.species==="ibex"){ /* Alpine ibex. Researched: the horns
      sweep BACKWARD in a long scimitar curve and are transversely
      RIDGED on the front face — the ridges are the identifier, and
      they are what a plain curved horn would miss. VARIANT: drawn
      male; both sexes have horns, but females' are small, straight and
      widely separated. Males also carry a pointed beard. */
    head=`<path d="M25 28 Q25 16 36 16 Q47 16 47 28 Q47 40 43 48 Q40 58 36 58 Q32 58 29 48 Q25 40 25 28 Z" fill="${c1}" stroke="#463A54" stroke-width="2.2"/>`;
    hideFace=true;
    ears=`<ellipse cx="17" cy="30" rx="7" ry="4" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><ellipse cx="55" cy="30" rx="7" ry="4" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M29 17 Q22 4 10 2 Q4 6 8 12 Q16 10 22 20 Z" fill="${c2}" stroke="#463A54" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M43 17 Q50 4 62 2 Q68 6 64 12 Q56 10 50 20 Z" fill="${c2}" stroke="#463A54" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M26 14 L23 10 M22 11 L20 7 M18 9 L16.5 5 M14 7 L13 3" stroke="${shade(c2,-.4)}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M46 14 L49 10 M50 11 L52 7 M54 9 L55.5 5 M58 7 L59 3" stroke="${shade(c2,-.4)}" stroke-width="1.5" stroke-linecap="round"/>`;
    extra=`${_moodEyes(29.5, 42.5, 29, 3, mood)}
      <ellipse cx="36" cy="48" rx="6.5" ry="5.5" fill="${shade(c1,-.2)}"/>
      <ellipse cx="34" cy="47" rx="1.4" ry="1" fill="#241C22"/><ellipse cx="38" cy="47" rx="1.4" ry="1" fill="#241C22"/>
      ${mood==="good"?`<path d="M32 51.5 q4 2.4 8 0" stroke="#241C22" stroke-width="1.3" fill="none" stroke-linecap="round"/>`:`<path d="M32.5 52 q3.5 -1 7 0" stroke="#241C22" stroke-width="1.3" fill="none" stroke-linecap="round"/>`}
      <path d="M33 55 Q36 63 39 55 Q36 58.5 33 55 Z" fill="${shade(c1,-.35)}" stroke="#463A54" stroke-width="1.3"/>
      ${_blush(24, 48, 42)}`;}
  else if(pet.species==="elephant"){ /* African elephant. The trunk and
      the huge ears both break the round crop, and both are the animal.
      Researched: African elephants' ears are far larger than Asian
      ones and are often likened in outline to the African continent —
      they double as radiators. Eyes are small and set wide, low on the
      sides of the head. */
    head=`<path d="M22 24 Q22 12 36 12 Q50 12 50 24 Q50 34 47 40 Q44 44 36 44 Q28 44 25 40 Q22 34 22 24 Z" fill="${c1}" stroke="#463A54" stroke-width="2.2"/>`;
    hideFace=true;
    ears=`<path d="M22 18 Q4 12 2 28 Q0 44 14 46 Q22 44 24 34 Z" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <path d="M50 18 Q68 12 70 28 Q72 44 58 46 Q50 44 48 34 Z" fill="${c1}" stroke="#463A54" stroke-width="2"/>
      <path d="M20 22 Q8 20 6 30 Q5 40 14 42" fill="none" stroke="${shade(c1,-.25)}" stroke-width="1.2" opacity=".6"/>
      <path d="M52 22 Q64 20 66 30 Q67 40 58 42" fill="none" stroke="${shade(c1,-.25)}" stroke-width="1.2" opacity=".6"/>`;
    extra=`<path d="M31 42 Q30 54 33 60 Q36 64 39 60 Q42 54 41 42 Z" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <path d="M31.5 47 Q36 49 40.5 47 M32 52 Q36 54 40 52 M33 57 Q36 58.5 39 57" fill="none" stroke="${shade(c1,-.3)}" stroke-width="1.1" opacity=".7"/>
      <path d="M28 42 Q25 50 26 56" fill="none" stroke="#EFE8DA" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M44 42 Q47 50 46 56" fill="none" stroke="#EFE8DA" stroke-width="2.6" stroke-linecap="round"/>
      ${_moodEyes(28, 44, 26, 2.8, mood)}
      ${_blush(24, 48, 34)}`;}
  /* NEW — preview only, batch 11: BRITISH NATIVE WILDLIFE. Researched
     first, drawn to the canonical grid (eyes y31, gap 17 about x=36;
     nose y40; mouth y45; blush x21/51 y40). Sex: this batch is almost
     entirely sex-neutral by nature — the one real variant decision is
     the Highland cow, noted inline. */
  else if(pet.species==="badger"){ /* European badger. Signature: a white
      face crossed by TWO BLACK STRIPES running from the nose, back
      through the EYES, to the ears. Researched bonus — the mask is
      aposematic (warning colouration): it advertises the badger's very
      powerful bite, in the same way a skunk's stripes advertise its
      spray. Small rounded ears tipped with white; small dark eyes
      (their eyesight is poor). Sexes look alike. */
    ears=`<circle cx="17" cy="21" r="6" fill="#2E2A32" stroke="#463A54" stroke-width="1.8"/><circle cx="55" cy="21" r="6" fill="#2E2A32" stroke="#463A54" stroke-width="1.8"/>
      <path d="M13 18 Q17 14 21 18 Q17 19.5 13 18 Z" fill="#F0EDE6"/><path d="M51 18 Q55 14 59 18 Q55 19.5 51 18 Z" fill="#F0EDE6"/>`;
    extra=`<path d="M22 16 Q26 40 33 54 L27 55 Q19 40 16 20 Z" fill="#2E2A32"/>
      <path d="M50 16 Q46 40 39 54 L45 55 Q53 40 56 20 Z" fill="#2E2A32"/>
      ${_moodEyes(27.5, 44.5, 31, 2.8, mood)}
      <ellipse cx="36" cy="40.5" rx="8.5" ry="6.5" fill="#F5F2EC"/>
      <ellipse cx="36" cy="37" rx="3" ry="2.3" fill="#241C22"/>
      ${_cuteMouth(36, 41.5, mood)}
      ${_blush(21, 51, 37, "#C99A9A")}`;}
  else if(pet.species==="hedgehog"){ /* European hedgehog. Signature: the
      cap of SPINES over the crown and shoulders, meeting a pale pointed
      face. Small dark eyes, pointed snout, small rounded ears mostly
      buried in fur. Spines drawn as filled triangles anchored to the
      head (constraint 6 — no floating strokes). */
    const spine=(x,lean)=>`<path d="M${x-3} 26 L${x+lean*5} 8 L${x+3} 26 Z" fill="${c1}" stroke="#463A54" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M${x-1+lean*2} 18 l2.4 0" stroke="${shade(c1,-.35)}" stroke-width="1.4" opacity=".8"/>`;
    ears=spine(15,-0.9)+spine(22,-0.5)+spine(29.5,-0.2)+spine(36,0)+spine(42.5,0.2)+spine(50,0.5)+spine(57,0.9);
    extra=`<path d="M14 30 Q36 22 58 30 Q36 26 14 30 Z" fill="${shade(c1,-.2)}"/>
      <path d="M22 31 Q36 26 50 31 Q50 41 36 43.5 Q22 41 22 31 Z" fill="${c2}"/>
      ${_moodEyes(27.5, 44.5, 31, 3, mood)}
      <ellipse cx="36" cy="37" rx="2.8" ry="2.1" fill="#241C22"/>
      ${_cuteMouth(36, 41, mood)}
      <path d="M26 36 l-8 -1.5 M26 39 l-8 1 M46 36 l8 -1.5 M46 39 l8 1" stroke="#A89A88" stroke-width="0.9" opacity=".75"/>
      ${_blush(21, 51, 38)}`;}
  else if(pet.species==="highlandcow"){ /* Highland cow. Signature: the
      DOSSAN — the long fringe over the eyes (it has its own name in
      Scots) — plus wide curved horns. VARIANT DECISION: both sexes
      carry horns, unusually for cattle, but the shape differs. Drawn
      as a COW (female): narrower horns rising at a steeper upswept
      angle. A bull's would be thicker, wider and angled forward. */
    ears=`<path d="M6 24 Q2 14 10 12 Q16 16 18 26 Q12 27 6 24 Z" fill="#E8E2D4" stroke="#463A54" stroke-width="1.6"/>
      <path d="M66 24 Q70 14 62 12 Q56 16 54 26 Q60 27 66 24 Z" fill="#E8E2D4" stroke="#463A54" stroke-width="1.6"/>
      <ellipse cx="16" cy="30" rx="5" ry="4" fill="${c1}" stroke="#463A54" stroke-width="1.6"/><ellipse cx="56" cy="30" rx="5" ry="4" fill="${c1}" stroke="#463A54" stroke-width="1.6"/>`;
    extra=`<path d="M20 18 Q24 6 30 4 M52 18 Q48 6 42 4" stroke="${c2}" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".9"/>
      <path d="M14 24 Q20 12 27 10 M58 24 Q52 12 45 10" stroke="${c2}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M22 22 Q28 14 33 22 M50 22 Q44 14 39 22 M28 20 Q33 12 36 20 M44 20 Q39 12 36 20" stroke="${c2}" stroke-width="2" fill="none" opacity=".55"/>
      ${_moodEyes(27.5, 44.5, 31, 3.2, mood)}
      <ellipse cx="36" cy="47" rx="11" ry="8" fill="#D9A9A0"/>
      <ellipse cx="32.5" cy="45.5" rx="1.9" ry="1.5" fill="#463A54"/><ellipse cx="39.5" cy="45.5" rx="1.9" ry="1.5" fill="#463A54"/>
      ${mood==="good"?`<path d="M30 51 q6 3 12 0" stroke="#8C6A64" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:`<path d="M31 52 q5 -1.3 10 0" stroke="#8C6A64" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      ${_blush(19, 53, 42)}`;}
  else if(pet.species==="mole"){ /* European mole. Signature: a long PINK
      SNOUT, tiny eyes, NO visible external ears, and huge pink
      spade-like forepaws. Velvety near-black fur. The absent ears are
      as much of an identifier as the snout, so nothing is drawn in the
      ears slot on purpose. */
    ears="";
    extra=`<path d="M13 34 Q36 26 59 34 Q36 30 13 34 Z" fill="${shade(c1,.18)}" opacity=".5"/>
      <ellipse cx="36" cy="44" rx="10" ry="9" fill="${c2}"/>
      <ellipse cx="36" cy="47" rx="6.5" ry="6" fill="#E8A8A8" stroke="#463A54" stroke-width="1.2"/>
      ${_moodEyes(27.5, 44.5, 31, 2.2, mood)}
      <ellipse cx="34.2" cy="46" rx="1" ry="1.4" fill="#463A54"/><ellipse cx="37.8" cy="46" rx="1" ry="1.4" fill="#463A54"/>
      ${_cuteMouth(36, 51, mood)}
      <path d="M12 46 Q6 50 8 58 Q16 58 18 50 Z" fill="#E8A8A8" stroke="#463A54" stroke-width="1.3"/>
      <path d="M60 46 Q66 50 64 58 Q56 58 54 50 Z" fill="#E8A8A8" stroke="#463A54" stroke-width="1.3"/>
      <path d="M9 52 L16 52 M10 55 L17 55 M63 52 L56 52 M62 55 L55 55" stroke="#C97878" stroke-width="0.9" opacity=".8"/>
      <path d="M27 44 l-8 -1.5 M27 47 l-8 1 M45 44 l8 -1.5 M45 47 l8 1" stroke="#8C8494" stroke-width="0.9" opacity=".7"/>`;}
  else if(pet.species==="pinemarten"){ /* European pine marten. Signature:
      the large CREAM-YELLOW THROAT BIB — the feature that separates it
      from the beech marten, whose bib is white and forks down onto the
      forelegs. Prominent TRIANGULAR ears (larger than a stoat's),
      pointed muzzle, dark whiskers. Sexes look alike; males are just
      slightly larger. */
    ears=`<path d="M14 22 Q12 6 26 14 Q22 20 21 27 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/><path d="M58 22 Q60 6 46 14 Q50 20 51 27 Z" fill="${c1}" stroke="#463A54" stroke-width="1.8"/>
      <path d="M17 20 Q16 11 23 15" fill="${c2}" opacity=".7"/><path d="M55 20 Q56 11 49 15" fill="${c2}" opacity=".7"/>`;
    extra=`<path d="M22 44 Q36 38 50 44 Q52 56 36 60 Q20 56 22 44 Z" fill="#EFD98C" stroke="#463A54" stroke-width="1.3"/>
      <ellipse cx="36" cy="41" rx="9" ry="7" fill="${c2}"/>
      ${_moodEyes(27.5, 44.5, 31, 3.4, mood)}
      <ellipse cx="36" cy="40" rx="2.8" ry="2.1" fill="#241C22"/>
      ${mood==="good"?`<path d="M36 42.1 L36 43.6 M36 43.6 q-3.2 2.4 -6.4 0 M36 43.6 q3.2 2.4 6.4 0" stroke="#463A54" stroke-width="1.3" fill="none" stroke-linecap="round"/>`:`<path d="M31 44.5 q5 -1.3 10 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
      <path d="M26 40 l-9 -2 M26 43 l-9 1 M46 40 l9 -2 M46 43 l9 1" stroke="#3A2E28" stroke-width="1" opacity=".8"/>
      ${_blush(21, 51, 40)}`;}
  /* NEW — preview only, batch 10: EXTINCT SPECIES set. Researched
     first; drawn to the canonical grid (eyes y31, gap 17 about x=36).
     Deliberately chosen so the set spans four centuries of extinction
     (1662 dodo -> 1936 thylacine) and four continents. */
  else if(pet.species==="dodo"){ /* dodo, d.~1662. Modern reconstructions
      overturn the fat cartoon bird: it was LEANER and more upright.
      Key features: a GREY BARE head (no feathers), a big hooked beak
      that is grey near the face and green/yellow toward the tip, and
      brownish-grey plumage. Eyes described as bright and yellowish. */
    ears="";
    extra=`<path d="M13 30 Q36 16 59 30 Q59 44 50 50 Q50 34 36 33 Q22 34 22 50 Q13 44 13 30 Z" fill="${c2}" opacity=".55"/>
      <ellipse cx="36" cy="36" rx="17" ry="17.5" fill="#A8A4AC"/>
      <circle cx="27.5" cy="31" r="3.6" fill="#E0C24C"/><circle cx="44.5" cy="31" r="3.6" fill="#E0C24C"/>
      <circle cx="27.5" cy="31" r="1.9" fill="#241C22"/><circle cx="44.5" cy="31" r="1.9" fill="#241C22"/>
      <circle cx="26.2" cy="29.7" r="1.2" fill="#FFF"/><circle cx="43.2" cy="29.7" r="1.2" fill="#FFF"/>
      ${mood==="bad"?`<path d="M22 26 l8 2.6 M50 26 l-8 2.6" stroke="#463A54" stroke-width="1.5" stroke-linecap="round"/>`:mood==="excited"?`<circle cx="27.5" cy="29" r="1.5" fill="#FFF" opacity=".9"/><circle cx="44.5" cy="29" r="1.5" fill="#FFF" opacity=".9"/>`:""}
      <path d="M30 39 Q36 37 42 39 Q44 48 40 55 Q36 59 32 55 Q28 48 30 39 Z" fill="#8C9470" stroke="#463A54" stroke-width="1.3"/>
      <path d="M32 52 Q36 57 40 52 Q36 60 32 52 Z" fill="#D9C44C"/>
      <ellipse cx="33.5" cy="41.5" rx="0.8" ry="1.4" fill="#463A54"/><ellipse cx="38.5" cy="41.5" rx="0.8" ry="1.4" fill="#463A54"/>`;}
  else if(pet.species==="thylacine"){ /* thylacine, d.1936. Dog-like head
      with rounded erect ears, fawn-to-chocolate coat and 15-20 dark
      stripes. Its enormous ~90-120 degree jaw gape is thought to have
      been a THREAT DISPLAY — so the grumpy mood opens the jaw wide,
      which is the animal's real signal rather than an invented frown. */
    ears=`<ellipse cx="17" cy="20" rx="6.5" ry="7.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><ellipse cx="55" cy="20" rx="6.5" ry="7.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="17" cy="20.5" rx="3.4" ry="4.2" fill="#C08A6E"/><ellipse cx="55" cy="20.5" rx="3.4" ry="4.2" fill="#C08A6E"/>`;
    extra=`<path d="M14 24 l0 7 M20 21 l0 7 M52 21 l0 7 M58 24 l0 7 M17 33 l0 6 M55 33 l0 6" stroke="#4A3A2E" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="36" cy="38" rx="10" ry="7" fill="${c2}"/>
      ${_moodEyes(27.5, 44.5, 31, 3.6, mood)}
      <ellipse cx="36" cy="34.5" rx="2.8" ry="2.1" fill="#241C22"/>
      ${mood==="bad"
        ? `<path d="M27 38.5 Q36 36.5 45 38.5 Q44 52 36 54 Q28 52 27 38.5 Z" fill="#5C2A2E" stroke="#463A54" stroke-width="1.3"/>
           <path d="M30 40 l1.6 3.6 M36 40.5 l0 4 M42 40 l-1.6 3.6" stroke="#FDFBF5" stroke-width="1.6" stroke-linecap="round"/>`
        : `<path d="M36 36.6 L36 38.3 M36 38.3 q-3.4 2.6 -6.8 0 M36 38.3 q3.4 2.6 6.8 0" stroke="#463A54" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}
      ${_blush(21, 51, 40)}`;}
  else if(pet.species==="quagga"){ /* quagga, d.1883. Half zebra, half
      horse: bold stripes on the HEAD, neck and forequarters fading to
      plain brown behind — so a head icon is actually the best possible
      crop for this species, since the striping is at its strongest
      exactly here. Upright striped mane. */
    ears=`<ellipse cx="19" cy="16" rx="5.5" ry="7.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/><ellipse cx="53" cy="16" rx="5.5" ry="7.5" fill="${c1}" stroke="#463A54" stroke-width="1.9"/>
      <ellipse cx="19" cy="16.5" rx="2.6" ry="4.2" fill="#4A3226"/><ellipse cx="53" cy="16.5" rx="2.6" ry="4.2" fill="#4A3226"/>`;
    extra=`<path d="M30 12 Q36 8 42 12 L41 21 Q36 18 31 21 Z" fill="#3A2A22"/>
      <path d="M13 27 L23 29 M12 34 L22 34 M14 41 L23 39 M59 27 L49 29 M60 34 L50 34 M58 41 L49 39 M31 15 L33 23 M41 15 L39 23" stroke="#F2EAD8" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>
      <ellipse cx="36" cy="45" rx="9" ry="8" fill="#4A3226"/>
      ${_moodEyes(27.5, 44.5, 31, 3.4, mood)}
      <ellipse cx="33" cy="43" rx="1.7" ry="1.3" fill="#241C22"/><ellipse cx="39" cy="43" rx="1.7" ry="1.3" fill="#241C22"/>
      ${mood==="good"?`<path d="M31 48 q5 3 10 0" stroke="#8C6A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:`<path d="M31.5 48.5 q4.5 -1.2 9 0" stroke="#8C6A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}`;}
  else if(pet.species==="greatauk"){ /* great auk, d.1844. Flightless
      North Atlantic seabird: glossy black head and back, white belly,
      and — in summer breeding plumage — a large OVAL WHITE PATCH in
      front of each eye. Heavy hooked black bill with white transverse
      GROOVES, up to seven on the upper mandible. */
    ears="";
    extra=`<path d="M18 44 Q36 36 54 44 Q54 56 36 58 Q18 56 18 44 Z" fill="#F7F3EC"/>
      <ellipse cx="26" cy="30" rx="6.6" ry="5.4" fill="#F7F3EC"/><ellipse cx="46" cy="30" rx="6.6" ry="5.4" fill="#F7F3EC"/>
      ${_moodEyes(27.5, 44.5, 31, 3, mood)}
      <path d="M31 33 Q36 31 41 33 Q42.5 39 38 42.5 Q36 43.5 34 42.5 Q29.5 39 31 33 Z" fill="#241F2A" stroke="#463A54" stroke-width="1.2"/>
      <path d="M31.4 35.2 Q36 33.8 40.6 35.2 M31.8 37.2 Q36 36 40.2 37.2 M32.6 39.2 Q36 38.2 39.4 39.2 M33.4 41.2 Q36 40.5 38.6 41.2" stroke="#F7F3EC" stroke-width="1.1" fill="none" opacity=".9"/>
      ${mood==="bad"?`<path d="M19 24 l8 3 M53 24 l-8 3" stroke="#F7F3EC" stroke-width="1.5" stroke-linecap="round"/>`:""}`;}
  else if(pet.species==="seacow"){ /* Steller's sea cow, d.1768 — wiped
      out just 27 years after being described. A 9m sirenian with a
      SMALL head, tiny eyes, no external ears, a blunt downturned snout,
      and famously thick "bark-like" wrinkled hide (it was nicknamed the
      bark animal), plus dense white bristles around the mouth in place
      of teeth. */
    ears="";
    extra=`<path d="M14 24 Q36 18 58 24 M13 31 Q36 25 59 31 M13 38 Q36 32 59 38 M15 45 Q36 39 57 45" stroke="${shade(c1,-.3)}" stroke-width="1.5" fill="none" opacity=".65"/>
      <ellipse cx="36" cy="39" rx="13" ry="7" fill="${c2}"/>
      <path d="M22 37 q3 -2.5 5 0.5 M45 37 q3 -2.5 5 0.5 M24 42 q3 -2.5 5 0.5 M43 42 q3 -2.5 5 0.5" stroke="${shade(c1,-.32)}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".6"/>
      ${_moodEyes(27.5, 44.5, 31, 2.6, mood)}
      <path d="M28 37 Q36 33.5 44 37 Q44 40.5 36 41.5 Q28 40.5 28 37 Z" fill="${shade(c1,-.22)}"/>
      <ellipse cx="32.5" cy="36.5" rx="1.6" ry="1.2" fill="#241C22"/><ellipse cx="39.5" cy="36.5" rx="1.6" ry="1.2" fill="#241C22"/>
      ${mood==="good"?`<path d="M30 43 q6 3.5 12 0" stroke="#3A322E" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:`<path d="M31 44 q5 -1.4 10 0" stroke="#3A322E" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
      <path d="M27 39 l-8 -1.5 M27 42 l-8 1 M45 39 l8 -1.5 M45 42 l8 1" stroke="#F2EDE4" stroke-width="1.1" opacity=".85"/>`;}
  const headShape = head || `<ellipse cx="36" cy="34" rx="24" ry="22" fill="${c1}" stroke="#463A54" stroke-width="2.4"/>`;
  const accNeck=worn.neck?PET_ACCESSORY_SVG[worn.neck]||"":"";
  const accHat=worn.hat?PET_ACCESSORY_SVG[worn.hat]||"":"";
  const accEyes=worn.eyes?PET_ACCESSORY_SVG[worn.eyes]||"":"";
  return `<svg viewBox="0 0 72 64" width="${w}" height="${Math.round(w*.89)}" aria-hidden="true"><g filter="url(#wob)">
   ${tail}${ears}${headShape}
   ${pet.species==="parrot"?`<ellipse cx="36" cy="34" rx="24" ry="22" fill="${c1}" stroke="#463A54" stroke-width="2.4"/>`:""}
   ${hideFace?"":face}${extra}${accNeck}${accHat}${accEyes}</g></svg>`;
}
