(function(global){
  "use strict";

  const DIFFICULTY_WEIGHTS=Object.freeze({
    junior:Object.freeze({easy:70,core:25,stretch:5,other:5}),
    wordMaster:Object.freeze({easy:20,core:60,stretch:20,other:10}),
    superStar:Object.freeze({easy:10,core:30,stretch:60,other:10}),
    auto:Object.freeze({easy:35,core:45,stretch:20,other:10})
  });
  const PREPARED=new WeakSet();

  function historyFor(history,id){
    if(history instanceof Map)return history.get(id)||null;
    return history&&Object.prototype.hasOwnProperty.call(history,id)?history[id]:null;
  }
  function historyStamp(words,history){
    let hash=2166136261;
    const feed=value=>{for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}};
    for(const word of words){
      const state=historyFor(history,word.id)||{};
      feed(word.id);feed("|");feed(Number(state.plays)||0);feed("|");feed(Number(state.lastWrongTaps)||0);feed("|");feed(Number(state.lastOvertimeCount)||0);feed("|");feed(state.needsPractice===true?1:0);feed("|");feed(Number(state.nextDueAt)||0);feed("|");feed(Number(state.lastPlayedAt)||0);feed(";");
    }
    return (hash>>>0).toString(16).padStart(8,"0");
  }
  function canonicalDifficulty(value){
    const raw=String(value||"auto").toLowerCase().replace(/[\s_-]/g,"");
    if(raw==="junior"||raw==="easy")return "junior";
    if(raw==="wordmaster"||raw==="core"||raw==="normal")return "wordMaster";
    if(raw==="superstar"||raw==="stretch"||raw==="hard")return "superStar";
    return "auto";
  }
  function tierOf(word){return Object.prototype.hasOwnProperty.call(DIFFICULTY_WEIGHTS.auto,word.tier)?word.tier:"other"}
  function weightedPick(candidates,difficulty,random,avoid){
    if(!candidates.length)return null;
    const recent=avoid||new Set();
    const fresh=candidates.filter(word=>!recent.has(word.id));
    const pool=fresh.length?fresh:candidates;
    const weights=DIFFICULTY_WEIGHTS[canonicalDifficulty(difficulty)],byTier={};
    for(const word of pool)(byTier[tierOf(word)]||(byTier[tierOf(word)]=[])).push(word);
    const tiers=Object.keys(byTier),total=tiers.reduce((sum,tier)=>sum+(weights[tier]||1),0);
    let cursor=Math.max(0,Math.min(.999999999,Number(random())||0))*total,chosen=tiers[tiers.length-1];
    for(const tier of tiers){cursor-=weights[tier]||1;if(cursor<0){chosen=tier;break}}
    const group=byTier[chosen];return group[Math.floor(Math.max(0,Math.min(.999999999,Number(random())||0))*group.length)];
  }
  function classify(words,history,now){
    const pools={new:[],weakDue:[],oldRefresh:[]};
    for(const word of words){
      const state=historyFor(history,word.id);
      if(!state||!(Number(state.plays)>0)){pools.new.push(word);continue}
      const weak=state.needsPractice===true||Number(state.lastWrongTaps)>0||Number(state.lastOvertimeCount)>0;
      const due=Number(state.nextDueAt)>0&&Number(state.nextDueAt)<=now;
      (weak||due?pools.weakDue:pools.oldRefresh).push(word);
    }
    pools.weakDue.sort((a,b)=>{
      const as=historyFor(history,a.id)||{},bs=historyFor(history,b.id)||{};
      return (Number(bs.lastWrongTaps||0)+Number(bs.lastOvertimeCount||0))-(Number(as.lastWrongTaps||0)+Number(as.lastOvertimeCount||0))
        ||Number(as.nextDueAt||0)-Number(bs.nextDueAt||0)
        ||Number(as.lastPlayedAt||0)-Number(bs.lastPlayedAt||0);
    });
    pools.oldRefresh.sort((a,b)=>Number((historyFor(history,a.id)||{}).lastPlayedAt||0)-Number((historyFor(history,b.id)||{}).lastPlayedAt||0));
    return pools;
  }
  function prepare(words,courseId,history,now){
    const eligible=(Array.isArray(words)?words:[]).filter(word=>word&&word.letterCount>=3&&(!courseId||word.courseId===courseId));
    const prepared=Object.freeze({words:Object.freeze(eligible.slice()),pools:classify(eligible,history||{},Number(now)||Date.now()),courseId:courseId||null,historyStamp:historyStamp(eligible,history||{})});
    PREPARED.add(prepared);return prepared;
  }
  function selectSession(options){
    const trusted=options&&options.prepared&&PREPARED.has(options.prepared)?options.prepared:null;
    const words=trusted?trusted.words:Array.isArray(options&&options.words)?options.words:[];
    const courseId=options&&options.courseId;
    if(trusted&&courseId&&trusted.courseId&&trusted.courseId!==courseId)throw new Error("Prepared Pet Pop pool belongs to another course");
    if(trusted&&trusted.historyStamp!==historyStamp(trusted.words,options&&options.history||{})){
      const error=new Error("Prepared Pet Pop pools are stale; prepare again after history changes");error.code="STALE_PET_POP_POOLS";throw error;
    }
    const eligible=trusted?trusted.words:words.filter(word=>word&&word.letterCount>=3&&(!courseId||word.courseId===courseId));
    if(eligible.length<3)throw new Error("Pet Pop needs at least three eligible words");
    const random=typeof options.random==="function"?options.random:Math.random;
    const recent=new Set((options.recentWordIds||[]).slice(-9));
    const picked=new Set(),selected=[],sources=[];
    const pools=trusted?trusted.pools:classify(eligible,options.history||{},Number(options.now)||Date.now());
    const choose=(pool,source)=>{
      const available=pool.filter(word=>!picked.has(word.id));
      const word=weightedPick(available,options.difficulty,random,recent);
      if(!word)return false;picked.add(word.id);selected.push(word);sources.push(source);return true;
    };
    const chooseReturning=()=>{
      if(pools.weakDue.some(word=>!picked.has(word.id))&&pools.oldRefresh.some(word=>!picked.has(word.id))){
        return random()<.80?choose(pools.weakDue,"weak/due"):choose(pools.oldRefresh,"old-refresh");
      }
      return choose(pools.weakDue,"weak/due")||choose(pools.oldRefresh,"old-refresh");
    };
    const chooseAny=()=>choose(pools.new,"new")||chooseReturning();

    if(pools.new.length&&pools.weakDue.length+pools.oldRefresh.length){
      choose(pools.new,"new");choose(pools.new,"new");chooseReturning();
    }else if(pools.new.length){
      choose(pools.new,"new");choose(pools.new,"new");choose(pools.new,"new");
    }else{
      chooseReturning();chooseReturning();chooseReturning();
    }
    while(selected.length<3&&chooseAny()){}
    if(selected.length!==3)throw new Error("Pet Pop scheduler could not form a unique three-word session");
    return Object.freeze({
      words:Object.freeze(selected.slice()),sources:Object.freeze(sources.slice()),
      counts:Object.freeze({new:pools.new.length,weakDue:pools.weakDue.length,oldRefresh:pools.oldRefresh.length}),
      difficulty:canonicalDifficulty(options&&options.difficulty)
    });
  }

  global.PetPopScheduler=Object.freeze({DIFFICULTY_WEIGHTS,canonicalDifficulty,historyStamp,classify,prepare,weightedPick,selectSession});
})(window);
