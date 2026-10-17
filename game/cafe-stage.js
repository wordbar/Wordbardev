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
const CAFE_W=360, CAFE_H=274;
/* the game's gold coin icon (styled in index.html) */
const COIN='<i class="wbcoin" aria-hidden="true"></i>';
/* Trimmed sprite sizes from tools/build_decor.py (decor-meta.json). */
const DECOR_META={"bunting_rainbow":{"w":360,"h":75},"fairylights":{"w":360,"h":59},"lantern_paper":{"w":360,"h":86},"stars_paper":{"w":360,"h":57},"cakedome":{"w":191,"h":210},"clock_station":{"w":210,"h":210},"flowerbox":{"w":300,"h":114},"fountain_gold":{"w":171,"h":210},"gumball":{"w":124,"h":210},"jukebox":{"w":167,"h":220},"lamp_brass":{"w":160,"h":210},"lamp_rose":{"w":169,"h":210},"menu_chalk":{"w":149,"h":210},"mug_rack":{"w":180,"h":105},"mural_market":{"w":240,"h":123},"plant_monstera":{"w":178,"h":210},"portrait_fox":{"w":210,"h":209},"poster_abc":{"w":159,"h":210},"poster_fruit":{"w":159,"h":210},"print_seaside":{"w":210,"h":125},"radio_retro":{"w":210,"h":153},"rug_ocean":{"w":360,"h":96},"rug_rose":{"w":360,"h":101},"rug_stripe":{"w":360,"h":104},"shelf_books":{"w":240,"h":120},"shelf_kegs":{"w":200,"h":118},"shelf_trophies":{"w":240,"h":89},"stool_cherry":{"w":151,"h":210},"stool_oak":{"w":158,"h":210},"stool_simple":{"w":141,"h":210},"stool_velvet":{"w":144,"h":210},"window_awning":{"w":299,"h":330},"window_stained":{"w":250,"h":330},"petbasket":{"w":240,"h":145},"petbed_cloud":{"w":240,"h":161}};
const DECOR_TILES=new Set(["counter_marble","floor_cocoa","floor_honey","floor_slate","tiles_terra","wall_blush","wall_meadow","wall_sky","wall_sunny"]);
const ART_DIR="art/";
const decorSrc=id=>`${ART_DIR}decor/${id}.webp`;

/* ---- scene geometry (design units) ---- */
const CAFE_GEO=Object.freeze({
  wallBottom:150,
  window:{x:128,y:22,w:82,h:76},
  door:{x:318,y:30,w:38,h:120},
  bCounter:{x:0,w:122,top:139,face:149,bottom:214},      /* barista counter (left) */
  bar:{x:196,w:132,top:126,face:136,bottom:198},         /* raised customer bar (right) */
  bed:{x:44,y:262},                                     /* barista pet bed, front left */
  barista:{x:66,feet:178,k:.9},
  serve:{x:160,feet:216,k:1},                           /* open area: order + collect */
  queue:[{x:228,feet:166,k:.84},{x:262,feet:164,k:.83},{x:296,feet:162,k:.82}],
  stash:{x:346,feet:156,k:.8},                          /* behind the door: overflow queue */
  doorIn:{x:337,feet:152,k:.78},
  exit:{x:166,feet:420,k:1.15},                         /* straight down, out of the picture */
  barTopY:126, counterTopY:139
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

/* ---- the view through the window and the glass door ---- */
function outsideViewSVG(x,y,w,h,T,L,uid,clip){
  const ground=y+h*.78;
  const day=`<g class="cafe-window-day"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${L.daySky}"/>
    <circle cx="${x+w*.78}" cy="${y+h*.2}" r="${Math.min(w,h)*.09}" fill="#FFE27A"/>
    <path d="M${x+w*.08} ${y+h*.3} q${w*.06} ${-h*.08} ${w*.12} 0 q${w*.06} ${-h*.06} ${w*.12} 0" fill="none" stroke="#FFF" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>
    <path d="M${x} ${ground} L${x} ${y+h*.56} l${w*.1} 0 l0 ${-h*.12} l${w*.12} 0 l0 ${h*.06} l${w*.1} 0 l0 ${-h*.2} l${w*.14} 0 l0 ${h*.14} l${w*.1} 0 l0 ${-h*.06} l${w*.16} 0 l0 ${h*.12} l${w*.12} 0 l0 ${-h*.08} l${w*.16} 0 L${x+w} ${ground} Z" fill="#C9D9E6" opacity=".9"/>
    <g fill="#8CBF6A"><circle cx="${x+w*.16}" cy="${ground-h*.08}" r="${h*.17}"/><circle cx="${x+w*.42}" cy="${ground-h*.04}" r="${h*.13}"/><circle cx="${x+w*.86}" cy="${ground-h*.06}" r="${h*.18}"/></g>
    <g fill="#6FA455"><circle cx="${x+w*.3}" cy="${ground}" r="${h*.12}"/><circle cx="${x+w*.68}" cy="${ground+h*.02}" r="${h*.14}"/></g>
    <rect x="${x}" y="${ground}" width="${w}" height="${y+h-ground}" fill="#A7CF7E"/></g>`;
  const night=`<g class="cafe-window-night"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${L.nightSky}"/>
    <circle cx="${x+w*.78}" cy="${y+h*.2}" r="${Math.min(w,h)*.08}" fill="#F2E8C8"/><circle cx="${x+w*.82}" cy="${y+h*.18}" r="${Math.min(w,h)*.07}" fill="${L.nightSky}"/>
    <g fill="#F2E8C8"><circle cx="${x+w*.2}" cy="${y+h*.16}" r=".9"/><circle cx="${x+w*.38}" cy="${y+h*.28}" r=".7"/><circle cx="${x+w*.55}" cy="${y+h*.12}" r=".8"/></g>
    <path d="M${x} ${ground} L${x} ${y+h*.56} l${w*.1} 0 l0 ${-h*.12} l${w*.12} 0 l0 ${h*.06} l${w*.1} 0 l0 ${-h*.2} l${w*.14} 0 l0 ${h*.14} l${w*.1} 0 l0 ${-h*.06} l${w*.16} 0 l0 ${h*.12} l${w*.12} 0 l0 ${-h*.08} l${w*.16} 0 L${x+w} ${ground} Z" fill="#2B3A5A"/>
    <g fill="#FFD58A" opacity=".85"><rect x="${x+w*.13}" y="${y+h*.62}" width="2.4" height="2.4"/><rect x="${x+w*.47}" y="${y+h*.5}" width="2.4" height="2.4"/><rect x="${x+w*.8}" y="${y+h*.6}" width="2.4" height="2.4"/></g>
    <g fill="#2F4A3A"><circle cx="${x+w*.16}" cy="${ground-h*.08}" r="${h*.17}"/><circle cx="${x+w*.86}" cy="${ground-h*.06}" r="${h*.18}"/></g>
    <rect x="${x}" y="${ground}" width="${w}" height="${y+h-ground}" fill="#2E4A33"/></g>`;
  let themed="";
  if(T.window==="snow")themed=`<g fill="#FFF">${[[.15,.3],[.35,.5],[.62,.22],[.8,.45],[.45,.15],[.25,.68],[.7,.66]].map(([a,b])=>`<circle cx="${x+w*a}" cy="${y+h*b}" r="1.5"/>`).join("")}</g><rect x="${x}" y="${y+h*.86}" width="${w}" height="${h*.14}" fill="#F4F8FB"/>`;
  if(T.window==="blossom")themed=`<g fill="#F0A8C0">${[[.18,.24],[.3,.42],[.52,.2],[.64,.38],[.82,.3],[.4,.62]].map(([a,b])=>`<circle cx="${x+w*a}" cy="${y+h*b}" r="2.2"/>`).join("")}</g>`;
  if(T.window==="lantern")themed=`<g class="lanternglow"><rect x="${x+w*.2}" y="${y+h*.28}" width="8" height="11" rx="3" fill="#E86A4A"/><rect x="${x+w*.62}" y="${y+h*.34}" width="7" height="10" rx="3" fill="#E8A84A"/></g>`;
  if(T.window==="night")themed=`<g class="cafe-pumpkin"><circle cx="${x+w*.2}" cy="${y+h*.88}" r="4" fill="#E8891D"/><circle cx="${x+w*.74}" cy="${y+h*.9}" r="3.2" fill="#E8891D"/></g>`;
  return `<g clip-path="url(#${clip})">${day}${night}${themed}</g>`;
}

/* ---- the back of the café: walls, window, door, back bar, wall decor ---- */
function cafeBackSVG(uid,ctx){
  const {T,L,item,wallFill,floorFill}=ctx,G=CAFE_GEO,W=G.window,D=G.door;
  const wood="#B37B47",woodD="#8A5A2E",ink="#463A54",trim=shade(T.counter,-.18);
  const windowI=item("window"),shelfI=item("shelf"),displayI=item("display"),wallart=item("wallart"),menuI=item("menu"),rugI=item("rug"),lightsI=item("lights"),lampI=item("lamp"),bunting=item("bunting");
  const stained=windowI&&windowI.id==="window_stained";
  let s=`<rect x="-320" width="${CAFE_W+640}" height="${G.wallBottom}" fill="${wallFill}"/>
  <rect x="-320" y="${G.wallBottom}" width="${CAFE_W+640}" height="${CAFE_H-G.wallBottom}" fill="${floorFill}"/>
  <g class="floor-lines" stroke="${ink}" stroke-width=".8" opacity=".09"><path d="M0 168 H360 M0 190 H360 M0 216 H360 M0 246 H360"/><path d="M90 150 L60 274 M180 150 V274 M270 150 L300 274"/></g>
  <rect x="-320" y="${G.wallBottom-5}" width="${CAFE_W+640}" height="7" fill="${woodD}" stroke="${ink}" stroke-width="1.4"/>
  <rect x="-320" width="${CAFE_W+640}" height="9" fill="${wood}" stroke="${ink}" stroke-width="1.6"/>
  <path d="M-320 9 H680" stroke="${woodD}" stroke-width="2"/>
  <rect x="122" y="9" width="5" height="${G.wallBottom-14}" fill="${wood}" stroke="${ink}" stroke-width="1.2"/>
  <rect x="311" y="9" width="6" height="${G.wallBottom-14}" fill="${wood}" stroke="${ink}" stroke-width="1.2"/>`;
  /* window */
  s+=`<clipPath id="wv${uid}"><rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="3"/></clipPath>
  <clipPath id="dv${uid}"><rect x="${D.x+4}" y="${D.y+5}" width="${D.w-8}" height="${D.h-9}" rx="2"/></clipPath>`;
  if(stained){
    s+=decorImg("window_stained",W.x-2,W.y-6,W.w+4,W.h+12,{anchor:"middle"});
  }else{
    s+=`<rect x="${W.x-4}" y="${W.y-4}" width="${W.w+8}" height="${W.h+8}" rx="4" fill="${wood}" stroke="${ink}" stroke-width="2"/>
    ${outsideViewSVG(W.x,W.y,W.w,W.h,T,L,uid,`wv${uid}`)}
    <g stroke="${wood}" stroke-width="3"><path d="M${W.x+W.w/2} ${W.y} V${W.y+W.h} M${W.x} ${W.y+W.h*.48} H${W.x+W.w}"/></g>
    <rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="3" fill="none" stroke="${ink}" stroke-width="1.6"/>
    <rect x="${W.x-7}" y="${W.y+W.h+2}" width="${W.w+14}" height="5" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.4"/>`;
    if(windowI&&windowI.id==="window_awning")s+=decorImg("window_awning",W.x-14,W.y-17,W.w+28,W.h+26,{anchor:"top"});
  }
  if(windowI&&windowI.id==="flowerbox")s+=decorImg("flowerbox",W.x-6,W.y+W.h-8,W.w+12,24);
  /* glass door with the outside behind it; the leaf slides open */
  s+=`<rect x="${D.x}" y="${D.y}" width="${D.w}" height="${D.h}" fill="${wood}" stroke="${ink}" stroke-width="2"/>
  ${outsideViewSVG(D.x+4,D.y+5,D.w-8,D.h-9,T,L,uid+"d",`dv${uid}`)}
  <g class="door-leaf"><rect x="${D.x+4}" y="${D.y+5}" width="${D.w-8}" height="${D.h-9}" fill="#BFE3EA" opacity=".28" stroke="#5C8A6E" stroke-width="2.4"/>
    <path d="M${D.x+8} ${D.y+14} l8 -6 M${D.x+8} ${D.y+24} l14 -11" stroke="#FFF" stroke-width="1.6" opacity=".7"/>
    <rect x="${D.x+7}" y="${D.y+62}" width="2.4" height="12" rx="1.2" fill="#D8A521" stroke="${ink}" stroke-width=".8"/></g>
  <path d="M${D.x+D.w/2} ${D.y-1} v5" stroke="${ink}" stroke-width="1"/><path d="M${D.x+D.w/2-3} ${D.y+9} q3 -6 6 0 z" fill="#D8A521" stroke="${ink}" stroke-width="1" class="door-bell"/>`;
  /* the barista's back bar: shelves, espresso machine, grinder, cups */
  const purchasedShelf=shelfI?decorImg(shelfI.id,10,16,74,24):"";
  s+=`<g class="backbar">
    <rect x="6" y="38" width="88" height="5" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.4"/>
    ${purchasedShelf||`<g stroke="${ink}" stroke-width="1.1"><rect x="14" y="25" width="10" height="13" rx="2" fill="#F4EAD8"/><rect x="28" y="22" width="11" height="16" rx="2" fill="#E9C9A0"/><rect x="43" y="26" width="10" height="12" rx="2" fill="#F4EAD8"/><path d="M60 38 q0 -10 8 -10 q8 0 8 10 z" fill="#7FA65A"/><path d="M80 38 l2 -8 l8 0 l2 8z" fill="#C86B4A"/></g>`}
    <rect x="6" y="62" width="88" height="5" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.4"/>
    <g stroke="${ink}" stroke-width="1.1">${[14,26,38,50].map((x,i)=>`<path d="M${x} 62 v-7 h9 v7" fill="#FFF"/><path d="M${x+9} 56 q3 0 3 3 q0 2 -3 2" fill="none"/>`).join("")}</g>
    <rect x="2" y="110" width="118" height="${G.wallBottom-110}" fill="${trim}" stroke="${ink}" stroke-width="1.6"/>
    <rect x="0" y="106" width="122" height="6" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.6"/>
    <g class="espresso">
      <rect x="8" y="72" width="54" height="34" rx="5" fill="#E8DCC4" stroke="${ink}" stroke-width="2"/>
      <rect x="8" y="72" width="54" height="8" rx="4" fill="#C0392B" stroke="${ink}" stroke-width="1.4"/>
      <path d="M12 68 h46" stroke="${ink}" stroke-width="1.2"/><g stroke="${ink}" stroke-width=".9" fill="#FFF"><rect x="14" y="63" width="7" height="5" rx="1"/><rect x="24" y="63" width="7" height="5" rx="1"/><rect x="34" y="63" width="7" height="5" rx="1"/></g>
      <circle cx="54" cy="86" r="3.2" fill="#FFF" stroke="${ink}" stroke-width="1"/><path d="M54 86 l1.6 -1.6" stroke="${ink}" stroke-width=".8"/>
      <path d="M15 84 h12 l-2 4 h-8 z M31 84 h12 l-2 4 h-8 z" fill="#6E6A72" stroke="${ink}" stroke-width="1"/>
      <path d="M27 86.5 h7 M43 86.5 h6" stroke="#2E2A36" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M16 99 h8 l-1 5 q-3 1.6 -6 0 z M32 99 h8 l-1 5 q-3 1.6 -6 0 z" fill="#FFF" stroke="${ink}" stroke-width="1"/>
      <rect x="11" y="104" width="44" height="2.4" rx="1" fill="#9A9AA6" stroke="${ink}" stroke-width=".7"/>
      <path d="M58 92 l4 9" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
    </g>
    <path class="steam" d="M62 96 q2 -4 0 -8 q-2 -4 1 -7" fill="none" stroke="#FFF" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="66" y="80" width="15" height="26" rx="3" fill="#2E2A36" stroke="${ink}" stroke-width="1.6"/><path d="M67 80 l2 -10 l9 0 l2 10z" fill="#6B4A36" stroke="${ink}" stroke-width="1.2"/>
    ${displayI&&displayI.id==="shelf_kegs"?"":`<g stroke="${ink}" stroke-width="1"><rect x="86" y="96" width="9" height="10" rx="1.5" fill="#FFF"/><rect x="87" y="88" width="7" height="8" rx="1.5" fill="#FFF"/><rect x="88" y="81" width="5" height="7" rx="1.5" fill="#FFF"/></g>`}
  </g>`;
  if(displayI&&displayI.id==="mug_rack")s+=decorImg("mug_rack",64,42,46,18);
  if(displayI&&displayI.id==="shelf_kegs")s+=decorImg("shelf_kegs",83,82,38,25);
  if(displayI&&displayI.id==="jukebox")s+=decorImg("jukebox",166,94,28,56);
  /* wall art and the menu board on the right-hand wall, above the bar */
  if(wallart)s+=wallart.id==="mural_market"?decorImg("mural_market",214,24,52,30,{anchor:"middle"}):decorImg(wallart.id,218,22,40,40,{anchor:"middle"});
  s+=menuI?decorImg("menu_chalk",268,18,36,50,{anchor:"middle"}):`<g><rect x="272" y="22" width="30" height="40" rx="2" fill="${wood}" stroke="${ink}" stroke-width="1.4"/><rect x="275" y="25" width="24" height="34" fill="#2E3A33"/><path d="M279 33 h16 M279 40 h12 M279 47 h14" stroke="#F4EAD8" stroke-width="1.2" opacity=".7"/></g>`;
  /* wall plants and a pendant lamp (part of the base café) */
  s+=`<g class="vines" stroke="${ink}" stroke-width=".9"><path d="M4 9 q4 18 0 30 q-4 12 2 26" fill="none" stroke="#5E8A47" stroke-width="1.4"/>${[[5,16],[2,28],[6,40],[3,52]].map(([x,y])=>`<ellipse cx="${x+3}" cy="${y}" rx="4" ry="2.4" fill="#7FA65A" transform="rotate(-30 ${x+3} ${y})"/>`).join("")}
    <path d="M313 9 q-4 16 1 28 q4 12 -2 22" fill="none" stroke="#5E8A47" stroke-width="1.4"/>${[[308,18],[314,30],[307,44],[313,56]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="4" ry="2.4" fill="#7FA65A" transform="rotate(25 ${x} ${y})"/>`).join("")}</g>`;
  if(!lightsI)s+=[150,188].map(x=>`<g class="pendant"><path d="M${x} 9 v10" stroke="${ink}" stroke-width="1"/><path d="M${x-9} 28 q9 -12 18 0 z" fill="#3E7055" stroke="${ink}" stroke-width="1.4"/><ellipse cx="${x}" cy="28.5" rx="3.6" ry="1.8" fill="#FFE7A8"/></g>`).join("");
  /* rug on the open floor (customers walk over it) */
  if(rugI)s+=decorImg(rugI.id,112,232,112,30,{anchor:"middle"});
  /* hanging decor: aurora behind, then strings */
  if(lightsI&&lightsI.id==="aurora")s+=auroraSVG(uid,128,8,184,62);
  if(bunting)s+=decorImg("bunting_rainbow",206,8,104,22,{anchor:"top"});
  if(lightsI&&lightsI.id==="fairylights")s+=hangingLightsSVG("fairy",uid,{x0:128,x1:206,y:11,sag:5,count:8});
  if(lightsI&&lightsI.id==="stars_paper")s+=decorImg("stars_paper",126,9,82,16,{anchor:"top"});
  if(lightsI&&lightsI.id==="neon_open")s+=`<g class="lanternglow"><rect x="142" y="12" width="54" height="16" rx="7" fill="none" stroke="#F26BA8" stroke-width="2.4"/><text x="169" y="24" text-anchor="middle" font-size="10" font-weight="800" fill="#F26BA8" font-family="'Baloo 2',cursive">OPEN</text></g>`;
  if(lampI&&lampI.id==="lantern_paper")s+=hangingLightsSVG("lantern",uid,{x0:8,x1:118,y:11,sag:6,count:5});
  return s;
}

/* ---- in front of the queue: both counters and what stands on them ---- */
function cafeFrontSVG(uid,ctx){
  const {T,item,counterFill}=ctx,G=CAFE_GEO,B=G.bCounter,R=G.bar,ink="#463A54";
  const panel=shade(T.counter,-.08),panelD=shade(T.counter,-.26),topEdge=shade(T.counter,.25);
  const counterI=item("counter"),displayI=item("display"),lampI=item("lamp"),stoolI=item("stool"),plantI=item("plant");
  const marble=counterI&&counterI.id==="counter_marble";
  const top=marble?counterFill:topEdge;
  const boards=(x0,x1,y0,y1)=>{let p="";for(let x=x0+12;x<x1-6;x+=14)p+=`M${x} ${y0+4} V${y1-4} `;return `<path d="${p}" stroke="${panelD}" stroke-width="1.1" opacity=".55"/>`;};
  let s=`<g class="barista-counter">
    <rect x="${B.x}" y="${B.face}" width="${B.w-4}" height="${B.bottom-B.face}" fill="${panel}" stroke="${ink}" stroke-width="2"/>
    ${boards(B.x,B.x+B.w-4,B.face,B.bottom)}
    <rect x="${B.x}" y="${B.bottom-6}" width="${B.w-4}" height="6" fill="${panelD}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M${B.x} ${B.top} H${B.x+B.w} L${B.x+B.w} ${B.face} H${B.x} Z" fill="${top}" stroke="${ink}" stroke-width="2"/>
    <path d="M${B.x+2} ${B.top+2} H${B.x+B.w-3}" stroke="#FFF" stroke-width="1.4" opacity=".55"/>
  </g>
  <g class="customer-bar">
    <rect x="${R.x+4}" y="${R.face}" width="${R.w-8}" height="${R.bottom-R.face}" fill="${panel}" stroke="${ink}" stroke-width="2"/>
    ${boards(R.x+4,R.x+R.w-4,R.face,R.bottom)}
    <rect x="${R.x+4}" y="${R.bottom-5}" width="${R.w-8}" height="5" fill="${panelD}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M${R.x} ${R.top} H${R.x+R.w} L${R.x+R.w} ${R.face} H${R.x} Z" fill="${top}" stroke="${ink}" stroke-width="2"/>
    <path d="M${R.x+2} ${R.top+2} H${R.x+R.w-3}" stroke="#FFF" stroke-width="1.4" opacity=".55"/>
    <g stroke="${ink}" stroke-width=".8"><path d="M${R.x+12} ${R.top} q6 10 0 18 q-5 8 1 16" fill="none" stroke="#5E8A47" stroke-width="1.3"/>${[[R.x+14,R.top+6],[R.x+9,R.top+14],[R.x+15,R.top+24],[R.x+11,R.top+32]].map(([x,y],i)=>`<ellipse cx="${x}" cy="${y}" rx="3.6" ry="2.2" fill="${i%2?"#6FA455":"#7FA65A"}" transform="rotate(${i%2?30:-30} ${x} ${y})"/>`).join("")}</g>
  </g>`;
  /* counter-top items on the barista counter's right end */
  if(counterI&&counterI.id==="fountain_gold")s+=decorImg("fountain_gold",70,B.top-27,22,28);
  if(displayI&&["cakedome","gumball","radio_retro"].includes(displayI.id))s+=decorImg(displayI.id,93,B.top-29,26,30);
  if(lampI&&lampI.id!=="lantern_paper")s+=decorImg(lampI.id,3,B.top-27,22,28);
  if(!lampI||lampI.id==="lantern_paper")s+=`<g><path d="M${R.x+R.w-16} ${R.top} h8 l-1.4 -9 q-2.6 -1.6 -5.2 0 z" fill="#F4EAD8" stroke="${ink}" stroke-width="1.1"/><circle cx="${R.x+R.w-12}" cy="${R.top-11}" r="3.4" fill="#F2F2F2" stroke="${ink}" stroke-width="1"/><circle cx="${R.x+R.w-14}" cy="${R.top-12}" r="1.2" fill="#F2B33D"/></g>`;
  /* stools in front of the customer bar */
  const stoolXs=[R.x+20,R.x+R.w-46];
  s+=stoolXs.map(x=>stoolI?decorImg(stoolI.id,x,R.bottom-40,28,52):
    `<g class="stool"><rect x="${x+4}" y="${R.bottom-36}" width="3.6" height="44" fill="#8A5A2E" stroke="${ink}" stroke-width="1.1"/><rect x="${x+20}" y="${R.bottom-36}" width="3.6" height="44" fill="#8A5A2E" stroke="${ink}" stroke-width="1.1"/><path d="M${x+5} ${R.bottom-6} h17" stroke="#8A5A2E" stroke-width="2.4"/><ellipse cx="${x+14}" cy="${R.bottom-38}" rx="14" ry="5" fill="#3E7055" stroke="${ink}" stroke-width="1.6"/><path d="M${x} ${R.bottom-38} v2.4 q14 6 28 0 v-2.4" fill="#2F5A43" stroke="${ink}" stroke-width="1.2"/></g>`).join("");
  if(plantI)s+=decorImg("plant_monstera",326,198,36,54);
  return s;
}

/* the café pet's bed sits on the floor in front of the barista counter */
function cafeBedSVG(ctx){
  const pb=ctx.item("petbed");if(!pb)return "";
  return decorImg(pb.id,CAFE_GEO.bed.x-32,CAFE_GEO.bed.y-30,64,34,{cls:"pet-furniture"});
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
  if(override)return {html:override,mode:"waist"};
  const id=cafeBaristaArtId(),t=id&&CafeArt.get("chars",id);
  if(t)return {html:cafeCharStaticHTML(t,"happy"),mode:"full"};
  if(id)CafeArt.load("chars",id).then(()=>{if(typeof cafeRefreshPreviews==="function")cafeRefreshPreviews();});
  return {html:playerSVG("happy",88),mode:"waist"};
}
/* when art arrives after a preview was drawn, redraw just the barista */
function cafeRefreshPreviews(){
  document.querySelectorAll(".scenebox .scene-barista.waist[data-refreshable]").forEach(el=>{
    const b=cafeBaristaPreview();if(b.mode!=="full")return;const h=CAFE_BOX*CAFE_GEO.barista.k,w=h*CHAR_ASPECT;
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
const CAFE_BOX=140, CHAR_ASPECT=320/500;

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
function cafeMirrored(e,svg){for(let n=e;n&&n!==svg;n=n.parentNode){const t=n.getAttribute&&n.getAttribute("transform");if(t&&/scale\(\s*-1/.test(t))return true;}return false;}
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
    arm.classList.add("waver");arm.style.setProperty("--ra",out*140);if(fore){fore.classList.add("waverF");fore.style.setProperty("--wi",out);}
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
  a.el.classList.remove("idle","walk","wave","hop","nod","bow");void a.el.offsetWidth;a.el.classList.add(cls);
  if(cls==="wave"&&a.waveSide&&a.svg){const h=a.J("hand-"+a.waveSide);
    /* the hand turns back > side > open palm while it rises, and back again */
    setTimeout(()=>cafeHandView(h,"edge"),300);setTimeout(()=>cafeHandView(h,"palm"),420);setTimeout(()=>cafeHandView(h,"edge"),1980);setTimeout(()=>cafeHandView(h,"relaxed"),2100);}
  clearTimeout(a.actT);a.actT=setTimeout(()=>{a.el.classList.remove(cls);if(!a.walk)a.el.classList.add("idle");},ms);
}
function cafeGreet(a,ms=2400){if(!a)return;if(a.waveSide&&!a.carrying)cafeAct(a,"wave",ms);else cafeAct(a,"nod",1150);}
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
  a.walk={segs,si:0,t:0,done,speed:CAFE_BOX*.55*(fast?1.45:1.12)};
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
function PF(pt,segs,dur,o){pt.faces.forEach(el=>{const st=el.getAttribute("data-expression");
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

/* ---------- one shared clock for walking, following and jumping ---------- */
const PET_GAP=30,PET_SPEED=CAFE_BOX*.62;
function cafeTick(now){
  STAGE.raf=0;if(!STAGE.mounted)return;
  const paused=typeof isSessionPaused==="function"&&isSessionPaused();
  if(paused&&!STAGE.pausedAt){STAGE.pausedAt=now;STAGE.pets.forEach(pt=>pt.anims.forEach(a=>a.pause()));}
  if(!paused&&STAGE.pausedAt){STAGE.pausedAt=0;STAGE.pets.forEach(pt=>pt.anims.forEach(a=>a.play()));STAGE.lastT=now;}
  const dt=Math.min(.05,Math.max(0,(now-(STAGE.lastT||now))/1000));STAGE.lastT=now;
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
  const a=pt.owner,target=a.s-PET_GAP;let moving=false;
  if(target>pt.s+.3){pt.s=Math.min(target,pt.s+PET_SPEED*dt*(pt.t?pt.t.spd:1));moving=true;}
  const pos=cafePathAt(a,Math.max(0,pt.s));const dx=pos.x-pt.x;if(Math.abs(dx)>.05)pt.dirX=Math.sign(dx);
  const kk=Math.max(.78,Math.min(1.15,1+(pos.feet-CAFE_GEO.serve.feet)/(CAFE_GEO.exit.feet-CAFE_GEO.serve.feet)*.15-(pos.feet<180?.12:0)));
  pt.x=pos.x;pt.g=pos.feet;pt.box=CAFE_PBOX*kk;pt.lane=pos.lane==="f"?"f":"b";cafePetPlace(pt);
  if(!pt.shown&&pt.s>2){pt.shown=true;pt.el.classList.add("shown");}
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
  const s=a.waveSide;if(!s)return;
  const hand=a.J("hand-"+s),arm=a.J("arm-"+s),fore=a.J("fore-"+s);
  if(a.bagSide||!food){
    const inw=(s==="r"?1:-1)*(a["mir"+s]?-1:1);
    [arm,fore].forEach(e=>{if(e){e.classList.add("holding");e.style.transition="transform .4s ease";}});
    if(arm)arm.style.transform=`rotate(${-inw*10}deg)`;if(fore)fore.style.transform=`rotate(${inw*118}deg)`;cafeHandView(hand,"grip-edge");
    setTimeout(()=>{if(a.el.isConnected)cafeHoldAt(a,hand,takeawayCupSVG(color));},cafeReduced()?0:380);
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
  STAGE.mounted=true;cafeMeasure();
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
  const o=playerRenderOpts(p);
  /* the pack baristas already wear the starting cherry apron */
  if((o.apron&&o.apron!=="apron_cherry")||o.hat||o.glasses||o.badge||o.gstyle||o.gcolor||(o.extras&&o.extras.length))return null;
  return p.avatar;
}
function cafeMakeBarista(){
  const G=CAFE_GEO.barista,id=cafeBaristaArtId();
  if(id){
    const a=cafeNewPerson(id,{lane:"b",x:G.x,feet:G.feet,k:G.k});a.el.id="barista";a.el.classList.add("is-barista");a.face="happy";
    STAGE.barista=a;const t=CafeArt.get("chars",id);if(t)cafeDressPerson(a,t);else CafeArt.load("chars",id).then(t=>{if(t)cafeDressPerson(a,t);else{cafeRemovePerson(a);STAGE.barista=null;cafeMakeFallbackBarista();}});
  }else cafeMakeFallbackBarista();
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
  if(a){cafeFace(a,CAFE_FACE[expr]||"happy");if(expr==="delighted")cafeGreet(a);return;}
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
    if(a.slot===i)return;
    const spot={...G.queue[i],lane:"b"};
    if(a.slot===undefined||a.slot==="stash"){
      /* in through the glass door, a step inside, then along to the place */
      Object.assign(a,{x:D.x,feet:D.feet,k:D.k,lane:"b"});cafePlace(a);a.el.classList.remove("waiting-offstage");
      cafeOpenDoor();cafeTrackStart(a);
      if(e.petActor){const pt=e.petActor;Object.assign(pt,{x:D.x,g:D.feet,s:0,shown:false,state:"follow",lane:"b"});pt.el.classList.remove("shown");cafePetPlace(pt);}
      cafeWalk(a,[{x:D.x-16,feet:D.feet+5,k:.8,lane:"b"},spot]);
    }else cafeWalk(a,[spot]);
    a.slot=i;
  });
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
    if(pt.svg){petPlay(pt,Math.random()<.5?"twitch":"tail",true);clearTimeout(pt._moodTimer);pt._moodTimer=setTimeout(()=>{if(pt.state==="counter"||pt.state==="follow")petPlay(pt,"idle",true);},2600);}
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
  layoutQueue(); setBarista("happy"); updateTopbar();
  const a=entry.actor,G=CAFE_GEO;a.slot="serve";
  if(a.path===undefined)cafeTrackStart(a);
  /* round the end of the bar into the open area in front of the barista */
  cafeWalk(a,[{x:G.bar.x-6,feet:172,k:.9,lane:"f"},{...G.serve,lane:"f"}],()=>{
    if(!SHIFT||SHIFT.current!==entry)return;
    cafeFace(a,"happy",1500);cafeGreet(a);
    cafePetToBar(entry);
    panelArrival(entry);
  },{fast:true});
}
/* the customer's pet catches up, then hops onto the end of the bar */
function cafePetToBar(entry){
  const pt=entry.petActor,a=entry.actor;if(!pt||!a)return;
  const go=()=>{if(!SHIFT||SHIFT.current!==entry||!pt.el.isConnected)return;
    if(pt.state!=="follow"||pt.s<a.s-PET_GAP-1){setTimeout(go,120);return;}
    pt.state="hop";cafePetJump(pt,CAFE_GEO.bar.x+15,CAFE_GEO.barTopY+1,"t",()=>{pt.state="counter";pt.box=CAFE_PBOX*.92;pt.dirX=-1;cafePetPlace(pt);petPlay(pt,"tail",true);
      setTimeout(()=>{if(pt.state==="counter"&&pt.move==="tail")petPlay(pt,"twitch");},2600);});};
  setTimeout(go,250);
}
/* answers: the customer's pet on the bar dances or droops */
function cafeCustomerPetReact(entry,correct){
  const pt=entry&&entry.petActor;if(!pt||pt.state!=="counter")return;
  petPlay(pt,correct?"dance":"sad",true);clearTimeout(pt._react);
  pt._react=setTimeout(()=>{if(pt.state==="counter")petPlay(pt,"twitch",true);},correct?3840:1800);
}

/* ---- the order: made at the machine, slid down the counter, collected ---- */
function cupSlide(entry,perfect,cb){
  const laneT=STAGE.laneT;if(!laneT||!STAGE.mounted){cb&&cb();return;}
  const cup=document.createElement("div");cup.className="orderitem";cup.innerHTML=drinkSVG(entry.ticket,perfect)+(entry.ticket.food?foodSVG(entry.ticket.food,perfect):"");
  laneT.appendChild(cup);
  const h=24,top=CAFE_GEO.counterTopY+1-h;
  cup.style.height=sy(h)+"px";
  cup.querySelectorAll(".foodartsprite,.foodartsprite img").forEach(n=>{n.style.height=sy(h)+"px";n.style.width=sy(h*52/49)+"px";n.style.flex="0 0 auto";});
  cup.style.transform=`translate(${sx(64)}px,${sy(top)}px) scale(.7)`;
  const d=dur(650);
  requestAnimationFrame(()=>{cup.style.transition="opacity .2s, transform .25s cubic-bezier(.3,1.5,.6,1)";cup.style.opacity="1";cup.style.transform=`translate(${sx(64)}px,${sy(top)}px)`;
    setTimeout(()=>{cup.style.transition=`transform ${d}ms ease`;cup.style.transform=`translate(${sx(CAFE_GEO.bCounter.w-30)}px,${sy(top)}px)`;
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
  if(S.mode==="normal" && S.served>=NORMAL_TARGET){ setTimeout(()=>endShift(false), dur(320)); return; }
  if(S.mode==="review" && (S.served>=REVIEW_TARGET || !reviewPool().length)){ setTimeout(()=>endShift(false), dur(320)); return; }
  if(S.pendingDebuts && S.pendingDebuts.length){ playDebut(S.pendingDebuts.shift()); return; }
  const pnl=$("#panel"); if(pnl)pnl.innerHTML=`<div class="waitmsg">Here comes the next customer…</div>`;
  pump();
}
/* straight down the middle and out of the picture, growing a little as
   they come closer; the pet hops down and follows */
function cafeLeave(entry){
  const a=entry.actor,pt=entry.petActor,G=CAFE_GEO;if(!a)return;
  if(pt){pt.leaving=true;
    const follow=()=>{pt.state="follow";a.path=[{x:pt.x,feet:pt.g,lane:"f",s:0},{x:a.x,feet:a.feet,lane:"f",s:Math.hypot(a.x-pt.x,(a.feet-pt.g)*1.4)}];a.s=a.path[1].s;pt.s=0;petPlay(pt,"idle",true);};
    if(pt.state==="counter"||pt.state==="hop"){pt.state="jump";cafePetJump(pt,a.x+22,a.feet-2,"f",follow);}else follow();}
  cafeWalk(a,[{x:G.serve.x+3,feet:G.serve.feet+30,k:1.04,lane:"f"},{x:G.exit.x,feet:G.exit.feet,k:G.exit.k,lane:"f"}],()=>{cafeRemovePerson(a);
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
    const a=makeActor(c,null),entry={cust:c,actor:a,node:a.el};hydrateActorVisual(entry);
    a.el.classList.remove("waiting-offstage");cafeOpenDoor();cafeTrackStart(a);const G=CAFE_GEO;
    cafeWalk(a,[{x:G.doorIn.x-16,feet:G.doorIn.feet+5,k:.8,lane:"b"},{x:G.queue[0].x,feet:G.queue[0].feet,k:.84,lane:"b"},{x:G.bar.x-6,feet:172,k:.9,lane:"f"},{...G.serve,lane:"f"}],()=>{
      spawnBurst($("#stage"));cafeFace(a,"happy",2600);cafeGreet(a);
      popEmote(entry,"🎉");
      const pnl=$("#panel");
      if(pnl)pnl.innerHTML=`<div class="debut felt"><b>🎉 New customer unlocked!</b>
        <div class="debutname">${esc(c.name)}</div>
        <small>${esc(c.blurb)}</small>
        <div class="custsay" lang="en-GB">“${esc(c.lines.arrive[rnd(c.lines.arrive.length)])}”</div>
        <small class="joined">${esc(c.name)} has joined the café!</small></div>`;
      setTimeout(()=>{
        cafeWalk(a,[{x:G.serve.x+3,feet:G.serve.feet+30,k:1.04,lane:"f"},{x:G.exit.x,feet:G.exit.feet,k:G.exit.k,lane:"f"}],()=>cafeRemovePerson(a),{fast:true});
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
  if(b){if(!b.svg)return;petStop(b);b.move=null;cafePetFace(b,mood);clearTimeout(b._moodT);b._moodT=setTimeout(()=>{if(!b.busy)petPlay(b,"idle",true);},duration);return;}
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
    playerPetEmote(el,correct?"😊":"💭");return;}
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
