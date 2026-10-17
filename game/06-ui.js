/* ============================================================
   UI — screens & game loop
   Patience (per-customer, tiered) now replaces the old lives
   system entirely — a slow player only ever loses individual
   tickets, never the whole session. Hints/pause tokens removed.
   Answer flow is tap-to-answer (tapping an option commits it). Normal mode reveals the full
   explanation in a pausable popup (20s auto-close); Time Challenge
   skips the popup for speed — just a quick right/wrong flash,
   then straight on to the next customer.
   ============================================================ */
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const app=$("#app");
/* Production integration: Pet Pop is visible by default beside Review.
   ?petpop=0 remains the emergency off switch for safe rollback. */
const PET_POP_FEATURE_ENABLED=typeof location==="undefined"||new URLSearchParams(location.search||"").get("petpop")!=="0";
let PET_POP_CONTROLLER=null,PET_POP_NAVIGATION=0,PET_POP_SESSION_COUNTER=0,PET_POP_ANALYTICS_ACTIVE=false;
let PET_POP_PENDING_TROPHIES=[];
const PET_POP_COMMITTING_KEYS=new Set();
/* S11a: text shown outside the page (alert/confirm) in the chosen language */
function wbT(s,vars){return window.WBI18N?WBI18N.t(s,vars):s;}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function toast(msg,opts){const t=$("#toast");
  /* On small phones an achievement card (top) + a toast (bottom) can
     blanket the question area together (QA WB17-05) — let the trophy
     have its moment, then show the toast. */
  const pop=document.querySelector(".achievepop.show");
  /* S9c: a newer toast always takes over at once, so an older Undo can
     never be tapped by mistake while the new one waits. */
  if(pop){ clearTimeout(t._defer); clearTimeout(t._h); t.classList.remove("show","withaction"); t._defer=setTimeout(()=>toast(msg,opts),1400); return; }
  clearTimeout(t._defer);
  /* S11b: a word and its definition are English learning text — never translated */
  if(opts&&opts.english)t.setAttribute("lang","en-GB");else t.removeAttribute("lang");
  t.textContent=msg;t.classList.remove("withaction");
  /* S9c: optional action button (e.g. Undo). Plain toasts are unchanged. */
  const act=opts&&typeof opts.action==="function";
  if(act){const b=document.createElement("button");b.type="button";b.className="toastact";b.textContent=opts.label||"Undo";
    b.onclick=()=>{clearTimeout(t._h);t.classList.remove("show","withaction");AudioKit.tap();try{opts.action();}catch(e){}};
    t.append(" ",b);t.classList.add("withaction");}
  t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show","withaction"),act?5000:2200);}
let cafeLightingTimer=null;
function applyCafeLighting(){
  clearTimeout(cafeLightingTimer);cafeLightingTimer=null;
  const p=P();
  if(!p){document.body.classList.remove("cafe-day","cafe-night");return;}
  const period=cafeLightingPeriod(new Date(),p.settings);
  document.body.classList.toggle("cafe-day",period==="day");
  document.body.classList.toggle("cafe-night",period==="night");
  document.body.dataset.cafePeriod=period;
  if((p.settings.lightingMode||"auto")==="auto"){
    const wait=Math.max(1000,nextCafeLightingBoundary(new Date()).getTime()-Date.now()+150);
    cafeLightingTimer=setTimeout(applyCafeLighting,wait);
  }
}
function applySettings(){const p=P();if(!p){applyCafeLighting();return;}
  document.body.classList.toggle("reduce",p.settings.motion==="reduced");
  document.body.classList.toggle("psave",!!p.settings.batterySaver);
  document.body.classList.toggle("easyread",p.settings.font==="dyslexic");
  document.body.style.fontSize=p.settings.text==="large"?"19px":p.settings.text==="xl"?"21px":"17px";
  /* Build 54: Battery Saver stops the automatic pet-idle wake-up loop
     immediately. User taps, answer reactions and reward celebrations
     remain event-driven so the game still feels responsive. */
  if(typeof clearPlayerPetIdle==="function"){
    if(p.settings.batterySaver) clearPlayerPetIdle();
    else if(typeof SHIFT!=="undefined"&&SHIFT&&typeof schedulePlayerPetIdle==="function") schedulePlayerPetIdle();
  }
  applyCafeLighting();
  if(typeof AudioKit!=="undefined"&&AudioKit.sync)AudioKit.sync();}

/* Build 40 settings migration: keep the existing nested settings
   schema, map the four Build 39 track ids once, and add the automatic
   lighting preference without touching progress or ownership. */
function normalizeBuild40Settings(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    if(!p.settings||typeof p.settings!=="object"){p.settings={...DEFAULT_SETTINGS};changed=true;return;}
    const track=normaliseMusicTrackId(p.settings.musicTrack);
    if(p.settings.musicTrack!==track){p.settings.musicTrack=track;changed=true;}
    if(!["auto","day","night"].includes(p.settings.lightingMode)){p.settings.lightingMode="auto";changed=true;}
  });
  return changed;
}

const LEGACY_PET_ID_MAP=Object.freeze({
  terrier:"dog",beagle:"dog",collie:"dog",lab:"dog",
  tabby:"cat",marmalade:"cat",blackcat:"cat",fluff:"cat",
  hen:"chicken",dachs:"dachshund"
});
function canonicalPetId(id){return typeof id==="string"?(LEGACY_PET_ID_MAP[id]||id):id;}

/* Build 41 migration: add the permanent café-pet state without
   duplicating furniture placement. Pet beds already use the existing
   p.placed.cafe.petbed slot, which remains the single source of truth. */
function normalizeBuild41Pets(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    if(!p.petSystem||typeof p.petSystem!=="object"||Array.isArray(p.petSystem)){p.petSystem=freshPetSystem();changed=true;}
    const ps=p.petSystem;
    const cleanLicence=!!ps.licenceOwned;
    if(ps.licenceOwned!==cleanLicence){ps.licenceOwned=cleanLicence;changed=true;}
    /* Build 85 retires the unused 0-100 content/happiness economy. Old
       saves remain compatible, but the obsolete fields are removed once. */
    if(Object.prototype.hasOwnProperty.call(ps,"happiness")){delete ps.happiness;changed=true;}
    if(Object.prototype.hasOwnProperty.call(ps,"lastTapRewardDate")){delete ps.lastTapRewardDate;changed=true;}
    if(ps.activePetId!==null){
      const mapped=canonicalPetId(ps.activePetId);
      if(mapped!==ps.activePetId){ps.activePetId=mapped;changed=true;}
      if(!PETS.some(x=>x.id===ps.activePetId)){ps.activePetId=null;changed=true;}
    }
    if(Array.isArray(p.petsMet)){
      const mapped=[...new Set(p.petsMet.map(canonicalPetId).filter(id=>PETS.some(x=>x.id===id)))];
      if(mapped.join("|")!==p.petsMet.join("|")){p.petsMet=mapped;changed=true;}
    }
    p.owned=Array.isArray(p.owned)?p.owned:[];
    const ownsLicence=p.owned.includes("pet_license");
    if(ownsLicence&&!ps.licenceOwned){ps.licenceOwned=true;changed=true;}
    if(ps.licenceOwned&&!ownsLicence){p.owned.push("pet_license");changed=true;}
    if(!ps.licenceOwned&&ps.activePetId!==null){ps.activePetId=null;changed=true;}
  });
  return changed;
}

const LEGACY_THEME_UNLOCKS={sunny:0,spring:800,halloween:1600,christmas:2400,kyoto:3200,foodtruck:4000};
function normalizeBuild50ThemesAndPets(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    if(p._legacyThemeMigrationDone===true)return;
    p._themesSeen=Array.isArray(p._themesSeen)?p._themesSeen:[];
    Object.entries(LEGACY_THEME_UNLOCKS).forEach(([k,unlock])=>{
      if((p.lifetime||0)>=unlock && !p._themesSeen.includes(k)){p._themesSeen.push(k);changed=true;}
    });
    p._legacyThemeMigrationDone=true;changed=true;
  });
  return changed;
}

const BUILD52_REMOVED_PETS=new Set(["porcupine","iguana","flamingo","tortoise","komodo"]);
const BUILD52_REMOVED_ITEMS=new Set(["mug_mint","plant_basil","neon_open","jacket_berry"]);
function normalizeBuild52Content(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    if(Array.isArray(p.petsMet)){
      const clean=p.petsMet.filter(id=>!BUILD52_REMOVED_PETS.has(id)&&PETS.some(x=>x.id===id));
      if(clean.join("|")!==p.petsMet.join("|")){p.petsMet=clean;changed=true;}
    }
    if(p.petSystem&&BUILD52_REMOVED_PETS.has(p.petSystem.activePetId)){p.petSystem.activePetId=null;changed=true;}
    if(Array.isArray(p._custServed)&&p._custServed.includes("santa")){p._custServed=p._custServed.filter(id=>id!=="santa");changed=true;}
    if(Array.isArray(p.owned)){
      const clean=p.owned.filter(id=>!BUILD52_REMOVED_ITEMS.has(id));
      if(clean.join("|")!==p.owned.join("|")){p.owned=clean;changed=true;}
    }
    if(p.placed&&typeof p.placed==="object"){
      Object.values(p.placed).forEach(group=>{
        if(!group||typeof group!=="object")return;
        Object.keys(group).forEach(slot=>{if(BUILD52_REMOVED_ITEMS.has(group[slot])){delete group[slot];changed=true;}});
      });
    }
  });
  return changed;
}

const KITCHEN_KNOWN_FOODS=new Set(KITCHEN_FOODS.map(x=>x.id));
function cleanKitchenState(raw,courseId=COURSE_IDS.elevenPlus){
  const k=freshKitchenState(courseId);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return k;
  const rawVersion=Number(raw.v)||0;
  k.v=KITCHEN_SCHEMA_VERSION;
  if(Array.isArray(raw.unlockedFoods)){
    const newlyLocked=new Set(["hotdog","burger","smoothie","fizz"]);
    let incoming=raw.unlockedFoods.filter(id=>KITCHEN_KNOWN_FOODS.has(id));
    /* Build 68 changes four formerly/default-available menu families into
       real Kitchen unlocks. Existing beta saves are re-locked once; saves
       already written by schema 4 preserve genuine challenge unlocks. */
    if((Number(raw.v)||0)<4)incoming=incoming.filter(id=>!newlyLocked.has(id));
    k.unlockedFoods=[...new Set([...KITCHEN_CLASSIC_FOODS,...incoming])];
  }
  if(Array.isArray(raw.firstRewardedFoods)){
    k.firstRewardedFoods=[...new Set(raw.firstRewardedFoods.filter(id=>KITCHEN_KNOWN_FOODS.has(id)))];
  }
  /* Before Build 80, an unlocked challenge food had necessarily been
     won once. Preserve that fact so an update cannot award the new
     first-win amount a second time. Classics were always available but
     never challengeable, so they intentionally remain eligible. */
  if(rawVersion<5){
    const wonChallenges=k.unlockedFoods.filter(id=>!KITCHEN_CLASSIC_FOODS.includes(id));
    k.firstRewardedFoods=[...new Set([...k.firstRewardedFoods,...wonChallenges])];
  }
  if(raw.rewardedToday&&typeof raw.rewardedToday==="object"&&!Array.isArray(raw.rewardedToday)){
    Object.entries(raw.rewardedToday).forEach(([id,day])=>{
      if(KITCHEN_KNOWN_FOODS.has(id)&&typeof day==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(day))k.rewardedToday[id]=day;
    });
  }
  const clamp=(v,lo=0,hi=9999999)=>{v=Number(v);return Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):0;};
  /* Build 81 global daily allowance. A Build 80 save may already have
     paid several different recipes today, so derive today's used count
     from rewardedToday and clamp it to the new four-reward ceiling. */
  const today=localDayKey();
  if(typeof raw.dailyRewardDay==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(raw.dailyRewardDay)){
    k.dailyRewardDay=raw.dailyRewardDay;
    k.dailyRewardCount=clamp(raw.dailyRewardCount,0,KITCHEN_CONFIG.dailyPaidCompletions);
  }else{
    const migratedCount=Object.values(k.rewardedToday).filter(day=>day===today).length;
    k.dailyRewardDay=migratedCount?today:null;
    k.dailyRewardCount=Math.min(KITCHEN_CONFIG.dailyPaidCompletions,migratedCount);
  }
  if(raw.stats&&typeof raw.stats==="object"){
    ["challengesStarted","challengesWon","perfectWins","firstAttemptWins","correct","wrong","pathDrags","conveyorMoves"].forEach(key=>{k.stats[key]=clamp(raw.stats[key]);});
    if(raw.stats.modeCorrect&&typeof raw.stats.modeCorrect==="object"){
      ["conveyor","scramble","path"].forEach(m=>{k.stats.modeCorrect[m]=clamp(raw.stats.modeCorrect[m]);});
    }
    if(raw.stats.modeResults&&typeof raw.stats.modeResults==="object"){
      ["conveyor","scramble","path"].forEach(m=>{
        const src=raw.stats.modeResults[m];if(!src||typeof src!=="object")return;
        ["starts","successes","mistakes","activeMs"].forEach(key=>{k.stats.modeResults[m][key]=clamp(src[key]);});
      });
    }
    if(raw.stats.questionKinds&&typeof raw.stats.questionKinds==="object"){
      Object.keys(k.stats.questionKinds).forEach(kind=>{
        const src=raw.stats.questionKinds[kind];if(!src||typeof src!=="object")return;
        const starts=clamp(src.starts),correct=clamp(src.correct,0,starts),wrong=clamp(src.wrong,0,starts-correct);
        k.stats.questionKinds[kind]={starts,correct,wrong};
      });
    }
    if(raw.stats.failReasons&&typeof raw.stats.failReasons==="object"){
      ["timeout","mistakes","emptyPool","abandoned"].forEach(key=>{k.stats.failReasons[key]=clamp(raw.stats.failReasons[key]);});
    }
    if(raw.stats.fallbacks&&typeof raw.stats.fallbacks==="object"){
      Object.entries(raw.stats.fallbacks).slice(0,100).forEach(([key,v])=>{if(/^[a-z0-9_:-]{1,60}$/i.test(key))k.stats.fallbacks[key]=clamp(v);});
    }
    if(raw.stats.dropOffRound&&typeof raw.stats.dropOffRound==="object"){
      Object.entries(raw.stats.dropOffRound).forEach(([key,v])=>{if(/^[1-7]$/.test(key))k.stats.dropOffRound[key]=clamp(v);});
    }
  }
  if(raw.bestByFood&&typeof raw.bestByFood==="object"){
    Object.entries(raw.bestByFood).forEach(([id,v])=>{
      if(!KITCHEN_KNOWN_FOODS.has(id)||!v||typeof v!=="object")return;
      k.bestByFood[id]={attempts:clamp(v.attempts),bestCorrect:clamp(v.bestCorrect,0,7),bestRemaining:clamp(v.bestRemaining,0,999),fewestMistakes:clamp(v.fewestMistakes,0,KITCHEN_CONFIG.submittedMistakesAllowed+1),unlockedAt:clamp(v.unlockedAt,0,Date.now()+315360000000)};
    });
  }
  if(raw.lastAttemptByFood&&typeof raw.lastAttemptByFood==="object"){
    Object.entries(raw.lastAttemptByFood).forEach(([id,v])=>{
      if(!KITCHEN_KNOWN_FOODS.has(id)||!v||typeof v!=="object")return;
      k.lastAttemptByFood[id]={correct:clamp(v.correct,0,7),mistakes:clamp(v.mistakes,0,3),timeout:!!v.timeout,remaining:clamp(v.remaining,0,999),result:["won","failed","abandoned"].includes(v.result)?v.result:"failed"};
    });
  }
  if(raw.foodServeCounts&&typeof raw.foodServeCounts==="object"){
    Object.entries(raw.foodServeCounts).forEach(([id,v])=>{if(KITCHEN_KNOWN_FOODS.has(id))k.foodServeCounts[id]=clamp(v);});
  }
  if(raw.tutorial&&typeof raw.tutorial==="object")k.tutorial={completed:!!raw.tutorial.completed,skipped:!!raw.tutorial.skipped};
  return k;
}
function normalizeBuild55Kitchen(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    const before=p.kitchen;
    const clean=cleanKitchenState(before,p.courseId||COURSE_IDS.elevenPlus);
    if(!before||JSON.stringify(before)!==JSON.stringify(clean)){p.kitchen=clean;changed=true;}
  });
  return changed;
}
/* Build 75 learning-feature migration. Older profiles gain only safe
   defaults; existing word progress, session history and settings stay intact. */
function normalizeBuild75Learning(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    if(!p.settings||typeof p.settings!=="object"){p.settings={...DEFAULT_SETTINGS};changed=true;}
    if(typeof p.settings.showMasteryBadge!=="boolean"){p.settings.showMasteryBadge=true;changed=true;}
    const streak=Math.max(0,Math.min(9999,Math.round(Number(p.reviewStreakDays)||0)));
    if(p.reviewStreakDays!==streak){p.reviewStreakDays=streak;changed=true;}
    if(p.lastReviewDate!==null&&!(typeof p.lastReviewDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(p.lastReviewDate))){p.lastReviewDate=null;changed=true;}
    if(p.lastReviewDate===undefined){p.lastReviewDate=null;changed=true;}
  });
  return changed;
}
/* Build 76 pet wardrobe migration. Old profiles keep every existing
   placement and gain one empty, validated pet-accessory bag. */
function normalizeBuild76PetWardrobe(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    if(!p.placed||typeof p.placed!=="object"||Array.isArray(p.placed)){p.placed={avatar:{},cafe:{},pet:{}};changed=true;}
    if(!p.placed.avatar||typeof p.placed.avatar!=="object"||Array.isArray(p.placed.avatar)){p.placed.avatar={};changed=true;}
    if(!p.placed.cafe||typeof p.placed.cafe!=="object"||Array.isArray(p.placed.cafe)){p.placed.cafe={};changed=true;}
    if(!p.placed.pet||typeof p.placed.pet!=="object"||Array.isArray(p.placed.pet)){p.placed.pet={};changed=true;}
    Object.entries(p.placed.pet).forEach(([slot,id])=>{
      const it=SHOP.find(x=>x.id===id);
      if(!it||it.dest!=="pet"||it.slot!==slot||!p.owned?.includes(id)){delete p.placed.pet[slot];changed=true;}
    });
  });
  return changed;
}
/* Build 80 economy migration. Capture every reveal earned under the
   former 200-coin step before applying the new 300-coin schedule. The
   permanent floor also protects saves that were exported between reveal
   ceremonies, when _unlocksSeen could legitimately lag lifetime coins. */
const BUILD79_UNLOCK_STEP=200;
function normalizeBuild80Economy(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    if(Number(p._unlockStepVersion)!==UNLOCK_STEP){
      const legacy=Math.floor(Math.max(0,Number(p.lifetime)||0)/BUILD79_UNLOCK_STEP);
      p._unlocksSeen=Math.max(legacy,Math.max(0,Number(p._unlocksSeen)||0));
      p._unlockStepVersion=UNLOCK_STEP;changed=true;
    }
  });
  return changed;
}
/* Phase 3 Pet Pop migration. The spelling record is versioned and keeps a
   bucket for each course, while existing Café/Review meaning state remains
   untouched. Cleaning the same candidate twice is byte-equivalent. */
function normalizeBuild87Spelling(root){
  let changed=false;
  (root.profiles||[]).forEach(profile=>{
    const clean=cleanSpellingGameState(profile.spellingGame);
    if(JSON.stringify(profile.spellingGame)!==JSON.stringify(clean)){profile.spellingGame=clean;changed=true;}
  });
  return changed;
}
function kitchenOf(p=P()){
  if(!p)return freshKitchenState();
  if(!p.kitchen||typeof p.kitchen!=="object")p.kitchen=freshKitchenState(p.courseId||COURSE_IDS.elevenPlus);
  return p.kitchen;
}
function petSystemOf(p=P()){return p&&p.petSystem&&typeof p.petSystem==="object"?p.petSystem:DEFAULT_PET_SYSTEM;}
function activePlayerPet(p=P()){const ps=petSystemOf(p);return ps.licenceOwned&&ps.activePetId?PETS.find(x=>x.id===ps.activePetId)||null:null;}
function petWearables(p=P()){return p&&p.placed&&p.placed.pet&&typeof p.placed.pet==="object"?p.placed.pet:{};}
function petReactionText(pet,kind){
  const fallback={good:"does a delighted little happy dance!",bad:"looks thoughtful for a moment, then settles back down.",tap:"trots over for a friendly hello!"};
  if(!pet||!kind)return fallback.tap;
  const specific=PET_REACT&&PET_REACT[pet.species]&&PET_REACT[pet.species][kind];
  return specific||fallback[kind]||fallback.tap;
}
function localDayKey(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function kitchenDailyRewardsUsed(k,day=localDayKey()){
  return k&&k.dailyRewardDay===day?Math.max(0,Math.min(KITCHEN_CONFIG.dailyPaidCompletions,Number(k.dailyRewardCount)||0)):0;
}
function kitchenRecordPaidReward(k,day=localDayKey()){
  const used=kitchenDailyRewardsUsed(k,day);
  k.dailyRewardDay=day;k.dailyRewardCount=Math.min(KITCHEN_CONFIG.dailyPaidCompletions,used+1);
  return k.dailyRewardCount;
}
function currentReviewStreakDays(p=P(),now=new Date()){
  if(!p||!p.lastReviewDate)return 0;
  const today=localDayKey(now),yesterdayDate=new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate()-1);
  return (p.lastReviewDate===today||p.lastReviewDate===localDayKey(yesterdayDate))?Math.max(0,Number(p.reviewStreakDays)||0):0;
}
function noteReviewDay(){
  const p=P();if(!p)return {advanced:false,days:0};
  const now=new Date(),today=localDayKey(now);
  if(p.lastReviewDate===today)return {advanced:false,days:currentReviewStreakDays(p,now)};
  const yesterdayDate=new Date(now);yesterdayDate.setDate(yesterdayDate.getDate()-1);
  p.reviewStreakDays=p.lastReviewDate===localDayKey(yesterdayDate)?Math.max(0,Number(p.reviewStreakDays)||0)+1:1;
  p.lastReviewDate=today;
  persist();
  return {advanced:true,days:p.reviewStreakDays};
}
const PET_CELEBRATION_INFO={
  level:{priority:5,major:true,action:"hop",emote:"🏆"},
  mastery:{priority:4,major:true,action:"wiggle",emote:"🌟"},
  perfectTicket:{priority:3,major:true,action:"wave",emote:"✨"},
  streak10:{priority:2,action:"hop",emote:"🔥10"},
  streak5:{priority:1,action:"wiggle",emote:"🔥5"}
};
let playerPetCelebrationQueue=[],playerPetCelebrating=false,playerPetCelebrationTimer=null,playerPetCelebrationAt=0;
function clearPlayerPetCelebrations(){
  playerPetCelebrationQueue=[];playerPetCelebrating=false;
  if(playerPetCelebrationTimer){clearTimeout(playerPetCelebrationTimer);playerPetCelebrationTimer=null;}
}
function queuePlayerPetCelebration(type){
  const info=PET_CELEBRATION_INFO[type],el=document.querySelector(".stage [data-player-pet]");
  if(!info||!el||!activePlayerPet(P()))return;
  if(!playerPetCelebrationQueue.some(x=>x.type===type))playerPetCelebrationQueue.push({type,...info});
  playerPetCelebrationQueue.sort((a,b)=>b.priority-a.priority);runPlayerPetCelebration();
}
function runPlayerPetCelebration(){
  if(playerPetCelebrating||playerPetCelebrationTimer||!playerPetCelebrationQueue.length)return;
  const next=playerPetCelebrationQueue[0],elapsed=Date.now()-playerPetCelebrationAt;
  const wait=next.major?0:Math.max(0,20000-elapsed);
  if(wait){playerPetCelebrationTimer=setTimeout(()=>{playerPetCelebrationTimer=null;runPlayerPetCelebration();},wait);return;}
  const el=document.querySelector(".stage [data-player-pet]");
  if(!el){clearPlayerPetCelebrations();return;}
  playerPetCelebrationQueue.shift();playerPetCelebrating=true;playerPetCelebrationAt=Date.now();clearPlayerPetIdle();
  const pet=activePlayerPet(P());if(pet)showPlayerPetMood(el,pet,"excited",2100);
  animatePlayerPet(el,next.action);playerPetEmote(el,next.emote);
  setTimeout(()=>{playerPetCelebrating=false;runPlayerPetCelebration();},1550);
}
function rewardPetForCorrectAnswer(streak,masteredNow=false){
  if(masteredNow)queuePlayerPetCelebration("mastery");
  if(streak===5)queuePlayerPetCelebration("streak5");
  if(streak===10)queuePlayerPetCelebration("streak10");
}

/* One-time save migration: the old single "extra" wearable slot moves
   into its item's position slot, so previously-owned pieces keep
   showing and can now be worn together. */
function normalizeWearables(root){
  let changed=false;
  (root.profiles||[]).forEach(p=>{
    const pa=p.placed&&p.placed.avatar;
    if(pa&&pa.extra){ const it=SHOP.find(x=>x.id===pa.extra);
      if(it&&it.slot!=="extra"){ if(!pa[it.slot]) pa[it.slot]=pa.extra; delete pa.extra; changed=true; } }
  });
  return changed;
}

/* Phase 2B save migration. All Build 40-80 steps above are pure
   candidate normalisers: they mutate only the supplied deep copy and
   never call persist() or touch either browser-storage key. */
function stampV3CourseFields(root){
  let changed=false;
  if(root.schemaVersion!==WORDBAR_SAVE_SCHEMA_VERSION){root.schemaVersion=WORDBAR_SAVE_SCHEMA_VERSION;changed=true;}
  (root.profiles||[]).forEach((profile,index)=>{
    if(profile.courseId===undefined){profile.courseId=COURSE_IDS.elevenPlus;changed=true;}
    if(!WORDBAR_KNOWN_COURSES.includes(profile.courseId))throw new Error(`Barista ${index+1} has an unknown course.`);
    for(const key of ["shifts","rushScores"]){
      if(profile[key]===undefined)continue;
      if(!Array.isArray(profile[key]))throw new Error(`Barista ${index+1} has damaged ${key}.`);
      profile[key].forEach(session=>{
        if(!session||typeof session!=="object")throw new Error(`Barista ${index+1} has a damaged session.`);
        if(session.courseId===undefined){session.courseId=profile.courseId;changed=true;}
        else if(session.courseId!==profile.courseId)throw new Error(`Barista ${index+1} has mixed-course session history.`);
      });
    }
  });
  return changed;
}
function normalizeSaveCandidate(root){
  if(!root||typeof root!=="object"||Array.isArray(root)||!Array.isArray(root.profiles))throw new Error("The saved progress has an invalid structure.");
  let changed=false;
  changed=normalizeBuild40Settings(root)||changed;
  changed=normalizeBuild41Pets(root)||changed;
  changed=normalizeBuild50ThemesAndPets(root)||changed;
  changed=normalizeBuild52Content(root)||changed;
  changed=normalizeBuild55Kitchen(root)||changed;
  changed=normalizeBuild75Learning(root)||changed;
  changed=normalizeBuild76PetWardrobe(root)||changed;
  changed=normalizeBuild80Economy(root)||changed;
  changed=normalizeBuild87Spelling(root)||changed;
  changed=normalizeWearables(root)||changed;
  changed=stampV3CourseFields(root)||changed;
  validateV3SaveRoot(root,{catalogs:true});
  return changed;
}
let SAVE_MIGRATION_INFO={status:"not-run",authorityBefore:null,oldBytes:0,candidateBytes:0,verifiedBytes:0,storageEstimate:null,error:null};
function initializeV3Save(){
  const authorityBefore=WordBarPersistence.authority;
  SAVE_MIGRATION_INFO={status:"running",authorityBefore,
    oldBytes:saveByteLength(WordBarPersistence.captured.legacyRaw??WordBarPersistence.captured.v3Raw??""),
    candidateBytes:0,verifiedBytes:0,storageEstimate:null,error:null};
  if(typeof navigator!=="undefined"&&navigator.storage&&typeof navigator.storage.estimate==="function"){
    Promise.resolve(navigator.storage.estimate()).then(estimate=>{SAVE_MIGRATION_INFO.storageEstimate={usage:Number(estimate&&estimate.usage)||0,quota:Number(estimate&&estimate.quota)||0};}).catch(()=>{});
  }
  if(authorityBefore==="blocked"){
    const error=WordBarPersistence.lastError||new Error("Saved progress could not be read.");
    SAVE_MIGRATION_INFO.status="failed";SAVE_MIGRATION_INFO.error=error.code||error.message;
    return {ok:false,error};
  }
  const original=cloneSaveValue(SAVE),candidate=cloneSaveValue(SAVE);
  let changed=false;
  try{changed=normalizeSaveCandidate(candidate);}catch(error){SAVE_MIGRATION_INFO.status="failed";SAVE_MIGRATION_INFO.error=error.code||error.message;return {ok:false,error};}
  SAVE_MIGRATION_INFO.candidateBytes=saveByteLength(JSON.stringify(candidate));
  if(authorityBefore==="v3"&&!changed){
    SAVE=candidate;SAVE_MIGRATION_INFO.status="ready";SAVE_MIGRATION_INFO.verifiedBytes=SAVE_MIGRATION_INFO.candidateBytes;
    return {ok:true,migrated:false,bytes:SAVE_MIGRATION_INFO.candidateBytes};
  }
  const result=WordBarPersistence.commitCurrent(candidate);
  if(!result.ok){SAVE=original;SAVE_MIGRATION_INFO.status="failed";SAVE_MIGRATION_INFO.error=result.error&&result.error.code||"SAVE_VERIFY_FAILED";return result;}
  SAVE=result.value;WordBarPersistence.setInitialSave(SAVE);
  SAVE_MIGRATION_INFO.status=result.memoryOnly?"memory-only":"ready";SAVE_MIGRATION_INFO.verifiedBytes=result.bytes;
  return {ok:true,migrated:authorityBefore!=="v3",bytes:result.bytes,memoryOnly:!!result.memoryOnly};
}
function exportSaveBlob(serialized,name="wordbar-save-v3.json"){
  const blob=new Blob([serialized],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();
  if(window.WordBarAnalytics)WordBarAnalytics.milestoneOnce("first_save_exported");
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function showSaveMigrationFailure(error){
  if(window.WordBarAnalytics)WordBarAnalytics.error("boot_failed","boot");
  const legacy=WordBarPersistence.captured.legacyRaw;
  show(`<section class="screen center"><h1 class="logo">Word<span>Bar</span></h1>
    <p class="tag">Your existing progress is safe, but WordBar could not finish its save upgrade.</p>
    <p class="note">No old progress was changed. Free a little browser storage if needed, then retry. You can also export the existing 11+ save before doing anything else.</p>
    <button class="felt" id="retrySaveMigration">🔄 Retry save upgrade</button>
    <button class="felt" id="exportLegacySave">⬇ Export existing progress</button>
    <p class="note"><small>Grown-up details: ${esc(error&&error.message||"save verification failed")}</small></p></section>`);
  $("#retrySaveMigration").onclick=()=>location.reload();
  $("#exportLegacySave").onclick=()=>exportSaveBlob(legacy!==null?legacy:JSON.stringify(SAVE,null,1),"wordbar-existing-save.json");
}


/* ---------- Café scene ----------
   Now includes a proper bar counter + coffee machine (theme-aware
   via the same THEMES tokens used elsewhere), and keeps the
   ambient particle layer + foreground-safe z-ordering from the
   previous pass. Machine sits on the left, roughly under where
   the barista stands (.barista is anchored at left:12% in CSS)
   so the two visually belong together; customers queue along the
   counter to the right of it. */
function ambientSVG(kind){
  if(kind==="dust") return Array.from({length:8},(_,i)=>`<div class="mote" style="left:${8+i*11}%;animation-delay:${i*1.1}s"></div>`).join("");
  if(kind==="petals") return Array.from({length:7},(_,i)=>`<div class="petal" style="left:${6+i*13}%;animation-delay:${i*0.9}s"></div>`).join("");
  if(kind==="snow") return Array.from({length:9},(_,i)=>`<div class="snowflake" style="left:${5+i*10}%;animation-delay:${i*0.8}s"></div>`).join("");
  if(kind==="embers") return Array.from({length:6},(_,i)=>`<div class="ember" style="left:${10+i*14}%;animation-delay:${i*1.2}s"></div>`).join("");
  if(kind==="maple") return Array.from({length:6},(_,i)=>`<div class="maple" style="left:${8+i*15}%;animation-delay:${i*1.0}s"></div>`).join("");
  return "";
}

/* The one place a profile's look is resolved: a customized barista
   stores the full look on the profile (p.customLook); preset baristas
   keep pointing at AVATARS. Every render site goes through here, so a
   custom avatar behaves identically everywhere — café, profile cards,
   shop preview, apron and wearables included. */
function avatarLookFor(p){
  if(p&&p.avatar==="custom"&&p.customLook){
    const cl=p.customLook;
    /* S9c: an edited ready-made barista keeps its original face (faceFix)
       until the child picks a new eye shape. */
    if(cl.faceFix&&typeof cl.faceFix==="object"&&!cl.eyeShape){
      return {...cl,lashes:!!cl.faceFix.lashes,
        facialHair:CUSTOMIZER.facialHair.some(([id])=>id===cl.facialHair)?cl.facialHair:"none"};
    }
    /* v25 custom saves did not store an explicit eye shape/lash flag.
       Resolve them to stable defaults without mutating the save. */
    return {...cl,
      eyeShape:CUSTOMIZER.eyeShapes.some(([id])=>id===cl.eyeShape)?cl.eyeShape:"round",
      lashes:typeof cl.lashes==="boolean"?cl.lashes:cl.noLash!==true,
      iris:(CUSTOMIZER.eyeColors.some(([id])=>id===cl.iris)||IRIS_COLORS.includes(cl.iris))?cl.iris:"#6E4A2E",
      facialHair:CUSTOMIZER.facialHair.some(([id])=>id===cl.facialHair)?cl.facialHair:"none"};
  }
  const av=AVATARS.find(a=>a.id===(p&&p.avatar))||AVATARS[0];
  return av.look;
}

/* One resolver for EVERYTHING the player wears, used by every player
   render site (café, profile cards, shop preview) so the avatar can
   never look different in different places (v25 review, medium #3). */
function playerRenderOpts(p){
  const pa=p.placed.avatar;
  /* wearables live in position slots — different positions coexist
     (sunglasses + belt, earrings + headset); same position replaces */
  const extras=["back","eyes","ears","head_extra","clips","neck","wrist_l","wrist_r","waist"].map(k=>pa[k]).filter(Boolean);   /* S9d: + back (cape), clips */
  if(pa.extra) extras.push(pa.extra); /* un-migrated legacy slot */
  /* Modern eyes-slot eyewear (sunglasses) wins over the retired legacy
     round-glasses slot, preventing two shop pairs from stacking. */
  return {apron:pa.apron,hat:pa.hat,glasses:pa.eyes?null:pa.glasses,badge:pa.badge,extras,gstyle:pa.garment_style,gcolor:pa.garment_color};
}

/* v25 review, high-priority: a customized barista's baked-in glasses
   must not STACK with shop eyewear. Shop eyes-slot items act as the
   winner for the eye area — while one is equipped the base glasses are
   suppressed; take it off and they come straight back (pure resolution,
   nothing stored, so it can never get stuck). */
function playerLookFor(p,opts){
  const look=avatarLookFor(p);
  const hasShopEyes=(opts.extras||[]).some(id=>{const it=SHOP.find(x=>x.id===id);return it&&it.slot==="eyes";});
  return (hasShopEyes&&isGlassesStyle(look.accessory)) ? {...look,accessory:"none"} : look;
}

function playerSVG(expr="happy",w=96){
  const p=P(), opts=playerRenderOpts(p);
  return characterSVG(playerLookFor(p,opts),expr,{w,...opts});
}

let playerPetIdleTimer=null,playerPetTapAt=0,lastPlayerPetIdleAction=null;
/* Build 86: the shared motion timings match the approved three-pet
   movement sample. Because every active café pet renders through the same
   wrapper, these actions apply consistently to all 52 pet artworks. */
const PLAYER_PET_ACTION_MS=Object.freeze({hop:1150,wiggle:1250,look:1450,stretch:1550,sleep:1800,roll:2350,wave:1650,yawn:1700});
function clearPlayerPetIdle(){if(playerPetIdleTimer){clearTimeout(playerPetIdleTimer);playerPetIdleTimer=null;}}
function playerPetEmote(el,txt,duration=1250){
  const slot=el&&el.querySelector(".playerpetemote");if(!slot)return;
  slot.textContent=txt;slot.classList.remove("show");slot.style.setProperty("--pet-emote-duration",`${Math.max(900,duration)}ms`);void slot.offsetWidth;slot.classList.add("show");
  clearTimeout(slot._petEmoteTimer);slot._petEmoteTimer=setTimeout(()=>slot.classList.remove("show"),Math.max(900,duration)+40);
}
function showRandomPlayerPetMood(el,pet){
  if(!el||!pet)return;
  const moods=["good","excited","normal","bad"],mood=moods[rnd(moods.length)];
  showPlayerPetMood(el,pet,mood);
}
function reactPlayerPet(el){
  const now=Date.now();if(now-playerPetTapAt<950)return;playerPetTapAt=now;
  const pet=PETS.find(x=>x.id===el.dataset.playerPet);if(!pet)return;
  clearPlayerPetIdle();
  showRandomPlayerPetMood(el,pet);
  animatePlayerPet(el,Math.random()<.5?"hop":"wiggle");
  playerPetEmote(el,["💕","😊","✨","🐾"][rnd(4)]);
  AudioKit.pet(pet.species,true);recordPetGreeting(pet);
  toast(`${pet.name.replace(/^a /,"Your ")} ${petReactionText(pet,"tap")}`);
}
function weightedPlayerPetIdleAction(){
  const weights={look:4,stretch:3,sleep:2,hop:3,wave:2,yawn:2};   /* S13: no rolling — the café pets are flat drawings */
  const night=document.body.dataset.cafePeriod==="night";
  const late=!!SHIFT&&(Number(SHIFT.served||0)>=8||shiftDurationMs(SHIFT)>=5*60*1000);
  const streak=SHIFT?Math.max(0,Number(SHIFT.streak)||0):0;
  if(night){weights.sleep+=5;weights.yawn+=5;weights.stretch+=2;weights.hop=Math.max(1,weights.hop-1);}
  if(late){weights.sleep+=4;weights.yawn+=3;weights.stretch+=2;}
  if(streak>=3){weights.hop+=6;weights.wave+=3;weights.sleep=Math.max(1,weights.sleep-1);weights.yawn=Math.max(1,weights.yawn-1);}
  const entries=Object.entries(weights).filter(([action,weight])=>action!==lastPlayerPetIdleAction&&weight>0);
  let pick=Math.random()*entries.reduce((sum,[,weight])=>sum+weight,0);
  for(const [action,weight] of entries){pick-=weight;if(pick<=0)return action;}
  return entries[entries.length-1][0];
}
function schedulePlayerPetIdle(){
  clearPlayerPetIdle();
  const p=P(),el=document.querySelector(".stage [data-player-pet]");
  /* Battery Saver keeps the pet fully interactive, but removes the
     repeating automatic idle timer — a cheap, low-risk reduction in
     CPU wake-ups and SVG mood reconstruction while the child thinks. */
  if(!p||!el||document.hidden||p.settings.motion==="reduced"||p.settings.batterySaver||!SHIFT)return;
  if(typeof isSessionPaused==="function"&&isSessionPaused())return;
  const wait=30000+Math.random()*30000;
  playerPetIdleTimer=setTimeout(()=>{
    playerPetIdleTimer=null;
    const live=document.querySelector(".stage [data-player-pet]");
    if(!live||document.hidden||!SHIFT||P()?.settings?.batterySaver||(typeof isSessionPaused==="function"&&isSessionPaused())){schedulePlayerPetIdle();return;}
    const action=weightedPlayerPetIdleAction(),repeats=2+rnd(2),visibleMs=(PLAYER_PET_ACTION_MS[action]||1500)*repeats;
    lastPlayerPetIdleAction=action;
    /* Look borrows each animal's own excited/open-eye SVG expression. It is
       scoped to the automatic idle so a wrong-answer look can stay sad. */
    if(action==="look"){
      const pet=activePlayerPet(P());
      if(pet)showPlayerPetMood(live,pet,"excited",visibleMs+120);
    }
    if(action==="sleep")playerPetEmote(live,"💤",visibleMs);
    else if(action==="yawn")playerPetEmote(live,"🥱",visibleMs);
    else if(action==="wave")playerPetEmote(live,"👋",visibleMs);
    animatePlayerPet(live,action,{repeats});
  },wait);
}
document.addEventListener("click",e=>{const el=e.target.closest&&e.target.closest("[data-player-pet]");if(el)reactPlayerPet(el);});
document.addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ")return;const el=e.target.closest&&e.target.closest("[data-player-pet]");if(!el)return;e.preventDefault();reactPlayerPet(el);});
function show(html){
  clearPlayerPetIdle();clearPlayerPetCelebrations();
  const active=document.activeElement;
  if(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){try{active.blur();}catch(e){}}
  app.innerHTML=`<svg width="0" height="0" style="position:absolute"><defs>${FELT_FILTER}</defs></svg>`+html;
  try{WB_NAV.onBack=null;}catch(e){}   /* S9c: a screen's own back handler lasts only while it is shown */
  try{wbSyncHistory();}catch(e){}   /* S9b: keep the back button working */
  const resetScroll=()=>{if(window.scrollTo)window.scrollTo(0,0);};
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>{resetScroll();setTimeout(resetScroll,70);});
  else resetScroll();
}

/* ---------- Phase 2C boot/profile coordinator ----------
   Save metadata renders before any question bank is requested. Navigation and
   data-load generations are separate guards: the loader protects course stores,
   while this coordinator prevents a late promise from changing the active
   profile or navigating after the child has chosen something else. */
function coursePresentation(courseId){
  const course=COURSES[courseId]||COURSES.elevenPlus;
  return {name:course.displayName,short:course.shortName,icon:course.icon,description:course.description};
}
function courseBadgeHTML(courseId){const c=coursePresentation(courseId);return `<span class="coursebadge course-${esc(courseId)}">${c.icon} ${esc(c.name)}</span>`;}
function resetProfileTransientState(){
  resetAdaptiveState();
  clearPlayerPetIdle();clearPlayerPetCelebrations();
  if(typeof clearKitchenTimers==="function")clearKitchenTimers();
  if(PET_POP_ANALYTICS_ACTIVE&&window.WordBarAnalytics)WordBarAnalytics.endSession({result:"interrupted"});PET_POP_ANALYTICS_ACTIVE=false;
  if(typeof PetPop!=="undefined")PetPop.destroy();PET_POP_CONTROLLER=null;PET_POP_NAVIGATION++;PET_POP_PENDING_TROPHIES=[];
  if(typeof Voice!=="undefined")Voice.cancel();
  if(typeof KITCHEN_RUN!=="undefined")KITCHEN_RUN=null;
  if(typeof KITCHEN_TUTORIAL!=="undefined")KITCHEN_TUTORIAL=null;
  if(typeof KITCHEN_POOL_CACHE!=="undefined")KITCHEN_POOL_CACHE.clear();
  if(typeof SHIFT!=="undefined"&&SHIFT){
    if(SHIFT.timer){clearInterval(SHIFT.timer);clearTimeout(SHIFT.timer);}
    if(SHIFT.patTimer)clearInterval(SHIFT.patTimer);
    SHIFT.ended=true;SHIFT=null;
  }
  if(typeof SESSION_PAUSE_REASONS!=="undefined")SESSION_PAUSE_REASONS.clear();
  document.documentElement.classList.remove("session-paused");
}

const BootCoordinator=(()=>{
  let state="idle",navigation=0,draft=null,lastFailure=null;
  const next=(value)=>{state=value;return ++navigation;};
  const current=token=>token===navigation;
  const abortNavigation=(value="profiles")=>{
    navigation++;state=value;draft=null;lastFailure=null;cancelCourseDataLoad();
  };
  const showLoading=profile=>{
    const c=coursePresentation(profile.courseId);
    show(`<section class="screen center courseload"><h1 class="logo">Word<span>Bar</span></h1><div class="coursehero">${c.icon}</div><h2>Opening ${esc(profile.name)}'s WordBar…</h2>${courseBadgeHTML(profile.courseId)}<p class="tag">getting the word books ready</p></section>`);
  };
  const activateProfile=async(index,{showProgress=true}={})=>{
    const profile=SAVE.profiles[index];if(!profile)return false;
    const token=next("loading-profile");lastFailure={kind:"profile",index,courseId:profile.courseId};
    if(showProgress)showLoading(profile);
    try{
      await loadCourseData(profile.courseId);
      if(!current(token))return false;
      if(index!==SAVE.active){
        const candidate=cloneSaveValue(SAVE);candidate.active=index;
        const committed=WordBarPersistence.persistLive(candidate);
        if(!committed.ok)throw committed.error||new Error("The selected shopkeeper could not be saved.");
        SAVE=committed.value;
      }
      state="menu";lastFailure=null;applySettings();resetProfileTransientState();screenMenu();return true;
    }catch(error){
      if(!current(token)||(error&&error.name==="AbortError"))return false;
      state="load-failure";lastFailure={kind:"profile",index,courseId:profile.courseId,error};
      screenCourseLoadFailure(lastFailure);return false;
    }
  };
  const beginDraft=courseId=>{
    if(!WORDBAR_KNOWN_COURSES.includes(courseId))return false;
    const token=next("creating-profile");
    draft={courseId,token,loadError:null,loadPromise:null};lastFailure=null;
    if(window.WordBarAnalytics)WordBarAnalytics.step("course_chosen",{course:courseId});
    draft.loadPromise=loadCourseData(courseId).catch(error=>{
      if(current(token)&&draft&&draft.token===token)draft.loadError=error;
      throw error;
    });
    /* The load deliberately continues while the child chooses a name/look. */
    draft.loadPromise.catch(()=>{});
    screenNewProfile("",courseId);return true;
  };
  const finishDraft=async profile=>{
    const live=draft;if(!live||profile.courseId!==live.courseId)return false;
    const token=live.token;
    try{
      await live.loadPromise;
      if(!current(token)||draft!==live)return false;
      const ok=finishProfileCreation(profile);
      if(ok){state="welcome";draft=null;lastFailure=null;}
      return ok;
    }catch(error){
      if(!current(token)||(error&&error.name==="AbortError"))return false;
      state="load-failure";lastFailure={kind:"draft",courseId:profile.courseId,profile,error};
      screenCourseLoadFailure(lastFailure);return false;
    }
  };
  const retryFailure=()=>{
    const failure=lastFailure;if(!failure)return false;
    if(failure.kind==="profile")return activateProfile(failure.index);
    const token=next("creating-profile");
    draft={courseId:failure.courseId,token,loadError:null,loadPromise:null};
    draft.loadPromise=retryCourseData(failure.courseId);
    draft.loadPromise.catch(()=>{});
    const profile=failure.profile;
    draft.loadPromise.then(()=>{
      if(current(token)&&draft&&draft.token===token)finishDraft(profile);
    },error=>{
      if(current(token)){state="load-failure";lastFailure={...failure,error};screenCourseLoadFailure(lastFailure);}
    });
    showLoading(profile);return true;
  };
  const cancelCreation=()=>{abortNavigation();screenProfiles();};
  const chooseCourse=()=>{abortNavigation("choosing-course");screenCourseChoice();};
  const start=()=>{
    if(SAVE.active>=0&&SAVE.profiles[SAVE.active])return activateProfile(SAVE.active);
    next("profiles");screenProfiles();return Promise.resolve(true);
  };
  return {
    start,activateProfile,beginDraft,finishDraft,retryFailure,cancelCreation,chooseCourse,
    get state(){return state;},get draftCourseId(){return draft&&draft.courseId;},
    inspect(){return {state,navigation,draftCourseId:draft&&draft.courseId,lastFailure:lastFailure&&{kind:lastFailure.kind,index:lastFailure.index,courseId:lastFailure.courseId}};}
  };
})();

function screenCourseLoadFailure(failure){
  if(window.WordBarAnalytics)WordBarAnalytics.error("course_data_failed","course_data");
  const c=coursePresentation(failure.courseId),disabled=failure.error&&failure.error.code==="COURSE_DISABLED";
  show(`<section class="screen center courseloaderror"><h1 class="logo">Word<span>Bar</span></h1><div class="coursehero">${c.icon}</div><h2>${disabled?`${esc(c.name)} isn’t available yet`:`${esc(c.name)} needs its word books`}</h2>
    <p class="note">${disabled?"Your shopkeeper and saved progress are safe. This course isn’t available yet, so please choose another course.":"WordBar could not open this course. Check your connection and try again; it will never substitute words from another course."}</p>
    <button class="felt big primary" id="retryCourse">🔄 Retry</button>
    <button class="felt" id="chooseBarista">👥 Choose another shopkeeper</button>
    ${failure.kind==="draft"?`<button class="linky" id="choosePath">← Choose another word path</button>`:""}</section>`);
  $("#retryCourse").onclick=()=>{AudioKit.tap();BootCoordinator.retryFailure();};
  $("#chooseBarista").onclick=()=>{AudioKit.tap();BootCoordinator.cancelCreation();};
  const path=$("#choosePath");if(path)path.onclick=()=>{AudioKit.tap();cancelCourseDraftToChoice();};
}

function screenCourseChoice(){
  const activeBefore=SAVE.active,profileCount=SAVE.profiles.length;
  const choices=[COURSE_IDS.elevenPlus,COURSE_IDS.everyday].map(courseId=>{
    const c=coursePresentation(courseId),available=courseId!==COURSE_IDS.everyday||WORDBAR_FEATURES.everydayEnglish;
    return `<button class="felt coursechoice course-${courseId}" data-course="${courseId}" ${available?"":"disabled"}><span class="courseicon">${c.icon}</span><b>${esc(c.name)}</b><small>${esc(c.description)}</small>${available?"":`<span class="coursegate">Not available yet</span>`}</button>`;
  }).join("");
  show(`<section class="screen center coursepick"><h1 class="logo">Word<span>Bar</span></h1><h2>Choose your word path</h2><p class="tag">Each shopkeeper has a separate course and learning progress.</p><div class="coursechoices">${choices}</div><button class="linky" id="courseBack">← back</button></section>`);
  $$('[data-course]').forEach(button=>button.onclick=()=>{AudioKit.tap();BootCoordinator.beginDraft(button.dataset.course);});
  $("#courseBack").onclick=()=>{
    /* Guard the no-partial-state contract even if future UI code changes. */
    if(SAVE.profiles.length!==profileCount||SAVE.active!==activeBefore)throw new Error("Course choice changed live save state");
    BootCoordinator.cancelCreation();
  };
}
function cancelCourseDraftToChoice(){BootCoordinator.chooseCourse();}

/* Deleting a barista is permanent and child-resistant: confirm, then
   type the barista's name exactly (same guard as progress reset). A
   pre-delete backup of the whole save is kept, like import does. */
function deleteProfile(i){
  const prof=SAVE.profiles[i];
  if(!prof) return false;
  const backup=WordBarPersistence.backup(WORDBAR_SAVE_KEYS.preDelete,SAVE);
  if(!backup.ok)return false;
  const candidate=cloneSaveValue(SAVE);
  candidate.profiles.splice(i,1);
  if(candidate.active===i) candidate.active=-1;  /* deleted the active barista */
  else if(candidate.active>i) candidate.active--;/* indices shifted down */
  if(!candidate.profiles.length) candidate.active=-1;
  const committed=WordBarPersistence.persistLive(candidate);
  if(!committed.ok){WordBarPersistence.persistLive(SAVE);return false;}
  SAVE=committed.value;
  return true;
}

function screenProfiles(){
  AudioKit.ambientStop();
  const profs=SAVE.profiles.map((p,i)=>`<div class="avrow">
    <button class="felt avcard" data-i="${i}">
    <div class="avface">${(o=>characterSVG(playerLookFor(p,o),"happy",{w:72,...o}))(playerRenderOpts(p))}</div>
    <div><b data-i18n-skip>${esc(p.name)}</b><br>${courseBadgeHTML(p.courseId)}<br><small>${p.lifetime} tips earned · ${(n=>`${n} game${n===1?"":"s"} played`)(gamesPlayed(p))}</small></div></button>
    <button class="iconb avmore" data-more="${i}" aria-label="More for ${esc(p.name)}: change look, rename or delete">•••</button>
  </div>`).join("");
  show(`<section class="screen center">
    <div class="langrow">${window.WBI18N?WBI18N.pillHTML():""}</div>
    <h1 class="logo">Word<span>Bar</span></h1><p class="tag">the little juice bar where words earn their keep</p>
    ${SAVE.profiles.length?`<h2>Who’s running WordBar today?</h2><div class="avlist">${profs}</div>`:""}
    <button class="felt big" id="newprof">+ New shopkeeper</button>
    ${!Store.persistent?`<p class="note">This browser can’t save progress right now, so it lasts for this visit only. You can still play.</p>`:""}
  </section>`);
  $$(".avcard").forEach(b=>b.onclick=()=>{AudioKit.unlock();AudioKit.tap();BootCoordinator.activateProfile(+b.dataset.i);});
  /* S9c: ••• → Change look · Rename · Delete (in-app sheets, no browser pop-ups) */
  $$(".avmore").forEach(b=>b.onclick=(e)=>{e.stopPropagation();AudioKit.tap();profileMoreSheet(+b.dataset.more);});
  $("#newprof").onclick=()=>{AudioKit.unlock();AudioKit.tap();BootCoordinator.chooseCourse();};
  if(window.WBI18N)WBI18N.bind(app);   /* S11a: EN | 繁 | 简 also on the first screen */
}
/* Shared tail of profile creation: push, activate, and greet — used by
   both the preset picker and the customizer so the two paths can never
   drift apart. */
function finishProfileCreation(profile){
  const candidate=cloneSaveValue(SAVE);
  candidate.profiles.push(profile);candidate.active=candidate.profiles.length-1;
  const committed=WordBarPersistence.persistLive(candidate);
  if(!committed.ok){toast("We couldn’t save this shopkeeper. Free up some browser storage and try again.");return false;}
  SAVE=committed.value;applySettings();resetAdaptiveState();
  if(window.WordBarAnalytics)WordBarAnalytics.step("profile_created",{course:profile.courseId,difficulty:wbAnalyticsDifficulty(profile.settings&&profile.settings.diff)});
  /* Build 67: every new barista reaches the main menu before any game
     starts. This makes Kitchen and the other modes visible on the first
     visit instead of silently launching a Normal shift. */
  /* S9f: Maya (a café regular) welcomes new players. Tap her to change her face. */
  const maya=(CUSTOMERS.find(c=>c.id==="maya")||{}).look||{skin:"#C98A55",hair:"#2A2438",hairstyle:"curls",top:"#6BC5B8",accessory:"headphones"};
  show(`<section class="screen center welcome-screen"><button type="button" class="curator hostmaya" id="hostMaya" aria-label="Maya — tap to see her face change">${characterSVG(maya,"happy",{w:110})}</button>
    <div class="bubble big">“Welcome to your very own WordBar! I'm <b>Maya</b>. You're the shopkeeper here: serve customers by solving their word puzzles — great answers make great drinks, and great drinks earn <b>tips</b>. Here's <b>120 tips</b> to start you off. First, take a look around your main menu and choose what you would like to play.”</div>
    <button class="felt big" id="start">Go to my WordBar</button></section>`);
  $("#start").onclick=()=>{AudioKit.tap();screenMenu();};
  const faces=["happy","delighted","wow","thinking"];let fi=0;
  const host=$("#hostMaya");
  host.onclick=()=>{fi=(fi+1)%faces.length;AudioKit.tap();host.innerHTML=characterSVG(maya,faces[fi],{w:110});
    host.classList.remove("hop");void host.offsetWidth;host.classList.add("hop");};
  return true;
}

function screenNewProfile(prefillName="",courseId=BootCoordinator.draftCourseId||COURSE_IDS.elevenPlus){
  /* Slot 1 (top-left) is the Customizer; retired presets are hidden
     from NEW baristas but still render for existing saves. Grid stays
     3x3: 1 customize tile + 8 presets. */
  const roster=AVATARS.filter(a=>!a.retired);
  show(`<section class="screen center pickscreen"><h2>Choose your shopkeeper</h2>
   <div class="avgrid">
     <button class="felt avpick custpick" data-id="__custom"><div class="custart">🎨</div><b>Create your own!</b><small>pick hair, clothes &amp; more</small></button>
     ${roster.map(a=>`<button class="felt avpick" data-id="${a.id}"><div>${characterSVG(a.look,"happy",{w:56})}</div><b>${a.name}</b><small>${a.blurb}</small></button>`).join("")}</div>
   <div class="namebox"><label>Your shopkeeper's name:<br><input id="pname" maxlength="14" value="${esc(prefillName||"")}" placeholder="e.g. ${roster[Math.floor(Math.random()*roster.length)].name}"></label></div>
   <button class="felt big" id="go" disabled>Open the bar! 🍹</button>
   <button class="linky" id="back">← back</button></section>`);
  let chosen=null;
  $$(".avpick").forEach(b=>b.onclick=()=>{AudioKit.tap();
     if(b.dataset.id==="__custom"){ screenCustomize($("#pname").value.trim(),courseId); return; }
    $$(".avpick").forEach(x=>x.classList.remove("sel"));b.classList.add("sel");chosen=b.dataset.id;check();});
  const check=()=>{$("#go").disabled=!(chosen&&$("#pname").value.trim());};
  $("#pname").oninput=check;
  $("#back").onclick=()=>cancelCourseDraftToChoice();
  $("#go").onclick=()=>{AudioKit.tap();
    const input=$("#pname"),name=input.value.trim();input.blur();
    requestAnimationFrame(()=>BootCoordinator.finishDraft(newProfile(name,chosen,courseId)));};
}

/* ---- Avatar customizer (one-time, at creation) ----
   Every category is single-select, which is what makes combinations
   conflict-free by construction: one skin, one hair colour, one of the
   fifteen NATURAL hairstyles, lashes on/off, one clothing style rendered
   in one of the five wardrobe tones, and optional glasses (the same
   baked-in accessory mechanism story characters use). Shop wearables
   and the apron layer on top later exactly as they do for presets. */
function screenCustomize(prefillName,courseId=BootCoordinator.draftCourseId||COURSE_IDS.elevenPlus,edit=null){
  const C=CUSTOMIZER;
  /* S9c: edit mode ("Change look") reuses this screen for an existing
     barista: no name box, a Wardrobe tab instead of Outfit, 🎲 Surprise me / ↩ Old
     look, and Save look / Cancel with Undo.
     S10d: the Wardrobe tab starts with the free clothing style and colour
     again (as when the barista was created), then the Shop items. */
  const editing=!!edit;
  const editProf=editing?SAVE.profiles[edit.index]:null;
  if(editing&&!editProf){screenProfiles();return;}
  let activeCat="hair";
  const look=editing?editableLookFrom(editProf):{skin:"#E8B88A",hair:C.hairs[0][0],hairstyle:"flop",eyeShape:"round",lashes:true,iris:"#6E4A2E",
    top:C.tops[0][0],accessory:"none",facialHair:"none",garment:{style:"tee"}};
  /* S9e: new face options, with defaults that keep today's look */
  if(!C.lashStyles.some(([id])=>id===look.lashStyle))look.lashStyle=(look.faceFix&&!look.eyeShape?look.faceFix.lashes:look.lashes)?"classic":"none";
  if(!C.brows.some(([id])=>id===look.brows))look.brows="natural";
  if(!C.cheeks.some(([id])=>id===look.cheeks))look.cheeks="plain";
  if(!C.glassesColors.some(([id])=>id===look.glassesColor))look.glassesColor=C.glassesColors[0][0];
  if(!C.hijabColors.some(([id])=>id===look.hijab))look.hijab=C.hijabColors[0][0];
  const origFace=look.faceFix?{...look.faceFix}:null;
  let wear=editing?JSON.parse(JSON.stringify(editProf.placed&&editProf.placed.avatar||{})):null;
  const startLook=JSON.parse(JSON.stringify(look)),startWear=JSON.stringify(wear);
  const dirty=()=>editing&&(JSON.stringify(look)!==JSON.stringify(startLook)||JSON.stringify(wear)!==startWear);
  /* "Original" swatches keep a ready-made barista's own colours. */
  const withOriginal=(list,value)=>value&&!list.some(([v])=>v===value)?[[value,"Original"],...list]:list;
  const skinList=withOriginal(C.skins.map((x,i)=>[x,`Skin tone ${i+1}`]),look.skin);
  const hairList=withOriginal(C.hairs,look.hair);
  const irisList=withOriginal(C.eyeColors,look.iris);
  const topList=withOriginal(C.tops,look.top);
  const labelFor=(list,value,fallback="")=>{const x=list.find(([id])=>id===value);return x?x[1]:fallback;};
  const titleCase=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const hairLabel=h=>({buzz:"Buzz cut",shortquiff:"Short quiff",bald:"Bald",ponytail:"Ponytail",longwave:"Long waves",twinbraids:"Twin braids",
    afro:"Afro",pixie:"Pixie cut",spacebuns:"Space buns",sidebraid:"Side braid",topknot:"Top knot",cornrows:"Cornrows",locs:"Short locs",longstraight:"Long straight",curtains:"Curtains",spiky:"Spiky",waves:"Shoulder waves",fauxhawk:"Faux hawk",hijab:"Hijab"}[h]||titleCase(h));
  const sw=(cat,val,label,cur)=>`<button type="button" class="swatch colorchoice ${val===cur?"sel":""}" data-cat="${cat}" data-v="${esc(val)}" style="--choice:${val}" aria-label="${esc(label)}" title="${esc(label)}"><span>${esc(label)}</span></button>`;
  const chip=(cat,val,label,cur,extra="")=>`<button type="button" class="felt chip ${extra} ${val===cur?"sel":""}" data-cat="${cat}" data-v="${esc(val)}">${esc(label)}</button>`;
  const lashChip=(val,label,cur)=>{
    const L={classic:'<path d="M9 5 L7.4 2.6 M12.6 3.8 L12 1.2" stroke="#463A54" stroke-width="1.4" stroke-linecap="round"/><path d="M21 5 L22.6 2.6 M17.4 3.8 L18 1.2" stroke="#463A54" stroke-width="1.4" stroke-linecap="round"/>',
      short:'<path d="M9 5 L8.2 3.8 M12.6 3.8 L12.3 2.5 M21 5 L21.8 3.8 M17.4 3.8 L17.7 2.5" stroke="#463A54" stroke-width="1.3" stroke-linecap="round"/>',
      long:'<path d="M8.2 5.8 L5.6 2.6 M11 4.2 L9.6 .8 M14 3.6 L13.6 .2 M21.8 5.8 L24.4 2.6 M19 4.2 L20.4 .8 M16 3.6 L16.4 .2" stroke="#463A54" stroke-width="1.3" stroke-linecap="round"/>',
      flick:'<path d="M6.4 9.4 Q3.8 8.8 2.6 6.2 M23.6 9.4 Q26.2 8.8 27.4 6.2" stroke="#463A54" stroke-width="1.5" fill="none" stroke-linecap="round"/>',none:""}[val]||"";
    return `<button type="button" class="felt chip lashchip ${val===cur?"sel":""}" data-cat="lash" data-v="${val}" aria-label="${esc(label)}">
    <svg viewBox="0 0 30 18" width="28" height="17" aria-hidden="true"><ellipse cx="15" cy="10" rx="9" ry="6.5" fill="#FFF" stroke="#463A54" stroke-width="1.6"/><circle cx="15" cy="10" r="3" fill="#463A54"/>${L}</svg><span>${esc(label)}</span></button>`;};
  const browChip=(val,label,cur)=>{
    const d={natural:'M4 12 Q13 5 22 9',thin:'M4 12 Q13 5 22 9',thick:'M5 12 Q13 5 21 9',arched:'M4 12 Q12 1.5 22 9',straight:'M4 10.5 Q13 8.6 22 9.6'}[val];
    const w={natural:2.4,thin:1.4,thick:3.8,arched:2.4,straight:2.4}[val];
    return `<button type="button" class="felt chip browchip ${val===cur?"sel":""}" data-cat="brows" data-v="${val}"><svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true"><path d="${d}" stroke="#463A54" stroke-width="${w}" fill="none" stroke-linecap="round"/></svg><span>${esc(label)}</span></button>`;};
  const eyeChip=(val,label,cur)=>{
    const E={round:'<ellipse cx="15" cy="10" rx="10" ry="6.2" fill="#FFF" stroke="#463A54" stroke-width="1.6"/>',
      tall:'<ellipse cx="15" cy="10" rx="10" ry="7.4" fill="#FFF" stroke="#463A54" stroke-width="1.6"/>',
      almond:'<path d="M4 10 Q15 4.7 26 10 Q15 15.3 4 10 Z" fill="#FFF" stroke="#463A54" stroke-width="1.6"/>',
      sleepy:'<path d="M5 10 Q15 6.4 25 10 Q15 17.6 5 10 Z" fill="#FFF" stroke="#463A54" stroke-width="1.6"/><path d="M5.6 9.6 Q15 6.2 24.4 9.6" stroke="#463A54" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
      wide:'<ellipse cx="15" cy="10" rx="10.6" ry="8" fill="#FFF" stroke="#463A54" stroke-width="1.6"/>',
      upturned:'<path d="M4 11.6 Q13 3.4 26 7.2 Q16 16.4 4 11.6 Z" fill="#FFF" stroke="#463A54" stroke-width="1.6"/>'}[val]||"";
    const irisR=val==="almond"?1.85:val==="wide"?3.6:val==="sleepy"||val==="upturned"?2.3:3;
    const cy=val==="sleepy"?11:val==="upturned"?10:10;
    return `<button type="button" class="felt chip eyechip ${val===cur?"sel":""}" data-cat="eyeShape" data-v="${val}" aria-label="${esc(label)} eyes"><svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true">${E}<circle data-eye-iris cx="15" cy="${cy}" r="${irisR}" fill="${look.iris}"/><circle cx="15" cy="${cy}" r="${(irisR*.6).toFixed(2)}" fill="#241D33"/><circle cx="15.5" cy="${cy-.6}" r=".55" fill="#FFF"/></svg><span>${esc(label)}</span></button>`;
  };
  const glassChip=(val,label,cur)=>{
    const st='fill="none" stroke="#463A54" stroke-width="2"';
    const G={glasses:`<circle cx="11" cy="10" r="7" ${st}/><circle cx="31" cy="10" r="7" ${st}/>`,
      glasses_square:`<rect x="3" y="4" width="15" height="12" rx="2" ${st}/><rect x="24" y="4" width="15" height="12" rx="2" ${st}/>`,
      glasses_oval:`<ellipse cx="11" cy="10" rx="8" ry="5.6" ${st}/><ellipse cx="31" cy="10" rx="8" ry="5.6" ${st}/>`,
      glasses_cateye:`<path d="M4 10 Q4 15.5 11 15.5 Q18 15.5 18 9.6 L19.4 3.4 Q10 4.6 5 6.4 Q4 8 4 10 Z" ${st}/><path d="M38 10 Q38 15.5 31 15.5 Q24 15.5 24 9.6 L22.6 3.4 Q32 4.6 37 6.4 Q38 8 38 10 Z" ${st}/>`,
      glasses_halfrim:`<path d="M3 9 L3 6 Q3 4 5 4 L16 4 Q18 4 18 6 L18 9 M24 9 L24 6 Q24 4 26 4 L37 4 Q39 4 39 6 L39 9" fill="none" stroke="#463A54" stroke-width="2.8"/><rect x="3" y="4" width="15" height="12" rx="2.4" fill="none" stroke="#463A54" stroke-width="1" opacity=".5"/><rect x="24" y="4" width="15" height="12" rx="2.4" fill="none" stroke="#463A54" stroke-width="1" opacity=".5"/>`,
      glasses_biground:`<circle cx="11" cy="10" r="8.6" ${st}/><circle cx="31" cy="10" r="8.6" ${st}/>`,
      glasses_rect:`<rect x="2.5" y="6" width="16" height="9" rx="1.4" ${st}/><rect x="23.5" y="6" width="16" height="9" rx="1.4" ${st}/>`}[val];
    const art=val==="none"?`<span class="noglasses">—</span>`:`<svg viewBox="0 0 42 20" width="38" height="20" aria-hidden="true">${G}<path d="M18 10 H24" stroke="#463A54" stroke-width="2"/></svg>`;
    return `<button type="button" class="felt chip glasschip ${val===cur?"sel":""}" data-cat="accessory" data-v="${val}">${art}<span>${esc(label)}</span></button>`;
  };
  const categories=[
    ["hair","✂️","Hair"],
    ["eyes","👁️","Eyes"],
    ["face","🙂","Face"],
    ["glasses","👓","Glasses"],
    editing?["wardrobe","👗","Wardrobe"]:["outfit","👕","Outfit"]
  ];
  const group=(step,title,content,cls="")=>`<div class="optgroup ${cls}"><small><b>${step}</b> ${title}</small><div class="swrow">${content}</div></div>`;
  function tabs(){ return `<div class="custtabs" role="tablist" aria-label="Avatar options">${categories.map(([id,ico,label])=>`<button type="button" class="custtab ${id===activeCat?"on":""}" data-custom-tab="${id}" role="tab" aria-selected="${id===activeCat}"><span>${ico}</span><small>${label}</small></button>`).join("")}</div>`; }
  const eyeValue=()=>look.eyeShape||(look.faceFix?"__orig":"round");
  const lashValue=()=>look.lashStyle||"classic";
  function wardrobePanel(){
    const owned=wardrobeItemsFor(editProf);
    if(!owned.length)return `<div class="wardrobeempty"><b>Nothing here yet</b><small>Buy clothes and accessories in the Shop 🛍️, then wear them here.</small>${editProf===P()?`<button type="button" class="felt mini" id="wardShop">Go to the Shop</button>`:""}</div>`;
    const groups=[];
    owned.forEach(it=>{const g=wardrobeSlotLabel(it.slot);let row=groups.find(x=>x[0]===g);if(!row){row=[g,[]];groups.push(row);}row[1].push(it);});
    return `<p class="wardnote">Tap to wear · tap again to take it off</p>`+groups.map(([g,items])=>wardGroup(esc(g),items.map(it=>`<button type="button" class="felt chip wearchip ${wear[it.slot]===it.id?"sel":""}" data-wear="${esc(it.id)}" aria-pressed="${wear[it.slot]===it.id}"><span class="weardot" style="background:${esc(it.c||"#ccc")}"></span>${esc(it.name)}</button>`).join(""))).join("");
  }
  /* clothing style + colour, used when creating and in Change look (S10d) */
  const garmentLabel=g=>g==="tee"?"T-shirt":g==="polo"?"Polo shirt":"Shirt";
  const clothesGroups=()=>`${group("1","Choose clothing style",C.garments.map(g=>chip("garment",g,garmentLabel(g),selectedValue("garment"),"garmentchip")).join(""),"garmentgroup")}
        ${group("2",`Choose clothing colour · <span data-choice-label="top">${esc(clothesColourLabel())}</span>`,topList.map(([x,n])=>sw("top",x,n,selectedValue("top"))).join(""),"colourgroup")}`;
  const wardGroup=(title,content)=>`<div class="optgroup weargroup"><small class="weartitle">${title}</small><div class="swrow">${content}</div></div>`;
  function rows(){
    const lashNow=lashValue();
    return `<div class="custpanels">
      <div class="custrow" data-panel="hair">
        ${group("1","Choose a hairstyle",C.hairstyles.map(h=>chip("hairstyle",h,hairLabel(h),look.hairstyle,"stylechip")).join(""),"stylegroup")}
        ${group("2",`Choose a hair colour · <span data-choice-label="hair">${esc(labelFor(hairList,look.hair,"Colour"))}</span>`,hairList.map(([x,n])=>sw("hair",x,n,look.hair)).join(""),"colourgroup")}
        <div data-hijab-group ${look.hairstyle==="hijab"?"":"hidden"}>${group("3",`Choose a hijab colour · <span data-choice-label="hijab">${esc(labelFor(C.hijabColors,look.hijab,"Colour"))}</span>`,C.hijabColors.map(([x,n])=>sw("hijab",x,n,look.hijab)).join(""),"colourgroup")}</div>
      </div>
      <div class="custrow" data-panel="eyes" hidden>
        ${group("1","Choose an eye shape",(origFace?`<button type="button" class="felt chip eyechip ${eyeValue()==="__orig"?"sel":""}" data-cat="eyeShape" data-v="__orig" aria-label="Original eyes"><span class="origeye">★</span><span>Original</span></button>`:"")+C.eyeShapes.map(([id,n])=>eyeChip(id,n,eyeValue())).join(""),"eyeshapegroup"+(origFace?" hasorig":""))}
        ${group("2",`Choose an eye colour · <span data-choice-label="iris">${esc(labelFor(irisList,look.iris,"Brown"))}</span>`,irisList.map(([x,n])=>sw("iris",x,n,look.iris)).join(""),"colourgroup")}
        ${group("3","Choose eyelashes",C.lashStyles.map(([id,n])=>lashChip(id,n,lashNow)).join(""),"lashgroup")}
      </div>
      <div class="custrow" data-panel="face" hidden>
        ${group("1","Choose a skin tone",skinList.map(([x,n])=>sw("skin",x,n,look.skin)).join(""),"colourgroup")}
        ${group("2","Choose eyebrows",C.brows.map(([id,n])=>browChip(id,n,look.brows)).join(""),"browgroup")}
        ${group("3","Choose cheeks",C.cheeks.map(([id,n])=>chip("cheeks",id,n,look.cheeks,"stylechip")).join(""),"cheekgroup")}
        ${group("4","Choose facial hair",C.facialHair.map(([id,n])=>chip("facialHair",id,n,look.facialHair,"stylechip")).join(""),"stylegroup")}
      </div>
      <div class="custrow" data-panel="glasses" hidden>
        ${group("1","Choose glasses",C.accessories.map(([id,n])=>glassChip(id,n,look.accessory)).join(""),"glassgroup")}
        <div data-frame-group ${look.accessory&&look.accessory!=="none"?"":"hidden"}>${group("2",`Choose a frame colour · <span data-choice-label="frame">${esc(labelFor(C.glassesColors,look.glassesColor,"Black"))}</span>`,C.glassesColors.map(([x,n])=>sw("glassesColor",x,n,look.glassesColor)).join(""),"colourgroup")}</div>
      </div>
      ${editing?`<div class="custrow" data-panel="wardrobe" hidden>${clothesGroups()}<div class="wardshop"><div class="optgroup wardshophead"><small><b>3</b> From the Shop</small></div>${wardrobePanel()}</div></div>`:`<div class="custrow" data-panel="outfit" hidden>
        ${clothesGroups()}
      </div>`}
    </div>`;
  }
  /* the hijab colour only applies to the hijab (other styles use that
     slot for hair-tie colours) */
  const renderLook=()=>({...look,hijab:look.hairstyle==="hijab"?look.hijab:undefined});
  function previewSVG(){
    if(!editing)return characterSVG(renderLook(),"happy",{w:130});
    return wardrobePreviewSVG(renderLook(),wear,130);
  }
  function draw(){
    const who=editing?esc(editProf.name):"";
    show(`<section data-i18n-scope="look" class="screen center pickscreen customize-screen ${editing?"editlook-screen":""}"><h2>${editing?`Change ${who}’s look`:"Create your shopkeeper"}</h2>
      <div class="custintro">${editing?"Nothing changes until you tap Save look.":"Pick a style first, then choose its colour."}</div>
      ${tabs()}${rows()}
      <div class="custstage" aria-label="Live shopkeeper preview"><div class="custpreview">${previewSVG()}</div>
        ${editing?`<button type="button" class="felt mini stagebtn surprise" id="surprise">🎲 Surprise me</button><button type="button" class="felt mini stagebtn oldlook" id="oldLook">↩ Old look</button>`:""}</div>
      ${editing?`<div class="custfooter"><div class="custactions"><button class="linky" id="back">Cancel</button><button class="felt big primary" id="go">Save look</button></div></div>`
      :`<div class="custfooter"><div class="namebox"><label>Your shopkeeper's name: <input id="pname" maxlength="14" value="${esc(prefillName||"")}" placeholder="e.g. Sam" autocomplete="off"></label></div>
      <div class="custactions"><button class="linky" id="back">← back</button><button class="felt big primary" id="go" ${(prefillName||"").trim()?"":"disabled"}>Open the bar! 🍹</button></div></div>`}</section>`);
    wire();
    if(editing){WB_NAV.onBack=()=>leave();
      /* opened from "Who's serving today?" with no barista active: that
         screen is the root, so add a back step for the editor */
      if(!P()){if(WB_NAV.expectPop>0)WB_NAV.pendingPush=true;else wbPushScreen();}}
  }
  function showPanel(cat){
    activeCat=cat;
    $$('[data-custom-tab]').forEach(b=>{const on=b.dataset.customTab===cat;b.classList.toggle("on",on);b.setAttribute("aria-selected",String(on));});
    $$('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==cat);
    /* eyes, face and glasses are small: the preview zooms in on the head */
    const st=$(".custstage");if(st)st.classList.toggle("zoom-face",["eyes","face","glasses"].includes(cat));
    const panels=$(".custpanels");if(panels)panels.scrollTop=0;
  }
  /* a worn Shop clothing item / dye is what the barista shows, so the free
     choice is shown unselected while one is worn */
  const shopWorn=slot=>!!(wear&&wear[slot]);
  function clothesColourLabel(){
    if(shopWorn("garment_color")){const it=SHOP.find(x=>x.id===wear.garment_color);return it?it.name:"Colour";}
    return labelFor(topList,look.top,"Colour");
  }
  function selectedValue(cat){
    if(cat==="garment")return shopWorn("garment_style")?null:look.garment.style;
    if(cat==="top"&&shopWorn("garment_color"))return null;
    if(cat==="lash")return lashValue();
    if(cat==="eyeShape")return eyeValue();
    return look[cat];
  }
  function refresh(){
    const pv=$(".custpreview");if(pv)pv.innerHTML=previewSVG();
    $$(".custpanels [data-cat][data-v]").forEach(b=>{
      const on=String(selectedValue(b.dataset.cat))===b.dataset.v;
      b.classList.toggle("sel",on);b.setAttribute("aria-pressed",String(on));
    });
    $$(".custpanels [data-wear]").forEach(b=>{const it=SHOP.find(x=>x.id===b.dataset.wear);const on=!!it&&wear[it.slot]===it.id;b.classList.toggle("sel",on);b.setAttribute("aria-pressed",String(on));});
    const hairLabelEl=$("[data-choice-label='hair']");if(hairLabelEl)hairLabelEl.textContent=labelFor(hairList,look.hair,"Colour");
    const eyeLabel=$("[data-choice-label='iris']");if(eyeLabel)eyeLabel.textContent=labelFor(irisList,look.iris,"Brown");
    const topLabel=$("[data-choice-label='top']");if(topLabel)topLabel.textContent=clothesColourLabel();
    const hijLabel=$("[data-choice-label='hijab']");if(hijLabel)hijLabel.textContent=labelFor(C.hijabColors,look.hijab,"Colour");
    const frLabel=$("[data-choice-label='frame']");if(frLabel)frLabel.textContent=labelFor(C.glassesColors,look.glassesColor,"Black");
    const hg=$("[data-hijab-group]");if(hg)hg.hidden=look.hairstyle!=="hijab";
    const fg=$("[data-frame-group]");if(fg)fg.hidden=!look.accessory||look.accessory==="none";
    $$("[data-eye-iris]").forEach(x=>x.setAttribute("fill",look.iris));
  }
  function setEyeShape(v){
    if(v==="__orig"){if(origFace){look.faceFix={...origFace};delete look.eyeShape;look.lashes=!!origFace.lashes;}return;}
    if(look.faceFix){look.lashes=!!look.faceFix.lashes;delete look.faceFix;}
    look.eyeShape=v;
  }
  function wireChoices(){
    const panels=$(".custpanels");if(!panels)return;
    panels.addEventListener("click",e=>{
      const w=e.target.closest("[data-wear]");
      if(w&&panels.contains(w)){AudioKit.tap();const it=SHOP.find(x=>x.id===w.dataset.wear);if(it){const off=toggleShopPlacement(wear,it);if(off.length)toast(overlapNote(it,off));}refresh();return;}
      const b=e.target.closest("[data-cat][data-v]");if(!b||!panels.contains(b))return;
      AudioKit.tap();const cat=b.dataset.cat,v=b.dataset.v;
      if(cat==="skin")look.skin=v; else if(cat==="hair")look.hair=v;
      else if(cat==="hairstyle")look.hairstyle=v; else if(cat==="eyeShape")setEyeShape(v);
      else if(cat==="iris")look.iris=v;
      else if(cat==="top"||cat==="garment"){
        /* S10d: a free choice takes off the Shop item that would hide it */
        const slot=cat==="top"?"garment_color":"garment_style";
        if(shopWorn(slot)){const it=SHOP.find(x=>x.id===wear[slot]);delete wear[slot];if(it)toast(`Took off ${it.name}.`);}
        if(cat==="top")look.top=v;else look.garment.style=v;}
      else if(cat==="accessory")look.accessory=v; else if(cat==="facialHair")look.facialHair=v;
      else if(cat==="lash"){look.lashStyle=v;look.lashes=(v!=="none");if(look.faceFix)look.faceFix={...look.faceFix,lashes:look.lashes};}
      else if(cat==="brows")look.brows=v; else if(cat==="cheeks")look.cheeks=v;
      else if(cat==="glassesColor")look.glassesColor=v; else if(cat==="hijab")look.hijab=v;
      refresh();
    });
  }
  /* ---- edit mode: leave / save ---- */
  function goOrigin(){WB_NAV.onBack=null;const from=edit.from;
    if(from==="menu"&&P())screenMenu();else if(from==="settings"&&P())screenSettings();else if(from==="shop"&&P())screenShop(WB_SHOP_TAB||"My Items");else screenProfiles();}
  function leave(then){
    if(!dirty()){(then||goOrigin)();return;}
    wbActionSheet({title:"Discard changes?",subtitle:"Your new look hasn’t been saved.",cancelLabel:"Keep editing",
      actions:[{label:"Discard changes",danger:true,onClick:()=>(then||goOrigin)()}]});
  }
  function save(){
    const i=SAVE.profiles.indexOf(editProf);
    if(i<0){toast("That shopkeeper is no longer here — nothing was changed.");goOrigin();return;}
    if(!dirty()){goOrigin();return;}
    const before={avatar:editProf.avatar,customLook:editProf.customLook?JSON.parse(JSON.stringify(editProf.customLook)):undefined,
      placed:JSON.parse(JSON.stringify(editProf.placed.avatar||{}))};
    editProf.avatar="custom";editProf.customLook=customLookFromDraft(look);editProf.placed.avatar=JSON.parse(JSON.stringify(wear));
    if(!persist()){restoreLook(editProf,before);toast("The new look could not be saved. Free browser storage and try again.");return;}
    if(editProf===P()){try{celebrateAchievements(checkAchievements());}catch(e){}}
    goOrigin();
    toast("New look saved ✓",{label:"Undo",action:()=>{if(SAVE.profiles.indexOf(editProf)<0)return;restoreLook(editProf,before);persist();rerenderLookScreens();toast("Old look is back.");}});
  }
  function surprise(){
    const r=a=>a[Math.floor(Math.random()*a.length)];
    if(look.faceFix){look.lashes=!!look.faceFix.lashes;delete look.faceFix;}
    /* a hijab is a personal choice: Surprise me keeps it if worn and never adds it */
    if(look.hairstyle!=="hijab")look.hairstyle=r(C.hairstyles.filter(h=>h!=="hijab"));
    look.hair=r(C.hairs)[0];look.eyeShape=r(C.eyeShapes)[0];look.iris=r(C.eyeColors)[0];
    look.lashStyle=r(C.lashStyles)[0];look.lashes=look.lashStyle!=="none";look.skin=r(C.skins);
    look.brows=Math.random()<.5?"natural":r(C.brows)[0];look.cheeks=Math.random()<.5?"plain":r(C.cheeks)[0];
    look.accessory=Math.random()<.3?r(C.accessories.filter(([id])=>id!=="none"))[0]:"none";look.glassesColor=r(C.glassesColors)[0];
    look.facialHair=Math.random()<.2?r(C.facialHair.filter(([id])=>id!=="none"))[0]:"none";
    look.top=r(C.tops)[0];look.garment={...(look.garment||{}),style:r(C.garments)};   /* S10d: free clothes join in */
    /* S9f: the whole wardrobe joins in. For every place the barista owns
       items for (hat, clips, headset/pencil, sunglasses, earrings, neck,
       apron, clothes, clothes colour, cape, wrists, belt, badge) it wears
       one of them about half the time, otherwise nothing. Items are put on
       with the normal overlap rule, so overlapping pairs never happen. */
    const own=wardrobeItemsFor(editProf),slots=[...new Set(own.map(i=>i.slot))];
    const next={};
    slots.sort(()=>Math.random()-.5).forEach(slot=>{if(Math.random()<.5)return;
      const it=r(own.filter(i=>i.slot===slot));if(it)wearShopItem(next,it);});
    wear=next;
    refresh();
  }
  function wire(){
    $$('[data-custom-tab]').forEach(b=>b.onclick=()=>{AudioKit.tap();showPanel(b.dataset.customTab);});
    wireChoices();
    if(editing){
      $("#back").onclick=()=>{AudioKit.tap();leave();};
      $("#go").onclick=()=>{AudioKit.tap();save();};
      $("#surprise").onclick=()=>{AudioKit.tap();surprise();};
      $("#oldLook").onclick=()=>{AudioKit.tap();
        Object.keys(look).forEach(k=>delete look[k]);Object.assign(look,JSON.parse(JSON.stringify(startLook)));
        wear=JSON.parse(startWear);refresh();};
      const shopBtn=$("#wardShop");if(shopBtn)shopBtn.onclick=()=>{AudioKit.tap();
        leave(()=>{WB_NAV.onBack=null;if(editProf===P())screenShop("Starter");else goOrigin();});};
      return;
    }
    const check=()=>{$("#go").disabled=!$("#pname").value.trim();};
    $("#pname").oninput=check;
    $("#back").onclick=()=>screenNewProfile($("#pname").value.trim(),courseId);
    $("#go").onclick=()=>{AudioKit.tap();
      const input=$("#pname"),name=input.value.trim();input.blur();
      requestAnimationFrame(()=>{
        const p=newProfile(name,"custom",courseId);
        p.customLook=customLookFromDraft(look);
        BootCoordinator.finishDraft(p);
      });};
  }
  draw();
}

const AVATAR_QA_REQUESTED=typeof location!=="undefined"&&new URLSearchParams(location.search||"").get("qa")==="avatar";
let AVATAR_QA_TAB="hair";
function avatarQABase(){return {skin:CUSTOMIZER.skins[2],hair:CUSTOMIZER.hairs[1][0],hairstyle:"crop",top:CUSTOMIZER.tops[0][0],garment:{style:"tee"},eyeShape:"round",iris:CUSTOMIZER.eyeColors[1][0],lashes:true,accessory:"none",facialHair:"none"};}
function avatarQACases(tab){
  const C=CUSTOMIZER,b=avatarQABase(),out=[];
  if(tab==="hair")C.hairstyles.forEach((h,i)=>out.push({name:h,look:{...b,skin:C.skins[i%C.skins.length],hair:C.hairs[i%C.hairs.length][0],hairstyle:h,eyeShape:C.eyeShapes[i%C.eyeShapes.length][0],iris:C.eyeColors[i%C.eyeColors.length][0]}}));
  if(tab==="palette")C.skins.forEach((skin,si)=>C.hairs.forEach(([hair,hn],hi)=>out.push({name:`Skin ${si+1} · ${hn}`,look:{...b,skin,hair,hairstyle:C.hairstyles[(si*C.hairs.length+hi)%C.hairstyles.length]}})));
  if(tab==="eyes")C.eyeShapes.forEach(([shape,sn])=>C.eyeColors.forEach(([iris,en],i)=>out.push({name:`${sn} · ${en}`,look:{...b,eyeShape:shape,iris,lashes:i%2===0,accessory:C.accessories[i%C.accessories.length][0]}})));
  if(tab==="face")C.facialHair.forEach(([fh,fn],i)=>["bald","crop","longwave","twinbraids"].forEach((h,j)=>out.push({name:`${fn} · ${h}`,look:{...b,facialHair:fh,hairstyle:h,hair:C.hairs[(i+j)%C.hairs.length][0],skin:C.skins[(i+j)%C.skins.length],accessory:C.accessories[(i+j)%C.accessories.length][0]}})));
  if(tab==="outfit")C.garments.forEach((style,si)=>C.tops.forEach(([top,tn],i)=>out.push({name:`${style} · ${tn}`,look:{...b,top,garment:{style},hairstyle:C.hairstyles[(si*5+i)%C.hairstyles.length],skin:C.skins[(si+i)%C.skins.length]}})));
  return out;
}
function avatarQAAllCases(){return ["hair","palette","eyes","face","outfit"].flatMap(avatarQACases);}
function avatarQARunChecks(){
  const cases=avatarQAAllCases();let bad=0;const errors=[];
  cases.forEach((c,i)=>{try{const svg=characterSVG(c.look,"happy",{w:82});if(!svg.startsWith("<svg")||/undefined|NaN|\[object Object\]/.test(svg)){bad++;errors.push(`${i+1}: ${c.name}`);}}catch(e){bad++;errors.push(`${i+1}: ${c.name} (${e.message})`);}});
  return {total:cases.length,bad,errors};
}
function screenAvatarQA(tab=AVATAR_QA_TAB){
  AVATAR_QA_TAB=["hair","palette","eyes","face","outfit"].includes(tab)?tab:"hair";const cases=avatarQACases(AVATAR_QA_TAB),check=avatarQARunChecks();
  const names={hair:"Hairstyles",palette:"Skin × hair",eyes:"Eyes & glasses",face:"Facial hair",outfit:"Outfits"};
  show(`<section class="screen avatarqa"><div class="topbar"><button class="iconb" id="qaBack">←</button><b>Avatar visual QA</b><span class="pill">${check.total} cases</span></div>
    <div class="note"><b>${check.bad?`⚠ ${check.bad} renderer failures`:`✓ All ${check.total} automated renderer checks passed`}</b><br><small>Every customizer option is covered in a deterministic visual matrix; pairwise combinations catch layering and colour regressions without rendering the full Cartesian product.</small></div>
    <div class="tabbar avatarqatabs">${Object.entries(names).map(([id,n])=>`<button class="tab ${id===AVATAR_QA_TAB?"on":""}" data-avatar-qa="${id}">${n}</button>`).join("")}</div>
    <div class="avatarqagrid">${cases.map(c=>`<article class="felt avatarqatile"><div>${characterSVG(c.look,"happy",{w:82})}</div><small>${esc(c.name)}</small></article>`).join("")}</div>
    ${check.errors.length?`<div class="note"><small>${check.errors.slice(0,12).map(esc).join("<br>")}</small></div>`:""}</section>`);
  $("#qaBack").onclick=()=>{const u=new URL(location.href);u.searchParams.delete("qa");location.href=u.toString();};
  $$('[data-avatar-qa]').forEach(b=>b.onclick=()=>screenAvatarQA(b.dataset.avatarQa));
}

function petPopDifficulty(setting){return setting==="easy"?"junior":setting==="core"?"wordMaster":setting==="stretch"?"superStar":"auto";}
function nextPetPopSessionKey(profile=P()){
  PET_POP_SESSION_COUNTER++;return `pp1-${profile&&profile.created||0}-${Date.now().toString(36)}-${PET_POP_SESSION_COUNTER.toString(36)}`;
}
/* S9c: Pet Pop uses the WordBar Dictation sounds. Pet Pop passes the
   current combo and whether the letter was golden; the 5th pop in a row
   plays the fanfare only (Fever itself is silent so two sounds never stack). */
function playPetPopSound(cue,extra={}){
  if(cue==="tap")AudioKit.tap();
  else if(cue==="correct")AudioKit.answer(true,{streak:extra.streak||0,gold:!!extra.gold});
  else if(cue==="wrong")AudioKit.cue("wrong");
  else if(cue==="round")AudioKit.cue("round");
  else if(cue==="chunk")AudioKit.cue("chunk-note",{step:extra.step||1});
  else if(cue==="tick")AudioKit.cue("tick");
  else if(cue==="word")AudioKit.cue("tada");      /* S12a: a word finished = Dictation's ta-da */
  else if(cue==="result")AudioKit.cue("result");
  /* "fever": no separate sound; the streak fanfare already played. */
}
function petPopAvailablePets(profile=P()){
  const revealed=unlockedIds().pet,selected=activePlayerPet(profile);
  const list=PETS.filter(pet=>revealed.has(pet.id));
  if(selected){const index=list.findIndex(pet=>pet.id===selected.id);if(index>0){const [pet]=list.splice(index,1);list.unshift(pet)}else if(index<0)list.unshift(selected);}
  return list.length?list:PETS.filter(pet=>START_PETS.includes(pet.id));
}
function selectPetPopWords(report,profile=P()){
  if(!profile||report.courseId!==profile.courseId)throw new Error("Pet Pop course changed while selecting words");
  const progress=spellingCourseState(profile,profile.courseId);
  return PetPopScheduler.selectSession({words:report.eligible,courseId:profile.courseId,history:progress.words,recentWordIds:progress.recentWordIds,difficulty:petPopDifficulty(profile.settings.diff),now:Date.now()}).words;
}
function commitPetPopMutation(key,mutator){
  if(PET_POP_COMMITTING_KEYS.has(key))return {ok:true,applied:false,duplicate:true};
  const index=SAVE.active,live=SAVE.profiles[index];if(!live)return {ok:false,error:new Error("No active Pet Pop profile")};
  PET_POP_COMMITTING_KEYS.add(key);
  try{
    const candidate=cloneSaveValue(SAVE),profile=candidate.profiles[index];
    if(!profile||profile.created!==live.created||profile.courseId!==live.courseId)return {ok:false,error:new Error("Pet Pop profile changed before save")};
    const result=mutator(profile);if(result&&result.duplicate)return {ok:true,...result};
    const committed=WordBarPersistence.persistLive(candidate);if(!committed.ok)return {ok:false,error:committed.error||new Error("Spelling progress could not be saved")};
    SAVE=committed.value;return {ok:true,...result};
  }catch(error){return {ok:false,error}}
  finally{PET_POP_COMMITTING_KEYS.delete(key)}
}
function commitPetPopWord(event){
  const live=P();if(!live||event.courseId!==live.courseId)return {ok:false,error:new Error("Pet Pop rejected a cross-course word outcome")};
  return commitPetPopMutation(`word:${event.outcomeKey}`,profile=>applyPetPopWordOutcome(profile,event.courseId,event,event.outcomeKey,Date.now()));
}
function commitPetPopSession(event){
  const live=P();if(!live)return {ok:false,error:new Error("Pet Pop has no active profile")};
  return commitPetPopMutation(`session:${event.sessionKey}`,profile=>applyPetPopSessionOutcome(profile,live.courseId,event,event.sessionKey));
}
function startPetPopAnalytics(){
  if(!window.WordBarAnalytics)return;const p=P(),gameDifficulty=petPopDifficulty(p.settings.diff),analyticsDifficulty=gameDifficulty==="wordMaster"?"word_master":gameDifficulty==="superStar"?"super_star":gameDifficulty;WordBarAnalytics.startSession("pet_pop",analyticsDifficulty,p.courseId);PET_POP_ANALYTICS_ACTIVE=true;
}
function endPetPopAnalytics(event,saved){
  if(!PET_POP_ANALYTICS_ACTIVE||!window.WordBarAnalytics)return;PET_POP_ANALYTICS_ACTIVE=false;
  const results=Array.isArray(event.results)?event.results:[],wrong=results.reduce((n,x)=>n+(Number(x.wrongTaps)||0),0),round1WrongTaps=results.reduce((n,x)=>n+(Number(x.round1WrongTaps)||0),0),chunksShown=results.reduce((n,x)=>n+(x.chunksShown?1:0),0),overtime=results.reduce((n,x)=>n+(Number(x.overtimeCount)||0),0),bank=courseDataFor(P().courseId).words||[],lengths=results.map(x=>bank.find(w=>w.id===x.id)).filter(Boolean).map(w=>String(w.w||"").replace(/[^A-Za-z]/g,"").length);
  WordBarAnalytics.endSession({result:"completed",questions:0,correct:0,hints:0,petPop:{stars:saved.reward?.stars||petPopRewardFor(event).stars,wrongTaps:wrong,round1WrongTaps,chunksShown,overtime,score:event.score||0,reward:saved.reward?.paid||0,fever:event.feverCount||0,maxWordLength:Math.max(0,...lengths)}});
}
function holdPetPopTrophies(items){
  const byId=new Map(PET_POP_PENDING_TROPHIES.map(item=>[item&&item.id,item]));
  (Array.isArray(items)?items:[]).filter(Boolean).forEach(item=>byId.set(item.id,item));
  PET_POP_PENDING_TROPHIES=[...byId.values()];
}
function flushPetPopTrophies(){
  const fresh=PET_POP_PENDING_TROPHIES;PET_POP_PENDING_TROPHIES=[];
  setTimeout(()=>{if(fresh.length)celebrateAchievements(fresh);else runRewardNoticeQueue();},120);
}
function exitPetPop(){
  if(PET_POP_ANALYTICS_ACTIVE&&window.WordBarAnalytics)WordBarAnalytics.endSession({result:"interrupted"});PET_POP_ANALYTICS_ACTIVE=false;
  PET_POP_NAVIGATION++;if(typeof PetPop!=="undefined")PetPop.destroy();PET_POP_CONTROLLER=null;try{AudioKit.ambientIntensity(false);}catch(e){}AudioKit.ambientStart();screenMenu();flushPetPopTrophies();
}
function openPetPopTrophies(){PET_POP_NAVIGATION++;PET_POP_CONTROLLER=null;try{AudioKit.ambientIntensity(false);}catch(e){}AudioKit.ambientStart();screenTrophies("spelling");flushPetPopTrophies();}
async function screenPetPop(){
  if(!PET_POP_FEATURE_ENABLED)return screenMenu();
  const profile=P(),courseId=profile.courseId,course=activeCourseConfig(),token=++PET_POP_NAVIGATION;
  AudioKit.ambientStart();
  show(`<section class="screen center petpop-loading"><div class="topbar"><button class="iconb" id="petPopLoadBack" aria-label="Back to WordBar">←</button><b>Pet Pop</b>${courseBadgeHTML(courseId)}</div><div class="curator">🐾</div><h2>The pets are getting their letter cards…</h2><p class="note">Spelling progress is kept separate from vocabulary meaning progress.</p></section>`);
  $("#petPopLoadBack").onclick=exitPetPop;
  try{
    const report=await PetPopWordAdapter.loadAndValidate(courseId,{timeoutMs:30000});if(token!==PET_POP_NAVIGATION||P()!==profile&&P()?.created!==profile.created)return;
    const words=selectPetPopWords(report,profile),selected=activePlayerPet(profile),wearables=petWearables(profile),pets=petPopAvailablePets(profile);
    show(`<section class="screen petpop-screen"><div id="pet-pop-main"></div></section>`);
    const root=$("#pet-pop-main"),makeSessionKey=()=>nextPetPopSessionKey(P());
    PET_POP_CONTROLLER=PetPop.start({root,words,pets,selectedPetId:selected&&selected.id,sessionKey:makeSessionKey(),makeSessionKey,
      renderPet:(pet,mood,width)=>petSVG(pet,mood,width,selected&&pet.id===selected.id?wearables:{}),
      courseName:course.displayName,theme:profile.settings.theme,reducedMotion:profile.settings.motion==="reduced",soundOn:()=>{const live=P();return !!(live&&live.settings.sound!==false);},speak:text=>Voice.speak(text),onPauseRequest:pausePetPop,playSound:playPetPopSound,praise:()=>Voice.celebrate(),onFever:active=>{try{AudioKit.ambientIntensity(!!active);}catch(e){}},showSpeedLabels:false,
      requestWords:()=>selectPetPopWords(report,P()),onExit:exitPetPop,onTrophies:openPetPopTrophies,
      onEvent:event=>{
        if(event.type==="session-start"){startPetPopAnalytics();return {ok:true}}
        if(event.type==="word-complete"){const saved=commitPetPopWord(event);if(!saved.ok)toast("Spelling progress could not be saved. You can keep playing.");return saved}
        if(event.type==="session-complete"){const saved=commitPetPopSession(event);if(!saved.ok){toast("This playtime result could not be saved.");if(PET_POP_ANALYTICS_ACTIVE&&window.WordBarAnalytics){WordBarAnalytics.endSession({result:"save_failed"});PET_POP_ANALYTICS_ACTIVE=false;}return saved}endPetPopAnalytics(event,saved);holdPetPopTrophies(saved.freshTrophies);return saved}
      }});
  }catch(error){
    if(token!==PET_POP_NAVIGATION)return;
    show(`<section class="screen center petpop-loaderror"><h2>Pet Pop could not open</h2><p class="note">${esc(error&&error.message||"The word bank is unavailable.")}</p><button class="felt big" id="petPopErrorBack">Back to WordBar</button></section>`);
    $("#petPopErrorBack").onclick=exitPetPop;
  }
}
const WORDBAR_SHARE=Object.freeze({
  title:"WordBar",
  text:"WordBar: a free, fun English vocabulary game. Run a café as the shopkeeper, create your own character and build your vocabulary as you play. An enjoyable, gentle way to build a habit of self-motivated learning.",   // S12d: share message agreed with Nigel 11 Oct
  url:"https://wordbar.net/"
});
/* S11b (review WB-B05): the share is built when it is used, in the chosen
   interface language. S12c (cross-check E02): wordbar.net now has 繁 and 简
   pages, so every language shares its own introduction page (with its own
   share picture): wordbar.net/, wordbar.net/zh-hk/ or wordbar.net/zh-cn/.
   Nothing personal is ever added: no name, score, words or progress. */
function uiLangCode(){try{return window.WBI18N?WBI18N.urlCode():"en";}catch(e){return "en";}}
const WORDBAR_LANDING={"en":"https://wordbar.net/","zh-hk":"https://wordbar.net/zh-hk/","zh-cn":"https://wordbar.net/zh-cn/"};
function wordBarShareUrl(){return WORDBAR_LANDING[uiLangCode()]||WORDBAR_SHARE.url;}
/* S12c (E01): the privacy link opens the wordbar.net page in the same language */
function privacyUrl(){return (WORDBAR_LANDING[uiLangCode()]||WORDBAR_LANDING.en)+"#privacy";}
try{window.WBI18N&&WBI18N.onChange(()=>{document.querySelectorAll("a.wb-privacy-link").forEach(a=>{a.href=privacyUrl();});});}catch(e){}
function wordBarSharePayload(){return {title:WORDBAR_SHARE.title,text:wbT(WORDBAR_SHARE.text),url:wordBarShareUrl()};}
const wordBarShareMessage=()=>{const s=wordBarSharePayload();return `${s.text} ${s.url}`;};
async function copyWordBarShare(){
  const value=wordBarShareMessage();let area=null;
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(value);
    else{
      area=document.createElement("textarea");area.value=value;area.setAttribute("readonly","");area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();
      if(!document.execCommand("copy"))throw new Error("copy_failed");
    }
    toast("WordBar link copied!");return true;
  }catch(e){toast("Copy was unavailable. Please copy wordbar.net manually.");return false;}
  finally{if(area)area.remove();}
}
function ensureShareDialog(){
  let dlg=document.getElementById("shareDlg");
  if(dlg)return dlg;
  dlg=document.createElement("dialog");dlg.id="shareDlg";dlg.className="reveal sharedlg";
  dlg.innerHTML=`<div class="dlghead">Share WordBar</div><div class="dlgbody"><p>Invite another family to try the vocabulary and spelling games.</p><div class="sharechoices"><button class="felt" data-share="copy">🔗 Copy link</button><button class="felt" data-share="email">✉️ Email</button><button class="felt" data-share="whatsapp">💬 WhatsApp</button></div><p class="note">Only the game description and link are shared — never a child's name, words, score or progress.</p></div><div class="dlgfoot"><span></span><button class="closebtn" data-share="close">Close</button></div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("click",event=>{if(event.target===dlg)dlg.close();});
  dlg.querySelector('[data-share="close"]').onclick=()=>dlg.close();
  dlg.querySelector('[data-share="copy"]').onclick=async()=>{AudioKit.tap();if(await copyWordBarShare())dlg.close();};
  dlg.querySelector('[data-share="email"]').onclick=()=>{AudioKit.tap();location.href=`mailto:?subject=${encodeURIComponent(WORDBAR_SHARE.title)}&body=${encodeURIComponent(wordBarShareMessage())}`;dlg.close();};
  dlg.querySelector('[data-share="whatsapp"]').onclick=()=>{AudioKit.tap();window.open(`https://wa.me/?text=${encodeURIComponent(wordBarShareMessage())}`,"_blank","noopener,noreferrer");dlg.close();};
  return dlg;
}
async function shareWordBar(){
  AudioKit.tap();
  if(typeof navigator.share==="function"){
    try{await navigator.share(wordBarSharePayload());return;}
    catch(error){if(error&&error.name==="AbortError")return;}
  }
  const dlg=ensureShareDialog();if(typeof dlg.showModal==="function")dlg.showModal();else await copyWordBarShare();
}
/* S9a: link to the companion site WordBar Dictation, as the third button in the
   spelling row (adds no height, so the menu still fits one screen). It is a
   separate site that needs internet: it opens in a new tab and shows
   "Needs internet" while the device is offline. */
const DICTATION_URL="https://dictation.wordbar.net/";
/* S11b: Dictation opens in the same interface language (it reads ?lang).
   S12c (cross-check XB-B02): English is passed too (?lang=en), so an English
   Café never opens a Dictation that saved Chinese earlier. Nothing personal. */
function dictationUrl(){const u=new URL(DICTATION_URL);u.searchParams.set("lang",uiLangCode());return u.toString();}
function dictationLinkHTML(){
  const online=typeof navigator==="undefined"||navigator.onLine!==false;
  const inner=`<span class="bemoji" aria-hidden="true">✏️</span><span class="reviewspelllabel">Dictation<small>${online?"School list ↗":"Needs internet"}</small></span>`;
  return online
    ?`<button type="button" class="felt big dictationlink" id="dictationLink" aria-label="WordBar Dictation: practise your school spelling list. Opens separately in a new tab.">${inner}</button>`
    :`<button type="button" class="felt big dictationlink offline" id="dictationLink" aria-disabled="true" aria-label="WordBar Dictation needs internet.">${inner}</button>`;
}
function screenMenu(){
  AudioKit.ambientStart();
  const p=P(),course=activeCourseConfig(),learningAvailable=course.surfaces.learning;
  const kitchenAvailable=KITCHEN_ENABLED&&course.surfaces.kitchen;
  const kt=learningAvailable?krakenTier():{current:null,next:null,mastered:0};
  const reviewCount=reviewPool().length;
  const playerPet=activePlayerPet(p),reviewStreak=currentReviewStreakDays(p);
  const daily=learningAvailable&&isFirstMenuViewToday()?wordOfTheDay():null;
  const resumeShift=learningAvailable?validShiftResume():null;   /* S9b */
  show(`<section class="screen mainmenu-screen s13menu">
    <div class="topbar"><span class="tipbadge">${COIN} ${p.tips}</span><b class="bartitle">${esc(p.name)}'s WordBar</b>
      <span class="menutopactions"><button class="iconb" id="shareGame" aria-label="Share WordBar" title="Share WordBar">↗</button><button class="iconb" id="switch" aria-label="Switch shopkeeper" title="Switch shopkeeper">👥</button></span></div>
    <div class="menucourse">${courseBadgeHTML(p.courseId)}<span class="menulang">${window.WBI18N?WBI18N.pillHTML():""}</span></div>
    <div class="scenewrap theme-${p.settings.theme}">${cafeSceneHTML("preview",{barista:cafeBaristaPreview(),baristaAttrs:`id="editLookBarista" data-refreshable role="button" tabindex="0" aria-label="Change my shopkeeper’s look"`,pet:playerCafePetHTML("preview")})}<div class="ambientlayer">${ambientSVG(THEMES[p.settings.theme].ambient)}</div>${daily?`<button class="dailywordchip" id="dailyWord" aria-label="Today's word: ${esc(daily.w)}"><span aria-hidden="true">💬</span><b lang="en-GB">${esc(daily.w)}</b></button>`:""}${resumeShift?`<div class="resumecard" role="group" aria-label="Carry on your shift"><div class="resumetext"><b>☕ Carry on your shift</b><small>${esc(shiftResumeLabel(resumeShift))}</small></div><div class="resumebtns"><button type="button" class="felt mini primary" id="resumeGo">Carry on</button><button type="button" class="linky" id="resumeEnd">End shift</button></div></div>`:""}</div>
    ${playerPet&&reviewStreak?`<div class="petmoodbadge"><span class="reviewstreakbadge">🔥 ${reviewStreak}-day review streak</span></div>`:""}
    ${kt.current?`<div class="krakenbadge">${kt.current.emoji} <b>${kt.current.title}</b>${kt.next?` <small>· ${kt.mastered}/${kt.next.count} to ${kt.next.secret?"???":kt.next.title}</small>`:""}</div>`:""}
    ${playerPet&&reviewCount>=15?`<div class="note reviewpetnudge">🐾 ${esc(playerPet.name.replace(/^(a|an) /i,"Your "))} would love a Review session — ${reviewCount} words are waiting!</div>`:""}
    <div class="s13play" aria-label="Play">
      <button class="felt big tile wide" id="modenormal"><span class="bemoji">☕</span><span class="tlabel">Café</span></button>
      <button class="felt big tile" id="moderush"><span class="bemoji">🔥</span><span class="tlabel">Rush Hour</span></button>
      ${kitchenAvailable?`<button class="felt big tile" id="kitchen"><span class="bemoji">👩‍🍳</span><span class="tlabel">Kitchen</span></button>`:""}
      <button class="felt big tile" id="modetime"><span class="bemoji">⏱️</span><span class="tlabel">Time Challenge</span></button>
      <button class="felt big tile" id="modereview"><span class="bemoji">🎯</span><span class="tlabel">Review<small>${reviewCount?`${reviewCount} waiting`:"Vocabulary"}</small></span></button>
      ${PET_POP_FEATURE_ENABLED?`<button class="felt big tile" id="modepetpop"><span class="bemoji">🐾</span><span class="tlabel">Pet Pop<small>Spelling</small></span></button>`:""}
      ${dictationLinkHTML().replace('class="felt big dictationlink','class="felt big tile dictationlink')}
    </div>
    <div class="s13more" aria-label="Collections, progress and settings">
      <button class="felt tile" id="shop"><span class="bemoji">🛍️</span><span class="tlabel">Shop</span></button>
      <button class="felt tile" id="cafeTheme"><span class="bemoji">🎨</span><span class="tlabel">Café Theme</span></button>
      <button class="felt tile" id="gallery"><span class="bemoji">🖼️</span><span class="tlabel">Gallery</span></button>
      ${learningAvailable?`<button class="felt tile" id="trophies"><span class="bemoji">🏆</span><span class="tlabel">Trophies</span></button>
      <button class="felt tile" id="mywords"><span class="bemoji">📖</span><span class="tlabel">My Words</span></button>
      <button class="felt tile" id="leaderboard"><span class="bemoji">📊</span><span class="tlabel">My Best</span></button>`:""}
      <button class="felt tile" id="settings"><span class="bemoji">⚙️</span><span class="tlabel">Settings</span></button>
      <button class="felt tile" id="faq"><span class="bemoji">❓</span><span class="tlabel">FAQ</span></button>
      ${learningAvailable?`<button class="felt tile adultmenu" id="grown" title="Grown-ups only"><span class="adultlock" aria-hidden="true">🔒</span><span class="bemoji">📚</span><span class="tlabel">Library</span></button>
      <button class="felt tile adultmenu" id="parentSummary" title="Grown-ups only"><span class="adultlock" aria-hidden="true">🔒</span><span class="bemoji">📈</span><span class="tlabel">Weekly</span></button>`:""}
    </div>
    </div></section>`);
  /* S9b: starting anything else ends a saved shift (tips kept); each mode shows
     its How-to-play only the first time it is opened. */
  $("#modenormal").onclick=()=>{AudioKit.tap();discardShiftResume();withFirstTimeIntro("normal",()=>startShift("normal"));};
  $("#modetime").onclick=()=>{AudioKit.tap();discardShiftResume();withFirstTimeIntro("time",openTimeDurationPicker);};
  $("#moderush").onclick=()=>{AudioKit.tap();discardShiftResume();withFirstTimeIntro("rush",()=>startShift("rush"));};
  const resumeGo=$("#resumeGo");if(resumeGo)resumeGo.onclick=()=>{AudioKit.tap();carryOnShift();};
  const resumeEnd=$("#resumeEnd");if(resumeEnd)resumeEnd.onclick=()=>{AudioKit.tap();endSavedShift();};
  spaceMenu();
  setTimeout(()=>{if(app.querySelector(".mainmenu-screen")&&!document.querySelector("dialog[open]"))maybeShowHomeScreenTip();},700);
  $("#gallery").onclick=()=>{AudioKit.tap();screenGallery();};
  const kitchenBtn=$("#kitchen");if(kitchenBtn)kitchenBtn.onclick=()=>{AudioKit.tap();discardShiftResume();screenKitchenMenu();};
  $("#modereview").onclick=()=>{AudioKit.tap();if(!reviewPool().length){toast("🌟 Nothing to review right now — every word is mastered or brand new!");return;}discardShiftResume();withFirstTimeIntro("review",()=>startShift("review"));};
  const petPopButton=$("#modepetpop");if(petPopButton)petPopButton.onclick=()=>{AudioKit.tap();discardShiftResume();screenPetPop();};
  $("#shop").onclick=()=>{AudioKit.tap();screenShop();};
  $("#cafeTheme").onclick=()=>{AudioKit.tap();screenCafeTheme();};
  const myWords=$("#mywords");if(myWords)myWords.onclick=()=>{AudioKit.tap();screenMyWords();};
  const trophies=$("#trophies");if(trophies)trophies.onclick=()=>{AudioKit.tap();screenTrophies();};
  const leaderboard=$("#leaderboard");if(leaderboard)leaderboard.onclick=()=>{AudioKit.tap();screenLeaderboard();};
  const parentSummary=$("#parentSummary");if(parentSummary)parentSummary.onclick=()=>{AudioKit.tap();grownGate("summary");};
  $("#settings").onclick=()=>{AudioKit.tap();screenSettings();};
  $("#faq").onclick=()=>{AudioKit.tap();screenFAQ();};
  const grown=$("#grown");if(grown)grown.onclick=()=>{AudioKit.tap();grownGate("library");};
  $("#shareGame").onclick=shareWordBar;
  const dictationLink=$("#dictationLink");if(dictationLink)dictationLink.onclick=()=>{
    AudioKit.tap();
    if(navigator.onLine===false){toast("WordBar Dictation needs internet. Try again when you're online.");return;}
    /* A real link clicked inside the tap: opens a new tab and never replaces WordBar. */
    const a=document.createElement("a");a.href=dictationUrl();a.target="_blank";a.rel="noopener";document.body.appendChild(a);a.click();a.remove();};
  $("#switch").onclick=()=>{AudioKit.tap();screenProfiles();};
  /* S11a: EN | 繁 | 简. S12b (review M01): refit the menu after a language
     change, because Chinese and English labels can wrap differently. */
  if(window.WBI18N)WBI18N.bind(app,()=>spaceMenu());
  /* S9c: tap your barista to change the look */
  const editLook=$("#editLookBarista");if(editLook){const go=()=>{AudioKit.tap();openEditLook(SAVE.active,"menu");};
    editLook.onclick=go;editLook.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};}
  const dw=$("#dailyWord");if(dw)dw.onclick=()=>{AudioKit.tap();if(Voice.available())Voice.speak(daily.w);toast(`${daily.w}: ${daily.def}`,{english:true});};
}

/* ---------- Help and FAQ ---------- */
const FAQ_SECTIONS=[
  {title:"Playing WordBar",items:[
    ["What is Café mode?","Café is the main WordBar game. Answer vocabulary questions to serve customers, earn tips and grow your café."],
    ["How are Pet Pop words segmented?","WordBar uses built-in reviewed spelling patterns to show useful colour chunks in Round 1. A word stays whole when dividing it would not help spelling memory. Segmentation works offline and does not send words to an external service."],
    ["Could my progress disappear?","WordBar saves your progress on this device after every answer. On iPhone and iPad, Safari can clear a website’s saved games if Safari is used for a week without opening WordBar. Adding WordBar to your Home Screen avoids this, because the Home Screen app keeps its own save. Your Safari café and the Home Screen app have separate saves; use Settings → Export save and Import save to move a café across, or to keep a backup."],
    ["What is WordBar Dictation?","WordBar Dictation is a free companion site for practising your own school spelling list with the WordBar pets. Open it from the WordBar Dictation link on the menu, or go to dictation.wordbar.net. It opens separately and needs internet. Your WordBar café and progress are not affected."],
    ["What is Review?","Review lets you revisit words you have already met or found difficult. Use it to strengthen your memory before playing again."],
    ["What is Rush Hour?","Rush Hour is a faster and busier café challenge. Answer carefully before each customer's patience runs out."],
    ["What is Time Challenge?","Time Challenge is a race against the clock. Answer as many vocabulary questions as you can before time runs out."],
    ["What is Pet Pop Spelling?","Tap the pets carrying the letters you need through three short rounds. Every round follows spelling order: start with the first letter, then pop the next letter until the word is complete. Round 1 uses coloured spelling chunks, Round 2 uses the plain word and Round 3 hides the word for memory practice."],
    ["What is Kitchen mode?","Kitchen mode turns words into cooking challenges. Choose Word Path, Unscramble or Conveyor and complete the words before the round ends. Kitchen challenges can earn coins and unlock new dishes for your café."]
  ]},
  {title:"Tips, coins and unlocks",items:[
    ["How do I earn tips and coins?","Serve customers correctly in Café mode to earn tips, which are added to your spendable coin balance. Kitchen and Pet Pop Spelling can also earn coins."],
    ["What can I use coins for?","Spend coins on avatar items, café extras, a Pet Licence and selected help during games. Spending coins reduces your available balance, but it does not reduce your lifetime coin total."],
    ["What are lifetime coins?","Lifetime coins show all the coins you have earned since you started playing. This total does not go down when you spend coins. Reaching lifetime-coin milestones unlocks new customers, pets and café themes."]
  ]},
  {title:"Characters, pets and Gallery",items:[
    ["How do I discover characters and pets?","Keep playing and earning lifetime coins to unlock new customers and pets. New discoveries are recorded automatically in the Gallery."],
    ["What is the Gallery?","The Gallery keeps a record of the customers and pets you have discovered. Tap a customer to see different emotions and interactions, or tap a pet to see its reaction and select it."],
    ["How do I get a pet?","Save 1,120 spendable coins and buy the Pet Licence in the Legendary Shop. Then open the Gallery, choose an unlocked pet and select it as your active pet."]
  ]},
  {title:"Café themes",items:[
    ["How do I unlock a new café theme?","New café themes unlock as your lifetime coins grow. Open Café Theme to view and choose the themes you have unlocked."]
  ]},
  {title:"Settings",items:[
    ["How do I change the difficulty?","Open Settings and choose the difficulty that feels right for you. You can change it again whenever you want a gentler or harder challenge."],
    ["How do I change the music?","Open Settings to turn the background music on or off and choose a track. Your choice is saved for the next time you play."],
    ["Why can I hear sounds when my phone is on silent?","WordBar plays its sounds even when an iPhone is on silent, so the words and effects are always heard while learning. To turn them off, tap ⏸️ during a game (or open Settings) and switch off Sound effects, Music or Voice. While WordBar makes a sound, iPhone may pause music playing in another app."],
    ["How do I change my shopkeeper's look?","Tap your shopkeeper in the café picture on the main menu. You can also tap 👗 Change look & Wardrobe in the Shop, open Settings → My shopkeeper, or tap ••• next to the shopkeeper on the “Who’s running WordBar today?” screen. Hairstyle and colour (including a hijab), eyes, eyelashes, eyebrows, cheeks, skin, glasses, facial hair, and clothing style and colour (in the Wardrobe tab) are all free to change, and 🎲 Surprise me mixes them up (with any clothes you own). Everything you buy in the Shop appears in the Wardrobe tab to wear or take off — or use My Items in the Shop. Tap 👀 Try on in the Shop to see an item before buying. If two items would overlap (for example Star Hair Clips and the Barista Headset), putting one on takes the other off."],
    ["How do I choose a voice?","Open Settings and choose a Voice: British or US, female or male. The line under it shows which voice your device is using. Tap Test voice to hear it, or Try another voice for a different one; WordBar remembers your choice. On iPhone and iPad, Apple doesn’t let websites use its natural British female voices, so British Female uses Samantha (US) unless you choose Shelley with Try another voice."],
    ["What is Battery saver?","Battery saver reduces automatic movement and some visual effects to use less power. Turn it on in Settings if your device becomes warm or you want longer battery life."]
  ]},
  {title:"Library",items:[
    ["What is the Library?","The Library is a grown-up area for viewing and managing the active word bank. After passing the grown-up check, you can search for words, hide words you do not want included and restore hidden words later."]
  ]}
];
function screenFAQ(){
  const content=FAQ_SECTIONS.map(section=>`<section class="faqgroup" aria-labelledby="faq-${section.title.toLowerCase().replace(/[^a-z]+/g,"-")}"><h2 id="faq-${section.title.toLowerCase().replace(/[^a-z]+/g,"-")}">${esc(section.title)}</h2>${section.items.map(([question,answer])=>`<details class="faqitem felt"><summary><span>${esc(question)}</span><span class="faqchev" aria-hidden="true">⌄</span></summary><div class="faqanswer"><p>${esc(answer)}</p></div></details>`).join("")}</section>`).join("");
  show(`<section class="screen faqscreen"><div class="topbar"><button class="iconb" id="faqBack" aria-label="Go back">←</button><b>Help & FAQ</b><span></span></div><p class="note faqintro">Tap a question to see the answer.</p>${content}</section>`);
  $("#faqBack").onclick=()=>{AudioKit.tap();screenMenu();};
  $$(".faqitem").forEach(item=>item.addEventListener("toggle",()=>{if(!item.open)return;$$('.faqitem[open]').forEach(other=>{if(other!==item)other.open=false;});}));
}

/* ---------- Build 72 Kitchen path-consistency, tutorial and fair-recall pass ----------
   Adds a deterministic 4x4 Word Path laboratory to the shared Kitchen
   engine. The full 3 Conveyor / 2 Scramble / 2 Path mix is now testable,
   with Path fixed as round 7. Build 67 keeps the Build 66 presentation and fixes review/background lifecycle, first-run routing and touch sizing. */
let KITCHEN_TUTORIAL=null;
function kitchenTutorialSave(completed,skipped){
  const p=P();if(!p)return;
  const k=kitchenOf(p);k.tutorial={completed:!!completed,skipped:!!skipped};persist();
}
function startKitchenTutorial(){
  KITCHEN_TUTORIAL={step:0,answer:[],path:[],feedback:""};
  renderKitchenTutorial();
}
function kitchenTutorialDots(step){return `<div class="tutorialdots" aria-label="Tutorial progress">${[0,1,2,3].map(i=>`<span class="${i===step?"on":""}"></span>`).join("")}</div>`;}
function kitchenTutorialSource(letters){
  const used=new Set((KITCHEN_TUTORIAL.answer||[]).map(x=>x.id));
  return letters.map((ch,i)=>({id:`t${i}`,ch,used:used.has(`t${i}`)}));
}
const KITCHEN_TUTORIAL_POINTER={active:false,pointerId:null,lastIndex:null,lastX:null,lastY:null,ignoreClickUntil:0};
function kitchenTutorialPathPoints(){return (KITCHEN_TUTORIAL?.path||[]).map(i=>`${(i%4)+.5},${Math.floor(i/4)+.5}`).join(" ");}
function refreshKitchenTutorialPathUI(){
  const st=KITCHEN_TUTORIAL;if(!st||st.step!==3)return;const letters=["o","v","e","n","t","a","r","s","i","l","c","d","m","u","g","h"];
  $$('[data-tut-path]').forEach(cell=>{const idx=Number(cell.dataset.tutPath),order=st.path.indexOf(idx),selected=order>=0;cell.classList.toggle("selected",selected);let badge=cell.querySelector("small");if(selected){if(!badge){badge=document.createElement("small");cell.appendChild(badge);}badge.textContent=String(order+1);}else if(badge)badge.remove();cell.setAttribute("aria-label",`Letter ${letters[idx]}${selected?`, selected ${order+1}`:""}`);});
  const line=$(".kitchentutorial .kitchenpathlines polyline");if(line)line.setAttribute("points",kitchenTutorialPathPoints());const check=$("#tCheck");if(check)check.disabled=st.path.length!==4;
}
function kitchenTutorialPathVisit(index,{audio=false}={}){
  const st=KITCHEN_TUTORIAL;if(!st||st.step!==3||!Number.isInteger(index)||index<0||index>=16)return false;const existing=st.path.indexOf(index);let changed=false;
  /* Build 86g-phase13: matches kitchenPathVisit — backtracking undoes only the
     single letter before the tip, so the tutorial teaches the same forgiving
     gesture the real game now uses. */
  if(existing>=0){if(existing===st.path.length-2){st.path.pop();changed=true;}}
  else if(st.path.length<4&&(!st.path.length||kitchenPathAdjacent(st.path[st.path.length-1],index,4))){st.path.push(index);changed=true;}
  if(changed){st.feedback="";if(audio)AudioKit.tap();refreshKitchenTutorialPathUI();}return changed;
}
function bindKitchenTutorialPathDrag(){
  const grid=$(".kitchentutorial .kitchenpathgrid");if(!grid)return;
  const TUT_PATH_HIT_INSET=0.37;
  const visit=(x,y)=>{const el=document.elementFromPoint(x,y),cell=el&&el.closest&&el.closest('[data-tut-path]');if(!cell||!grid.contains(cell))return;
    const r=cell.getBoundingClientRect();
    if(Math.abs(x-(r.left+r.width/2))>r.width*TUT_PATH_HIT_INSET)return;
    if(Math.abs(y-(r.top+r.height/2))>r.height*TUT_PATH_HIT_INSET)return;
    const idx=Number(cell.dataset.tutPath);if(idx===KITCHEN_TUTORIAL_POINTER.lastIndex)return;KITCHEN_TUTORIAL_POINTER.lastIndex=idx;kitchenTutorialPathVisit(idx);};
  const sample=(x,y)=>{const p=KITCHEN_TUTORIAL_POINTER;if(!Number.isFinite(p.lastX)||!Number.isFinite(p.lastY)){visit(x,y);p.lastX=x;p.lastY=y;return;}const dx=x-p.lastX,dy=y-p.lastY,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/10));for(let i=1;i<=steps;i++)visit(p.lastX+dx*i/steps,p.lastY+dy*i/steps);p.lastX=x;p.lastY=y;};
  const end=e=>{if(!KITCHEN_TUTORIAL_POINTER.active||e.pointerId!==KITCHEN_TUTORIAL_POINTER.pointerId)return;if(Number.isFinite(e.clientX)&&Number.isFinite(e.clientY))sample(e.clientX,e.clientY);KITCHEN_TUTORIAL_POINTER.active=false;KITCHEN_TUTORIAL_POINTER.ignoreClickUntil=Date.now()+450;KITCHEN_TUTORIAL_POINTER.pointerId=null;KITCHEN_TUTORIAL_POINTER.lastIndex=null;KITCHEN_TUTORIAL_POINTER.lastX=null;KITCHEN_TUTORIAL_POINTER.lastY=null;try{grid.releasePointerCapture(e.pointerId);}catch(_){}};
  grid.addEventListener("pointerdown",e=>{const cell=e.target.closest('[data-tut-path]');if(!cell||!grid.contains(cell))return;e.preventDefault();KITCHEN_TUTORIAL_POINTER.active=true;KITCHEN_TUTORIAL_POINTER.pointerId=e.pointerId;KITCHEN_TUTORIAL_POINTER.lastIndex=null;KITCHEN_TUTORIAL_POINTER.lastX=null;KITCHEN_TUTORIAL_POINTER.lastY=null;try{grid.setPointerCapture(e.pointerId);}catch(_){}sample(e.clientX,e.clientY);},{passive:false});
  grid.addEventListener("pointermove",e=>{if(!KITCHEN_TUTORIAL_POINTER.active||e.pointerId!==KITCHEN_TUTORIAL_POINTER.pointerId)return;e.preventDefault();sample(e.clientX,e.clientY);},{passive:false});grid.addEventListener("pointerup",end);grid.addEventListener("pointercancel",end);grid.addEventListener("lostpointercapture",end);
}
function renderKitchenTutorial(){
  const s=KITCHEN_TUTORIAL||{step:0,answer:[],path:[],feedback:""};
  if(s.step===0){
    show(`<section class="screen center kitchenchallenge"><div class="topbar"><button class="iconb" id="back">←</button><b>Kitchen tutorial</b><span></span></div>
      <div class="kitchentutorial felt">${kitchenTutorialDots(0)}<div class="kitchencloche">👩‍🍳</div><h2>Learn the three Kitchen games</h2><p>Kitchen words use 4 or more letters. Two letters are shown at the start, you may buy one extra letter for ${KITCHEN_CONFIG.extraLetterCost} coins, and a pronunciation hint costs ${KITCHEN_CONFIG.pronunciationCost} coins. Tutorial slips never affect your records.</p>
      <div class="custactions"><button class="felt big primary" id="tNext">Start tutorial</button></div><div class="skiprow"><button class="linky" id="tSkip">Skip for now</button></div></div></section>`);
    $("#back").onclick=()=>screenMenu();
    $("#tNext").onclick=()=>{s.step=1;s.answer=[];s.feedback="";renderKitchenTutorial();};
    $("#tSkip").onclick=()=>{kitchenTutorialSave(false,true);screenKitchenMenu("drinks",true);};
    return;
  }
  if(s.step===1){
    const target="milk",hints={0:"m",3:"k"},tiles=kitchenTutorialSource(["i","l","x"]);
    show(`<section class="screen center kitchenchallenge"><div class="topbar"><button class="iconb" id="back">←</button><b>Kitchen tutorial</b><span>1/3</span></div>
      <div class="kitchentutorial felt">${kitchenTutorialDots(1)}<h2>Letter Conveyor</h2><div class="kitchenprompt" lang="en-GB">A white drink from cows.</div>
      <div class="kitchenanswer">${target.split("").map((_,i)=>hints[i]?`<div class="slot clue">${hints[i]}</div>`:`<div class="slot ${s.answer[i===1?0:1]?"fill":""}">${s.answer[i===1?0:1]?.ch||""}</div>`).join("")}</div>
      <div class="kitchentiles">${tiles.map(x=>`<button class="kitchentile ${x.used?"used":""}" data-tut-tile="${x.id}" ${x.used?"disabled":""}>${x.ch}</button>`).join("")}</div>
      <div class="tutorialhint">${esc(s.feedback||"Two letters are given. Tap I, then L to complete MILK.")}</div><div class="custactions"><button class="felt" id="tClear">Clear</button><button class="felt primary" id="tCheck" ${s.answer.length===2?"":"disabled"}>Check answer</button></div><div class="skiprow"><button class="linky" id="tSkip">Skip tutorial</button></div></div></section>`);
    $("#back").onclick=()=>{s.step=0;s.answer=[];renderKitchenTutorial();};
    $$('[data-tut-tile]').forEach(b=>b.onclick=()=>{const item=tiles.find(x=>x.id===b.dataset.tutTile);if(!item||s.answer.some(x=>x.id===item.id))return;s.answer.push({id:item.id,ch:item.ch});AudioKit.tap();renderKitchenTutorial();});
    $("#tClear").onclick=()=>{s.answer=[];s.feedback="";renderKitchenTutorial();};
    $("#tCheck").onclick=()=>{if(s.answer.map(x=>x.ch).join("")==="il"){AudioKit.cue("correct");s.step=2;s.answer=[];s.feedback="";}else{AudioKit.cue("wrong");s.answer=[];s.feedback="Nearly — try I, then L to complete MILK.";}renderKitchenTutorial();};
    $("#tSkip").onclick=()=>{kitchenTutorialSave(false,true);screenKitchenMenu("drinks",true);};
    return;
  }
  if(s.step===2){
    const target="stir",hints={0:"s",2:"i"},tiles=kitchenTutorialSource(["r","t"]);
    show(`<section class="screen center kitchenchallenge"><div class="topbar"><button class="iconb" id="back">←</button><b>Kitchen tutorial</b><span>2/3</span></div>
      <div class="kitchentutorial felt">${kitchenTutorialDots(2)}<h2>Word Scramble</h2><div class="kitchenprompt" lang="en-GB">Mix with a spoon.</div>
      <div class="kitchenanswer">${target.split("").map((_,i)=>hints[i]?`<div class="slot clue">${hints[i]}</div>`:(s.answer[i===1?0:1]?`<button class="slot fill" data-tut-return="${i===1?0:1}">${s.answer[i===1?0:1].ch}</button>`:`<div class="slot"></div>`)).join("")}</div>
      <div class="kitchentiles">${tiles.map(x=>`<button class="kitchentile ${x.used?"used":""}" data-tut-tile="${x.id}" ${x.used?"disabled":""}>${x.ch}</button>`).join("")}</div>
      <div class="tutorialhint">${esc(s.feedback||"Two letters are given. Move T and R to complete STIR. Tap a filled slot to return it.")}</div><div class="custactions"><button class="felt" id="tClear">Clear</button><button class="felt primary" id="tCheck" ${s.answer.length===2?"":"disabled"}>Check answer</button></div><div class="skiprow"><button class="linky" id="tSkip">Skip tutorial</button></div></div></section>`);
    $("#back").onclick=()=>{s.step=1;s.answer=[];s.feedback="";renderKitchenTutorial();};
    $$('[data-tut-tile]').forEach(b=>b.onclick=()=>{const item=tiles.find(x=>x.id===b.dataset.tutTile);if(!item||s.answer.some(x=>x.id===item.id))return;s.answer.push({id:item.id,ch:item.ch});AudioKit.tap();renderKitchenTutorial();});
    $$('[data-tut-return]').forEach(b=>b.onclick=()=>{s.answer.splice(+b.dataset.tutReturn,1);AudioKit.tap();renderKitchenTutorial();});
    $("#tClear").onclick=()=>{s.answer=[];s.feedback="";renderKitchenTutorial();};
    $("#tCheck").onclick=()=>{if(s.answer.map(x=>x.ch).join("")==="tr"){AudioKit.cue("correct");s.step=3;s.answer=[];s.path=[];s.feedback="";}else{AudioKit.cue("wrong");s.answer=[];s.feedback="Try arranging T and R to complete STIR.";}renderKitchenTutorial();};
    $("#tSkip").onclick=()=>{kitchenTutorialSave(false,true);screenKitchenMenu("drinks",true);};
    return;
  }
  if(s.step===3){
    const cells=["o","v","e","n","t","a","r","s","i","l","c","d","m","u","g","h"],target=[0,1,2,3],hinted=new Set([0,2]);
    show(`<section class="screen center kitchenchallenge"><div class="topbar"><button class="iconb" id="back">←</button><b>Kitchen tutorial</b><span>3/3</span></div>
      <div class="kitchentutorial felt">${kitchenTutorialDots(3)}<h2>Word Path</h2><div class="kitchenprompt" lang="en-GB">A kitchen appliance for baking.</div>
      <div class="kitchenpathwrap"><div class="kitchenpathgrid">${cells.map((ch,i)=>{const order=s.path.indexOf(i);return `<button class="kitchenpathcell ${order>=0?"selected":""} ${hinted.has(i)?"hinted":""}" data-tut-path="${i}" aria-label="Letter ${ch}"><span>${ch}</span>${order>=0?`<small>${order+1}</small>`:""}</button>`;}).join("")}</div><svg class="kitchenpathlines" viewBox="0 0 4 4" aria-hidden="true"><polyline points="${kitchenTutorialPathPoints()}"/></svg></div>
      <div class="tutorialhint">${esc(s.feedback||"Bright letters are hints, but you still cross them. Drag through O → V → E → N, or tap each neighbouring square, then Check answer.")}</div><div class="custactions"><button class="felt" id="tClear">Clear</button><button class="felt primary" id="tCheck" ${s.path.length===4?"":"disabled"}>Check answer</button></div><div class="skiprow"><button class="linky" id="tSkip">Skip tutorial</button></div></div></section>`);
    $("#back").onclick=()=>{s.step=2;s.answer=[];s.path=[];s.feedback="";renderKitchenTutorial();};
    $$('[data-tut-path]').forEach(b=>b.onclick=()=>{if(Date.now()<KITCHEN_TUTORIAL_POINTER.ignoreClickUntil)return;const idx=+b.dataset.tutPath;if(!kitchenTutorialPathVisit(idx,{audio:true})&&s.path.length&&!kitchenPathAdjacent(s.path[s.path.length-1],idx,4)){s.feedback="Choose a neighbouring square.";renderKitchenTutorial();}});
    bindKitchenTutorialPathDrag();
    $("#tClear").onclick=()=>{s.path=[];s.feedback="";refreshKitchenTutorialPathUI();};
    $("#tCheck").onclick=()=>{if(JSON.stringify(s.path)===JSON.stringify(target)){AudioKit.cue("correct");s.step=4;s.feedback="";}else{AudioKit.cue("wrong");s.path=[];s.feedback="Try the top-row cells O, V, E, N — including the bright hints.";}renderKitchenTutorial();};
    $("#tSkip").onclick=()=>{kitchenTutorialSave(false,true);screenKitchenMenu("drinks",true);};
    return;
  }
  show(`<section class="screen center kitchenchallenge"><div class="topbar"><span></span><b>Kitchen tutorial</b><span></span></div><div class="kitchentutorial felt"><div class="kitchencloche">🔔</div><h2>Ready to cook!</h2><p>Words use 4 or more letters. Two letters are shown first, a third hint costs ${KITCHEN_CONFIG.extraLetterCost} coins, pronunciation costs ${KITCHEN_CONFIG.pronunciationCost} coins, and corrections are free until you check your answer.</p><button class="felt big primary" id="tDone">Open Kitchen</button></div></section>`);
  $("#tDone").onclick=()=>{kitchenTutorialSave(true,false);KITCHEN_TUTORIAL=null;screenKitchenMenu("drinks",true);};
}

let KITCHEN_RUN=null,kitchenTickTimer=null,kitchenFeedbackTimer=null,KITCHEN_LAST_TICK=null,kitchenReadyTimer=null;
const KITCHEN_POOL_CACHE=new Map();
function clearKitchenTimers(){
  cancelKitchenReady();
  if(kitchenTickTimer){clearTimeout(kitchenTickTimer);kitchenTickTimer=null;}
  if(kitchenFeedbackTimer){clearTimeout(kitchenFeedbackTimer);kitchenFeedbackTimer=null;}
}
function kitchenDeck(){
  /* Shuffle the first six slots but preserve Word Path as the finale.
     This matches the intended pilot composition while keeping runs varied. */
  const firstSix=shuffle(KITCHEN_CONFIG.modeDeck.slice(0,6));
  return [...firstSix,"path"];
}
function kitchenDeckIsValid(deck){
  if(!Array.isArray(deck)||deck.length!==7||deck[6]!=="path")return false;
  const counts=deck.reduce((a,m)=>{a[m]=(a[m]||0)+1;return a;},{});
  return counts.conveyor===3&&counts.scramble===2&&counts.path===2&&Object.keys(counts).every(m=>["conveyor","scramble","path"].includes(m));
}
function kitchenCatalogIssues(){
  const issues=[];
  if(KITCHEN_FOODS.length!==54)issues.push("Kitchen catalog must contain 54 food and drink recipes.");
  if(KITCHEN_CLASSIC_FOODS.length!==6)issues.push("Kitchen catalog must contain six immediately available recipes.");
  if(KITCHEN_CHALLENGE_FOODS.length!==48)issues.push("Kitchen catalog must contain forty-eight challenge recipes.");
  const ids=KITCHEN_FOODS.map(x=>x.id);
  if(new Set(ids).size!==ids.length)issues.push("Kitchen food ids must be unique.");
  KITCHEN_FOODS.forEach(food=>{
    const renderable=food?.drinkKind?!!DRINK_KINDS[food.drinkKind]:!!FOOD_KINDS[food?.id];
    if(!food||!food.id||!renderable)issues.push(`Missing café renderer for ${food?.id||"unknown item"}.`);
    if(!KITCHEN_TEMPLATES[food?.template])issues.push(`Missing Kitchen template for ${food?.id||"unknown item"}.`);
    if(!Array.isArray(food.steps)||food.steps.length!==7||!Array.isArray(food.labels)||food.labels.length!==7)issues.push(`Kitchen recipe progress must have seven steps for ${food?.id||"unknown item"}.`);
    if(Array.isArray(food.steps)&&food.steps.some(icon=>!/^[a-z0-9-]+$/.test(icon)))issues.push(`Kitchen step artwork id is invalid for ${food?.id||"unknown item"}.`);
  });
  /* Build 86g-phase12: a dish absent from every PERSONALITY_FOODS list can
     never be ordered in the café, because pickTicketFood only falls back to
     the full pool when a personality's preferred list is empty. That failure
     is completely silent, so it is caught here instead. */
  const orderable=new Set(Object.values(PERSONALITY_FOODS).flat());
  KITCHEN_FOODS.filter(food=>!food.drinkKind&&!orderable.has(food.id))
    .forEach(food=>issues.push(`${food.id} can never be ordered in the caf\u00e9 — add it to PERSONALITY_FOODS.`));
  if(!kitchenDeckIsValid(KITCHEN_CONFIG.modeDeck))issues.push("Kitchen mode deck is invalid.");
  return issues;
}
function kitchenRunIsValid(run){
  if(!run||!kitchenFood(run.foodId)||!kitchenDeckIsValid(run.modeDeck))return false;
  if(!Number.isFinite(run.totalMs)||run.totalMs<30000)return false;
  return run.correct===0&&run.mistakes===0&&run.status==="intro";
}
function kitchenFood(id){return KITCHEN_FOOD_BY_ID[id]||null;}
function kitchenRemainingMs(run=KITCHEN_RUN){
  if(!run)return 0;
  return run.status==="active"?Math.max(0,run.deadlineMs-Date.now()):Math.max(0,run.remainingMs||0);
}
function kitchenRemainingSeconds(run=KITCHEN_RUN){return Math.max(0,Math.ceil(kitchenRemainingMs(run)/1000));}
function kitchenModeLabel(mode){return mode==="conveyor"?"Letter Conveyor":mode==="scramble"?"Word Scramble":"Word Path";}
function kitchenModeForRun(run){return run.modeDeck[Math.min(run.correct,run.modeDeck.length-1)]||"conveyor";}
function stripTags(html){const d=document.createElement("div");d.innerHTML=String(html||"");return (d.textContent||d.innerText||"").trim();}
function kitchenAnswerKey(s){return String(s||"").toLowerCase().replace(/[^a-z]/g,"");}
function kitchenPromptLeaksAnswer(text,ans){return promptContainsWholeAnswer(text,ans);}
function kitchenPoolCacheKey(tier,mode){
  const store=activeCourseStore(),count=store.words.filter(w=>w.t===tier).length;
  return `${store.id}:${store.packVersion}:${tier}:${mode}:${count}`;
}
function kitchenQuestionIndex(tier,mode){
  const cacheKey=kitchenPoolCacheKey(tier,mode);
  if(KITCHEN_POOL_CACHE.has(cacheKey))return KITCHEN_POOL_CACHE.get(cacheKey);
  /* Kitchen is open recall, so only course-approved clues with one authored
     alphabetic answer are used. The registry preserves 11+ Build 86g and
     applies the reviewed Everyday answer=headword filters. */
  const store=activeCourseStore(),rules=kitchenTypeRules(store.id).filter(rule=>rule.modes.includes(mode));
  const maxLen=mode==="scramble"?10:mode==="path"?8:12;
  let items=[];
  store.words.filter(w=>w.t===tier).forEach(w=>{
    const bank=store.qbank[w.id]||{};
    rules.forEach(rule=>{
      (bank[rule.type]||[]).forEach((q,idx)=>{
        const raw=String(q.ans||"").trim().toLowerCase();
        if(!/^[a-z]+$/.test(raw)||raw.length<4||raw.length>maxLen)return;
        if(rule.answerMustEqualHeadword&&kitchenAnswerKey(w.w)!==raw)return;
        if(mode==="scramble"&&new Set(raw).size<2)return;
        if(kitchenPromptLeaksAnswer(q.text||"",raw))return;
        const questionId=q.id||`${w.id}:${rule.type}:${idx}`;
        const say=store.id===COURSE_IDS.elevenPlus?w.w:(q.speechText||raw);
        items.push({key:questionId,questionId,courseId:store.id,wid:w.id,tier:w.t,kind:rule.kind,type:rule.type,text:q.text||"",ans:raw,explain:q.explain||"",say});
      });
    });
  });
  let collisionGroups=0,collisionAnswers=0;
  if(mode==="scramble"){
    const groups=new Map();
    items.forEach(q=>{
      const key=q.ans.split("").sort().join("");
      if(!groups.has(key))groups.set(key,new Set());
      groups.get(key).add(q.ans);
    });
    const bad=new Set();
    groups.forEach((answers,key)=>{
      if(answers.size>1){collisionGroups++;answers.forEach(a=>bad.add(a));}
    });
    collisionAnswers=bad.size;
    items=items.filter(q=>!bad.has(q.ans));
  }
  const result={items,collisionGroups,collisionAnswers};
  KITCHEN_POOL_CACHE.set(cacheKey,result);
  return result;
}
function kitchenPickQuestion(run,mode){
  const usedKeys=new Set(run.usedQuestionKeys||[]),usedAnswers=new Set(run.usedAnswers||[]);
  const all=kitchenQuestionIndex(run.tier,mode).items;
  const pool=all.filter(q=>!usedKeys.has(q.key)&&!usedAnswers.has(q.ans));
  if(!pool.length)return null;
  const q=pool[Math.floor(Math.random()*pool.length)];
  run.usedQuestionKeys.push(q.key);run.usedAnswers.push(q.ans);
  return JSON.parse(JSON.stringify(q));
}
function kitchenExtraLetters(answer,count){
  const letters="etaoinshrdlucmfwypvbgkjqxz",bag=[];
  while(bag.length<count){
    const ch=letters[Math.floor(Math.random()*letters.length)];
    if((answer.match(new RegExp(ch,"g"))||[]).length>=2&&Math.random()<.6)continue;
    bag.push(ch);
  }
  return bag;
}
function kitchenShuffleUnsolved(answer){
  const original=answer.split("");
  let out=original.slice();
  for(let i=0;i<12&&out.join("")===answer;i++)out=shuffle(original);
  if(out.join("")===answer&&out.length>1)out=[...out.slice(1),out[0]];
  return out;
}
function kitchenSeedFromString(value){
  let h=2166136261>>>0;
  for(const ch of String(value||"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
  return h||1;
}
function kitchenSeededRandom(seed){
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let x=a;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};
}
function kitchenSeededShuffle(list,rng){
  const out=list.slice();
  for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function kitchenPathAdjacent(a,b,size=4){
  const ar=Math.floor(a/size),ac=a%size,br=Math.floor(b/size),bc=b%size;
  return a!==b&&Math.abs(ar-br)<=1&&Math.abs(ac-bc)<=1;
}
function kitchenPathNeighbours(index,size=4){
  const r=Math.floor(index/size),c=index%size,out=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<size&&nc>=0&&nc<size)out.push(nr*size+nc);
  }
  return out;
}
function kitchenValidatePathPuzzle(puzzle,answer){
  if(!puzzle||puzzle.size!==4||!Array.isArray(puzzle.cells)||puzzle.cells.length!==16||!Array.isArray(puzzle.targetPath))return false;
  if(puzzle.targetPath.length!==answer.length||new Set(puzzle.targetPath).size!==puzzle.targetPath.length)return false;
  for(let i=0;i<puzzle.targetPath.length;i++){
    const idx=puzzle.targetPath[i];if(!Number.isInteger(idx)||idx<0||idx>=16)return false;
    if(i&& !kitchenPathAdjacent(puzzle.targetPath[i-1],idx,4))return false;
    if(puzzle.cells[idx]!==answer[i])return false;
  }
  return puzzle.targetPath.map(i=>puzzle.cells[i]).join("")===answer;
}
function kitchenGeneratePathPuzzle(answer,seed,forbiddenLetters=[]){
  if(!/^[a-z]{1,8}$/.test(answer))return null;
  const blocked=new Set(forbiddenLetters||[]),baseFiller="etaoinshrdlucmfwypvbgkjqxz";
  /* Revealed clue characters should not reappear as selectable filler.
     Required duplicate letters remain on the validated target path. */
  const filler=[...baseFiller].filter(ch=>!blocked.has(ch)).join("")||baseFiller;
  const size=4,base=kitchenSeedFromString(`${answer}:${seed}`);
  for(let retry=0;retry<64;retry++){
    const rng=kitchenSeededRandom((base+Math.imul(retry+1,2654435761))>>>0);
    const start=Math.floor(rng()*16),path=[start],used=new Set(path);
    function walk(){
      if(path.length===answer.length)return true;
      const choices=kitchenSeededShuffle(kitchenPathNeighbours(path[path.length-1],size).filter(i=>!used.has(i)),rng);
      for(const next of choices){used.add(next);path.push(next);if(walk())return true;path.pop();used.delete(next);}
      return false;
    }
    if(!walk())continue;
    const cells=Array.from({length:16},()=>filler[Math.floor(rng()*filler.length)]);
    path.forEach((idx,i)=>{cells[idx]=answer[i];});
    const puzzle={size,cells,targetPath:path.slice(),seed:base,retry};
    if(kitchenValidatePathPuzzle(puzzle,answer))return puzzle;
  }
  return null;
}
function kitchenRequiredIndexes(run){
  const ans=run?.currentQuestion?.ans||"";
  if(run?.currentMode==="path")return ans.split("").map((_,i)=>i);
  const shown=new Set(run?.revealedLetterIndexes||[]);
  return ans.split("").map((_,i)=>i).filter(i=>!shown.has(i));
}
function kitchenRequiredAnswer(run){
  const ans=run?.currentQuestion?.ans||"";
  if(run?.currentMode==="path")return ans;
  return kitchenRequiredIndexes(run).map(i=>ans[i]).join("");
}
function kitchenBuildTiles(answer,mode,forbiddenLetters=[]){
  const blocked=new Set(forbiddenLetters);
  const extras=mode==="scramble"?[]:kitchenExtraLetters(answer,answer.length>=6?3:4).filter(ch=>!blocked.has(ch));
  while(mode!=="scramble"&&extras.length<(answer.length>=6?3:4)){
    const more=kitchenExtraLetters(answer,1)[0];if(!blocked.has(more))extras.push(more);
  }
  const source=mode==="scramble"?kitchenShuffleUnsolved(answer):shuffle([...answer.split(""),...extras]);
  return source.map((ch,i)=>({id:`${mode}-${i}-${ch}-${Math.random().toString(36).slice(2,7)}`,ch,used:false,hintLocked:false}));
}
function kitchenLockSurplusHintTiles(run){
  if(!run||run.currentMode==="path")return;
  /* A selected tile cannot be assumed to fill the next answer position:
     Conveyor and Scramble deliberately let players explore in any order.
     Count the actual remaining letter multiset, then subtract selected tiles
     of the same character before locking copies made redundant by a hint. */
  const ans=run.currentQuestion.ans,revealed=new Set(run.revealedLetterIndexes||[]);
  const needed={};ans.split("").forEach((ch,i)=>{if(!revealed.has(i))needed[ch]=(needed[ch]||0)+1;});
  const selectedIds=new Set(run.currentAnswer||[]),tileById=new Map((run.currentTiles||[]).map(tile=>[tile.id,tile]));
  const clueChars=new Set([...revealed].map(i=>ans[i]));
  const candidates={};
  (run.currentTiles||[]).forEach(tile=>{
    if(selectedIds.has(tile.id)||tile.hintLocked||!clueChars.has(tile.ch))return;
    (candidates[tile.ch]||(candidates[tile.ch]=[])).push(tile);
  });
  clueChars.forEach(ch=>{
    const selectedOfThisChar=(run.currentAnswer||[]).reduce((count,id)=>count+(tileById.get(id)?.ch===ch?1:0),0);
    let keep=Math.max(0,(needed[ch]||0)-selectedOfThisChar);
    (candidates[ch]||[]).forEach(tile=>{
      if(keep>0){keep--;return;}
      tile.used=true;tile.hintLocked=true;
    });
  });
}
function kitchenVerifyCompletable(run){
  if(!run||run.currentMode==="path")return true;
  const ans=run.currentQuestion.ans,revealed=new Set(run.revealedLetterIndexes||[]);
  const needed={};ans.split("").forEach((ch,i)=>{if(!revealed.has(i))needed[ch]=(needed[ch]||0)+1;});
  const tileById=new Map((run.currentTiles||[]).map(tile=>[tile.id,tile])),selectedOf={},availableOf={};
  (run.currentAnswer||[]).forEach(id=>{const tile=tileById.get(id);if(tile)selectedOf[tile.ch]=(selectedOf[tile.ch]||0)+1;});
  (run.currentTiles||[]).filter(tile=>!tile.used).forEach(tile=>{availableOf[tile.ch]=(availableOf[tile.ch]||0)+1;});
  Object.entries(needed).forEach(([ch,count])=>{
    const stillOwed=Math.max(0,count-(selectedOf[ch]||0));
    while((availableOf[ch]||0)<stillOwed){
      const locked=[...(run.currentTiles||[])].reverse().find(tile=>tile.hintLocked&&tile.used&&tile.ch===ch);
      if(!locked)break;
      locked.used=false;locked.hintLocked=false;availableOf[ch]=(availableOf[ch]||0)+1;
    }
  });
  return Object.entries(needed).every(([ch,count])=>Math.max(0,count-(selectedOf[ch]||0))<=(availableOf[ch]||0));
}
function kitchenPrepareRound(run){
  const mode=kitchenModeForRun(run);
  for(let attempt=0;attempt<18;attempt++){
    const q=kitchenPickQuestion(run,mode);if(!q)return false;
    run.currentMode=mode;run.currentQuestion=q;run.currentAnswer=[];run.currentPath=[];run.currentPathPuzzle=null;
    run.conveyorMovesThisRound=0;run.roundIndex=run.correct;run.feedback="";run.review=null;run.celebrateStep=0;kitchenInitRoundHelp(run);
    const required=kitchenRequiredAnswer(run),blocked=(run.revealedLetterIndexes||[]).map(i=>q.ans[i]);
    if(mode==="path"){
      const pathPuzzle=kitchenGeneratePathPuzzle(required,`${q.key}:${run.correct}:${attempt}`,blocked);
      if(!pathPuzzle){
        const p=P(),k=p&&kitchenOf(p);if(k){const key="path_generation";k.stats.fallbacks[key]=(k.stats.fallbacks[key]||0)+1;}
        continue;
      }
      run.currentPathPuzzle=pathPuzzle;run.currentTiles=[];
    }else{
      run.currentTiles=kitchenBuildTiles(required,mode,blocked);
      kitchenLockSurplusHintTiles(run);
      kitchenVerifyCompletable(run);
    }
    return true;
  }
  return false;
}
function kitchenRecordRoundStart(run){
  const p=P();if(!p||!run||!run.currentMode)return;
  const k=kitchenOf(p),r=k.stats.modeResults[run.currentMode];
  if(r)r.starts=(r.starts||0)+1;
  const qk=run.currentQuestion&&k.stats.questionKinds[run.currentQuestion.kind];if(qk)qk.starts=(qk.starts||0)+1;
  run.roundStartedAt=Date.now();persist();
}
function kitchenAccumulateModeTime(run){
  if(!run||!run.roundStartedAt||!run.currentMode)return;
  run.modeActiveMs[run.currentMode]=(run.modeActiveMs[run.currentMode]||0)+Math.max(0,Date.now()-run.roundStartedAt);
  run.roundStartedAt=0;
}
function kitchenTileById(run,id){return (run.currentTiles||[]).find(t=>t.id===id)||null;}
function kitchenSelectedLetters(run){
  if(run&&run.currentMode==="path")return (run.currentPath||[]).map(i=>run.currentPathPuzzle?.cells?.[i]||"");
  return (run?.currentAnswer||[]).map(id=>kitchenTileById(run,id)?.ch||"");
}
function kitchenAnswerText(run){
  if(!run?.currentQuestion)return "";
  const selected=kitchenSelectedLetters(run);
  /* Word Path always validates the complete traced word. Hints are visual
     guides only and must never auto-consume or shift a selected letter. */
  if(run.currentMode==="path")return selected.join("");
  const ans=run.currentQuestion.ans,shown=new Set(run.revealedLetterIndexes||[]);let cursor=0;
  return ans.split("").map((ch,i)=>shown.has(i)?ch:(selected[cursor++]||"")).join("");
}
function kitchenClueLabel(kind){return kitchenTypeRules(activeCourseId()).find(rule=>rule.kind===kind)?.label||"Vocabulary clue";}
function kitchenWordForAnswer(q){if(!q)return null;const key=kitchenAnswerKey(q.ans);return allWords().find(w=>kitchenAnswerKey(w.w)===key)||null;}
function kitchenDefinitionForQuestion(q){const w=kitchenWordForAnswer(q);if(w?.def)return w.def;const exp=stripTags(q?.explain||"");return exp||"This is the intended answer for the clue.";}
function kitchenInitRoundHelp(run){
  const ans=run?.currentQuestion?.ans||"";if(!ans)return;
  const randomIndex=1+(kitchenSeedFromString(`${run.currentQuestion.key}:${run.correct}:shown`)%Math.max(1,ans.length-1));
  run.revealedLetterIndexes=[0,Math.min(ans.length-1,randomIndex)];
  run.extraLetterBought=false;run.pronunciationBought=false;
}
function kitchenHintPattern(run){const ans=run?.currentQuestion?.ans||"",shown=new Set(run?.revealedLetterIndexes||[]);return ans.split("").map((ch,i)=>shown.has(i)?ch:"");}
function kitchenRevealExtraLetter(){
  const run=KITCHEN_RUN,p=P();if(!run||run.status!=="active"||!p||run.extraLetterBought)return;
  const cost=KITCHEN_CONFIG.extraLetterCost;
  if((p.tips||0)<cost){toast(`You need ${cost} coins to reveal another letter.`);return;}
  const oldRequired=kitchenRequiredIndexes(run),filled=kitchenSelectedLetters(run).length,shown=new Set(run.revealedLetterIndexes||[]);
  let candidates=run.currentMode==="path"
    ? oldRequired.filter(i=>!shown.has(i)&&i>=filled)
    : oldRequired.slice(filled);
  if(!candidates.length&&run.currentMode==="path")candidates=oldRequired.filter(i=>!shown.has(i));
  if(!candidates.length){toast("Every remaining position is already filled.");return;}
  const idx=candidates[kitchenSeedFromString(`${run.currentQuestion.key}:extra`)%candidates.length],ch=run.currentQuestion.ans[idx];
  p.tips-=cost;run.extraLetterBought=true;run.analyticsHints=(run.analyticsHints||0)+1;run.revealedLetterIndexes.push(idx);run.revealedLetterIndexes.sort((a,b)=>a-b);
  if(run.currentMode==="path"){
    run.currentPath=[];
  }else{
    kitchenLockSurplusHintTiles(run);
    kitchenVerifyCompletable(run);
  }
  persist();AudioKit.cue("spend");renderKitchenChallenge();
}
function kitchenPronounceHint(){const run=KITCHEN_RUN,p=P();if(!run||run.status!=="active"||!p)return;if(!Voice.available()){toast("Turn Voice on in Settings to use pronunciation.");return;}let spent=false;if(!run.pronunciationBought){spent=true;const cost=KITCHEN_CONFIG.pronunciationCost;if((p.tips||0)<cost){toast(`You need ${cost} coins to hear the word.`);return;}p.tips-=cost;run.pronunciationBought=true;run.analyticsHints=(run.analyticsHints||0)+1;persist();}if(spent)AudioKit.cue("spend");else AudioKit.tap();Voice.speak(run.currentQuestion.ans);}
function kitchenStepIconHTML(icon,label=""){
  if(!/^[a-z0-9-]+$/.test(icon||""))return `<span aria-hidden="true">${esc(icon||"🍳")}</span>`;
  return `<img src="assets/kitchen-steps/${icon}.svg" alt="" aria-hidden="true" title="${esc(label)}">`;
}
function kitchenProgressHTML(run,template){
  /* S13: three large step pictures at a time: this round and the next two
     (the last three once the recipe is nearly done). On the answer review
     the window starts at the step just finished, so it is seen landing. */
  const n=template.steps.length,cur=run.celebrateStep?run.celebrateStep-1:Math.min(run.correct,n-1);
  const start=Math.max(0,Math.min(cur,n-3));
  return template.steps.slice(start,start+3).map((icon,k)=>{const i=start+k;
  /* The step just completed is tagged so it can pop once, giving each correct
     answer a visible landing point on the recipe strip. */
  const justDone=run.celebrateStep&&i===run.celebrateStep-1?" justdone":"",now=i===run.correct&&!run.celebrateStep?" current":"";
  return `<div class="kitchenstep ${i<run.correct?"done":"inactive"}${justDone}${now}" aria-label="${esc(template.labels[i])}${i<run.correct?", completed":", not completed"}"><b class="kstepno">${i+1}/${n}</b>${kitchenStepIconHTML(icon,template.labels[i])}<small>${esc(template.labels[i])}</small></div>`;
}).join("");}
function kitchenPathPoints(run){
  return (run?.currentPath||[]).map(i=>`${(i%4)+.5},${Math.floor(i/4)+.5}`).join(" ");
}
function kitchenPathHintCells(run){
  const puzzle=run?.currentPathPuzzle,hints=new Set(run?.revealedLetterIndexes||[]);
  if(!puzzle||!Array.isArray(puzzle.targetPath))return new Set();
  return new Set(puzzle.targetPath.filter((_,i)=>hints.has(i)));
}
const KITCHEN_PATH_POINTER={active:false,pointerId:null,lastIndex:null,lastX:null,lastY:null,ignoreClickUntil:0};
function refreshKitchenPathUI(){
  const run=KITCHEN_RUN;if(!run||run.currentMode!=="path")return;
  const path=run.currentPath||[],cells=run.currentPathPuzzle?.cells||[],required=kitchenRequiredIndexes(run),answerLen=required.length;
  $$('[data-kitchen-path-cell]').forEach(cell=>{
    const idx=Number(cell.dataset.kitchenPathCell),order=path.indexOf(idx),selected=order>=0;
    cell.classList.toggle("selected",selected);
    cell.setAttribute("aria-label",`Letter ${cells[idx]||""}${selected?`, selected ${order+1}`:""}`);
    let badge=cell.querySelector("small");
    if(selected){if(!badge){badge=document.createElement("small");cell.appendChild(badge);}badge.textContent=String(order+1);}
    else if(badge)badge.remove();
  });
  const chars=path.map(i=>cells[i]||""),hints=kitchenHintPattern(run);
  $$('.kitchenanswer .slot').forEach((slot,i)=>{
    const clue=hints[i]||"",entered=chars[i]||"";
    slot.textContent=entered||clue;
    slot.classList.toggle("fill",!!entered);
    slot.classList.toggle("clue",!!clue&&!entered);
    slot.classList.toggle("hint-crossed",!!clue&&!!entered);
  });
  const line=$(".kitchenpathlines polyline");if(line)line.setAttribute("points",kitchenPathPoints(run));
  const has=path.length>0,full=path.length===answerLen,active=run.status==="active";
  const back=$("#kBackLetter"),clear=$("#kClear"),submit=$("#kSubmit");
  if(back)back.disabled=!(has&&active);if(clear)clear.disabled=!(has&&active);if(submit)submit.disabled=!(full&&active);
}
function kitchenPathVisit(index,{audio=false}={}){
  const run=KITCHEN_RUN;if(!run||run.status!=="active"||run.currentMode!=="path"||!run.currentPathPuzzle)return false;
  const path=run.currentPath||(run.currentPath=[]),answerLen=kitchenRequiredIndexes(run).length;
  if(!Number.isInteger(index)||index<0||index>=16)return false;
  const existing=path.indexOf(index);let changed=false;
  if(existing>=0){
    /* Build 86g-phase13: this used to truncate the path back to ANY already
       selected cell the finger touched (path.splice(existing+1)). On a 4x4
       grid with diagonal moves the trail constantly runs back alongside
       itself, so brushing a cell chosen four letters ago silently wiped four
       letters — the reported "it reverses when I try to reach another
       letter". Backtracking is now limited to the ONE cell before the tip,
       which is the standard word-trace gesture: drag back over your last
       letter to undo it. Touching anything earlier is ignored rather than
       destructive. Dragging over the tip itself still does nothing. */
    if(existing===path.length-2){path.pop();changed=true;}
  }else if(path.length<answerLen&&(!path.length||kitchenPathAdjacent(path[path.length-1],index,4))){path.push(index);changed=true;}
  if(changed){if(existing>=0)cancelKitchenReady();if(audio){if(existing>=0)AudioKit.cue("letter-back");else kitchenFillSound(path.length,answerLen);}refreshKitchenPathUI();}
  return changed;
}
function bindKitchenPathDrag(){
  const grid=$(".kitchenpathgrid");if(!grid)return;
  /* Build 86g-phase13: elementFromPoint counts ANY pixel inside a cell's box,
     including the outermost edge, so a diagonal drag clipped the corners of
     cells it was only passing over. Requiring the finger to reach the cell's
     inner zone means grazing a corner no longer selects it, while the whole
     comfortable middle of the cell still does. */
  const KITCHEN_PATH_HIT_INSET=0.37;
  const cellAt=(x,y)=>{
    const el=document.elementFromPoint(x,y),cell=el&&el.closest&&el.closest('[data-kitchen-path-cell]');
    if(!cell||!grid.contains(cell))return null;
    const r=cell.getBoundingClientRect();
    if(Math.abs(x-(r.left+r.width/2))>r.width*KITCHEN_PATH_HIT_INSET)return null;
    if(Math.abs(y-(r.top+r.height/2))>r.height*KITCHEN_PATH_HIT_INSET)return null;
    return cell;
  };
  const visit=(x,y)=>{const cell=cellAt(x,y);if(!cell)return;const idx=Number(cell.dataset.kitchenPathCell);if(idx===KITCHEN_PATH_POINTER.lastIndex)return;KITCHEN_PATH_POINTER.lastIndex=idx;kitchenPathVisit(idx,{audio:true});};
  const sample=(x,y)=>{const p=KITCHEN_PATH_POINTER;if(!Number.isFinite(p.lastX)||!Number.isFinite(p.lastY)){visit(x,y);p.lastX=x;p.lastY=y;return;}const dx=x-p.lastX,dy=y-p.lastY,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5));for(let i=1;i<=steps;i++)visit(p.lastX+dx*i/steps,p.lastY+dy*i/steps);p.lastX=x;p.lastY=y;};
  const end=e=>{if(!KITCHEN_PATH_POINTER.active||e.pointerId!==KITCHEN_PATH_POINTER.pointerId)return;if(Number.isFinite(e.clientX)&&Number.isFinite(e.clientY))sample(e.clientX,e.clientY);KITCHEN_PATH_POINTER.active=false;KITCHEN_PATH_POINTER.ignoreClickUntil=Date.now()+450;KITCHEN_PATH_POINTER.pointerId=null;KITCHEN_PATH_POINTER.lastIndex=null;KITCHEN_PATH_POINTER.lastX=null;KITCHEN_PATH_POINTER.lastY=null;try{grid.releasePointerCapture(e.pointerId);}catch(_){}};
  grid.addEventListener("pointerdown",e=>{const cell=e.target.closest('[data-kitchen-path-cell]');if(!cell||!grid.contains(cell)||!KITCHEN_RUN||KITCHEN_RUN.status!=="active")return;e.preventDefault();KITCHEN_PATH_POINTER.active=true;KITCHEN_PATH_POINTER.pointerId=e.pointerId;KITCHEN_PATH_POINTER.lastIndex=null;KITCHEN_PATH_POINTER.lastX=null;KITCHEN_PATH_POINTER.lastY=null;const k=kitchenOf(P());k.stats.pathDrags=(k.stats.pathDrags||0)+1;try{grid.setPointerCapture(e.pointerId);}catch(_){}sample(e.clientX,e.clientY);},{passive:false});
  grid.addEventListener("pointermove",e=>{if(!KITCHEN_PATH_POINTER.active||e.pointerId!==KITCHEN_PATH_POINTER.pointerId)return;e.preventDefault();sample(e.clientX,e.clientY);},{passive:false});grid.addEventListener("pointerup",end);grid.addEventListener("pointercancel",end);grid.addEventListener("lostpointercapture",end);
}
function kitchenTilesForDisplay(run,mode){return (run.currentTiles||[]).slice();}
let KITCHEN_MENU_TAB="drinks";
function kitchenTemplate(food){
  const base=KITCHEN_TEMPLATES[food?.template]||KITCHEN_TEMPLATES.counter;
  if(Array.isArray(food?.steps)&&food.steps.length===7&&Array.isArray(food?.labels)&&food.labels.length===7){
    return {...base,steps:food.steps,labels:food.labels};
  }
  return base;
}
function kitchenFoodTicket(food){
  if(!food||food.drinkKind)return null;
  const fk=FOOD_KINDS[food.id]||{};
  if(food.id==="icecream")return {kind:"icecream",name:"Vanilla Ice Cream",color:"#F7EFD8",emoji:"🍦"};
  return {kind:food.id,name:food.name,color:fk.color||"#C97B4A",emoji:food.emoji||fk.emoji||"🍽️"};
}
function kitchenItemArt(food){
  if(food?.drinkKind){const d=DRINK_KINDS[food.drinkKind],ticket={drinkKind:food.drinkKind,drinkColor:d?.colors?.[0]||"#9CCBDB"};return drinkSVG(ticket,true);}
  return foodSVG(kitchenFoodTicket(food),true);
}
function kitchenLastAttemptText(k,foodId){
  const last=k.lastAttemptByFood[foodId];
  return last?`${last.correct}/7 · ${last.mistakes} mistake${last.mistakes===1?"":"s"} · ${last.timeout?"timed out":`${last.remaining}s left`}`:"No attempt yet";
}
function kitchenBestText(k,foodId){
  const best=k.bestByFood[foodId];
  if(!best||!best.attempts)return "No challenge record yet";
  return `Best: ${best.bestCorrect||0}/7 · ${best.fewestMistakes??0} mistake${best.fewestMistakes===1?"":"s"} · ${best.bestRemaining||0}s left`;
}
function kitchenMenuCard(food,k){
  const unlocked=k.unlockedFoods.includes(food.id),served=k.foodServeCounts[food.id]||0,itemType=food.drinkKind?"drink":"dish";
  const timer=KITCHEN_CONFIG.timers[food.tier]||KITCHEN_CONFIG.timers.core;
  if(unlocked){
    const today=localDayKey(),paidToday=k.rewardedToday?.[food.id]===today,used=kitchenDailyRewardsUsed(k,today),dailyFull=used>=KITCHEN_CONFIG.dailyPaidCompletions;
    const rewardStatus=paidToday?"Today’s recipe reward collected":dailyFull?"Free practice · daily rewards complete":`Reward ready · ${esc(food.tier)}`;
    return `<article class="kitchenfoodcard felt unlocked" data-food-card="${food.id}"><div class="kitchenfoodart ${food.drinkKind?"kitchendrinkart":""}">${kitchenItemArt(food)}</div><div class="kitchenfoodcopy"><h3>${esc(food.name)}</h3><span class="kitchenbadge">✅ Available in café</span><small>${esc(kitchenBestText(k,food.id))}<br>${rewardStatus} · Served: ${served}</small></div><button class="felt mini primary" data-kitchen-food="${food.id}">Cook again</button></article>`;
  }
  return `<article class="kitchenfoodcard felt locked" data-food-card="${food.id}"><div class="kitchenlockedart" aria-hidden="true">${food.drinkKind?"🥤":"🍽️"}</div><div class="kitchenfoodcopy"><h3>${esc(food.name)}</h3><span class="kitchenbadge">Locked ${itemType} · ${esc(food.tier)} · ${timer}s</span><small>${esc(kitchenLastAttemptText(k,food.id))}</small></div><button class="felt mini primary" data-kitchen-food="${food.id}">Challenge</button></article>`;
}
const KITCHEN_CHEF_COMMENTS={
  start:["Apron on — let’s cook!","Ready, chef? Let’s begin!","Seven steps to something delicious!"],
  next:["Next ingredient!","Keep it cooking!","Lovely work — next step!","The recipe is coming together!","Steady hands, chef!"],
  correct:["Perfect!","Brilliant cooking!","Nicely prepared!","That’s the one!","Excellent ingredient!"],
  wrong:["Almost — check the answer!","Nearly! Learn it, then keep cooking.","A small wobble — you can recover!","Not this time, chef — study the word!"],
  final:["Final ingredient — make it count!","One last step!","Nearly ready to serve!"],
  ready:["Ready to serve!","The dish is complete!","Chef’s special is ready!"]
};
/* Build 86g-phase9: every correct step now gets a moment of its own. The
   milestone pools escalate as the dish comes together, so step 6 feels bigger
   than step 1 instead of drawing from one flat "correct" list. Shared by both
   courses — Kitchen uses the same run/template machinery for 11+ and Everyday. */
const KITCHEN_STEP_CHEER={
  1:["Great start, chef! 🌟","First ingredient in! 👏","Off to a lovely start! ✨"],
  2:["Two down — you’re flying! 🎉","Lovely rhythm, chef! 🌟","That’s two perfect steps! 👏"],
  3:["Halfway there! 🔥 Smells amazing!","Three in a row — brilliant! 🎉","The kitchen is buzzing! ✨"],
  4:["Four steps done! You’re a natural! 🌟","Look at that dish coming together! 🎉","Superb work, chef! 🔥"],
  5:["Five! Nearly there, chef! 🎉","Amazing cooking — two to go! 🌟","The dish is nearly ready! ✨"],
  6:["One step left! Make it count! 🔥","Six perfect steps! Final one! 🎉","So close — finish strong! 🌟"],
  7:["🔔 DING! Order up, chef! 🎉","Perfect dish — beautifully done! 🏆","You cooked it all! Amazing! 🌟"]
};
const KITCHEN_CHEER_EMOJI={
  1:["⭐","✨","👏"],2:["⭐","✨","🎉"],3:["🔥","⭐","🎉","✨"],
  4:["🎉","⭐","✨","👏"],5:["🎉","🌟","✨","🔥"],
  6:["🔥","🎉","🌟","⭐","✨"],7:["🎉","🏆","🌟","🔔","✨","⭐"]
};
function kitchenStepCheer(step,run,template){
  const pool=KITCHEN_STEP_CHEER[step];
  if(!pool)return kitchenChefLine("correct",run);
  const seed=kitchenSeedFromString(`${run?.foodId||"kitchen"}:${step}:cheer:${Date.now()}`);
  const line=pool[seed%pool.length];
  /* Name the step the child just finished ("Patties shaped!") so the praise is
     about the cooking, not just the spelling. */
  const label=template&&template.labels&&template.labels[step-1];
  return label?`${label} done! ${line}`:line;
}
/* Emoji burst reusing the existing .confetti/fall CSS. Skipped entirely when
   the child has reduced motion or battery saver on, and self-cleans so no
   node or timer is left behind. */
function kitchenCelebrateStep(step){
  const p=P();
  if(!p||p.settings.motion==="reduced"||p.settings.batterySaver)return;
  if(typeof document==="undefined"||!document.body||document.hidden)return;
  const set=KITCHEN_CHEER_EMOJI[step]||KITCHEN_CHEER_EMOJI[1];
  const count=Math.min(18,6+step*2);
  for(let i=0;i<count;i++){
    const bit=document.createElement("div");
    bit.className="confetti";
    bit.textContent=set[i%set.length];
    bit.style.left=(4+Math.random()*92).toFixed(1)+"%";
    bit.style.animationDuration=(1.5+Math.random()*1.1).toFixed(2)+"s";
    bit.style.animationDelay=(Math.random()*0.35).toFixed(2)+"s";
    bit.style.fontSize=(0.95+Math.random()*0.75).toFixed(2)+"rem";
    document.body.appendChild(bit);
    setTimeout(()=>{try{bit.remove();}catch(_){}} ,2900);
  }
}
/* S9c: Dictation cues. Each right ingredient climbs like a combo (the
   Kitchen "clink" stays on top); steps 3 and 5 add the round chime; the
   last step is the fanfare. */
function kitchenCelebrationSound(step){
  if(step===KITCHEN_CONFIG.correctRequired)AudioKit.cue("streak-fanfare");
  else AudioKit.cue(step>=3?"correct-combo":"correct",{streak:step});
  AudioKit.kitchenIngredient(step);
  if(step!==KITCHEN_CONFIG.correctRequired&&(step===3||step===5))setTimeout(()=>AudioKit.cue("round"),420);
}
function kitchenChefLine(type,run){
  const lines=KITCHEN_CHEF_COMMENTS[type]||KITCHEN_CHEF_COMMENTS.next;
  const seed=kitchenSeedFromString(`${run?.foodId||"kitchen"}:${run?.correct||0}:${run?.mistakes||0}:${type}:${Date.now()}`);
  return lines[seed%lines.length];
}
function kitchenProgressFeeling(run,template){
  if(!run||!template)return "Recipe progress";
  if(run.correct>=KITCHEN_CONFIG.correctRequired)return "🔔 Ready to Serve!";
  const next=template.labels[Math.min(run.correct,template.labels.length-1)]||"Next step";
  if(run.correct===KITCHEN_CONFIG.correctRequired-1)return `Final step: ${next}`;
  return `Next: ${next} · ${run.correct}/${KITCHEN_CONFIG.correctRequired}`;
}
function createKitchenRun(foodId){
  const food=kitchenFood(foodId);if(!food)return null;
  const total=(KITCHEN_CONFIG.timers[food.tier]||KITCHEN_CONFIG.timers.core)*1000;
  const run={foodId,tier:food.tier,roundIndex:0,correct:0,mistakes:0,totalMs:total,remainingMs:total,
    deadlineMs:0,pausedAtMs:null,pauseReason:null,modeDeck:kitchenDeck(),usedQuestionKeys:[],usedAnswers:[],status:"intro",
    feedback:"",timeout:false,finished:false,startedAt:0,currentMode:"",currentQuestion:null,currentTiles:[],currentAnswer:[],currentPath:[],currentPathPuzzle:null,
    roundStartedAt:0,modeActiveMs:{conveyor:0,scramble:0,path:0},analyticsHints:0,award:0,newUnlock:false,firstReward:false,rewardKind:"none",loading:false,chefComment:"",celebrateStep:0};
  return kitchenRunIsValid(run)?run:null;
}
function kitchenDrinkCards(k){return KITCHEN_FOODS.filter(x=>x.category==="drinks").map(food=>kitchenMenuCard(food,k)).join("");}
function screenKitchenMenu(tab=KITCHEN_MENU_TAB,skipTutorialGate=false){
  clearKitchenTimers();KITCHEN_RUN=null;AudioKit.ambientStart();const p=P(),k=kitchenOf(p),catalogIssues=kitchenCatalogIssues();
  if(catalogIssues.length){show(`<section class="screen center kitchenmenu"><div class="topbar"><button class="iconb" id="back">←</button><b>Kitchen unavailable</b><span class="pill">Safe stop</span></div><div class="kitchenresult felt"><div class="kitchencloche">🧰</div><h2>Kitchen data check failed</h2><p>The Kitchen was stopped before gameplay so the main café remains safe.</p><small>${catalogIssues.map(esc).join("<br>")}</small></div></section>`);$("#back").onclick=()=>screenMenu();return;}
  if(!skipTutorialGate&&!k.tutorial.completed&&!k.tutorial.skipped){startKitchenTutorial();return;}
  KITCHEN_MENU_TAB=KITCHEN_MENU_CATEGORIES.some(x=>x.id===tab)?tab:"drinks";const isDrinks=KITCHEN_MENU_TAB==="drinks",foods=isDrinks?[]:KITCHEN_FOODS.filter(x=>x.category===KITCHEN_MENU_TAB),unlockedChallenge=KITCHEN_CHALLENGE_FOODS.filter(x=>k.unlockedFoods.includes(x.id)).length,totalChallenges=KITCHEN_CHALLENGE_FOODS.length,dailyUsed=kitchenDailyRewardsUsed(k);
  const content=isDrinks?`<div class="kitchenfoodgrid">${kitchenDrinkCards(k)}</div>`:`<div class="kitchenfoodgrid">${foods.map(food=>kitchenMenuCard(food,k)).join("")}</div>`;
  show(`<section class="screen center kitchenmenu"><div class="topbar"><button class="iconb" id="back">←</button><b>Kitchen menu</b><span class="pill">Drinks & recipes</span></div><div class="note"><b>Your café menu:</b> complete Kitchen challenges to unlock Smoothies, Fizzy Drinks, Burger, Hot Dog and more.</div><div class="kitchenmenustats"><span>🍽️ ${unlockedChallenge}/${totalChallenges} recipes</span><span>🎁 Daily rewards: ${dailyUsed}/${KITCHEN_CONFIG.dailyPaidCompletions}</span><span>${COIN} ${p.tips}</span></div><div class="tabbar kitchentabs">${KITCHEN_MENU_CATEGORIES.map(c=>`<button class="tab ${c.id===KITCHEN_MENU_TAB?"on":""}" data-kitchen-menu-tab="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join("")}</div>${content}<div class="custactions"><button class="felt mini" id="kStats">Kitchen stats</button><button class="felt mini" id="kTutorialReplay">Replay tutorial</button></div></section>`);
  $("#back").onclick=()=>{AudioKit.tap();screenMenu();};$$('[data-kitchen-menu-tab]').forEach(b=>b.onclick=()=>{AudioKit.tap();screenKitchenMenu(b.dataset.kitchenMenuTab);});$$('[data-kitchen-food]').forEach(b=>b.onclick=()=>{AudioKit.tap();screenKitchenIntro(b.dataset.kitchenFood);});$("#kStats").onclick=()=>{AudioKit.tap();screenKitchenStats();};$("#kTutorialReplay").onclick=()=>{AudioKit.tap();startKitchenTutorial();};
}
function kitchenPct(num,den){return den?Math.round(num*100/den):0;}
function kitchenSeconds(ms,count){return count?Math.round(ms/Math.max(1,count)/1000):0;}
function screenKitchenStats(){
  const p=P(),k=p&&kitchenOf(p);if(!p||!k){screenKitchenMenu();return;}
  const st=k.stats,success=kitchenPct(st.challengesWon,st.challengesStarted),unlocked=KITCHEN_CHALLENGE_FOODS.filter(f=>k.unlockedFoods.includes(f.id)).length;
  const modeRows=["conveyor","scramble","path"].map(mode=>{const r=st.modeResults[mode]||{},attempts=(r.successes||0)+(r.mistakes||0),acc=kitchenPct(r.successes||0,attempts),avg=kitchenSeconds(r.activeMs||0,Math.max(1,r.starts||0));return `<div class="srow"><span>${esc(kitchenModeLabel(mode))}</span><b>${acc}% · ${avg}s avg · ${r.starts||0} rounds</b></div>`;}).join("");
  const kindRows=kitchenTypeRules(p.courseId).map(rule=>{const r=st.questionKinds[rule.kind]||{},attempts=(r.correct||0)+(r.wrong||0);return `<div class="srow"><span>${esc(rule.statsLabel)}</span><b>${kitchenPct(r.correct||0,attempts)}% · ${r.starts||0} shown</b></div>`;}).join("");
  const fail=st.failReasons||{},fallbackTotal=Object.values(st.fallbacks||{}).reduce((a,b)=>a+(Number(b)||0),0);
  const drops=Object.entries(st.dropOffRound||{}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([r,n])=>`R${r}: ${n}`).join(" · ")||"None";
  show(`<section class="screen"><div class="topbar"><button class="iconb" id="back">←</button><b>Kitchen stats</b><span class="pill">Local only</span></div>
    <div class="kitchenanalyticsgrid"><div class="metric-card"><small>Recipes</small><div class="viz-stat-value">${unlocked}/${KITCHEN_CHALLENGE_FOODS.length}</div></div><div class="metric-card"><small>Success</small><div class="viz-stat-value">${success}%</div></div><div class="metric-card"><small>Perfect wins</small><div class="viz-stat-value">${st.perfectWins||0}</div></div><div class="metric-card"><small>First-attempt wins</small><div class="viz-stat-value">${st.firstAttemptWins||0}</div></div></div>
    <div class="setcard felt"><h3>Mini-games</h3>${modeRows}</div>
    <div class="setcard felt"><h3>Question clues</h3>${kindRows}</div>
    <div class="setcard felt"><h3>Failures and routing</h3><div class="srow"><span>Timeout</span><b>${fail.timeout||0}</b></div><div class="srow"><span>Third mistake</span><b>${fail.mistakes||0}</b></div><div class="srow"><span>Abandoned</span><b>${fail.abandoned||0}</b></div><div class="srow"><span>Question fallback</span><b>${fallbackTotal}</b></div><p class="note"><small>Drop-off by round: ${esc(drops)}<br>Path drags: ${st.pathDrags||0} · Conveyor moves: ${st.conveyorMoves||0}</small></p></div>
    <p class="note"><small>These figures stay on this device and are used only to tune difficulty and fairness.</small></p></section>`);
  $("#back").onclick=()=>screenKitchenMenu(KITCHEN_MENU_TAB,true);
}
function screenKitchenIntro(foodId){
  clearKitchenTimers();KITCHEN_RUN=createKitchenRun(foodId);const food=kitchenFood(foodId);if(!food||!KITCHEN_RUN){toast("Kitchen challenge could not start safely.");screenKitchenMenu();return;}
  const conveyor=kitchenQuestionIndex(food.tier,"conveyor"),scramble=kitchenQuestionIndex(food.tier,"scramble"),path=kitchenQuestionIndex(food.tier,"path"),template=kitchenTemplate(food);
  show(`<section class="screen center kitchenchallenge">
    <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>${esc(food.name)} challenge</b><span></span></div>
    <div class="kitchenresult felt"><div class="kitchencloche">🍽️</div><h2>${esc(template.name)} recipe</h2>
      <p>Reach <b>7 correct</b>. Two submitted mistakes are allowed; the third ends the run.</p>
      <p><b>3 Conveyor</b> · <b>2 Scramble</b> · <b>2 Path</b>. Word Path remains the finale.</p>
      <div class="kitchensteppreview">${template.steps.map((icon,i)=>`<span title="${esc(template.labels[i])}">${kitchenStepIconHTML(icon,template.labels[i])}</span>`).join("")}</div>
      <p><small>${conveyor.items.length} Conveyor clues · ${scramble.items.length} Scramble clues · ${path.items.length} Path clues. Finished dish artwork stays hidden until 7/7.</small></p>
      <button class="felt big primary" id="beginKitchen" ${(conveyor.items.length&&scramble.items.length&&path.items.length)?"":"disabled"}>Start cooking</button></div>
  </section>`);
  $("#back").onclick=()=>{AudioKit.tap();KITCHEN_RUN=null;screenKitchenMenu(food.category);};
  const begin=$("#beginKitchen");if(begin)begin.onclick=()=>{AudioKit.tap();startKitchenRun();};
}
function startKitchenRun(){
  const run=KITCHEN_RUN,p=P(),food=run&&kitchenFood(run.foodId);if(!run||!p||!food||run.loading)return;
  run.loading=true;
  show(`<section class="screen center kitchenchallenge"><div class="topbar"><span></span><b>${esc(food.name)}</b><span></span></div><div class="kitchenloading felt"><div class="kitchenloadingchef">👩‍🍳</div><h2>Preparing the Kitchen…</h2><div class="kitchenloadingtools" aria-hidden="true">🥣 <span>•</span> 🔪 <span>•</span> 🍳</div><p>Questions, ingredients and cooking tools are getting ready.</p></div></section>`);
  setTimeout(()=>{
    if(KITCHEN_RUN!==run)return;run.loading=false;startKitchenRunReady();
  },480);
}
function startKitchenRunReady(){
  const run=KITCHEN_RUN,p=P();if(!run||!p)return;
  if(!kitchenPrepareRound(run)){alert(wbT("Kitchen could not find a suitable question yet. Please try again after the word bank finishes loading."));screenKitchenMenu();return;}
  const k=kitchenOf(p);run.status="active";run.startedAt=Date.now();run.deadlineMs=Date.now()+run.remainingMs;run.chefComment=kitchenChefLine("start",run);
  k.stats.challengesStarted=(k.stats.challengesStarted||0)+1;
  if(window.WordBarAnalytics){ WordBarAnalytics.startSession("kitchen", wbAnalyticsDifficulty(P().settings.diff), P().courseId||"unknown"); }
  const best=k.bestByFood[run.foodId]||(k.bestByFood[run.foodId]={attempts:0,bestCorrect:0,bestRemaining:0,fewestMistakes:KITCHEN_CONFIG.submittedMistakesAllowed+1,unlockedAt:0});
  best.attempts=(best.attempts||0)+1;kitchenRecordRoundStart(run);
  renderKitchenChallenge();scheduleKitchenTick();
}
function renderKitchenReview(){
  const run=KITCHEN_RUN,food=run&&kitchenFood(run.foodId),q=run?.currentQuestion;if(!run||!food||!q){screenKitchenMenu();return;}const template=kitchenTemplate(food),right=!!run.review?.right,definition=kitchenDefinitionForQuestion(q),phon=phoneticOf(q.ans),finalCorrect=right&&run.correct>=KITCHEN_CONFIG.correctRequired,finalWrong=!right&&run.mistakes>KITCHEN_CONFIG.submittedMistakesAllowed,nextLabel=finalCorrect?"Ready to Serve!":finalWrong?"See result":"Continue cooking";
  show(`<section class="screen center kitchenchallenge"><div class="topbar"><button class="felt mini kitchenexit" id="kExit">Exit</button><b>${esc(food.name)}</b><span class="pill">Review</span></div><div class="kitchenstatus"><span>Answer review</span><span>⏸️ Timer paused</span><span>✓ ${run.correct}/7 · ✕ ${run.mistakes}/${KITCHEN_CONFIG.submittedMistakesAllowed}</span></div><div class="kitchenprogresslabel">${esc(kitchenProgressFeeling(run,template))}</div><div class="kitchenprogress">${kitchenProgressHTML(run,template)}</div><div class="kitchenreview felt"><div class="kitchenchefbubble${right?" cheer":""}">👩‍🍳 ${esc(run.chefComment||kitchenChefLine(right?"correct":"wrong",run))}</div><h2>${right?"✓ Perfect!":"Almost!"}</h2><div class="reviewanswer" lang="en-GB">${esc(q.ans)}</div><div class="wordinfo"><b lang="en-GB">${esc(q.ans)}</b> ${phon?`<span class="phon">/${esc(phon)}/</span>`:""} ${Voice.available()?`<button class="speakbtn inline" id="kReviewSpeak">🔊</button>`:""}<div class="worddef" lang="en-GB">${esc(definition)}</div></div>${q.explain?`<div class="explain"><b>Why:</b> <span lang="en-GB">${esc(stripTags(q.explain))}</span></div>`:""}${!right?`<p class="note" data-i18n-html>You built <b lang="en-GB">${esc(run.review?.attempt||"")}</b>. The intended answer is shown above.</p>`:""}<div class="custactions"><button class="felt big primary" id="kReviewNext">${nextLabel}</button></div></div></section>`);
  $("#kExit").onclick=()=>pauseKitchen();const say=$("#kReviewSpeak");if(say)say.onclick=()=>{AudioKit.tap();Voice.speak(q.ans);};$("#kReviewNext").onclick=()=>{AudioKit.tap();kitchenAdvanceAfterFeedback();};
}
function renderKitchenChallenge(){
  const run=KITCHEN_RUN,food=run&&kitchenFood(run.foodId);if(!run||!food){screenKitchenMenu();return;}if(run.status==="feedback")return renderKitchenReview();
  const q=run.currentQuestion,mode=run.currentMode||kitchenModeForRun(run),answer=q?q.ans:"",template=kitchenTemplate(food),filledIds=run.currentAnswer||[],filledChars=kitchenSelectedLetters(run),requiredIndexes=kitchenRequiredIndexes(run),title=mode==="scramble"?"Unscramble the remaining letters":mode==="path"?"Connect the whole word path":"Build the missing letters from the conveyor",pathPoints=kitchenPathPoints(run),pathHintCells=kitchenPathHintCells(run),displayTiles=kitchenTilesForDisplay(run,mode),hint=kitchenHintPattern(run),lastSelectedId=filledIds.length?filledIds[filledIds.length-1]:null;
  const inputHTML=mode==="path"?`<div class="kitchenpathwrap"><div class="kitchenpathgrid" role="grid">${(run.currentPathPuzzle?.cells||[]).map((ch,i)=>{const order=(run.currentPath||[]).indexOf(i),hinted=pathHintCells.has(i);return `<button class="kitchenpathcell ${order>=0?"selected":""} ${hinted?"hinted":""}" data-kitchen-path-cell="${i}" ${run.status!=="active"?"disabled":""}><span>${esc(ch)}</span>${order>=0?`<small>${order+1}</small>`:""}</button>`;}).join("")}</div><svg class="kitchenpathlines" viewBox="0 0 4 4"><polyline points="${pathPoints}"/></svg></div>`:`<div class="kitchentiles ${mode==="conveyor"?"conveyorbelt":""}">${displayTiles.map(t=>{const removable=mode==="conveyor"&&t.used&&!t.hintLocked&&t.id===lastSelectedId,disabled=(t.used&&!removable)||t.hintLocked;return `<button class="kitchentile ${t.used?"used":""} ${t.hintLocked?"hint-locked":""} ${removable?"last-selected":""}" data-kitchen-tile="${t.id}" ${disabled||run.status!=="active"?"disabled":""} aria-pressed="${t.used?"true":"false"}">${esc(t.ch)}</button>`;}).join("")}</div>`;
  const canSubmit=(mode==="path"?(run.currentPath||[]).length:filledIds.length)===requiredIndexes.length,hasInput=mode==="path"?(run.currentPath||[]).length>0:filledIds.length>0;
  let selectedCursor=0;
  const slots=answer.split("").map((_,i)=>{
    const clue=hint[i]||"";
    if(mode==="path"){
      const entered=filledChars[i]||"",value=entered||clue,classes=`slot ${entered?"fill":""} ${clue&&!entered?"clue":""} ${clue&&entered?"hint-crossed":""}`;
      return `<div class="${classes}" aria-label="Position ${i+1}${clue?`, hinted letter ${clue}`:""}${entered?`, traced ${entered}`:""}">${value}</div>`;
    }
    if(clue)return `<div class="slot clue" aria-label="Given letter ${clue} at position ${i+1}">${clue}</div>`;
    const selectionIndex=selectedCursor,entered=filledChars[selectedCursor++]||"",returnable=!!entered&&(mode==="scramble"||(mode==="conveyor"&&selectionIndex===filledChars.length-1)),classes=`slot ${entered?"fill":""} ${returnable?"returnable":""}`;
    return returnable?`<button class="${classes}" data-kitchen-answer-index="${selectionIndex}" aria-label="Remove selected letter ${entered}">${entered}</button>`:`<div class="${classes}">${entered}</div>`;
  }).join("");
  show(`<section class="screen center kitchenchallenge"><div class="topbar"><button class="felt mini kitchenexit" id="back" aria-label="Pause">⏸️ Pause</button><b>${esc(food.name)}</b><span class="pill">Kitchen</span></div><div class="kitchenstatus"><span>Round ${Math.min(7,run.correct+1)} · ${kitchenModeLabel(mode)}</span><span id="kTimer">⏱️ ${kitchenRemainingSeconds(run)}s</span><span id="kScore">✓ ${run.correct}/7 · ✕ ${run.mistakes}/${KITCHEN_CONFIG.submittedMistakesAllowed}</span></div><div class="kitchenprogresslabel">${esc(kitchenProgressFeeling(run,template))}</div><div class="kitchenprogress">${kitchenProgressHTML(run,template)}</div><div class="kitchenlab felt" data-kitchen-mode="${mode}"><div class="kitchenchefbubble">👩‍🍳 ${esc(run.chefComment||kitchenChefLine(run.correct===6?"final":"next",run))}</div><h3>${title}</h3><div class="kitchencluehead"><span>${kitchenClueLabel(q?.kind)}</span>${masteryBadge(q?.wid)}<span>${answer.length} letters</span></div><div class="kitchenprompt" lang="en-GB">${q?q.text:"Question unavailable."}</div><div class="kitchenanswer" aria-label="Answer with given letters in position">${slots}</div>${inputHTML}<div class="kitchenhintbar"><button class="felt" id="kRevealHint" ${run.extraLetterBought?"disabled":""}>${run.extraLetterBought?"Letter revealed":`+ letter · ${KITCHEN_CONFIG.extraLetterCost} ${COIN}`}</button><button class="felt" id="kPronounceHint">${run.pronunciationBought?"🔊 Hear again":`🔊 Hear · ${KITCHEN_CONFIG.pronunciationCost} ${COIN}`}</button></div><div class="custactions"><button class="felt big" id="kBackLetter" ${hasInput?"":"disabled"}>Undo letter</button><button class="felt big" id="kClear" ${hasInput?"":"disabled"}>Clear</button><button class="felt big primary" id="kSubmit" ${canSubmit?"":"disabled"}>Check answer</button></div></div></section>`);
  $("#back").onclick=()=>pauseKitchen();$$('[data-kitchen-tile]').forEach(b=>b.onclick=()=>kitchenPickTile(b.dataset.kitchenTile));$$('[data-kitchen-answer-index]').forEach(b=>b.onclick=()=>kitchenReturnAnswer(Number(b.dataset.kitchenAnswerIndex)));$$('[data-kitchen-path-cell]').forEach(b=>b.onclick=()=>{if(Date.now()<KITCHEN_PATH_POINTER.ignoreClickUntil)return;kitchenPickPathCell(Number(b.dataset.kitchenPathCell));});if(mode==="path")bindKitchenPathDrag();$("#kBackLetter").onclick=()=>kitchenBackAnswer();$("#kClear").onclick=()=>kitchenClearAnswer();$("#kSubmit").onclick=()=>kitchenSubmitAnswer();$("#kRevealHint").onclick=()=>kitchenRevealExtraLetter();$("#kPronounceHint").onclick=()=>kitchenPronounceHint();
}
function updateKitchenHUD(){
  const run=KITCHEN_RUN;if(!run)return;
  const tm=$("#kTimer"),sc=$("#kScore");if(tm)tm.textContent=`⏱️ ${kitchenRemainingSeconds(run)}s`;
  /* S12a: the last 10 seconds pulse red and tick softly once a second */
  const secs=kitchenRemainingSeconds(run),hurry=run.status==="active"&&secs>0&&secs<=10;
  if(tm)tm.classList.toggle("khurry",hurry);
  if(hurry&&secs!==KITCHEN_LAST_TICK){KITCHEN_LAST_TICK=secs;AudioKit.cue("tick");}
  if(!hurry)KITCHEN_LAST_TICK=null;if(sc)sc.textContent=`✓ ${run.correct}/7 · ✕ ${run.mistakes}/${KITCHEN_CONFIG.submittedMistakesAllowed}`;
}
function scheduleKitchenTick(){
  if(kitchenTickTimer)clearTimeout(kitchenTickTimer);
  const run=KITCHEN_RUN;if(!run||run.status!=="active")return;
  updateKitchenHUD();if(kitchenRemainingMs(run)<=0){finishKitchenRun("failed",{timeout:true});return;}
  const wait=Math.max(120,Math.min(1000,kitchenRemainingMs(run)%1000||1000));kitchenTickTimer=setTimeout(scheduleKitchenTick,wait);
}
function pauseKitchenRun(reason="pause"){
  cancelKitchenReady();
  const run=KITCHEN_RUN;if(!run)return;
  /* Review already pauses the cooking clock. Record the background state,
     but keep the review screen as review instead of arming a second pause
     that would disable the next round after Continue. */
  if(run.status==="feedback"){
    run.pauseReason=reason;run.pausedAtMs=Date.now();run.pauseAfterFeedback=false;return;
  }
  if(run.status!=="active")return;
  kitchenAccumulateModeTime(run);run.remainingMs=kitchenRemainingMs(run);run.status="paused";run.pauseReason=reason;run.pausedAtMs=Date.now();
  if(kitchenTickTimer){clearTimeout(kitchenTickTimer);kitchenTickTimer=null;}updateKitchenHUD();
}
function resumeKitchenRun(reason="pause"){
  const run=KITCHEN_RUN;if(!run)return;
  /* Build 67 bug fix: returning while the answer-review screen is open
     must clear the background marker immediately. Continue can then create
     an active, enabled round on its first tap. */
  if(run.status==="feedback"&&run.pauseReason===reason){
    run.pauseReason=null;run.pausedAtMs=null;run.pauseAfterFeedback=false;return;
  }
  if(run.status!=="paused"||run.pauseReason!==reason)return;
  run.status="active";run.pauseReason=null;run.pausedAtMs=null;run.pauseAfterFeedback=false;run.deadlineMs=Date.now()+run.remainingMs;run.roundStartedAt=Date.now();renderKitchenChallenge();scheduleKitchenTick();
}
function kitchenPickTile(tileId){
  const run=KITCHEN_RUN;if(!run||run.status!=="active"||!run.currentQuestion)return;
  const tile=kitchenTileById(run,tileId);if(!tile)return;
  if(tile.used){
    const lastIndex=(run.currentAnswer||[]).length-1;
    if(run.currentMode==="conveyor"&&lastIndex>=0&&run.currentAnswer[lastIndex]===tile.id){kitchenReturnAnswer(lastIndex);}
    return;
  }
  if((run.currentAnswer||[]).length>=kitchenRequiredIndexes(run).length)return;
  tile.used=true;run.currentAnswer.push(tile.id);
  if(run.currentMode==="conveyor"){run.conveyorMovesThisRound=(run.conveyorMovesThisRound||0)+1;const k=kitchenOf(P());k.stats.conveyorMoves=(k.stats.conveyorMoves||0)+1;}
  kitchenFillSound(run.currentAnswer.length,kitchenRequiredIndexes(run).length);renderKitchenChallenge();
}
/* S12a: a letter placed pops a little higher for each filled slot; when the
   last slot fills, a "ready" chime says the word can be checked.
   S12b (review S12A-B02): the chime belongs to that exact input. It is
   cancelled by any change (back, clear, submit, pause, exit, new run) and,
   when it fires, it checks the same run, question and letters, still active
   and still complete. Hint letters are not counted as typed input. */
function cancelKitchenReady(){if(kitchenReadyTimer){clearTimeout(kitchenReadyTimer);kitchenReadyTimer=null;}}
function kitchenInputSig(run){return run.currentMode==="path"?(run.currentPath||[]).join(","):(run.currentAnswer||[]).join(",");}
function kitchenInputComplete(run){const need=kitchenRequiredIndexes(run).length;return need>0&&(run.currentMode==="path"?(run.currentPath||[]).length:(run.currentAnswer||[]).length)>=need;}
function kitchenFillSound(filled,total){
  cancelKitchenReady();
  AudioKit.cue("letter-pop",{step:filled});
  const run=KITCHEN_RUN;if(!run||!(total>0&&filled>=total))return;
  const question=run.currentQuestion,sig=kitchenInputSig(run);
  kitchenReadyTimer=setTimeout(()=>{kitchenReadyTimer=null;
    if(KITCHEN_RUN!==run||run.status!=="active"||run.currentQuestion!==question||kitchenInputSig(run)!==sig||!kitchenInputComplete(run))return;
    AudioKit.cue("ready");},140);
}
function kitchenPickPathCell(index){
  if(kitchenPathVisit(index,{audio:true}))return;
  const run=KITCHEN_RUN,path=run&&run.currentPath||[];
  if(run&&path.length&&path.indexOf(index)<0&&!kitchenPathAdjacent(path[path.length-1],index,4))toast("Choose a neighbouring square — diagonals count too.");
}
function kitchenReleaseTile(run,tileId){const tile=kitchenTileById(run,tileId);if(tile&&!tile.hintLocked)tile.used=false;}
function kitchenReturnAnswer(index){const run=KITCHEN_RUN;if(!run||run.status!=="active"||!["scramble","conveyor"].includes(run.currentMode))return;if(index<0||index>=run.currentAnswer.length)return;if(run.currentMode==="conveyor"&&index!==run.currentAnswer.length-1)return;cancelKitchenReady();const [id]=run.currentAnswer.splice(index,1);kitchenReleaseTile(run,id);AudioKit.cue("letter-back");renderKitchenChallenge();}
function kitchenBackAnswer(){
  const run=KITCHEN_RUN;if(!run||run.status!=="active")return;
  if(run.currentMode==="path"){
    if(!(run.currentPath||[]).length)return;cancelKitchenReady();run.currentPath.pop();AudioKit.cue("letter-back");refreshKitchenPathUI();return;
  }
  if(!run.currentAnswer.length)return;cancelKitchenReady();kitchenReleaseTile(run,run.currentAnswer.pop());AudioKit.cue("letter-back");renderKitchenChallenge();
}
function kitchenClearAnswer(){
  const run=KITCHEN_RUN;if(!run||run.status!=="active")return;
  cancelKitchenReady();
  if(run.currentMode==="path"){run.currentPath=[];AudioKit.cue("letter-back");refreshKitchenPathUI();return;}
  else{run.currentAnswer=[];(run.currentTiles||[]).forEach(t=>t.used=!!t.hintLocked);}
  AudioKit.cue("letter-back");renderKitchenChallenge();
}
function kitchenAdvanceAfterFeedback(){
  kitchenFeedbackTimer=null;if(!KITCHEN_RUN||KITCHEN_RUN.finished)return;
  KITCHEN_RUN.feedback="";
  if(KITCHEN_RUN.correct>=KITCHEN_CONFIG.correctRequired){finishKitchenRun("won");return;}
  if(KITCHEN_RUN.mistakes>KITCHEN_CONFIG.submittedMistakesAllowed){finishKitchenRun("failed",{timeout:false});return;}
  /* Only an app that is still genuinely hidden should prepare a paused
     next round. A stale review/background flag must never create a fully
     disabled round after the player has already returned. */
  KITCHEN_RUN.pauseAfterFeedback=false;
  if(document.hidden){
    if(!kitchenPrepareRound(KITCHEN_RUN)){finishKitchenRun("failed",{emptyPool:true});return;}
    KITCHEN_RUN.chefComment=kitchenChefLine(KITCHEN_RUN.correct===6?"final":"next",KITCHEN_RUN);
    KITCHEN_RUN.status="paused";KITCHEN_RUN.pauseReason="background";KITCHEN_RUN.pausedAtMs=Date.now();renderKitchenChallenge();return;
  }
  if(!kitchenPrepareRound(KITCHEN_RUN)){finishKitchenRun("failed",{emptyPool:true});return;}
  KITCHEN_RUN.chefComment=kitchenChefLine(KITCHEN_RUN.correct===6?"final":"next",KITCHEN_RUN);
  KITCHEN_RUN.status="active";KITCHEN_RUN.deadlineMs=Date.now()+KITCHEN_RUN.remainingMs;kitchenRecordRoundStart(KITCHEN_RUN);renderKitchenChallenge();scheduleKitchenTick();
}
function kitchenSubmitAnswer(){
  cancelKitchenReady();
  const run=KITCHEN_RUN,p=P();if(!run||run.status!=="active"||!p||!run.currentQuestion)return;const attempt=kitchenAnswerText(run).toLowerCase();if(attempt.length!==run.currentQuestion.ans.length)return;kitchenAccumulateModeTime(run);run.remainingMs=kitchenRemainingMs(run);run.status="feedback";if(kitchenTickTimer){clearTimeout(kitchenTickTimer);kitchenTickTimer=null;}
  const k=kitchenOf(p),mode=run.currentMode,right=attempt===run.currentQuestion.ans,resultStats=k.stats.modeResults[mode],kindStats=k.stats.questionKinds[run.currentQuestion.kind];run.review={right,attempt,answer:run.currentQuestion.ans};
  if(right){run.correct++;run.chefComment=kitchenStepCheer(run.correct,run,kitchenTemplate(kitchenFood(run.foodId)));run.celebrateStep=run.correct;k.stats.correct=(k.stats.correct||0)+1;k.stats.modeCorrect[mode]=(k.stats.modeCorrect[mode]||0)+1;if(resultStats)resultStats.successes=(resultStats.successes||0)+1;if(kindStats)kindStats.correct=(kindStats.correct||0)+1;kitchenCelebrationSound(run.correct);kitchenCelebrateStep(run.correct);}else{run.mistakes++;run.chefComment=kitchenChefLine("wrong",run);run.celebrateStep=0;k.stats.wrong=(k.stats.wrong||0)+1;if(resultStats)resultStats.mistakes=(resultStats.mistakes||0)+1;if(kindStats)kindStats.wrong=(kindStats.wrong||0)+1;AudioKit.cue("wrong");}
  persist();const freshAchievements=checkAchievements();renderKitchenChallenge();celebrateAchievements(freshAchievements);
}
function finishKitchenRun(result,options={}){
  const run=KITCHEN_RUN,p=P();if(!run||run.finished||!p)return;
  if(run.status==="active")kitchenAccumulateModeTime(run);
  const remainingNow=options.timeout?0:kitchenRemainingMs(run);
  run.finished=true;run.status=result;run.timeout=!!options.timeout;run.remainingMs=remainingNow;clearKitchenTimers();
  const k=kitchenOf(p),remaining=Math.max(0,Math.ceil(run.remainingMs/1000));
  let best=null;
  if(result!=="abandoned"){
    k.lastAttemptByFood[run.foodId]={correct:run.correct,mistakes:run.mistakes,timeout:run.timeout,remaining,result};
    best=k.bestByFood[run.foodId]||(k.bestByFood[run.foodId]={attempts:1,bestCorrect:0,bestRemaining:0,fewestMistakes:KITCHEN_CONFIG.submittedMistakesAllowed+1,unlockedAt:0});
    best.bestCorrect=Math.max(best.bestCorrect||0,run.correct);best.bestRemaining=Math.max(best.bestRemaining||0,remaining);best.fewestMistakes=Math.min(Number.isFinite(best.fewestMistakes)?best.fewestMistakes:KITCHEN_CONFIG.submittedMistakesAllowed+1,run.mistakes);
  }
  if(result==="won"){
    run.newUnlock=!k.unlockedFoods.includes(run.foodId);
    if(run.newUnlock)k.unlockedFoods.push(run.foodId);
    if(!best.unlockedAt)best.unlockedAt=Date.now();k.stats.challengesWon=(k.stats.challengesWon||0)+1;if((best.attempts||0)===1)k.stats.firstAttemptWins=(k.stats.firstAttemptWins||0)+1;if(run.mistakes===0)k.stats.perfectWins=(k.stats.perfectWins||0)+1;
    const today=localDayKey(),reward=KITCHEN_CONFIG.rewardTips[run.tier]||KITCHEN_CONFIG.rewardTips.core;
    run.firstReward=!k.firstRewardedFoods.includes(run.foodId);
    const recipePaidToday=k.rewardedToday[run.foodId]===today;
    const dailyUsed=kitchenDailyRewardsUsed(k,today);
    if(!recipePaidToday&&dailyUsed<KITCHEN_CONFIG.dailyPaidCompletions){
      const base=run.firstReward?reward.first:reward.redo;
      const perfect=run.mistakes===0?(run.firstReward?reward.perfectFirst:reward.perfectRedo):0;
      run.award=base+perfect;run.rewardKind=run.firstReward?"first":"redo";
      k.rewardedToday[run.foodId]=today;
      kitchenRecordPaidReward(k,today);
      if(run.firstReward)k.firstRewardedFoods.push(run.foodId);
    }else{run.award=0;run.rewardKind=recipePaidToday?"recipe-cap":"daily-cap";}
    p.tips=(p.tips||0)+run.award;p.lifetime=(p.lifetime||0)+run.award;
  }else if(result==="abandoned"){
    const key=String(Math.min(7,run.correct+1));k.stats.dropOffRound[key]=(k.stats.dropOffRound[key]||0)+1;k.stats.failReasons.abandoned=(k.stats.failReasons.abandoned||0)+1;
  }else{
    const reason=options.timeout?"timeout":options.emptyPool?"emptyPool":"mistakes";k.stats.failReasons[reason]=(k.stats.failReasons[reason]||0)+1;
  }
  ["conveyor","scramble","path"].forEach(mode=>{const r=k.stats.modeResults[mode];if(r)r.activeMs=(r.activeMs||0)+(run.modeActiveMs[mode]||0);});
  persist();
  if(window.WordBarAnalytics){
    const _res=result==="won"?"completed":result==="abandoned"?"quit":"failed";
    WordBarAnalytics.endSession({result:_res,questions:(run.correct||0)+(run.mistakes||0),correct:run.correct||0,hints:run.analyticsHints||0,answers:(run.correct||0)+(run.mistakes||0)});
    if(result==="won") WordBarAnalytics.milestoneOnce("first_kitchen_completed");
  }
  const freshAchievements=checkAchievements();
  if(options.exitToMenu){KITCHEN_RUN=null;AudioKit.ambientStart();screenMenu();return;}
  renderKitchenResult(result,options);
  celebrateAchievements(freshAchievements);
}
function renderKitchenResult(result,options={}){
  const run=KITCHEN_RUN,food=run&&kitchenFood(run.foodId);if(!run||!food){screenKitchenMenu();return;}
  const won=result==="won",abandoned=result==="abandoned",award=Number(run.award)||0;
  const reveal=won?(run.newUnlock?`<div class="kitchenunlockanim" aria-label="Recipe unlocked"><div class="unlocklock">🔒</div><div class="unlockspark">✨</div><div class="kitchenreveal unlockdish">${kitchenItemArt(food)}</div></div>`:`<div class="kitchenreveal">${kitchenItemArt(food)}</div>`):`<div class="kitchencloche">${abandoned?"🥣":"💨"}</div>`;
  if(won)AudioKit.cue("result");
  show(`<section class="screen center kitchenchallenge"><div class="topbar"><span></span><b>Kitchen result</b><span></span></div>
    <div class="kitchenresult felt">${reveal}<div class="kitchenchefbubble">👩‍🍳 ${esc(won?kitchenChefLine("ready",run):"Nearly! Your prepared ingredients are waiting for another try.")}</div><h2>${won?(run.newUnlock?"New Recipe Learned!":"Recipe Complete!"):abandoned?"Kitchen closed":"Nearly there!"}</h2>${won?`<h3>${esc(food.name)}</h3>`:""}
      <p><b>${run.correct}/7 correct</b> · ${run.mistakes} submitted mistake${run.mistakes===1?"":"s"} · ${kitchenRemainingSeconds(run)}s remaining</p>
      <p>${won?(run.rewardKind==="recipe-cap"?"Practice complete. This recipe’s coin reward has already been collected today — cook a different recipe for another daily reward.":run.rewardKind==="daily-cap"?`Practice complete. All ${KITCHEN_CONFIG.dailyPaidCompletions} daily Kitchen rewards have been collected. This win still counts, and any first-win coin reward remains ready for a future paid completion.`:run.newUnlock?`<b>+${award} coins</b> · ${esc(food.name)} can now appear in café orders.`:run.rewardKind==="first"?`<b>+${award} coins</b> · first Kitchen win reward!`:`<b>+${award} coins</b> · Cook again reward!`):run.timeout?"The dish overcooked when time ran out. Try again — you were close!":abandoned?"No challenge progress or reward was saved.":options.emptyPool?"The Kitchen could not find another suitable clue.":`You prepared <b>${run.correct}/7</b> steps. Try again to finish the recipe!`}</p>
      <div class="custactions"><button class="felt big primary" id="kRetry">${won?"Cook again":"Try again"}</button><button class="felt big" id="kMenu">Kitchen menu</button></div></div></section>`);
  $("#kRetry").onclick=()=>{AudioKit.tap();screenKitchenIntro(run.foodId);};
  $("#kMenu").onclick=()=>{AudioKit.tap();screenKitchenMenu(food.category);};
}
function abandonKitchenRun(){
  const run=KITCHEN_RUN;if(!run){screenMenu();return;}
  if(run.status==="active"||run.status==="feedback"||run.status==="paused"){
    if(!confirm(wbT("Leave Kitchen and return to the main menu? Your current recipe progress will be lost.")))return;
    if(run.status==="active"){kitchenAccumulateModeTime(run);run.remainingMs=kitchenRemainingMs(run);}
    finishKitchenRun("abandoned",{exitToMenu:true});return;
  }
  KITCHEN_RUN=null;screenMenu();
}

/* ---------- Time Challenge duration picker (30s–5min, default 100s) ---------- */
function ensureDurationDialog(){
  let dlg=document.getElementById('durationDlg');
  if(!dlg){
    dlg=document.createElement('dialog'); dlg.id='durationDlg'; dlg.className='reveal';
    dlg.innerHTML=`<div class="dlghead">⏱️ Time Challenge</div>
      <div class="dlgbody">
        <p class="note" style="margin:0 0 10px">Choose how long the clock runs — up to 5 minutes.</p>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="durRange" min="30" max="300" step="10" value="100" style="flex:1">
          <b id="durLabel" style="min-width:52px;text-align:right">100s</b>
        </div>
      </div>
      <div class="dlgfoot"><span></span><div class="dlgbtns">
        <button class="closebtn" id="durCancel">Cancel</button>
        <button class="closebtn primary" id="durGo" style="background:var(--berry);color:#fff">Start ▶</button></div></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('#durRange').oninput=e=>{dlg.querySelector('#durLabel').textContent=e.target.value+'s';};
    dlg.querySelector('#durCancel').onclick=()=>dlg.close();
    dlg.querySelector('#durGo').onclick=()=>{const secs=+dlg.querySelector('#durRange').value;dlg.close();startShift('time',secs);};
  }
  return dlg;
}
function openTimeDurationPicker(){ ensureDurationDialog().showModal(); }

/* ============================================================
   SESSION — persistent café stage. Patience (per-customer) is
   the only fail-pressure now; a lost ticket never ends the whole
   session — Normal mode ends after serving NORMAL_TARGET
   customers, Time Challenge ends when its clock runs out.
   ============================================================ */
let SHIFT=null;
const NORMAL_TARGET=20, TIME_SECONDS=100, REVIEW_TARGET=15;

/* ---------- Central session pause controller ----------
   Browser backgrounding must not cost a child patience, challenge
   time or Rush queue space. Pause reasons are tracked separately so
   a later feature can pause without accidentally cancelling another
   active pause. Existing result/settings popups still use popupOpen. */
const SESSION_PAUSE_REASONS=new Set();
function isSessionPaused(){
  return SESSION_PAUSE_REASONS.size>0 || !!(SHIFT&&SHIFT.popupOpen);
}
function isSessionPausedFor(reason){ return SESSION_PAUSE_REASONS.has(reason); }
function pauseSession(reason="manual"){
  const wasPaused=SESSION_PAUSE_REASONS.size>0;
  SESSION_PAUSE_REASONS.add(reason);
  if(reason==="background"&&SHIFT&&!SHIFT.ended)saveShiftResume(SHIFT);
  document.documentElement.classList.add("session-paused");
  if(!wasPaused&&SHIFT&&!SHIFT.activePauseStartedAt)SHIFT.activePauseStartedAt=Date.now();
  if(!wasPaused && SHIFT && SHIFT.mode==="rush" && SHIFT.timer){
    SHIFT.rushRemaining=Math.max(0,(SHIFT.rushDue||Date.now())-Date.now());
    clearTimeout(SHIFT.timer); SHIFT.timer=null;
  }
}
function resumeSession(reason="manual"){
  SESSION_PAUSE_REASONS.delete(reason);
  if(SESSION_PAUSE_REASONS.size) return;
  document.documentElement.classList.remove("session-paused");
  const S=SHIFT;
  if(S&&S.activePauseStartedAt){S.pausedTotalMs=(S.pausedTotalMs||0)+Math.max(0,Date.now()-S.activePauseStartedAt);S.activePauseStartedAt=null;}
  if(S&&S.mode==="rush"&&!S.ended&&!S.timer){
    scheduleRushSpawn(Number.isFinite(S.rushRemaining)?S.rushRemaining:S.rushMs);
  }
}
function scheduleRushSpawn(delay){
  const S=SHIFT;
  if(!S||S.mode!=="rush"||S.ended) return;
  const wait=Math.max(0,Number(delay)||0);
  if(S.timer) clearTimeout(S.timer);
  S.rushRemaining=wait;
  S.rushDue=Date.now()+wait;
  S.timer=setTimeout(()=>{
    if(!SHIFT||SHIFT!==S||S.mode!=="rush"||S.ended) return;
    S.timer=null; S.rushDue=null; S.rushRemaining=0;
    if(SESSION_PAUSE_REASONS.size) return; /* background pause resumes through resumeSession */
    if(S.popupOpen){ scheduleRushSpawn(S.rushMs); return; } /* result/settings popup: keep the Rush loop alive */
    spawnCustomer();
    if(!S.current) takeNext();
    layoutQueue(); updateTopbar();
    if(S.queue.length>=20){ S.overwhelmed=true; endShift(false); return; }
    /* S12a: a warning sound as the queue gets long (15, then 18 of 20) */
    const warnAt=S.queue.length>=18?18:S.queue.length>=15?15:0;
    if(warnAt&&warnAt!==S.rushWarned)AudioKit.cue("warn");
    S.rushWarned=warnAt;
    S.rushMs=Math.max(2600,S.rushMs*0.965);
    scheduleRushSpawn(S.rushMs);
  },wait);
}
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){clearPlayerPetIdle();pauseSession("background");pauseKitchenRun("background");}
  else {resumeSession("background");resumeKitchenRun("background");applyCafeLighting();schedulePlayerPetIdle();}
});
window.addEventListener("pagehide",()=>{clearPlayerPetIdle();pauseSession("background");pauseKitchenRun("background");});
window.addEventListener("pageshow",()=>{ if(!document.hidden){resumeSession("background");resumeKitchenRun("background");applyCafeLighting();schedulePlayerPetIdle();} });
function isWeekend(){const d=new Date().getDay();return d===0||d===6;}
const rnd=n=>Math.floor(Math.random()*n);
function dur(ms){return P().settings.motion==="reduced"?0:ms;}
const PERSONALITY_CLASS={bouncy:"pers-bouncy",shy:"pers-shy",cool:"pers-cool",brisk:"pers-brisk",formal:"pers-formal",mysterious:"pers-mysterious"};

function startShift(mode, timeSeconds, resume){
  notePlayToday(); resetAdaptiveState(); /* QA v21: a fresh shift starts with a clean slate, not the last shift's word/type exclusions or accuracy history */
  if(window.WordBarAnalytics){ WordBarAnalytics.startSession(mode, wbAnalyticsDifficulty(P().settings.diff), P().courseId||"unknown"); }
  const tLen = mode==="time" ? (timeSeconds||TIME_SECONDS) : null;
  SHIFT={mode,served:0,spawned:0,perfect:0,answers:0,rightAnswers:0,
    streak:0,bestStreak:0,tips:0,weekend:isWeekend()&&P().sessions>0,
    owlUsed:false, /* QA v21: real per-shift flag (see customerFor in 05-engine.js) */
    timeLeft:tLen, timeTotal:tLen, popupOpen:false,
    curPatience:0, maxPatience:20, patTimer:null, impatientShown:false,
    startedAt:Date.now(),pausedTotalMs:0,activePauseStartedAt:null,missed:[],
    startMastered:masteredCount(), startWords:Object.keys(P().words).length,
    timeGreetingsShown:new Set(),queue:[],current:null,timer:null};
  if(resume){ /* S9b: carry on an interrupted shift — continue its running totals */
    Object.assign(SHIFT,{served:resume.served,spawned:resume.served,perfect:resume.perfect,answers:resume.answers,rightAnswers:resume.rightAnswers,
      streak:resume.streak,bestStreak:resume.bestStreak,tips:resume.tips,weekend:!!resume.weekend,owlUsed:!!resume.owlUsed,
      missed:Array.isArray(resume.missed)?resume.missed:[],startMastered:resume.startMastered,startWords:resume.startWords,
      startedAt:Date.now()-Math.max(0,resume.activeMs||0),resumed:true});
    if(mode==="time"){SHIFT.timeLeft=resume.timeLeft;SHIFT.timeTotal=resume.timeTotal||resume.timeLeft;}
  }
  mountStage();
  if(resume)setTimeout(()=>toast(`☕ Welcome back! ${shiftResumeLabel({...resume,served:resume.served})}`),400);
  AudioKit.unlock(); AudioKit.ambientStart();
  if(SHIFT.weekend) toast("🎉 Weekend Rush! Busier queue, +20% tips");
  if(mode==="time"){
    SHIFT.timer=setInterval(()=>{
      if(!SHIFT||isSessionPaused())return;
      SHIFT.timeLeft--; updateTopbar();
      if(SHIFT.timeLeft>0&&SHIFT.timeLeft<=10)AudioKit.cue("tick");   /* S12a: last 10 seconds */
      if(SHIFT.timeLeft<=0){ clearInterval(SHIFT.timer); endShift(false); }
    },1000);
  }
  if(mode==="rush"){
    /* Rush arrival timing is now pause-aware. When the app moves to
       the background, the remaining delay is saved and resumes from
       that exact point rather than spawning while the child is away. */
    SHIFT.rushMs=6500;
    toast("🔥 RUSH HOUR! Serve fast — if 20 customers queue up, the café's overwhelmed!");
    scheduleRushSpawn(1200);
  }
  pump();
}
/* The gameplay top bar is a persistent shell. Routine queue, timer,
   score and customer changes update text/classes only; the More menu
   and its event handlers are created once per mounted session. */
function initTopbar(){
  const bar=$("#stopbar"); if(!bar||bar.dataset.ready==="1") return;
  bar.innerHTML=`<span class="tipbadge" id="topTips">${COIN} 0</span>
   <div class="nowserv"><span id="topStreak" aria-hidden="true"></span><b id="topNowName">—</b><span class="tierpill" id="topTier" data-i18n-ctx hidden></span><span class="waitbadge">Waiting: <b id="topWaiting">0</b></span></div>
   <span class="waitbadge" id="topModePrimary"></span>
   <span class="waitbadge" id="topModeSecondary" hidden></span>
   <button class="morebtn pausebtn" id="pauseBtn" aria-label="Pause">⏸️</button>`;
  bar.dataset.ready="1";
  /* S9b: one ⏸️ button opens the shared pause sheet (Resume · sounds · How to play · End). */
  $("#pauseBtn").onclick=(e)=>{e.stopPropagation();AudioKit.tap();pauseCafe();};
}
function topbarVisible(el,visible){
  if(!el)return;
  el.hidden=!visible;
  el.style.display=visible?"":"none";
}
function updateTopbar(){
  const S=SHIFT,p=P(),bar=$("#stopbar"); if(!bar||!S||!p)return;
  initTopbar();
  const waiting=S.queue.length+(S.current?1:0);
  const nowName=S.current?S.current.cust.name:"—";
  $("#topTips").innerHTML=`${COIN} ${p.tips}`;
  $("#topStreak").textContent=S.streak>1?"🔥 ":"";
  $("#topNowName").textContent=nowName;
  $("#topWaiting").textContent=String(waiting);

  const tier=$("#topTier");
  if(S.current&&(S.current.cust.tier!=="regular"||S.current.cust.special)){
    const c=S.current.cust, special=!!c.special, secret=c.tier==="secret";
    tier.className=`tierpill ${special?"vip":(secret?"secret":"vip")}`;
    tier.textContent=special?"★ Special":(secret?"✦":"★ VIP");
    topbarVisible(tier,true);
  }else{
    tier.textContent=""; topbarVisible(tier,false);
  }

  const primary=$("#topModePrimary"), secondary=$("#topModeSecondary");
  primary.className="waitbadge"; secondary.className="waitbadge";
  topbarVisible(primary,true); topbarVisible(secondary,false);
  if(S.mode==="rush"){
    primary.textContent=`👥 ${S.queue.length}/20`;
    secondary.textContent=`❌ ${S.wrong||0}/5`;
    if(S.queue.length>=15)primary.classList.add("danger");
    if((S.wrong||0)>=4)secondary.classList.add("danger");
    topbarVisible(secondary,true);
  }else if(S.mode==="time"){
    primary.textContent=`⏱️ ${Math.max(0,S.timeLeft)}s`;
    if(S.timeLeft>0&&S.timeLeft<=10)primary.classList.add("danger");
  }else if(S.mode==="review"){
    primary.textContent=`🎯 ${S.served}/${Math.min(REVIEW_TARGET,S.served+reviewPool().length)}`;
  }else{
    primary.textContent=`🎯 ${S.served}/${NORMAL_TARGET}`;
  }
}
document.addEventListener("click", e=>{ const m=$("#moreMenu"); if(m&&!e.target.closest("#moreBtn")&&!e.target.closest("#moreMenu")){ m.classList.remove("open"); const b=$("#moreBtn"); if(b)b.setAttribute("aria-expanded","false"); } });

/* ---- actor (customer) nodes ---- */
function showImpatientEmote(entry){
  if(!entry||!entry.node)return;
  const slot=entry.node.querySelector(".emoteslot"); if(!slot)return;
  const e=document.createElement("div"); e.className="impatient-emote"; e.textContent=Math.random()<.5?"😤":"⏰";
  slot.appendChild(e); setTimeout(()=>e.remove(),1800);
}
function spawnBurst(container){
  if(!container)return;
  const emojis=["🎉","✨","👏","⭐"];
  for(let i=0;i<6;i++){
    const b=document.createElement("div"); b.className="burst"; b.textContent=emojis[i%emojis.length];
    b.style.left=(40+Math.random()*20)+"%"; b.style.top=(40+Math.random()*15)+"%";
    b.style.setProperty("--bx",(Math.random()*80-40)+"px");
    b.style.animationDelay=(i*0.05)+"s";
    container.appendChild(b); setTimeout(()=>b.remove(),1300);
  }
}

function pump(){
  const S=SHIFT; if(!S||S.debutActive)return;
  if(S.mode==="rush"){
    if(!S.current){ if(!S.queue.length) spawnCustomer(); takeNext(); }
    return;
  }
  const visible=()=>S.queue.length+(S.current?1:0);
  const cap = S.mode==="time" && S.timeLeft<40 ? 4 : 3;
  let guard=0;
  while(visible()<cap && guard++<6){ spawnCustomer(); }
  if(!S.current) takeNext();
}
/* Single code path for giving an actor its pet — used by
   spawnCustomer and by the test harness, so what's tested is
   exactly what runs in the game. */
/* One shared recorder for "saying hello" to a pet, so café taps and
   Gallery taps both count toward petsMet and the pet trophies —
   the Gallery invites the greeting, so it must count (QA WB17-02). */
function recordPetGreeting(pet){
  const p=P();
  if(!p.petsMet.includes(pet.id)){ p.petsMet.push(pet.id); persist(); celebrateAchievements(checkAchievements()); }
}
function panelArrival(entry){
  const c=entry.cust,S=SHIFT,period=cafeDialoguePeriod(new Date());
  const normal=c.lines.arrive[rnd(c.lines.arrive.length)],contextual=c.timeGreeting&&c.timeGreeting[period];
  const greetingKey=`${c.id}:${period}`;
  let arrive=normal;
  if(contextual&&S&&!S.timeGreetingsShown.has(greetingKey)&&Math.random()<.30){
    arrive=contextual;S.timeGreetingsShown.add(greetingKey);
  }else if(Math.random()<.35){
    /* Existing British-weather small talk remains occasional, but it
       no longer overwrites or hides the selected line by mistake. */
    arrive=WEATHER_CHAT[rnd(WEATHER_CHAT.length)];
  }
  entry.greet=arrive;
  popEmote(entry,"💬"); AudioKit.chatter(arrive);
  if(entry.pet) setTimeout(()=>AudioKit.pet(entry.pet.species,true), 500); /* the pet says hello too */
  const pnl=$("#panel"); if(!pnl)return;
  pnl.innerHTML=`<div class="arrival"><b>${c.name}</b> <span class="tierpill ${c.special?"vip":c.tier}">${c.special?"★ Special Guest":c.tier==="vip"?"★ VIP":c.tier==="secret"?"✦ secret":""}</span>
     ${entry.pet?`<span class="petline">with ${entry.pet.name} <i>(tap them to say hi!)</i></span>`:""}
     <div class="custsay" lang="en-GB">“${esc(arrive)}”</div>
     <div class="ticket felt"><b>🧾 Order:</b> ${entry.ticket.drinkEmoji||"🍹"} ${esc(entry.ticket.drink)}${entry.ticket.food?` + ${entry.ticket.food.emoji} ${esc(entry.ticket.food.name)}`:""} <small>(${entry.ticket.qs.length} word ${entry.ticket.qs.length>1?"puzzles":"puzzle"})</small></div></div>`;
  updateTopbar();
  /* No manual "take the order" tap — flows straight into the
     question after a brief moment to read who's arrived, matching
     the fully continuous flow (answer -> reveal closes -> next
     question, all the way through, with no clicks in between). */
  const arrivalMs = SHIFT.mode==="time" ? 350 : 900;
  setTimeout(()=>{ if(SHIFT && SHIFT.current===entry) renderQuestion(entry); }, arrivalMs);
}

/* ---- patience — replaces lives; ticks per question, tiered by
   customer type, pauses automatically while a popup is open ---- */
function initPatienceMeter(meter){
  if(!meter||meter.dataset.ready==="1") return;
  const frag=document.createDocumentFragment();
  for(let i=0;i<10;i++){
    const seg=document.createElement("div");
    seg.className="patseg";
    frag.appendChild(seg);
  }
  meter.replaceChildren(frag);
  meter.dataset.ready="1";
  meter.dataset.fill="";
  meter.dataset.level="";
  meter.setAttribute("role","progressbar");
  meter.setAttribute("aria-label","Customer patience");
}
function drawPatience(){
  const meter=$("#patMeter"); if(!meter||!SHIFT)return;
  initPatienceMeter(meter);
  const ratio=Math.max(0,Math.min(1,SHIFT.curPatience/SHIFT.maxPatience));
  const fill=Math.max(0,Math.min(10,Math.round(ratio*10)));
  const level=ratio<.3?"crit":ratio<.6?"low":"normal";
  const ariaNow=Math.ceil(Math.max(0,SHIFT.curPatience));
  if(meter.dataset.ariaMax!==String(SHIFT.maxPatience)){
    meter.setAttribute("aria-valuemin","0");
    meter.setAttribute("aria-valuemax",String(SHIFT.maxPatience));
    meter.dataset.ariaMax=String(SHIFT.maxPatience);
  }
  if(meter.dataset.ariaNow!==String(ariaNow)){
    meter.setAttribute("aria-valuenow",String(ariaNow));
    meter.setAttribute("aria-valuetext",`${ariaNow} seconds of patience remaining`);
    meter.dataset.ariaNow=String(ariaNow);
  }
  if(meter.dataset.fill===String(fill)&&meter.dataset.level===level)return;
  const levelChanged=meter.dataset.level!==level;
  const fillChanged=meter.dataset.fill!==String(fill);
  [...meter.children].forEach((seg,i)=>{
    if(levelChanged){
      seg.classList.remove("low","crit");
      if(level!=="normal")seg.classList.add(level);
    }
    if(fillChanged)seg.classList.toggle("empty",i>=fill);
  });
  meter.dataset.fill=String(fill);
  meter.dataset.level=level;
}
function questionPatienceSeconds(entry,q){
  const course=activeCourseConfig();
  if(course.id===COURSE_IDS.elevenPlus){
    return SHIFT.mode==="review"?course.cafe.patience.review:
      (course.cafe.patience[entry.cust.tier]||20);
  }
  const patience=course.cafe.patience;
  let seconds=q?.layout==="sentence"?patience.sentence:patience.compact;
  if(entry.cust.tier==="vip")seconds+=patience.vipAdjust;
  else if(entry.cust.tier==="secret")seconds+=patience.secretAdjust;
  if(SHIFT.mode==="review")seconds+=patience.reviewAdjust;
  return seconds;
}
function startPatience(entry){
  const S=SHIFT; if(!S) return;
  clearInterval(S.patTimer);
  const q=entry.ticket.qs[entry.qIndex];
  S.maxPatience=questionPatienceSeconds(entry,q);
  S.curPatience = S.maxPatience;
  S.impatientShown = false;
  drawPatience();
  /* The bar has only ten visible segments, so Battery Saver can update
     it twice per second instead of five times without changing the
     actual countdown length or making the UI feel less responsive. */
  const patTick=P().settings.batterySaver?500:200;
  S.patTimer=setInterval(()=>{
    if(!SHIFT||isSessionPaused()) return;
    SHIFT.curPatience = Math.max(0, +(SHIFT.curPatience-patTick/1000).toFixed(2));
    drawPatience();
    const ratio = SHIFT.curPatience/SHIFT.maxPatience;
    if(ratio<.25 && !SHIFT.impatientShown){ SHIFT.impatientShown=true; showImpatientEmote(entry); AudioKit.impatient(); }
    if(SHIFT.curPatience<=0){ clearInterval(SHIFT.patTimer); onPatienceTimeout(entry); }
  },patTick);
}
function onPatienceTimeout(entry){
  const q = entry.ticket.qs[entry.qIndex];
  if(!q) return;
  document.querySelectorAll("#panel .opt").forEach(b=>b.disabled=true);
  if(q.kind==="ladder"){ if(typeof window.__ladderTimeoutHook==="function") window.__ladderTimeoutHook(); }
  else resolveAnswer(entry,q,"__patience_timeout__");
}

/* ---- questions (rendered into #panel; scene persists) ----
   Tap-to-answer: tapping an option commits it immediately (the
   old select-then-Serve two-step was removed for pace — this
   applies in Normal, Time Challenge and Review alike since they
   share this renderer). Type-aware dispatch is unchanged — every
   kind except "ladder" shares this one renderer; "ladder" gets
   its own interaction via renderLadder. ---- */
function masteryBadge(wid){
  const p=P();if(!wid||!p||p.settings?.showMasteryBadge===false)return "";
  const stage=masteryStage(wid),labels={new:"🌱 New",learning:"🌿 Learning",confident:"💪 Confident",mastered:"⭐ Mastered"};
  return `<span class="masterybadge ${stage}" aria-label="Word progress: ${stage}">${labels[stage]}</span>`;
}
function questionProgressBadge(q){
  if(P()?.settings?.showMasteryBadge===false)return "";
  if(q?.masteryCredit==="skill")return `<span class="masterybadge learning" aria-label="Skill practice">🧩 Skill practice</span>`;
  return masteryBadge(q?.wid);
}
function questionTierLabel(tier){return activeCourseId()===COURSE_IDS.everyday?activeTierLabel(tier):tier;}
function recordMissedWord(S,q){
  if(!S||!q?.wid)return;if(!Array.isArray(S.missed))S.missed=[];
  if(S.missed.some(m=>m.wid===q.wid))return;
  const w=allWords().find(x=>x.id===q.wid);if(!w)return;
  S.missed.push({wid:w.id,word:w.w,definition:w.def||stripTags(q.explain||"")});
}
function renderQuestion(entry){
  const q=entry.ticket.qs[entry.qIndex];
  if(!q) return; /* defensive: never render past the end of a ticket */
  setExpr(entry,"neutral"); setBarista("happy");
  if(q.kind==="ladder") return renderLadder(entry,q);
  const pnl=$("#panel"); if(!pnl)return;
  pnl.innerHTML=`<div class="qhead">
      <span class="qcount">${entry.ticket.qs.length>1?`Puzzle ${entry.qIndex+1} of ${entry.ticket.qs.length}`:""} <span class="tierpill ${q.tier}" data-i18n-ctx>${esc(questionTierLabel(q.tier))}</span></span>${questionProgressBadge(q)}${Voice.available()?`<button type="button" class="readq" id="readQ" aria-label="Read the question to me">🔊</button>`:""}</div>
    ${entry.qIndex===0&&entry.greet?`<div class="custsay greet" lang="en-GB">💬 “${esc(entry.greet)}”</div>`:""}
    <div class="qtext" lang="en-GB">${q.text}</div>
    <div class="opts ${q.small?"small":""}" id="opts" lang="en-GB"></div>
    <div class="ctrl">
      <div class="patwrap"><span class="patlabel">Patience</span><div class="patmeter" id="patMeter"></div></div>
    </div>`;
  const optsEl=$("#opts");
  let answered=false;
  q.opts.forEach(o=>{
    const b=document.createElement("button");
    b.className="felt opt"; b.textContent=o;
    b.onclick=()=>{
      if(answered) return; answered=true;
      clearInterval(SHIFT.patTimer);
      document.querySelectorAll("#panel .opt").forEach(x=>{x.disabled=true;
        if(x.textContent===q.ans)x.classList.add("correct");
        if(x===b&&o!==q.ans)x.classList.add("wrong");});
      AudioKit.tap();
      resolveAnswer(entry,q,o);
    };
    optsEl.appendChild(b);
  });
  /* S9b: "Read it to me" — the game (patience, clock, queue) pauses while it speaks. */
  const readBtn=$("#readQ");
  if(readBtn)readBtn.onclick=async()=>{
    if(answered||readBtn.disabled)return;AudioKit.tap();readBtn.disabled=true;pauseSession("read");
    try{await Voice.speakAsync(questionSpeechText(q));}catch(e){}
    finally{resumeSession("read");if(readBtn.isConnected)readBtn.disabled=false;}};
  startPatience(entry);
}

function revealSeconds(){ const v=parseInt(P().settings.revealSecs??"20",10); return isNaN(v)?20:v; }
/* Build 81: achievements and face reveals share one serial queue. No
   cards overlap, none intercept taps, and a large trophy burst shows
   at most two named trophies followed by one compact summary. */
let rewardNoticeQueue=[],rewardNoticeActive=false;
function runRewardNoticeQueue(){
  if(rewardNoticeActive||!rewardNoticeQueue.length||document.querySelector(".pet-pop-root"))return;
  rewardNoticeActive=true;const n=rewardNoticeQueue.shift(),el=document.createElement("div");
  el.className=`achievepop ${n.kind||""}`.trim();
  el.innerHTML=`<div class="achieveicon">${n.icon||"🏆"}</div><div><b>${esc(n.heading)}</b><br>${esc(n.title)}</div>`;
  document.body.appendChild(el);setTimeout(()=>el.classList.add("show"),20);
  setTimeout(()=>{el.classList.remove("show");setTimeout(()=>{el.remove();rewardNoticeActive=false;runRewardNoticeQueue();},380);},2300);
}
function queueRewardNotices(items,{voice=false}={}){
  if(!items||!items.length)return;
  rewardNoticeQueue.push(...items);AudioKit.milestone();if(voice)Voice.celebrate();runRewardNoticeQueue();
}
function celebrateRewards(achievements=[],unlocks=[]){
  const fresh=Array.isArray(achievements)?achievements.filter(Boolean):[];
  const ranked=fresh.filter(a=>a.kraken).sort((a,b)=>Number(b.id?.split("_").pop()||0)-Number(a.id?.split("_").pop()||0));
  const ordinary=fresh.filter(a=>!a.kraken),ordered=ranked.length?[ranked[0],...ordinary]:ordinary;
  const shown=ordered.slice(0,2),hidden=Math.max(0,ordered.length-shown.length)+(ranked.length>1?ranked.length-1:0);
  const notices=shown.map(a=>({kind:a.kraken?"kraken":"trophy-notice",icon:a.emoji||"🏆",heading:a.kraken?"New rank!":"Achievement unlocked!",title:a.title}));
  if(hidden)notices.push({kind:"trophy-summary",icon:"🏆",heading:`${hidden} more ${hidden===1?"trophy":"trophies"} earned`,title:"See them on the Trophies shelf."});
  const revealList=(Array.isArray(unlocks)?unlocks:[]).map(u=>{
    const item=u.type==="customer"?CUSTOMERS.find(c=>c.id===u.id):PETS.find(p=>p.id===u.id);
    return item?{kind:"unlockpop",icon:u.type==="customer"?"🎉":"🐾",heading:u.type==="customer"?"New customer unlocked!":"New pet unlocked!",title:item.name}:null;
  }).filter(Boolean);
  const revealShown=revealList.slice(0,2),revealHidden=revealList.length-revealShown.length;
  notices.push(...revealShown);
  if(revealHidden)notices.push({kind:"unlockpop unlock-summary",icon:"✨",heading:`${revealHidden} more new faces`,title:"See them in the Gallery."});
  queueRewardNotices(notices,{voice:ordered.length>0});
}
function celebrateAchievements(fresh){celebrateRewards(fresh,[]);}

/* ---- popup answer reveal (Normal mode only) — pausable,
   20-second auto-close, manual Close as fallback. Session/patience
   timers both respect SHIFT.popupOpen so nothing drains while
   someone is reading. ---- */
function ensureRevealDialog(){
  let dlg=document.getElementById("revealDlg");
  if(!dlg){
    dlg=document.createElement("dialog"); dlg.id="revealDlg"; dlg.className="reveal";
    dlg.innerHTML=`<div class="dlghead" id="revealTitle"></div>
      <div class="dlgbody" id="revealBody"></div>
      <div class="dlgfoot"><span class="closingtxt" id="revealClosing"></span>
        <div class="dlgbtns"><button class="pausebtn" id="revealPause">⏸️ Pause</button><button class="closebtn" id="revealClose">Close</button></div></div>`;
    document.body.appendChild(dlg);
  }
  return dlg;
}
function buildRevealBody(q, correct, entry, wordObj){
  const c=entry.cust;
  const line=correct?c.lines.correct[rnd(c.lines.correct.length)]:c.lines.wrong[rnd(c.lines.wrong.length)];
  const petBit=entry.pet?`<div class="petline">${entry.pet.name.replace(/^a /,"The ")} ${petReactionText(entry.pet,correct?"good":"bad")}</div>`:"";
  /* 11+ keeps its established headword pronunciation. Everyday speaks the
     authored answer (including inflections and complete sentences) and keeps
     the linked headword/definition in a distinct information block. */
  const canSay = Voice.available(); /* no silent buttons, no unearned rewards (audio QA #2/#3) */
  const everyday=q.courseId===COURSE_IDS.everyday;
  const speechText=everyday?String(q.speechText||q.ans||""):"";
  const answerInfo=everyday?`<div class="answerinfo"><b>Answer: <span lang="en-GB">${esc(q.ans)}</span></b>
      ${canSay&&speechText?`<button class="speakbtn inline" aria-label="Hear the answer" data-say="${esc(speechText)}">🔊</button><span class="listenbonus" id="listenBonus"></span>`:""}</div>`:"";
  const sayWord = canSay&&!everyday ? (wordObj ? wordObj.w : (q.ans && !/\s/.test(String(q.ans)) ? String(q.ans) : null)) : null;
  const wordInfo = wordObj ? `<div class="wordinfo">
      <b lang="en-GB">${esc(wordObj.w)}</b> ${phoneticOf(wordObj.w)?`<span class="phon">/${esc(phoneticOf(wordObj.w))}/</span>`:""}
      ${canSay?`<button class="speakbtn inline" ${everyday?"":`id="say2"`} aria-label="Hear this word" data-say="${esc(wordObj.w)}">🔊</button>${everyday?"":`<span class="listenbonus" id="listenBonus"></span>`}`:""}
      <div class="worddef" lang="en-GB">${esc(wordObj.def)}</div></div>`
    : sayWord ? `<div class="wordinfo">
      <b lang="en-GB">${esc(sayWord)}</b> ${phoneticOf(sayWord)?`<span class="phon">/${esc(phoneticOf(sayWord))}/</span>`:""}
      <button class="speakbtn inline" id="say2" aria-label="Hear this word" data-say="${esc(sayWord)}">🔊</button><span class="listenbonus" id="listenBonus"></span></div>` : "";
  const ansLine = !correct && q.ans ? `<div class="ansline">✔ The correct answer was: <b lang="en-GB">${esc(q.ans)}</b></div>` : "";
  return `${ansLine}<div class="explaintext" lang="en-GB">${q.explain}</div>${answerInfo}${wordInfo}<div class="custsay" lang="en-GB">“${esc(line)}”</div>${petBit}
    <div class="replyline" lang="en-GB">${esc(correct?PLAYER_REPLIES.good[rnd(PLAYER_REPLIES.good.length)]:PLAYER_REPLIES.bad[rnd(PLAYER_REPLIES.bad.length)])}</div>`;
}
function openReveal(correct, bodyHtml, wordObj, onDone){
  const dlg=ensureRevealDialog();
  const title=dlg.querySelector("#revealTitle");
  title.textContent = correct ? "✓ Lovely!" : "Not quite —";
  title.className = "dlghead " + (correct?"good":"okay");
  dlg.querySelector("#revealBody").innerHTML = bodyHtml;
  if(SHIFT) SHIFT.popupOpen=true;
  dlg.showModal();
  /* 🔊 listen button: speaks every time; the FIRST tap in each popup
     also pays +3 coins (repeat taps in the same popup don't — so
     listening is rewarded, farming isn't). QA v21: was +10, which
     outweighed a full easy correct answer's base tip of 8 — not a
     deliberate calibration. +3 keeps it a genuine, positive reward
     without being worth more than actually answering. */
  const speakButtons=[...dlg.querySelectorAll(".speakbtn[data-say]")];
  if(speakButtons.length){
    let rewarded=false;
    speakButtons.forEach(sb=>sb.onclick=()=>{
      AudioKit.tap(); Voice.speak(sb.dataset.say);
      if(!Voice.available()) return; /* toggle may have flipped mid-popup — no speech, no coins */
      if(!rewarded){
        rewarded=true;
        const p=P(); p._pronunClicks=(p._pronunClicks||0)+1;
        earn(3); AudioKit.coin(false);
        const bonus=dlg.querySelector("#listenBonus");
        if(bonus){ bonus.innerHTML=`+3 ${COIN}`; bonus.classList.remove("pop"); void bonus.offsetWidth; bonus.classList.add("pop"); }
        updateTopbar();
        celebrateAchievements(checkAchievements());
      }
    });
  }
  let secs=revealSeconds(), paused=false;
  const closingEl=dlg.querySelector("#revealClosing");
  const pauseBtn=dlg.querySelector("#revealPause");
  const manual = secs<=0; /* "Until I close it" setting */
  const update=()=>{closingEl.textContent = manual ? "Tap Close to continue" : (paused ? "Paused" : `Closing in ${secs}s…`);};
  update();
  const iv = manual ? null : setInterval(()=>{ if(paused||isSessionPausedFor("background"))return; secs--; if(secs<=0){clearInterval(iv);dlg.close();} else update(); },1000);
  pauseBtn.style.display = manual ? "none" : "";
  pauseBtn.textContent="⏸️ Pause"; pauseBtn.classList.remove("paused");
  pauseBtn.onclick=()=>{ paused=!paused; pauseBtn.classList.toggle("paused",paused); pauseBtn.textContent=paused?"▶ Resume":"⏸️ Pause"; update(); };
  dlg.querySelector("#revealClose").onclick=()=>{ if(iv)clearInterval(iv); dlg.close(); };
  const onClose=()=>{
    dlg.removeEventListener("close",onClose);
    if(iv)clearInterval(iv);
    if(SHIFT) SHIFT.popupOpen=false;
    onDone && onDone();
  };
  dlg.addEventListener("close", onClose);
}
/* ---- Time Challenge quick flash — no popup, just a right/wrong
   glyph over the stage for a moment, then straight to the next
   customer. ---- */
function showFlash(correct){
  const stage=$("#stage"); if(!stage) return;
  const el=document.createElement("div");
  el.className="flashcard "+(correct?"good":"bad");
  el.textContent=correct?"✓":"✗";
  stage.appendChild(el);
  setTimeout(()=>el.remove(),550);
}

function resolveAnswer(entry,q,answerText){
  const S=SHIFT,correct=answerText===q.ans,p=P();
  const wordCredit=questionHasWordMastery(q),masteryBefore=wordCredit?masteryStage(q.wid):null;
  recordAuthoredQuestionOutcome(q,correct);
  const masteredNow=!!(correct&&wordCredit&&masteryBefore!=="mastered"&&masteryStage(q.wid)==="mastered");
  noteResult(correct);S.answers++;wbNoteKind(S,q.authoredType||q.kind,correct);
  reactActivePlayerPetToAnswer(correct);
  if(!correct&&wordCredit)recordMissedWord(S,q);
  p._lifetimeAnswers=(p._lifetimeAnswers||0)+1;
  if(correct){
    S.rightAnswers++;entry.ticketRight++;S.streak++;S.bestStreak=Math.max(S.bestStreak,S.streak);
    p._lifetimeCorrect=(p._lifetimeCorrect||0)+1;
    p._bestSessionStreak=Math.max(p._bestSessionStreak||0,S.streak);
    p._typeRight=p._typeRight||{}; p._typeRight[q.kind]=(p._typeRight[q.kind]||0)+1; /* skill badges */
    rewardPetForCorrectAnswer(S.streak,masteredNow);
    AudioKit.answer(true,{streak:S.streak});
  } else { S.streak=0; AudioKit.cue("wrong");
    /* Rush Hour: five mix-ups end the run. Counted here (ordinary
       questions) and in the ladder's finish (failed climbs). */
    if(S.mode==="rush"){
      S.wrong=(S.wrong||0)+1; updateTopbar();
      if(S.wrong>=5){
        S.failedByMistakes=true;
        persist(); setExpr(entry,"sad"); showFlash(false);
        setTimeout(()=>{ if(SHIFT===S&&!S.ended) endShift(false); }, 700);
        return;
      }
    }
  }
  persist();
  setExpr(entry,correct?"delighted":"sad"); setBarista(correct?"delighted":"sad");
  /* S13b: the faces now show the reaction; no emoji pop-up */
  if(entry.pet){AudioKit.pet(entry.pet.species,correct);cafeCustomerPetReact(entry,correct);}
  updateTopbar();
  const fresh=checkAchievements();

  const advance=()=>{
    if(!SHIFT||SHIFT!==S||S.ended) return; /* session may have ended while the flash/reveal played */
    entry.qIndex++;
    if(entry.qIndex<entry.ticket.qs.length) renderQuestion(entry); else finishTicket(entry);
  };

  if(S.mode==="time"||S.mode==="rush"){
    showFlash(correct);
    celebrateAchievements(fresh);
    setTimeout(advance, 550);
  } else {
    const wordObj = q.wid ? allWords().find(w=>w.id===q.wid) : null;
    const bodyHtml = buildRevealBody(q, correct, entry, wordObj);
    openReveal(correct, bodyHtml, wordObj, advance);
    celebrateAchievements(fresh);
  }
}

/* ---- word ladder — accepts ANY valid real-word path, uses the
   same mode-aware reveal/flash split as every other question. ---- */
function renderLadder(entry,q){
  const S=SHIFT,L=q.ladder,c=entry.cust;
  let cur=L.path[0],done=[cur],misses=0;
  window.__ladderTimeoutHook = ()=>finish("timeout");
  function draw(){
    const target=L.end,pnl=$("#panel"); if(!pnl)return;
    pnl.innerHTML=`<div class="qhead"><span class="qcount">Word ladder <span class="tierpill ${q.tier}" data-i18n-ctx>${q.tier}</span></span></div>
      <div class="qtext" lang="en-GB">Climb from <b>${L.start}</b> to <b>${target}</b> — change <b>one letter</b> at a time, and every rung must be a real word.</div>
      <div class="ladderpath">${done.map(w=>`<span class="rung done">${w}</span>`).join("<span class='larrow'>→</span>")}
        ${done[done.length-1]!==target?`<span class='larrow'>→</span><span class="rung next">?</span>`:""}
        ${done[done.length-1]!==target?`<span class='larrow faint'>…</span><span class="rung goal">${target}</span>`:""}</div>
      ${done[done.length-1]!==target?choices():""}
      <div class="ctrl"><div class="patwrap"><span class="patlabel">Patience</span><div class="patmeter" id="patMeter"></div></div></div>`;
    $$("#panel .lopt").forEach(b=>b.onclick=()=>{
      const w=b.dataset.w;AudioKit.tap();
      const idx=L.path.indexOf(cur);
      const right=idx>=0&&idx<L.path.length-1?L.path[idx+1]:null;
      if(w===right){
        cur=w;done.push(w);AudioKit.cue(done.length>=4?"correct-combo":"correct",{streak:done.length});popEmote(entry,"🪜");
        /* When only the goal word itself remains, it isn't a puzzle —
           the target is displayed on screen. Auto-complete the last
           rung instead of asking the player to "find" it. */
        if(L.path.indexOf(cur)===L.path.length-2){
          cur=L.end;done.push(L.end);
          clearInterval(SHIFT.patTimer);
          draw(); AudioKit.cue("round");
          setTimeout(()=>finish("done"),700);
        } else if(w===L.end){clearInterval(SHIFT.patTimer);finish("done");}
        else draw();
      } else {
        /* 2026: a wrong rung resolves the whole ladder as INCORRECT
           immediately — parity with every other question type, where
           one wrong option ends the question. (The old retry-until-
           right loop meant a player could never actually get a ladder
           wrong, which defeated the puzzle.) */
        misses++;b.classList.add("wrong");b.disabled=true;AudioKit.cue("wrong");
        clearInterval(SHIFT.patTimer);
        finish("wrong", w);
      }
    });
    startPatience(entry);
  }
  function choices(){
    const idx=L.path.indexOf(cur);
    const right=idx>=0&&idx<L.path.length-1?L.path[idx+1]:null;
    const alts=new Set();
    for(let pos=0;pos<cur.length;pos++)for(const ch of "ABCDEFGHILMNOPRSTUW"){
      const w=cur.slice(0,pos)+ch+cur.slice(pos+1);
      if(w!==cur&&w!==right&&w!==L.end&&alts.size<24)alts.add(w);}
    const decoys=shuffle([...alts]).slice(0,right?3:4);
    const opts=shuffle(right?[right,...decoys]:decoys);
    return `<div class="opts" lang="en-GB">${opts.map(w=>`<button class="felt opt lopt" data-w="${w}">${w}</button>`).join("")}</div>
      <p class="note">Tap the next rung. Real words only — the ladder knows!</p>`;
  }
  function finish(reason, wrongWord){
    /* Grading (2026): reaching the top with no wrong taps = solved.
       One wrong rung, or running out of patience, = not solved —
       exactly like a wrong option on any other question type. */
    const solved=reason==="done";
    const perfectClimb=solved;
    const timedOut=reason==="timeout";
    const p=P();
    reactActivePlayerPetToAnswer(solved);
    if(solved){S.rightAnswers++;entry.ticketRight++;S.streak++;S.bestStreak=Math.max(S.bestStreak,S.streak);p._bestSessionStreak=Math.max(p._bestSessionStreak||0,S.streak);
      p._laddersDone=(p._laddersDone||0)+1;rewardPetForCorrectAnswer(S.streak,false);}
    else { S.streak=0;
      if(S.mode==="rush"){ S.wrong=(S.wrong||0)+1; updateTopbar();
        if(S.wrong>=5){ S.failedByMistakes=true; setTimeout(()=>{ if(SHIFT===S&&!S.ended) endShift(false); }, 650); return; } } }
    S.answers++;p._lifetimeAnswers=(p._lifetimeAnswers||0)+1;wbNoteKind(S,"ladder",solved);
    if(solved)p._lifetimeCorrect=(p._lifetimeCorrect||0)+1;
    noteResult(solved);persist();
    setExpr(entry,solved?"delighted":"sad");setBarista(solved?"delighted":"sad");
    cafeCustomerPetReact(entry,solved);updateTopbar();
    const fresh=checkAchievements();
    const advance=()=>{
      if(!SHIFT||SHIFT!==S||S.ended) return;
      entry.qIndex++;
      if(entry.qIndex<entry.ticket.qs.length)renderQuestion(entry);else finishTicket(entry);
    };
    if(S.mode==="time"||S.mode==="rush"){
      showFlash(solved);
      celebrateAchievements(fresh);
      setTimeout(advance,550);
    } else {
      const line=solved?c.lines.correct[0]:c.lines.wrong[0];
      const wrongReal = wrongWord && (typeof LADDER_DICT!=="undefined" && LADDER_DICT.has(wrongWord));
      const headline = perfectClimb ? "A perfect climb!"
        : timedOut ? "Time ran out on this one."
        : wrongWord ? (wrongReal ? `“${wrongWord}” is a real word, but it doesn't climb toward ${L.end}.`
                                 : `“${wrongWord}” isn't a word — the ladder only takes real words.`)
        : "Not quite this time.";
      const body=`<b>${headline}</b>
        The path was <b>${L.path.join(" → ")}</b>.
        <div class="wordinfo"><b lang="en-GB">${esc(L.end)}</b> ${phoneticOf(L.end)?`<span class="phon">/${esc(phoneticOf(L.end))}/</span>`:""}
          ${Voice.available()?`<button class="speakbtn inline" id="say2" aria-label="Hear this word" data-say="${esc(L.end)}">🔊</button><span class="listenbonus" id="listenBonus"></span>`:""}</div>
        <div class="custsay" lang="en-GB">“${esc(line)}”</div>`;
      openReveal(solved, body, null, advance);
      celebrateAchievements(fresh);
    }
  }
  draw();
}

function confirmQuit(){
  if(confirm(wbT("End this session early? Tips earned so far are kept.")))endShift(true);
}

/* ---- Quick settings (in-session pause overlay) ----
   The handful of settings that matter mid-game, in a modal dialog:
   the session clock, patience and Rush spawns all pause via
   SHIFT.popupOpen while it's open, and everything resumes exactly
   where it was on Close. Full Settings stays on the main menu. */
function openQuickSettings(){
  const S=SHIFT, p=P(), s=p.settings;
  let dlg=document.getElementById("quickSetDlg");
  if(dlg) dlg.remove();
  dlg=document.createElement("dialog"); dlg.id="quickSetDlg"; dlg.className="reveal";
  const tog=(id,label,on)=>`<div class="setrow"><span>${label}</span><button type="button" role="switch" aria-checked="${on?"true":"false"}" aria-label="${esc(label)}" class="switch ${on?"on":""}" data-qs="${id}"><span class="knob"></span></button></div>`;
  dlg.innerHTML=`<div class="dlghead good">⏸️ Paused</div>
    <div class="dlgbody">
      ${tog("sound","Sound effects",s.sound)}
      ${tog("music","Background music",s.music)}
      ${tog("voice","Word pronunciation",s.voice)}
      ${tog("petSounds","Pet sounds & reactions",s.petSounds!==false)}
      <p class="note">More options live under Café Theme and Settings on the main menu.</p>
    </div>
    <div class="dlgfoot"><span class="closingtxt">The café is waiting…</span>
      <div class="dlgbtns"><button class="closebtn" id="quickSetClose">▶ Resume</button></div></div>`;
  document.body.appendChild(dlg);
  if(S) S.popupOpen=true;
  dlg.showModal();
  dlg.querySelectorAll("[data-qs]").forEach(b=>b.onclick=()=>{
    s[b.dataset.qs]=!s[b.dataset.qs]; persist(); b.classList.toggle("on");
    b.setAttribute("aria-checked",b.classList.contains("on")?"true":"false");
    if(b.dataset.qs==="music"){s.music?AudioKit.ambientStart():AudioKit.ambientStop();}
    AudioKit.sync();AudioKit.tap();
  });
  const done=()=>{ if(S&&SHIFT===S) S.popupOpen=false; dlg.remove(); };
  dlg.querySelector("#quickSetClose").onclick=()=>{ AudioKit.tap(); dlg.close(); };
  dlg.addEventListener("close", done);
}

/* ---- ticket resolution: cup slide, tip, celebration burst, then
   auto-advance to the next customer ---- */
function finishTicket(entry){
  const S=SHIFT,c=entry.cust,pp=P();
  const perfect=entry.ticketRight===entry.ticket.qs.length;
  if(perfect)S.perfect++;
  /* collection counters for the trophy expansion */
  pp._custServed=pp._custServed||[]; if(!pp._custServed.includes(c.id))pp._custServed.push(c.id);
  pp._drinksTried=pp._drinksTried||[]; if(entry.ticket.drinkKind&&!pp._drinksTried.includes(entry.ticket.drinkKind))pp._drinksTried.push(entry.ticket.drinkKind);
  pp._foodsTried=pp._foodsTried||[]; if(entry.ticket.food&&!pp._foodsTried.includes(entry.ticket.food.kind))pp._foodsTried.push(entry.ticket.food.kind);
  if(pp.kitchen){
    const counts=pp.kitchen.foodServeCounts||(pp.kitchen.foodServeCounts={});
    if(entry.ticket.food&&KITCHEN_KNOWN_FOODS.has(entry.ticket.food.kind))counts[entry.ticket.food.kind]=(counts[entry.ticket.food.kind]||0)+1;
    if(entry.ticket.drinkKind&&KITCHEN_KNOWN_FOODS.has(entry.ticket.drinkKind))counts[entry.ticket.drinkKind]=(counts[entry.ticket.drinkKind]||0)+1;
  }
  /* Count the customer as served NOW, the instant their ticket is
     scored — not later in departCurrent's animation callback. That
     callback fires 700–1600ms after this point, and if the session
     ends (via "End session early", or the target check below) during
     that window, S.served would still be one behind S.perfect,
     producing an impossible summary line like "Perfect tickets 3/2".
     Bookkeeping and the walk-off animation are now decoupled. */
  S.served++;
  if(perfect && entry.ticket.qs.length>1 && (c.special||c.tier==="vip"||c.tier==="secret")){
    queuePlayerPetCelebration("perfectTicket");
  }
  let tip=ticketTip(entry.ticket,perfect,S.streak);
  if(S.weekend)tip=Math.round(tip*1.2);
  S.tips+=tip;earn(tip);
  saveShiftResume(S);   /* S9b: the running totals survive an interruption */
  /* The 200-coin line may have just been crossed — queue the debut so
     the new face can walk in and say hello after this customer leaves. */
  const freshU=checkUnlocks();
  if(freshU.length){ S.pendingDebuts=(S.pendingDebuts||[]).concat(freshU); }
  AudioKit.coin(tip>=25);
  /* S9c: a one-question ticket already got its chime (and combo); the
     "result" chime marks a perfect multi-question ticket only. */
  if(perfect){ if(entry.ticket.qs.length>1)setTimeout(()=>AudioKit.cue("result"),260); Voice.celebrate(); }
  setExpr(entry,perfect?"delighted":"neutral");
  setBarista(perfect?"delighted":"happy"); updateTopbar();
  cupSlide(entry,perfect,()=>{
    if(perfect) spawnBurst($("#stage"));
    const dep=perfect?c.lines.departGood[rnd(c.lines.departGood.length)]:c.lines.departOk[rnd(c.lines.departOk.length)];
    const pnl=$("#panel"); if(!pnl)return;
    pnl.innerHTML=`<div class="result">
      <div class="drinkline">${drinkSVG(entry.ticket,perfect)}${entry.ticket.food?foodSVG(entry.ticket.food,perfect):""}<div><b>${entry.ticket.drinkEmoji||"🍹"} ${esc(entry.ticket.drink)}</b>${entry.ticket.food?`<br><b>${entry.ticket.food.emoji} ${esc(entry.ticket.food.name)}</b>`:""}<br><small>${perfect?"Made to perfection! ✨":"A decent effort — nearly perfect!"}</small></div></div>
      <div class="custsay" lang="en-GB">“${esc(dep)}”</div>
      <div class="tipline">+${tip} tips ${COIN} ${perfect&&S.streak>1?`<span class="pill">🔥 streak ×${S.streak}</span>`:""}${S.weekend?`<span class="pill">🎉 rush +20%</span>`:""}</div></div>`;
    shiftDelay(()=>{ if(SHIFT&&SHIFT===S&&!S.ended) departCurrent(); }, S.mode==="rush"?700:S.mode==="time"?1000:2400);
  });
}

/* 🎉 In-café debut: the freshly unlocked customer walks in for a bow,
   or the new pet bounds up to the counter — a proper little ceremony
   the moment the reveal happens, not just a note at session end.
   While the ceremony plays, the session is treated like an open popup
   (debutActive + popupOpen): the Rush spawn loop won't takeNext() over
   the top of it and the Time Challenge clock doesn't tick — previously
   a Rush spawn could start serving mid-ceremony, the ceremony then
   wiped the question panel, and the invisible question timed out into
   a wrong answer + a long "Here comes the next customer…" stall. */
function departDebutDone(){
  const S=SHIFT; if(!S) return;
  if(S.pendingDebuts && S.pendingDebuts.length){ playDebut(S.pendingDebuts.shift()); return; }
  S.debutActive=false; S.popupOpen=false;
  const pnl=$("#panel"); if(pnl)pnl.innerHTML=`<div class="waitmsg">Here comes the next customer…</div>`;
  /* Rush: don't leave the player staring at an empty counter until the
     spawn timer happens to fire — bring the next customer straight in. */
  if(S.mode==="rush" && !S.current && !S.queue.length) spawnCustomer();
  pump();
}
const REDRAWN_FOOD_ART=new Set(["tomatosoup","bakedsalmon","stuffedpepper","lasagne","shepherdspie","quichelorraine","eggfriedrice","padthai","chickenkatsu","prawntempura","springrolls","paella","applepie","chocolatebrownie","chocolateeclair","cinnamonroll","doughnut","omelette","pancakes","waffles","eggsoldiers","eggsbenedict","cornoncob","pretzel","vegetableskewers","curryfishballs","eggwaffle","siumai","threetreasures","hotdog","chips","churros","burger","pizza","fishchips","chickenwings","pasta","sandwich","croissant","muffin","cookie","ramen","sushi","dumplings","curryrice","roastchicken","maccheese","jacketpotato"]);
function foodSVG(food, perfect){
  const c=food.color||"#C97B4A",k=food.kind,ink="#2E2440";
  /* Build 83: use the approved reference-led redraws. Ice cream stays
     inline below so its six flavour colours remain dynamic. */
  if(REDRAWN_FOOD_ART.has(k))return `<span class="foodartsprite ${perfect?"perfect":""}"><img src="assets/food/${k}.svg" width="52" height="49" alt="" aria-hidden="true"></span>`;
  let art="";
  if(k==="hotdog"){
    /* Batch 01 redraw: the split bun sits behind a full capsule-shaped
       sausage, so the three signature layers still read at 52px. */
    art=`<ellipse cx="30" cy="45.5" rx="22" ry="4" fill="#C48745" opacity=".22"/>
      <path d="M7.5 36 Q10 23.5 20 21.5 L40 21.5 Q50 23.5 52.5 36 Q48 45 39 47 L21 47 Q12 45 7.5 36 Z" fill="#E7B968" stroke="${ink}" stroke-width="2"/>
      <path d="M10.5 33 Q16 27 23 28.5 L37 28.5 Q44 27 49.5 33 L47 40 Q43 43 37.5 43 L22.5 43 Q17 43 13 40 Z" fill="#F3D48E"/>
      <rect x="13" y="27" width="34" height="12.5" rx="6.25" fill="${c}" stroke="${ink}" stroke-width="1.8" transform="rotate(-1 30 33.25)"/>
      <path d="M17 32.5 q3.2 -3 6.4 0 t6.4 0 t6.4 0 t6.4 0" fill="none" stroke="#F6C844" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12 28 Q18 23 25 24" fill="none" stroke="#FFF0BD" stroke-width="2" stroke-linecap="round" opacity=".75"/>`;
  }else if(k==="chips"){
    /* Five deliberately varied fry silhouettes make this read as chips,
       not three yellow posts; the carton stays centred on x=30. */
    art=`<ellipse cx="30" cy="48.5" rx="18" ry="3" fill="#7C4A34" opacity=".18"/>
      <g stroke="${ink}" stroke-width="1.35" stroke-linejoin="round">
        <path d="M17.5 31 L15.5 11.5 Q15.5 9.5 17.5 9.3 L20 9.1 Q22 9 22.2 11 L24 30.5 Z" fill="#F7D56A"/>
        <path d="M23 30 L23.5 7.8 Q23.5 6 25.5 6 L28.2 6 Q30 6 30 8 L29.7 30 Z" fill="#F3C84E"/>
        <path d="M29.5 30 L31.5 5.5 Q31.7 3.8 33.5 4 L36.2 4.2 Q38 4.4 37.8 6.2 L35.8 31 Z" fill="#FFE082"/>
        <path d="M35 31 L39 9.5 Q39.3 7.7 41 8 L43.5 8.5 Q45.3 8.8 45 10.7 L41.3 32 Z" fill="#F3C84E"/>
        <path d="M12.5 31.5 L10.5 17 Q10.3 15.2 12.1 15 L14.5 14.7 Q16.3 14.5 16.5 16.3 L18.3 31 Z" fill="#F8DA73"/>
      </g>
      <path d="M12.5 27 Q30 31 47.5 27 L43 47 Q30 53 17 47 Z" fill="#E34F43" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M12.5 27 Q30 32.5 47.5 27" fill="none" stroke="#FF8270" stroke-width="2"/>
      <path d="M24 35 Q30 32.5 36 35 L35 41 Q30 44 25 41 Z" fill="#FFF4DE" opacity=".95"/>
      <path d="M21 46 Q30 49 39 46" fill="none" stroke="#C83C35" stroke-width="1.5" opacity=".8"/>`;
  }else if(k==="churros"){
    /* Churros need longitudinal piping ridges. Three sticks use separate
       transforms but retain a balanced silhouette around x=30. */
    art=`<ellipse cx="29" cy="48.5" rx="21" ry="3" fill="#7A4B31" opacity=".17"/>
      <g stroke="${ink}" stroke-width="1.45" stroke-linejoin="round">
        <g transform="rotate(-11 20.5 25)"><rect x="16.5" y="7" width="8" height="35" rx="3.5" fill="#C67E32"/><path d="M19 9 L19 39 M22 9 L22 39" stroke="#E7AD5B" stroke-width="1" opacity=".9"/></g>
        <g transform="rotate(1 30 23)"><rect x="26" y="4.5" width="8" height="37" rx="3.5" fill="#D7953E"/><path d="M28.5 7 L28.5 39 M31.5 7 L31.5 39" stroke="#F0BB68" stroke-width="1" opacity=".9"/></g>
        <g transform="rotate(12 39.5 25)"><rect x="35.5" y="7" width="8" height="35" rx="3.5" fill="#BF7430"/><path d="M38 9 L38 39 M41 9 L41 39" stroke="#E5A657" stroke-width="1" opacity=".9"/></g>
      </g>
      <g fill="#FFF1CF" opacity=".9"><circle cx="16" cy="16" r="1"/><circle cx="24" cy="24" r=".9"/><circle cx="31" cy="12" r="1"/><circle cx="36" cy="29" r=".9"/><circle cx="44" cy="18" r="1"/></g>
      <path d="M10 39 Q21 35.5 32 40 Q41 37 50 40 L46 49 Q30 54 14 49 Z" fill="#FFF6E8" stroke="${ink}" stroke-width="2"/>
      <path d="M13 41 Q22 38 32 42 Q41 39 48 41" fill="none" stroke="#E8D7BE" stroke-width="1.4"/>`;
  }else if(k==="burger"){
    /* The layer stack is the signature: bun, lettuce, tomato, cheese,
       patty and heel are separated by both hue and outline. */
    art=`<ellipse cx="30" cy="50.5" rx="21" ry="3" fill="#6A3C2C" opacity=".18"/>
      <path d="M10.5 26 Q13 10.5 30 9 Q47 10.5 49.5 26 Z" fill="#E7AD59" stroke="${ink}" stroke-width="2"/>
      <path d="M15 22 Q20 13.5 30 13 Q40 13.5 45 22" fill="none" stroke="#F8D487" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>
      <g fill="#FFF0C0" transform="rotate(-5 30 18)"><ellipse cx="20" cy="17" rx="1.7" ry=".75"/><ellipse cx="29" cy="13.5" rx="1.7" ry=".75"/><ellipse cx="39" cy="18" rx="1.7" ry=".75"/><ellipse cx="31" cy="21" rx="1.6" ry=".7"/></g>
      <path d="M10 27 q4.8 -4 9.5 0 q4.8 4 9.5 0 q4.8 -4 9.5 0 q4.8 4 11.5 0 L48 32 Q42 35 36 32 Q30 36 24 32 Q18 35 12 32 Z" fill="#75A957" stroke="${ink}" stroke-width="1.45"/>
      <path d="M13 32 Q30 28.5 47 32 L45.5 36 Q30 39 14.5 36 Z" fill="#D85B4C" stroke="${ink}" stroke-width="1.45"/>
      <path d="M12.5 36 L47.5 36 L42 43 L31 40.5 L19 44 Z" fill="#F4C84E" stroke="${ink}" stroke-width="1.45" stroke-linejoin="round"/>
      <rect x="11.5" y="39" width="37" height="7.5" rx="3.75" fill="#70432F" stroke="${ink}" stroke-width="1.8"/>
      <path d="M10.5 46 L49.5 46 Q48 52 30 52 Q12 52 10.5 46 Z" fill="#D99A4C" stroke="${ink}" stroke-width="2"/>
      <path d="M16 48 Q30 51 44 48" fill="none" stroke="#F0BD6E" stroke-width="1.5" opacity=".8"/>`;
  }else if(k==="icecream"){
    /* Soft-serve variant chosen deliberately: its tiered spiral is more
       recognisable than the old single scoop at the game's small size. */
    art=`<ellipse cx="30" cy="51.5" rx="10" ry="2.2" fill="#7A4A2C" opacity=".16"/>
      <path d="M20 29.5 L40 29.5 L32.5 52 Q30 54 27.5 52 Z" fill="#D59A4D" stroke="${ink}" stroke-width="1.9" stroke-linejoin="round"/>
      <path d="M22.5 33 L36.5 45 M37.5 33 L23.5 45 M25.5 47 L34.5 38" fill="none" stroke="#A96E36" stroke-width="1.15" opacity=".9"/>
      <path d="M19 28.5 Q17.5 24 22.5 21.5 Q19.5 17 25.5 15 Q23.5 10.5 30 8 Q36.5 10.5 34.5 15 Q40.5 17 37.5 21.5 Q42.5 24 41 28.5 Q30 33.5 19 28.5 Z" fill="${c}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M25.5 15 Q30 17.5 34.5 15 M22.5 21.5 Q30 25 37.5 21.5 M19.5 27.8 Q30 31.2 40.5 27.8" fill="none" stroke="#FFF" stroke-width="1.7" stroke-linecap="round" opacity=".62"/>
      <path d="M28 10.5 Q30 9.3 32 10.5" fill="none" stroke="#FFF" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>`;
  }else if(k==="pizza"){
    art=`<path d="M13 45 L27 10 Q43 17 49 34 Z" fill="#F3D27B" stroke="${ink}" stroke-width="2"/><path d="M25 10 Q39 14 50 31" fill="none" stroke="#B96A3F" stroke-width="5" stroke-linecap="round"/><path d="M17 41 Q31 31 47 34" fill="none" stroke="#D65A45" stroke-width="3"/><circle cx="30" cy="25" r="3.2" fill="#C94C42"/><circle cx="39" cy="31" r="2.8" fill="#C94C42"/><circle cx="24" cy="34" r="2.5" fill="#7FA65A"/>`;
  }else if(k==="fishchips"){
    art=`<path d="M8 36 Q19 24 33 33 Q24 45 8 39 L3 44 L4 34 Z" fill="#E8C35A" stroke="${ink}" stroke-width="1.8"/><circle cx="14" cy="34" r="1.5" fill="${ink}"/><path d="M36 15 l4 21 M42 13 l3 24 M48 17 l1 20" stroke="#F2C24E" stroke-width="4" stroke-linecap="round"/><path d="M31 33 L54 33 L50 50 L34 49 Z" fill="#D8544C" stroke="${ink}" stroke-width="2"/>`;
  }else if(k==="chickenwings"){
    art=`<path d="M18 39 Q13 29 20 22 Q28 14 36 20 Q43 27 37 35 Q30 44 18 39 Z" fill="#C97B4A" stroke="${ink}" stroke-width="2"/><path d="M35 21 Q43 17 47 22 Q50 27 44 31" fill="#E8C9A0" stroke="${ink}" stroke-width="2"/><circle cx="47" cy="22" r="3" fill="#F7EAD6" stroke="${ink}" stroke-width="1.4"/><path d="M21 26 q8 -5 13 0" stroke="#E5A56D" stroke-width="2" fill="none"/>`;
  }else if(k==="pasta"){
    art=`<path d="M10 31 Q30 25 50 31 L46 49 Q30 55 14 49 Z" fill="#F6EFE3" stroke="${ink}" stroke-width="2"/><path d="M14 31 Q30 37 46 31" fill="none" stroke="#D86D4C" stroke-width="5"/><path d="M18 28 q5 -7 10 0 q5 7 10 0 q5 -7 9 0" fill="none" stroke="#E6BD63" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="29" r="2" fill="#7FA65A"/><circle cx="39" cy="30" r="2" fill="#7FA65A"/>`;
  }else if(k==="sandwich"){
    art=`<path d="M11 39 L30 13 L49 39 Z" fill="#E5C27A" stroke="${ink}" stroke-width="2"/><path d="M15 36 L30 18 L45 36 Z" fill="#F6E5A8"/><path d="M17 34 L43 34" stroke="#7FA65A" stroke-width="4"/><path d="M19 38 L41 38" stroke="#D8544C" stroke-width="3"/><circle cx="30" cy="18" r="1" fill="#B98A48"/>`;
  }else if(k==="croissant"){
    art=`<path d="M10 37 Q15 16 30 15 Q45 16 50 37 Q43 31 38 30 Q34 40 30 42 Q26 40 22 30 Q17 31 10 37 Z" fill="#D99A45" stroke="${ink}" stroke-width="2"/><path d="M20 24 Q23 30 22 34 M30 18 L30 39 M40 24 Q37 30 38 34" stroke="#B8733D" stroke-width="1.5" fill="none"/>`;
  }else if(k==="muffin"){
    art=`<path d="M18 29 L42 29 L39 49 Q30 54 21 49 Z" fill="#8EA4C8" stroke="${ink}" stroke-width="2"/><path d="M19 29 Q15 22 20 17 Q24 12 30 16 Q36 11 41 17 Q46 23 41 29 Z" fill="#B98A67" stroke="${ink}" stroke-width="2"/><circle cx="25" cy="22" r="2" fill="#5567A0"/><circle cx="36" cy="20" r="2" fill="#5567A0"/><path d="M24 34 L23 47 M30 34 L30 50 M36 34 L37 47" stroke="#6079A0" stroke-width="1.3"/>`;
  }else if(k==="cookie"){
    art=`<circle cx="30" cy="30" r="18" fill="#B97B45" stroke="${ink}" stroke-width="2"/><circle cx="22" cy="22" r="2.2" fill="#5E3A2A"/><circle cx="36" cy="20" r="2" fill="#5E3A2A"/><circle cx="40" cy="34" r="2.3" fill="#5E3A2A"/><circle cx="25" cy="38" r="2" fill="#5E3A2A"/><circle cx="31" cy="29" r="1.7" fill="#5E3A2A"/>`;
  }else if(k==="ramen"){
    art=`<path d="M9 29 Q30 24 51 29 L47 48 Q30 56 13 48 Z" fill="#D8544C" stroke="${ink}" stroke-width="2"/><path d="M13 29 Q30 35 47 29" fill="none" stroke="#F5D67A" stroke-width="5"/><path d="M18 26 q4 -7 8 0 q4 7 8 0 q4 -7 8 0" fill="none" stroke="#E9C45D" stroke-width="2.5"/><circle cx="38" cy="27" r="5" fill="#FFF4D5" stroke="${ink}" stroke-width="1.4"/><circle cx="38" cy="27" r="2.2" fill="#F1B53B"/><path d="M18 21 L45 9" stroke="#6B4934" stroke-width="2"/>`;
  }else if(k==="sushi"){
    art=`<g stroke="${ink}" stroke-width="1.5"><rect x="8" y="26" width="13" height="16" rx="3" fill="#29353B"/><rect x="23.5" y="23" width="13" height="19" rx="3" fill="#F7F0E3"/><rect x="39" y="26" width="13" height="16" rx="3" fill="#29353B"/></g><path d="M10 25 Q15 19 21 25" fill="#E58D75" stroke="${ink}" stroke-width="1.4"/><path d="M25 22 Q30 16 36 22" fill="#E58D75" stroke="${ink}" stroke-width="1.4"/><path d="M41 25 Q46 19 52 25" fill="#7FA65A" stroke="${ink}" stroke-width="1.4"/>`;
  }else if(k==="dumplings"){
    art=`<path d="M8 39 Q15 20 25 39 Z" fill="#EED6A8" stroke="${ink}" stroke-width="2"/><path d="M20 39 Q30 17 40 39 Z" fill="#F5E2B8" stroke="${ink}" stroke-width="2"/><path d="M35 39 Q45 20 53 39 Z" fill="#EED6A8" stroke="${ink}" stroke-width="2"/><path d="M12 34 q5 -5 9 0 M25 33 q5 -6 10 0 M40 34 q5 -5 9 0" fill="none" stroke="#C7A870" stroke-width="1.2"/>`;
  }else if(k==="curryrice"){
    art=`<ellipse cx="30" cy="40" rx="23" ry="9" fill="#F7F0E4" stroke="${ink}" stroke-width="2"/><path d="M10 39 Q18 25 30 35 Q24 47 10 42 Z" fill="#D6A03A" stroke="${ink}" stroke-width="1.5"/><path d="M28 38 Q35 22 48 38 Q40 44 28 42 Z" fill="#F7F3E8" stroke="${ink}" stroke-width="1.5"/><circle cx="17" cy="35" r="2" fill="#7FA65A"/><circle cx="22" cy="38" r="2" fill="#C97B4A"/>`;
  }else if(k==="roastchicken"){
    art=`<ellipse cx="29" cy="33" rx="18" ry="13" fill="#B87343" stroke="${ink}" stroke-width="2"/><path d="M39 32 Q48 25 52 30 Q55 35 48 38" fill="#D89A60" stroke="${ink}" stroke-width="2"/><circle cx="53" cy="29" r="3" fill="#F5E7D5" stroke="${ink}" stroke-width="1.4"/><path d="M20 25 q9 -6 17 0" stroke="#E0A46F" stroke-width="2" fill="none"/><ellipse cx="30" cy="49" rx="23" ry="4" fill="#E7D7BD" stroke="${ink}" stroke-width="1.5"/>`;
  }else if(k==="maccheese"){
    art=`<path d="M10 30 Q30 24 50 30 L46 48 Q30 55 14 48 Z" fill="#F6EFE3" stroke="${ink}" stroke-width="2"/><path d="M14 30 Q30 36 46 30" fill="none" stroke="#F0BD45" stroke-width="6"/><g fill="none" stroke="#C58A2D" stroke-width="2"><path d="M19 28 q4 -4 8 0 q-4 5 -8 0"/><path d="M29 27 q4 -4 8 0 q-4 5 -8 0"/><path d="M38 30 q4 -4 8 0 q-4 5 -8 0"/></g>`;
  }else if(k==="jacketpotato"){
    art=`<ellipse cx="30" cy="32" rx="19" ry="15" fill="#A86B3C" stroke="${ink}" stroke-width="2"/><path d="M18 28 Q30 38 42 28 Q38 21 30 20 Q22 21 18 28 Z" fill="#F4E4C5" stroke="${ink}" stroke-width="1.5"/><path d="M25 25 Q30 31 35 25" stroke="#F0BD45" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="37" r="1" fill="#7A4D2F"/><circle cx="42" cy="34" r="1" fill="#7A4D2F"/>`;
  }else{
    art=`<circle cx="30" cy="30" r="18" fill="${c}" stroke="${ink}" stroke-width="2"/><text x="30" y="36" text-anchor="middle" font-size="20">${food.emoji||"🍽️"}</text>`;
  }
  const spark=perfect?`<path d="M8 8 l2 5 M51 9 l-2 5 M30 2 l0 5" stroke="#F2B33D" stroke-width="1.7" stroke-linecap="round"/>`:"";
  return `<svg viewBox="0 0 60 56" width="52" height="49" aria-hidden="true">${spark}${art}</svg>`;
}
function drinkSVG(ticket, perfect){
  const t=THEMES[P().settings.theme]||THEMES.sunny;
  const kind=(ticket&&ticket.drinkKind)||"juice";
  const c=(ticket&&ticket.drinkColor)||t.accent;
  const spark = perfect?`<path d="M8 6 l2 4 M52 8 l-2 4 M30 -2 l0 4" stroke="#F2B33D" stroke-width="2" stroke-linecap="round" class="twinkle"/>`:"";
  let body="";
  if(kind==="coffee"){
    body=`<ellipse cx="30" cy="69" rx="24" ry="4" fill="#7B5B52" opacity=".16"/>
      <ellipse cx="30" cy="64.5" rx="23" ry="4.7" fill="#FFF7EB" stroke="#2E2440" stroke-width="2"/>
      <path d="M10 29 Q30 24 50 29 L47 55 Q45 64 30 66 Q15 64 13 55 Z" fill="#FFF4E4" stroke="#2E2440" stroke-width="2.4"/>
      <path d="M48 35 Q56 34 55 44 Q54 53 46.5 52" fill="none" stroke="#2E2440" stroke-width="3.2" stroke-linecap="round"/>
      <ellipse cx="30" cy="29" rx="20" ry="5.6" fill="${c}" stroke="#2E2440" stroke-width="2.2"/>
      <ellipse cx="30" cy="29" rx="15.5" ry="3.9" fill="#EFD8BF"/>
      <path d="M24 29 Q30 22 36 29 Q31 35 24 29 Z" fill="#FFF9EE" stroke="#DABF9E" stroke-width=".8"/>
      <path d="M18 46 Q30 50 43 46" fill="none" stroke="#E8D1B7" stroke-width="1.6" opacity=".9"/>
      <path d="M22 21 Q18 16 23 11 Q27 7 23 3 M34 21 Q30 16 35 11 Q39 7 35 3" fill="none" stroke="#B9AEC6" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>`;
  } else if(kind==="tea"){
    body=`<ellipse cx="30" cy="69" rx="24" ry="4" fill="#7B5B52" opacity=".14"/>
      <ellipse cx="30" cy="64" rx="24" ry="5.2" fill="#FFF8EA" stroke="#2E2440" stroke-width="2.2"/>
      <path d="M9 32 Q30 27 51 32 L47 50 Q44 60 30 61 Q16 60 13 50 Z" fill="#FFF8EA" stroke="#2E2440" stroke-width="2.3"/>
      <path d="M49 36 Q59 36 57 45 Q55 53 47 50" fill="none" stroke="#2E2440" stroke-width="2.8" stroke-linecap="round"/>
      <ellipse cx="30" cy="32" rx="21" ry="5.5" fill="#F7EEDA" stroke="#2E2440" stroke-width="2"/>
      <ellipse cx="30" cy="32" rx="16.7" ry="3.7" fill="${c}" opacity=".92"/>
      <path d="M12 43 Q30 48 48 43" fill="none" stroke="#E3B4B9" stroke-width="1.7" opacity=".9"/>
      <path d="M40 32 Q44 37 47 45" fill="none" stroke="#7F6A68" stroke-width="1.3"/>
      <path d="M43.5 45 L51 45 L52 55 L45 56 Z" fill="#D8547A" stroke="#2E2440" stroke-width="1.5"/>
      <path d="M23 24 Q19 19 24 14 Q28 10 24 6" fill="none" stroke="#B9AEC6" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
  } else if(kind==="smoothie"){
    body=`<ellipse cx="30" cy="74" rx="17" ry="3.2" fill="#714D63" opacity=".15"/>
      <path d="M15 25 L45 25 L42 69 Q30 74 18 69 Z" fill="${c}" stroke="#2E2440" stroke-width="2.4"/>
      <path d="M20 45 Q25 40 30 45 T40 45 M20 55 Q25 50 30 55 T40 55" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" opacity=".45"/>
      <path d="M14 25 Q15 8 30 7 Q45 8 46 25 Z" fill="#F5FAFC" fill-opacity=".7" stroke="#2E2440" stroke-width="2.2"/>
      <path d="M18 23 Q21 15 27 17 Q28 11 34 14 Q39 15 42 23 Z" fill="${c}" opacity=".95"/>
      <ellipse cx="30" cy="25" rx="16" ry="4" fill="#FFF" fill-opacity=".55" stroke="#2E2440" stroke-width="1.7"/>
      <path d="M31 22 L34 2 L39 3 L36 24" fill="#F2B33D" stroke="#2E2440" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="19" cy="16" r="5" fill="${c}" stroke="#2E2440" stroke-width="1.5"/>
      <path d="M18 11 Q19 7 23 8 M19 11 Q15 8 14 11" fill="none" stroke="#5B8E56" stroke-width="1.8" stroke-linecap="round"/>`;
  } else if(kind==="fizz"){
    body=`<ellipse cx="30" cy="74" rx="17" ry="3.2" fill="#526A7A" opacity=".15"/>
      <path d="M14 14 L46 14 L42 69 Q30 75 18 69 Z" fill="#ECFAFF" fill-opacity=".52" stroke="#2E2440" stroke-width="2.3"/>
      <path d="M16.5 26 L43.5 26 L40 67 Q30 71 20 67 Z" fill="${c}" opacity=".72"/>
      <ellipse cx="30" cy="26" rx="13.5" ry="3.1" fill="#FFF" opacity=".5"/>
      <ellipse cx="30" cy="14" rx="16" ry="4.1" fill="#FFF" fill-opacity=".45" stroke="#2E2440" stroke-width="1.8"/>
      <g fill="#E8FAFF" fill-opacity=".72" stroke="#FFF" stroke-width=".8"><path d="M20 29 l8 -2 l2 9 l-8 2 Z"/><path d="M32 34 l8 -1 l1 9 l-8 1 Z"/><path d="M23 45 l8 -1 l1 9 l-8 1 Z"/></g>
      <g fill="#FFF" opacity=".88"><circle cx="36" cy="58" r="1.7"/><circle cx="35" cy="51" r="1.2"/><circle cx="27" cy="62" r="1.1"/><circle cx="31" cy="42" r="1"/><circle cx="38" cy="29" r="1.2"/></g>
      <path d="M39 17 L48 5 Q55 11 53 19 Z" fill="#F2C94C" stroke="#2E2440" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M42 16 L49 8 Q52 12 51 17 Z" fill="#FFF2A8"/>
      <path d="M20 31 L19 59" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" opacity=".5"/>`;
  } else { /* juice */
    body=`<ellipse cx="30" cy="73" rx="17" ry="3.4" fill="#65727C" opacity=".14"/>
      <path d="M14 16 L46 16 L43 68 Q30 73 17 68 Z" fill="#EAF7FA" fill-opacity=".55" stroke="#2E2440" stroke-width="2.3"/>
      <path d="M16.5 27 L43.5 27 L41 66 Q30 70 19 66 Z" fill="${c}" opacity=".9"/>
      <ellipse cx="30" cy="27" rx="13.5" ry="3.3" fill="#FFF0A7" opacity=".55"/>
      <ellipse cx="30" cy="16" rx="16" ry="4.2" fill="#FFF" fill-opacity=".48" stroke="#2E2440" stroke-width="1.8"/>
      <path d="M21 33 L20 58" stroke="#FFF" stroke-width="2" stroke-linecap="round" opacity=".55"/>
      <g fill="#FFF3C4" opacity=".7"><circle cx="34" cy="38" r="1"/><circle cx="27" cy="47" r=".9"/><circle cx="36" cy="56" r=".8"/></g>
      <path d="M32 25 L38 3 L42 4 L36 27" fill="#F2B33D" stroke="#2E2440" stroke-width="1.4" stroke-linejoin="round"/>
      <circle cx="15" cy="19" r="7.2" fill="${c}" stroke="#2E2440" stroke-width="1.7"/>
      <circle cx="15" cy="19" r="4.6" fill="#FFF0B5"/>
      <path d="M15 14.5 V23.5 M10.5 19 H19.5 M11.8 15.8 L18.2 22.2 M18.2 15.8 L11.8 22.2" stroke="#E79A2E" stroke-width=".8"/>`;
  }
  return `<svg viewBox="0 0 60 80" width="52" height="70"><g filter="url(#wob)">${body}${spark}</g></svg>`;
}

function shiftDurationMs(S,now=Date.now()){
  if(!S||!Number.isFinite(S.startedAt))return 0;
  const livePause=S.activePauseStartedAt?Math.max(0,now-S.activePauseStartedAt):0;
  return Math.max(0,Math.min(2*60*60*1000,now-S.startedAt-(S.pausedTotalMs||0)-livePause));
}
function bindWordInfoButtons(selector="[data-word-id]"){
  $$(selector).forEach(ch=>ch.onclick=()=>{
    const w=allWords().find(x=>x.id===ch.dataset.wordId);if(!w)return;
    const phon=phoneticOf(w.w);AudioKit.tap();Voice.speak(w.w);toast(`${w.w}${phon?` /${phon}/`:""}: ${w.def}`,{english:true});
  });
}
function missedWordsRecapHTML(S){
  const missed=Array.isArray(S?.missed)?S.missed:[];
  if(!missed.length)return `<div class="note nomissed">🌟 No missed words this session — brilliant!</div>`;
  const shown=missed.slice(0,6),extra=missed.length-shown.length;
  return `<details class="missedrecap felt" ${missed.length<=3?"open":""}>
    <summary>📝 Words to practise <span>${missed.length}</span></summary>
    <div class="missedlist">${shown.map(m=>`<div class="missedrow"><button class="chip l" data-word-id="${esc(m.wid)}" lang="en-GB">${esc(m.word)}</button><small lang="en-GB">${esc(m.definition)}</small></div>`).join("")}</div>
    ${extra>0?`<small>+ ${extra} more — see My words</small>`:""}
  </details>`;
}

/* ---------- End of session — growth-framed summary ----------
   Re-entrancy guard (QA finding): a delayed answer/serve callback
   could fire ~550ms after the end screen appeared and silently keep
   scoring in the background. endShift now marks the session ended and
   invalidates the global SHIFT *first*, so every timed callback's
   `if(!SHIFT) return` check genuinely stops the old session. */
function endShift(early){
  const S=SHIFT;
  if(!S || S.ended) return;
  S.ended=true;
  clearShiftResume();   /* S9b: a finished or ended shift can't be carried on */
  if(S.timer){ clearInterval(S.timer); clearTimeout(S.timer); }
  if(S.patTimer) clearInterval(S.patTimer);
  SHIFT=null;
  const p=P();
  const ratio=S.served?S.perfect/S.served:0;
  const stars=early?(S.served>=3&&ratio>=.6?1:0):(ratio>=.9?3:ratio>=.6?2:1);
  const acc=S.answers?Math.round(100*S.rightAnswers/S.answers):0;
  const newlyMastered=Math.max(0,masteredCount()-S.startMastered);
  const newWordsSeen=Math.max(0,Object.keys(p.words).length-S.startWords);
  const durationMs=shiftDurationMs(S);
  const reviewUpdate=!early&&S.mode==="review"&&S.served>0?noteReviewDay():{advanced:false,days:currentReviewStreakDays(p)};
  const sessionPet=activePlayerPet(p);
  p.sessions++;p.shifts.push({courseId:p.courseId,d:Date.now(),mode:S.mode,stars,acc,tips:S.tips,served:S.served,durationMs,mastered:newlyMastered,answers:S.answers,rightAnswers:S.rightAnswers});
  if(window.WordBarAnalytics){
    /* S10b (R12): the real run size. A review ends early when its pool runs out. */
    let _target=0;try{_target=S.mode==="normal"?NORMAL_TARGET:S.mode==="review"?Math.max(S.served||0,Math.min(REVIEW_TARGET,(S.served||0)+reviewPool().length)):0;}catch(e){_target=S.mode==="review"?REVIEW_TARGET:0;}
    const _progress=_target?(S.served||0)/_target:(S.mode==="time"&&S.timeTotal)?durationMs/(S.timeTotal*1000):null;
    WordBarAnalytics.endSession({result:early?"quit":"completed",questions:S.answers||0,correct:S.rightAnswers||0,hints:0,answers:S.answers||0,progress:_progress,kinds:S._kinds||null});
    if(!early && S.served>0) WordBarAnalytics.milestoneOnce("first_session_completed");
    if(!early && S.mode==="review" && S.served>0) WordBarAnalytics.milestoneOnce("first_review_completed");
  }
  const pb=[];
  if(acc>p.best.acc&&S.answers>=5){p.best.acc=acc;pb.push("accuracy");}
  if(S.bestStreak>p.best.streak){p.best.streak=S.bestStreak;pb.push("streak");}
  if(S.tips>p.best.tips){p.best.tips=S.tips;pb.push("tips in one session");}
  if(S.mode==="normal") p._normalDone=(p._normalDone||0)+1;
  if(S.mode==="review"){ p._reviewDone=(p._reviewDone||0)+1; p._reviewCount=(p._reviewCount||0)+1; }
  if(S.mode==="time"){
    p._timeDone=(p._timeDone||0)+1;
    p._timeBestServed=Math.max(p._timeBestServed||0,S.served);
    if(S.tips>p.best.timeChallenge){ if(p.best.timeChallenge>0) p._timeBeatOwnBest=(p._timeBeatOwnBest||0)+1; p.best.timeChallenge=S.tips; pb.push("Time Challenge score"); }
  }
  if(S.mode==="rush"){
    p._rushDone=(p._rushDone||0)+1;
    const isRecord=S.served>(p.best.rush||0);
    p.best.rush=Math.max(p.best.rush||0,S.served);
    if(isRecord&&S.served>0) pb.push("Rush Hour record");
    /* independent Rush scoreboard: top five runs, kept separately
       from the ordinary tips/accuracy bests */
    p.rushScores=p.rushScores||[];
    p.rushScores.push({courseId:p.courseId,d:Date.now(),served:S.served,tips:S.tips,wrong:S.wrong||0});
    p.rushScores.sort((a,b)=>b.served-a.served||b.tips-a.tips);
    p.rushScores=p.rushScores.slice(0,5);
  }
  if(!early && S.served>=3 && acc===100) p._perfectSessions=(p._perfectSessions||0)+1;
  if(S.weekend) p._weekendSessions=(p._weekendSessions||0)+1;
  if(stars>0)AudioKit.cue("round");
  p._themesSeen = p._themesSeen||[];
  Object.entries(THEMES).forEach(([k,t])=>{ if(t.unlock>0 && p.lifetime>=t.unlock && !p._themesSeen.includes(k)) p._themesSeen.push(k); });
  persist();
  const unlockable=Object.entries(THEMES).filter(([k,t])=>k!=="sunny"&&themeIsUnlocked(p,k));
  const nextTheme=Object.entries(THEMES).filter(([k])=>k!=="sunny"&&!themeIsUnlocked(p,k)).sort((a,b)=>a[1].unlock-b[1].unlock)[0];
  const affordable=SHOP.filter(i=>!i.retired&&!p.owned.includes(i.id)&&i.price<=p.tips&&(!i.requiresPetLicence||petSystemOf(p).licenceOwned)).sort((a,b)=>a.price-b.price)[0];
  const fresh=checkAchievements();
  const freshUnlocks=checkUnlocks();
  show(`<section class="screen center endscreen">
   <h2>${S.mode==="rush"?(S.failedByMistakes?"Five mix-ups — rush over! ☕😅":S.overwhelmed?"The café got overwhelmed! 😅":(early?"Rush ended early":"Rush complete!")):S.mode==="time"?(early?"Challenge ended early":"Time's up!"):S.mode==="review"?(early?"Review ended early":"All caught up!"):(early?"Session ended early":"Session complete!")}</h2>
   ${S.mode==="rush"?`<p class="note">You served <b>${S.served}</b> customers${S.failedByMistakes?" before the fifth mix-up":S.overwhelmed?" before the queue won":""}. ${S.served>=(p.best.rush||0)&&S.served>0?"🏆 <b>New personal record!</b>":`Your record: <b>${p.best.rush||0}</b>.`} Every rush makes you faster!</p>`:""}
   <div class="stars">${[1,2,3].map(i=>`<span class="star ${i<=stars?"lit":""}" style="animation-delay:${i*.25}s">★</span>`).join("")}</div>
   <div class="summary felt">
     <div class="srow"><span>Customers served</span><b>${S.served}</b></div>
     <div class="srow"><span>Perfect tickets</span><b>${S.perfect}/${S.served}</b></div>
     <div class="srow"><span>Answer accuracy</span><b>${acc}%</b></div>
     <div class="srow"><span>Best streak</span><b>${S.bestStreak>1?"🔥 "+S.bestStreak:S.bestStreak}</b></div>
     <div class="srow total"><span>Tips earned</span><b>${COIN} ${S.tips}</b></div>
   </div>
   ${missedWordsRecapHTML(S)}
   <div class="growthbanner" data-i18n-html>🌱 <b>You learned ${newWordsSeen} new word${newWordsSeen!==1?"s":""}</b>${newlyMastered?` and <b>mastered ${newlyMastered}</b>` :""} today.</div>
   ${reviewUpdate.advanced?`<div class="reviewstreakfinish">🔥 <b>${reviewUpdate.days}-day review streak!</b></div>`:""}
   ${sessionPet&&!early&&S.served>0?`<div class="petfinish felt"><div>${cafePetStaticHTML(sessionPet,"good",64,petWearables(p))}</div><div><b>${esc(sessionPet.name.replace(/^a /i,"Your "))} celebrates your completed session!</b></div></div>`:""}
   ${pb.length?`<div class="pbbanner">🏅 New personal best: ${pb.join(", ")}!</div>`:""}
   ${unlockable.length&&p.settings.theme==="sunny"&&!p._themeNudged?`<div class="note">🎨 You've unlocked a new theme — find it in Café Theme!</div>`:""}
   ${nextTheme?`<div class="note" data-i18n-html>Next theme: <b>${nextTheme[1].name}</b> unlocks at ${nextTheme[1].unlock} lifetime coins (you have ${p.lifetime}).</div>`:""}
   ${affordable?`<div class="note" data-i18n-html>🛍️ You can now afford <b>${affordable.name}</b> (${affordable.price} coins)!</div>`:""}
   <div class="endbtns">
     <button class="felt big primary" id="again">Another session 🍹</button>
     <button class="felt big" id="home">🏠 Main menu</button>
   </div></section>`);
  bindWordInfoButtons(".endscreen [data-word-id]");
  celebrateRewards(fresh,freshUnlocks);
  $("#again").onclick=()=>{AudioKit.tap();
    if(S.mode==="time") openTimeDurationPicker();
    else if(S.mode==="review"){ if(!reviewPool().length){ toast("🌟 All caught up — nothing left to review right now!"); screenMenu(); } else startShift("review"); }
    else startShift(S.mode); /* "Another session" now replays Rush as Rush (QA finding) */};
  $("#home").onclick=()=>{AudioKit.tap();screenMenu();};
}

/* ---------- Shop ---------- */
function screenShop(activeTier){
  const p=P();
  const tiers=["My Items","Pet","Starter","Mid","Premium","Legendary"];
  activeTier=tiers.includes(activeTier)?activeTier:"Starter";
  show(`<section class="screen" id="shopScreen">
   <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>Shop</b><span class="tipbadge" id="shopCoins">${COIN} ${p.tips}</span></div>
   <div id="shopPreview"></div>
   <button class="felt mini shoplookbtn" id="shopLook">👗 Change look &amp; Wardrobe</button>
   <p class="note">💡 Character &amp; pet unlocks count <b>everything you've ever earned</b> — shopping never slows them down.</p>
   <div class="tabbar" id="shopTabs" role="tablist" aria-label="Shop categories">${tiers.map(t=>`<button class="tab ${t===activeTier?"on":""}" data-t="${t}" role="tab" aria-selected="${t===activeTier}">${t}</button>`).join("")}</div>
   <div id="shoplist"></div></section>`);
  $("#back").onclick=()=>{AudioKit.tap();screenMenu();};
  $("#shopLook").onclick=()=>{AudioKit.tap();WB_SHOP_TAB=activeTier;openEditLook(SAVE.active,"shop");};
  const list=$("#shoplist"), preview=$("#shopPreview"), coins=$("#shopCoins"), tabs=$("#shopTabs");
  /* S9c: "Try on" shows an avatar item on the barista before buying.
     Nothing is saved or spent; leaving the Shop removes it. */
  let tryOn=null;

  function updateShopChrome(){
    coins.innerHTML=`${COIN} ${p.tips}`;
    /* Only the preview is redrawn when an item is bought/placed. The
       screen shell, tabs and current scroll position stay untouched. */
    const trying=tryOn&&SHOP.find(x=>x.id===tryOn);
    const barista=trying?wardrobePreviewSVG(avatarLookFor(p),{...p.placed.avatar,[trying.slot]:trying.id},70):null;
    preview.innerHTML=`<div class="scenewrap small theme-${p.settings.theme}">${cafeSceneHTML("preview",{barista:trying?cafeBaristaPreview({look:avatarLookFor(p),opts:playerRenderOpts({placed:{avatar:{...p.placed.avatar,[trying.slot]:trying.id}}}),html:barista}):cafeBaristaPreview(),baristaAttrs:"data-refreshable",pet:playerCafePetHTML("preview")})}</div>`+
      (trying?`<div class="tryonbar felt" role="status"><span>👀 Trying on: <b>${esc(trying.name)}</b></span><span class="tryonbtns"><button class="felt mini buy" data-buy="${trying.id}" ${p.tips<trying.price?"disabled":""}>${COIN} ${trying.price}</button><button class="linky" id="tryOff">Take off</button></span></div>`:"");
  }
  function itemsForActiveTab(){
    if(activeTier==="My Items")return p.owned.map(id=>SHOP.find(i=>i.id===id)).filter(Boolean);
    if(activeTier==="Pet")return SHOP.filter(i=>i.petItem&&!i.retired);
    return SHOP.filter(i=>i.tier===activeTier&&!i.retired);
  }
  function renderTier(){
    const items=itemsForActiveTab();
    if(!items.length){
      list.innerHTML=activeTier==="My Items"
        ?`<div class="emptyshop felt"><b>Your shelf is empty—for now!</b><small>Buy something from Starter, Mid, Premium or Legendary and it will also appear here.</small></div>`
        :`<p class="note">No items are available in this category.</p>`;
      return;
    }
    list.innerHTML=`<div class="shopgrid">${items.map(i=>{
      const owned=p.owned.includes(i.id),ps=petSystemOf(p);
      const bag=i.dest==="avatar"?p.placed.avatar:i.dest==="cafe"?p.placed.cafe:i.dest==="pet"?p.placed.pet:null;
      const placedNow=!!bag&&bag[i.slot]===i.id;
      const needsLicence=!!i.requiresPetLicence&&!ps.licenceOwned;
      const origin=activeTier==="My Items"||activeTier==="Pet"?`<span class="tierpill shoptier">${i.retired?"Legacy":i.tier}</span>`:"";
      const petBadge=i.petItem?`<span class="tierpill petitempill">🐾 Pet item</span>`:"";
      const icon=i.dest==="avatar"?"🧑‍🍳":i.petItem?"🐾":"🏠";
      const detail=i.permanent?"Permanent unlock":`${i.layer} · ${i.slot}`;
      let action="";
      if(owned){
        action=i.permanent?`<span class="shopownedlabel">✓ Owned permanently</span>`
          :`<button class="felt mini" data-place="${i.id}" ${needsLicence?"disabled":""}>${needsLicence?"🔒 Pet Licence required":placedNow?"✓ In place — remove":"Place it!"}</button>`;
      }else{
        const disabled=p.tips<i.price||needsLicence;
        action=`<button class="felt mini buy" data-buy="${i.id}" ${disabled?"disabled":""}>${needsLicence?"🔒 Pet Licence":`${COIN} ${i.price}`}</button>`;
        if(i.dest==="avatar"&&!i.permanent)action+=`<button class="linky tryon" data-try="${i.id}">${tryOn===i.id?"✓ Trying on":"👀 Try on"}</button>`;
      }
      return `<div class="shopitem felt ${owned?"owned":""}" data-shop-item="${i.id}">
       <div class="swatch ${cafeShopArt(i)?"hasart":""}" style="background:${i.c}">${cafeShopArt(i)||icon}</div>
       <b>${i.name}</b>${origin}${petBadge}<small>${detail}</small>${action}
      </div>`;}).join("")}</div>`;
  }
  function refreshShop(){
    updateShopChrome();
    renderTier();
  }

  tabs.addEventListener("click",e=>{
    const t=e.target.closest("[data-t]"); if(!t)return;
    AudioKit.tap(); activeTier=t.dataset.t;
    tabs.querySelectorAll(".tab").forEach(x=>{const on=x===t;x.classList.toggle("on",on);x.setAttribute("aria-selected",String(on));});
    renderTier();
  });
  /* One delegated listener survives every item-list refresh. */
  function buyItem(id){
      const it=SHOP.find(x=>x.id===id);
      if(!it||p.tips<it.price)return;
      if(it.requiresPetLicence&&!petSystemOf(p).licenceOwned){toast("Buy the Pet Licence first — then this cosy item can be used by your café pet.");return;}
      p.tips-=it.price;
      if(!p.owned.includes(it.id))p.owned.push(it.id);
      if(it.id==="pet_license")petSystemOf(p).licenceOwned=true;
      let removedByBuy=[];
      if(it.dest==="avatar")removedByBuy=wearShopItem(p.placed.avatar,it);
      else if(["cafe","pet"].includes(it.dest))p.placed[it.dest][it.slot]=it.id;
      persist();
      AudioKit.coin(it.tier==="Legendary"||it.price>=600); if(it.tier==="Legendary")AudioKit.milestone();
      toast(it.id==="pet_license"?"Pet Licence unlocked! Choose any revealed pet in the Gallery.":`${it.name} — yours! ${CURATOR.lines.unlock[Math.floor(Math.random()*CURATOR.lines.unlock.length)]}`);
      celebrateAchievements(checkAchievements()); /* shop trophies unlock at the till, not later (QA WB17-01) */
      if(tryOn===it.id)tryOn=null;   /* bought items are worn straight away */
      if(removedByBuy.length)setTimeout(()=>toast(overlapNote(it,removedByBuy)),2400);
      refreshShop();
  }
  preview.addEventListener("click",e=>{
    const b=e.target.closest("[data-buy]");if(b){buyItem(b.dataset.buy);return;}
    if(e.target.closest("#tryOff")){AudioKit.tap();tryOn=null;refreshShop();}
  });
  list.addEventListener("click",e=>{
    const t=e.target.closest("[data-try]");
    if(t){AudioKit.tap();tryOn=tryOn===t.dataset.try?null:t.dataset.try;refreshShop();
      /* only scroll when the preview is off screen, so the barista is visible */
      if(tryOn){try{const r=preview.getBoundingClientRect();if(r.top<0||r.top>window.innerHeight*.5)window.scrollTo({top:Math.max(0,window.scrollY+r.top-70),behavior:"smooth"});}catch(_){}}return;}
    const b=e.target.closest("[data-buy],[data-place]"); if(!b)return;
    if(b.dataset.buy){buyItem(b.dataset.buy);return;}
    const it=SHOP.find(x=>x.id===b.dataset.place); if(!it||it.permanent)return;
    if(it.requiresPetLicence&&!petSystemOf(p).licenceOwned){toast("A Pet Licence is needed before using pet items.");return;}
    const bag=it.dest==="avatar"?p.placed.avatar:it.dest==="cafe"?p.placed.cafe:it.dest==="pet"?p.placed.pet:null;if(!bag)return;
    const removedByPlace=toggleShopPlacement(bag,it);
    persist();AudioKit.tap();
    celebrateAchievements(checkAchievements()); /* placement trophies too (QA WB17-01) */
    if(removedByPlace.length)toast(overlapNote(it,removedByPlace));
    refreshShop();
  });
  refreshShop();
}

/* ---------- My Words (word album: mastery + definition + pronunciation) ---------- */
function screenMyWords(){
  const p=P(),words=allWords();
  const stages={new:[],learning:[],confident:[],mastered:[]};
  words.forEach(w=>stages[masteryStage(w.id)].push(w));
  const tierRow=t=>{
    const tw=words.filter(w=>w.t===t);
    const m=tw.filter(w=>masteryStage(w.id)==="mastered").length;
    const c=tw.filter(w=>masteryStage(w.id)==="confident").length;
    const l=tw.filter(w=>masteryStage(w.id)==="learning").length;
    return `<div class="tierrow"><b>${esc(activeTierLabel(t))}</b><div class="bar">
      <span class="seg m" style="flex:${m}"></span><span class="seg c" style="flex:${c}"></span>
      <span class="seg l" style="flex:${l}"></span><span class="seg n" style="flex:${Math.max(0,tw.length-m-c-l)}"></span></div>
      <small>${m}/${tw.length} mastered</small></div>`;};
  show(`<section class="screen">
   <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>My words</b><span></span></div>
   <div class="menucourse">${courseBadgeHTML(p.courseId)}</div>
   <div class="legend"><span class="dot m"></span><span data-i18n-ctx>mastered</span> <span class="dot c"></span><span data-i18n-ctx>confident</span> <span class="dot l"></span><span data-i18n-ctx>learning</span> <span class="dot n"></span><span data-i18n-ctx>new</span></div>
   ${["easy","core","stretch"].map(tierRow).join("")}
   <h3>⭐ Mastered (${stages.mastered.length})</h3>
   <div class="chiprow">${stages.mastered.map(w=>`<button class="chip m" data-word-id="${esc(w.id)}" lang="en-GB">${esc(w.w)}</button>`).join("")||"<small>Get a word right three times in a row to master it — Review sessions are the fastest way!</small>"}</div>
   <h3>💪 Getting there (${stages.confident.length})</h3>
   <div class="chiprow">${stages.confident.map(w=>`<button class="chip c" data-word-id="${esc(w.id)}" lang="en-GB">${esc(w.w)}</button>`).join("")||"<small>—</small>"}</div>
   <h3>🌱 Still learning (${stages.learning.length})</h3>
   <div class="chiprow">${stages.learning.map(w=>`<button class="chip l" data-word-id="${esc(w.id)}" lang="en-GB">${esc(w.w)}</button>`).join("")||"<small>—</small>"}</div>
  </section>`);
  $("#back").onclick=()=>{AudioKit.tap();screenMenu();};
  bindWordInfoButtons("[data-word-id]");
}

/* ---------- Trophy shelf — achievements + Word Kraken ladder ---------- */
function screenTrophies(initialCategory){
  const p=P(),kt=krakenTier(),ladder=krakenLadder(),catalog=courseAchievementCatalog();
  const spellingSection=PET_POP_FEATURE_ENABLED?`<div class="spellingtrophysection" id="spellingTrophies"><h3>🐾 Spelling trophies</h3><p class="note">Pet Pop spelling progress is separate from vocabulary meaning mastery.</p><div class="trophygrid spellingtrophygrid">${SPELLING_TROPHIES.map(trophy=>{const got=p.spellingGame?.trophies?.[trophy.id],progress=spellingTrophyProgress(p,trophy),shown=Math.min(progress.value,progress.goal),percent=Math.min(100,Math.round(100*shown/progress.goal)),when=(typeof got==="number"&&got>1e12)?new Date(got).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):null;return `<div class="trophy spellingtrophy felt ${got?"got":"locked"}"><div class="tricon">${got?"🏆":"🐾"}</div><b>${esc(trophy.title)}</b><small>${esc(trophy.desc)}</small><div class="trophyprogress" role="progressbar" aria-label="${esc(trophy.title)} progress" aria-valuemin="0" aria-valuemax="${progress.goal}" aria-valuenow="${shown}"><span style="width:${percent}%"></span></div><small class="tprogress">${shown} / ${progress.goal}</small>${when?`<small class="tdate">Earned ${when}</small>`:""}</div>`}).join("")}</div></div>`:"";
  /* "Learning" category retired — the Kraken ladder is the home for mastery now */
  const catNames={play:"🎮 Playing",return:"📅 Coming back",mode:"🏁 Modes",fun:"✨ Fun & collecting",regulars:"☕ Café regulars",skill:"🎓 Skill badges",kitchen:"👩‍🍳 Kitchen"};
  const byCat={};
  catalog.forEach(a=>{if(a.cat==="kitchen"&&(!KITCHEN_ENABLED||!activeCourseConfig().surfaces.kitchen))return;(byCat[a.cat]=byCat[a.cat]||[]).push(a)});
  show(`<section class="screen">
   <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>Trophy shelf</b><span></span></div>
   <div class="menucourse">${courseBadgeHTML(p.courseId)}</div>
   ${spellingSection}
   <div class="krakenladder felt">
     <h3>🐙 The Word Kraken ladder</h3>
     <p class="note">Mastered so far: <b>${kt.mastered}</b> / ${ladder[ladder.length-1].count}</p>
     ${ladder.map(t=>{
       const reached = kt.mastered>=t.count;
       const shown = !t.secret || reached;
       return `<div class="ladderrow ${reached?"reached":""}">
         <span class="lemoji">${shown?t.emoji:"❔"}</span>
         <span class="ltitle">${shown?t.title:"???"}</span>
         <span class="lcount">${t.count} words</span></div>`;
     }).join("")}
   </div>
   ${Object.entries(byCat).map(([cat,items])=>`
     <h3>${catNames[cat]||cat}</h3>
     <div class="trophygrid">${items.map(a=>{
       const got=p.achievements[a.id];
       const when=(typeof got==="number"&&got>1e12)?new Date(got).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):null;
       return `<div class="trophy felt ${got?"got":"locked"}">
         <div class="tricon">${got?"🏆":"🔒"}</div>
         <b>${esc(a.title)}</b><small>${esc(a.desc)}</small>${when?`<small class="tdate">Earned ${when}</small>`:""}</div>`;
     }).join("")}</div>`).join("")}
  </section>`);
  $("#back").onclick=()=>{AudioKit.tap();screenMenu();};
  if(initialCategory==="spelling"&&typeof requestAnimationFrame==="function")requestAnimationFrame(()=>$("#spellingTrophies")?.scrollIntoView({block:"start"}));
}

/* ---------- Gallery — the café's whole cast, revealed as you earn ---------- */
/* S13: every face a café pet's drawing has, side by side */
const PET_FACE_LABELS=[["good","Happy"],["excited","Excited"],["normal","Calm"],["blink","Blink"],["grumpy","Grumpy"],["bad","Sad"]];
function openPetFaces(pet){
  document.querySelectorAll(".petfaces").forEach(n=>n.remove());
  const el=document.createElement("div");el.className="petfaces";el.setAttribute("role","dialog");el.setAttribute("aria-label",`${pet.name} faces`);
  el.innerHTML=`<div class="petfacescard felt"><div class="petfaceshead"><b>${esc(pet.name.replace(/^a /i,""))}</b><button class="iconb" aria-label="Close">✕</button></div>
    <div class="petfacesgrid">${PET_FACE_LABELS.map(([m,l])=>`<figure>${cafePetStaticHTML(pet,m,72)}<figcaption>${l}</figcaption></figure>`).join("")}</div></div>`;
  const close=()=>el.remove();el.addEventListener("click",e=>{if(e.target===el||e.target.closest(".iconb"))close();});
  document.body.appendChild(el);
  if(typeof CafeArt!=="undefined"&&!CafeArt.get("pets",pet.id))CafeArt.load("pets",pet.id).then(()=>{if(el.isConnected){el.remove();openPetFaces(pet);}});
}
function screenGallery(){
  const p=P(), un=unlockedIds(), seq=unlockSequence(),ps=petSystemOf(p);
  const nxt=nextUnlockInfo();
  const posOf={}; seq.forEach((u,i)=>posOf[u.type+":"+u.id]=(i+1)*UNLOCK_STEP);
  /* each tap shows a different face the art really has */
  const GEXPRS=["happy","neutral","sad","blink"];
  const PET_MOODS=["good","excited","grumpy","bad","blink","normal"];
  const petNext=new Map();
  const exprNext=new Map();
  const PAGE_SIZE={customers:18,pets:12};
  const state={tab:"customers",page:{customers:0,pets:0}};

  const custSorted=[...CUSTOMERS].sort((a,b)=>{
    const ua=un.customer.has(a.id),ub=un.customer.has(b.id);
    if(ua!==ub)return ua?-1:1;
    if(!ua)return (posOf["customer:"+a.id]||9e9)-(posOf["customer:"+b.id]||9e9);
    return 0;
  });
  const petsSorted=[...PETS].sort((a,b)=>{
    const ua=un.pet.has(a.id),ub=un.pet.has(b.id);
    if(ua!==ub)return ua?-1:1;
    if(!ua)return (posOf["pet:"+a.id]||9e9)-(posOf["pet:"+b.id]||9e9);
    return 0;
  });
  const custCount=[...un.customer].filter(id=>CUSTOMERS.some(c=>c.id===id)).length;
  const petCount=[...un.pet].filter(id=>PETS.some(x=>x.id===id)).length;

  show(`<section class="screen" id="galleryScreen">
   <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>Gallery</b><span class="tipbadge">${COIN} ${p.tips}</span></div>
   <div class="note gprog" data-i18n-html>${nxt?`Next reveal: <b>${nxt.item.type==="customer"?"a new customer":"a new pet"}</b> in <b>${nxt.toGo}</b> more lifetime coins (every ${UNLOCK_STEP} earned reveals someone new!)`:`🎉 <b>Full house!</b> You've revealed everyone.`}</div>
   <div class="tabbar gallerytabs" id="galleryTabs" role="tablist" aria-label="Gallery sections">
     <button class="tab on" data-gallery-tab="customers" role="tab" aria-selected="true">☕ Customers <small>${custCount}/${CUSTOMERS.length}</small></button>
     <button class="tab" data-gallery-tab="pets" role="tab" aria-selected="false">🐾 Pets <small>${petCount}/${PETS.length}</small></button>
   </div>
   <div class="note gallerypetstatus" id="galleryPetStatus" hidden></div>
   <div class="gallerypagehead"><h3 id="galleryTitle">Customers</h3><span id="galleryPageInfo" aria-live="polite"></span></div>
   <div class="gallerygrid" id="galleryGrid"></div>
   <div class="pagerow gallerypager" id="galleryPager"></div>
  </section>`);
  $("#back").onclick=()=>{AudioKit.tap();screenMenu();};
  const tabs=$("#galleryTabs"), grid=$("#galleryGrid"), pager=$("#galleryPager"), title=$("#galleryTitle"), pageInfo=$("#galleryPageInfo"),petStatus=$("#galleryPetStatus");

  function customerTile(c){
    if(un.customer.has(c.id)){
      const next=exprNext.get(c.id)||0;
      const shown=next?GEXPRS[(next-1)%GEXPRS.length]:"happy";
      return `<div class="gtile felt" data-cid="${c.id}" data-current-expr="${shown}" data-blurb="${esc(c.blurb||c.name)}" role="button" tabindex="0" aria-label="${esc(c.name)} — tap to see expressions"><div class="gart">${characterSVG(c.look,shown,{w:56})}</div><small>${esc(c.name)}</small></div>`;
    }
    const at=posOf["customer:"+c.id]||0;
    return `<div class="gtile felt locked"><div class="gart gq">?</div><small>${at-(p.lifetime||0)>0?`${at-(p.lifetime||0)} more coins`:"soon!"}</small></div>`;
  }
  function petTile(x,i){
    if(un.pet.has(x.id)){
      const active=ps.activePetId===x.id,licensed=ps.licenceOwned;
      return `<div class="gtile felt petlive ${active?"activepet":""}"><button class="gallerypetart" data-pet="${x.id}" data-blurb="${esc(x.name)}" aria-label="${esc(x.name)} — tap for a reaction"><div class="gart"><div class="galpet" style="animation-delay:-${(i*0.7)%2.8}s;animation-duration:${2.6+(i%4)*0.35}s">${cafePetStaticHTML(x,"normal",64)}</div></div><small>${esc(x.name.replace(/^a /,""))}</small></button><button class="felt mini petpick" data-pet-select="${x.id}" ${licensed?"":"disabled"}>${licensed?(active?"✓ My pet — remove":"Choose as my pet"):"🔒 Pet Licence"}</button></div>`;
    }
    const at=posOf["pet:"+x.id]||0;
    return `<div class="gtile felt locked"><div class="gart gq">?</div><small>${at-(p.lifetime||0)>0?`${at-(p.lifetime||0)} more coins`:"soon!"}</small></div>`;
  }
  function renderGalleryPage(){
    const isCustomers=state.tab==="customers";
    const items=isCustomers?custSorted:petsSorted;
    const size=PAGE_SIZE[state.tab];
    const pages=Math.max(1,Math.ceil(items.length/size));
    state.page[state.tab]=Math.min(Math.max(0,state.page[state.tab]),pages-1);
    const pg=state.page[state.tab];
    const start=pg*size;
    const visible=items.slice(start,start+size);
    title.textContent=isCustomers?"☕ Customers":"🐾 Pets";
    pageInfo.textContent=`Page ${pg+1} of ${pages}`;
    petStatus.hidden=isCustomers;
    if(!isCustomers){
      const active=activePlayerPet(p);
      petStatus.innerHTML=!ps.licenceOwned?`🐾 Buy the <b>Pet Licence</b> in the Legendary Shop to choose one revealed pet for your café.`
        :active?`💛 Your café pet is <b>${esc(active.name)}</b>. Tap its button below to remove it or choose another pet.`
        :`💛 Pet Licence owned — choose any revealed pet below to live beside your shopkeeper.`;
    }
    grid.innerHTML=isCustomers?visible.map(customerTile).join(""):visible.map((x,i)=>petTile(x,start+i)).join("");
    /* the café pet drawings load on demand: redraw the page once they arrive */
    const missing=isCustomers?[]:visible.filter(x=>un.pet.has(x.id)&&typeof CafeArt!=="undefined"&&!CafeArt.get("pets",x.id));
    if(missing.length)Promise.all(missing.map(x=>CafeArt.load("pets",x.id))).then(()=>{if(state.tab==="pets"&&grid.isConnected)renderGalleryPage();});
    pager.innerHTML=`<button class="felt mini" data-gallery-page="${pg-1}" ${pg===0?"disabled":""}>← Previous</button><span class="pageinfo">${start+1}–${Math.min(items.length,start+size)} of ${items.length}</span><button class="felt mini" data-gallery-page="${pg+1}" ${pg>=pages-1?"disabled":""}>Next →</button>`;
    tabs.querySelectorAll("[data-gallery-tab]").forEach(t=>{
      const on=t.dataset.galleryTab===state.tab;
      t.classList.toggle("on",on);t.setAttribute("aria-selected",String(on));
    });
  }
  function activateTile(t){
    if(t.dataset.cid){
      AudioKit.tap();
      const c=CUSTOMERS.find(x=>x.id===t.dataset.cid);if(!c)return;
      const i=exprNext.get(c.id)||0;
      if(i===0)toast(t.dataset.blurb);
      const expr=GEXPRS[i%GEXPRS.length];exprNext.set(c.id,i+1);t.dataset.currentExpr=expr;
      const art=t.querySelector(".gart");if(art)art.innerHTML=characterSVG(c.look,expr,{w:56});
      return;
    }
    if(t.dataset.pet){
      const pet=PETS.find(x=>x.id===t.dataset.pet);if(!pet)return;
      const k=petNext.get(pet.id)||0;petNext.set(pet.id,k+1);
      const mood=PET_MOODS[k%PET_MOODS.length],art=t.querySelector(".galpet");
      openPetFaces(pet);
      if(art){art.innerHTML=cafePetStaticHTML(pet,mood,64);const anim=Math.random()<.5?"excited":"excited2";art.classList.remove("excited","excited2");void art.offsetWidth;art.classList.add(anim);art.addEventListener("animationend",()=>art.classList.remove(anim),{once:true});}
      AudioKit.pet(pet.species,true);recordPetGreeting(pet);
      toast(`${pet.name.replace(/^a /,"The ")} ${petReactionText(pet,"tap")}`);
    }
  }
  tabs.addEventListener("click",e=>{
    const t=e.target.closest("[data-gallery-tab]");if(!t||t.dataset.galleryTab===state.tab)return;
    AudioKit.tap();state.tab=t.dataset.galleryTab;renderGalleryPage();
  });
  pager.addEventListener("click",e=>{
    const b=e.target.closest("[data-gallery-page]");if(!b||b.disabled)return;
    AudioKit.tap();state.page[state.tab]=+b.dataset.galleryPage;renderGalleryPage();
    requestAnimationFrame(()=>tabs.scrollIntoView({block:"start"}));
  });
  grid.addEventListener("click",e=>{
    const choose=e.target.closest("[data-pet-select]");
    if(choose){
      const id=choose.dataset.petSelect,pet=PETS.find(x=>x.id===id);if(!pet)return;
      if(!ps.licenceOwned){toast("Buy the Pet Licence in the Legendary Shop first.");return;}
      if(!un.pet.has(id)){toast("This pet has not been revealed yet.");return;}
      AudioKit.tap();
      if(ps.activePetId===id){ps.activePetId=null;toast(`${pet.name.replace(/^a /,"The ")} is taking a little break from the café.`);}
      else{ps.activePetId=id;AudioKit.pet(pet.species,true);toast(`${pet.name.replace(/^a /,"The ")} is now your café pet!`);}
      persist();renderGalleryPage();return;
    }
    const t=e.target.closest("[data-cid],[data-pet]");if(t)activateTile(t);
  });
  grid.addEventListener("keydown",e=>{
    if(e.key!=="Enter"&&e.key!==" ")return;
    const t=e.target.closest("[data-cid],[data-pet]");if(!t)return;
    e.preventDefault();activateTile(t);
  });
  renderGalleryPage();
}

/* ---------- Leaderboard — local personal bests + recent history ---------- */
function screenLeaderboard(){
  const p=P(),kitchenAvailable=KITCHEN_ENABLED&&activeCourseConfig().surfaces.kitchen;
  const recent=(p.shifts||[]).filter(s=>s.courseId===p.courseId).slice(-10).reverse();
  const rushScores=(p.rushScores||[]).filter(s=>s.courseId===p.courseId);
  show(`<section class="screen">
   <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>My Best</b><span></span></div>
   <div class="menucourse">${courseBadgeHTML(p.courseId)}</div>
   <div class="setcard felt"><h3>🏅 Personal bests</h3>
     <div class="srow"><span>Best accuracy</span><b>${p.best.acc}%</b></div>
     <div class="srow"><span>Best streak</span><b>🔥 ${p.best.streak}</b></div>
     <div class="srow"><span>Best tips (one session)</span><b>${COIN} ${p.best.tips}</b></div>
     <div class="srow"><span>Best Time Challenge score</span><b>⏱️ ${p.best.timeChallenge} tips</b></div>
     <div class="srow"><span>Days played</span><b>${(p.playDays||[]).length}</b></div>
     <div class="srow"><span>Lifetime tips earned</span><b>${COIN} ${p.lifetime}</b></div>
   </div>
   ${kitchenAvailable?(()=>{const k=kitchenOf(p),unlocked=KITCHEN_CHALLENGE_FOODS.filter(f=>k.unlockedFoods.includes(f.id)).length,best=Math.max(0,...Object.values(k.bestByFood||{}).map(x=>x.bestRemaining||0));return `<div class="setcard felt kitchenbestcard"><h3>👩‍🍳 Kitchen bests</h3><div class="srow"><span>Kitchen recipes unlocked</span><b>${unlocked}/${KITCHEN_CHALLENGE_FOODS.length}</b></div><div class="srow"><span>Challenges won</span><b>${k.stats.challengesWon||0}</b></div><div class="srow"><span>Perfect Kitchen wins</span><b>${k.stats.perfectWins||0}</b></div><div class="srow"><span>Best time remaining</span><b>⏱️ ${best}s</b></div></div>`;})():""}
   <div class="setcard felt"><h3>🔥 Rush Hour scoreboard</h3>
     <div class="srow"><span>Most customers in one rush</span><b>👥 ${p.best.rush||0}</b></div>
   ${rushScores.length?rushScores.map((r,i)=>`<div class="srow"><span>${["🥇","🥈","🥉","4.","5."][i]} ${new Date(r.d).toLocaleDateString()}</span><b>👥 ${r.served} · ${COIN}${r.tips} · ❌${r.wrong}</b></div>`).join(""):"<small>No rushes yet — think you can beat the queue?</small>"}
   </div>
   <div class="setcard felt"><h3>Recent sessions</h3>
   ${recent.length?recent.map(s=>`<div class="srow"><span>${new Date(s.d).toLocaleDateString()} · ${s.mode==="time"?"⏱️ Time":s.mode==="rush"?"🔥 Rush":s.mode==="review"?"🎯 Review":"☕ Normal"}</span><b>${"★".repeat(s.stars)}${"☆".repeat(3-s.stars)} · ${COIN}${s.tips}</b></div>`).join(""):"<small>No sessions yet — go serve some customers!</small>"}
   </div>
  </section>`);
  $("#back").onclick=()=>{AudioKit.tap();screenMenu();};
}

/* ---------- Weekly summary — local profile data only ---------- */
function screenParentSummary(){
  const p=P(),now=Date.now(),cutoff=now-7*86400000;
  /* Filter in the calculator itself, not only in persistence or display.
     A damaged/mixed history row can therefore never affect this course. */
  const week=(p.shifts||[]).filter(s=>s.courseId===p.courseId&&Number(s.d)>=cutoff);
  const durationMs=week.reduce((n,s)=>n+Math.max(0,Number(s.durationMs)||0),0);
  const trackedSessions=week.filter(s=>(Number(s.durationMs)||0)>0).length;
  /* Use the same unit for old and new history. Each answered session
     contributes its stored 0-100 accuracy once; answer counts and
     customers served are never blended into one denominator. */
  const accuracySessions=week.filter(s=>(Number(s.answers)||0)>0||(Number(s.served)||0)>0);
  const accuracy=accuracySessions.length?Math.round(accuracySessions.reduce((n,s)=>n+Math.max(0,Math.min(100,Number(s.acc)||0)),0)/accuracySessions.length):0;
  const masteredThisWeek=week.reduce((n,s)=>n+Math.max(0,Number(s.mastered)||0),0);
  const queue=reviewPool(),reviewTotal=reviewCandidates().length,due=queue.filter(w=>(p.words[w.id]?.due||0)<=now).length;
  const weak=queue.slice(0,6);
  const minutes=durationMs>0&&durationMs<60000?"<1 min":`${Math.round(durationMs/60000)} min`;
  const streak=currentReviewStreakDays(p);
  const catalog=courseCatalogFor(p.courseId),tierProgress=["easy","core","stretch"].map(tier=>{
    const ids=Object.entries(catalog.wordTiers).filter(([,value])=>value===tier).map(([id])=>id);
    return {tier,total:ids.length,mastered:ids.filter(id=>masteryStage(id)==="mastered").length};
  });
  const typeStrengths=p.courseId===COURSE_IDS.everyday?Object.entries(p.everydayPractice?.types||{}).map(([id,x])=>({
    id,starts:Math.max(0,Number(x?.starts)||0),correct:Math.max(0,Number(x?.correct)||0)
  })).filter(x=>x.starts>0).sort((a,b)=>b.starts-a.starts||b.correct-a.correct).slice(0,6):[];
  const typeLabel=id=>id.split("_").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
  const kitchenAvailable=KITCHEN_ENABLED&&activeCourseConfig().surfaces.kitchen,kitchenStarts=kitchenAvailable?(kitchenOf(p).stats.challengesStarted||0):0;
  show(`<section class="screen parentsummary">
    <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>Weekly Summary</b><span class="pill">Local only</span></div>
    <div class="menucourse">${courseBadgeHTML(p.courseId)}</div>
    <div class="note"><b>Last 7 days</b><br><small>A quick learning snapshot for ${esc(p.name)}. Nothing on this screen is sent anywhere.</small></div>
    <div class="parentsummarygrid">
      <div class="felt parentmetric"><span>Sessions played</span><b>${week.length}</b></div>
      <div class="felt parentmetric"><span>Session time</span><b>${minutes}</b></div>
      <div class="felt parentmetric"><span>Words mastered</span><b>${masteredThisWeek}</b></div>
      <div class="felt parentmetric"><span>Average session accuracy</span><b>${accuracy}%</b></div>
    </div>
    <p class="note"><small>Each answered session has equal weight in the accuracy figure. Session time includes on-screen answer feedback and excludes time while the app is in the background.</small></p>
    ${week.length&&!trackedSessions?`<p class="note"><small>Session time and weekly mastery are tracked for newer sessions only; older sessions still count towards sessions and accuracy.</small></p>`:""}
    <div class="setcard felt"><h3>Learning activity</h3>
      <div class="srow"><span>Café sessions · last 7 days</span><b>${week.length}</b></div>
      <div class="srow"><span>Kitchen challenges · all time</span><b>${kitchenAvailable?kitchenStarts:"Not available"}</b></div>
    </div>
    <div class="setcard felt"><h3>Course tiers</h3>
      ${tierProgress.map(x=>`<div class="srow"><span>${esc(activeTierLabel(x.tier))}</span><b>${x.mastered}/${x.total} mastered</b></div>`).join("")}
    </div>
    ${p.courseId===COURSE_IDS.everyday?`<div class="setcard felt"><h3>Everyday type strengths</h3>
      ${typeStrengths.length?typeStrengths.map(x=>`<div class="srow"><span>${esc(typeLabel(x.id))}</span><b>${Math.round(100*x.correct/x.starts)}% · ${x.starts} tried</b></div>`).join(""):"<small>Type strengths will appear after the first Everyday Café session.</small>"}
    </div>`:""}
    <div class="setcard felt"><h3>Review habit</h3>
      <div class="srow"><span>Current review streak</span><b>${streak?`🔥 ${streak} day${streak===1?"":"s"}`:"Not started"}</b></div>
      <div class="srow"><span>Review focus</span><b>${queue.length}${reviewTotal>queue.length?` of ${reviewTotal}`:""} words · ${due} due now</b></div>
    </div>
    <div class="setcard felt"><h3>Words that could use more practice</h3>
      <div class="chiprow">${weak.map(w=>`<button class="chip l" data-word-id="${esc(w.id)}" lang="en-GB">${esc(w.w)}</button>`).join("")||"<small>No practice words yet — play a café session to begin.</small>"}</div>
      <p class="note">Review mode is the quickest way to strengthen these words. Tap a word to hear it and see its meaning.</p>
    </div>
    <button class="felt big primary" id="parentReview" ${queue.length?"":"disabled"}>🎯 Open Review mode</button>
  </section>`);
  $("#back").onclick=()=>{AudioKit.tap();screenMenu();};
  $("#parentReview").onclick=()=>{if(!reviewPool().length)return;AudioKit.tap();startShift("review");};
  bindWordInfoButtons(".parentsummary [data-word-id]");
}

/* ---------- Settings ---------- */
/* ---- strict save-import validation (QA P0 #2, hardened per the v20
   release QA) ----
   Rebuilds each imported profile ON TOP of a fresh newProfile(), copying
   every field of the CURRENT schema after type-checking and clamping.
   The round-trip contract (enforced by the smoke suite): exporting a
   valid save and importing it back preserves all meaningful data.
   Unknown item / pet / trophy / customer ids are dropped. Word ids are
   validated against the profile's course catalog even when that full bank
   is not loaded; cross-course word or session ids reject the import.
   structural damage throws a readable reason and the caller keeps the
   existing save untouched (plus a pre-import backup). */
/* S11b (review WB-B04): import problems carry a code. The toast shows one
   plain, translatable reason per code; the technical detail goes to the
   console only (it can contain names and word ids). */
const IMPORT_REASONS={
  NOT_SAVE:"this is not a WordBar backup file",
  UNSUPPORTED:"this backup is from a different version of WordBar",
  TOO_MANY:"it has more than 12 shopkeepers",
  DAMAGED:"part of the backup is damaged",
  COURSE:"it has words or history from a different course",
  BACKUP:"a safety copy of your current save could not be made first",
  WRITE:"the imported backup could not be saved and checked"
};
function importError(code,detail){const e=new Error(detail);e.code=code;return e;}
function validateImportedSave(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)) throw importError("NOT_SAVE","not a save file");
  if(raw.schemaVersion!==undefined&&raw.schemaVersion!==WORDBAR_SAVE_SCHEMA_VERSION)throw importError("UNSUPPORTED","unsupported save schema");
  if(!Array.isArray(raw.profiles)||!raw.profiles.length) throw importError("NOT_SAVE","no profiles found in it");
  if(raw.profiles.length>12) throw importError("TOO_MANY","too many profiles");
  const now=Date.now();
  const TS_MAX=now+10*365*86400000; /* real epoch-ms timestamps, up to 10y ahead */
  const num=(v,lo,hi,d)=>{v=Number(v);return Number.isFinite(v)?Math.min(hi,Math.max(lo,Math.round(v))):d;};
  const cleanStr=(v,max,d="")=>typeof v==="string"?v.slice(0,max):d;
  const sourceIsV3=raw.schemaVersion===WORDBAR_SAVE_SCHEMA_VERSION;
  const COUNTERS=["sessions","_lifetimeAnswers","_lifetimeCorrect","_bestSessionStreak","_perfectSessions",
    "_normalDone","_timeDone","_reviewDone","_reviewCount","_rushDone","_laddersDone","_timeBestServed",
    "_timeBeatOwnBest","_weekendSessions","_unlocksSeen","_pronunClicks"];
  const profiles=raw.profiles.map(rp=>{
    if(!rp||typeof rp!=="object") throw importError("DAMAGED","a profile entry is damaged");
    const name=(typeof rp.name==="string"&&rp.name.trim())?rp.name.trim().slice(0,24):"Shopkeeper";
    const isCustom = rp.avatar==="custom" && rp.customLook && typeof rp.customLook==="object";
    const avatar = isCustom ? "custom" : (AVATARS.some(a=>a.id===rp.avatar)?rp.avatar:AVATARS[0].id);
    const courseId=sourceIsV3?rp.courseId:COURSE_IDS.elevenPlus;
    if(!WORDBAR_KNOWN_COURSES.includes(courseId))throw importError("COURSE",`profile ${name} has an unknown course`);
    const p=newProfile(name,avatar,courseId);
    if(isCustom){
      /* every field whitelisted against the CUSTOMIZER tables — junk
         falls back to that category's default rather than importing */
      const cl=rp.customLook, C=CUSTOMIZER;
      const pick=(v,list,d)=>list.includes(v)?v:d;
      /* S9c: also allow the ready-made baristas' own colours (an edited
         Amara keeps her pink top), facial hair (previously dropped on
         import) and a frozen original face (faceFix). */
      const presetVals=k=>AVATARS.map(a=>a.look&&a.look[k]).filter(v=>typeof v==="string");
      p.customLook={
        skin:pick(cl.skin,[...C.skins,...presetVals("skin")],"#E8B88A"),
        hair:pick(cl.hair,[...C.hairs.map(h=>h[0]),...presetVals("hair")],C.hairs[0][0]),
        hairstyle:pick(cl.hairstyle,C.hairstyles,"flop"),
        lashes:typeof cl.lashes==="boolean"?cl.lashes:cl.noLash!==true,
        iris:pick(cl.iris,[...C.eyeColors.map(x=>x[0]),...IRIS_COLORS],"#6E4A2E"),
        top:pick(cl.top,[...C.tops.map(t=>t[0]),...presetVals("top")],C.tops[0][0]),
        accessory:pick(cl.accessory,C.accessories.map(x=>x[0]),"none"),
        facialHair:pick(cl.facialHair,C.facialHair.map(x=>x[0]),"none"),
        ...(C.lashStyles.some(([id])=>id===cl.lashStyle)?{lashStyle:cl.lashStyle}:{}),
        ...(C.brows.some(([id])=>id===cl.brows)?{brows:cl.brows}:{}),
        ...(C.cheeks.some(([id])=>id===cl.cheeks)?{cheeks:cl.cheeks}:{}),
        ...(C.glassesColors.some(([id])=>id===cl.glassesColor)?{glassesColor:cl.glassesColor}:{}),
        ...(C.hijabColors.some(([id])=>id===cl.hijab)?{hijab:cl.hijab}:{}),
        garment:{style:pick(cl.garment&&cl.garment.style,C.garments,"tee")}};
      const ff=cl.faceFix,fnum=(v,lo,hi)=>{v=Number(v);return Number.isFinite(v)&&v>=lo&&v<=hi;};
      if(!cl.eyeShape&&ff&&typeof ff==="object"&&fnum(ff.sizeMul,.5,1.5)&&[0,1,2,3].includes(ff.shape)&&fnum(ff.mouthW,.5,1.5)){
        p.customLook.faceFix={sizeMul:Number(ff.sizeMul),shape:ff.shape,lashes:!!ff.lashes,mouthW:Number(ff.mouthW),
          blinkDur:fnum(ff.blinkDur,1,10)?String(ff.blinkDur):"4.6",blinkDel:fnum(ff.blinkDel,0,10)?String(ff.blinkDel):"0"};
      }else p.customLook.eyeShape=pick(cl.eyeShape,C.eyeShapes.map(x=>x[0]),"round");
    }
    p.created=num(rp.created,0,TS_MAX,now);
    p.tips=num(rp.tips,0,9999999,0);
    p.lifetime=Math.max(num(rp.lifetime,0,99999999,0),p.tips);
    COUNTERS.forEach(k=>{ if(rp[k]!==undefined) p[k]=num(rp[k],0,9999999,0); });
    /* Imports from Builds 79 and earlier used a 200-coin reveal step.
       Preserve the maximum they had earned before stamping the new scale. */
    if(Number(rp._unlockStepVersion)!==UNLOCK_STEP){
      p._unlocksSeen=Math.max(p._unlocksSeen||0,Math.floor(p.lifetime/BUILD79_UNLOCK_STEP));
    }
    p._unlockStepVersion=UNLOCK_STEP;
    p.streakLife=num(rp.streakLife,0,9999999,0);
    p.metFox=!!rp.metFox; p.metOwl=!!rp.metOwl; p.metProf=!!rp.metProf;
    p._themeNudged=!!rp._themeNudged;
    p._krakenTier=num(rp._krakenTier,0,99999,0);
    if(typeof rp._krakenRankId==="string"&&krakenLadder(courseId).some(rank=>rank.id===rp._krakenRankId))p._krakenRankId=rp._krakenRankId;
    if(rp._dailyWord&&typeof rp._dailyWord==="object"&&rp._dailyWord.courseId===courseId&&
       typeof rp._dailyWord.day==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(rp._dailyWord.day)&&
       typeof rp._dailyWord.id==="string"&&courseCatalogHasWord(courseId,rp._dailyWord.id)){
      p._dailyWord={day:rp._dailyWord.day,courseId,id:rp._dailyWord.id};
    }
    if(rp.best&&typeof rp.best==="object")
      ["acc","streak","tips","timeChallenge","rush"].forEach(k=>{ if(rp.best[k]!==undefined) p.best[k]=num(rp.best[k],0,999999,0); });
    if(Array.isArray(rp.owned)) p.owned=[...new Set(rp.owned.filter(id=>SHOP.some(i=>i.id===id)))];
    if(rp.placed&&typeof rp.placed==="object"){
      ["cafe","avatar","pet"].forEach(side=>{
        const src=rp.placed[side];
        if(src&&typeof src==="object") Object.entries(src).forEach(([slot,id])=>{
          const it=SHOP.find(i=>i.id===id);
          if(it&&it.slot===slot&&it.dest===side&&(side!=="pet"||p.owned.includes(id))) p.placed[side][slot]=id;
        });
      });
    }
    if(rp.achievements&&typeof rp.achievements==="object")
      Object.entries(rp.achievements).forEach(([id,ts])=>{ if(courseAchievementCatalog(courseId).some(a=>a.id===id)) p.achievements[id]=num(ts,0,TS_MAX,now); });
    if(Array.isArray(rp.petsMet)) p.petsMet=[...new Set(rp.petsMet.map(canonicalPetId).filter(id=>PETS.some(x=>x.id===id)))];
    if(rp.petSystem&&typeof rp.petSystem==="object"&&!Array.isArray(rp.petSystem)){
      p.petSystem.licenceOwned=!!rp.petSystem.licenceOwned||p.owned.includes("pet_license");
      const importedPetId=canonicalPetId(rp.petSystem.activePetId);
      p.petSystem.activePetId=PETS.some(x=>x.id===importedPetId)?importedPetId:null;
    }else p.petSystem.licenceOwned=p.owned.includes("pet_license");
    if(p.petSystem.licenceOwned&&!p.owned.includes("pet_license"))p.owned.push("pet_license");
    if(!p.petSystem.licenceOwned)p.petSystem.activePetId=null;
    p.kitchen=cleanKitchenState(rp.kitchen,courseId);
    p.spellingGame=cleanSpellingGameState(rp.spellingGame,{strict:true});
    /* collections used by trophies & variety nudges — filtered to known ids */
    if(Array.isArray(rp._custServed)) p._custServed=[...new Set(rp._custServed.filter(id=>CUSTOMERS.some(c=>c.id===id)))];
    if(Array.isArray(rp._drinksTried)) p._drinksTried=[...new Set(rp._drinksTried.filter(k=>DRINK_KINDS[k]))];
    if(Array.isArray(rp._foodsTried)) p._foodsTried=[...new Set(rp._foodsTried.filter(k=>FOOD_KINDS[k]))];
    if(Array.isArray(rp._themesSeen)) p._themesSeen=[...new Set(rp._themesSeen.filter(k=>THEMES[k]))];
    if(rp._legacyThemeMigrationDone!==true){
      Object.entries(LEGACY_THEME_UNLOCKS).forEach(([key,unlock])=>{
        if(p.lifetime>=unlock&&!p._themesSeen.includes(key))p._themesSeen.push(key);
      });
    }
    p._legacyThemeMigrationDone=true;
    if(rp._typeRight&&typeof rp._typeRight==="object"){
      p._typeRight={};
      Object.entries(rp._typeRight).slice(0,30).forEach(([k,v])=>{ if(typeof k==="string"&&k.length<=24) p._typeRight[k]=num(v,0,99999,0); });
    }
    if(courseId===COURSE_IDS.everyday&&rp.everydayPractice&&typeof rp.everydayPractice==="object"){
      const known=new Set(COURSES.everyday.cafe.types.map(entry=>entry.id));
      const cleanBucket=(source,withPriority)=>{
        const out={};if(!source||typeof source!=="object"||Array.isArray(source))return out;
        Object.entries(source).slice(0,40).forEach(([key,value])=>{
          if(!known.has(key)||!value||typeof value!=="object"||Array.isArray(value))return;
          const starts=num(value.starts,0,999999,0),correct=num(value.correct,0,starts,0),wrong=num(value.wrong,0,starts-correct,0);
          out[key]={starts,correct,wrong};if(withPriority)out[key].priority=num(value.priority,0,999999,0);
        });return out;
      };
      p.everydayPractice={types:cleanBucket(rp.everydayPractice.types,false),skills:cleanBucket(rp.everydayPractice.skills,true)};
    }
    /* custom words (parent/teacher additions arrive via import) — the
       shape must match built-in rows so allWords() can serve them */
    if(Array.isArray(rp.custom))
      p.custom=rp.custom.filter(cw=>cw&&typeof cw==="object"&&typeof cw.id==="string"&&cw.id.trim()&&typeof cw.w==="string"&&cw.w.trim())
        .slice(0,300).map(cw=>({id:cw.id.trim().slice(0,60), w:cw.w.trim().slice(0,40),
          t:["easy","core","stretch"].includes(cw.t)?cw.t:"core",
          def:cleanStr(cw.def,300), pos:cleanStr(cw.pos,20)}));
    if(Array.isArray(rp.hidden)){
      const hidden=rp.hidden.filter(x=>typeof x==="string").slice(0,2000);
      const invalid=hidden.find(id=>!courseCatalogHasWord(courseId,id));
      if(invalid)throw importError("COURSE",`profile ${name} contains a hidden word outside ${courseCatalogFor(courseId).displayName}: ${invalid}`);
      p.hidden=hidden;
    }
    if(Array.isArray(rp.playDays)) p.playDays=[...new Set(rp.playDays.filter(x=>typeof x==="string"&&x.length<=10))].slice(0,4000);
    p.reviewStreakDays=num(rp.reviewStreakDays,0,9999,0);
    p.lastReviewDate=typeof rp.lastReviewDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(rp.lastReviewDate)?rp.lastReviewDate:null;
    /* session history: keep the most recent, validated records */
    if(Array.isArray(rp.shifts))
      p.shifts=rp.shifts.filter(x=>x&&typeof x==="object").slice(-400).map(x=>{
        const answers=num(x.answers,0,99999,0);
        if(x.courseId!==undefined&&x.courseId!==courseId)throw importError("COURSE",`profile ${name} has mixed-course session history`);
        return {courseId,d:num(x.d,0,TS_MAX,now),mode:cleanStr(x.mode,16,"normal"),
          stars:num(x.stars,0,3,0),acc:num(x.acc,0,100,0),
          tips:num(x.tips,0,999999,0),served:num(x.served,0,9999,0),
          durationMs:num(x.durationMs,0,7200000,0),mastered:num(x.mastered,0,9999,0),
          answers,rightAnswers:num(x.rightAnswers,0,answers,0)};
      });
    /* Rush records are OBJECTS {d,served,tips,wrong} (v20 QA 4.7) */
    if(Array.isArray(rp.rushScores))
      p.rushScores=rp.rushScores.filter(x=>x&&typeof x==="object").map(x=>{
        if(x.courseId!==undefined&&x.courseId!==courseId)throw importError("COURSE",`profile ${name} has mixed-course Rush history`);
        return {courseId,d:num(x.d,0,TS_MAX,now), served:num(x.served,0,9999,0),
          tips:num(x.tips,0,999999,0), wrong:num(x.wrong,0,9999,0)};
      })
        .sort((a,b)=>b.served-a.served||b.tips-a.tips).slice(0,5);
    if(rp.words&&typeof rp.words==="object"){
      /* word ids may be built-in OR this profile's own custom words */
      const customIds=new Set(p.custom.map(w=>w.id));
      Object.entries(rp.words).slice(0,3000).forEach(([wid,rec])=>{
        if(!customIds.has(wid)&&!courseCatalogHasWord(courseId,wid))throw importError("COURSE",`profile ${name} contains a word outside ${courseCatalogFor(courseId).displayName}: ${wid}`);
        if(!rec||typeof rec!=="object") return;
        p.words[wid]={seen:num(rec.seen,0,99999,0),streak:num(rec.streak,0,999,0),
          interval:num(rec.interval,0,999,0),
          due:num(rec.due,0,TS_MAX,0), /* epoch-ms — NOT a small counter (v20 QA 4.8) */
          right:num(rec.right,0,99999,0),wrong:num(rec.wrong,0,99999,0)};
      });
    }
    if(rp.settings&&typeof rp.settings==="object")
      Object.keys(DEFAULT_SETTINGS).forEach(k=>{ if(typeof rp.settings[k]===typeof DEFAULT_SETTINGS[k]) p.settings[k]=rp.settings[k]; });
    p.settings.musicTrack=normaliseMusicTrackId(p.settings.musicTrack);
    if(!["auto","day","night"].includes(p.settings.lightingMode))p.settings.lightingMode="auto";
    return p;
  });
  const active=Math.min(Math.max(0,num(raw.active,0,profiles.length-1,0)),profiles.length-1);
  const validated={schemaVersion:WORDBAR_SAVE_SCHEMA_VERSION,profiles,active};
  validateV3SaveRoot(validated,{catalogs:true});
  return validated;
}

function themeIsUnlocked(p,key){
  const t=THEMES[key];
  return !!t && ((p.lifetime||0)>=t.unlock || (Array.isArray(p._themesSeen)&&p._themesSeen.includes(key)));
}

function screenCafeTheme(){
  const p=P(),s=p.settings;
  const themeOpts=Object.entries(THEMES).map(([k,t])=>{
    const locked=!themeIsUnlocked(p,k);
    return `<button class="felt themebtn ${s.theme===k?"sel":""}" data-th="${k}" ${locked?"disabled":""}>
      <span class="thswatch" style="background:${t.wall};border-color:${t.accent}"></span>${t.name}${locked?`<small>🔒 ${t.unlock} lifetime coins</small>`:""}</button>`;}).join("");
  show(`<section class="screen cafe-theme-screen">
    <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>Café Theme</b><span></span></div>
    <div class="scenewrap small theme-${s.theme}">${cafeSceneHTML("preview",{barista:cafeBaristaPreview(),baristaAttrs:"data-refreshable",pet:playerCafePetHTML("preview")})}<div class="ambientlayer">${ambientSVG(THEMES[s.theme].ambient)}</div></div>
    <div class="setcard felt"><h3>Lighting</h3>
      <div class="setrow"><span>Café lighting</span><select id="cafeLighting">
        ${[["auto","Automatic (phone time)"],["day","Always day"],["night","Always night"]].map(([v,n])=>`<option value="${v}" ${s.lightingMode===v?"selected":""}>${n}</option>`).join("")}
      </select></div>
    </div>
    <div class="setcard felt"><h3>Choose your café</h3><div class="themegrid">${themeOpts}</div></div>
  </section>`);
  $("#back").onclick=()=>{AudioKit.tap();applySettings();screenMenu();};
  $("#cafeLighting").onchange=e=>{s.lightingMode=e.target.value;persist();applySettings();AudioKit.tap();screenCafeTheme();};
  $$(".themebtn").forEach(b=>b.onclick=()=>{s.theme=b.dataset.th;persist();applySettings();AudioKit.tap();screenCafeTheme();});
}

function screenSettings(){
  const p=P(),s=p.settings;
  if(s.petSounds===undefined){s.petSounds=true;persist();}
  if(s.revealSecs===undefined){s.revealSecs="20";persist();}
  if(s.voiceGender===undefined){s.voiceGender="female";persist();}
  /* Build 86g-phase10: existing saves predate the accent choice — default
     them to British so nothing changes for current players until they opt in. */
  if(s.pronunciation===undefined){s.pronunciation="uk";persist();}
  if(s.showMasteryBadge===undefined){s.showMasteryBadge=true;persist();}
  const tog=(id,label,on)=>`<div class="setrow"><span>${label}</span><button type="button" role="switch" aria-checked="${on?"true":"false"}" aria-label="${esc(label)}" class="switch ${on?"on":""}" data-s="${id}"><span class="knob"></span></button></div>`;
  const sel=(id,label,opts,cur)=>`<div class="setrow"><span>${label}</span><select data-sel="${id}">${opts.map(o=>`<option value="${o[0]}" ${cur===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select></div>`;
  const trackOpts=Object.entries(MUSIC_TRACKS).map(([id,t])=>
    `<div class="trackrow"><button class="felt mini tracksel ${s.musicTrack===id?"sel":""}" data-track="${id}">${s.musicTrack===id?"✓ ":""}${t.name}</button>
     <button class="linky" data-preview="${id}">▶ preview</button></div>`).join("");
  show(`<section class="screen">
   <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>Settings</b><span></span></div>
   <div class="setcard felt"><h3>Sound & voice</h3>
    ${tog("sound","Sound effects",s.sound)}
    ${tog("music","Background music",s.music)}
    ${tog("voice","Word pronunciation",s.voice)}
    ${tog("celebVoice","Spoken encouragement",s.celebVoice)}
    ${tog("petSounds","Pet sounds & reactions",s.petSounds!==false)}
    <div class="voiceblock">
      <div class="setrow"><label for="voicePreset">Voice</label><select id="voicePreset">${VOICE_PRESETS.map(([id,label])=>`<option value="${id}" ${currentVoicePreset()===id?"selected":""}>${label}</option>`).join("")}</select></div>
      <p class="note voicenote" id="voiceNote" role="status"></p>
      <div class="setrow"><label for="voiceRate">Speaking speed</label><input type="range" id="voiceRate" min="0.65" max="1.05" step="0.01" value="${Number.isFinite(Number(s.voiceRate))?Number(s.voiceRate):.92}"></div>
      ${Voice.supported()?`<div class="voicebtns"><button class="felt mini" id="testvoice">🔊 Test voice</button><button class="felt mini" id="nextvoice">Try another voice</button></div>`:""}
    </div>
    <div class="setrow"><span>Try it</span><span class="tryrow">
      <button class="felt mini" id="testsfx">🔔 Effect</button>
      <button class="felt mini" id="testpet">🐶 Pet</button>
      <button class="felt mini" id="testmus">🎵 Notes</button></span></div></div>
   <div class="setcard felt"><h3>🎵 Music track</h3>
    <div class="tracklist">${trackOpts}</div></div>
   <div class="setcard felt mybarista"><h3>🧑‍🍳 My shopkeeper</h3>
    <div class="mybaristarow"><div class="mybaristaart">${playerSVG("happy",54)}</div>
      <div class="mybaristabtns"><b data-i18n-skip>${esc(p.name)}</b><span><button class="felt mini" id="setEditLook">✏️ Change look</button><button class="felt mini" id="setRename">Aa Rename</button></span></div></div></div>
   <div class="setcard felt"><h3>Play</h3>
    ${sel("diff","Difficulty",[["auto","Auto (adjusts to you)"],["easy","Junior"],["core","Word Master"],["stretch","Super Star"]],s.diff)}
    ${tog("showMasteryBadge","Show word-progress badges",s.showMasteryBadge!==false)}
    ${sel("revealSecs","Answer popup stays for",[["10","10 seconds"],["20","20 seconds"],["30","30 seconds"],["45","45 seconds"],["0","Until I close it"]],s.revealSecs??"20")}</div>
   <div class="setcard felt"><h3>Comfort</h3>
    ${sel("motion","Motion",[["full","Full animation"],["reduced","Reduced motion"]],s.motion)}
    ${tog("batterySaver","Battery saver (no automatic idles, fewer effects)",!!s.batterySaver)}
    ${sel("text","Text size",[["normal","Normal"],["large","Large"],["xl","Extra large"]],s.text)}
    ${sel("font","Reading font",[["standard","Standard"],["dyslexic","Easy-read (dyslexia-friendly)"]],s.font)}</div>
   <div class="setcard felt"><h3>Grown-ups: usage analytics</h3>
    <p class="note">WordBar collects non-identifying usage statistics, such as how often the game is opened and played, to help improve it. It never collects names, answers or the words practised. Statistics are deleted after three months. <a class="linky wb-privacy-link" href="${privacyUrl()}" target="_blank" rel="noopener">More about privacy</a></p>
    ${tog("_analyticsOff","Turn off usage analytics", window.WordBarAnalytics&&WordBarAnalytics.consentStatus()==="denied")}</div>
   <div class="setcard felt"><h3>Save</h3>
    ${wbNeedsHomeScreenTip()?`<p class="note">📲 Keep your café safe: add WordBar to your Home Screen (Share → Add to Home Screen). Safari can clear a website’s saved games after a week without a visit; the Home Screen app keeps its own save. Move this café across with Export save here, then Import save in the app. Already added it? Open WordBar from its Home Screen icon: shared links may open in your browser.</p>`:""}
    <button class="felt mini" id="exp">⬇ Export save</button>
    <button class="felt mini" id="imp">⬆ Import save</button>
    <input type="file" id="impfile" accept=".json" hidden></div>
   <div class="setcard felt danger"><h3>⚠️ Reset progress</h3>
    <p class="note">Clears your coins, unlocks, word progress and achievements for this shopkeeper. This cannot be undone.</p>
    <button class="felt mini reddanger" id="resetbtn">Reset this shopkeeper's progress</button></div>
  </section>`);
  $("#back").onclick=()=>{AudioKit.tap();applySettings();screenMenu();};
  $("#setEditLook").onclick=()=>{AudioKit.tap();openEditLook(SAVE.active,"settings");};
  $("#setRename").onclick=()=>{AudioKit.tap();wbRenameSheet(p,()=>screenSettings());};
  $("#testsfx").onclick=()=>AudioKit.test("sfx");
  $("#testpet").onclick=()=>AudioKit.test("pet");
  $("#testmus").onclick=()=>AudioKit.test("music");
  const tv=$("#testvoice"); if(tv) tv.onclick=()=>Voice.preview("Welcome to WordBar! Propinquity. Serendipity."); /* audition the selected voice (audio QA #4) */
  /* S9a: one Voice list like WordBar Dictation. It writes the existing
     pronunciation (uk/us) + voiceGender (female/male) settings, so older saves,
     backups and imports keep working unchanged. */
  const voiceNote=$("#voiceNote"),paintVoiceNote=()=>{if(voiceNote)voiceNote.textContent=voiceNoteText();};
  paintVoiceNote();if(Voice.supported()){try{speechSynthesis.addEventListener("voiceschanged",paintVoiceNote,{once:true});}catch(e){}setTimeout(paintVoiceNote,700);}
  const vp=$("#voicePreset");if(vp)vp.onchange=()=>{const [acc,g]=vp.value.split("-");s.pronunciation=acc==="us"?"us":"uk";s.voiceGender=g==="male"?"male":"female";s.voicePick="";persist();paintVoiceNote();AudioKit.tap();};
  const vr=$("#voiceRate");if(vr)vr.onchange=()=>{s.voiceRate=Math.max(.65,Math.min(1.05,Number(vr.value)||.92));persist();};
  const nv=$("#nextvoice");if(nv)nv.onclick=()=>{const v=nextVoicePick();paintVoiceNote();if(!v){toast("There is no other voice like this on this device.");return;}Voice.preview("Hello! Let's practise your words.");};
  $$("[data-s]").forEach(b=>b.onclick=()=>{if(b.dataset.s==="_analyticsOff")return;s[b.dataset.s]=!s[b.dataset.s];persist();b.classList.toggle("on");
    b.setAttribute("aria-checked",b.classList.contains("on")?"true":"false");
    if(b.dataset.s==="batterySaver")applySettings();
    if(b.dataset.s==="music"&&!s.music)AudioKit.ambientStop();
    if(b.dataset.s==="music"&&s.music)AudioKit.ambientStart();
    AudioKit.sync();AudioKit.tap();});
  $$("[data-sel]").forEach(el=>el.onchange=()=>{s[el.dataset.sel]=el.value;persist();applySettings();AudioKit.tap();});
  $$("[data-track]").forEach(b=>b.onclick=()=>{s.musicTrack=b.dataset.track;persist();AudioKit.tap();if(s.music)AudioKit.ambientStart();screenSettings();});
  $$("[data-preview]").forEach(b=>b.onclick=()=>{AudioKit.unlock();AudioKit.previewTrack(b.dataset.preview);});
  const _aOff=$('[data-s="_analyticsOff"]');
  if(_aOff)_aOff.onclick=()=>{AudioKit.tap();const turningOff=!_aOff.classList.contains("on");_aOff.classList.toggle("on");_aOff.setAttribute("aria-checked",_aOff.classList.contains("on")?"true":"false");if(window.WordBarAnalytics){WordBarAnalytics.setConsent(!turningOff);if(!turningOff)WordBarAnalytics.initGameOpen();}toast(turningOff?"Usage analytics off.":"Usage analytics on. Thank you!");};
  $("#exp").onclick=()=>{exportSaveBlob(JSON.stringify(SAVE,null,1));toast("Save exported 📦");};
  $("#imp").onclick=()=>$("#impfile").click();
  $("#impfile").onchange=e=>{const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=()=>{
      try{
        let parsed;try{parsed=JSON.parse(r.result);}catch(parseError){throw importError("NOT_SAVE","not valid JSON");}
        const validated=validateImportedSave(parsed);
        const backup=WordBarPersistence.backup(WORDBAR_SAVE_KEYS.preImport,SAVE);
        if(!backup.ok)throw importError("BACKUP","a protective backup could not be verified");
        const committed=WordBarPersistence.persistLive(validated);
        if(!committed.ok){WordBarPersistence.persistLive(SAVE);throw importError("WRITE","the imported save could not be written and verified");}
        SAVE=committed.value;
        toast("Save imported ✓"); screenProfiles();
      }catch(err){
        /* the existing save is untouched on any failure */
        const code=err&&IMPORT_REASONS[err.code]?err.code:"DAMAGED";
        try{console.warn("WordBar import failed:",code,err&&err.message);}catch(e){}
        toast("That file couldn't be imported: "+IMPORT_REASONS[code]+". Your current save is unchanged.");
      }};
    r.readAsText(f);};
  $("#resetbtn").onclick=()=>{
    /* two-step, child-resistant reset (QA): confirm, then type the
       barista's name exactly. Anything else changes nothing. */
    /* S9c: the same check inside the app (no browser pop-ups) */
    AudioKit.tap();
    wbTypeNameSheet({title:`Reset ${p.name}’s progress?`,warning:"This clears coins, unlocks, word progress and achievements — and cannot be undone.",
      name:p.name,confirmLabel:"Reset progress",onConfirm:()=>{
        if(resetProgress()){toast("Progress reset. Fresh start! 🌱");screenMenu();}
        else toast("Progress was not reset because the updated save could not be verified.");}});};
}

/* ---------- Grown-ups (word-bank visibility only in this pass) ---------- */
function grownGate(destination="library"){
  const a=3+Math.floor(Math.random()*6),b=4+Math.floor(Math.random()*6),c=2+Math.floor(Math.random()*4);
  const ansv=a*b+c;
  const summary=destination==="summary";
  show(`<section class="screen center"><h2>${summary?"📈 Weekly Summary":"📚 Library"} <small style="font-size:.6em">(grown-ups only)</small></h2>
   <p>${summary?"A quick grown-up check":"To keep word editing for adults"}: what is <b>${a} × ${b} + ${c}</b>?</p>
   <input id="gans" inputmode="numeric" class="gateinput"><br>
   <button class="felt big" id="check">Enter</button><button class="linky" id="back">← back</button></section>`);
  $("#back").onclick=()=>screenMenu();
  /* S11b: full-width digits from a Chinese keyboard (１２) count as 12 */
  const gansValue=()=>String($("#gans").value||"").replace(/[\uFF10-\uFF19]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0xFEE0)).trim();
  $("#check").onclick=()=>{ if(gansValue()!==""&&+gansValue()===ansv)(summary?screenParentSummary():screenGrown()); else {toast("Not quite — try again.");$("#gans").value="";} };
  $("#gans").addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.isComposing&&e.keyCode!==229) $("#check").click(); }); /* QA a11y 8.4 */
  $("#gans").focus();
}
function screenGrown(filter="",page=0){
  const PAGE=100, p=P();
  show(`<section class="screen" id="grownScreen">
   <div class="topbar"><button class="iconb" id="back" aria-label="Go back">←</button><b>Word management</b><span></span></div>
   <div class="menucourse">${courseBadgeHTML(p.courseId)}</div>
   <p class="note" id="wordSummary"></p>
   <div class="growbtns"><input id="search" placeholder="🔎 search…" value="${esc(filter)}" autocomplete="off" spellcheck="false"></div>
   <div id="wordPagerTop"></div>
   <div class="wordtable" id="wordResults"></div>
   <div id="wordPagerBottom"></div>
   <div id="hiddenWords"></div>
   </section>`);
  const state={filter:String(filter||""),page:Number(page)||0};
  const search=$("#search");
  const summary=$("#wordSummary"), results=$("#wordResults"), top=$("#wordPagerTop"), bottom=$("#wordPagerBottom"), hidden=$("#hiddenWords");
  const pagerHTML=(pg,pages,total)=>pages>1?`<div class="pagerow">
      <button class="felt mini" data-page="${pg-1}" ${pg===0?"disabled":""}>← Prev</button>
      <span class="pageinfo">Page <b>${pg+1}</b> of ${pages} <small>(words ${pg*PAGE+1}–${Math.min(total,(pg+1)*PAGE)} of ${total})</small></span>
      <button class="felt mini" data-page="${pg+1}" ${pg>=pages-1?"disabled":""}>Next →</button>
    </div>`:"";
  function renderManagedWords(){
    const term=state.filter.trim().toLowerCase();
    const words=allWords().filter(w=>!term||w.w.toLowerCase().includes(term));
    const pages=Math.max(1,Math.ceil(words.length/PAGE));
    state.page=Math.min(Math.max(0,state.page),pages-1);
    const slice=words.slice(state.page*PAGE,(state.page+1)*PAGE);
    const builtins=activeCourseStore().words;
    summary.innerHTML=`The bank currently has <b>${allWords().length}</b> loaded active words (${builtins.length} built-in${p.hidden.length?`, ${p.hidden.length} hidden`:""}). Words only appear in question types the real bank has data for — nothing is ever invented.`;
    const pager=pagerHTML(state.page,pages,words.length);
    top.innerHTML=pager; bottom.innerHTML=pager;
    results.innerHTML=slice.map(w=>`<div class="wordrow felt"><div><b lang="en-GB">${esc(w.w)}</b> <span class="tierpill ${w.t}" data-i18n-ctx>${esc(activeTierLabel(w.t))}</span>
       <br><small lang="en-GB">${esc(w.def)}</small></div><div class="rowbtns"><button class="linky red" data-hide="${w.id}">hide</button></div></div>`).join("")||"<p class='note'>No words match that search.</p>";
    hidden.innerHTML=p.hidden.length?`<h3>Hidden built-ins</h3>${p.hidden.map(id=>{const w=builtins.find(x=>x.id===id);return w?`<div class="wordrow felt dim"><b lang="en-GB">${esc(w.w)}</b><button class="linky" data-unhide="${id}">restore</button></div>`:"";}).join("")}`:"";
    document.querySelectorAll("#grownScreen [data-page]").forEach(b=>{if(!b.disabled)b.onclick=()=>{AudioKit.tap();state.page=+b.dataset.page;renderManagedWords();window.scrollTo(0,0);};});
    document.querySelectorAll("#grownScreen [data-hide]").forEach(b=>b.onclick=()=>{if(!p.hidden.includes(b.dataset.hide))p.hidden.push(b.dataset.hide);persist();renderManagedWords();});
    document.querySelectorAll("#grownScreen [data-unhide]").forEach(b=>b.onclick=()=>{p.hidden=p.hidden.filter(x=>x!==b.dataset.unhide);persist();renderManagedWords();});
  }
  $("#back").onclick=()=>screenMenu();
  search.addEventListener("input",()=>{
    state.filter=search.value; state.page=0; renderManagedWords();
    /* Only result containers are replaced, so iOS keeps focus, the
       keyboard and the caret position while a grown-up types. */
  });
  renderManagedWords();
  search.focus();
  search.setSelectionRange(search.value.length,search.value.length);
}


/* ====================================================================
   S9b — shared pause sheet, back button, first-time intros, "Read it to
   me", carry on an interrupted shift, and keeping the café safe in Safari.
   ==================================================================== */

/* ---- One pause sheet for every game (Café/Rush/Time/Review, Kitchen, Pet Pop) ---- */
function openPauseSheet({mode,onResume,onEnd,endLabel="End session",endNote="Tips earned so far are kept."}){
  const old=document.getElementById("pauseDlg");if(old)return;   // already open
  const p=P(),s=p.settings;
  const dlg=document.createElement("dialog");dlg.id="pauseDlg";dlg.className="reveal pausedlg";
  const tog=(id,label,on)=>`<div class="setrow"><span>${label}</span><button type="button" role="switch" aria-checked="${on?"true":"false"}" aria-label="${esc(label)}" class="switch ${on?"on":""}" data-ps="${id}"><span class="knob"></span></button></div>`;
  dlg.innerHTML=`<div class="dlghead good">⏸️ Paused</div>
    <div class="dlgbody">
      <button type="button" class="felt big primary psresume" id="psResume">▶ Resume</button>
      ${tog("sound","Sound effects",s.sound)}
      ${tog("music","Background music",s.music)}
      ${tog("voice","Word pronunciation",s.voice)}
      ${tog("petSounds","Pet sounds & reactions",s.petSounds!==false)}
      <div class="psrow">${MODE_INTROS[mode]?`<button type="button" class="felt mini" id="psHow">❓ How to play</button>`:""}
        <button type="button" class="felt mini reddanger" id="psEnd">${esc(endLabel)}</button></div>
    </div>`;   // S9g: one tap ends (no second confirm step)
  document.body.appendChild(dlg);
  if(window.WordBarAnalytics)WordBarAnalytics.pause("sheet");   /* S10b: pause-sheet time is not active play */
  let ending=false;
  dlg.addEventListener("close",()=>{dlg.remove();if(window.WordBarAnalytics)WordBarAnalytics.resume("sheet");if(ending){try{onEnd&&onEnd();}catch(e){}}else{try{onResume&&onResume();}catch(e){}}});
  dlg.querySelector("#psResume").onclick=()=>{AudioKit.tap();dlg.close();};
  dlg.querySelectorAll("[data-ps]").forEach(b=>b.onclick=()=>{
    s[b.dataset.ps]=!s[b.dataset.ps];persist();b.classList.toggle("on");
    b.setAttribute("aria-checked",b.classList.contains("on")?"true":"false");
    if(b.dataset.ps==="music"){s.music?AudioKit.ambientStart():AudioKit.ambientStop();}
    AudioKit.sync();AudioKit.tap();});
  const how=dlg.querySelector("#psHow");if(how)how.onclick=()=>{AudioKit.tap();showModeIntro(mode,{fromPause:true});};
  dlg.querySelector("#psEnd").onclick=()=>{if(ending)return;AudioKit.tap();ending=true;dlg.close();};
  dlg.showModal();
}
function pauseCafe(){
  const S=SHIFT;if(!S||S.ended||document.getElementById("pauseDlg"))return;
  pauseSession("sheet");
  openPauseSheet({mode:S.mode,
    endLabel:S.mode==="rush"?"End rush":S.mode==="time"?"End challenge":S.mode==="review"?"End review":"End session",
    onResume:()=>resumeSession("sheet"),
    onEnd:()=>{if(SHIFT===S)endShift(true);resumeSession("sheet");}});
}
function pauseKitchen(){
  const run=KITCHEN_RUN;
  if(!run||!["active","feedback","paused"].includes(run.status)){abandonKitchenRun();return;}
  if(document.getElementById("pauseDlg"))return;
  pauseKitchenRun("sheet");
  openPauseSheet({mode:"kitchen",endLabel:"Leave Kitchen",endNote:"This recipe’s progress will be lost.",
    onResume:()=>resumeKitchenRun("sheet"),
    onEnd:()=>{if(KITCHEN_RUN!==run)return;if(run.status==="active"){kitchenAccumulateModeTime(run);run.remainingMs=kitchenRemainingMs(run);}
      finishKitchenRun("abandoned",{exitToMenu:true});}});
}
function pausePetPop(){
  if(typeof PetPop==="undefined"||document.getElementById("pauseDlg"))return;
  const RESUMABLE=["active","overtime","countdown","wordIntro"];
  const phase=()=>{try{return (PetPop.debug&&PetPop.debug().phase)||""}catch(e){return ""}};
  let held=false,poll=null;
  const hold=()=>{if(held)return;if(RESUMABLE.includes(phase())||phase()==="paused"){PetPop.pause("sheet");held=true;if(poll){clearInterval(poll);poll=null;}}};
  hold();if(!held)poll=setInterval(hold,150);   // between rounds: hold as soon as the next round starts
  openPauseSheet({mode:"petpop",endLabel:"Leave Pet Pop",endNote:"This round’s progress will be lost.",
    onResume:()=>{if(poll)clearInterval(poll);PetPop.resume("sheet");},
    onEnd:()=>{if(poll)clearInterval(poll);exitPetPop();}});
}

/* ---- Back button / back swipe: back from any screen returns to the menu;
   back during a game opens the pause sheet (never quits). Only the tab's own
   back list is used ({wb:"root"|"screen"}); nothing is stored. ---- */
const WB_NAV={expectPop:0,pendingPush:false};
function wbGameActive(){
  if(SHIFT&&!SHIFT.ended)return "cafe";
  if(KITCHEN_RUN&&["active","feedback","paused"].includes(KITCHEN_RUN.status))return "kitchen";
  if(PET_POP_CONTROLLER)return "petpop";
  return "";
}
function wbPushScreen(){try{if(!history.state||history.state.wb!=="screen")history.pushState({wb:"screen"},"");}catch(e){}}
function wbSyncHistory(){
  const root=!!app.querySelector(".mainmenu-screen")||!P();
  if(root){if(history.state&&history.state.wb==="screen"){WB_NAV.expectPop++;WB_NAV.pendingPush=false;try{history.back();}catch(e){WB_NAV.expectPop--;}}}
  else if(WB_NAV.expectPop>0)WB_NAV.pendingPush=true;
  else wbPushScreen();
}
window.addEventListener("popstate",()=>{
  if(WB_NAV.expectPop>0){WB_NAV.expectPop--;if(WB_NAV.pendingPush){WB_NAV.pendingPush=false;wbPushScreen();}return;}
  const sheet=document.getElementById("pauseDlg");
  if(sheet){wbPushScreen();try{sheet.close();}catch(e){}return;}          // back again = Resume
  const small=document.querySelector("dialog.wbsheet[open]");           // S9c: back closes an in-app sheet
  if(small){wbPushScreen();try{small.close();}catch(e){}return;}
  if(WB_NAV.onBack&&!document.querySelector("dialog[open]")){const f=WB_NAV.onBack;wbPushScreen();f();return;}  // S9c: look editor → Cancel
  if(document.querySelector("dialog[open]")){wbPushScreen();return;}      // an answer popup is open: stay
  const game=wbGameActive();
  if(game){wbPushScreen();if(game==="cafe")pauseCafe();else if(game==="kitchen")pauseKitchen();else pausePetPop();return;}
  try{applySettings();}catch(e){}
  if(P())screenMenu();else screenProfiles();
});

/* ---- How to play: shown automatically only the FIRST time a mode opens ---- */
const MODE_INTROS={
  normal:{title:"☕ Café",lines:[["☕","Serve 20 customers."],["👆","Tap the right answer to make each order."],["⏳","Watch the patience bar. A slow answer only loses that ticket, never the game."],[COIN,"Perfect tickets earn the most tips."],["🔔","Sound plays even when the phone is on silent. Turn it off in ⏸️."]]},
  rush:{title:"🔥 Rush Hour",lines:[["🔥","Customers keep arriving. Serve them fast!"],["❌","Five mix-ups, or 20 people in the queue, ends the rush."],["🏆","Beat your record for customers served."]]},
  time:{title:"⏱️ Time Challenge",lines:[["⏱️","Serve as many customers as you can before the clock runs out."],["⚡","Answers flash right or wrong, with no pop-ups, so keep going."],[COIN,"More customers means more tips."]]},
  review:{title:"🎯 Review",lines:[["🎯","Practise words you’ve met before or found tricky."],["📖","Each answer shows the meaning again."],["🔥","Review on different days to build a streak."]]}
};
function showModeIntro(mode,{onDone,fromPause=false}={}){
  const intro=MODE_INTROS[mode];if(!intro){onDone&&onDone();return;}
  const dlg=document.createElement("dialog");dlg.className="reveal introdlg";
  dlg.innerHTML=`<div class="dlghead good">How to play · ${intro.title}</div>
    <div class="dlgbody"><ul class="introlist">${intro.lines.map(([e,t])=>`<li><span aria-hidden="true">${e}</span><span>${esc(t)}</span></li>`).join("")}</ul>
      <p class="note">${fromPause?"":"Tip: tap ⏸️ during a game to pause, change sounds or see this again."}</p></div>
    <div class="dlgfoot"><span></span><div class="dlgbtns"><button type="button" class="closebtn primary" id="introGo">${fromPause?"Back":"Let’s go! ▶"}</button></div></div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close",()=>{dlg.remove();onDone&&onDone();});
  dlg.querySelector("#introGo").onclick=()=>{AudioKit.tap();dlg.close();};
  dlg.showModal();
}
function introAlreadyKnown(p,mode){
  const played={normal:p._normalDone,rush:p._rushDone,time:p._timeDone,review:p._reviewDone}[mode];
  return !!(p._introsSeen&&p._introsSeen[mode])||(played||0)>0;   // existing players who already played the mode don't see it
}
function withFirstTimeIntro(mode,start){
  const p=P();if(!MODE_INTROS[mode]||introAlreadyKnown(p,mode)){start();return;}
  p._introsSeen=p._introsSeen||{};p._introsSeen[mode]=true;persist();
  showModeIntro(mode,{onDone:start});
}

/* ---- "Read it to me": reads the question and its choices; the game pauses while it speaks ---- */
function questionSpeechText(q){
  const plain=String(q.text||"").replace(/<[^>]*>/g," ").replace(/_{2,}|…{2,}/g," blank ").replace(/\s+/g," ").trim();
  const opts=(q.opts||[]).map(String);
  const list=opts.length>1?`${opts.slice(0,-1).join(", ")}, or ${opts[opts.length-1]}`:opts.join("");
  return list?`${plain}. Is it: ${list}?`:plain;
}

/* ---- Carry on an interrupted shift (Café, Time, Review). Only running totals are
   saved; carrying on continues the count with a fresh customer. ---- */
const SHIFT_RESUME_MODES=["normal","time","review"],SHIFT_RESUME_MAX_AGE=24*60*60*1000;
function saveShiftResume(S){
  const p=P();if(!p||!S||S.ended||!SHIFT_RESUME_MODES.includes(S.mode))return;
  if(!(S.served>0||S.answers>0)){if(p.shiftResume){delete p.shiftResume;persist();}return;}
  p.shiftResume={v:1,courseId:p.courseId,mode:S.mode,savedAt:Date.now(),served:S.served,perfect:S.perfect,answers:S.answers,
    rightAnswers:S.rightAnswers,streak:S.streak,bestStreak:S.bestStreak,tips:S.tips,weekend:!!S.weekend,
    timeLeft:S.timeLeft,timeTotal:S.timeTotal,activeMs:shiftDurationMs(S),missed:(S.missed||[]).slice(0,40),
    startMastered:S.startMastered,startWords:S.startWords,owlUsed:!!S.owlUsed};
  persist();
}
function clearShiftResume(){const p=P();if(p&&p.shiftResume){delete p.shiftResume;return true;}return false;}
function validShiftResume(){
  const p=P(),r=p&&p.shiftResume;if(!r)return null;
  const ok=r.v===1&&SHIFT_RESUME_MODES.includes(r.mode)&&r.courseId===p.courseId&&Number.isFinite(r.savedAt)
    &&Date.now()-r.savedAt<SHIFT_RESUME_MAX_AGE&&(r.served>0||r.answers>0)&&(r.mode!=="time"||r.timeLeft>0);
  if(ok)return r;
  delete p.shiftResume;persist();setTimeout(()=>toast("Your last shift was ended — tips kept."),300);return null;
}
function shiftResumeLabel(r){
  if(r.mode==="time"){const t=Math.max(0,r.timeLeft|0);return `Time Challenge · ${Math.floor(t/60)}:${String(t%60).padStart(2,"0")} left`;}
  if(r.mode==="review")return `Review · customer ${r.served+1} of ${REVIEW_TARGET}`;
  return `Café · customer ${r.served+1} of ${NORMAL_TARGET}`;
}
/* Starting anything else ends the saved shift quietly (tips were paid as earned). */
function discardShiftResume(){if(clearShiftResume()){persist();toast("Your last shift was ended — tips kept.");}}
function carryOnShift(){
  const r=validShiftResume();if(!r){screenMenu();return;}
  clearShiftResume();persist();startShift(r.mode,r.mode==="time"?r.timeLeft:undefined,r);
}
function endSavedShift(){
  const r=validShiftResume();if(!r){screenMenu();return;}
  clearShiftResume();
  SHIFT={mode:r.mode,served:r.served,spawned:r.served,perfect:r.perfect,answers:r.answers,rightAnswers:r.rightAnswers,streak:0,bestStreak:r.bestStreak,
    tips:r.tips,weekend:r.weekend,owlUsed:r.owlUsed,timeLeft:r.timeLeft,timeTotal:r.timeTotal,popupOpen:false,patTimer:null,timer:null,
    startedAt:Date.now()-Math.max(0,r.activeMs||0),pausedTotalMs:0,activePauseStartedAt:null,missed:r.missed||[],
    startMastered:r.startMastered,startWords:r.startWords,queue:[],current:null};
  endShift(true);
}

/* ---- Keep the café safe in Safari: Safari can delete a website's saved data
   after 7 days of Safari use without a visit. Home Screen apps are exempt. ---- */
function wbIsAppleTouch(){const n=navigator;return /iPhone|iPad|iPod/.test(n.userAgent||"")||(n.platform==="MacIntel"&&n.maxTouchPoints>1);}
function wbIsStandalone(){return window.navigator.standalone===true||!!(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches);}
function wbNeedsHomeScreenTip(){return wbIsAppleTouch()&&!wbIsStandalone();}
function requestPersistentStorage(){
  /* Ask the browser to keep WordBar's storage. Silent in Safari and Chrome;
     skipped in Firefox, which would show a permission prompt. */
  try{if(/Firefox\//.test(navigator.userAgent||""))return;
    if(navigator.storage&&navigator.storage.persisted&&navigator.storage.persist)
      navigator.storage.persisted().then(done=>{if(!done)return navigator.storage.persist();}).catch(()=>{});}catch(e){}
}
function maybeShowHomeScreenTip(){
  const p=P();if(!p||!wbNeedsHomeScreenTip()||p._homeTipShown||!(gamesPlayed(p)>0))return;
  p._homeTipShown=true;persist();
  const dlg=document.createElement("dialog");dlg.className="reveal introdlg";
  dlg.innerHTML=`<div class="dlghead good">📲 Keep your café safe</div>
    <div class="dlgbody"><p>Add WordBar to your Home Screen: tap <b>Share</b> <span class="sharebox" aria-label="(the square with an arrow)">⬆︎</span>, then <b>Add to Home Screen</b>.</p>
      <p class="note">Safari can clear a website’s saved games after a week without a visit. The Home Screen app keeps its own save, so your café stays safe.</p>
      <p class="note">The app starts with its own save. To bring this café across, use <b>Settings → Export save</b> here, then <b>Import save</b> in the app.</p>
      <p class="note">Already added it? Open WordBar from its Home Screen icon: shared links may open in your browser.</p></div>
    <div class="dlgfoot"><span></span><div class="dlgbtns"><button type="button" class="closebtn primary" id="homeTipOk">Got it</button></div></div>`;
  document.body.appendChild(dlg);dlg.addEventListener("close",()=>dlg.remove());
  dlg.querySelector("#homeTipOk").onclick=()=>{AudioKit.tap();dlg.close();};
  dlg.showModal();
}

/* ======================================================================
   S9c: barista look editor helpers, in-app sheets, games played
   ====================================================================== */

/* iOS-style action sheet (a <dialog>, so Esc / the back swipe close it). */
function wbActionSheet({title,titleIsName=false,subtitle="",actions=[],cancelLabel="Cancel"}){
  const dlg=document.createElement("dialog");dlg.className="reveal wbsheet";
  dlg.innerHTML=`<div class="dlghead good"${titleIsName?" data-i18n-skip":""}>${esc(title)}</div>
    <div class="dlgbody">${subtitle?`<p class="note wbsheetsub">${esc(subtitle)}</p>`:""}
      ${actions.map((a,i)=>`<button type="button" class="felt big wbsheetbtn ${a.danger?"reddanger":""}" data-i="${i}">${esc(a.label)}</button>`).join("")}
      <button type="button" class="felt wbsheetcancel" id="wbSheetCancel">${esc(cancelLabel)}</button></div>`;
  let chosen=null;
  dlg.addEventListener("close",()=>{dlg.remove();if(chosen){try{chosen.onClick();}catch(e){console.error(e);}}});
  dlg.querySelectorAll(".wbsheetbtn").forEach(b=>b.onclick=()=>{AudioKit.tap();chosen=actions[+b.dataset.i];dlg.close();});
  dlg.querySelector("#wbSheetCancel").onclick=()=>{AudioKit.tap();dlg.close();};
  document.body.appendChild(dlg);dlg.showModal();return dlg;
}
/* Child-resistant confirm inside the app: the red button stays disabled
   until the barista's name is typed exactly (replaces confirm + prompt). */
function wbTypeNameSheet({title,warning,name,confirmLabel,onConfirm}){
  const dlg=document.createElement("dialog");dlg.className="reveal wbsheet typename";
  dlg.innerHTML=`<div class="dlghead okay">${esc(title)}</div>
    <div class="dlgbody"><p>${esc(warning)}</p>
      <label class="typenamelabel">To confirm, type the shopkeeper’s name: <b data-i18n-skip>${esc(name)}</b>
        <input type="text" id="wbTypeName" maxlength="30" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <div class="psrow"><button type="button" class="felt mini" id="wbTypeCancel">Cancel</button>
        <button type="button" class="felt mini reddanger" id="wbTypeGo" disabled>${esc(confirmLabel)}</button></div></div>`;
  let ok=false;
  dlg.addEventListener("close",()=>{dlg.remove();if(ok){try{onConfirm();}catch(e){console.error(e);}}});
  const input=dlg.querySelector("#wbTypeName"),go=dlg.querySelector("#wbTypeGo");
  input.oninput=()=>{go.disabled=input.value.trim()!==name;};
  dlg.querySelector("#wbTypeCancel").onclick=()=>{AudioKit.tap();dlg.close();};
  go.onclick=()=>{if(input.value.trim()!==name)return;AudioKit.tap();ok=true;dlg.close();};
  document.body.appendChild(dlg);dlg.showModal();
}
/* Rename (1–14 characters, as at creation) with Undo. */
function wbRenameSheet(prof,onDone){
  const dlg=document.createElement("dialog");dlg.className="reveal wbsheet";
  dlg.innerHTML=`<div class="dlghead good">Rename shopkeeper</div>
    <div class="dlgbody"><label class="typenamelabel">New name
      <input type="text" id="wbRename" maxlength="14" autocomplete="off" value="${esc(prof.name)}"></label>
      <div class="psrow"><button type="button" class="felt mini" id="wbRenCancel">Cancel</button>
        <button type="button" class="felt mini primary" id="wbRenSave">Save</button></div></div>`;
  let saved=false;
  const input=dlg.querySelector("#wbRename"),go=dlg.querySelector("#wbRenSave");
  const check=()=>{go.disabled=!input.value.trim();};
  input.oninput=check;
  input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing&&e.keyCode!==229&&!go.disabled){e.preventDefault();go.click();}});
  dlg.querySelector("#wbRenCancel").onclick=()=>{AudioKit.tap();dlg.close();};
  go.onclick=()=>{AudioKit.tap();saved=true;dlg.close();};
  dlg.addEventListener("close",()=>{dlg.remove();if(!saved)return;
    const old=prof.name,next=input.value.trim().slice(0,14);
    if(!next||next===old)return;
    prof.name=next;
    if(!persist()){prof.name=old;toast("The new name could not be saved. Free browser storage and try again.");return;}
    onDone&&onDone();
    toast(`Renamed to ${next}`,{label:"Undo",action:()=>{if(SAVE.profiles.indexOf(prof)<0)return;prof.name=old;persist();rerenderLookScreens();}});
  });
  document.body.appendChild(dlg);dlg.showModal();
  try{input.focus();input.select();}catch(e){}
}
/* "Who's serving today?" ••• menu */
function profileMoreSheet(i){
  const prof=SAVE.profiles[i];if(!prof)return;
  wbActionSheet({title:prof.name,titleIsName:true,actions:[
    {label:"✏️ Change look",onClick:()=>openEditLook(SAVE.profiles.indexOf(prof),"profiles")},
    {label:"Aa Rename",onClick:()=>wbRenameSheet(prof,()=>screenProfiles())},
    {label:"🗑 Delete shopkeeper",danger:true,onClick:()=>wbTypeNameSheet({title:`Delete ${prof.name}?`,
      warning:"This removes ALL their progress — coins, unlocks, words and trophies — and cannot be undone.",
      name:prof.name,confirmLabel:"Delete shopkeeper",onConfirm:()=>{
        const idx=SAVE.profiles.indexOf(prof);if(idx<0)return;
        if(deleteProfile(idx)){toast(`${prof.name} has been deleted.`);screenProfiles();}
        else toast("Nothing was deleted because WordBar could not verify a protective backup. Free browser storage and try again.");}})}
  ]});
}
let WB_SHOP_TAB="My Items";   /* S9d: the Shop tab to return to after Change look */
function openEditLook(index,from){
  if(!SAVE.profiles[index])return;
  if(wbGameActive())return;   // never during a game
  screenCustomize("",undefined,{index,from});
}
/* The look the editor starts from. A ready-made barista is copied exactly:
   its original colours become "Original" swatches and its face is frozen in
   faceFix, so saving without changes draws the same barista. */
function editableLookFrom(prof){
  if(prof.avatar==="custom"&&prof.customLook){
    const L=avatarLookFor(prof);
    return JSON.parse(JSON.stringify({skin:L.skin,hair:L.hair,hairstyle:L.hairstyle,
      ...(L.eyeShape?{eyeShape:L.eyeShape}:{}),lashes:!!L.lashes,iris:L.iris||irisFor(L),
      top:L.top,accessory:L.accessory||"none",facialHair:L.facialHair||"none",
      garment:{style:(L.garment&&L.garment.style)||"tee"},...(L.faceFix&&!L.eyeShape?{faceFix:{...L.faceFix}}:{}),
      ...(L.lashStyle?{lashStyle:L.lashStyle}:{}),...(L.brows?{brows:L.brows}:{}),...(L.cheeks?{cheeks:L.cheeks}:{}),
      ...(L.glassesColor?{glassesColor:L.glassesColor}:{}),...(L.hijab?{hijab:L.hijab}:{})}));
  }
  const L=avatarLookFor(prof),f=faceVary(L);
  return {skin:L.skin,hair:L.hair,hairstyle:L.hairstyle,lashes:!!f.lashes,iris:irisFor(L),
    top:L.top,accessory:L.accessory||"none",facialHair:L.facialHair||"none",
    garment:{style:(L.garment&&L.garment.style)||"tee"},
    faceFix:{sizeMul:f.sizeMul,shape:f.shape,lashes:!!f.lashes,mouthW:f.mouthW,blinkDur:f.blinkDur,blinkDel:f.blinkDel}};
}
function customLookFromDraft(d){
  const out={skin:d.skin,hair:d.hair,hairstyle:d.hairstyle,lashes:!!d.lashes,iris:d.iris,top:d.top,
    accessory:d.accessory||"none",facialHair:d.facialHair||"none",garment:{style:(d.garment&&d.garment.style)||"tee"}};
  /* S9e options */
  const C=CUSTOMIZER,ok=(list,v)=>list.some(([id])=>id===v);
  if(ok(C.lashStyles,d.lashStyle)){out.lashStyle=d.lashStyle;out.lashes=d.lashStyle!=="none";}
  if(ok(C.brows,d.brows)&&d.brows!=="natural")out.brows=d.brows;
  if(ok(C.cheeks,d.cheeks)&&d.cheeks!=="plain")out.cheeks=d.cheeks;
  if(out.accessory!=="none"&&ok(C.glassesColors,d.glassesColor))out.glassesColor=d.glassesColor;
  if(d.hairstyle==="hijab"&&ok(C.hijabColors,d.hijab))out.hijab=d.hijab;
  if(d.faceFix&&!d.eyeShape)out.faceFix={...d.faceFix};else out.eyeShape=d.eyeShape||"round";
  return out;
}
function restoreLook(prof,before){
  prof.avatar=before.avatar;
  if(before.customLook)prof.customLook=before.customLook;else delete prof.customLook;
  prof.placed.avatar=before.placed;
}
/* After Undo, redraw whichever screen is showing the barista. */
function rerenderLookScreens(){
  if(app.querySelector(".mainmenu-screen")&&P())screenMenu();
  else if(document.getElementById("newprof"))screenProfiles();
  else if(document.getElementById("resetbtn")&&P())screenSettings();
}
/* Wardrobe = the avatar items this barista owns. */
function wardrobeItemsFor(prof){
  const order=["hat","clips","head_extra","eyes","glasses","ears","neck","apron","garment_style","garment_color","back","wrist_l","wrist_r","waist","badge","extra"];
  return (prof.owned||[]).map(id=>SHOP.find(i=>i.id===id)).filter(i=>i&&i.dest==="avatar"&&!i.permanent)
    .sort((a,b)=>{const r=s=>{const i=order.indexOf(s);return i<0?99:i;};return r(a.slot)-r(b.slot);});
}
function wardrobeSlotLabel(slot){
  return ({hat:"Hats",head_extra:"Head extras",eyes:"Glasses",glasses:"Glasses",ears:"Earrings",neck:"Neck",apron:"Aprons",
    garment_style:"Clothes",garment_color:"Clothes colour",clips:"Hair clips",back:"Back",wrist_l:"Wrists",wrist_r:"Wrists",waist:"Belt",badge:"Badge",extra:"Extras"})[slot]||"Extras";
}
/* S9d: items in different slots that would overlap on the barista. Wearing
   one takes the other off (checked both ways). Same-slot items already
   replace each other. */
const WEAR_CONFLICTS={clips_star:["headset_pro","pencil_ear","headband_cat"],headband_cat:["headset_pro"],crown_flowers:["headset_pro"]};
function wearConflicts(id){const out=new Set(WEAR_CONFLICTS[id]||[]);Object.entries(WEAR_CONFLICTS).forEach(([k,v])=>{if(v.includes(id))out.add(k);});return [...out];}
/* Put an item on; returns the items taken off because they overlap. */
function wearShopItem(bag,it){
  bag[it.slot]=it.id;const clash=wearConflicts(it.id),removed=[];
  Object.keys(bag).forEach(slot=>{if(slot!==it.slot&&clash.includes(bag[slot])){removed.push(bag[slot]);delete bag[slot];}});
  return removed;
}
/* One rule for wearing an item, shared by the Shop and the Wardrobe. */
function toggleShopPlacement(bag,it){if(bag[it.slot]===it.id){delete bag[it.slot];return [];}return wearShopItem(bag,it);}
function overlapNote(it,removed){
  if(!removed||!removed.length)return "";
  const names=removed.map(id=>(SHOP.find(x=>x.id===id)||{}).name).filter(Boolean).join(" and ");
  return `Took off ${names} — it overlaps the ${it.name}.`;
}
/* Draw a barista look wearing a given set of avatar items. */
function wardrobePreviewSVG(look,placedAvatar,w){
  const fake={placed:{avatar:placedAvatar||{}}};
  const opts=playerRenderOpts(fake);
  const hasShopEyes=(opts.extras||[]).some(id=>{const it=SHOP.find(x=>x.id===id);return it&&it.slot==="eyes";});
  const L=(hasShopEyes&&isGlassesStyle(look.accessory))?{...look,accessory:"none"}:look;
  return characterSVG(L,"happy",{w,...opts});
}
/* "games played": café-type sessions + finished Pet Pop games + finished
   Kitchen dishes. Display only: read without creating or changing data
   (p.sessions itself still drives difficulty and trophies). */
function gamesPlayed(p){
  let n=Math.max(0,Number(p&&p.sessions)||0);
  try{const sg=p.spellingGame;if(sg&&sg.courses&&typeof sg.courses==="object")Object.values(sg.courses).forEach(c=>{n+=Math.max(0,Number(c&&c.sessions)||0);});}catch(e){}
  try{const st=p.kitchen&&p.kitchen.stats;if(st)n+=Math.max(0,(Number(st.challengesStarted)||0)-(Number(st.failReasons&&st.failReasons.abandoned)||0));}catch(e){}
  return n;
}

/* ---------- Boot ---------- */
(async function boot(){
  const saveInit=initializeV3Save();
  if(!saveInit.ok){showSaveMigrationFailure(saveInit.error);return;}
  applySettings();
  try{history.replaceState({wb:"root"},"");}catch(e){}   /* S9b: base entry for the back button */
  requestPersistentStorage();                              /* S9b: ask the browser to keep WordBar's save */
  if(window.WordBarAnalytics){WordBarAnalytics.seedMilestones([].concat(...SAVE.profiles.map(wbMilestoneNames)));WordBarAnalytics.setFeatureProvider(wbFeatureLetters);WordBarAnalytics.initGameOpen();}
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{ /* offline support is a nice-to-have, never block on it */ if(window.WordBarAnalytics)WordBarAnalytics.error("service_worker_failed","service_worker"); });
  }
  if(AVATAR_QA_REQUESTED){screenAvatarQA();return;}
  await BootCoordinator.start();
})();

/* S9g: give the main-menu tiles more breathing room. Measures the real
   free space on the visible screen (below the last tile, above the iPhone
   home bar) and turns it into extra gap: 5 px (as before) up to 12 px.
   If there isn't enough room, the tiles are made a little snugger (slightly
   smaller icon and padding, never below 46 px tall) to make room for the
   gaps. The menu never grows past the screen; phones that are already
   tight (SE) keep the old layout. */
function spaceMenu(){
  const el=app.querySelector(".mainmenu-screen");if(!el||el.classList.contains("s13menu"))return;   /* S13 menu sizes itself in CSS */
  const reset=()=>{el.style.removeProperty("--mg");el.classList.remove("spaced","snug","tight","tighter");};
  const lastBottom=()=>{const kids=[...el.children].filter(k=>k.getBoundingClientRect().height>0);return kids.length?kids[kids.length-1].getBoundingClientRect().bottom+window.scrollY:0;};
  const limit=()=>{const r=el.getBoundingClientRect(),pb=parseFloat(getComputedStyle(el).paddingBottom)||0;
    const bodyPb=parseFloat(getComputedStyle(document.body).paddingBottom)||0;
    return Math.min(r.bottom+window.scrollY-pb,window.innerHeight-bodyPb);};
  const fits=()=>lastBottom()<=limit()-2&&el.scrollHeight<=el.clientHeight+1;
  const tryGaps=()=>{for(let d=7;d>=2;d--){el.style.setProperty("--mg",(5+d)+"px");el.classList.add("spaced");if(fits())return true;}
    el.style.removeProperty("--mg");el.classList.remove("spaced");return false;};
  /* S11c: never fall back to the big tiles when they do not fit. Before, a
     phone that was still a few pixels short with snug tiles went back to the
     full-size tiles and the last row was cut off. Now: snug tiles (with or
     without the wider gaps), then "tight" tiles, and the smallest level is kept. */
  const run=()=>{
    if(!el.isConnected)return;reset();
    if(fits()&&tryGaps())return;                        // enough room: just wider gaps
    if(fits())return;                                   // fits as it is
    el.classList.add("snug");if(fits()){tryGaps();return;} // snugger tiles (+ gaps if room)
    el.classList.add("tight");if(fits())return;        // still too tall: smaller tiles
    el.classList.add("tighter");                        // last step: a slightly shorter café picture
  };
  requestAnimationFrame(run);setTimeout(run,350);
  try{document.fonts&&document.fonts.ready.then(run);}catch(e){}
}
{let t=null;window.addEventListener("resize",()=>{clearTimeout(t);t=setTimeout(()=>{if(app.querySelector(".mainmenu-screen"))spaceMenu();},150);});}


/* S10a analytics helpers. Game knowledge stays here; analytics.js only
   de-duplicates and sends. Milestones are read from the profile, so no
   game code path has to remember to report them. */
function wbAnalyticsDifficulty(d){return d==="easy"?"junior":d==="core"?"word_master":d==="stretch"?"super_star":"auto";}
function wbMilestoneNames(p){
  const out=[];if(!p||typeof p!=="object")return out;
  try{
    const k=p.kitchen||{},ps=p.petSystem||{};
    if(Array.isArray(k.unlockedFoods)&&typeof KITCHEN_CLASSIC_FOODS!=="undefined"&&k.unlockedFoods.length>KITCHEN_CLASSIC_FOODS.length)out.push("first_dish_unlocked");
    if(Array.isArray(p.petsMet)&&p.petsMet.length>0)out.push("first_pet_revealed");
    if(ps.licenceOwned)out.push("pet_licence_bought");
    if(ps.activePetId!==null&&ps.activePetId!==undefined)out.push("first_pet_chosen");
    if(p.achievements&&typeof p.achievements==="object"&&Object.keys(p.achievements).length>0)out.push("first_trophy_earned");
  }catch(e){}
  return out;
}

/* S10b analytics helpers (Phase 2). */
/* Question-type tally for this session: counts per kind only, never the question or the answer. */
function wbNoteKind(S,kind,correct){
  if(!S||typeof kind!=="string"||!/^[a-z][a-z_]{0,23}$/.test(kind))return;
  const k=S._kinds||(S._kinds={});const t=k[kind]||(k[kind]=[0,0]);t[0]++;if(correct)t[1]++;
}
/* Features this device has ever tried, as letters in a fixed order:
   A pet chosen · C Café · K Kitchen · P Pet Pop · R Rush · S shop purchase · T Time · V Review */
function wbFeatureLetters(){
  const has=new Set();
  try{
    for(const p of SAVE.profiles||[]){
      const modes=new Set((p.shifts||[]).map(x=>x&&x.mode));
      if(modes.has("normal"))has.add("C");if(modes.has("time"))has.add("T");if(modes.has("rush"))has.add("R");if(modes.has("review"))has.add("V");
      if(((p.kitchen||{}).stats||{}).challengesStarted>0)has.add("K");
      try{if(typeof spellingMetric==="function"&&spellingMetric(p,"sessions")>0)has.add("P");}catch(e){}
      const ps=p.petSystem||{};if(ps.activePetId!==null&&ps.activePetId!==undefined)has.add("A");
      if(Array.isArray(p.owned)&&p.owned.length>1)has.add("S");
    }
  }catch(e){}
  return "ACKPRSTV".split("").filter(x=>has.has(x)).join("");
}
