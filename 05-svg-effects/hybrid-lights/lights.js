(function(root){
  'use strict';
  let uid=0;
  const NS='http://www.w3.org/2000/svg';
  const finite=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  /** Standalone SVG markup; no timers, external libraries or document-wide IDs.
   * Sprite = {uri, width, height, bounds:[left,top,right,bottom]}.
   * Bounds describe non-transparent art; original PNG bytes remain unchanged.
   */
  function render(options={}){
    const kind=options.kind==='lantern'?'lantern':'fairy';
    const width=clamp(finite(options.width,640),240,1400);
    const count=clamp(Math.round(finite(options.count,kind==='lantern'?5:10)),2,18);
    const sag=clamp(finite(options.sag,36),0,80);
    const night=options.night!==false;
    const animate=options.animate!==false;
    const power=clamp(finite(options.glow,1),0,1.5);
    const sprite=options.sprite;
    if(!sprite || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sprite.uri))throw Error('A PNG data-URI sprite is required');
    const id='wb-light-'+(++uid);
    const nominal=kind==='lantern'?72:31;
    const size=Math.min(nominal,(width-120)/(count-1)*.65);
    const [l,t,r,b]=sprite.bounds;
    const sw=r-l,sh=b-t;
    if(!(sw>0&&sh>0&&sprite.width>0&&sprite.height>0))throw Error('Invalid sprite bounds');
    const artH=size*sh/sw;
    const margin=Math.max(46,size*1.2+8);
    const top=Math.max(30,artH*.4+14);
    const height=top+sag+12+artH*1.5+10;
    const yAt=t=>top+4*sag*t*(1-t);
    const glowOpacity=(night?.8:.16)*power;
    let parts='';
    for(let i=0;i<count;i++){
      const f=i/(count-1),x=margin+f*(width-2*margin),y=yAt(f),hang=kind==='lantern'?9:2;
      const cy=y+hang+artH*.53;
      const dur=kind==='lantern'?7.7+i*.31:3.8+i*.37;
      const lo=kind==='lantern'?.87:.62;
      const motion=animate?`style="animation:${id}-pulse ${dur}s ease-in-out ${-i*1.23}s infinite"`:'';
      parts+=`<g><path d="M${x} ${y}v${hang}" stroke="#49323d" stroke-width="2.3" fill="none" stroke-linecap="round"/>
        <g class="wb-glow" ${motion}>
          <ellipse cx="${x}" cy="${cy}" rx="${size*1.16}" ry="${artH*.9}" fill="url(#${id}-halo)" opacity="${glowOpacity}"/>
        </g>
        <svg x="${x-size/2}" y="${y+hang}" width="${size}" height="${artH}" viewBox="${l} ${t} ${sw} ${sh}" overflow="hidden"><image href="${esc(sprite.uri)}" width="${sprite.width}" height="${sprite.height}"/></svg>
        <ellipse class="wb-glow" ${motion} cx="${x}" cy="${cy}" rx="${size*.27}" ry="${artH*.29}" fill="url(#${id}-core)" opacity="${(night?.23:.05)*power}"/>
      </g>`;
    }
    return `<svg xmlns="${NS}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${kind==='lantern'?'Paper lantern string':'Fairy light string'}" style="display:block;max-width:100%;height:auto">
      <defs>
        <radialGradient id="${id}-halo"><stop stop-color="#ffce70" stop-opacity=".58"/><stop offset=".42" stop-color="#ffbc62" stop-opacity=".18"/><stop offset="1" stop-color="#ffc36c" stop-opacity="0"/></radialGradient>
        <radialGradient id="${id}-core"><stop stop-color="#fff8d0"/><stop offset="1" stop-color="#fff8d0" stop-opacity="0"/></radialGradient>
      </defs>
      <style>@keyframes ${id}-pulse{0%,100%{opacity:1}50%{opacity:${kind==='lantern'?.87:.62}}}@media(prefers-reduced-motion:reduce){.wb-glow{animation:none!important}}</style>
      <path d="M${margin} ${top} Q${width/2} ${top+2*sag} ${width-margin} ${top}" fill="none" stroke="#49323d" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${margin}" cy="${top}" r="4" fill="#bd8854" stroke="#49323d" stroke-width="2"/>
      <circle cx="${width-margin}" cy="${top}" r="4" fill="#bd8854" stroke="#49323d" stroke-width="2"/>
      ${parts}
    </svg>`;
  }
  root.WordBarLights={render};
  if(typeof module!=='undefined')module.exports=root.WordBarLights;
})(typeof window!=='undefined'?window:globalThis);
