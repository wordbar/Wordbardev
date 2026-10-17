(function(global){
  "use strict";

  const COURSE_IDS_ALLOWED=new Set(["elevenPlus","everyday"]);
  const LETTER_RE=/[A-Z]/;
  const FIXED_RE=/[ '\-’]/;

  function normaliseDisplay(value){
    return String(value==null?"":value).trim().replace(/\s+/g," ");
  }

  function tokensFor(display){
    return Array.from(display.toUpperCase()).map((character,index)=>{
      if(LETTER_RE.test(character))return {kind:"letter",character,index};
      if(FIXED_RE.test(character))return {kind:"fixed",character,index};
      return {kind:"unsupported",character,index};
    });
  }

  function adaptWord(record,courseId){
    if(!COURSE_IDS_ALLOWED.has(courseId))return {ok:false,reason:"unknown-course",record};
    if(!record||typeof record!=="object")return {ok:false,reason:"invalid-record",record};
    const id=normaliseDisplay(record.id||record.w);
    const display=normaliseDisplay(record.w);
    const definition=normaliseDisplay(record.def);
    const tokens=tokensFor(display);
    const unsupported=tokens.filter(token=>token.kind==="unsupported");
    const playable=tokens.filter(token=>token.kind==="letter").map(token=>token.character);
    if(!id||!display)return {ok:false,reason:"missing-id-or-word",record};
    if(!definition)return {ok:false,reason:"missing-definition",record};
    if(unsupported.length)return {ok:false,reason:"unsupported-character",record,unsupported};
    if(playable.length<3)return {ok:false,reason:"fewer-than-three-letters",record};
    return {ok:true,value:Object.freeze({
      id,courseId,display,word:display,definition,
      pronunciation:normaliseDisplay(record.say||display),
      tier:normaliseDisplay(record.t||"easy"),
      tokens:Object.freeze(tokens.map(token=>Object.freeze({...token}))),
      letters:Object.freeze(playable.slice()),
      letterCount:playable.length
    })};
  }

  function validateCourse(courseId){
    if(typeof global.courseDataFor!=="function")throw new Error("WordBar course loader is unavailable");
    const store=global.courseDataFor(courseId);
    const eligible=[],excluded=[],malformed=[];
    const byTier={easy:0,core:0,stretch:0,other:0};
    for(const record of store.words){
      const result=adaptWord(record,courseId);
      if(result.ok){
        eligible.push(result.value);
        const tier=Object.prototype.hasOwnProperty.call(byTier,result.value.tier)?result.value.tier:"other";
        byTier[tier]++;
      }else if(result.reason==="fewer-than-three-letters"){
        excluded.push({id:normaliseDisplay(record&&record.id||record&&record.w),word:normaliseDisplay(record&&record.w),reason:result.reason});
      }else{
        malformed.push({id:normaliseDisplay(record&&record.id||record&&record.w),word:normaliseDisplay(record&&record.w),reason:result.reason});
      }
    }
    return Object.freeze({
      courseId,total:store.words.length,eligible:Object.freeze(eligible),
      eligibleCount:eligible.length,excluded:Object.freeze(excluded),
      excludedCount:excluded.length,malformed:Object.freeze(malformed),
      malformedCount:malformed.length,byTier:Object.freeze(byTier)
    });
  }

  function fullyLoaded(courseId){
    const store=global.courseDataFor(courseId);
    return ["easy","core","stretch"].every(tier=>store.dataStatus[tier]===true);
  }

  function waitForAllTiers(courseId,timeoutMs){
    const started=Date.now(),timeout=Math.max(1000,Number(timeoutMs)||20000);
    return new Promise((resolve,reject)=>{
      const check=()=>{
        if(fullyLoaded(courseId))return resolve();
        const status=typeof global.getCourseLoadStatus==="function"?global.getCourseLoadStatus(courseId):null;
        if(status&&status.state==="error")return reject(new Error(status.error&&status.error.message||"Course load failed"));
        if(Date.now()-started>=timeout)return reject(new Error(`Timed out loading ${courseId}`));
        global.setTimeout(check,40);
      };
      check();
    });
  }

  async function loadAndValidate(courseId,options){
    if(!COURSE_IDS_ALLOWED.has(courseId))throw new Error(`Unknown course: ${courseId}`);
    if(!fullyLoaded(courseId)){
      if(typeof global.loadCourseData!=="function")throw new Error("WordBar course loader is unavailable");
      await global.loadCourseData(courseId,{baseUrl:options&&options.baseUrl});
      await waitForAllTiers(courseId,options&&options.timeoutMs);
    }
    return validateCourse(courseId);
  }

  global.PetPopWordAdapter=Object.freeze({adaptWord,validateCourse,loadAndValidate,tokensFor});
})(window);
