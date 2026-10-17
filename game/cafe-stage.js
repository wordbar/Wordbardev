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
  let s=`<rect width="${CAFE_W}" height="${G.wallBottom}" fill="${wallFill}"/>
  <rect y="${G.wallBottom}" width="${CAFE_W}" height="${CAFE_H-G.wallBottom}" fill="${floorFill}"/>
  <g class="floor-lines" stroke="${ink}" stroke-width=".8" opacity=".09"><path d="M0 168 H360 M0 190 H360 M0 216 H360 M0 246 H360"/><path d="M90 150 L60 274 M180 150 V274 M270 150 L300 274"/></g>
  <rect y="${G.wallBottom-5}" width="${CAFE_W}" height="7" fill="${woodD}" stroke="${ink}" stroke-width="1.4"/>
  <rect width="${CAFE_W}" height="9" fill="${wood}" stroke="${ink}" stroke-width="1.6"/>
  <path d="M0 9 H360" stroke="${woodD}" stroke-width="2"/>
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
    light:svg("cafe-light",`<defs>${nightGlow}</defs><rect class="cafe-night-wash" width="${CAFE_W}" height="${CAFE_H}" fill="${L.nightWash}" style="--night-opacity:${L.nightOpacity}"/>
      <g class="cafe-night-lights"><ellipse cx="60" cy="40" rx="62" ry="44" fill="url(#ng${uid})"/><ellipse cx="262" cy="120" rx="70" ry="40" fill="url(#ng${uid})" opacity=".7"/><ellipse cx="168" cy="60" rx="40" ry="34" fill="url(#ng${uid})" opacity=".6"/></g>`,`pointer-events="none" style="--night-opacity:${L.nightOpacity}"`)
  };
}
/* A whole café in one box (menu, shop and theme previews). Optional
   barista/pet HTML is placed at its real spot between the layers. */
function cafeSceneHTML(context="preview",{barista="",pet="",themeOverride=null,extraClass=""}={}){
  const Ls=cafeSceneLayers(context,themeOverride),G=CAFE_GEO;
  const pctX=x=>(x/CAFE_W*100).toFixed(3)+"%",pctB=y=>((CAFE_H-y)/CAFE_H*100).toFixed(3)+"%";
  const bw=(G.barista.k*CAFE_BOX*CHAR_ASPECT/CAFE_W*100).toFixed(3)+"%";
  return `<div class="scenebox ${extraClass}">${Ls.back}
    ${barista?`<div class="scene-barista" style="left:${pctX(G.barista.x)};bottom:${pctB(G.barista.feet)};width:${bw}">${barista}</div>`:""}
    ${Ls.front}
    ${pet?`<div class="scene-pet" style="left:${pctX(G.bed.x)};bottom:${pctB(G.bed.y-2)}">${pet}</div>`:""}
    ${Ls.light}</div>`;
}
/* Back-compatibility: callers that only want a single picture. */
function cafeScene(small,context="stage"){
  const Ls=cafeSceneLayers(context);
  return Ls.back.replace("</svg>","")+Ls.front.replace(/^<svg[^>]*>/,"").replace("</svg>","")+Ls.light.replace(/^<svg[^>]*>/,"");
}

/* character box: full-body art is 320×500; CAFE_BOX is its height in
   design units at k = 1 (someone standing in the open area) */
const CAFE_BOX=140, CHAR_ASPECT=320/500;
