/* ============================================================
   WORDBAR V3 PERSISTENCE
   Durable, verified localStorage writes for the versioned save.
   The legacy wordbar_save key is captured for migration and is
   deliberately never written by this module.
   ============================================================ */
"use strict";

const WORDBAR_SAVE_SCHEMA_VERSION=3;
const WORDBAR_SAVE_KEYS=Object.freeze({
  legacy:"wordbar_save",
  current:"wordbar_save_v3",
  preImport:"wordbar_backup_pre_import_v3",
  preDelete:"wordbar_backup_pre_delete_v3"
});
const WORDBAR_KNOWN_COURSES=Object.freeze(["elevenPlus","everyday"]);

function cloneSaveValue(value){return JSON.parse(JSON.stringify(value));}
function saveByteLength(text){
  text=String(text||"");
  return typeof TextEncoder!=="undefined"?new TextEncoder().encode(text).length:text.length;
}
function saveError(code,message,cause){
  const error=new Error(message);error.code=code;
  if(cause!==undefined)error.cause=cause;
  return error;
}

function validateV3SaveRoot(root,{catalogs=false}={}){
  if(!root||typeof root!=="object"||Array.isArray(root))throw saveError("INVALID_SAVE","Save root is not an object");
  if(root.schemaVersion!==WORDBAR_SAVE_SCHEMA_VERSION)throw saveError("INVALID_SCHEMA","Save schema is not v3");
  if(!Array.isArray(root.profiles)||root.profiles.length>12)throw saveError("INVALID_PROFILES","Save profiles are invalid");
  if(!Number.isInteger(root.active))throw saveError("INVALID_ACTIVE","Active profile index is invalid");
  if(root.profiles.length===0&&root.active!==-1)throw saveError("INVALID_ACTIVE","An empty save must have no active profile");
  if(root.profiles.length>0&&(root.active< -1||root.active>=root.profiles.length))throw saveError("INVALID_ACTIVE","Active profile index is out of range");
  root.profiles.forEach((profile,index)=>{
    if(!profile||typeof profile!=="object"||Array.isArray(profile))throw saveError("INVALID_PROFILE",`Profile ${index+1} is invalid`);
    if(!WORDBAR_KNOWN_COURSES.includes(profile.courseId))throw saveError("INVALID_COURSE",`Profile ${index+1} has an unknown course`);
    for(const key of ["shifts","rushScores"]){
      if(profile[key]!==undefined&&!Array.isArray(profile[key]))throw saveError("INVALID_SESSIONS",`Profile ${index+1} has invalid ${key}`);
      (profile[key]||[]).forEach(session=>{
        if(!session||typeof session!=="object"||session.courseId!==profile.courseId){
          throw saveError("CROSS_COURSE_SESSION",`Profile ${index+1} contains a session from another course`);
        }
      });
    }
    if(catalogs&&typeof courseCatalogHasWord==="function"){
      const customIds=new Set(Array.isArray(profile.custom)?profile.custom.map(x=>x&&x.id).filter(Boolean):[]);
      for(const wordId of Object.keys(profile.words&&typeof profile.words==="object"?profile.words:{})){
        if(!customIds.has(wordId)&&!courseCatalogHasWord(profile.courseId,wordId)){
          throw saveError("CROSS_COURSE_WORD",`Profile ${index+1} contains a word outside its course: ${wordId}`);
        }
      }
      for(const wordId of Array.isArray(profile.hidden)?profile.hidden:[]){
        if(!courseCatalogHasWord(profile.courseId,wordId)){
          throw saveError("CROSS_COURSE_WORD",`Profile ${index+1} hides a word outside its course: ${wordId}`);
        }
      }
      const spelling=profile.spellingGame;
      if(spelling!==undefined){
        if(!spelling||typeof spelling!=="object"||Array.isArray(spelling)||![1,2].includes(spelling.version)||!spelling.courses||typeof spelling.courses!=="object"){
          throw saveError("INVALID_SPELLING_GAME",`Profile ${index+1} has invalid spelling progress`);
        }
        if(spelling.version>=2&&(spelling.trophies===undefined||!spelling.trophies||typeof spelling.trophies!=="object"||Array.isArray(spelling.trophies))){
          throw saveError("INVALID_SPELLING_GAME",`Profile ${index+1} has invalid spelling trophies`);
        }
        for(const courseId of WORDBAR_KNOWN_COURSES){
          const course=spelling.courses[courseId];
          if(!course||typeof course!=="object"||Array.isArray(course)||!course.words||typeof course.words!=="object"||Array.isArray(course.words)){
            throw saveError("INVALID_SPELLING_GAME",`Profile ${index+1} has invalid ${courseId} spelling progress`);
          }
          const ids=[...Object.keys(course.words),...(Array.isArray(course.uniqueWords)?course.uniqueWords:[]),...(Array.isArray(course.recentWordIds)?course.recentWordIds:[])];
          for(const wordId of ids){
            if(typeof wordId!=="string"||!courseCatalogHasWord(courseId,wordId))throw saveError("CROSS_COURSE_SPELLING_WORD",`Profile ${index+1} contains spelling progress outside ${courseId}: ${wordId}`);
          }
          for(const key of ["completedOutcomeKeys","completedSessionKeys","rewardedSessionKeys"]){
            if(course[key]!==undefined&&!Array.isArray(course[key]))throw saveError("INVALID_SPELLING_GAME",`Profile ${index+1} has invalid ${key}`);
          }
        }
      }
    }
  });
  return true;
}

const WordBarPersistence=(()=>{
  let storage=null,persistent=false,memorySave=null,authority="blocked",lastError=null;
  try{
    storage=localStorage;
    const probe="__wordbar_v3_probe__";
    storage.setItem(probe,"1");storage.removeItem(probe);persistent=true;
  }catch(error){lastError=saveError("STORAGE_UNAVAILABLE","Persistent browser storage is unavailable",error);}

  const readRaw=key=>{
    if(!persistent)return {ok:false,value:null,error:lastError||saveError("STORAGE_UNAVAILABLE","Persistent browser storage is unavailable")};
    try{return {ok:true,value:storage.getItem(key),error:null};}
    catch(error){return {ok:false,value:null,error:saveError("READ_FAILED",`Could not read ${key}`,error)};}
  };
  const parseRaw=(raw,label)=>{
    try{return JSON.parse(raw);}catch(error){throw saveError("PARSE_FAILED",`${label} is not valid JSON`,error);}
  };
  const writeRawVerified=(key,serialized,verify)=>{
    if(!persistent)return {ok:false,error:lastError||saveError("STORAGE_UNAVAILABLE","Persistent browser storage is unavailable")};
    try{
      storage.setItem(key,serialized);
      const readBack=storage.getItem(key);
      if(readBack===null)throw saveError("READBACK_MISSING",`${key} was missing after write`);
      if(readBack!==serialized)throw saveError("READBACK_MISMATCH",`${key} changed during write/read-back`);
      const parsed=parseRaw(readBack,key);
      if(verify)verify(parsed);
      return {ok:true,value:parsed,bytes:saveByteLength(serialized),error:null};
    }catch(error){
      return {ok:false,error:error&&error.code?error:saveError("WRITE_FAILED",`Could not persist ${key}`,error)};
    }
  };
  const writeJsonVerified=(key,value,verify)=>{
    let serialized;
    try{serialized=JSON.stringify(value);}catch(error){return {ok:false,error:saveError("SERIALIZE_FAILED",`Could not serialize ${key}`,error)};}
    return writeRawVerified(key,serialized,verify);
  };
  /* Build 86g-phase8: gameplay saves run at answer cadence, so this path is
     on the main thread once per answered question. The caller's pre-flight
     validateV3SaveRoot(candidate,{catalogs:true}) already proves the value is
     structurally valid and course-clean BEFORE the live key is touched, and
     the byte-exact read-back below proves storage holds exactly those bytes.
     Re-parsing that identical string and re-running the same deep validation
     a second time therefore adds no guarantee, only main-thread time and
     allocation churn (measured ~60% of persist cost on a mature save).
     Boot migration, imports and protective backups keep the full
     parse-and-revalidate path via writeJsonVerified. */
  const writeJsonReadBack=(key,value)=>{
    if(!persistent)return {ok:false,error:lastError||saveError("STORAGE_UNAVAILABLE","Persistent browser storage is unavailable")};
    let serialized;
    try{serialized=JSON.stringify(value);}catch(error){return {ok:false,error:saveError("SERIALIZE_FAILED",`Could not serialize ${key}`,error)};}
    try{
      storage.setItem(key,serialized);
      const readBack=storage.getItem(key);
      if(readBack===null)throw saveError("READBACK_MISSING",`${key} was missing after write`);
      if(readBack!==serialized)throw saveError("READBACK_MISMATCH",`${key} changed during write/read-back`);
      return {ok:true,value,bytes:serialized.length,error:null};
    }catch(error){
      return {ok:false,error:error&&error.code?error:saveError("WRITE_FAILED",`Could not persist ${key}`,error)};
    }
  };

  const v3Read=readRaw(WORDBAR_SAVE_KEYS.current);
  const legacyRead=readRaw(WORDBAR_SAVE_KEYS.legacy);
  const captured={v3Raw:v3Read.ok?v3Read.value:null,legacyRaw:legacyRead.ok?legacyRead.value:null};
  let initialSave=null;

  if(!persistent){
    authority="memory";
    initialSave={schemaVersion:WORDBAR_SAVE_SCHEMA_VERSION,profiles:[],active:-1};
    memorySave=cloneSaveValue(initialSave);
  }else if(v3Read.value!==null){
    try{
      initialSave=parseRaw(v3Read.value,WORDBAR_SAVE_KEYS.current);
      validateV3SaveRoot(initialSave,{catalogs:true});
      authority="v3";
    }catch(error){
      lastError=error;
      if(legacyRead.value!==null){
        try{
          initialSave=parseRaw(legacyRead.value,WORDBAR_SAVE_KEYS.legacy);
          if(!initialSave||typeof initialSave!=="object"||Array.isArray(initialSave)||!Array.isArray(initialSave.profiles)){
            throw saveError("INVALID_LEGACY_SAVE","The legacy save has an invalid structure");
          }
          authority="legacy-pending";
        }catch(legacyError){authority="blocked";lastError=legacyError;}
      }else authority="blocked";
    }
  }else if(legacyRead.value!==null){
    try{
      initialSave=parseRaw(legacyRead.value,WORDBAR_SAVE_KEYS.legacy);
      if(!initialSave||typeof initialSave!=="object"||Array.isArray(initialSave)||!Array.isArray(initialSave.profiles)){
        throw saveError("INVALID_LEGACY_SAVE","The legacy save has an invalid structure");
      }
      authority="legacy-pending";
    }catch(error){authority="blocked";lastError=error;}
  }else{
    initialSave={profiles:[],active:-1};authority="legacy-pending";
  }

  function commitCurrent(candidate){
    if(authority==="memory"){
      try{validateV3SaveRoot(candidate,{catalogs:true});}
      catch(error){lastError=error;return {ok:false,error};}
      memorySave=cloneSaveValue(candidate);lastError=null;
      return {ok:true,value:cloneSaveValue(memorySave),bytes:saveByteLength(JSON.stringify(candidate)),memoryOnly:true};
    }
    /* Validate before touching the live key. Post-write validation below still
       protects against storage/read-back corruption, while this preflight stops
       a known-invalid candidate from overwriting the last good v3 save. */
    try{validateV3SaveRoot(candidate,{catalogs:true});}
    catch(error){lastError=error;return {ok:false,error};}
    const result=writeJsonVerified(WORDBAR_SAVE_KEYS.current,candidate,value=>validateV3SaveRoot(value,{catalogs:true}));
    if(result.ok){authority="v3";lastError=null;}
    else lastError=result.error;
    return result;
  }
  function persistLive(candidate){
    if(authority!=="v3"&&authority!=="memory")return {ok:false,error:saveError("NO_V3_AUTHORITY","The v3 save is not authoritative")};
    /* Pre-flight validation is unchanged and still blocks a bad candidate
       before the live key is touched — only the redundant post-write
       re-parse/re-validate is skipped. See writeJsonReadBack. */
    try{validateV3SaveRoot(candidate,{catalogs:true});}
    catch(error){lastError=error;return {ok:false,error};}
    if(authority==="memory"){
      memorySave=cloneSaveValue(candidate);lastError=null;
      return {ok:true,value:candidate,bytes:0,memoryOnly:true};
    }
    const result=writeJsonReadBack(WORDBAR_SAVE_KEYS.current,candidate);
    if(result.ok)lastError=null;else lastError=result.error;
    return result;
  }
  function backup(key,candidate){
    if(authority==="memory")return {ok:false,error:saveError("BACKUP_NOT_DURABLE","A protective backup cannot be persisted in preview mode")};
    try{validateV3SaveRoot(candidate,{catalogs:true});}
    catch(error){lastError=error;return {ok:false,error};}
    return writeJsonVerified(key,candidate,value=>validateV3SaveRoot(value,{catalogs:true}));
  }
  function setInitialSave(candidate){initialSave=candidate;}
  function markBlocked(error){authority="blocked";lastError=error;}

  return {
    get persistent(){return persistent;},get authority(){return authority;},get lastError(){return lastError;},
    captured,readRaw,writeRawVerified,writeJsonVerified,commitCurrent,persistLive,backup,
    getInitialSave(){return initialSave?cloneSaveValue(initialSave):null;},setInitialSave,markBlocked
  };
})();
