/* WordBar DEMO build only — never shipped in production.
   Gives every profile a very large coin balance (spendable and lifetime)
   so the shop, themes and unlocks can be tested. Everything the lifetime
   coins unlock is marked as already met, so no long run of "new customer"
   ceremonies plays. Added by tools/package.py --demo; the production
   index.html has no reference to this file. */
(function(){
  "use strict";
  var DEMO_COINS=1000000;
  function topUp(){
    try{
      var p=typeof P==="function"&&P();if(!p)return;
      var changed=false;
      if((p.tips||0)<DEMO_COINS){p.tips=DEMO_COINS;changed=true;}
      if((p.lifetime||0)<DEMO_COINS){p.lifetime=DEMO_COINS;changed=true;}
      if(typeof unlockSequence==="function"){var n=unlockSequence().length;if((p._unlocksSeen||0)<n){p._unlocksSeen=n;changed=true;}}
      if(changed&&typeof persist==="function")persist();
    }catch(e){}
  }
  if(typeof screenMenu==="function"){var menu=screenMenu;screenMenu=function(){topUp();return menu.apply(this,arguments);};}
  if(typeof screenShop==="function"){var shop=screenShop;screenShop=function(){topUp();return shop.apply(this,arguments);};}
  window.WORDBAR_DEMO=true;
})();
