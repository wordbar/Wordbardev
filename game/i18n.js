/* WordBar — interface language (S11a; S11b review fixes, Nigel 11 Oct 2026). Same rules as WordBar Dictation.
   EN (default) | 繁 Traditional Chinese (Hong Kong) | 简 Simplified Chinese.
   HOW: the game builds its screens as English HTML. While Chinese is on, a
   MutationObserver translates interface text as it appears (text nodes and the
   aria-label / title / placeholder / alt attributes), by exact English text or
   by a pattern such as "{a} waiting". The English is kept on each node, so
   switching back restores it exactly. With English on, nothing is touched.
   STAYS ENGLISH (decided): questions, answer options and explanations, spelling
   words and letters, everything spoken, praise, customer and character speech,
   names of things (drinks, food, shop items, achievement titles, customers,
   pets, preset characters and their descriptions), kitchen recipe steps and
   customer descriptions. None of these are general dictionary keys. (S12a:
   look-editor options such as hairstyles and colours ARE translated, but only
   inside the editor, through "§look:" keys and data-i18n-scope="look"); anything inside [data-i18n-skip] or an English
   lang="en-GB" element (learning content, player names) is never changed.
   PATTERN PARTS (S11b): {a} is kept exactly as shown (names, words, answers);
   {~a} is an interface fragment that is itself translated; {#a} a number;
   {@a} one letter. [data-i18n-html] elements are matched as one whole sentence
   including <b> tags, so a sentence split by bold text still reads naturally.
   [data-i18n-ctx] text is looked up with the §-key first (e.g. mastery labels).
   Inside [data-i18n-scope="x"] a text or label is looked up as "§x:text"
   first (S12a: look-editor options such as "Short" or "Round" only there).
   The choice is kept on this device (key below, like the rest of WordBar's save);
   a link can carry it: ?lang=zh-hk | zh-cn | en. */
(function(){
  "use strict";
  var KEY="wordbar_ui_lang_v1";
  var LANGS=["en","zh-HK","zh-CN"];
  var LABELS={"en":"EN","zh-HK":"繁","zh-CN":"简"};
  var NAMES={"en":"English","zh-HK":"繁體中文（香港）","zh-CN":"简体中文"};
  var HTML_LANG={"en":"en-GB","zh-HK":"zh-Hant-HK","zh-CN":"zh-Hans"};
  var URL_CODE={"en":"en","zh-HK":"zh-hk","zh-CN":"zh-cn"};
  var ATTRS=["aria-label","title","placeholder","alt"];
  /* never translated: the English being learned and character speech */
  var SKIP="[data-i18n-skip],[lang|=en],[data-word-id],script,style,svg,textarea,code,pre,.qtext,.opts,.opt,.worddef,.phon,.custsay,.kitchenprompt,.kitchentile,.kitchenchefbubble,.slot,.pp-target,.pp-slots,.pp-letter,.pp-flash,.pp-definition,.pp-card-definition,.reviewanswer";
  var DICTS=window.WB_I18N_DICTS||{};
  var cur="en",exact=new Map(),patterns=[],missed=new Set(),observer=null,listeners=[];
  function norm(v){var s=String(v==null?"":v).trim().toLowerCase().replace(/_/g,"-");if(!s)return null;
    if(s==="en"||s.indexOf("en-")===0)return "en";
    if(["zh-hk","zh-mo","zh-tw","zh-hant","hk","tc"].indexOf(s)>=0||s.indexOf("zh-hant")===0)return "zh-HK";
    if(["zh-cn","zh-sg","zh-hans","zh","cn","sc"].indexOf(s)>=0||s.indexOf("zh-hans")===0)return "zh-CN";
    return null;}
  function reEsc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
  function compile(code){exact=new Map();patterns=[];var d=DICTS[code];if(!d)return;
    Object.keys(d).forEach(function(k){var v=d[k];
      /* {a} = any text kept as it is (may be empty); {~a} = any text, itself translated;
         {#a} = a number such as 12, 1,000 or 3/7; {@a} = one letter */
      if(/\{[#@~]?[a-z]\}/.test(k)){var inner=k.charAt(0)==="§";if(inner)k=k.slice(1);var names=[],sub=[];var src="^"+k.split(/(\{[#@~]?[a-z]\})/).map(function(p){var m=/^\{([#@~]?)([a-z])\}$/.exec(p);if(m){names.push(m[2]);sub.push(m[1]==="~");return m[1]==="#"?"([0-9][0-9,.:/%+\\-\u2013]*)":m[1]==="@"?"([A-Za-z])":"([\\s\\S]*?)";}return reEsc(p);}).join("")+"$";
        patterns.push({re:new RegExp(src),names:names,sub:sub,v:v,inner:inner,len:k.replace(/\{[#@~]?[a-z]\}/g,"").length});}
      else exact.set(k,v);});
    patterns.sort(function(a,b){return b.len-a.len;});}   // most fixed text first (most specific)
  /* translate one string; returns null when there is nothing to change */
  /* keys starting with § are used only for a part captured by a pattern
     (e.g. "easy" in "Reward ready · easy"), never for a whole piece of text */
  function lookup(core,depth){
    if(depth>0&&exact.has("§"+core))return exact.get("§"+core);
    if(exact.has(core))return exact.get(core);
    if(depth>2)return null;
    for(var i=0;i<patterns.length;i++){var p=patterns[i];if(p.inner&&depth===0)continue;var m=p.re.exec(core);if(!m)continue;
      return p.v.replace(/\{([a-z])\}/g,function(x,n){var j=p.names.indexOf(n);if(j<0)return x;var part=m[j+1];
        if(!p.sub[j])return part;   // names, words, answers: exactly as shown
        var inner=lookup(part.trim(),depth+1);return inner==null?part:inner;});}
    return null;}
  function scopeOf(el){var sc=el&&el.closest&&el.closest("[data-i18n-scope]");return sc?sc.getAttribute("data-i18n-scope"):null;}
  function tr(s,scope){if(cur==="en"||s==null)return s;s=String(s);var core=s.replace(/\s+/g," ").trim();if(!core||!/[A-Za-z]/.test(core))return s;
    var v=scope&&exact.has("§"+scope+":"+core)?exact.get("§"+scope+":"+core):lookup(core,0);if(v==null){if(missed.size<2000)missed.add(core);return s;}
    var lead=/^\s*/.exec(s)[0],trail=/\s*$/.exec(s)[0];return lead+v+trail;}
  /* t(): for code that builds text outside the page (alert/confirm) */
  function t(s,vars){var out=cur==="en"?String(s):(lookup(String(s),0)??String(s));
    if(vars)out=out.replace(/\{(\w+)\}/g,function(m,k){return Object.prototype.hasOwnProperty.call(vars,k)?String(vars[k]):m;});return out;}
  function skipped(el){return !el||(el.closest&&el.closest(SKIP));}
  var HTMLSEL="[data-i18n-html]";
  /* a whole sentence with <b> parts: key is the English inner HTML */
  function doHtml(el){if(skipped(el))return;var cur_=el.innerHTML;
    if(el.__wbHtmlOut!==undefined&&cur_===el.__wbHtmlOut)return;
    el.__wbHtmlEn=cur_;var core=cur_.replace(/\s+/g," ").trim();var v=/[A-Za-z]/.test(core)?lookup(core,0):null;
    if(v==null){if(core&&missed.size<2000)missed.add(core);el.__wbHtmlOut=undefined;return;}
    el.innerHTML=v;el.__wbHtmlOut=el.innerHTML;}
  function doText(n){var el=n.parentElement;if(skipped(el))return;var hs=el.closest(HTMLSEL);if(hs&&hs.__wbHtmlOut!==undefined)return;
    if(el.hasAttribute("data-i18n-ctx")){var c=(n.data||"").replace(/\s+/g," ").trim();if(exact.has("§"+c)){if(n.__wbOut!==undefined&&n.data===n.__wbOut)return;n.__wbEn=n.data;var o=n.data.replace(c,exact.get("§"+c));n.__wbOut=o;n.data=o;return;}}
    if(n.__wbOut!==undefined&&n.data===n.__wbOut)return;   // our own write
    n.__wbEn=n.data;var out=tr(n.data,scopeOf(el));if(out!==n.data){n.__wbOut=out;n.data=out;}else n.__wbOut=undefined;}
  function doAttrs(el){if(skipped(el))return;var store=el.__wbAttr||(el.__wbAttr={}),scope=scopeOf(el);
    for(var i=0;i<ATTRS.length;i++){var a=ATTRS[i];if(!el.hasAttribute(a))continue;var v=el.getAttribute(a);
      if(store[a]&&store[a].out===v)continue;var out=tr(v,scope);store[a]={en:v,out:out};if(out!==v)el.setAttribute(a,out);}}
  function walk(root){if(cur==="en"||!root)return;
    if(root.nodeType===3){doText(root);return;}
    if(root.nodeType!==1&&root.nodeType!==11)return;
    if(root.nodeType===1){if(skipped(root))return;doAttrs(root);if(root.matches(HTMLSEL))doHtml(root);}
    var w=document.createTreeWalker(root,5/*elements+text*/,{acceptNode:function(n){if(n.nodeType===1&&n.matches&&n.matches(SKIP))return 2;return 1;}});
    var n;while((n=w.nextNode())){if(n.nodeType===3)doText(n);else{doAttrs(n);if(n.matches(HTMLSEL))doHtml(n);}}}
  /* back to the stored English everywhere (before switching language) */
  function restore(root){root.querySelectorAll(HTMLSEL).forEach(function(el){if(el.__wbHtmlOut!==undefined&&el.innerHTML===el.__wbHtmlOut)el.innerHTML=el.__wbHtmlEn;el.__wbHtmlOut=undefined;el.__wbHtmlEn=undefined;});
    var w=document.createTreeWalker(root,5,null),n;
    while((n=w.nextNode())){if(n.nodeType===3){if(n.__wbEn!==undefined&&n.__wbOut!==undefined&&n.data===n.__wbOut)n.data=n.__wbEn;n.__wbOut=undefined;n.__wbEn=undefined;}
      else if(n.__wbAttr){for(var a in n.__wbAttr){var s=n.__wbAttr[a];if(n.getAttribute(a)===s.out)n.setAttribute(a,s.en);}n.__wbAttr=undefined;}}}
  function onMutations(list){if(cur==="en")return;
    for(var i=0;i<list.length;i++){var m=list[i];
      if(m.type==="childList"){var tgt=m.target,hh=tgt.nodeType===1&&tgt.closest(HTMLSEL);
        if(hh){if(hh.__wbHtmlOut!==undefined&&hh.innerHTML===hh.__wbHtmlOut)continue;doHtml(hh);if(hh.__wbHtmlOut!==undefined)continue;}
        for(var j=0;j<m.addedNodes.length;j++)walk(m.addedNodes[j]);}
      else if(m.type==="characterData"){var pe=m.target.parentElement,h=pe&&pe.closest(HTMLSEL);if(h)doHtml(h);else doText(m.target);}
      else if(m.type==="attributes")doAttrs(m.target);}}
  function observe(){if(observer||!document.body)return;observer=new MutationObserver(onMutations);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});}
  function save(code){try{localStorage.setItem(KEY,code);}catch(e){}}
  function set(code,opts){var next=norm(code)||"en";opts=opts||{};
    if(document.body)restore(document.body);
    cur=next;compile(next);
    var root=document.documentElement;root.lang=HTML_LANG[next];root.setAttribute("data-ui",next);
    if(opts.save!==false)save(next);
    if(document.body)walk(document.body);
    for(var i=0;i<listeners.length;i++){try{listeners[i](next);}catch(e){}}
    try{document.dispatchEvent(new CustomEvent("wordbar:lang",{detail:{lang:next,htmlLang:HTML_LANG[next]}}));}catch(e){}
    return next;}
  function fromUrl(){try{return norm(new URL(location.href).searchParams.get("lang"));}catch(e){return null;}}
  function saved(){try{return norm(localStorage.getItem(KEY));}catch(e){return null;}}
  /* the language pill (EN | 繁 | 简): returns HTML; bind with WBI18N.bind(container) */
  function pillHTML(){return '<div class="lang-switch" role="group" aria-label="Language · 語言 · 语言" data-i18n-skip>'+LANGS.map(function(c){
    return '<button type="button" class="lang-btn" data-lang="'+c+'" lang="'+HTML_LANG[c]+'" aria-label="'+NAMES[c]+'" aria-pressed="'+(cur===c)+'">'+LABELS[c]+'</button>';}).join("")+'</div>';}
  function bind(root,after){(root||document).querySelectorAll(".lang-switch .lang-btn").forEach(function(b){b.onclick=function(){
    var code=b.getAttribute("data-lang");if(code===cur)return;set(code);
    try{var u=new URL(location.href);if(cur==="en")u.searchParams.delete("lang");else u.searchParams.set("lang",URL_CODE[cur]);history.replaceState(history.state,"",u.toString());}catch(e){}
    (root||document).querySelectorAll(".lang-switch .lang-btn").forEach(function(x){x.setAttribute("aria-pressed",String(x.getAttribute("data-lang")===cur));});
    if(typeof after==="function")after(cur);};});}
  /* start: a ?lang link wins (and is remembered); else the saved choice; else English */
  var startLang=fromUrl();var first=startLang||saved()||"en";
  window.WBI18N={t:t,tr:tr,lang:function(){return cur;},set:set,onChange:function(f){listeners.push(f);},pillHTML:pillHTML,bind:bind,
    htmlLang:function(c){return HTML_LANG[c||cur];},urlCode:function(c){return URL_CODE[c||cur];},LANGS:LANGS,
    __missed:missed,__dicts:DICTS,__walk:walk};
  function start(){observe();set(first,{save:!!startLang});}
  if(document.body)start();else document.addEventListener("DOMContentLoaded",start);
})();
