/* ============================================================
   WordBar café stage — open-entry layout (Batch S13)

   The café follows the approved "split counter, open entry" reference:
   the barista's counter on the left, a raised customer bar with stools
   on the right, the glass door at the back right and an open floor in
   the middle. Everything is drawn in one 360 × 274 design space (the
   reference picture's own shape) and split into layers so people can
   stand BEHIND the bar and in FRONT of it:

     back   – walls, window, door, shelves, machine, wall/hanging decor, rug
     lane-b – barista and queue (behind the counters)
     front  – both counters, counter-top items, stools, plant, pet bed
     lane-f – the customer being served, pets on the floor, the café pet
     top    – things on the counter tops (served order, pets on the bar)
     light  – night wash and lamp glow (never blocks taps)

   Shop item ids, slots, prices and placement rules are unchanged; only
   how each item is drawn has moved here. Supplied decoration art is
   used as small WebP sprites (art/decor), surfaces as tiling textures.
   ============================================================ */
const CAFE_W=375, CAFE_H=300;
/* the game's gold coin icon (styled in index.html) */
const COIN='<i class="wbcoin" aria-hidden="true"></i>';
/* Trimmed sprite sizes from tools/build_decor.py (decor-meta.json). */
const DECOR_META={"bunting_rainbow":{"w":360,"h":75},"fairylights":{"w":360,"h":59},"lantern_paper":{"w":360,"h":86},"stars_paper":{"w":360,"h":57},"cakedome":{"w":191,"h":210},"clock_station":{"w":210,"h":210},"flowerbox":{"w":300,"h":114},"fountain_gold":{"w":171,"h":210},"gumball":{"w":124,"h":210},"jukebox":{"w":167,"h":220},"lamp_brass":{"w":160,"h":210},"lamp_rose":{"w":169,"h":210},"menu_chalk":{"w":149,"h":210},"mug_rack":{"w":180,"h":105},"mural_market":{"w":240,"h":123},"plant_monstera":{"w":178,"h":210},"portrait_fox":{"w":210,"h":209},"poster_abc":{"w":159,"h":210},"poster_fruit":{"w":159,"h":210},"print_seaside":{"w":210,"h":125},"radio_retro":{"w":210,"h":153},"rug_ocean":{"w":360,"h":96},"rug_rose":{"w":360,"h":101},"rug_stripe":{"w":360,"h":104},"shelf_books":{"w":240,"h":120},"shelf_kegs":{"w":200,"h":118},"shelf_trophies":{"w":240,"h":89},"stool_cherry":{"w":151,"h":210},"stool_oak":{"w":158,"h":210},"stool_simple":{"w":141,"h":210},"stool_velvet":{"w":144,"h":210},"window_awning":{"w":299,"h":330},"window_stained":{"w":250,"h":330},"petbasket":{"w":240,"h":145},"petbed_cloud":{"w":240,"h":161}};
const DECOR_TILES=new Set(["counter_marble","floor_cocoa","floor_honey","floor_slate","tiles_terra","wall_blush","wall_meadow","wall_sky","wall_sunny"]);
const ART_DIR="art/";
const decorSrc=id=>`${ART_DIR}decor/${id}.webp`;

/* ---- scene geometry (design units) ----
   Batch S13b: a taller, tighter café (330 × 300) that fills the phone
   stage edge to edge. The customer bar sits lower and in front of the
   barista counter, leaving a wide walkway behind it from the big door
   and a short way out down the middle. */
const CAFE_GEO=Object.freeze({
  wallBottom:160,
  window:{x:128,y:26,w:84,h:80},
  door:{x:316,y:46,w:56,h:116},
  bCounter:{x:0,w:112,top:166,face:176,bottom:240},     /* barista counter (left), low enough to show the cupboard */
  bar:{x:206,w:154,top:174,face:184,bottom:244},        /* customer bar (right), marble top */
  bed:{x:40,y:290},                                     /* barista pet bed, front left */
  barista:{x:56,feet:212,k:.92},
  serve:{x:160,feet:214,k:.92},                         /* near the barista (not crowding her), same depth: order + collect */
  queue:[{x:258,feet:198,k:.86},{x:310,feet:194,k:.85}],/* well behind the bar: at most two wait, one orders */
  stash:{x:344,feet:166,k:.8},                          /* outside the door: overflow queue */
  doorIn:{x:344,feet:166,k:.8},
  exit:{x:160,feet:480,k:1.15},                         /* same x as the order spot: straight down */                         /* straight down the middle, out of the picture */
  barTopY:174, counterTopY:166
});
let cafeSceneUid=0;

/* fit a decor sprite into a box: horizontally centred, anchored at the
   bottom (things that stand) or the top (things that hang) */
function decorImg(id,x,y,w,h,{anchor="bottom",cls="",extra=""}={}){
  const m=DECOR_META[id];if(!m)return "";
  const s=Math.min(w/m.w,h/m.h),dw=m.w*s,dh=m.h*s;
  const dx=x+(w-dw)/2,dy=anchor==="top"?y:anchor==="middle"?y+(h-dh)/2:y+h-dh;
  return `<image class="decor ${cls}" data-decor="${id}" href="${decorSrc(id)}" x="${dx.toFixed(1)}" y="${dy.toFixed(1)}" width="${dw.toFixed(1)}" height="${dh.toFixed(1)}" preserveAspectRatio="xMidYMid meet" ${extra}/>`;
}
/* a point on a décor picture (fx, fy as fractions of the picture) in scene units */
function decorPoint(id,x,y,w,h,fx,fy,anchor="bottom"){
  const m=DECOR_META[id];if(!m)return {x:x+w/2,y:y+h/2,s:1};
  const s=Math.min(w/m.w,h/m.h),dw=m.w*s,dh=m.h*s,dx=x+(w-dw)/2,dy=anchor==="top"?y:anchor==="middle"?y+(h-dh)/2:y+h-dh;
  return {x:dx+dw*fx,y:dy+dh*fy,s:dw/m.w};
}
/* the two shop pieces sold as animated: drips from the golden tap, and the
   jukebox's light tubes glowing with a few notes floating up */
function fountainFX(x,y,w,h){
  const a=decorPoint("fountain_gold",x,y,w,h,.68,.36),b=decorPoint("fountain_gold",x,y,w,h,.68,.66);
  return `<g class="decor-fx" pointer-events="none">${[0,.55,1.1].map(d=>`<ellipse class="fx-drop" cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" rx=".7" ry="1" fill="#BFE6F5" stroke="#6FA9C2" stroke-width=".25" style="--fall:${(b.y-a.y).toFixed(1)}px;animation-delay:-${d}s"/>`).join("")}</g>`;
}
function jukeboxFX(x,y,w,h){
  const l=decorPoint("jukebox",x,y,w,h,.12,.42),r=decorPoint("jukebox",x,y,w,h,.88,.42),t=decorPoint("jukebox",x,y,w,h,.5,.02),tw=11*l.s*163/163,th=(.33*220)*l.s;
  const tube=p=>`<rect class="fx-glow" x="${(p.x-tw/2).toFixed(1)}" y="${p.y.toFixed(1)}" width="${tw.toFixed(1)}" height="${th.toFixed(1)}" rx="${(tw/2).toFixed(1)}" fill="#9FF5EE"/>`;
  return `<g class="decor-fx" pointer-events="none">${tube(l)}${tube(r)}${[0,1.4].map((d,i)=>`<text class="fx-note" x="${(t.x+(i?3:-3)).toFixed(1)}" y="${t.y.toFixed(1)}" font-size="6" fill="#7A4FA8" style="animation-delay:-${d}s">${i?"♫":"♪"}</text>`).join("")}</g>`;
}
function tilePattern(pid,id,size){
  return `<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${size}" height="${size}"><image href="${decorSrc(id)}" width="${size}" height="${size}" preserveAspectRatio="none"/></pattern>`;
}

/* ---- the hybrid hanging lights (fairy lights, paper lanterns) ----
   Ornament PNGs on an SVG cord, with a gradient halo that brightens at
   night. CSS varies each glow's opacity; nothing moves in JavaScript. */
function hangingLightsSVG(kind,uid,{x0,x1,y,sag,count}){
  const lantern=kind==="lantern";
  const src=decorSrc(lantern?"lantern-ornament":"fairy-ornament");
  const ow=lantern?13:7.2, oh=lantern?13.4:10.6, hang=lantern?3.2:1;
  const yAt=t=>y+4*sag*t*(1-t);
  let parts="";
  for(let i=0;i<count;i++){
    const t=(i+.5)/count,x=x0+t*(x1-x0),cy=yAt(t);
    const dur=(lantern?7.7+i*.31:3.8+i*.37).toFixed(2);
    parts+=`<g><path d="M${x.toFixed(1)} ${cy.toFixed(1)}v${hang}" stroke="#49323d" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <ellipse class="hl-glow" style="animation-duration:${dur}s;animation-delay:${(-i*1.23).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${(cy+hang+oh*.55).toFixed(1)}" rx="${(ow*1.25).toFixed(1)}" ry="${(oh*.95).toFixed(1)}" fill="url(#hl${uid})"/>
      <image href="${src}" x="${(x-ow/2).toFixed(1)}" y="${(cy+hang).toFixed(1)}" width="${ow}" height="${oh}"/></g>`;
  }
  return `<g class="hanging-lights ${lantern?"is-lantern":"is-fairy"}" pointer-events="none">
    <path d="M${x0} ${y} Q${(x0+x1)/2} ${y+2*sag} ${x1} ${y}" fill="none" stroke="#49323d" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="${x0}" cy="${y}" r="1.6" fill="#bd8854" stroke="#49323d" stroke-width=".8"/><circle cx="${x1}" cy="${y}" r="1.6" fill="#bd8854" stroke="#49323d" stroke-width=".8"/>
    ${parts}</g>`;
}
/* Aurora Lantern: the supplied coloured-light ribbons, inlined so the
   bands can animate (an SVG used as an <img> may not animate). */
function auroraSVG(uid,x,y,w,h){
  const s=w/800;
  return `<g class="aurora-light" pointer-events="none" transform="translate(${x} ${y}) scale(${s.toFixed(4)} ${(h/220).toFixed(4)})">
    <defs><linearGradient id="au-m${uid}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b9ffe1" stop-opacity=".1"/><stop offset=".45" stop-color="#6bc5b8" stop-opacity=".7"/><stop offset="1" stop-color="#6bc5b8" stop-opacity="0"/></linearGradient>
    <linearGradient id="au-l${uid}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d7c1ff" stop-opacity=".05"/><stop offset=".45" stop-color="#ad8cd4" stop-opacity=".55"/><stop offset="1" stop-color="#ad8cd4" stop-opacity="0"/></linearGradient>
    <linearGradient id="au-g${uid}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff1b1" stop-opacity="0"/><stop offset=".5" stop-color="#d9e39e" stop-opacity=".42"/><stop offset="1" stop-color="#d9e39e" stop-opacity="0"/></linearGradient>
    <linearGradient id="au-e${uid}"><stop stop-color="white" stop-opacity="0"/><stop offset=".12" stop-color="white"/><stop offset=".88" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <mask id="au-k${uid}"><rect width="800" height="220" fill="url(#au-e${uid})"/></mask></defs>
    <g class="aurora-strength" mask="url(#au-k${uid})">
      <path class="aurora-band" d="M30 67 C155 5 243 123 385 70 S620 12 770 49 L770 130 C615 89 531 151 389 150 S156 65 30 142Z" fill="url(#au-m${uid})"/>
      <path class="aurora-band b2" d="M35 107 C180 47 260 153 407 102 S625 75 765 90 L765 171 C623 139 538 178 409 185 S175 99 35 184Z" fill="url(#au-l${uid})"/>
      <path class="aurora-band b3" d="M33 35 C170 0 270 89 409 46 S633 17 767 33 L767 94 C630 63 542 118 405 113 S165 42 33 100Z" fill="url(#au-g${uid})"/>
      <g class="aurora-spark" fill="#fff4d3"><circle cx="95" cy="44" r="1.7"/><circle cx="289" cy="54" r="1.3"/><circle cx="537" cy="32" r="1.6"/><circle cx="711" cy="72" r="1.2"/></g>
    </g></g>`;
}

/* ---- the view through the window and the glass door, per theme ---- */
function outsideViewSVG(x,y,w,h,T,L,uid,clip,theme){
  const g=y+h*.78;
  const skyline=(fill)=>`<path d="M${x} ${g} L${x} ${y+h*.58} l${w*.1} 0 l0 ${-h*.12} l${w*.12} 0 l0 ${h*.06} l${w*.1} 0 l0 ${-h*.2} l${w*.14} 0 l0 ${h*.14} l${w*.1} 0 l0 ${-h*.06} l${w*.16} 0 l0 ${h*.12} l${w*.12} 0 l0 ${-h*.08} l${w*.16} 0 L${x+w} ${g} Z" fill="${fill}"/>`;
  const trees=(c1,c2)=>`<g fill="${c1}"><circle cx="${x+w*.16}" cy="${g-h*.08}" r="${h*.17}"/><circle cx="${x+w*.42}" cy="${g-h*.04}" r="${h*.13}"/><circle cx="${x+w*.86}" cy="${g-h*.06}" r="${h*.18}"/></g><g fill="${c2}"><circle cx="${x+w*.3}" cy="${g}" r="${h*.12}"/><circle cx="${x+w*.68}" cy="${g+h*.02}" r="${h*.14}"/></g>`;
  const dots=(c,pts,r)=>`<g fill="${c}">${pts.map(([a,b])=>`<circle cx="${(x+w*a).toFixed(1)}" cy="${(y+h*b).toFixed(1)}" r="${r}"/>`).join("")}</g>`;
  let dayTrees=trees("#8CBF6A","#6FA455"),nightTrees=trees("#2F4A3A","#284033"),ground="#A7CF7E",nightGround="#2E4A33",extra="",nightExtra="";
  if(theme==="kyoto"){dayTrees=trees("#E0663A","#C9452E")+dots("#F2A23A",[[.2,.55],[.5,.6],[.78,.5]],2.4);ground="#B9B49A";
    extra=`<path d="M${x+w*.55} ${g} v${-h*.12} h-3 l2 -3 h-6 l2 3 h-3 v${h*.12}z" fill="#8F8A7C"/>`;nightTrees=trees("#5A2E2A","#46241F");}
  if(theme==="halloween"){dayTrees=trees("#D9822B","#B4562A");ground="#7B5A3A";
    extra=dots("#F2B33D",[[.14,.62],[.3,.5],[.62,.56],[.86,.62]],1.6);nightTrees=trees("#4A2B26","#3A2320");nightExtra=dots("#FFB347",[[.14,.62],[.3,.5],[.62,.56],[.86,.62]],1.6);}
  if(theme==="spring"){dayTrees=trees("#F4B6C8","#EE9AB8")+dots("#FFF",[[.2,.5],[.45,.62],[.8,.52]],1.4);ground="#B7D88E";nightTrees=trees("#6B4A62","#5B3D54");}
  if(theme==="christmas"){dayTrees=`<g fill="#E9F1F5">${[[.16,.42],[.84,.4],[.5,.48]].map(([a,b])=>`<path d="M${x+w*a} ${y+h*b} l${w*.08} ${h*.34} h${-w*.16} z"/>`).join("")}</g>`;ground="#F4F8FB";
    extra=dots("#FFF",[[.1,.2],[.3,.34],[.55,.16],[.72,.3],[.9,.12],[.4,.55],[.65,.6]],1.3);nightTrees=dayTrees.replace("#E9F1F5","#C9D6E2");nightGround="#DCE5EE";nightExtra=extra;}
  const day=`<g class="cafe-window-day"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${L.daySky}"/>
    <circle cx="${x+w*.78}" cy="${y+h*.2}" r="${Math.min(w,h)*.09}" fill="#FFE27A"/>
    ${skyline(theme==="halloween"?"#C9B6A6":"#C9D9E6")}${dayTrees}<rect x="${x}" y="${g}" width="${w}" height="${y+h-g}" fill="${ground}"/>${extra}</g>`;
  const night=`<g class="cafe-window-night"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${L.nightSky}"/>
    <circle cx="${x+w*.78}" cy="${y+h*.2}" r="${Math.min(w,h)*.08}" fill="#F2E8C8"/><circle cx="${x+w*.82}" cy="${y+h*.18}" r="${Math.min(w,h)*.07}" fill="${L.nightSky}"/>
    ${dots("#F2E8C8",[[.2,.16],[.38,.28],[.55,.12]],.9)}${skyline("#2B3A5A")}
    ${dots("#FFD58A",[[.13,.64],[.47,.52],[.8,.62]],1.2)}${nightTrees}<rect x="${x}" y="${g}" width="${w}" height="${y+h-g}" fill="${nightGround}"/>${nightExtra}</g>`;
  return `<g clip-path="url(#${clip})">${day}${night}</g>`;
}

/* ---- per-theme dressing (part of each café theme, not shop items) ---- */
function garlandSVG(theme,x0,x1,y,sag=9){
  const ink="#463A54";const n=Math.max(4,Math.round((x1-x0)/10));let s=`<path d="M${x0} ${y} Q${(x0+x1)/2} ${y+sag*2} ${x1} ${y}" fill="none" stroke="#5E8A47" stroke-width="1.8"/>`;
  for(let i=0;i<=n;i++){const t=i/n,x=x0+(x1-x0)*t,yy=y+sag*4*t*(1-t)+1.5;
    if(theme==="christmas")s+=`<ellipse cx="${x}" cy="${yy}" rx="6" ry="3.2" fill="${i%2?"#3E7055":"#2F5A43"}" stroke="${ink}" stroke-width=".5" transform="rotate(${i%2?24:-24} ${x} ${yy})"/>${i%2===0?`<circle cx="${x+1.5}" cy="${yy+2.6}" r="2" fill="#C0392B" stroke="${ink}" stroke-width=".6"/>`:""}`;
    else if(theme==="halloween"||theme==="kyoto")s+=`<path transform="translate(${x} ${yy}) scale(1.45)" d="M0 -3 l1.6 2.2 2.6 -.6 -1 2.4 2 1.6 -2.6 .6 0 2.6 -2.6 -1.4 -2.6 1.4 0 -2.6 -2.6 -.6 2 -1.6 -1 -2.4 2.6 .6 z" fill="${["#D9542B","#E8891D","#C9452E","#F2B33D"][i%4]}" stroke="${ink}" stroke-width=".4"/>`;
    else if(theme==="spring")s+=`<g fill="${i%2?"#F7C6D6":"#F2A8C0"}" stroke="${ink}" stroke-width=".5"><circle cx="${x}" cy="${yy}" r="3.6"/><circle cx="${x+3.8}" cy="${yy+2.2}" r="2.8"/></g><circle cx="${x+.6}" cy="${yy+.3}" r="1.1" fill="#F2B33D"/>`;
  }
  if(theme==="christmas")s+=[x0+8,x1-8].map(x=>`<g transform="translate(${x} ${y+3})"><path d="M0 0 q-6 -5 -6 1 q0 4 6 -1 q6 5 6 -1 q0 -6 -6 1 M0 0 l-3 8 M0 0 l3 8" stroke="#C0392B" stroke-width="2" fill="none" stroke-linecap="round"/></g>`).join("");
  return `<g class="theme-garland">${s}</g>`;
}
function themeDressingBack(theme,ctx){
  const G=CAFE_GEO,ink="#463A54",W=CAFE_W;let s="";
  if(theme==="spring")s+=garlandSVG("spring",-4,W+4,11)+`<g class="wisteria">${[16,104,206].map(x=>`<g fill="#B79AD8" stroke="${ink}" stroke-width=".4">${[0,1,2,3,4].map(i=>`<circle cx="${x+(i%2)*2}" cy="${12+i*4}" r="${2.4-i*.3}"/>`).join("")}</g>`).join("")}</g>`;
  if(theme==="halloween")s+=garlandSVG("halloween",-4,W+4,11);
  if(theme==="kyoto")s+=garlandSVG("kyoto",-4,110,11)+garlandSVG("kyoto",220,306,11,6);
  if(theme==="christmas")s+=garlandSVG("christmas",-4,W+4,11)+`<g class="door-wreath"><circle cx="${G.door.x+G.door.w/2}" cy="${G.door.y+26}" r="8" fill="none" stroke="#2F5A43" stroke-width="4"/><circle cx="${G.door.x+G.door.w/2}" cy="${G.door.y+26}" r="8" fill="none" stroke="#3E7055" stroke-width="1.6" stroke-dasharray="2 3"/><path d="M${G.door.x+G.door.w/2-3} ${G.door.y+34} l3 -3 l3 3" fill="#C0392B"/></g>`;
  /* pumpkins by the back counter and on the top shelf */
  if(theme==="halloween")s+=[[150,161,9],[204,161,7],[260,161,6],[60,40,5.4]].map(([x,y,r])=>`<g><ellipse cx="${x}" cy="${y-r}" rx="${r*1.25}" ry="${r}" fill="#E8891D" stroke="${ink}" stroke-width="1"/><path d="M${x} ${y-2*r} v${r} M${x-r*.5} ${y-1.8*r} q-1 ${r*.8} 0 ${r*1.6} M${x+r*.5} ${y-1.8*r} q1 ${r*.8} 0 ${r*1.6}" stroke="#B4562A" stroke-width=".8" fill="none"/><path d="M${x} ${y-2*r} l1 -2.4" stroke="#5E8A47" stroke-width="1.4"/></g>`).join("");
  return s;
}
function themeDressingFront(theme){
  const R=CAFE_GEO.bar,B=CAFE_GEO.bCounter,ink="#463A54";let s="";
  if(theme==="christmas")s+=garlandSVG("christmas",R.x+4,R.x+R.w-4,R.face+3,6);
  if(theme==="spring")s+=`<g class="petals" fill="#F4B6C8" opacity=".85">${[[30,250],[90,282],[150,262],[210,290],[300,278],[250,258],[60,296]].map(([x,y],i)=>`<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.3" transform="rotate(${i*40} ${x} ${y})"/>`).join("")}</g>`;
  if(theme==="halloween")s+=`<g>${[[B.w-12,B.top,5]].map(([x,y,r])=>`<ellipse cx="${x}" cy="${y-r}" rx="${r*1.25}" ry="${r}" fill="#E8891D" stroke="${ink}" stroke-width="1"/><path d="M${x} ${y-2*r} l1 -2.4" stroke="#5E8A47" stroke-width="1.4"/>`).join("")}</g>`;
  if(theme==="kyoto")s+=`<g><rect x="${B.w-16}" y="${B.top-14}" width="9" height="14" rx="2" fill="#2E4A7A" stroke="${ink}" stroke-width=".8"/><path d="M${B.w-14} ${B.top-14} q-2 -8 3 -12 M${B.w-11} ${B.top-14} q4 -6 8 -6" stroke="#8A5A2E" stroke-width=".8" fill="none"/>${[[B.w-12,B.top-26],[B.w-5,B.top-20]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.4" fill="#F7D6E0" stroke="${ink}" stroke-width=".4"/>`).join("")}</g>`;
  return s;
}
/* pendant lamps change with the theme: paper lanterns in Kyoto */
function pendantSVG(theme,x,ink){
  if(theme==="kyoto")return `<g class="pendant"><path d="M${x} 9 v6" stroke="${ink}" stroke-width=".9"/><ellipse cx="${x}" cy="23" rx="7" ry="8.4" fill="#FBF3E2" stroke="${ink}" stroke-width="1.1"/><path d="M${x-6} 20 h12 M${x-6.6} 24 h13.2 M${x-6} 28 h12" stroke="#E4D3B5" stroke-width=".8"/><rect x="${x-3}" y="13.6" width="6" height="2" fill="#8A5A2E"/><rect x="${x-3}" y="30.6" width="6" height="2" fill="#8A5A2E"/></g>`;
  const c=theme==="spring"?"#F2C6D2":theme==="halloween"?"#2E2A36":theme==="christmas"?"#D8A521":theme==="foodtruck"?"#3E7055":"#3E7055";
  return `<g class="pendant"><path d="M${x} 9 v10" stroke="${ink}" stroke-width="1"/><path d="M${x-9} 28 q9 -12 18 0 z" fill="${c}" stroke="${ink}" stroke-width="1.4"/><ellipse cx="${x}" cy="28.5" rx="3.6" ry="1.8" fill="#FFE7A8"/></g>`;
}

/* ---- the back of the café: walls, window, door, back bar, wall decor ---- */
function cafeBackSVG(uid,ctx){
  const {T,L,item,wallFill,floorFill,theme}=ctx,G=CAFE_GEO,W=G.window,D=G.door,CW=CAFE_W;
  const wood=theme==="kyoto"?"#6E4A2E":"#B37B47",woodD=theme==="kyoto"?"#4E331F":"#8A5A2E",ink="#463A54",trim=shade(T.counter,-.18);
  const windowI=item("window"),shelfI=item("shelf"),displayI=item("display"),wallart=item("wallart"),menuI=item("menu"),rugI=item("rug"),lightsI=item("lights"),lampI=item("lamp"),bunting=item("bunting");
  const pavilion=theme==="foodtruck",stained=windowI&&windowI.id==="window_stained";
  let s=`<rect x="-320" width="${CW+640}" height="${G.wallBottom}" fill="${wallFill}"/>
  <rect x="-320" y="${G.wallBottom}" width="${CW+640}" height="${CAFE_H-G.wallBottom+80}" fill="${floorFill}"/>
  <g class="floor-lines" stroke="${ink}" stroke-width=".8" opacity=".09"><path d="M-320 180 H650 M-320 206 H650 M-320 236 H650 M-320 270 H650"/><path d="M82 160 L52 300 M165 160 V300 M248 160 L278 300"/></g>`;
  if(pavilion){
    /* Sunny Park Pavilion: open sides onto the park instead of a back wall */
    s+=`<clipPath id="pk${uid}"><rect x="-320" y="0" width="${CW+640}" height="${G.wallBottom-26}"/></clipPath>
    <g clip-path="url(#pk${uid})">${outsideViewSVG(-60,0,CW+120,G.wallBottom-26,T,L,uid+"p",`pk${uid}`,"pavilion")}
      <g class="cafe-window-day"><rect x="-320" y="${G.wallBottom-60}" width="${CW+640}" height="12" fill="#7FB7D8"/><path d="M130 ${G.wallBottom-60} q14 -12 28 0" fill="none" stroke="#C9B49A" stroke-width="2.4"/>
      ${[[14,70],[340,64],[226,76]].map(([x,y])=>`<g><rect x="${x-1.4}" y="${y}" width="2.8" height="${G.wallBottom-26-y}" fill="#5A4636"/><circle cx="${x}" cy="${y-10}" r="16" fill="#6FA455"/><circle cx="${x-8}" cy="${y-2}" r="10" fill="#8CBF6A"/></g>`).join("")}</g></g>
    <rect x="-320" y="${G.wallBottom-30}" width="${CW+640}" height="30" fill="#E9DCC0" stroke="${ink}" stroke-width="1.2"/>
    <path d="M-320 ${G.wallBottom-22} H650" stroke="#CBB892" stroke-width="2"/>`;
  }
  s+=`<rect x="-320" y="${G.wallBottom-5}" width="${CW+640}" height="7" fill="${woodD}" stroke="${ink}" stroke-width="1.4"/>
  <rect x="-320" width="${CW+640}" height="9" fill="${wood}" stroke="${ink}" stroke-width="1.6"/>
  <path d="M-320 9 H650" stroke="${woodD}" stroke-width="2"/>
  <rect x="114" y="9" width="5" height="${G.wallBottom-14}" fill="${wood}" stroke="${ink}" stroke-width="1.2"/>
  <rect x="308" y="9" width="6" height="${G.wallBottom-14}" fill="${wood}" stroke="${ink}" stroke-width="1.2"/>`;
  if(pavilion)s+=`<path d="M-320 9 ${Array.from({length:86},(_,i)=>`q6 9 12 0`).join(" ")}" transform="translate(${-320+320} 0)" fill="#F4EAD8" stroke="${ink}" stroke-width="1"/>`;
  /* window (indoor themes) */
  s+=`<clipPath id="wv${uid}"><rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="3"/></clipPath>
  <clipPath id="dv${uid}"><rect x="${D.x+5}" y="${D.y+6}" width="${D.w-10}" height="${D.h-10}" rx="2"/></clipPath>`;
  if(!pavilion){
    if(stained)s+=decorImg("window_stained",W.x-2,W.y-6,W.w+4,W.h+12,{anchor:"middle"});
    else{
      s+=`<rect x="${W.x-4}" y="${W.y-4}" width="${W.w+8}" height="${W.h+8}" rx="4" fill="${wood}" stroke="${ink}" stroke-width="2"/>
      ${outsideViewSVG(W.x,W.y,W.w,W.h,T,L,uid,`wv${uid}`,theme)}
      <g stroke="${wood}" stroke-width="3"><path d="M${W.x+W.w/2} ${W.y} V${W.y+W.h} M${W.x} ${W.y+W.h*.48} H${W.x+W.w}"/></g>
      ${theme==="kyoto"?`<g stroke="${wood}" stroke-width="1.2"><path d="M${W.x+W.w/4} ${W.y} V${W.y+W.h} M${W.x+W.w*.75} ${W.y} V${W.y+W.h} M${W.x} ${W.y+W.h*.24} H${W.x+W.w} M${W.x} ${W.y+W.h*.72} H${W.x+W.w}"/></g>`:""}
      <rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="3" fill="none" stroke="${ink}" stroke-width="1.6"/>
      <rect x="${W.x-7}" y="${W.y+W.h+2}" width="${W.w+14}" height="5" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.4"/>`;
      if(windowI&&windowI.id==="window_awning")s+=decorImg("window_awning",W.x-14,W.y-17,W.w+28,W.h+26,{anchor:"top"});
    }
    if(windowI&&windowI.id==="flowerbox")s+=decorImg("flowerbox",W.x-6,W.y+W.h-8,W.w+12,24);
  }else if(windowI)s+=decorImg(windowI.id==="flowerbox"?"flowerbox":windowI.id,W.x,W.y+10,W.w,W.h-16,{anchor:windowI.id==="flowerbox"?"bottom":"middle"});
  /* the big glass door (an open arch in the pavilion) */
  if(pavilion){
    s+=`<rect x="${D.x}" y="${D.y}" width="${D.w}" height="${D.h}" fill="none"/><path d="M${D.x} ${G.wallBottom} V${D.y+16} q${D.w/2} -16 ${D.w} 0 V${G.wallBottom}" fill="none" stroke="${wood}" stroke-width="5"/><path d="M${D.x} ${G.wallBottom} V${D.y+16} q${D.w/2} -16 ${D.w} 0 V${G.wallBottom}" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
  }else{
    s+=`<rect x="${D.x}" y="${D.y}" width="${D.w}" height="${D.h}" fill="${wood}" stroke="${ink}" stroke-width="2"/>
    ${outsideViewSVG(D.x+5,D.y+6,D.w-10,D.h-10,T,L,uid+"d",`dv${uid}`,theme)}
    <g class="door-leaf"><rect x="${D.x+5}" y="${D.y+6}" width="${D.w-10}" height="${D.h-10}" fill="#BFE3EA" opacity=".26" stroke="${theme==="kyoto"?"#4E331F":"#5C8A6E"}" stroke-width="3"/>
      <path d="M${D.x+10} ${D.y+18} l10 -8 M${D.x+10} ${D.y+30} l16 -13" stroke="#FFF" stroke-width="1.6" opacity=".7"/>
      <rect x="${D.x+9}" y="${D.y+70}" width="3" height="15" rx="1.4" fill="#D8A521" stroke="${ink}" stroke-width=".8"/></g>
    <path d="M${D.x+D.w/2} ${D.y-1} v5" stroke="${ink}" stroke-width="1"/><path d="M${D.x+D.w/2-3.4} ${D.y+10} q3.4 -7 6.8 0 z" fill="#D8A521" stroke="${ink}" stroke-width="1" class="door-bell"/>`;
  }
  /* the barista's back bar: shelves, espresso machine, grinder, cups */
  const purchasedShelf=shelfI?decorImg(shelfI.id,8,18,72,26):"";
  s+=`<g class="backbar">
    <rect x="4" y="42" width="98" height="5" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.4"/>
    ${purchasedShelf||`<g stroke="${ink}" stroke-width="1.1"><rect x="12" y="28" width="10" height="14" rx="2" fill="#F4EAD8"/><rect x="26" y="25" width="11" height="17" rx="2" fill="#E9C9A0"/><rect x="41" y="29" width="10" height="13" rx="2" fill="#F4EAD8"/><path d="M58 42 q0 -10 8 -10 q8 0 8 10 z" fill="#7FA65A"/><path d="M80 42 l2 -8 l8 0 l2 8z" fill="#C86B4A"/></g>`}
    <rect x="4" y="68" width="98" height="5" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.4"/>
    <g stroke="${ink}" stroke-width="1.1">${[12,24,36,48,60].map(x=>`<path d="M${x} 68 v-7 h9 v7" fill="#FFF"/><path d="M${x+9} 62 q3 0 3 3 q0 2 -3 2" fill="none"/>`).join("")}</g>
    <rect x="2" y="118" width="106" height="${G.wallBottom-118}" fill="${trim}" stroke="${ink}" stroke-width="1.6"/>
    <rect x="0" y="114" width="110" height="6" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.6"/>
    <g class="espresso">
      <rect x="6" y="80" width="54" height="34" rx="5" fill="#E8DCC4" stroke="${ink}" stroke-width="2"/>
      <rect x="6" y="80" width="54" height="8" rx="4" fill="#C0392B" stroke="${ink}" stroke-width="1.4"/>
      <path d="M10 76 h46" stroke="${ink}" stroke-width="1.2"/><g stroke="${ink}" stroke-width=".9" fill="#FFF"><rect x="12" y="71" width="7" height="5" rx="1"/><rect x="22" y="71" width="7" height="5" rx="1"/><rect x="32" y="71" width="7" height="5" rx="1"/></g>
      <circle cx="52" cy="94" r="3.2" fill="#FFF" stroke="${ink}" stroke-width="1"/><path d="M52 94 l1.6 -1.6" stroke="${ink}" stroke-width=".8"/>
      <path d="M13 92 h12 l-2 4 h-8 z M29 92 h12 l-2 4 h-8 z" fill="#6E6A72" stroke="${ink}" stroke-width="1"/>
      <path d="M25 94.5 h7 M41 94.5 h6" stroke="#2E2A36" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M14 107 h8 l-1 5 q-3 1.6 -6 0 z M30 107 h8 l-1 5 q-3 1.6 -6 0 z" fill="#FFF" stroke="${ink}" stroke-width="1"/>
      <rect x="9" y="112" width="44" height="2.4" rx="1" fill="#9A9AA6" stroke="${ink}" stroke-width=".7"/>
      <path d="M56 100 l4 9" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
    </g>
    <path class="steam" d="M60 104 q2 -4 0 -8 q-2 -4 1 -7" fill="none" stroke="#FFF" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="64" y="88" width="15" height="26" rx="3" fill="#2E2A36" stroke="${ink}" stroke-width="1.6"/><path d="M65 88 l2 -10 l9 0 l2 10z" fill="#6B4A36" stroke="${ink}" stroke-width="1.2"/>
    ${displayI&&displayI.id==="shelf_kegs"?"":`<g stroke="${ink}" stroke-width="1"><rect x="86" y="104" width="9" height="10" rx="1.5" fill="#FFF"/><rect x="87" y="96" width="7" height="8" rx="1.5" fill="#FFF"/><rect x="88" y="89" width="5" height="7" rx="1.5" fill="#FFF"/></g>`}
  </g>`;
  if(displayI&&displayI.id==="mug_rack")s+=decorImg("mug_rack",56,46,46,18);
  if(displayI&&displayI.id==="shelf_kegs")s+=decorImg("shelf_kegs",72,90,38,25);
  if(displayI&&displayI.id==="jukebox")s+=decorImg("jukebox",222,100,28,58)+jukeboxFX(222,100,28,58);
  /* wall art and the menu board between the window and the door */
  if(wallart)s+=wallart.id==="mural_market"?decorImg("mural_market",220,30,70,34,{anchor:"middle"}):decorImg(wallart.id,224,26,40,46,{anchor:"middle"});
  if(!(wallart&&wallart.id==="mural_market"))s+=menuI?decorImg("menu_chalk",268,24,34,54,{anchor:"middle"}):`<g><rect x="272" y="28" width="26" height="38" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.4"/><rect x="274.5" y="30.5" width="21" height="33" fill="#2E3A33"/><path d="M278 38 h14 M278 45 h10 M278 52 h12" stroke="#F4EAD8" stroke-width="1.1" opacity=".7"/></g>`;
  else if(menuI)s+=decorImg("menu_chalk",270,70,30,40,{anchor:"middle"});
  /* wall plants (sunny), theme dressing, pendant lamps */
  if(theme==="sunny"||theme==="foodtruck")s+=`<g class="vines" stroke="${ink}" stroke-width=".9"><path d="M4 9 q4 18 0 30 q-4 12 2 26" fill="none" stroke="#5E8A47" stroke-width="1.4"/>${[[5,16],[2,28],[6,40],[3,52]].map(([x,y])=>`<ellipse cx="${x+3}" cy="${y}" rx="4" ry="2.4" fill="#7FA65A" transform="rotate(-30 ${x+3} ${y})"/>`).join("")}
    <path d="M312 9 q-4 16 1 28 q4 12 -2 22" fill="none" stroke="#5E8A47" stroke-width="1.4"/>${[[307,18],[313,30],[306,44],[312,56]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="4" ry="2.4" fill="#7FA65A" transform="rotate(25 ${x} ${y})"/>`).join("")}</g>`;
  s+=themeDressingBack(theme,ctx);
  if(!lightsI)s+=[152,190].map(x=>pendantSVG(theme,x,ink)).join("");
  if(rugI)s+=decorImg(rugI.id,104,262,110,30,{anchor:"middle"});
  if(lightsI&&lightsI.id==="aurora")s+=auroraSVG(uid,124,8,184,62);
  if(bunting)s+=decorImg("bunting_rainbow",218,10,88,20,{anchor:"top"});
  if(lightsI&&lightsI.id==="fairylights")s+=hangingLightsSVG("fairy",uid,{x0:126,x1:214,y:12,sag:5,count:8});
  if(lightsI&&lightsI.id==="stars_paper")s+=decorImg("stars_paper",124,10,90,16,{anchor:"top"});
  if(lightsI&&lightsI.id==="neon_open")s+=`<g class="lanternglow"><rect x="146" y="12" width="50" height="16" rx="7" fill="none" stroke="#F26BA8" stroke-width="2.4"/><text x="171" y="24" text-anchor="middle" font-size="10" font-weight="800" fill="#F26BA8" font-family="'Baloo 2',cursive">OPEN</text></g>`;
  if(lampI&&lampI.id==="lantern_paper")s+=hangingLightsSVG("lantern",uid,{x0:6,x1:110,y:12,sag:6,count:5});
  return s;
}

/* ---- in front of the queue: both counters and what stands on them ---- */
function cafeFrontSVG(uid,ctx){
  const {T,item,counterFill,theme}=ctx,G=CAFE_GEO,B=G.bCounter,R=G.bar,ink="#463A54";
  const panel=shade(T.counter,-.06),panelD=shade(T.counter,-.26),topEdge=theme==="sunny"?shade(T.counter,.25):"#F2E6D2";
  const counterI=item("counter"),displayI=item("display"),lampI=item("lamp"),stoolI=item("stool"),plantI=item("plant");
  const marble=counterI&&counterI.id==="counter_marble";
  const top=marble?counterFill:topEdge;
  const boards=(x0,x1,y0,y1)=>{let p="";for(let x=x0+12;x<x1-6;x+=13)p+=`M${x} ${y0+4} V${y1-4} `;return `<path d="${p}" stroke="${panelD}" stroke-width="1.1" opacity=".55"/>`;};
  /* the Marble Counter: marble top and a marble front with brass trim */
  const counter=(x,w,topY,face,bottom,cls)=>`<g class="${cls}">
    <rect x="${x}" y="${face}" width="${w}" height="${bottom-face}" fill="${marble?counterFill:panel}" stroke="${ink}" stroke-width="2"/>
    ${marble?`<rect x="${x+7}" y="${face+7}" width="${w-14}" height="${bottom-face-20}" rx="2" fill="none" stroke="#C99A3A" stroke-width="1.4"/><path d="M${x} ${face+2} H${x+w}" stroke="#C99A3A" stroke-width="1.6"/>`:boards(x,x+w,face,bottom)}
    <rect x="${x}" y="${bottom-6}" width="${w}" height="6" fill="${panelD}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M${x-3} ${topY} H${x+w+3} L${x+w+3} ${face} H${x-3} Z" fill="${top}" stroke="${ink}" stroke-width="2"/>
    <path d="M${x-1} ${topY+2} H${x+w+1}" stroke="#FFF" stroke-width="1.4" opacity=".55"/></g>`;
  let s=counter(B.x,B.w-4,B.top,B.face,B.bottom,"barista-counter");
  /* the customer bar: marble top, darker panelled front, brass foot rail */
  const barFront=shade(T.counter,-.22),barLine=shade(T.counter,-.42);
  s+=`<g class="customer-bar">
    <rect x="${R.x+4}" y="${R.face}" width="${R.w-8}" height="${R.bottom-R.face}" fill="${barFront}" stroke="${ink}" stroke-width="2"/>
    ${(()=>{let p="";for(let x=R.x+14;x<R.x+R.w-10;x+=18)p+=`<rect x="${x}" y="${R.face+7}" width="12" height="${R.bottom-R.face-22}" rx="2" fill="none" stroke="${barLine}" stroke-width="1.2" opacity=".7"/>`;return p;})()}
    <rect x="${R.x+4}" y="${R.bottom-6}" width="${R.w-8}" height="6" fill="${barLine}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M${R.x+8} ${R.bottom-12} H${R.x+R.w-8}" stroke="#C99A3A" stroke-width="2.6" stroke-linecap="round"/><path d="M${R.x+8} ${R.bottom-12.8} H${R.x+R.w-8}" stroke="#F2D27A" stroke-width=".8" stroke-linecap="round"/>
    <path d="M${R.x-3} ${R.top} H${R.x+R.w+3} L${R.x+R.w+3} ${R.face} H${R.x-3} Z" fill="${ctx.marbleFill}" stroke="${ink}" stroke-width="2"/>
    <path d="M${R.x-3} ${R.face} H${R.x+R.w+3}" stroke="${barLine}" stroke-width="1.6"/>
    <path d="M${R.x-1} ${R.top+2} H${R.x+R.w+1}" stroke="#FFF" stroke-width="1.4" opacity=".7"/></g>`;
  if(theme==="sunny"||theme==="foodtruck")s+=`<g stroke="${ink}" stroke-width=".8"><path d="M${R.x+R.w-14} ${R.top} q6 10 0 18 q-5 8 1 16" fill="none" stroke="#5E8A47" stroke-width="1.3"/>${[[R.x+R.w-12,R.top+6],[R.x+R.w-17,R.top+14],[R.x+R.w-11,R.top+24],[R.x+R.w-15,R.top+32]].map(([x,y],i)=>`<ellipse cx="${x}" cy="${y}" rx="3.6" ry="2.2" fill="${i%2?"#6FA455":"#7FA65A"}" transform="rotate(${i%2?30:-30} ${x} ${y})"/>`).join("")}</g>`;
  /* counter-top items on the barista counter */
  if(counterI&&counterI.id==="fountain_gold")s+=decorImg("fountain_gold",66,B.top-27,22,28)+fountainFX(66,B.top-27,22,28);
  if(displayI&&["cakedome","gumball","radio_retro"].includes(displayI.id))s+=decorImg(displayI.id,B.w-30,B.top-29,26,30);
  if(lampI&&lampI.id!=="lantern_paper")s+=decorImg(lampI.id,2,B.top-27,22,28);
  if(!lampI||lampI.id==="lantern_paper")s+=`<g><path d="M${R.x+R.w-22} ${R.top} h8 l-1.4 -9 q-2.6 -1.6 -5.2 0 z" fill="#F4EAD8" stroke="${ink}" stroke-width="1.1"/><circle cx="${R.x+R.w-18}" cy="${R.top-11}" r="3.4" fill="#F2F2F2" stroke="${ink}" stroke-width="1"/><circle cx="${R.x+R.w-20}" cy="${R.top-12}" r="1.2" fill="#F2B33D"/></g>`;
  s+=themeDressingFront(theme);
  /* stools in front of the customer bar */
  const stoolXs=[R.x+28,R.x+R.w-58];
  s+=stoolXs.map(x=>stoolI?decorImg(stoolI.id,x,R.bottom-36,30,56):
    `<g class="stool"><rect x="${x+5}" y="${R.bottom-30}" width="3.8" height="46" fill="#8A5A2E" stroke="${ink}" stroke-width="1.1"/><rect x="${x+21}" y="${R.bottom-30}" width="3.8" height="46" fill="#8A5A2E" stroke="${ink}" stroke-width="1.1"/><path d="M${x+6} ${R.bottom+2} h18" stroke="#8A5A2E" stroke-width="2.4"/><ellipse cx="${x+15}" cy="${R.bottom-32}" rx="15" ry="5.2" fill="${theme==="sunny"||theme==="foodtruck"?"#3E7055":shade(T.counter,-.1)}" stroke="${ink}" stroke-width="1.6"/><path d="M${x} ${R.bottom-32} v2.6 q15 6.4 30 0 v-2.6" fill="${theme==="sunny"||theme==="foodtruck"?"#2F5A43":shade(T.counter,-.3)}" stroke="${ink}" stroke-width="1.2"/></g>`).join("");
  if(plantI)s+=decorImg("plant_monstera",336,236,38,60);
  return s;
}

/* the café pet's bed sits on the floor in front of the barista counter */
function cafeBedSVG(ctx){
  const pb=ctx.item("petbed");if(!pb)return "";
  return decorImg(pb.id,CAFE_GEO.bed.x-34,CAFE_GEO.bed.y-32,68,36,{cls:"pet-furniture"});
}

function cafeSceneContext(p,themeOverride){
  const theme=themeOverride||p.settings.theme;
  const T=THEMES[theme]||THEMES.sunny,pl=p.placed.cafe||{};
  const item=slot=>pl[slot]?SHOP.find(s=>s.id===pl[slot])||null:null;
  const L=T.lighting||{daySky:"#BEE3F0",nightSky:"#172640",nightWash:"#25324A",nightOpacity:.15,lamp:"#FFD58A"};
  return {p,theme,T,L,item};
}
/* One café picture split into layers. Returns SVG strings for each layer;
   every layer shares the same 360×274 view box so they line up exactly. */
function cafeSceneLayers(context="stage",themeOverride){
  const ctx=cafeSceneContext(P(),themeOverride),uid=++cafeSceneUid;
  const {T,L,item}=ctx;
  const wallI=item("wallpaper"),floorI=item("floor"),counterI=item("counter");
  let defs=`<radialGradient id="hl${uid}"><stop stop-color="#ffce70" stop-opacity=".58"/><stop offset=".42" stop-color="#ffbc62" stop-opacity=".18"/><stop offset="1" stop-color="#ffc36c" stop-opacity="0"/></radialGradient>`;
  ctx.wallFill=T.wall;ctx.floorFill=T.floor;ctx.counterFill=shade(T.counter,.25);
  if(wallI&&DECOR_TILES.has(wallI.id)){defs+=tilePattern(`pw${uid}`,wallI.id,46);ctx.wallFill=`url(#pw${uid})`;}
  if(floorI&&DECOR_TILES.has(floorI.id)){defs+=tilePattern(`pf${uid}`,floorI.id,52);ctx.floorFill=`url(#pf${uid})`;}
  if(counterI&&counterI.id==="counter_marble"){defs+=tilePattern(`pc${uid}`,"counter_marble",40);ctx.counterFill=`url(#pc${uid})`;}
  defs+=tilePattern(`pm${uid}`,"counter_marble",34);ctx.marbleFill=`url(#pm${uid})`;
  const vb=`viewBox="0 0 ${CAFE_W} ${CAFE_H}" preserveAspectRatio="xMidYMax meet"`;
  const svg=(cls,body,extra="")=>`<svg ${vb} class="cafe-layer ${cls}" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;
  const nightGlow=`<radialGradient id="ng${uid}"><stop offset="0%" stop-color="${L.lamp}" stop-opacity=".34"/><stop offset="100%" stop-color="${L.lamp}" stop-opacity="0"/></radialGradient>`;
  const ambient=ctx.theme==="foodtruck"?"":"";
  return {
    back:svg("cafe-back",`<defs>${defs}</defs>${cafeBackSVG(uid,ctx)}${ambient}`),
    front:svg("cafe-front",`<defs>${defs}</defs>${cafeFrontSVG(uid,ctx)}${cafeBedSVG(ctx)}`),
    light:svg("cafe-light",`<defs>${nightGlow}</defs><rect class="cafe-night-wash" x="-320" width="${CAFE_W+640}" height="${CAFE_H}" fill="${L.nightWash}" style="--night-opacity:${L.nightOpacity}"/>
      <g class="cafe-night-lights"><ellipse cx="60" cy="40" rx="62" ry="44" fill="url(#ng${uid})"/><ellipse cx="262" cy="120" rx="70" ry="40" fill="url(#ng${uid})" opacity=".7"/><ellipse cx="168" cy="60" rx="40" ry="34" fill="url(#ng${uid})" opacity=".6"/></g>`,`pointer-events="none" style="--night-opacity:${L.nightOpacity}"`)
  };
}
/* A whole café in one box (menu, shop and theme previews). The barista
   and the café pet are placed at their real spots between the layers. */
function cafeSceneHTML(context="preview",{barista=null,baristaAttrs="",pet="",themeOverride=null,extraClass=""}={}){
  const Ls=cafeSceneLayers(context,themeOverride),G=CAFE_GEO;
  const pctX=x=>(x/CAFE_W*100).toFixed(3)+"%",pctY=v=>(v/CAFE_H*100).toFixed(3)+"%";
  let b="";
  if(barista&&barista.mode==="full"){const h=CAFE_BOX*G.barista.k,w=h*CHAR_ASPECT;
    b=`<div class="scene-barista full" ${baristaAttrs} style="left:${pctX(G.barista.x)};width:${pctX(w)};bottom:${pctY(CAFE_H-G.barista.feet-h*(16/500))}">${barista.html}</div>`;}
  else if(barista){const w=76,h=w*1.3,top=G.counterTopY-h*(112.5/130);
    b=`<div class="scene-barista waist" ${baristaAttrs} style="left:${pctX(G.barista.x)};width:${pctX(w)};bottom:${pctY(CAFE_H-top-h)}">${barista.html}</div>`;}
  const petW=CAFE_PBOX*100/110;
  return `<div class="scenebox ${extraClass}">${Ls.back}${b}${Ls.front}
    ${pet?`<div class="scene-pet" style="left:${pctX(G.bed.x)};width:${pctX(petW)};bottom:${pctY(CAFE_H-G.bed.y+3)}">${pet}</div>`:""}
    ${Ls.light}</div>`;
}
/* a still drawing from the character pack, showing one face */
function cafeCharStaticHTML(svgText,face="happy"){
  return svgText.replace(/data-expressions?="([a-z ]+)"/g,(m,list)=>`${m} opacity="${list.split(" ").includes(face)?1:0}"`)
    .replace(/data-eyes="([a-z]+)"/g,(m,e)=>`${m} opacity="${e==="blink"?0:1}"`);
}
/* the barista for a preview: the pack drawing for a ready-made barista
   wearing nothing from the shop, otherwise the customiser's drawing */
function cafeBaristaPreview(override){
  const p=P();
  if(override&&!CafeCustom.lib)return {html:override.html||override,mode:"waist"};
  /* a ready-made barista (also when trying on a shop accessory) keeps their own drawing */
  const oLook=override&&override.look,oId=oLook?cafeLookId(oLook):null;
  const id=override?(oId&&CAFE_CHAR_IDS.has(oId)&&AVATARS.some(x=>x.id===oId)&&!cafeOutfitFromShop(override.opts)?oId:null):cafeBaristaArtId(p);
  const t=id&&CafeArt.get("chars",id);
  if(t){const opts=override?override.opts:playerRenderOpts(p);
    if(!cafeWearsShop(opts))return {html:cafeCharStaticHTML(t,"happy"),mode:"full"};
    if(CafeCustom.lib){const d=cafeDressPack(t,override?oLook:playerLookFor(p,opts),opts);if(d)return {html:cafeCharStaticHTML(d,"happy"),mode:"full"};}
    CafeCustom.load().then(()=>cafeRefreshPreviews());}
  if(id){CafeArt.load("chars",id).then(()=>cafeRefreshPreviews());return {html:playerSVG("happy",88),mode:"waist"};}
  if(CafeCustom.lib){const o=override?override:null;
    const opts=o&&o.opts?o.opts:playerRenderOpts(p),look=o&&o.look?o.look:playerLookFor(p,opts);
    const c=cafeComposeCustom(look,opts);if(c)return {html:cafeCharStaticHTML(c,"happy"),mode:"full"};}
  CafeCustom.load().then(()=>cafeRefreshPreviews());
  return {html:override?(override.html||override):playerSVG("happy",88),mode:"waist"};
}
/* when art arrives after a preview was drawn, redraw just the barista */
function cafeRefreshPreviews(){
  document.querySelectorAll(".scenebox .scene-barista.waist[data-refreshable]").forEach(el=>{
    if(el.dataset.tryon)return;const b=cafeBaristaPreview();if(b.mode!=="full")return;const h=CAFE_BOX*CAFE_GEO.barista.k,w=h*CHAR_ASPECT;
    el.classList.replace("waist","full");el.innerHTML=b.html;el.style.width=(w/CAFE_W*100).toFixed(3)+"%";
    el.style.bottom=((CAFE_H-CAFE_GEO.barista.feet-h*(16/500))/CAFE_H*100).toFixed(3)+"%";});
}
/* Back-compatibility: callers that only want a single picture. */
function cafeScene(small,context="stage"){
  const Ls=cafeSceneLayers(context);
  return Ls.back.replace("</svg>","")+Ls.front.replace(/^<svg[^>]*>/,"").replace("</svg>","")+Ls.light.replace(/^<svg[^>]*>/,"");
}

/* character box: full-body art is 320×500; CAFE_BOX is its height in
   design units at k = 1 (someone standing in the open area) */
const CAFE_BOX=150, CHAR_ASPECT=320/500;

/* ============================================================
   Live stage: people and pets on the supplied joint rigs

   Motion comes from turning the drawings' own joints (character pack:
   arm/fore/hand, thigh/foot, head; pet pack: ears, head, tail, legs,
   wings) plus whole-body timing. Nothing is redrawn and nothing rolls
   or spins. Pet joints are clamped to the safe range written into each
   pet file (data-range), so limbs cannot swing far enough to separate.
   ============================================================ */
const CafeArt={txt:{},wait:{},
  key(kind,id){return kind+"/"+id;},
  get(kind,id){return this.txt[this.key(kind,id)]||null;},
  load(kind,id){
    const k=this.key(kind,id);
    if(this.txt[k])return Promise.resolve(this.txt[k]);
    if(!this.wait[k])this.wait[k]=fetch(`${ART_DIR}${kind}/${id}.svg`).then(r=>r.ok?r.text():null)
      .then(t=>{if(t&&t.indexOf("<svg")>=0){this.txt[k]=t;return t;}return null;}).catch(()=>null);
    return this.wait[k];
  },
  /* fetch quietly in the background so later arrivals appear instantly */
  preload(kind,ids){let i=0;const next=()=>{if(i>=ids.length)return;const id=ids[i++];this.load(kind,id).then(()=>setTimeout(next,40));};next();}
};
const CAFE_CHAR_IDS=new Set(["adeyemi","agnes","alien","amara","arjun","astronaut","baller","baxter","beekeeper","benji","callum","captain","cartographer","clive","clockwinder","contessa","dave","delacroix","desmond","detective","devereux","elowen","explorer","finn","firefighter","fox","freya","gardener","gondolier","gustav","hana","hero","iris","jiangshi","king","knight","kofi","leo","librarian","linebacker","marchetti","marcus","marigold","maya","mei","mummy","ninja","nora","okafor","okonkwo","osei","owl","petra","pharaoh","pirate","priyanka","queen","robot","ruth","scientist","solomon","steinberg","striker","tam","tomek","vampire","viking","wendy","whitfield","witch","wizard","yuki"]);
const cafeReduced=()=>{const p=typeof P==="function"&&P();return !!(p&&p.settings&&p.settings.motion==="reduced")||document.body.classList.contains("reduce");};

const STAGE={box:null,S:1,actors:new Set(),pets:new Set(),barista:null,bpet:null,raf:0,pausedAt:0,lastT:0,mounted:false};
const sx=x=>x*STAGE.S, sy=y=>y*STAGE.S;
function cafeMeasure(){const b=STAGE.box;if(!b)return;STAGE.S=(b.clientWidth||360)/CAFE_W;}
const CHAR_GROUND=484/500, PET_GROUND=100/110, CAFE_PBOX=54;

/* ---------- people ---------- */
const CAFE_PROP=/attach|bent|sceptre|book|ball|briefcase|shield|staff|oar|magnif|frame|watering|hose/;
function cafeMirrored(e,svg){for(let n=e;n&&n!==svg;n=n.parentNode){const t=n.getAttribute&&n.getAttribute("transform");if(t&&/scale\(\s*-1|matrix\(\s*-[\d.]+[\s,]+-?0[\s,]+-?0[\s,]/.test(t))return true;}return false;}
function cafeSetFace(svg,state){
  if(!svg)return;
  svg.querySelectorAll("[data-expression]").forEach(g=>g.setAttribute("opacity",g.getAttribute("data-expression").split(" ").includes(state)?"1":"0"));
  svg.querySelectorAll("[data-eyes]").forEach(e=>e.setAttribute("opacity",(e.getAttribute("data-eyes")==="blink")===(state==="blink")?"1":"0"));
  svg.querySelectorAll("[data-expressions]").forEach(e=>{const w=state==="blink"?"normal":state;e.setAttribute("opacity",e.getAttribute("data-expressions").split(" ").includes(w)?"1":"0");});
}
function cafeHandView(hand,v){if(!hand)return;const views=[...hand.querySelectorAll("[data-view]")];if(!views.length)return;
  const want=views.some(x=>x.getAttribute("data-view")===v)?v:"relaxed";views.forEach(x=>x.setAttribute("opacity",x.getAttribute("data-view")===want?"1":"0"));}
/* the game's expressions on the pack's four faces */
const CAFE_FACE={neutral:"normal",normal:"normal",happy:"happy",delighted:"happy",wow:"happy",thinking:"normal",sad:"concern",concern:"concern",blink:"blink"};

function cafeNewPerson(charId,{lane="b",x=0,feet=0,k=1,fallbackHTML=""}={}){
  const el=document.createElement("div");el.className="person idle";
  el.innerHTML=`<div class="inner"></div><div class="emoteslot"></div>`;
  const a={charId,el,inner:el.firstChild,svg:null,J:()=>null,x,feet,k,lane,face:"normal",ready:false,walk:null,hidden:false,fallbackHTML};
  STAGE.actors.add(a);cafePlace(a);
  return a;
}
/* put the drawing in (when the art has loaded) and find its joints */
function cafeDressPerson(a,svgText){
  if(!a||a.ready)return;
  if(!svgText){a.inner.innerHTML=a.fallbackHTML||"";a.el.classList.add("fallback");a.ready=true;return;}
  a.inner.innerHTML=svgText;const svg=a.inner.querySelector("svg");a.svg=svg;a.ready=true;
  const J=n=>svg.querySelector(`[data-joint="${n}"]`);a.J=J;
  ["l","r"].forEach(s=>{const arm=J("arm-"+s);if(!arm)return;const m=cafeMirrored(arm,svg);arm.style.setProperty("--flip",m?-1:1);
    const held=[...arm.querySelectorAll("[data-part]")].some(p=>CAFE_PROP.test(p.getAttribute("data-part")));if(held)arm.classList.add("holding");a["hold"+s]=held;a["mir"+s]=m;});
  a.waveSide=!a.holdr?"r":(!a.holdl?"l":null);
  a.bagSide=a.waveSide==="r"?(!a.holdl?"l":null):(a.waveSide==="l"&&!a.holdr?"r":null);
  if(a.waveSide){const s=a.waveSide,arm=J("arm-"+s),fore=J("fore-"+s);const out=(s==="r"?-1:1)*(a["mir"+s]?-1:1);
    /* the forearm joint sits at the sleeve hem in this art, so the arm stays
       straight and the wave comes from the wrist */
    const hand=J("hand-"+s);
    arm.classList.add("waver");arm.style.setProperty("--ra",out*34);if(hand){hand.classList.add("waverH");hand.style.setProperty("--wi",out);}
    a.el.style.setProperty("--tl",s==="r"?1:-1);}
  cafeSetFace(svg,a.face==="blink"?"normal":a.face);cafeBlinker(a);
}
function cafePlace(a){
  const h=CAFE_BOX*a.k,w=h*CHAR_ASPECT;
  a.el.style.width=sx(w).toFixed(1)+"px";a.el.style.height=sx(h).toFixed(1)+"px";
  a.el.style.transform=`translate(${sx(a.x-w/2).toFixed(1)}px,${sy(a.feet-h*CHAR_GROUND).toFixed(1)}px)`;
  const want=a.lane==="f"?STAGE.laneF:STAGE.laneB;
  if(want&&a.el.parentNode!==want)want.appendChild(a.el);
  /* front lane: nearer people are drawn over people further back */
  a.el.style.zIndex=String(Math.round(a.feet));
}
function cafeHeadTop(a){return a.feet-CAFE_BOX*a.k*.9;}
function cafeBlinker(a){
  const t=()=>{if(!a.svg||!a.svg.isConnected)return;
    if(a.face==="normal"&&!document.hidden){cafeSetFace(a.svg,"blink");setTimeout(()=>{if(a.face==="normal")cafeSetFace(a.svg,"normal");},140);}
    a.blinkT=setTimeout(t,3000+Math.random()*3500);};
  a.blinkT=setTimeout(t,900+Math.random()*2500);
}
function cafeFace(a,state,ms){if(!a)return;a.face=state;cafeSetFace(a.svg,state);clearTimeout(a.ft);if(ms)a.ft=setTimeout(()=>{a.face="normal";cafeSetFace(a.svg,"normal");},ms);}
function cafeAct(a,cls,ms){
  if(!a||cafeReduced())return;
  a.el.classList.remove("idle","walk","wave","hop","nod","bow");
  /* a wave cut short puts its hand back down (a hand holding the order is left alone) */
  if(a.handT){a.handT.forEach(clearTimeout);a.handT=null;if(a.J&&!a.carrying)cafeHandView(a.J("hand-"+a.waveSide),"relaxed");}
  void a.el.offsetWidth;a.el.classList.add(cls);
  if(cls==="wave"&&a.waveSide&&a.svg){const h=a.J("hand-"+a.waveSide);
    /* the hand turns back > side > open palm while it rises, and back again */
    a.handT=[[220,"edge"],[320,"palm"],[1460,"edge"],[1560,"relaxed"]].map(([t,v])=>setTimeout(()=>cafeHandView(h,v),t));}
  clearTimeout(a.actT);a.actT=setTimeout(()=>{a.el.classList.remove(cls);if(!a.walk)a.el.classList.add("idle");},ms);
}
function cafeGreet(a,ms=1800){if(!a)return;if(a.waveSide&&!a.carrying)cafeAct(a,"wave",ms);else cafeAct(a,"nod",1150);}
function cafeRemovePerson(a){if(!a)return;clearTimeout(a.blinkT);clearTimeout(a.ft);clearTimeout(a.actT);a.walk=null;a.el.remove();STAGE.actors.delete(a);}

/* Walk through waypoints {x,feet,k,lane}. Speed is 0.55 body-heights a
   second (feet don't slide); `fast` is used for leaving. Reduced motion
   moves people straight to the end with a short fade. */
function cafeWalk(a,pts,done,{fast=false}={}){
  if(!a)return;
  if(cafeReduced()||!STAGE.mounted){const p=pts[pts.length-1];Object.assign(a,{x:p.x,feet:p.feet,k:p.k??a.k,lane:p.lane||a.lane});cafePlace(a);a.walk=null;done&&setTimeout(done,30);return;}
  const segs=[];let px=a.x,pf=a.feet,pk=a.k;
  for(const p of pts){const k=p.k??pk,len=Math.hypot(p.x-px,(p.feet-pf)*1.4);segs.push({x0:px,f0:pf,k0:pk,x1:p.x,f1:p.feet,k1:k,lane:p.lane,len});px=p.x;pf=p.feet;pk=k;}
  a.el.classList.remove("idle","wave","hop","nod","bow");a.el.classList.add("walk");
  a.walk={segs,si:0,t:0,done,speed:CAFE_BOX*.55*(fast?1.8:1.4)};
}
function cafeStepWalker(a,dt){
  const w=a.walk;if(!w)return;
  let q=w.segs[w.si];
  const speed=w.speed*Math.max(.75,a.k);
  w.t+=q.len>0?speed*dt/q.len:1;
  if(w.t>=1){a.x=q.x1;a.feet=q.f1;a.k=q.k1;if(q.lane)a.lane=q.lane;w.si++;w.t=0;
    if(w.si>=w.segs.length){a.walk=null;a.el.classList.remove("walk");a.el.classList.add("idle");cafePlace(a);cafeTrackPush(a);const d=w.done;d&&d();return;}
    q=w.segs[w.si];}
  else{a.x=q.x0+(q.x1-q.x0)*w.t;a.feet=q.f0+(q.f1-q.f0)*w.t;a.k=q.k0+(q.k1-q.k0)*w.t;}
  a.el.style.setProperty("--dir",q.x1<q.x0-.5?-1:1);
  cafePlace(a);cafeTrackPush(a);
}
/* the route each customer walks is recorded so their pet can follow it */
function cafeTrackStart(a){a.path=[{x:a.x,feet:a.feet,lane:a.lane,s:0}];a.s=0;}
function cafeTrackPush(a){if(!a.path)return;const L=a.path[a.path.length-1];const dl=Math.hypot(a.x-L.x,(a.feet-L.feet)*1.4);
  if(dl>.4){a.s+=dl;a.path.push({x:a.x,feet:a.feet,lane:a.lane,s:a.s});if(a.path.length>600)a.path.splice(0,200);}}
function cafePathAt(a,s){const P_=a.path;if(s<=P_[0].s)return P_[0];
  for(let i=P_.length-1;i>0;i--){if(P_[i-1].s<=s){const q=P_[i-1],r=P_[i];const t=Math.min(1,(s-q.s)/((r.s-q.s)||1));return{x:q.x+(r.x-q.x)*t,feet:q.feet+(r.feet-q.feet)*t,lane:t<.5?q.lane:r.lane};}}
  return P_[P_.length-1];}

/* ---------- pets ---------- */
function cafePetKind(J){
  if(J.fl||J.hl)return "quad";
  if(J.wgl&&J.flipper&&!J.al)return "swim";
  if(J.wgl)return "bird";
  return "sit";
}
const CAFE_PET_TUNE={sloth:{spd:.4,jump:.3},loris:{spd:.55,jump:.55},hippo:{jump:.45,heavy:1},gorilla:{jump:.6,heavy:1},capybara:{jump:.5,heavy:1},wombat:{jump:.55,heavy:1},panda:{jump:.6,heavy:1},koala:{jump:.8},
  jumpingrat:{jump:1.45,hop:1},frog:{jump:1.45,hop:1},rabbit:{jump:1.35,hop:1},hollandlop:{jump:1.3,hop:1},squirrel:{jump:1.3},lemur:{jump:1.3},cat:{jump:1.3},lion:{jump:1.1},
  penguin:{rock:1.5},duck:{rock:1.25},owl2:{rock:.8},parrot:{headbang:1},pigeon:{headbang:1},chicken:{headbang:1}};
function cafeNewPet(petId,{lane="f",x=0,g=0,box=CAFE_PBOX,player=false}={}){
  const el=document.createElement("div");el.className="petactor";
  el.innerHTML=`<div class="pflip"><div class="pbody"></div></div><span class="playerpetemote" aria-hidden="true"></span>`;
  const pt={id:petId,el,flip:el.firstChild,body:el.firstChild.firstChild,svg:null,anims:[],J:{},faces:[],x,g,box,lane,dirX:-1,move:null,s:0,state:"idle",ready:false,player,mood:"normal"};
  STAGE.pets.add(pt);cafePetPlace(pt);
  return pt;
}
function cafeDressPet(pt,svgText,fallbackHTML){
  if(!pt||pt.ready)return;pt.ready=true;
  if(!svgText){pt.body.innerHTML=fallbackHTML||"";pt.el.classList.add("fallback");return;}
  pt.body.innerHTML=svgText;const svg=pt.body.querySelector("svg");pt.svg=svg;
  const q=n=>svg.querySelector(`[data-joint="${n}"]`);
  const map={sl:"arm-l",sr:"arm-r",el:"fore-l",er:"fore-r",pl:"paw-l",pr:"paw-r",al:"foot-l",ar:"foot-r",tail:"tail",earl:"ear-l",earr:"ear-r",neck:"head",
    fl:["leg-fl","leg-front-near"],fr:["leg-fr","leg-front-far"],hl:["leg-hl","leg-hind-near"],hr:["leg-hr","leg-hind-far"],wgl:["wing-l","flipper-l"],wgr:["wing-r","flipper-r"]};
  for(const k in map){const names=[].concat(map[k]);for(const n of names){const e=q(n);if(e){
    const [lo,hi]=(e.getAttribute("data-range")||"-20 20").split(/\s+/).map(Number);
    pt.J[k]={el:e,lo,hi,rest:Number(e.getAttribute("data-rest-angle"))||0};if(/flipper/.test(n))pt.J.flipper=true;break;}}}
  pt.kind=cafePetKind(pt.J);pt.t=Object.assign({spd:1,jump:1,rock:1},CAFE_PET_TUNE[pt.id]||{});
  pt.faces=[...svg.querySelectorAll("[data-expression]")];
  cafePetFace(pt,pt.mood||"normal");
  cafePetMeasure(pt);
}
function cafePetFace(pt,mood){pt.mood=mood;pt.faces.forEach(f=>f.setAttribute("opacity",f.getAttribute("data-expression")===mood?"1":"0"));}
function cafePetPlace(pt){
  const h=pt.box,w=h*100/110;
  pt.el.style.width=sx(w).toFixed(1)+"px";pt.el.style.height=sx(h).toFixed(1)+"px";
  pt.el.style.transform=`translate(${sx(pt.x-w/2).toFixed(1)}px,${sy(pt.g-h*PET_GROUND).toFixed(1)}px)`;
  /* only side-view animals face their walking direction; front-facing
     pets never flip, and nobody spins */
  pt.flip.style.transform=(pt.kind==="quad"||pt.kind==="bird")&&pt.dirX*pt.headDir<0?"scaleX(-1)":"";
  const want=pt.lane==="t"?STAGE.laneT:pt.lane==="b"?STAGE.laneB:STAGE.laneF;
  if(want&&pt.el.parentNode!==want)want.appendChild(pt.el);
  pt.el.style.zIndex=String(Math.round(pt.g)+1);
}
/* which way "outward" and "forward" turn each joint on screen (right-hand
   parts sit inside a mirror), measured once from the drawing itself */
function cafePetMeasure(pt){
  const svg=pt.svg,J=pt.J;if(!svg||!svg.isConnected)return;
  const tor=svg.querySelector("[data-actor]")||svg;const tr=tor.getBoundingClientRect();if(!tr.width){pt.needMeasure=true;return;}
  const bc={x:tr.left+tr.width/2};const hr=(J.neck?J.neck.el:tor).getBoundingClientRect(),hc={x:hr.left+hr.width/2};
  pt.headDir=Math.abs(hc.x-bc.x)>tr.width*.08?Math.sign(hc.x-bc.x):-1;
  for(const k in J){const j=J[k];if(!j||!j.el)continue;const m=j.el.getScreenCTM();if(!m)continue;const det=Math.sign(m.a*m.d-m.b*m.c)||1;const r=j.el.getBoundingClientRect();
    const v={x:r.left+r.width/2-m.e,y:r.top+r.height/2-m.f};const ref=(k==="earl"||k==="earr")?hc:bc;
    j.side=Math.sign(m.e-ref.x)||(/l$/.test(k)?-1:1);const vert=Math.abs(v.y)>=Math.abs(v.x)*.3;
    const towards=dx=>vert?dx*-Math.sign(v.y||1)*det:-Math.sign(v.x||1)*det*(dx===j.side?1:-1);
    j.out=towards(j.side);j.fwd=towards(pt.headDir);j.up=-Math.sign(v.x||j.side)*det;}
  pt.needMeasure=false;cafePetPlace(pt);
}
function PA(pt,el,frames,dur,o={}){if(!el)return;
  const a=el.animate(frames.map(f=>Object.assign({easing:"ease-in-out"},f)),{duration:dur,iterations:o.it??Infinity,delay:-((o.ph||0)*dur),fill:"both"});
  if(STAGE.pausedAt)a.pause();pt.anims.push(a);return a;}
/* rotate one joint; every angle is clamped to that joint's safe range */
function PR(pt,j,k,frames,dur,o){if(!j||!j.el||cafeReduced())return;
  PA(pt,j.el,frames.map(([of,d,ty,tx,ease])=>{const ang=Math.max(j.lo,Math.min(j.hi,j.rest+d*(k||1)));
    return {offset:of,transform:`translate(${tx||0}px,${ty||0}px) rotate(${ang.toFixed(2)}deg)`,easing:ease||"ease-in-out"};}),dur,o);}
function PB(pt,frames,dur,o){if(cafeReduced())return;PA(pt,pt.body,frames.map(([of,t,ease])=>({offset:of,transform:t,easing:ease||"ease-in-out"})),dur,o);}
function PF(pt,segs,dur,o){
  /* a mood face (tap, celebration) stays on through the movement that goes with it */
  if(pt.holdMood&&pt.holdUntil>performance.now())segs=[[0,pt.holdMood]];
  pt.faces.forEach(el=>{const st=el.getAttribute("data-expression");
  const kf=segs.map(([of,s])=>({offset:of,opacity:s===st?1:0,easing:"steps(1,end)"}));kf.push({offset:1,opacity:segs[segs.length-1][1]===st?1:0});PA(pt,el,kf,dur,o);});}
function petStop(pt){pt.anims.forEach(a=>a.cancel());pt.anims=[];}
const PM={
  idle(pt){const J=pt.J,d=4200;
    PB(pt,[[0,"scale(1,1)"],[.5,"scale(1.02,.98)"],[1,"scale(1,1)"]],d/2);
    PR(pt,J.tail,1,[[0,-6],[.5,6],[1,-6]],d/2);
    PR(pt,J.earl,J.earl&&J.earl.out,[[0,0],[.3,0],[.33,16],[.37,0],[1,0]],d);
    PR(pt,J.neck,1,[[0,0],[.55,0],[.62,5],[.85,5],[.92,0],[1,0]],d);
    PF(pt,[[0,"normal"],[.46,"blink"],[.5,"normal"]],d);},
  walk(pt){const J=pt.J,k=pt.kind,t=pt.t,hop=t.hop;
    const c=(hop?600:k==="quad"?700:k==="bird"?(pt.id==="penguin"?560:620):640)/t.spd;
    PF(pt,[[0,"normal"],[.62,"blink"],[.66,"normal"]],c*4);
    if(hop){PB(pt,[[0,"translateY(0) scale(1.07,.9)"],[.16,"translateY(-4%) scale(.94,1.08)","ease-out"],[.46,"translateY(-22%) scale(1,1)","ease-in"],[.76,"translateY(-2%) scale(.97,1.04)"],[.88,"translateY(0) scale(1.08,.89)"],[1,"translateY(0) scale(1.07,.9)"]],c);
      ["al","ar"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.16,-8],[.46,14,-1.5],[.76,4],[1,0]],c));
      ["earl","earr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.2,-6],[.55,12],[.85,-4],[1,0]],c));
      PR(pt,J.tail,J.tail&&J.tail.up,[[0,0],[.3,14],[.7,-8],[1,0]],c);return;}
    if(k==="quad"){const leg=(j,ph)=>j&&PR(pt,j,j.fwd,[[0,16],[.5,-16,0,0,"linear"],[.75,6,-1.6],[1,16]],c,{ph});
      leg(J.fl,0);leg(J.hr,0);leg(J.fr,.5);leg(J.hl,.5);
      PB(pt,[[0,"translateY(0)"],[.25,"translateY(-2.4%)"],[.5,"translateY(0)"],[.75,"translateY(-2.4%)"],[1,"translateY(0)"]],c);
      PR(pt,J.neck,1,[[0,0],[.25,2.5,.5],[.5,0],[.75,2.5,.5],[1,0]],c);PR(pt,J.tail,1,[[0,-14],[.5,14],[1,-14]],c);
      ["earl","earr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.3,6],[.55,0],[.8,6],[1,0]],c));return;}
    const rock=(k==="bird"?6:3.4)*t.rock;
    PB(pt,[[0,`translateY(0) rotate(${-rock}deg)`],[.25,`translateY(-${k==="bird"?3:4.5}%) rotate(0deg)`],[.5,`translateY(0) rotate(${rock}deg)`],[.75,`translateY(-${k==="bird"?3:4.5}%) rotate(0deg)`],[1,`translateY(0) rotate(${-rock}deg)`]],c);
    const foot=(j,ph)=>j&&PR(pt,j,j.out,[[0,0],[.25,10,-3],[.5,0],[1,0]],c,{ph});
    const lft=(J.al&&J.al.side<0)?"al":"ar",rgt=lft==="al"?"ar":"al";foot(J[rgt],0);foot(J[lft],.5);
    if(k==="bird"||k==="swim"){["wgl","wgr"].forEach(n=>{const j=J[n];if(j)PR(pt,j,j.out,[[0,2],[.25,j.side<0?12:3],[.5,2],[.75,j.side<0?3:12],[1,2]],c);});
      PR(pt,J.neck,1,[[0,0,0],[.25,0,t.headbang?1.6:.8],[.5,0,0],[.75,0,t.headbang?1.6:.8],[1,0,0]],c);}
    else{["sl","sr"].forEach(n=>{const j=J[n];if(j)PR(pt,j,j.out,[[0,j.side<0?10:-4],[.5,j.side<0?-4:10],[1,j.side<0?10:-4]],c);});PR(pt,J.neck,1,[[0,rock*.7],[.5,-rock*.7],[1,rock*.7]],c);}
    PR(pt,J.tail,1,[[0,-12],[.5,12],[1,-12]],c);
    ["earl","earr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.3,5],[.55,0],[.8,5],[1,0]],c));},
  twitch(pt){const J=pt.J,d=3000;
    PR(pt,J.earl,J.earl&&J.earl.out,[[0,0],[.06,24],[.1,-4],[.14,20],[.18,0],[.5,0],[.56,-12],[.7,-12],[.76,0],[1,0]],d);
    PR(pt,J.earr,J.earr&&J.earr.out,[[0,0],[.3,0],[.34,24],[.38,-3],[.42,0],[.5,0],[.56,-12],[.7,-12],[.76,0],[1,0]],d);
    PR(pt,J.neck,1,[[0,0],[.06,-4],[.2,0],[.32,4],[.45,0],[.56,8],[.7,8],[.78,0],[1,0]],d);
    PF(pt,[[0,"normal"],[.24,"blink"],[.27,"normal"],[.56,"good"],[.76,"normal"]],d);},
  tail(pt){const J=pt.J,d=2600,has=!!J.tail;const wig=[[0,"rotate(0deg)"]];const fast=[[0,0]];
    for(let i=1;i<=8;i++){fast.push([i*.05,i%2?24:-24]);wig.push([i*.05,`translateX(${has?0:(i%2?-3:3)}%) rotate(${(has?1.6:3)*(i%2?-1:1)}deg)`]);}
    fast.push([.45,0],[.55,12],[.7,-12],[.85,10],[.95,-4],[1,0]);wig.push([.45,"rotate(0deg)"],[1,"rotate(0deg)"]);
    PR(pt,J.tail,1,fast,d);PB(pt,wig,d);
    ["earl","earr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.06,-8],[.42,-8],[.5,0],[1,0]],d));
    PF(pt,[[0,"good"],[.46,"normal"],[.7,"blink"],[.73,"normal"]],d);},
  jump(pt){const J=pt.J,k=pt.kind,d=pt.t.heavy?1650:1450;const h=Math.min(70,48*pt.t.jump);
    PB(pt,[[0,"translateY(0) scale(1,1)"],[.14,"translateY(0) scale(1.12,.84)"],[.26,`translateY(-${h*.55}%) scale(.92,1.12)`,"ease-out"],[.42,`translateY(-${h}%) scale(1,1)`,"ease-in"],[.58,`translateY(-${h*.6}%) scale(.98,1.04)`,"ease-in"],[.7,"translateY(0) scale(1.12,.86)"],[.8,"translateY(-3%) scale(.97,1.04)"],[.9,"translateY(0) scale(1,1)"],[1,"translateY(0) scale(1,1)"]],d,{it:1});
    if(k==="quad"){["fl","fr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].fwd,[[0,0],[.14,-10],[.3,40],[.5,34],[.7,12],[.85,0],[1,0]],d,{it:1}));["hl","hr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].fwd,[[0,0],[.14,12],[.3,-38],[.5,-30],[.7,-8],[.85,0],[1,0]],d,{it:1}));}
    else if(k==="bird"||k==="swim"){["wgl","wgr"].forEach(n=>{const j=J[n];if(j)PR(pt,j,j.out,[[0,0],[.14,-4],[.26,60],[.34,22],[.42,60],[.5,22],[.58,52],[.7,8],[.82,0],[1,0]],d,{it:1});});}
    else{["sl","sr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.14,-14],[.3,92],[.45,112],[.6,96],[.72,22],[.86,0],[1,0]],d,{it:1}));["el","er"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.3,24],[.45,42],[.6,20],[.75,0],[1,0]],d,{it:1}));}
    ["al","ar"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.14,6],[.45,-16,-2],[.7,4],[.85,0],[1,0]],d,{it:1}));
    PR(pt,J.tail,J.tail&&J.tail.up,[[0,0],[.14,-10],[.42,26],[.7,-16],[.85,4],[1,0]],d,{it:1});
    ["earl","earr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.14,8],[.28,20],[.45,-8],[.6,-14],[.72,22],[.84,-5],[1,0]],d,{it:1}));
    PF(pt,[[0,"normal"],[.22,"excited"],[.66,"good"],[.95,"normal"]],d,{it:1});},
  /* a happy little dance on the spot: sway, bounce and paw/wing beats.
     No spinning or flipping — these are flat drawings. */
  dance(pt){const J=pt.J,k=pt.kind,b=480,d=b*8;const beat=(a,bb)=>{const f=[];for(let i=0;i<=8;i++)f.push([i/8,i%2?bb:a]);return f;};const sway=k==="quad"?3:6;
    const bf=[];for(let i=0;i<=16;i++){const ph=i%4;bf.push([i/16,ph===1||ph===3?`translateY(-${i>=8&&i<12?10:6}%) rotate(0deg)`:`translateY(0) rotate(${ph===0?-sway:sway}deg)`]);}
    PB(pt,bf,d);
    if(k==="quad"){const paddle=(j,ph)=>j&&PR(pt,j,j.fwd,[[0,0],[.0625,32],[.125,0],[.25,0],[.3125,32],[.375,0],[.5,0],[.625,20],[.75,0],[.8125,36],[.875,0],[.9375,36],[1,0]],d,{ph});paddle(J.fl,0);paddle(J.fr,.125);["hl","hr"].forEach(n=>J[n]&&PR(pt,J[n],J[n].fwd,beat(0,-10),d));}
    else if(k==="bird"||k==="swim"){["wgl","wgr"].forEach((n,i)=>{const j=J[n];if(j)PR(pt,j,j.out,[[0,0],[.0625,i?10:50],[.125,0],[.1875,i?50:10],[.25,0],[.3125,i?10:50],[.375,0],[.4375,i?50:10],[.5,0],[.625,45],[.75,0],[.78,60],[.81,20],[.84,60],[.875,20],[.9,60],[.93,20],[.96,60],[1,0]],d);});}
    else{const left=J.sl&&J.sl.side<0?"sl":"sr",right=left==="sl"?"sr":"sl";const arms=(j,first)=>j&&PR(pt,j,j.out,[[0,first?108:20],[.125,first?20:108],[.25,first?108:20],[.375,first?20:108],[.5,75],[.75,75],[.78,112],[1,first?108:20]],d);arms(J[left],true);arms(J[right],false);
      ["el","er"].forEach(n=>J[n]&&PR(pt,J[n],J[n].out,(()=>{const f=[];for(let i=0;i<=16;i++)f.push([i/16,i%2?28:-6]);return f;})(),d));}
    ["al","ar"].forEach((n,i)=>J[n]&&PR(pt,J[n],J[n].out,beat(0,14),d,{ph:i%2?.125:0}));
    PR(pt,J.tail,1,beat(-20,20),d);PR(pt,J.neck,1,[[0,sway*1.2],[.125,-sway*1.2],[.25,sway*1.2],[.375,-sway*1.2],[.5,0],[1,0]],d);
    ["earl","earr"].forEach(n=>J[n]&&PR(pt,J[n],J[n].out,beat(0,12),d,{ph:.05}));
    PF(pt,[[0,"good"],[.5,"excited"],[.75,"good"],[.78,"excited"]],d);},
  sad(pt){const J=pt.J,d=1800;
    ["earl","earr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.2,28],[1,28]],d,{it:1}));
    PR(pt,J.neck,1,[[0,0],[.25,0,1.5],[1,0,1.5]],d,{it:1});PR(pt,J.tail,J.tail&&J.tail.up,[[0,0],[.25,-18],[1,-18]],d,{it:1});
    PB(pt,[[0,"scale(1,1)"],[.25,"scale(1.03,.95)"],[1,"scale(1.03,.95)"]],d,{it:1});
    PF(pt,[[0,"bad"]],d,{it:1});},
  hop(pt){const J=pt.J,d=640;
    PB(pt,[[0,"scale(1,1)"],[.18,"scale(1.12,.84)"],[.42,"scale(.9,1.14)"],[.72,"scale(1,1)"],[.86,"scale(1.1,.9)"],[1,"scale(1,1)"]],d,{it:1});
    ["earl","earr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.4,18],[.75,-8],[1,0]],d,{it:1}));
    PR(pt,J.tail,J.tail&&J.tail.up,[[0,0],[.4,20],[1,0]],d,{it:1});
    PF(pt,[[0,"excited"]],d,{it:1});},
  /* a slow nap: eyes closed, gentle breathing */
  sleep(pt){const d=3600;PB(pt,[[0,"scale(1,1)"],[.5,"scale(1.025,.975)"],[1,"scale(1,1)"]],d);PR(pt,pt.J.neck,1,[[0,0],[.2,4,1],[1,4,1]],d,{it:1});PF(pt,[[0,"blink"]],d);},
  /* stretch: front reach for side-view animals, arms up for sitters */
  stretch(pt){const J=pt.J,d=1600;
    PB(pt,[[0,"scale(1,1)"],[.4,"scale(1.04,.96)"],[.7,"scale(1.04,.96)"],[1,"scale(1,1)"]],d,{it:1});
    if(pt.kind==="quad"){["fl","fr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].fwd,[[0,0],[.4,22],[.7,22],[1,0]],d,{it:1}));}
    else ["sl","sr"].forEach(n=>PR(pt,J[n],J[n]&&J[n].out,[[0,0],[.4,40],[.7,40],[1,0]],d,{it:1}));
    PF(pt,[[0,"blink"],[.8,"good"]],d,{it:1});},
  wave(pt){const J=pt.J,d=1650;const j=J.sr&&J.sr.side>0?J.sr:J.sl||J.wgr||J.wgl;
    if(j)PR(pt,j,j.out,[[0,0],[.18,60],[.32,40],[.46,60],[.6,40],[.74,60],[.9,0],[1,0]],d,{it:1});else PM.tail(pt);
    PF(pt,[[0,"good"]],d,{it:1});}
};
function petPlay(pt,m,force){if(!pt||!pt.svg||(!force&&pt.move===m))return;petStop(pt);pt.move=m;(PM[m]||PM.idle)(pt);}
/* an arc from one spot to another (floor to bar top and back) */
function cafePetJump(pt,x2,g2,lane2,done){
  if(!pt)return;pt.state="jump";petPlay(pt,"hop",true);
  const x1=pt.x,g1=pt.g,apex=Math.min(g1,g2)-22;pt.dirX=x2>x1+1?1:(x2<x1-1?-1:pt.dirX);
  pt.jump={x1,g1,x2,g2,apex,lane2,t:0,dur:cafeReduced()?.001:.62,done};
}
function cafeStepJump(pt,dt){const j=pt.jump;if(!j)return;j.t=Math.min(1,j.t+dt/j.dur);const t=j.t,e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  pt.x=j.x1+(j.x2-j.x1)*e;pt.g=(1-t)*(1-t)*j.g1+2*(1-t)*t*j.apex+t*t*j.g2;
  if(t>.5&&pt.lane!==j.lane2)pt.lane=j.lane2;
  cafePetPlace(pt);if(t>=1){pt.jump=null;const d=j.done;d&&d();}}
function cafeRemovePet(pt){if(!pt)return;petStop(pt);pt.jump=null;pt.el.remove();STAGE.pets.delete(pt);}

/* A delay that counts only playing time: it holds while the game is paused
   (pause sheet, app in the background, read-aloud), so nothing moves on
   underneath the pause sheet. */
function shiftDelay(fn,ms){
  let left=ms,last=performance.now();
  const step=()=>{const now=performance.now(),held=typeof SESSION_PAUSE_REASONS!=="undefined"&&SESSION_PAUSE_REASONS.size>0;
    if(!held)left-=now-last;last=now;if(left<=0)fn();else setTimeout(step,Math.min(100,left));};
  setTimeout(step,Math.min(100,Math.max(0,ms)));
}
/* ---------- one shared clock for walking, following and jumping ---------- */
const PET_GAP=30,PET_SPEED=CAFE_BOX*.8;
function cafeTick(now){
  STAGE.raf=0;if(!STAGE.mounted)return;
  const paused=typeof isSessionPaused==="function"&&isSessionPaused();
  /* the answer card holds walking, but pets keep reacting under it; only a
     real pause (pause sheet, background, read-aloud) freezes them */
  const frozen=paused&&typeof SESSION_PAUSE_REASONS!=="undefined"&&SESSION_PAUSE_REASONS.size>0;
  if(frozen&&!STAGE.pausedAt){STAGE.pausedAt=now;STAGE.pets.forEach(pt=>pt.anims.forEach(a=>a.pause()));}
  if(!frozen&&STAGE.pausedAt){STAGE.pausedAt=0;STAGE.pets.forEach(pt=>pt.anims.forEach(a=>a.play()));}
  if(!paused&&STAGE.wasHeld)STAGE.lastT=now;STAGE.wasHeld=paused;
  const dt=Math.min(.05,Math.max(0,(now-(STAGE.lastT||now))/1000));STAGE.lastT=now;
  /* a debut plays while its panel holds the shift, so that walk keeps going unless the game is really paused */
  if(paused&&!frozen)STAGE.actors.forEach(a=>{if(a.walk&&a.debut)cafeStepWalker(a,dt);});
  if(!paused){
    STAGE.actors.forEach(a=>{if(a.walk)cafeStepWalker(a,dt);});
    STAGE.pets.forEach(pt=>{
      if(pt.needMeasure&&pt.el.isConnected)cafePetMeasure(pt);
      if(pt.jump){cafeStepJump(pt,dt);return;}
      if(pt.state==="follow"&&pt.owner&&pt.owner.path)cafeFollow(pt,dt);
      if(pt.stroll)cafeStroll(pt,dt);
    });
  }
  STAGE.raf=requestAnimationFrame(cafeTick);
}
function cafeKick(){if(!STAGE.raf&&STAGE.mounted){STAGE.lastT=performance.now();STAGE.raf=requestAnimationFrame(cafeTick);}}
function cafeFollow(pt,dt){
  const a=pt.owner,target=a.s-(pt.leaving?16:PET_GAP);let moving=false;
  if(target>pt.s+.3){pt.s=Math.min(target,pt.s+PET_SPEED*dt*(pt.t?pt.t.spd:1));moving=true;}
  const pos=cafePathAt(a,Math.max(0,pt.s));const dx=pos.x-pt.x;if(Math.abs(dx)>.05)pt.dirX=Math.sign(dx);
  const kk=pos.feet<CAFE_GEO.serve.feet-30?.88:Math.min(1.15,1+Math.max(0,pos.feet-CAFE_GEO.serve.feet)/(CAFE_GEO.exit.feet-CAFE_GEO.serve.feet)*.15);
  const side=pt.leaving&&pos.feet>CAFE_GEO.serve.feet+4?22*kk:0;
  pt.x=pos.x+side;pt.g=pos.feet;pt.box=CAFE_PBOX*kk;pt.lane=pos.lane==="f"?"f":"b";cafePetPlace(pt);
  if(!pt.shown&&pt.s>2&&!pt.hiddenWait){pt.shown=true;pt.el.classList.add("shown");}
  if(moving){pt.still=0;if(pt.move!=="walk")petPlay(pt,"walk");}
  else{pt.still=(pt.still||0)+dt;if(pt.move==="walk"&&pt.still>.15)petPlay(pt,"idle");}
  if(pt.leaving&&pt.g>CAFE_H+40)cafeRemovePet(pt);
}

/* ---------- takeaway: a paper cup and a paper food bag ---------- */
function takeawayCupSVG(color){
  return `<svg viewBox="0 0 24 34" aria-hidden="true"><path d="M4.5 9 L19.5 9 L17.6 31 Q12 33 6.4 31 Z" fill="#FFF8EE" stroke="#463A54" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M5.6 15 L18.4 15 L17.7 23 L6.3 23 Z" fill="${color}" stroke="#463A54" stroke-width="1"/>
    <path d="M3 9 Q3 5.6 6 5.6 L18 5.6 Q21 5.6 21 9 Z" fill="#F4EAD8" stroke="#463A54" stroke-width="1.4"/><rect x="10.6" y="2.6" width="2.8" height="3.4" rx="1" fill="#F4EAD8" stroke="#463A54" stroke-width="1"/></svg>`;
}
function paperBagSVG(withCup,color){
  return `<svg viewBox="0 0 30 40" aria-hidden="true">${withCup?`<g transform="translate(13 0) scale(.62)"><path d="M3 9 Q3 5.6 6 5.6 L18 5.6 Q21 5.6 21 9 Z" fill="#F4EAD8" stroke="#463A54" stroke-width="2"/><path d="M4.5 9 L19.5 9 L18.6 20 L5.4 20 Z" fill="#FFF8EE" stroke="#463A54" stroke-width="2"/><rect x="5.4" y="12" width="13.2" height="6" fill="${color}"/></g>`:""}
    <path d="M6 7 Q8 1 11 3 M19 7 Q21 1 24 3" fill="none" stroke="#8A5A2E" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M3 13 L27 13 L25.5 38 L4.5 38 Z" fill="#D9AE78" stroke="#463A54" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M3 13 L5.5 9 L24.5 9 L27 13 Z" fill="#C79A63" stroke="#463A54" stroke-width="1.3" stroke-linejoin="round"/>
    <circle cx="15" cy="25" r="5.2" fill="#F4EAD8" stroke="#463A54" stroke-width="1"/><path d="M12.4 24.4 q2.6 -3 5.2 0 q-2.6 3.6 -5.2 0" fill="#7FA65A"/></svg>`;
}
/* attach a held item at a hand; positions are stored as percentages of
   the person's box so they stay put as the person grows while leaving */
function cafeHoldAt(a,hand,html,{w=.17,h=1.3,dy=-1.15}={}){
  if(!a||!hand||!a.inner)return null;
  const ir=a.inner.getBoundingClientRect(),hr=hand.getBoundingClientRect();if(!ir.width)return null;
  const el=document.createElement("div");el.className="held";el.innerHTML=html;
  const W=ir.width*w;el.style.width=(w*100).toFixed(2)+"%";el.style.height=(w*h*ir.width/ir.height*100).toFixed(2)+"%";
  el.style.left=((hr.left+hr.width/2-ir.left-W/2)/ir.width*100).toFixed(2)+"%";
  el.style.top=((hr.top+hr.height*.5-ir.top+W*dy)/ir.height*100).toFixed(2)+"%";
  a.inner.appendChild(el);return el;
}
/* the customer takes their order: the drink in a bent arm and the food
   bag hanging from the other hand. With one hand already busy (a
   sceptre, a ball, a briefcase...) the free hand carries the paper bag
   with the cup sitting in it, so the character's own prop never moves. */
function cafeTakeOrder(a,ticket){
  if(!a||!a.svg){return;}
  a.carrying=true;
  const color=(ticket&&ticket.drinkColor)||"#D8547A",food=!!(ticket&&ticket.food);
  const s=a.waveSide;
  /* both hands already full: the paper bag, cup inside, hangs over the forearm */
  if(!s){const f=a.J("fore-r")||a.J("fore-l");if(f)cafeHoldAt(a,f,paperBagSVG(true,color),{w:.19,h:1.33,dy:-.05});return;}
  const hand=a.J("hand-"+s),arm=a.J("arm-"+s),fore=a.J("fore-"+s);
  if(a.bagSide||!food){
    /* the cup is held in the hanging hand: the arm stays one straight piece
       (its only bend in this art is at the sleeve hem, which would break it) */
    [arm,fore].forEach(e=>{if(e)e.classList.add("holding");});cafeHandView(hand,"grip-edge");
    setTimeout(()=>{if(a.el.isConnected)cafeHoldAt(a,hand,takeawayCupSVG(color),{w:.15,h:1.3,dy:-.55});},cafeReduced()?0:200);
    if(food&&a.bagSide){const bh=a.J("hand-"+a.bagSide),barm=a.J("arm-"+a.bagSide);if(barm)barm.classList.add("holding");cafeHandView(bh,"grip-back");
      cafeHoldAt(a,bh,paperBagSVG(false,color),{w:.2,h:1.33,dy:-.25});}
  }else{
    if(arm)arm.classList.add("holding");cafeHandView(hand,"grip-back");
    cafeHoldAt(a,hand,paperBagSVG(true,color),{w:.21,h:1.33,dy:-.25});
  }
}

/* ---------- the shift stage ---------- */
function cafeStageTeardown(){
  STAGE.mounted=false;if(STAGE.raf)cancelAnimationFrame(STAGE.raf);STAGE.raf=0;
  STAGE.actors.forEach(a=>{clearTimeout(a.blinkT);clearTimeout(a.ft);clearTimeout(a.actT);});
  STAGE.pets.forEach(pt=>petStop(pt));
  STAGE.actors.clear();STAGE.pets.clear();STAGE.barista=null;STAGE.bpet=null;
  if(STAGE.ro){STAGE.ro.disconnect();STAGE.ro=null;}
  clearInterval(STAGE.routine);STAGE.routine=0;
}
function cafeStageInit(){
  cafeStageTeardown();
  STAGE.box=document.getElementById("scenebox");if(!STAGE.box)return;
  STAGE.laneB=document.getElementById("laneB");STAGE.laneF=document.getElementById("laneF");STAGE.laneT=document.getElementById("laneT");STAGE.fx=document.getElementById("cafeFx");
  STAGE.mounted=true;STAGE.nextDoor=0;cafeMeasure();
  if(typeof ResizeObserver==="function"){STAGE.ro=new ResizeObserver(()=>{if(!STAGE.box||!STAGE.box.isConnected){cafeStageTeardown();return;}
    cafeMeasure();STAGE.actors.forEach(cafePlace);STAGE.pets.forEach(cafePetPlace);if(STAGE.fallbackBarista)cafePlaceFallbackBarista();});STAGE.ro.observe(STAGE.box);}
  cafeMakeBarista();cafeMakePlayerPet();
  cafeKick();
  /* everyone else's art arrives in the background */
  CafeArt.preload("chars",CUSTOMERS.map(c=>c.id).filter(id=>CAFE_CHAR_IDS.has(id)));
  CafeArt.preload("pets",PETS.map(x=>x.id));
}
/* the barista: the character pack's drawing for a ready-made barista;
   a custom look (or any worn shop clothing) still uses the customiser's
   own drawing so every choice and purchase keeps showing */
function cafeBaristaArtId(p=P()){
  if(!p||p.avatar==="custom"||!CAFE_CHAR_IDS.has(p.avatar))return null;
  /* the pack baristas already wear the starting cherry apron; shop
     accessories go on their own drawing, only new clothes need the customiser's */
  if(cafeOutfitFromShop(playerRenderOpts(p)))return null;
  return p.avatar;
}
function cafeMakeBarista(){
  const G=CAFE_GEO.barista,id=cafeBaristaArtId(),p=P();
  const a=cafeNewPerson(id||"barista",{lane:"b",x:G.x,feet:G.feet,k:G.k});a.el.id="barista";a.el.classList.add("is-barista");a.face="normal";STAGE.barista=a;
  const fail=()=>{cafeRemovePerson(a);STAGE.barista=null;cafeMakeFallbackBarista();};
  if(id){const opts=playerRenderOpts(p),look=playerLookFor(p,opts),wears=cafeWearsShop(opts);
    const dress=t=>{if(!t)return fail();if(!wears)return cafeDressPerson(a,t);
      CafeCustom.load().then(()=>{if(STAGE.mounted&&STAGE.barista===a)cafeDressPerson(a,cafeDressPack(t,look,opts)||t);});};
    const t=CafeArt.get("chars",id);if(t)dress(t);else CafeArt.load("chars",id).then(dress);return;}
  /* a custom look, or a ready-made barista wearing shop clothes: assembled
     from the customisation pack with every choice and wearable */
  const opts=playerRenderOpts(p),look=playerLookFor(p,opts);
  CafeCustom.load().then(()=>{if(!STAGE.mounted||STAGE.barista!==a)return;const t=cafeComposeCustom(look,opts);t?cafeDressPerson(a,t):fail();});
}
function cafeMakeFallbackBarista(){
  const el=document.createElement("div");el.className="barista-waist";el.id="barista";el.innerHTML=playerSVG("happy",80);
  STAGE.laneB.appendChild(el);STAGE.fallbackBarista=el;cafePlaceFallbackBarista();
}
function cafePlaceFallbackBarista(){
  const el=STAGE.fallbackBarista;if(!el)return;const w=76,h=w*130/100,top=CAFE_GEO.counterTopY-h*(112.5/130);
  el.style.width=sx(w)+"px";el.style.transform=`translate(${sx(CAFE_GEO.barista.x-w/2)}px,${sy(top)}px)`;
}
function setBarista(expr){
  const a=STAGE.barista;
  /* at rest the barista has the normal face, so they blink; a right answer
     brings a smile and a wave, a wrong one a short worried look */
  if(a){const now=performance.now();
    if(expr==="delighted"){cafeFace(a,"happy",2000);a.faceUntil=now+2000;cafeGreet(a);}
    else if(expr==="sad"){cafeFace(a,"concern",1400);a.faceUntil=now+1400;}
    else if(!(a.faceUntil>now))cafeFace(a,"normal");
    return;}
  const b=STAGE.fallbackBarista||$("#barista");if(b)b.innerHTML=playerSVG(expr,80);
}

function mountStage(){
  const T=THEMES[P().settings.theme]||THEMES.sunny,L=cafeSceneLayers("stage");
  show(`<section class="screen shiftscreen">
    <div class="topbar" id="stopbar" style="position:relative"></div>
    <div class="stage theme-${P().settings.theme}" id="stage"><div class="scenebox" id="scenebox">
      ${L.back}<div class="lane" id="laneB"></div>${L.front}<div class="lane" id="laneF"></div><div class="lane" id="laneT"></div>${L.light}
      <div class="fxlayer" id="cafeFx"></div></div>
      <div class="warmwash"></div>
      <div class="ambientlayer">${ambientSVG(T.ambient)}</div>
    </div>
    <div class="panel felt" id="panel"><div class="waitmsg">Wiping the counter…</div></div>
  </section>`);
  cafeStageInit();
  initTopbar();
  updateTopbar();
  schedulePlayerPetIdle();
}
function cafeOpenDoor(ms=1500){const d=STAGE.box&&STAGE.box.querySelector(".cafe-back");if(!d)return;d.classList.add("door-open");clearTimeout(cafeOpenDoor.t);cafeOpenDoor.t=setTimeout(()=>d.classList.remove("door-open"),ms);}

/* ---- customers (actors) ---- */
function makeActor(cust,expr){
  const D=CAFE_GEO.doorIn;
  const a=cafeNewPerson(cust.id,{lane:"b",x:D.x,feet:D.feet,k:D.k,fallbackHTML:characterSVG(cust.look,expr||"neutral",{w:84})});
  a.face=CAFE_FACE[expr]||"normal";a.el.classList.add(...(PERSONALITY_CLASS[cust.personality]||"").split(" ").filter(Boolean));
  a.el.classList.add("waiting-offstage");
  return a;
}
function hydrateActorVisual(entry){
  if(!entry||!entry.actor)return;const a=entry.actor;if(a.ready||a.dressing)return;
  a.dressing=true;const done=t=>{a.dressing=false;cafeDressPerson(a,t);entry.visualHydrated=true;if(entry.currentExpr)cafeFace(a,CAFE_FACE[entry.currentExpr]||"normal");};
  const t=CAFE_CHAR_IDS.has(entry.cust.id)&&CafeArt.get("chars",entry.cust.id);
  if(t)done(t);else if(CAFE_CHAR_IDS.has(entry.cust.id))CafeArt.load("chars",entry.cust.id).then(done);else done(null);
}
function dehydrateActorVisual(entry){
  if(!entry||!entry.actor||entry===SHIFT?.current)return;const a=entry.actor;if(!a.ready)return;
  clearTimeout(a.blinkT);a.inner.replaceChildren();a.svg=null;a.ready=false;entry.visualHydrated=false;
}
function setExpr(entry,expr){
  entry.currentExpr=expr;hydrateActorVisual(entry);const a=entry.actor;if(!a)return;
  cafeFace(a,CAFE_FACE[expr]||"normal");
  if(expr==="delighted")cafeAct(a,"hop",1150);else if(expr==="sad")cafeAct(a,"nod",1150);
}
function popEmote(entry,txt){const slot=entry.node&&entry.node.querySelector(".emoteslot");if(!slot)return;const e=document.createElement("div");e.className="emote";e.textContent=txt;slot.appendChild(e);setTimeout(()=>e.remove(),1300);}

/* Waiting customers queue behind the raised bar. Rush Hour can hold up
   to twenty, but only the next three are drawn; the rest wait outside
   the door (no drawing in memory) and come in as places free up. */
function layoutQueue(){
  if(!SHIFT)return;
  const G=CAFE_GEO,D=G.doorIn;
  SHIFT.queue.forEach((e,i)=>{
    const a=e.actor;if(!a)return;const visible=i<G.queue.length;
    e.node.setAttribute("data-q",i);
    if(!visible){
      if(a.slot!=="stash"){a.slot="stash";a.walk=null;Object.assign(a,{x:G.stash.x,feet:G.stash.feet,k:G.stash.k,lane:"b"});cafePlace(a);}
      a.el.classList.add("waiting-offstage");a.el.setAttribute("aria-hidden","true");dehydrateActorVisual(e);
      if(e.petActor){e.petActor.el.classList.remove("shown");e.petActor.shown=false;}
      return;
    }
    hydrateActorVisual(e);a.el.removeAttribute("aria-hidden");
    if(e.petActor){const pt=e.petActor;pt.hiddenWait=i>0;if(i>0&&pt.state==="follow"){pt.shown=false;pt.el.classList.remove("shown");}}
    if(a.slot===i)return;
    const spot={...G.queue[i],lane:"b"};
    if(a.slot===undefined||a.slot==="stash"){
      /* through the glass door one at a time, never in a bunch */
      a.slot=i;cafeEnter(e);return;
    }
    if(a.entering){a.slot=i;return;}
    cafeWalk(a,[spot],()=>cafeQueuePet(e));
    a.slot=i;
  });
}
const CAFE_DOOR_GAP=1500;
function cafeEnter(e){
  const a=e.actor,D=CAFE_GEO.doorIn,now=performance.now();
  const wait=Math.max(0,(STAGE.nextDoor||0)-now);STAGE.nextDoor=now+wait+CAFE_DOOR_GAP;
  a.entering=true;a.el.classList.add("waiting-offstage");
  setTimeout(()=>{
    if(!STAGE.mounted||!a.el.isConnected)return;
    const S=SHIFT;if(!S)return;
    const isCurrent=S.current===e,qi=S.queue.indexOf(e);
    if(!isCurrent&&(qi<0||qi>=CAFE_GEO.queue.length)){a.entering=false;a.slot="stash";return;}
    a.entering=false;Object.assign(a,{x:D.x,feet:D.feet,k:D.k,lane:"b"});cafePlace(a);a.el.classList.remove("waiting-offstage");
    cafeOpenDoor();cafeTrackStart(a);
    if(e.petActor){const pt=e.petActor;Object.assign(pt,{x:D.x,g:D.feet,s:0,shown:false,state:"follow",lane:"b"});pt.el.classList.remove("shown");cafePetPlace(pt);}
    const step={x:D.x-14,feet:D.feet+12,k:.82,lane:"b"};
    if(isCurrent&&e.goServe){cafeWalk(a,[step],()=>e.goServe());return;}
    a.slot=qi;cafeWalk(a,[step,{...CAFE_GEO.queue[qi],lane:"b"}],()=>cafeQueuePet(e));
  },wait);
}
function attachPet(entry,pet){
  entry.pet=pet;const a=entry.actor;
  const pt=cafeNewPet(pet.id,{lane:"b",x:a?a.x:CAFE_GEO.doorIn.x,g:a?a.feet:CAFE_GEO.doorIn.feet,box:CAFE_PBOX*.84});
  pt.owner=a;pt.state="follow";entry.petActor=pt;pt.el.classList.add("customer-pet");
  pt.el.title="tap to say hello!";
  const art=CafeArt.get("pets",pet.id);const dress=t=>{cafeDressPet(pt,t,petSVG(pet,"good",44));petPlay(pt,"idle");};
  if(art)dress(art);else CafeArt.load("pets",pet.id).then(dress);
  pt.el.onclick=(e)=>{e.stopPropagation();
    const moods=["good","excited","normal","bad"],mood=moods[rnd(moods.length)];
    if(pt.svg){petPlay(pt,Math.random()<.5?"twitch":"tail",true);clearTimeout(pt._moodTimer);clearTimeout(pt._react);pt._moodTimer=setTimeout(()=>{if(pt.state==="counter"||pt.state==="follow")petPlay(pt,"idle",true);},2600);}
    else pt.body.innerHTML=petSVG(pet,mood,44);
    AudioKit.pet(pet.species,true);popEmote(entry,"💕");
    recordPetGreeting(pet);
    toast(`${pet.name.replace(/^a /,"The ")} ${petReactionText(pet,"tap")}`);};
  return pt.el;
}
function spawnCustomer(){
  const S=SHIFT,p=P();
  /* Exclude everyone currently on screen plus the last three
     visitors, so the same face never queues twice at once. */
  S.recentCust=S.recentCust||[];
  const excluded=[...(S.current?[S.current.cust.id]:[]),...S.queue.map(e=>e.cust.id),...S.recentCust];
  const ticket=buildTicket(S.streak,excluded),c=ticket.cust;
  S.recentCust.push(c.id); if(S.recentCust.length>3)S.recentCust.shift();
  if(c.id==="fox"&&!p.metFox){p.metFox=true;persist();}
  if(c.id==="owl"&&!p.metOwl){p.metOwl=true;persist();}
  if(c.id==="adeyemi"&&!p.metProf){p.metProf=true;persist();}
  const ownPet=activePlayerPet(p);
  const unPets=PETS.filter(x=>unlockedIds().pet.has(x.id)&&(!ownPet||x.id!==ownPet.id));
  const pet=(Math.random()<.4&&unPets.length)?unPets[rnd(unPets.length)]:null;
  const actor=makeActor(c,"neutral");
  const entry={ticket,cust:c,actor,node:actor.el,pet:null,qIndex:0,ticketRight:0,currentExpr:"neutral",visualHydrated:false};
  if(pet) attachPet(entry,pet);
  S.queue.push(entry); S.spawned++;
  layoutQueue(); updateTopbar();
}
function takeNext(){
  const S=SHIFT;
  if(S.current||!S.queue.length||S.debutActive) return;
  const entry=S.queue.shift(); S.current=entry;hydrateActorVisual(entry);
  entry.node.removeAttribute("data-q");
  entry.node.classList.remove("waiting-offstage");
  entry.node.removeAttribute("aria-hidden");
  entry.node.classList.add("serving");
  /* let the customer who is leaving clear the middle before this one steps
     out; the queue moves up at the same moment */
  const wait=entry.actor&&!entry.actor.entering?(STAGE.leaveClearAt||0)-performance.now():0;
  if(wait<=0)layoutQueue();
  setBarista("happy"); updateTopbar();
  const a=entry.actor,G=CAFE_GEO;a.slot="serve";
  if(a.path===undefined)cafeTrackStart(a);
  /* round the end of the bar into the open area in front of the barista */
  entry.goServe=()=>{cafePetDown(entry);cafeWalk(a,[{x:G.bar.x-4,feet:204,k:.89,lane:"f"},{...G.serve,lane:"f"}],()=>{
    if(!SHIFT||SHIFT.current!==entry)return;
    cafeFace(a,"happy",1500);cafeGreet(a);
    panelArrival(entry);
  },{fast:true});};
  if(a.entering)return;   /* still outside: cafeEnter brings them straight to the counter */
  if(wait>0)shiftDelay(()=>{if(SHIFT&&SHIFT.current===entry){layoutQueue();entry.goServe();}},wait);else entry.goServe();
}
/* Pets (at most two in view): the next customer's pet sits up on the bar
   in front of them; the customer being served has theirs on the floor
   beside them; pets of anyone further back wait out of sight. */
function cafeQueuePet(e){
  const pt=e&&e.petActor,a=e&&e.actor;if(!pt||!a||!SHIFT)return;
  const qi=SHIFT.queue.indexOf(e);if(qi!==0||pt.state!=="follow")return;
  const go=()=>{if(!SHIFT||SHIFT.queue.indexOf(e)!==0||pt.state!=="follow"||!pt.el.isConnected)return;
    if(pt.s<a.s-PET_GAP-1){setTimeout(go,120);return;}
    pt.hiddenWait=false;pt.shown=true;pt.el.classList.add("shown");
    pt.state="hop";cafePetJump(pt,a.x-34,CAFE_GEO.barTopY+1,"t",()=>{pt.state="counter";pt.box=CAFE_PBOX*.9;pt.dirX=-1;cafePetPlace(pt);petPlay(pt,"tail",true);
      setTimeout(()=>{if(pt.state==="counter"&&pt.move==="tail")petPlay(pt,"idle");},2600);});};
  setTimeout(go,200);
}
/* called up to order: the pet hops down off the bar and trots after them */
function cafePetDown(entry){
  const pt=entry.petActor,a=entry.actor;if(!pt||!a)return;
  pt.hiddenWait=false;
  const follow=()=>{pt.state="follow";a.path=[{x:pt.x,feet:pt.g,lane:"b",s:0},{x:a.x,feet:a.feet,lane:"b",s:Math.hypot(a.x-pt.x,(a.feet-pt.g)*1.4)}];a.s=a.path[1].s;pt.s=0;pt.shown=true;pt.el.classList.add("shown");petPlay(pt,"idle",true);};
  if(pt.state==="counter"||pt.state==="hop"){pt.state="jump";cafePetJump(pt,pt.x+6,a.feet-2,"b",follow);}
  else if(pt.state==="follow"&&!pt.shown){pt.s=Math.max(0,a.s-PET_GAP-8);}
}
/* answers: the served customer's pet dances or droops beside them */
function cafeCustomerPetReact(entry,correct){
  const pt=entry&&entry.petActor;if(!pt||pt.jump||(pt.state!=="counter"&&pt.state!=="follow"))return;
  petPlay(pt,correct?"dance":"sad",true);clearTimeout(pt._react);clearTimeout(pt._moodTimer);
  /* then back to calm breathing (a tap reaction and this one share the timer) */
  pt._react=setTimeout(()=>{if(pt.state==="counter"||pt.state==="follow")petPlay(pt,"idle",true);},correct?3840:1800);
}

/* ---- the order: made at the machine, slid down the counter, collected ---- */
function cupSlide(entry,perfect,cb){
  const laneT=STAGE.laneT;if(!laneT||!STAGE.mounted){cb&&cb();return;}
  const cup=document.createElement("div");cup.className="orderitem";cup.innerHTML=drinkSVG(entry.ticket,perfect)+(entry.ticket.food?foodSVG(entry.ticket.food,perfect):"");
  laneT.appendChild(cup);
  const h=24,top=CAFE_GEO.counterTopY+1-h;
  cup.style.height=sy(h)+"px";
  cup.querySelectorAll(".foodartsprite,.foodartsprite img").forEach(n=>{n.style.height=sy(h)+"px";n.style.width=sy(h*52/49)+"px";n.style.flex="0 0 auto";});
  cup.style.transform=`translate(${sx(62)}px,${sy(top)}px) scale(.7)`;
  const d=dur(650);
  requestAnimationFrame(()=>{cup.style.transition="opacity .2s, transform .25s cubic-bezier(.3,1.5,.6,1)";cup.style.opacity="1";cup.style.transform=`translate(${sx(62)}px,${sy(top)}px)`;
    setTimeout(()=>{cup.style.transition=`transform ${d}ms ease`;cup.style.transform=`translate(${sx(CAFE_GEO.bCounter.w-22)}px,${sy(top)}px)`;
      setTimeout(()=>{
        /* collected: the order leaves the counter and goes into the customer's hands */
        cup.style.transition="opacity .25s";cup.style.opacity="0";setTimeout(()=>cup.remove(),300);
        if(entry.actor){cafeTakeOrder(entry.actor,entry.ticket);}
        cb&&cb();},d+40);},d?380:0);});
}
function departCurrent(){
  const S=SHIFT,entry=S.current;
  if(entry){entry.node.classList.remove("serving");cafeLeave(entry);}
  S.current=null; updateTopbar();
  if(S.mode==="normal" && S.served>=NORMAL_TARGET){ shiftDelay(()=>{if(SHIFT===S&&!S.ended)endShift(false);}, dur(320)); return; }
  if(S.mode==="review" && (S.served>=REVIEW_TARGET || !reviewPool().length)){ shiftDelay(()=>{if(SHIFT===S&&!S.ended)endShift(false);}, dur(320)); return; }
  if(S.pendingDebuts && S.pendingDebuts.length){ playDebut(S.pendingDebuts.shift()); return; }
  const pnl=$("#panel"); if(pnl)pnl.innerHTML=`<div class="waitmsg">Here comes the next customer…</div>`;
  pump();
}
/* straight down the middle and out of the picture, growing a little as
   they come closer; the pet hops down and follows */
function cafeLeave(entry){
  const a=entry.actor,pt=entry.petActor,G=CAFE_GEO;if(!a)return;
  STAGE.leaveClearAt=performance.now()+(cafeReduced()?0:600);
  if(pt){pt.leaving=true;
    const follow=()=>{pt.state="follow";a.path=[{x:pt.x,feet:pt.g,lane:"f",s:0},{x:a.x,feet:a.feet,lane:"f",s:Math.hypot(a.x-pt.x,(a.feet-pt.g)*1.4)}];a.s=a.path[1].s;pt.s=0;petPlay(pt,"idle",true);};
    if(pt.state==="counter"||pt.state==="hop"){pt.state="jump";cafePetJump(pt,a.x+22,a.feet-2,"f",follow);}else follow();}
  cafeWalk(a,[{x:G.exit.x,feet:G.exit.feet,k:G.exit.k,lane:"f"}],()=>{cafeRemovePerson(a);
    if(pt&&pt.state!=="follow")cafeRemovePet(pt);},{fast:true});
}

/* 🎉 In-café debut (unchanged flow): the new face walks in, says hello
   from the open area and leaves; a new pet is shown in the panel. */
function playDebut(u){
  const S=SHIFT; if(!S){ return; }
  S.debutActive=true; S.popupOpen=true;
  AudioKit.milestone();
  if(u.type==="customer"){
    const c=CUSTOMERS.find(x=>x.id===u.id);
    if(!c){ departDebutDone(); return; }
    const a=makeActor(c,null),entry={cust:c,actor:a,node:a.el};a.debut=true;hydrateActorVisual(entry);
    a.el.classList.remove("waiting-offstage");cafeOpenDoor();cafeTrackStart(a);const G=CAFE_GEO;
    cafeWalk(a,[{x:G.doorIn.x-16,feet:G.doorIn.feet+5,k:.8,lane:"b"},{x:G.queue[0].x,feet:G.queue[0].feet,k:.86,lane:"b"},{x:G.bar.x-4,feet:204,k:.89,lane:"f"},{...G.serve,lane:"f"}],()=>{
      spawnBurst($("#stage"));cafeFace(a,"happy",2600);cafeGreet(a);
      popEmote(entry,"🎉");
      const pnl=$("#panel");
      if(pnl)pnl.innerHTML=`<div class="debut felt"><b>🎉 New customer unlocked!</b>
        <div class="debutname">${esc(c.name)}</div>
        <small>${esc(c.blurb)}</small>
        <div class="custsay" lang="en-GB">“${esc(c.lines.arrive[rnd(c.lines.arrive.length)])}”</div>
        <small class="joined">${esc(c.name)} has joined the café!</small></div>`;
      setTimeout(()=>{
        cafeWalk(a,[{x:G.exit.x,feet:G.exit.feet,k:G.exit.k,lane:"f"}],()=>cafeRemovePerson(a),{fast:true});
        setTimeout(departDebutDone, dur(750));
      }, 2800);
    },{fast:true});
  } else {
    const p=PETS.find(x=>x.id===u.id);
    if(!p){ departDebutDone(); return; }
    AudioKit.pet(p.species,true);
    spawnBurst($("#stage"));
    const pnl=$("#panel");
    if(pnl)pnl.innerHTML=`<div class="debut felt"><b>🐾 New pet unlocked!</b>
      <div class="debutpet">${cafePetStaticHTML(p,"good",110)}</div>
      <div class="debutname">${esc(p.name.replace(/^a /i,""))}</div>
      <small class="joined">might visit with a customer soon!</small></div>`;
    setTimeout(departDebutDone, 3000);
  }
}
/* a still café pet drawing for panels and previews (new pack art when
   loaded, the previous drawing as a fallback while it loads) */
function cafePetStaticHTML(pet,mood="normal",w=64,worn){
  const t=CafeArt.get("pets",pet.id);
  if(!t){CafeArt.load("pets",pet.id);return petSVG(pet,mood,w,worn||{});}
  const want=mood==="good"||mood==="excited"||mood==="bad"||mood==="normal"||mood==="blink"?mood:"normal";
  const svg=t.replace(/<svg /,`<svg width="${w}" height="${(w*1.1).toFixed(1)}" class="cafepet-still" `).replace(/data-expression="([a-z]+)"/g,(m,e)=>`${m} opacity="${e===want?1:0}"`);
  const wornAttr=worn&&Object.keys(worn).length?` data-worn='${JSON.stringify(worn).replace(/'/g,"&#39;")}'`:"";
  return `<span class="cafepet-wrap"${wornAttr}>${svg}</span>`;
}

/* ---------- pet accessories (the barista's own café pet only) ----------
   The shop's pet hats, glasses and neckwear were drawn for a round head
   (centre 36,34; 24×22 radius). On the new pets each one is fitted to
   that animal's skull — measured from the drawing, ears left out — and
   placed inside the head joint so it turns with the head. */
function cafeFitPetWorn(svg,worn){
  if(!svg||!worn)return;
  svg.querySelectorAll(".pet-acc-wrap").forEach(n=>n.remove());
  const ids=[worn.neck,worn.hat,worn.eyes].filter(id=>id&&PET_ACCESSORY_SVG[id]);if(!ids.length)return;
  const head=svg.querySelector('[data-joint="head"]');const inner=head&&head.firstElementChild;if(!inner)return;
  const m=inner.getScreenCTM();if(!m)return;const inv=m.inverse();
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  inner.querySelectorAll("path,ellipse,circle,rect,polygon").forEach(n=>{
    if(n.closest('[data-mount^="ear"],[data-joint^="ear"]'))return;
    const r=n.getBoundingClientRect();if(!r.width||!r.height)return;
    [[r.left,r.top],[r.right,r.bottom]].forEach(([X,Y])=>{const p=new DOMPoint(X,Y).matrixTransform(inv);x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);});});
  if(!isFinite(x0))return;
  const cx=(x0+x1)/2,cy=(y0+y1)/2,sxk=(x1-x0)/48,syk=(y1-y0)/44;
  const g=document.createElementNS("http://www.w3.org/2000/svg","g");g.setAttribute("class","pet-acc-wrap");
  g.setAttribute("transform",`translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${sxk.toFixed(3)} ${syk.toFixed(3)}) translate(-36 -34)`);
  g.innerHTML=ids.map(id=>PET_ACCESSORY_SVG[id]).join("");inner.appendChild(g);
}
/* still pets in previews get their accessories once they are on screen */
if(typeof MutationObserver==="function")new MutationObserver(()=>{
  document.querySelectorAll(".cafepet-wrap[data-worn]:not([data-fitted])").forEach(w=>{const svg=w.querySelector("svg");if(!svg||!svg.isConnected)return;
    let worn={};try{worn=JSON.parse(w.getAttribute("data-worn"));}catch(e){}w.setAttribute("data-fitted","1");cafeFitPetWorn(svg,worn);});
}).observe(document.documentElement,{childList:true,subtree:true});

/* ---------- the barista's café pet: bed, idle routine, strolls ---------- */
function cafeMakePlayerPet(){
  const p=P(),pet=activePlayerPet(p);if(!pet)return;
  const B=CAFE_GEO.bed,hasBed=!!(p.placed.cafe&&p.placed.cafe.petbed);
  const pt=cafeNewPet(pet.id,{lane:"f",x:B.x,g:hasBed?B.y-3:B.y,box:CAFE_PBOX,player:true});
  pt.home={x:B.x,g:hasBed?B.y-3:B.y};pt.dirX=1;
  const el=pt.el;el.classList.add("playerpet-rig");el.setAttribute("data-player-pet",pet.id);el.setAttribute("role","button");el.setAttribute("tabindex","0");
  el.setAttribute("aria-label",`${pet.name.replace(/^a /,"Your ")} — tap for a reaction`);
  STAGE.bpet=pt;
  const dress=t=>{cafeDressPet(pt,t,petSVG(pet,"normal",56,petWearables(p)));if(pt.svg){cafeFitPetWorn(pt.svg,petWearables(p));petPlay(pt,"idle");}};
  const t=CafeArt.get("pets",pet.id);if(t)dress(t);else CafeArt.load("pets",pet.id).then(dress);
  /* a gentle routine between the game's own idle actions */
  STAGE.routine=setInterval(()=>{const b=STAGE.bpet;if(!b||!b.svg||b.busy||b.stroll||cafeReduced()||P().settings.batterySaver)return;
    if(typeof isSessionPaused==="function"&&isSessionPaused())return;
    const r=Math.random();if(r<.22)cafeStartStroll(b);else if(r<.45)petPlay(b,"tail",true);else if(r<.62)petPlay(b,"twitch",true);else petPlay(b,"idle");},5200);
}
/* out of bed, a short potter along the front of the counter, and back */
function cafeStartStroll(pt){if(!pt||pt.stroll)return;const h=pt.home;pt.stroll={legs:[{x:h.x+50,g:h.g+1},{x:h.x,g:h.g}],li:0,wait:0};petPlay(pt,"walk",true);}
function cafeStroll(pt,dt){
  const s=pt.stroll;if(pt.busy){return;}
  if(s.wait>0){s.wait-=dt;if(s.wait<=0)petPlay(pt,"walk",true);return;}
  const leg=s.legs[s.li];const dx=leg.x-pt.x,dg=leg.g-pt.g,dist=Math.hypot(dx,dg),step=CAFE_BOX*.3*dt;
  if(Math.abs(dx)>.3)pt.dirX=Math.sign(dx);
  if(dist<=step){pt.x=leg.x;pt.g=leg.g;s.li++;cafePetPlace(pt);
    if(s.li>=s.legs.length){pt.stroll=null;pt.dirX=1;cafePetPlace(pt);petPlay(pt,"idle",true);return;}
    s.wait=1.5;petPlay(pt,"twitch",true);return;}
  pt.x+=dx/dist*step;pt.g+=dg/dist*step;cafePetPlace(pt);
}
const PLAYER_PET_RIG_ACTION={hop:"jump",wiggle:"tail",look:"twitch",stretch:"stretch",sleep:"sleep",roll:"tail",wave:"wave",yawn:"stretch"};
function cafeBpetOf(el){const b=STAGE.bpet;return b&&b.el===el?b:null;}
function showPlayerPetMood(el,pet,mood="normal",duration=1600){
  if(!el||!pet)return;
  const b=cafeBpetOf(el);
  if(b){if(!b.svg)return;petStop(b);b.move=null;cafePetFace(b,mood);
    const has=b.faces.some(f=>f.getAttribute("data-expression")===mood);b.holdMood=has&&mood!=="normal"?mood:null;b.holdUntil=performance.now()+duration;
    clearTimeout(b._moodT);b._moodT=setTimeout(()=>{b.holdMood=null;if(!b.busy&&!b.stroll)petPlay(b,"idle",true);},duration);return;}
  const body=el.querySelector(".playerpetbody");if(!body)return;
  const w=el.classList.contains("pet-preview")?50:56;
  body.innerHTML=`${cafePetStaticHTML(pet,mood,w,petWearables())}<span class="playerpettag" aria-hidden="true">♥</span>`;
  clearTimeout(el._petMoodTimer);
  el._petMoodTimer=setTimeout(()=>{if(body.isConnected)body.innerHTML=`${cafePetStaticHTML(pet,"normal",w,petWearables())}<span class="playerpettag" aria-hidden="true">♥</span>`;},duration);
}
function animatePlayerPet(el,action,options={}){
  if(!el)return;
  const repeats=Math.max(1,Math.min(3,Math.round(Number(options.repeats)||1)));
  const actionMs=PLAYER_PET_ACTION_MS[action]||1500;
  const b=cafeBpetOf(el);
  if(b){
    if(!b.svg)return;
    if(b.stroll){b.stroll=null;}
    b.busy=true;petPlay(b,PLAYER_PET_RIG_ACTION[action]||"tail",true);
    clearTimeout(b._actT);b._actT=setTimeout(()=>{b.busy=false;
      if(Math.abs(b.x-b.home.x)>1){cafeStartStroll(b);b.stroll.legs=[{...b.home}];}else petPlay(b,"idle",true);
      if(options.reschedule!==false&&el.closest(".stage"))schedulePlayerPetIdle();},actionMs*repeats+200);
    return;
  }
  /* previews: a small hop or wiggle of the whole still drawing */
  const safe=action==="roll"?"wiggle":action;
  const cls=`pet-${safe}`;el.classList.remove("pet-hop","pet-wiggle","pet-look","pet-stretch","pet-sleep","pet-roll","pet-wave","pet-yawn");
  el.style.setProperty("--pet-action-count",String(repeats));void el.offsetWidth;el.classList.add(cls);
  let finished=false;
  const done=()=>{if(finished)return;finished=true;el.classList.remove(cls);el.style.removeProperty("--pet-action-count");if(options.reschedule!==false&&el.closest(".stage"))schedulePlayerPetIdle();};
  const body=el.querySelector(".playerpetbody")||el;
  body.addEventListener("animationend",done,{once:true});
  setTimeout(done,actionMs*repeats+350);
}
/* right answer: a jump of joy; wrong answer: ears down for a moment */
function reactActivePlayerPetToAnswer(correct){
  const pet=activePlayerPet(P()),el=document.querySelector(".stage [data-player-pet]");
  if(!pet||!el)return;
  clearPlayerPetIdle();
  const b=cafeBpetOf(el);
  if(b&&b.svg){b.stroll=null;b.busy=true;petPlay(b,correct?"jump":"sad",true);clearTimeout(b._actT);
    b._actT=setTimeout(()=>{b.busy=false;if(Math.abs(b.x-b.home.x)>1){cafeStartStroll(b);b.stroll.legs=[{...b.home}];}else petPlay(b,"idle",true);schedulePlayerPetIdle();},correct?1500:1850);
    return;}
  showPlayerPetMood(el,pet,correct?"good":"bad",1450);
  animatePlayerPet(el,correct?"wiggle":"look");
  playerPetEmote(el,correct?"😊":"💭");
}
/* menu, shop and theme previews: the café pet standing by its bed */
function playerCafePetHTML(context="stage"){
  const p=P(),pet=activePlayerPet(p);if(!pet)return "";
  const w=context==="stage"?56:46;
  return `<div class="playerpetspot pet-preview" data-player-pet="${pet.id}" role="button" tabindex="0" aria-label="${esc(pet.name.replace(/^a /,"Your "))} — tap for a reaction"><div class="playerpetbody">${cafePetStaticHTML(pet,"normal",w,petWearables(p))}<span class="playerpettag" aria-hidden="true">♥</span></div><span class="playerpetemote" aria-hidden="true"></span></div>`;
}

/* the eight ready-made baristas are needed on the first menu; pets soon after */
setTimeout(()=>{["mei","marcus","tomek","hana","amara","arjun","finn","leo"].forEach(id=>CafeArt.load("chars",id));},300);
setTimeout(()=>{if(typeof PETS!=="undefined")CafeArt.preload("pets",PETS.map(x=>x.id));},2500);

/* shop tiles show the café decoration's own artwork */
function cafeShopArt(it){
  if(!it||it.dest!=="cafe")return "";
  if(DECOR_META[it.id]||DECOR_TILES.has(it.id))return `<img src="${decorSrc(it.id)}" alt="" loading="lazy">`;
  if(it.id==="aurora")return `<img src="${ART_DIR}decor/aurora.svg" alt="" loading="lazy">`;
  return "";
}

/* ============================================================
   Stage 4: the barista from the Customisation SVG pack

   art/custom/parts.json (tools/build_custom.py) holds the pack's base
   figure with colour variables, plus — for every choice — only the parts
   that choice changes. A look is assembled by swapping those parts in,
   so every hairstyle, colour, eye/brow/cheek/beard choice, glasses style
   and every shop wearable shows on the same rigged body the customers
   use (it walks, waves and changes faces the same way).
   ============================================================ */
const CafeCustom={lib:null,wait:null,cache:new Map(),
  load(){if(this.lib)return Promise.resolve(this.lib);
    if(!this.wait)this.wait=fetch(`${ART_DIR}custom/parts.json`).then(r=>r.ok?r.json():null).then(j=>{this.lib=j;return j;}).catch(()=>null);
    return this.wait;}
};
const CAFE_CLOTH_STYLES=new Set(["tee","polo","shirt","hoodie","stripes"]);
function cafeHex(c,fb){return typeof c==="string"&&/^#[0-9a-f]{6}$/i.test(c)?c:fb;}
function cafeMul(hex,f){const n=parseInt(hex.slice(1),16);return "#"+[(n>>16)&255,(n>>8)&255,n&255].map(v=>Math.round(v*f).toString(16).padStart(2,"0")).join("");}
function cafeLighten(hex,f){const n=parseInt(hex.slice(1),16);return "#"+[(n>>16)&255,(n>>8)&255,n&255].map(v=>Math.round(v+(255-v)*f).toString(16).padStart(2,"0")).join("");}
/* the game's look + worn items -> pack option keys and colours */
function cafeCustomRecipe(look,opts={}){
  const lib=CafeCustom.lib,O=lib.options,has=k=>!!O[k];
  const gStyleItem=opts.gstyle?SHOP.find(s=>s.id===opts.gstyle):null,gColorItem=opts.gcolor?SHOP.find(s=>s.id===opts.gcolor):null;
  let style=(gStyleItem&&gStyleItem.gs)||(look.garment&&look.garment.style)||"tee";if(!CAFE_CLOTH_STYLES.has(style))style="tee";
  const apron=opts.apron==="waistcoat"?"waistcoat":opts.apron?"apron_cherry":"none";
  const cloth=cafeHex(gColorItem&&gColorItem.c,cafeHex(look.garment&&typeof GARMENT_PALETTES!=="undefined"&&GARMENT_PALETTES[look.garment.palette],cafeHex(look.top,"#3E7CA6")));
  const shape=["round","tall","almond","sleepy","wide","upturned"].includes(look.eyeShape)?look.eyeShape:"round";
  const lash=["classic","short","long","flick","none"].includes(look.lashStyle)?look.lashStyle:(look.lashes===false?"none":"classic");
  const keys=[`clothing/${style}--${apron}`,`hair/${look.hairstyle}`,`eyes/${shape}--${lash}`,`brows/${look.brows||"natural"}`,`cheeks/${look.cheeks||"plain"}`,`facialhair/${look.facialHair||"none"}`];
  const extras=opts.extras||[];
  const shopEyes=extras.some(id=>{const it=SHOP.find(x=>x.id===id);return it&&it.slot==="eyes";});
  if(!shopEyes){if(look.accessory&&has(`glasses/${look.accessory}`))keys.push(`glasses/${look.accessory}`);else if(opts.glasses)keys.push("glasses/glasses");}
  [opts.hat,opts.badge,...extras].forEach(id=>{if(id&&has(`acc/${id}`))keys.push(`acc/${id}`);});
  const skin=cafeHex(look.skin,"#E8B88A"),hair=cafeHex(look.hair,"#2B1B12"),iris=cafeHex(look.iris,"#6E4A2E"),glass=cafeHex(look.glassesColor,"#2E2440"),fabric=cafeHex(look.hijab,"#2F3E66");
  const vars={"--skin":skin,"--skin-d579":cafeMul(skin,.579),"--skin-d690":cafeMul(skin,.69),"--hair":hair,"--hair-d680":cafeMul(hair,.68),"--hair-d720":cafeMul(hair,.72),"--hair-l240":cafeLighten(hair,.24),
    "--iris":iris,"--cloth":cloth,"--cloth-d760":cafeMul(cloth,.76),"--cloth-d900":cafeMul(cloth,.9),"--cloth-d910":cafeMul(cloth,.91),"--cloth-l250":cafeLighten(cloth,.25),
    "--glass":glass,"--fabric":fabric,"--fabric-l240":cafeLighten(fabric,.24),"--fabric-l278":cafeLighten(fabric,.278)};
  return {keys:keys.filter(has),vars};
}
const CAFE_SVGNS="http://www.w3.org/2000/svg";
function cafeFrag(markup){return new DOMParser().parseFromString(`<svg xmlns="${CAFE_SVGNS}">${markup}</svg>`,"image/svg+xml").documentElement.firstElementChild;}
/* where the customisation pack's anchors live on a ready-made barista drawing */
const CAFE_PACK_ANCHOR={'[data-part="custom-head"]':'[data-joint="head"]','[data-part="common-frame"]':'[data-part="common-frame"]'};
function cafeApplyOption(svg,opt){
  if(!opt)return;
  const find=p=>svg.querySelector(`[data-part="${p}"]`);
  for(const p in opt.set){const old=find(p);if(old)old.replaceWith(document.importNode(cafeFrag(opt.set[p]),true));}
  (opt.remove||[]).forEach(p=>{const el=find(p);if(el)el.remove();});
  /* several wearables can share one slot name (a badge and a belt are both
     "body-item-front"), so every added part goes in, each in its own place */
  (opt.add||[]).forEach(a=>{let node=document.importNode(cafeFrag(a.svg),true);
    let par=a.parent?svg.querySelector(a.parent):null,wrap=null;
    if(!par&&a.parent&&CAFE_PACK_ANCHOR[a.parent]){par=svg.querySelector(CAFE_PACK_ANCHOR[a.parent]);
      /* the part was drawn in the pack's frame for that anchor; carry it into this drawing's frame */
      const src=cafeFoundationDoc()&&cafeFoundationDoc().querySelector(a.parent);
      if(par&&src){const m=cafeChainMatrix(par).inverse().multiply(cafeChainMatrix(src));
        if(!m.isIdentity){wrap=document.createElementNS(CAFE_SVGNS,"g");wrap.setAttribute("transform",`matrix(${[m.a,m.b,m.c,m.d,m.e,m.f].map(v=>+v.toFixed(4)).join(" ")})`);}}}
    if(wrap){wrap.appendChild(node);node=wrap;}
    const prev=a.after?svg.querySelector(a.after):null;
    if(prev&&prev.parentNode)prev.after(node);
    else if(par){if(a.after)par.appendChild(node);else par.prepend(node);}   /* a missing neighbour: in front; none named: behind */
    else svg.appendChild(node);});
}
/* the transform from the drawing's root down to (and including) an element */
function cafeChainMatrix(el){
  const chain=[];for(let n=el;n&&n.tagName&&n.tagName.toLowerCase()!=="svg";n=n.parentNode)chain.unshift(n);
  let m=new DOMMatrix();
  chain.forEach(n=>{const t=n.transform&&n.transform.baseVal&&n.transform.baseVal.consolidate();if(t){const k=t.matrix;m=m.multiply(new DOMMatrix([k.a,k.b,k.c,k.d,k.e,k.f]));}});
  return m;
}
function cafeFoundationDoc(){
  if(!CafeCustom.lib)return null;
  if(!CafeCustom.foundDoc){try{CafeCustom.foundDoc=document.importNode(new DOMParser().parseFromString(CafeCustom.lib.foundation,"image/svg+xml").documentElement,true);}catch(e){return null;}}
  return CafeCustom.foundDoc;
}
/* a ready-made barista wearing shop accessories: their own drawing with the
   pack's hats, glasses, scarves and badges added (clothes stay their own) */
function cafeOutfitFromShop(o){return !!o&&!!((o.apron&&o.apron!=="apron_cherry")||o.gstyle||o.gcolor);}
function cafeDressPack(t,look,opts={}){
  const lib=CafeCustom.lib;if(!lib||!t)return null;
  const r=cafeCustomRecipe(look||{},opts),keys=r.keys.filter(k=>k.startsWith("acc/")||k.startsWith("glasses/"));
  if(!keys.length)return t;
  const key="pack|"+t.length+"|"+t.slice(-40)+keys.join("|");
  if(CafeCustom.cache.has(key))return CafeCustom.cache.get(key);
  let svg;try{svg=document.importNode(new DOMParser().parseFromString(t,"image/svg+xml").documentElement,true);}catch(e){return null;}
  /* only the added parts: the drawing keeps its own face (sunglasses sit over the eyes) */
  keys.forEach(k=>{const o=lib.options[k];if(o)cafeApplyOption(svg,{set:{},remove:[],add:o.add||[]});});
  /* the pack's own colours for the added parts (the drawing keeps its own) */
  const st=svg.getAttribute("style")||"";svg.setAttribute("style",st+(st&&!/;\s*$/.test(st)?";":"")+Object.entries(r.vars).map(([k,v])=>`${k}:${v}`).join(";"));
  const out=new XMLSerializer().serializeToString(svg);
  if(CafeCustom.cache.size>40)CafeCustom.cache.clear();
  CafeCustom.cache.set(key,out);return out;
}
/* the four game faces: mouth + brows (and closed eyes for a blink) come
   from the pack's expression files; the player's own eye shape stays */
function cafeExpressionWrap(svg,lib){
  const O=lib.options,face={normal:null,happy:O["mouth/happy"],concern:O["mouth/sad"],blink:O["mouth/blink"]};
  ["mouth","brows","eyes"].forEach(part=>{
    const base=svg.querySelector(`[data-part="${part}"]`);if(!base)return;
    const wrap=document.createElementNS(CAFE_SVGNS,"g");wrap.setAttribute("data-face-wrap",part);base.before(wrap);
    Object.entries(face).forEach(([st,opt])=>{
      let node=null;
      if(opt&&opt.set&&opt.set[part]&&!(part==="eyes"&&st!=="blink"))node=document.importNode(cafeFrag(opt.set[part]),true);
      else node=base.cloneNode(true);
      /* the pack tags its parts with their own expression; only the wrapper decides what shows */
      [node,...node.querySelectorAll("[data-expression]")].forEach(n=>{if(n.hasAttribute&&n.hasAttribute("data-expression")){n.removeAttribute("data-expression");n.removeAttribute("opacity");}});
      if(part==="eyes"&&st==="blink"&&opt&&!(opt.set&&opt.set.eyes)){node.querySelectorAll('[data-part="eye-white"],[data-part="upper-lid"]').forEach(n=>n.remove());}
      const g=document.createElementNS(CAFE_SVGNS,"g");g.setAttribute("data-expression",st);g.appendChild(node);wrap.appendChild(g);});
    base.remove();});
}
function cafeComposeCustom(look,opts={}){
  const lib=CafeCustom.lib;if(!lib||!look)return null;
  const r=cafeCustomRecipe(look,opts),key=r.keys.join("|")+JSON.stringify(r.vars);
  if(CafeCustom.cache.has(key))return CafeCustom.cache.get(key);
  let svg;try{svg=document.importNode(new DOMParser().parseFromString(lib.foundation,"image/svg+xml").documentElement,true);}catch(e){return null;}
  r.keys.forEach(k=>cafeApplyOption(svg,lib.options[k]));
  cafeExpressionWrap(svg,lib);
  svg.setAttribute("style",Object.entries(r.vars).map(([k,v])=>`${k}:${v}`).join(";"));
  svg.setAttribute("data-character","barista-custom");svg.setAttribute("aria-hidden","true");
  const out=new XMLSerializer().serializeToString(svg);
  if(CafeCustom.cache.size>40)CafeCustom.cache.clear();
  CafeCustom.cache.set(key,out);return out;
}

/* ---- one entry point for every character drawing in the game ---- */
const CAFE_PORTRAIT_VB="30 36 260 338";   /* waist-up crop of the 320×500 figure for small boxes */
let cafeLookIds=null;
function cafeLookId(look){
  if(!cafeLookIds){cafeLookIds=new WeakMap();
    (typeof CUSTOMERS!=="undefined"?CUSTOMERS:[]).forEach(c=>c.look&&cafeLookIds.set(c.look,c.id));
    (typeof AVATARS!=="undefined"?AVATARS:[]).forEach(a=>a.look&&cafeLookIds.set(a.look,a.id));}
  return look&&typeof look==="object"?cafeLookIds.get(look)||null:null;
}
function cafeWearsShop(o){return !!o&&!!((o.apron&&o.apron!=="apron_cherry")||o.hat||o.glasses||o.badge||o.gstyle||o.gcolor||(o.extras&&o.extras.length));}
function cafePortrait(svgText,expr,w){
  return cafeCharStaticHTML(svgText,CAFE_FACE[expr]||"normal").replace(/<svg /,`<svg width="${w}" height="${Math.round(w*1.3)}" `).replace(/viewBox="[^"]*"/,`viewBox="${CAFE_PORTRAIT_VB}"`);
}
if(typeof characterSVG==="function"){
  const previousCharacterSVG=characterSVG;
  characterSVG=function(look,expr,opts={}){
    try{
      const w=opts.w||96,id=cafeLookId(look),preset=id&&CAFE_CHAR_IDS.has(id)&&AVATARS.some(a=>a.id===id);
      const custom=!!(look&&(look.eyeShape||look.faceFix))||(preset&&cafeOutfitFromShop(opts));
      if(!custom&&id&&CAFE_CHAR_IDS.has(id)){const t=CafeArt.get("chars",id);
        if(t){if(!preset||!cafeWearsShop(opts))return cafePortrait(t,expr,w);
          const d=CafeCustom.lib?cafeDressPack(t,look,opts):null;if(d)return cafePortrait(d,expr,w);CafeCustom.load();}
        else CafeArt.load("chars",id);}
      else if(custom){const t=CafeCustom.lib?cafeComposeCustom(look,opts):null;if(t)return cafePortrait(t,expr,w);CafeCustom.load();}
    }catch(e){}
    return previousCharacterSVG(look,expr,opts);
  };
}
/* fetch the art the first screens need */
setTimeout(()=>{CafeCustom.load();if(typeof CUSTOMERS!=="undefined")CafeArt.preload("chars",CUSTOMERS.map(c=>c.id).filter(id=>CAFE_CHAR_IDS.has(id)));},600);
