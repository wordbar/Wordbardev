(function(global){
  "use strict";

  const SPEEDS=Object.freeze({
    quick:Object.freeze({name:"Quick",rise:120,hold:924,hide:120}),
    normal:Object.freeze({name:"Normal",rise:170,hold:1155,hide:165}),
    leisurely:Object.freeze({name:"Leisurely",rise:235,hold:1386,hide:220})
  });
  /* How long a tapped pet holds its happy/sad reaction before leaving.
     Applies equally to correct and wrong taps. */
  const REACTION_HOLD_MS=780;
  /* Ceiling on the word-intro card. POP! still works at any time; this
     only stops a child stalling on the card indefinitely. */
  const WORD_INTRO_MAX_MS=15000;
  const ROUNDS=Object.freeze([
    Object.freeze({name:"LEARN & POP",icon:"①",prompt:"First letter → next letter",visible:true}),
    Object.freeze({name:"IN ORDER",icon:"②",prompt:"Plain word — first to last",visible:true}),
    Object.freeze({name:"MEMORY POP",icon:"③",prompt:"From memory — first to last",visible:false})
  ]);
  const SCENES=Object.freeze([
    Object.freeze({id:"sunny",name:"Sunny Corner",offsets:[0,6,-2,4,5,-4,7,0,-3,6,1,-5]}),
    Object.freeze({id:"blossom",name:"Blossom Patio",offsets:[5,-3,4,0,-5,6,1,7,3,-4,6,0]}),
    Object.freeze({id:"pumpkin",name:"Pumpkin Playtime",offsets:[-3,5,1,7,6,0,-5,3,4,-4,2,6]}),
    Object.freeze({id:"winter",name:"Winter Play Corner",offsets:[6,1,-4,5,0,7,3,-5,-2,4,6,1]}),
    Object.freeze({id:"kyoto",name:"Kyoto Garden",offsets:[1,7,-3,4,-4,2,6,0,5,-2,3,-5]}),
    Object.freeze({id:"park",name:"Park Picnic",offsets:[-4,3,7,0,5,-2,1,6,2,-5,4,0]}),
    Object.freeze({id:"beach",name:"Sandy Beach",offsets:[4,-2,6,1,-5,3,0,7,5,-3,2,-4]}),
    Object.freeze({id:"pond",name:"Lily Pond",offsets:[-2,5,0,6,3,-4,7,1,-5,4,2,0]}),
    Object.freeze({id:"orchard",name:"Autumn Orchard",offsets:[5,0,-4,3,7,-2,4,-5,1,6,-3,2]}),
    Object.freeze({id:"night",name:"Night Garden",offsets:[0,-4,4,7,-3,5,1,-4,6,2,-2,3]})
  ]);
  const VALID_PHASES=new Set(["idle","intro","wordIntro","countdown","active","overtime","roundComplete","roundTransition","wordComplete","results","paused","destroyed"]);
  const THEME_IDS=new Set(["sunny","spring","halloween","christmas","kyoto","foodtruck"]);

  const SPEECH_WATCHDOG_MS=12000; // no single word takes this long; resume play if speech never settles
  class TimerBag{
    constructor(){this.ids=new Set()}
    set(fn,ms){
      const id=global.setTimeout(()=>{this.ids.delete(id);fn()},Math.max(0,ms));
      this.ids.add(id);return id;
    }
    clear(){for(const id of this.ids)global.clearTimeout(id);this.ids.clear()}
    get size(){return this.ids.size}
  }

  function shuffled(values,random){
    const copy=values.slice();
    for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}
    return copy;
  }
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
  function spellingMetadata(display){
    const runtime=global.WordBarSpellingRuntime;
    if(runtime&&typeof runtime.describe==="function")try{return runtime.describe(display)}catch(error){}
    return null;
  }
  function wordWithSpelling(word){return {...word,spelling:spellingMetadata(word&&word.display)}}
  function spellingChunkInfo(value,segmenter=global.WordBarSpellingRuntime||global.WordBarSegments){
    const model=value&&typeof value==="object"?value:null,display=model?model.display:value;
    const word=String(display==null?"":display).trim();
    if(!word||!/^[A-Za-z]+$/.test(word)||!segmenter||typeof segmenter.segmentForGame!=="function")return {word,chunks:[word],doubleRanges:[],chunksShown:false,showChunkStyle:false};
    let chunks=model&&model.spelling?Array.from(model.spelling.chunks||[]):[],doubleRanges=model&&model.spelling?Array.from(model.spelling.doubleRanges||[]):[];
    try{
      if(!(model&&model.spelling)){chunks=segmenter.segmentForGame(word);doubleRanges=typeof segmenter.doubleLetterRanges==="function"?segmenter.doubleLetterRanges(word):[];}
    }catch(error){chunks=[];doubleRanges=[];}
    if(!Array.isArray(chunks)||!chunks.length||chunks.join("").toLowerCase()!==word.toLowerCase())chunks=[word];
    return {word,chunks:chunks.slice(),doubleRanges:Array.isArray(doubleRanges)?doubleRanges.slice():[],chunksShown:chunks.length>1,showChunkStyle:true};
  }
  function spellingTargetHtml(info){
    if(!info||!info.word)return "";
    let offset=0;
    const letters=chunk=>Array.from(chunk).map((letter,index)=>{
      const position=offset+index,doubled=info.doubleRanges.some(range=>position>=range.start&&position<range.end);
      return `<span class="pp-target-letter${doubled?" pp-double-letter":""}">${escapeHtml(letter)}</span>`;
    }).join("");
    if(!info.showChunkStyle)return `<span class="pp-target-plain" aria-hidden="true">${letters(info.word)}</span>`;
    return info.chunks.map((chunk,index)=>{
      const html=letters(chunk);offset+=Array.from(chunk).length;
      return `<span class="pp-target-chunk pp-chunk-${index%4}" aria-hidden="true">${html}</span>`;
    }).join("");
  }
  function letterTime(count){return count<=5?25:count<=8?30:count<=12?35:40}
  function memoryFlashTime(count){return Math.min(3500,2000+Math.max(0,count-8)*120)}
  function confusionLetters(letter,word){
    const map={A:"EO",E:"AI",I:"EY",O:"AU",U:"OA",C:"SK",S:"CZ",K:"CG",M:"N",N:"M",T:"D",D:"T",Y:"IE",G:"J",J:"G",F:"V",V:"F"};
    const result=Array.from(map[letter]||"");
    const spelling=String(word||"").toUpperCase();
    if(/IE|EI/.test(spelling))result.push("I","E");
    if(/ANCE|ENCE/.test(spelling))result.push("A","E");
    if(/ABLE|IBLE/.test(spelling))result.push("A","I");
    if(/TION|SION/.test(spelling))result.push("T","S");
    if(/OUR|OR/.test(spelling))result.push("U","O");
    return [...new Set(result.filter(value=>value!==letter))];
  }
  function timingFor(profile,waveCount,gold,overtime,correct){
    const factor=overtime?1.15:1,extra=waveCount===4?150:0,goldExtra=gold?180:0;
    return Object.freeze({
      rise:Math.round(profile.rise*factor),
      hold:Math.round((Math.max(correct?1100:0,profile.hold)+extra+goldExtra)*factor),
      hide:Math.round(profile.hide*factor)
    });
  }
  function speedForRoll(roll){return roll<.20?SPEEDS.quick:roll<.75?SPEEDS.normal:SPEEDS.leisurely}
  function petCountForRoll(roll){return roll<.15?1:roll<.50?2:roll<.85?3:4}
  function shouldIncludeTarget(wavesWithoutTarget,overtime,roll){return (overtime?wavesWithoutTarget>=1:wavesWithoutTarget>=2)||roll<.62}
  function scoreForPop(gold,fever){return (gold?35:10)*(fever?2:1)}
  function subtractTime(remaining,seconds=2){return Math.max(0,(Number(remaining)||0)-Math.max(0,Number(seconds)||0))}

  class PetPopController{
    constructor(options){
      this.options=options||{};
      this.root=this.options.root;
      this.words=(this.options.words||[]).slice(0,3).map(wordWithSpelling);
      this.pets=(this.options.pets||global.PETS||[]).slice();
      this.renderPet=this.options.renderPet||global.petSVG;
      this.random=this.options.random||Math.random;
      this.qaMode=!!this.options.qaMode;
      this.scale=this.qaMode?Math.max(.01,Number(this.options.qaTimeScale)||1):1;
      this.phaseTimers=new TimerBag();this.waveTimers=new TimerBag();this.clockTimers=new TimerBag();
      this.phase="idle";this.beforePause=null;this.destroyed=false;this.listeners=[];
      this.wordIndex=0;this.roundIndex=0;this.score=0;this.combo=0;this.bestCombo=0;
      this.feverActive=false;this.feverCount=0;this.feverToken=0;
      this.roundRemaining=0;this.roundEndAt=0;this.overtime=false;this.roundLive=false;
      this.speechPauseStartedAt=0;this.speechRequest=0;this.speechActive=0;this.speechWatchdog=0;
      this.memoryFlashActive=false;this.pendingRoundInTime=false;
      this.filled=[];this.justFilled=-1;this.waveOpen=false;this.waveNumber=0;this.wavesWithoutTarget=0;
      this.lastHoles=new Set();this.lastPets=new Set();this.waveNodes=[];this.results=[];
      this.sceneOrder=[];this.scene=null;this.wordWrongTaps=0;this.wordOvertimeCount=0;this.roundWrongTaps=[0,0,0];this.round1ChunksShown=false;
      this.sessionKey=String(this.options.sessionKey||`qa-${Date.now()}`);this.selectedPetId=this.options.selectedPetId||null;this.selectedPetPending=!!this.selectedPetId;
      this.petsSeen=new Set();
      this.soundOn=this.options.soundOn!==false;this.audioContext=null;this.eventLog=[];
      this.theme=THEME_IDS.has(this.options.theme)?this.options.theme:"sunny";
    }

    emit(type,detail){
      const event={type,phase:this.phase,at:Date.now(),...(detail||{})};
      this.eventLog.push(event);if(this.eventLog.length>300)this.eventLog.shift();
      return typeof this.options.onEvent==="function"?this.options.onEvent(event):undefined;
    }
    setPhase(next){if(!VALID_PHASES.has(next))throw new Error(`Invalid phase: ${next}`);this.phase=next;this.paintExitButton();this.emit("phase",{next})}
    /* S9b: ⏸️ during play (opens the pause sheet), ✕ on the start and results screens (leaves). */
    paintExitButton(){const x=this.root&&this.root.querySelector&&this.root.querySelector(".pp-exit");if(!x||typeof this.options.onPauseRequest!=="function"||this.phase==="paused")return;const play=!["idle","intro","results"].includes(this.phase);x.textContent=play?"⏸️":"✕";x.setAttribute("aria-label",play?"Pause Pet Pop":"Exit Pet Pop");}
    scaled(ms){return Math.max(0,Math.round(ms*this.scale))}
    /* S9c: the Sound effects switch is read live (options.soundOn may be a
       function), so turning it ON in the pause sheet works straight away. */
    isSoundOn(){const v=this.options.soundOn;return typeof v==="function"?v()!==false:this.soundOn}
    playSound(name,extra){if(this.isSoundOn()&&typeof this.options.playSound==="function")this.options.playSound(name,extra||{})}
    praise(){if(this.isSoundOn()&&typeof this.options.praise==="function")this.options.praise()}

    start(){
      if(!this.root)throw new Error("PetPop.start requires a root element");
      if(this.words.length!==3)throw new Error("Phase 1 Pet Pop requires exactly three fixture/course words");
      if(!this.pets.length||typeof this.renderPet!=="function")throw new Error("WordBar pet artwork is unavailable");
      this.renderShell();this.bind();this.prepareScenes();this.setPhase("intro");this.showStart();return this;
    }

    renderShell(){
      this.root.className=`pet-pop-root pp-theme-${this.theme}${this.options.reducedMotion?" pp-reduced-motion":""}`;
      this.root.innerHTML=`
        <header class="pp-top"><div class="pp-brand">WORD BAR</div><div class="pp-score" aria-live="polite">SCORE <span>0</span></div><div class="pp-word-count">WORD 1 / 3</div></header>
        <section class="pp-hud"><div class="pp-hud-row"><span class="pp-round">① LEARN &amp; POP</span><span class="pp-prompt">First letter → next letter</span></div><div class="pp-time"><span class="pp-time-value">20</span><div class="pp-time-track" role="progressbar" aria-label="Round time"><div class="pp-time-fill"></div></div></div></section>
        <section class="pp-word-panel"><p class="pp-definition" lang="en-GB"></p><div class="pp-target" lang="en-GB"></div><div class="pp-slots" lang="en-GB"></div></section>
        <section class="pp-field" aria-label="Twelve pet holes"></section>
        <footer class="pp-footer"><span>COMBO <b class="pp-combo">0</b></span><button class="pp-hear" data-pp-action="hear" type="button" aria-label="Hear the current word again">🔊 Hear word</button></footer>
        <div class="pp-fever" role="status" aria-live="polite">🔥 PET POP FEVER! ×2</div><div class="pp-overlay"><section class="pp-card" role="dialog" aria-modal="true"></section></div><div class="pp-toast" role="status" aria-live="polite"></div>${typeof this.options.onExit!=="function"?"":typeof this.options.onPauseRequest==="function"?'<button class="pp-exit" data-pp-action="exit" type="button" aria-label="Pause Pet Pop">⏸️</button>':'<button class="pp-exit" data-pp-action="exit" type="button" aria-label="Exit Pet Pop">✕</button>'}`;
      this.els={
        score:this.root.querySelector(".pp-score span"),wordCount:this.root.querySelector(".pp-word-count"),round:this.root.querySelector(".pp-round"),prompt:this.root.querySelector(".pp-prompt"),
        time:this.root.querySelector(".pp-time-value"),fill:this.root.querySelector(".pp-time-fill"),definition:this.root.querySelector(".pp-definition"),target:this.root.querySelector(".pp-target"),slots:this.root.querySelector(".pp-slots"),
        field:this.root.querySelector(".pp-field"),combo:this.root.querySelector(".pp-combo"),overlay:this.root.querySelector(".pp-overlay"),card:this.root.querySelector(".pp-card"),toast:this.root.querySelector(".pp-toast"),fever:this.root.querySelector(".pp-fever"),timeTrack:this.root.querySelector(".pp-time-track")
      };
      for(let index=0;index<12;index++){
        const hole=document.createElement("div");hole.className="pp-hole";hole.dataset.hole=String(index);this.els.field.appendChild(hole);
      }
      this.holes=Array.from(this.els.field.querySelectorAll(".pp-hole"));
    }

    bind(){
      const click=event=>{
        const action=event.target.closest("[data-pp-action]");
        if(action){this.handleAction(action.dataset.ppAction);return}
        const pet=event.target.closest(".pp-pet");if(pet)this.hitPet(pet);
      };
      const visibility=()=>{if(document.hidden)this.pause("background");else this.resume("background")};
      this.root.addEventListener("click",click);document.addEventListener("visibilitychange",visibility);
      this.listeners.push(()=>this.root.removeEventListener("click",click),()=>document.removeEventListener("visibilitychange",visibility));
    }

    showOverlay(html){this.els.card.innerHTML=html;this.els.overlay.classList.remove("hidden")}
    hideOverlay(){this.els.overlay.classList.add("hidden")}
    showStart(){
      this.showOverlay(`<p>${escapeHtml(this.options.courseName||"Spelling game")}</p><h1>Pet Pop Spelling</h1><p>The café pets are bored. Play three spelling words with them!</p><div class="pp-rules"><b>How to play</b><span class="pp-order-rule">⭐ Every round is in spelling order: start with the first letter, then pop the next letter.</span><span>① <strong>Learn &amp; Pop</strong> — follow the coloured chunks from left to right</span><span>② <strong>In Order</strong> — follow the plain word from first letter to last</span><span>③ <strong>Memory Pop</strong> — the word hides; recall it from first letter to last</span><span class="pp-penalty">Wrong pet? The timer loses 2 seconds.</span></div><button data-pp-action="start">Start popping!</button>`);
    }
    rotateSessionKey(){this.sessionKey=String(typeof this.options.makeSessionKey==="function"?this.options.makeSessionKey():`qa-${Date.now()}-${Math.floor(this.random()*1000000)}`)}
    handleAction(action){
      if(action==="start"){this.playSound("tap");this.wordIndex=0;this.roundIndex=0;this.score=0;this.combo=0;this.bestCombo=0;this.feverCount=0;this.feverToken=0;this.clearFever();this.results=[];this.petsSeen.clear();this.selectedPetPending=!!this.selectedPetId;this.prepareScenes();this.paintScore();this.emit("session-start",{sessionKey:this.sessionKey});this.showWordIntro()}
      else if(action==="begin"){this.playSound("tap");this.runCountdown()}
      else if(action==="next-round"&&this.phase==="roundTransition"){this.playSound("tap");this.advanceAfterRound()}
      else if(action==="next"){this.playSound("tap");if(this.wordIndex<2){this.wordIndex++;this.showWordIntro()}else this.finishGame()}
      else if(action==="replay"){this.rotateSessionKey();this.handleAction("start")}
      else if(action==="new"){this.playSound("tap");this.requestNewWords()}
      else if(action==="hear")this.speak();
      else if(action==="trophies"&&typeof this.options.onTrophies==="function"){const open=this.options.onTrophies;this.destroy();open()}
      /* S9b: during a game the ⏸️ button opens WordBar's shared pause sheet; from the
         start and results screens it still leaves straight away. */
      else if(action==="exit"&&typeof this.options.onPauseRequest==="function"&&!["idle","intro","results"].includes(this.phase)){this.options.onPauseRequest();return}
      else if(action==="exit"||(action==="finish"&&typeof this.options.onExit==="function")){const done=this.options.onExit;this.destroy();if(typeof done==="function")done()}
      else if(action==="finish"){this.setPhase("intro");this.showStart()}
    }
    current(){return this.words[this.wordIndex]}
    prepareScenes(){this.sceneOrder=shuffled(SCENES,this.random).slice(0,3)}
    applyScene(){
      this.scene=this.sceneOrder[this.wordIndex]||SCENES[this.wordIndex%SCENES.length];
      for(const value of SCENES)this.root.classList.remove(`scene-${value.id}`);
      this.root.classList.add(`scene-${this.scene.id}`);
      this.holes.forEach((hole,index)=>{hole.style.top=`${this.scene.offsets[index]||0}px`;hole.style.transform="none"});
      this.emit("scene",{sceneId:this.scene.id,sceneName:this.scene.name,wordId:this.current().id});
    }
    showWordIntro(){
      this.stopRound();this.clearFever();this.roundIndex=0;this.memoryFlashActive=false;this.wordWrongTaps=0;this.wordOvertimeCount=0;this.roundWrongTaps=[0,0,0];this.round1ChunksShown=false;this.setPhase("wordIntro");const word=this.current();this.applyScene();
      this.showOverlay(`<p>Word ${this.wordIndex+1} of 3</p><h2 lang="en-GB">${escapeHtml(word.display)}</h2><p class="pp-card-definition" lang="en-GB">${escapeHtml(word.definition)}</p><button class="secondary" data-pp-action="hear">🔊 Hear word</button><button data-pp-action="begin">POP!</button><p class="pp-introtimer" aria-live="off">Starting in <b>${Math.round(WORD_INTRO_MAX_MS/1000)}</b>…</p>`);
      this.els.wordCount.textContent=`WORD ${this.wordIndex+1} / 3`;
      /* Reading window: the child can tap POP! at any moment. If the card is
         left untouched it starts on its own, with a visible count so the
         child can see it coming rather than being surprised. */
      let left=Math.round(WORD_INTRO_MAX_MS/1000);
      const tick=()=>{
        if(this.phase!=="wordIntro"||this.destroyed)return;
        left--;
        const slot=this.els.card&&this.els.card.querySelector(".pp-introtimer b");
        if(slot)slot.textContent=String(Math.max(0,left));
        if(left<=0){this.runCountdown();return}
        this.phaseTimers.set(tick,this.scaled(1000));
      };
      this.phaseTimers.set(tick,this.scaled(1000));
    }
    runCountdown(){
      this.stopRound();this.setPhase("countdown");this.showOverlay("");let count=3;
      const paint=()=>{this.els.card.innerHTML=`<div class="pp-countdown">${count>0?count:"POP!"}</div>`};
      const step=()=>{paint();if(count===0){this.phaseTimers.set(()=>{this.hideOverlay();this.startRound()},this.scaled(650));return}count--;this.phaseTimers.set(step,this.scaled(650))};
      step();
    }

    startRound(){
      this.stopRound();const word=this.current(),round=ROUNDS[this.roundIndex];
      this.roundLive=false;this.overtime=false;this.filled=Array(word.letters.length).fill("");this.waveNumber=0;this.wavesWithoutTarget=0;
      this.lastHoles.clear();this.lastPets.clear();this.root.classList.remove("overtime");
      this.els.round.textContent=`${round.icon} ${round.name}`;this.els.prompt.textContent=round.prompt;this.els.definition.textContent=word.definition;
      const chunksShown=this.renderTarget();if(this.roundIndex===0)this.round1ChunksShown=chunksShown;
      this.els.target.classList.toggle("hidden",!round.visible);this.renderSlots();
      this.roundRemaining=letterTime(word.letterCount);this.paintTime();
      if(this.roundIndex===2){
        this.memoryFlashActive=true;this.setPhase("wordIntro");this.showOverlay(`<p>Remember this spelling</p><p class="pp-card-definition" lang="en-GB">${escapeHtml(word.definition)}</p><div class="pp-flash" lang="en-GB">${escapeHtml(word.display)}</div>`);
        this.phaseTimers.set(()=>{this.memoryFlashActive=false;this.hideOverlay();this.activateRound()},this.scaled(memoryFlashTime(word.letterCount)));
      }else this.activateRound();
    }
    activateRound(){
      const hidden=this.roundIndex===2;
      this.els.target.classList.toggle("hidden",hidden);
      /* Visibility alone does not hide text from every screen reader. Round 3
         is a real memory pass, so do not leak the answer through accessibility
         APIs while the spelling is visually hidden. */
      if(hidden){this.els.target.setAttribute("aria-hidden","true");this.els.target.removeAttribute("aria-label");}
      else{this.els.target.removeAttribute("aria-hidden");this.els.target.setAttribute("aria-label",this.current().display);}
      this.roundLive=true;this.setPhase("active");
      this.roundEndAt=performance.now()+this.scaled(this.roundRemaining*1000);this.startClock();this.scheduleNextWave(60);
    }
    startClock(){
      this.clockTimers.clear();
      const tick=()=>{
        if(!this.roundLive||this.destroyed||this.phase==="paused")return;
        if(this.overtime){this.paintTime();return}
        /* Hearing the word is a learning aid, not a speed penalty. Keep the
           displayed time frozen until the most recent pronunciation ends. */
        if(this.speechPauseStartedAt){this.paintTime();this.clockTimers.set(tick,this.scaled(100));return}
        this.roundRemaining=Math.max(0,(this.roundEndAt-performance.now())/(1000*this.scale));
        if(this.roundRemaining<=0){this.enterOvertime();return}
        this.paintTime();this.hurryTick(this.roundRemaining);this.clockTimers.set(tick,this.scaled(100));
      };
      tick();
    }
    bounceChunk(step){if(this.options.reducedMotion)return;const tile=this.els.target.querySelectorAll(".pp-target-chunk")[step-1];if(!tile)return;tile.classList.remove("pp-chunk-done");void tile.offsetWidth;tile.classList.add("pp-chunk-done");}
    /* S12a (as WordBar Dictation E9.12): the last 5 seconds pulse and tick softly */
    hurryTick(remaining){const s=Math.ceil(remaining),on=!this.overtime&&this.roundLive&&remaining>0&&s<=5;this.root.classList.toggle("pp-hurry",on);
      if(on&&s!==this.lastHurrySecond){this.lastHurrySecond=s;this.playSound("tick");}if(!on&&s>5)this.lastHurrySecond=null;}
    paintTime(){
      const total=letterTime(this.current().letterCount);this.els.time.textContent=this.overtime?"OT":String(Math.ceil(this.roundRemaining));
      this.els.fill.style.transform=`scaleX(${this.overtime?0:Math.max(0,Math.min(1,this.roundRemaining/total))})`;
      this.els.timeTrack.setAttribute("aria-valuemin","0");this.els.timeTrack.setAttribute("aria-valuemax",String(total));this.els.timeTrack.setAttribute("aria-valuenow",String(Math.max(0,Math.ceil(this.roundRemaining))));this.els.timeTrack.setAttribute("aria-valuetext",this.overtime?"Overtime":`${Math.ceil(this.roundRemaining)} seconds remaining`);
    }
    enterOvertime(){
      /* S12b (review S12A-B03): clock expiry and a wrong-tap penalty both come
         here, so the last-seconds pulse is always cleared on entering overtime */
      this.root.classList.remove("pp-hurry");this.lastHurrySecond=null;
      if(this.overtime)return;this.overtime=true;this.wordOvertimeCount++;this.setPhase("overtime");this.root.classList.add("overtime");this.els.prompt.textContent="OVERTIME — finish the word!";this.paintTime();this.emit("overtime");
    }

    selectSpeed(){return speedForRoll(this.random())}
    neededLetters(){
      const letters=this.current().letters;
      const next=this.filled.findIndex(value=>!value);return next<0?[]:[letters[next]];
    }
    scheduleNextWave(delay){
      if(!this.roundLive||this.waveOpen||this.destroyed||this.phase==="paused"||this.speechActive)return;
      this.waveTimers.set(()=>this.spawnWave(),this.scaled(delay));
    }
    spawnWave(){
      if(!this.roundLive||this.waveOpen||this.destroyed||this.phase==="paused"||this.speechActive)return;
      this.waveOpen=true;this.waveNumber++;
      const requested=petCountForRoll(this.random());
      let holes=Array.from({length:12},(_,index)=>index).filter(index=>!this.lastHoles.has(index));
      if(holes.length<requested)holes=Array.from({length:12},(_,index)=>index);
      holes=shuffled(holes,this.random).slice(0,requested);
      let pets=this.pets.filter(pet=>!this.lastPets.has(pet.id));if(pets.length<requested)pets=this.pets.slice();pets=shuffled(pets,this.random).slice(0,requested);
      if(this.selectedPetPending){const selected=this.pets.find(pet=>pet.id===this.selectedPetId);if(selected&&pets.length){pets[0]=selected;this.selectedPetPending=false}}
      const needed=this.neededLetters(),includeTarget=!!needed.length&&shouldIncludeTarget(this.wavesWithoutTarget,this.overtime,this.random());
      const alphabet=Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),letters=Array(requested).fill("");
      let targetIndex=-1,targetLetter="";
      if(includeTarget){targetIndex=Math.floor(this.random()*requested);targetLetter=needed[Math.floor(this.random()*needed.length)];letters[targetIndex]=targetLetter;this.wavesWithoutTarget=0}else this.wavesWithoutTarget++;
      const used=new Set(targetLetter?[targetLetter]:[]),preferred=shuffled(confusionLetters(targetLetter||needed[0]||"",this.current().display),this.random);
      for(let i=0;i<requested;i++){
        if(i===targetIndex)continue;
        let choices=preferred.filter(letter=>!needed.includes(letter)&&!used.has(letter));
        if(!choices.length)choices=alphabet.filter(letter=>!needed.includes(letter)&&!used.has(letter));
        if(!choices.length)choices=alphabet.filter(letter=>!used.has(letter));
        const letter=choices[Math.floor(this.random()*choices.length)];
        if(!letter)throw new Error("Pet Pop could not create a unique decoy letter");
        letters[i]=letter;used.add(letter);
      }
      const wave={holes:holes.slice(),petIds:pets.map(pet=>pet.id),remaining:requested,nodes:[]};
      holes.forEach((holeIndex,index)=>this.makePet(wave,holeIndex,pets[index],letters[index],index===targetIndex));
      this.waveNodes=wave.nodes;this.emit("wave",{number:this.waveNumber,count:requested,targetIncluded:includeTarget,holes:wave.holes,petIds:wave.petIds});
    }
    makePet(wave,holeIndex,pet,letter,correctAtSpawn){
      /* Round 1 is the guided pass: only the next letter is valid and its
         pet is highlighted green. Gold is unchanged in rounds 2-3. */
      const firstRound=this.roundIndex===0;
      const profile=this.selectSpeed(),gold=correctAtSpawn&&!firstRound&&this.random()<.08;
      const hintGreen=firstRound&&correctAtSpawn;
      const timing=timingFor(profile,wave.holes.length,gold,this.overtime,correctAtSpawn),{rise,hold,hide}=timing;
      const button=document.createElement("button");button.type="button";button.className=`pp-pet${gold?" gold":""}${hintGreen?" hint":""}`;
      button.dataset.letter=letter;button.dataset.correctAtSpawn=correctAtSpawn?"1":"0";button.dataset.petId=pet.id;button.dataset.hole=String(holeIndex);button.dataset.speed=profile.name;
      button.dataset.riseMs=String(rise);button.dataset.holdMs=String(hold);button.dataset.hideMs=String(hide);button.dataset.gold=gold?"1":"0";
      button.style.setProperty("--rise",`${this.scaled(rise)}ms`);button.style.setProperty("--hide",`${this.scaled(hide)}ms`);
      button.setAttribute("aria-label",`${pet.name||pet.species} holding letter ${letter}${hintGreen?", the next letter":""}`);
      button.innerHTML=`${this.renderPet(pet,"normal",76,{})}<span class="pp-letter">${letter}</span><span class="pp-speed" aria-hidden="${this.options.showSpeedLabels?"false":"true"}">${profile.name}</span>`;
      /* Balloon variation: small per-pet differences in tilt, bob phase and
         squash so no two look identical, while the readable area stays the
         same size for every letter. */
      const card=button.querySelector(".pp-letter");
      if(card){
        card.style.setProperty("--tilt",`${(this.random()*10-5).toFixed(1)}deg`);
        card.style.setProperty("--squash",(0.96+this.random()*0.08).toFixed(3));
        card.style.setProperty("--bob",`${(2.2+this.random()*1.4).toFixed(2)}s`);
        card.style.setProperty("--bobdelay",`${(this.random()*1.2).toFixed(2)}s`);
      }
      this.petsSeen.add(pet.id);
      button._pet=pet;button._wave=wave;button._settled=false;button._reaction=false;wave.nodes.push(button);this.holes[holeIndex].appendChild(button);
      this.waveTimers.set(()=>{
        if(!button.isConnected)return;
        button.classList.add("up","rising");
        /* Ripple ring at the hole mouth, reinforcing "popping out of the
           ground". Decorative only: skipped under reduced motion, sits
           behind the pet and ignores pointer events, so it can never
           intercept a tap. */
        if(!this.options.reducedMotion){
          const hole=this.holes[holeIndex];
          if(hole){
            const ring=document.createElement("span");
            ring.className="pp-ripple";ring.setAttribute("aria-hidden","true");
            hole.appendChild(ring);
            this.waveTimers.set(()=>{if(ring.isConnected)ring.remove()},700);
          }
        }
      },this.scaled(10));
      this.waveTimers.set(()=>{if(button.isConnected&&!button._settled){button.classList.remove("rising");button.classList.add("ready")}},this.scaled(10+rise));
      this.waveTimers.set(()=>{if(!button._reaction)this.hidePet(button)},this.scaled(10+rise+hold));
    }
    hidePet(button){
      if(!button||button._settled)return;button.classList.remove("up","ready","rising","reaction","correct","wrong");button.classList.add("hiding");
      const hide=Number(button.dataset.hideMs)||250;this.waveTimers.set(()=>this.settlePet(button),this.scaled(hide));
    }
    settlePet(button){
      if(!button||button._settled)return;button._settled=true;button.remove();const wave=button._wave;wave.remaining--;
      if(wave.remaining<=0){
        this.lastHoles=new Set(wave.holes);this.lastPets=new Set(wave.petIds);this.waveNodes=[];this.waveOpen=false;
        this.emit("wave-cleared",{number:this.waveNumber});this.scheduleNextWave(this.overtime?190:140);
      }
    }
    hitPet(button){
      if(!this.roundLive||this.isRoundComplete()||button._settled||button._reaction||!button.classList.contains("ready"))return;
      /* While the word is being spoken play is suspended (see speak()): taps
         neither score nor cost time, in normal time and in overtime. */
      if(this.speechActive)return;
      button._reaction=true;button.disabled=true;const correct=button.dataset.correctAtSpawn==="1"&&this.acceptLetter(button.dataset.letter);
      const pet=button._pet;button.classList.add("reaction",correct?"correct":"wrong");
      /* Swap in the reaction face, but keep the balloon as its own element so
         it can play the pop animation rather than being re-created. The
         balloon's per-pet variation styles are carried across. */
      const oldCard=button.querySelector(".pp-letter");
      const carried=oldCard?oldCard.getAttribute("style")||"":"";
      button.innerHTML=`${this.renderPet(pet,correct?"good":"bad",76,{})}<span class="pp-letter"${carried?` style="${carried}"`:""}>${button.dataset.letter}</span>`;
      const card=button.querySelector(".pp-letter");
      if(card){
        if(this.options.reducedMotion)card.classList.add("gone");
        else{
          card.classList.add("popping");
          /* Confetti-ish shreds left behind by the burst balloon. */
          const shreds=document.createElement("span");
          shreds.className="pp-pop-shreds";shreds.setAttribute("aria-hidden","true");
          for(let i=0;i<6;i++){
            const bit=document.createElement("i");
            const angle=(360/6)*i+this.random()*30;
            const rad=angle*Math.PI/180,dist=16+this.random()*14;
            bit.style.setProperty("--dx",`${Math.round(Math.sin(rad)*dist)}px`);
            bit.style.setProperty("--dy",`${Math.round(-Math.cos(rad)*dist)}px`);
            shreds.appendChild(bit);
          }
          card.appendChild(shreds);
        }
      }
      let scoreGain=0;
      let timePenalty=0;
      if(correct){this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);if(this.combo%5===0)this.startFever();scoreGain=scoreForPop(button.dataset.gold==="1",this.feverActive);this.score+=scoreGain;
        /* S12a: one sound per pop. A golden letter or a 5-in-a-row fanfare wins;
           otherwise a finished colour chunk (Round 1) rings its climbing note. */
        const filledNow=this.filled.filter(Boolean).length,chunkStep=(this.chunkEnds||[]).indexOf(filledNow)+1,wordDone=filledNow>=this.current().letterCount;
        if(chunkStep>0&&!wordDone&&button.dataset.gold!=="1"&&this.combo%5!==0){this.playSound("chunk",{step:chunkStep});this.bounceChunk(chunkStep);}
        else this.playSound("correct",{streak:this.combo,gold:button.dataset.gold==="1"});this.toast(button.dataset.gold==="1"?"GOLDEN LETTER!":this.feverActive?"FEVER POP! ×2":"GOOD POP!")}
      else{this.wordWrongTaps++;this.roundWrongTaps[this.roundIndex]=(this.roundWrongTaps[this.roundIndex]||0)+1;this.combo=0;this.clearFever();timePenalty=this.applyWrongTapPenalty(2);this.playSound("wrong");this.root.classList.add("pp-shake");this.phaseTimers.set(()=>this.root.classList.remove("pp-shake"),this.scaled(240));this.toast(timePenalty>0?"WRONG PET — 2 SECONDS!":"TRY ANOTHER PET")}
      this.paintScore();this.emit("tap",{correct,letter:button.dataset.letter,speed:button.dataset.speed,gold:button.dataset.gold==="1",scoreGain,timePenalty,fever:this.feverActive});
      this.waveTimers.set(()=>this.hidePet(button),this.scaled(REACTION_HOLD_MS));
      if(correct&&this.isRoundComplete())this.beginRoundComplete();
    }
    acceptLetter(letter){
      const letters=this.current().letters;
      const index=this.filled.findIndex(value=>!value);if(index<0||letters[index]!==letter)return false;this.filled[index]=letter;this.justFilled=index;
      this.renderSlots();return true;
    }
    isRoundComplete(){return this.filled.length>0&&this.filled.every(Boolean)}
    renderSlots(){
      this.els.slots.dataset.length=String(this.current().letterCount);this.els.slots.classList.toggle("long",this.current().letterCount>=9);this.els.slots.classList.toggle("very-long",this.current().letterCount>=13);
      /* justFilled marks the slot that just received a letter so it can
         play a one-shot "stamp" bounce. Cleared immediately so a re-render
         for any other reason never replays the animation. */
      const landed=this.justFilled;this.justFilled=-1;
      let letterIndex=0;this.els.slots.innerHTML=this.current().tokens.map(token=>{
        if(token.kind==="fixed")return `<span class="pp-slot fixed">${escapeHtml(token.character)}</span>`;
        const index=letterIndex++;const value=this.filled[index]||"";
        const stamp=value&&index===landed&&!this.options.reducedMotion?" landed":"";
        return `<span class="pp-slot ${value?"":"blank"}${stamp}">${value||"_"}</span>`;
      }).join("");
    }
    renderTarget(){
      const word=this.current();this.els.target.classList.remove("chunked","plain");this.els.target.setAttribute("aria-label",word.display);
      if(this.roundIndex!==0){this.chunkEnds=[];this.els.target.textContent=word.display;this.els.target.classList.add("plain");return false;}
      const info=spellingChunkInfo(word);this.els.target.innerHTML=spellingTargetHtml(info);this.els.target.classList.add(info.showChunkStyle?"chunked":"plain");
      /* S12a (as WordBar Dictation E9.12): where each colour chunk ends, so a
         finished chunk can ring a note that climbs with each chunk */
      this.chunkEnds=[];if(info.chunksShown){let acc=0;for(const chunk of info.chunks){acc+=Array.from(chunk).length;this.chunkEnds.push(acc);}}
      return info.chunksShown;
    }
    paintScore(){this.els.score.textContent=String(this.score);this.els.combo.textContent=String(this.combo)}
    /* W1: during speech the clock is frozen at roundRemaining while roundEndAt
       is deliberately left stale, so time left must be read from roundRemaining
       then. Reading roundEndAt instead charged the child for speech time
       (20 s left, 5 s of speech, wrong tap -> 13 s instead of 18 s). */
    currentRemaining(){
      if(this.speechPauseStartedAt)return Math.max(0,Number(this.roundRemaining)||0);
      return Math.max(0,(this.roundEndAt-performance.now())/(1000*this.scale));
    }
    applyWrongTapPenalty(seconds=2){
      if(this.overtime||!this.roundLive)return 0;
      const now=performance.now(),current=this.currentRemaining(),remaining=subtractTime(current,seconds),deducted=current-remaining;
      this.roundRemaining=remaining;this.roundEndAt=now+this.scaled(remaining*1000);this.paintTime();this.emit("time-penalty",{seconds:deducted,remaining});if(remaining<=0)this.enterOvertime();return deducted;
    }
    /* Particle burst used for Fever sparkles and the 3-star finish.
       Purely decorative: it is skipped entirely under reduced motion and
       self-removes, so it can never accumulate nodes or block a tap. */
    burst(kind,count){
      if(this.options.reducedMotion||!this.root)return;
      const layer=document.createElement("div");
      layer.className=`pp-burst pp-burst-${kind}`;layer.setAttribute("aria-hidden","true");
      for(let i=0;i<count;i++){
        const bit=document.createElement("i");
        /* Fan direction is precomputed here as x/y offsets rather than a CSS
           rotate(), so the stylesheet stays free of any rotate() at all —
           the hole-rotation guard in the QA suite scans the whole file. */
        const angle=((360/count)*i+this.random()*18)*Math.PI/180;
        const distance=kind==="confetti"?70+this.random()*90:38+this.random()*44;
        bit.style.setProperty("--dx",`${Math.round(Math.sin(angle)*distance)}px`);
        bit.style.setProperty("--dy",`${Math.round(-Math.cos(angle)*distance)}px`);
        bit.style.setProperty("--t",`${Math.round(520+this.random()*520)}ms`);
        bit.style.setProperty("--delay",`${Math.round(this.random()*140)}ms`);
        if(kind==="confetti")bit.style.setProperty("--hue",`${Math.floor(this.random()*360)}`);
        layer.appendChild(bit);
      }
      this.root.appendChild(layer);
      this.phaseTimers.set(()=>{if(layer.isConnected)layer.remove()},1500);
    }
    startFever(){
      this.feverActive=true;this.feverCount++;const token=++this.feverToken;this.root.classList.add("pp-fever-active");this.playSound("fever");this.burst("sparkle",10);
      if(typeof this.options.onFever==="function")this.options.onFever(true);
      this.emit("fever",{count:this.feverCount,combo:this.combo});
      this.phaseTimers.set(()=>{if(token===this.feverToken)this.clearFever()},this.scaled(5000));
    }
    clearFever(){
      const wasActive=this.feverActive;
      this.feverToken++;this.feverActive=false;if(this.root)this.root.classList.remove("pp-fever-active");
      if(wasActive&&typeof this.options.onFever==="function")this.options.onFever(false);
    }
    toast(text){this.els.toast.textContent=text;this.els.toast.classList.remove("show");void this.els.toast.offsetWidth;this.els.toast.classList.add("show")}
    beginRoundComplete(){
      if(!this.roundLive)return;this.pendingRoundInTime=!this.overtime;this.roundLive=false;this.setPhase("roundComplete");this.toast(["CHUNKS BUILT!","PERFECT ORDER!","REMEMBERED!"][this.roundIndex]);
      this.phaseTimers.set(()=>this.finishRound(),this.scaled(700));
    }
    finishRound(){
      if(this.phase!=="roundComplete")return;this.stopRound();
      if(this.roundIndex<2){const completed=ROUNDS[this.roundIndex],next=ROUNDS[this.roundIndex+1];this.setPhase("roundTransition");this.playSound("round");this.showOverlay(`<p>${completed.icon} ${escapeHtml(completed.name)} complete!</p><h2>${next.icon} ${escapeHtml(next.name)}</h2><p>${escapeHtml(next.prompt)}</p><button data-pp-action="next-round">Next round</button>`)}
      else this.advanceAfterRound();
    }
    advanceAfterRound(){
      if(this.roundIndex<2){this.hideOverlay();this.roundIndex++;this.startRound()}else this.finishWord(this.pendingRoundInTime);
    }
    finishWord(memoryInTime){
      this.setPhase("wordComplete");this.playSound("word");this.praise();const outcome={id:this.current().id,courseId:this.current().courseId,wordIndex:this.wordIndex,sessionKey:this.sessionKey,outcomeKey:`${this.sessionKey}:${this.wordIndex}:${this.current().id}`,memoryInTime,wrongTaps:this.wordWrongTaps,round1WrongTaps:this.roundWrongTaps[0]||0,chunksShown:!!this.round1ChunksShown,overtimeCount:this.wordOvertimeCount,sceneId:this.scene&&this.scene.id};this.results.push(outcome);const saved=this.emit("word-complete",outcome)||{};outcome.dueReturn=!!saved.dueReturn;
      const feedback=outcome.dueReturn&&saved.clean?"Long-memory recall!":memoryInTime?"Remembered in time!":"Finished in Overtime — this word will return for practice.";
      this.showOverlay(`<p>Word ${this.wordIndex+1} complete</p><h2 lang="en-GB">${escapeHtml(this.current().display)}</h2><p class="pp-card-definition" lang="en-GB">${escapeHtml(this.current().definition)}</p><div class="pp-word-feedback">${escapeHtml(feedback)}</div><button data-pp-action="next">${this.wordIndex<2?"Next word":"See results"}</button>`);
    }
    finishGame(){
      this.stopRound();this.clearFever();this.setPhase("results");
      const event={sessionKey:this.sessionKey,score:this.score,bestCombo:this.bestCombo,feverCount:this.feverCount,results:this.results.slice(),petIdsSeen:[...this.petsSeen]};
      /* S12b (review S12A-B04): only an explicit ok:true counts as saved. On a
         failed session save, keep this play's score and recap but never claim
         the result, reward or totals were stored, and never show made-up zeros. */
      const saved=this.emit("session-complete",event)||{},savedOk=saved.ok===true,reward=savedOk&&saved.reward||{},stars=reward.stars||2,course=savedOk&&saved.course||null,fresh=savedOk&&Array.isArray(saved.freshTrophies)?saved.freshTrophies:[];
      this.playSound("result");this.praise();
      const rewardText=!savedOk?"Session finished, but this result could not be saved. Some word progress may already be saved. Free up storage before your next game.":reward.paid?`+${reward.paid} tips earned!`:reward.reason==="same-words"?"Practice replay — spelling progress earned, but these words have already paid today.":reward.reason==="daily-cap"?"Today’s playtime tips are collected — keep playing for spelling progress and trophies!":"Spelling progress saved.";
      const host=this.pets.find(pet=>pet.id===this.selectedPetId)||this.pets[0],hostArt=host?`<div class="pp-result-pet">${this.renderPet(host,"good",94,{})}</div>`:"";   /* S9a: happy face — "excited" (wide eyes) read as shocked */
      const recap=this.results.map((item,index)=>`<div class="pp-recap-item"><b>${escapeHtml(this.words[index].display.toUpperCase())}</b><span>${item.memoryInTime?"Memory ✓":"Overtime"}${item.dueReturn?" · old word recalled":""}</span></div>`).join("");
      this.showOverlay(`<p>Playtime complete</p>${hostArt}${savedOk?`<div class="pp-stars" aria-label="${stars} out of 3 stars">${"★".repeat(stars)}${"☆".repeat(3-stars)}</div>`:""}<h1>${reward.perfect?"Perfect Pop!":"Brilliant spelling!"}</h1><div class="pp-recap">${recap}</div><p>Score <b>${this.score}</b> · Best combo <b>${this.bestCombo}</b>${this.feverCount?` · Fever <b>${this.feverCount}</b>`:""}</p><div class="pp-reward${savedOk?"":" pp-save-failed"}" ${savedOk?"":'role="alert"'}>${escapeHtml(rewardText)}</div>${course?`<p class="pp-progress">Spelling progress: <b>${Number(course.uniqueWords&&course.uniqueWords.length)||0}</b> unique words · <b>${Number(course.retrievalSuccesses)||0}</b> long-memory recalls</p>`:""}${fresh.length?`<p class="pp-new-trophies">🏆 ${fresh.length} new spelling ${fresh.length===1?"trophy":"trophies"}!</p>`:""}<button class="secondary" data-pp-action="replay">Practise these 3 again</button>${typeof this.options.requestWords==="function"?'<button data-pp-action="new">Play 3 new words</button>':""}${typeof this.options.onTrophies==="function"?'<button class="secondary" data-pp-action="trophies">Spelling Trophies</button>':""}<button data-pp-action="finish">${typeof this.options.onExit==="function"?"Back to WordBar":"Finish"}</button>`);
      /* Confetti only for a full three-star finish, so it stays a reward
         rather than routine wallpaper on every result screen. */
      if(savedOk&&stars>=3)this.phaseTimers.set(()=>this.burst("confetti",22),this.scaled(220));   // S12c (E03): no reward stars or confetti when the result was not saved
    }
    async requestNewWords(){
      if(typeof this.options.requestWords!=="function")return;
      this.showOverlay("<p>Choosing the next three words…</p>");
      try{const words=await this.options.requestWords(this.results.slice());this.replaceWords(words);this.rotateSessionKey();this.handleAction("start")}
      catch(error){this.showOverlay(`<h2>Words could not load</h2><p>${escapeHtml(error&&error.message||error)}</p><button data-pp-action="finish">Back</button>`)}
    }
    replaceWords(words){if(!Array.isArray(words)||words.length!==3)throw new Error("Pet Pop needs exactly three new words");this.words=words.slice();return this}
    /* Replay contract (Batch A review, fix A). While the word is being spoken
       the playable round is suspended: the countdown is frozen (not in
       overtime, which has no countdown), the current wave is cleared and no new
       wave spawns, and taps are ignored. Only the most recent request resumes
       play, exactly once, on completion, error, throw or watchdog timeout.
       Hearing the word is free: no time, score, progress or reward changes. */
    speak(){
      const text=this.current().pronunciation;
      const request=++this.speechRequest;
      if(this.roundLive&&!this.destroyed)this.enterSpeechPause(request);
      let spoken;
      if(typeof this.options.speak==="function"){try{spoken=this.options.speak(text)}catch(error){spoken=Promise.resolve("error")}}
      else if("speechSynthesis" in global){
        spoken=new Promise(resolve=>{
          try{global.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang="en-GB";utterance.rate=.9;utterance.onend=()=>resolve("ended");utterance.onerror=()=>resolve("error");global.speechSynthesis.speak(utterance)}catch(error){resolve("error")}
        });
      }else spoken=Promise.resolve("unavailable");
      Promise.resolve(spoken).catch(()=>"error").then(()=>this.endSpeechPause(request));
    }
    enterSpeechPause(request){
      if(!this.speechActive){
        if(!this.overtime&&!this.speechPauseStartedAt){
          if(this.phase==="active")this.roundRemaining=this.currentRemaining();
          this.speechPauseStartedAt=performance.now();
        }
        this.waveTimers.clear();for(const node of this.waveNodes)node.remove();this.waveNodes=[];this.waveOpen=false;
        if(this.phase==="active"||this.phase==="overtime")this.paintTime();
      }
      this.speechActive=request;
      if(this.speechWatchdog)global.clearTimeout(this.speechWatchdog);
      this.speechWatchdog=global.setTimeout(()=>this.endSpeechPause(request),SPEECH_WATCHDOG_MS);
    }
    endSpeechPause(request){
      if(request!==this.speechRequest||this.speechActive!==request)return;
      if(this.speechWatchdog){global.clearTimeout(this.speechWatchdog);this.speechWatchdog=0}
      this.speechActive=0;
      const wasFrozen=!!this.speechPauseStartedAt;this.speechPauseStartedAt=0;
      if(this.destroyed||!this.roundLive||this.phase==="paused")return;
      if(this.phase!=="active"&&this.phase!=="overtime")return;
      if(wasFrozen&&!this.overtime){this.roundEndAt=performance.now()+this.scaled(this.roundRemaining*1000);this.startClock()}
      else this.paintTime();
      this.scheduleNextWave(180);
    }
    stopRound(){
      this.roundLive=false;this.speechRequest++;this.speechPauseStartedAt=0;this.speechActive=0;if(this.speechWatchdog){global.clearTimeout(this.speechWatchdog);this.speechWatchdog=0}this.phaseTimers.clear();this.waveTimers.clear();this.clockTimers.clear();this.clearFever();this.waveOpen=false;
      for(const node of this.waveNodes)node.remove();this.waveNodes=[];if(this.els)this.root.classList.remove("overtime","pp-hurry");this.lastHurrySecond=null;
    }
    pause(reason){
      if(reason==="sheet")this.sheetHold=true;   // S9b: the pause sheet holds the game until it closes
      if(this.destroyed||this.phase==="paused")return;this.beforePause=this.phase;
      if(this.roundLive&&!this.overtime&&!this.speechPauseStartedAt)this.roundRemaining=Math.max(0,(this.roundEndAt-performance.now())/(1000*this.scale));
      this.phaseTimers.clear();this.waveTimers.clear();this.clockTimers.clear();for(const node of this.waveNodes)node.remove();this.waveNodes=[];this.waveOpen=false;this.root.classList.remove("pp-hurry");this.lastHurrySecond=null;this.setPhase("paused");this.emit("paused",{reason});
    }
    resume(reason){
      if(reason==="sheet")this.sheetHold=false;else if(this.sheetHold)return;   // S9b: returning to the app never un-pauses under an open sheet
      if(this.destroyed||this.phase!=="paused")return;const previous=this.beforePause;this.beforePause=null;this.emit("resumed",{reason,previous});
      if(previous==="active"||previous==="overtime"){
        this.roundLive=true;this.setPhase(this.overtime?"overtime":"active");if(!this.overtime){this.roundEndAt=performance.now()+this.scaled(this.roundRemaining*1000);this.startClock()}else this.paintTime();this.scheduleNextWave(180);
      }else if(previous==="countdown")this.runCountdown();
      else if(previous==="wordIntro"&&this.memoryFlashActive)this.startRound();
      else if(previous==="roundComplete")this.finishRound();
      else this.setPhase(previous||"intro");
    }
    destroy(){
      if(this.destroyed)return;this.destroyed=true;this.stopRound();for(const remove of this.listeners)remove();this.listeners=[];
      if("speechSynthesis" in global)global.speechSynthesis.cancel();if(this.audioContext&&this.audioContext.state!=="closed")this.audioContext.close().catch(()=>{});
      this.root.innerHTML="";this.root.className="pet-pop-root";this.setPhase("destroyed");
      if(activeController===this)activeController=null;
    }
    debugSnapshot(){
      return {phase:this.phase,wordIndex:this.wordIndex,roundIndex:this.roundIndex,score:this.score,combo:this.combo,feverActive:this.feverActive,feverCount:this.feverCount,overtime:this.overtime,roundRemaining:this.roundRemaining,waveOpen:this.waveOpen,sceneId:this.scene&&this.scene.id,
        waveNumber:this.waveNumber,timers:{phase:this.phaseTimers.size,wave:this.waveTimers.size,clock:this.clockTimers.size},events:this.eventLog.slice(),destroyed:this.destroyed};
    }
  }

  let activeController=null;
  global.PetPop=Object.freeze({
    SPEEDS,ROUNDS,SCENES,letterTime,memoryFlashTime,confusionLetters,timingFor,speedForRoll,petCountForRoll,shouldIncludeTarget,scoreForPop,subtractTime,wordWithSpelling,spellingChunkInfo,
    start(options){if(activeController)activeController.destroy();activeController=new PetPopController(options);return activeController.start()},
    pause(reason){if(activeController)activeController.pause(reason||"manual")},
    resume(reason){if(activeController)activeController.resume(reason||"manual")},
    destroy(){if(activeController){activeController.destroy();activeController=null}},
    debug(){return activeController?activeController.debugSnapshot():null}
  });
})(window);
