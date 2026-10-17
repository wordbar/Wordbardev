/* Open-the-app hint (Nigel, 10 Oct 2026).
   iPhone and iPad never open a Home Screen web app from a link: a link from
   wordbar.net always opens Safari, and Safari keeps a SEPARATE save from the
   Home Screen app. So whenever this page runs in Safari (or an app's built-in
   browser) on an iPhone or iPad, show one small note pointing to the Home
   Screen icon, until it is dismissed with OK. (v2, 10 Oct: v1 only showed it
   after a wordbar.net link, so links shared in WhatsApp or texts never did.)
   Android and computers: the web app manifest asks the browser to open links
   in the installed app instead (handle_links / launch_handler), so no note.
   Stores one flag ("dismissed") in this browser only; sends nothing. */
(function(){try{
  var s=document.currentScript,app=(s&&s.getAttribute("data-app"))||"WordBar",key="wordbar_open_app_hint_off_v1";
  var n=navigator,apple=/iPhone|iPad|iPod/.test(n.userAgent||"")||(n.platform==="MacIntel"&&n.maxTouchPoints>1);
  var standalone=n.standalone===true||!!(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches);
  if(!apple||standalone)return;
  try{if(localStorage.getItem(key)==="1")return;}catch(e){}
  var show=function(){if(document.getElementById("wbOpenAppHint"))return;
    var d=document.createElement("div");d.id="wbOpenAppHint";d.className="wb-open-app-hint";d.setAttribute("role","note");
    /* S11a (as Dictation E10.2): no "links always open Safari" claim; one cleanup for OK
       and for the fade, so no timer is left behind. The text is translated by i18n.js. */
    var timers=[],done=false;
    var cleanup=function(){if(done)return;done=true;timers.forEach(clearTimeout);timers=[];if(d.parentNode)d.remove();};
    d.innerHTML='<span class="wb-oah-icon" aria-hidden="true">📲</span><span class="wb-oah-text"><b>Using the '+app+' app on your Home Screen?</b> Shared links may open in your browser. To continue your Home Screen app progress, open it from its Home Screen icon.</span><button type="button" class="wb-oah-close" aria-label="Close this note">OK</button>';
    d.querySelector("button").addEventListener("click",function(){try{localStorage.setItem(key,"1");}catch(e){}cleanup();});
    document.body.appendChild(d);
    timers.push(setTimeout(function(){if(!done)d.classList.add("wb-oah-fade");timers.push(setTimeout(cleanup,600));},20000));};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",show);else show();
}catch(e){}})();
