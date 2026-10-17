/* ============================================================
   WordBar service worker — app-shell offline support.

   Phase 6 deliberately gives the shell and verified course data separate
   lifecycles. data-loader.js verifies manifests, hashes, decoded schema,
   tiers and counts before writing versioned course caches. This worker must
   preserve those caches across shell activation and must never place an
   unverified word bank into the shell cache.
   ============================================================ */
const SHELL_CACHE_VERSION = "wordbar-shell-v86l-phase13-petpop12-faq4-analytics8-batchS13h";
const COURSE_DATA_CACHE_PREFIX = "wordbar-course-data-";
const COURSE_DATA_META_CACHE = "wordbar-course-data-meta-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./data-loader.js",
  "./course-catalogs.js",
  "./persistence.js?v=petpop11",
  "./ladder-dict.js",
  "./phonics.js?v=batchS8b",
  "./spelling-v16-phonics-adapter.js?v=batchS8b",
  "./04-world.js?v=batchS13h",
  "./05-engine.js?v=batchS12d",
  "./pet-pop-word-adapter.js?v=petpop11",
  "./pet-pop-scheduler.js?v=petpop11",
  "./spelling-protected.js?v=batchS8b",
  "./spelling-chunks.js?v=batchS8b",
  "./spelling-segments.js?v=batchS8b",
  "./spelling-v16-browser.mjs?v=batchS8b",
  "./wordbar-pronunciation-v16.mjs?v=batchS8b",
  "./wordbar-sound-spelling-alignment-v16.mjs?v=batchS8b",
  "./wordbar-segmentation-scoring-v16.mjs?v=batchS8b",
  "./wordbar-display-policy-v16.mjs?v=batchS8b",
  "./wordbar-structural-evidence-v16.mjs?v=batchS8b",
  "./wordbar-pattern-segmentation-v16.mjs?v=batchS8b",
  "./wordbar-segmenter-v16.mjs?v=batchS8b",
  "./pet-pop.js?v=batchS12d",
  "./pet-pop.css?v=batchS12d",
  "./analytics.js?v=analytics8-batchS12d",
  "./cafe-stage.js?v=batchS13h",
  "./06-ui.js?v=batchS13h",
  "./open-app-hint.js?v=batchS11a",
  "./i18n/zh-hk.js?v=batchS13h",
  "./i18n/zh-cn.js?v=batchS13h",
  "./i18n.js?v=batchS12d",
  "./open-app-hint.css?v=batchS10e",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
  "./icon-167.png",
  "./icon-152.png",
  "./icon-120.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./audio/cosy-corner.mp3?v=85",
  "./audio/kyoto-garden.mp3?v=85",
  "./audio/happy-hours.mp3?v=85",
  "./audio/my-sunrise.mp3?v=85"
];

/* Build 83 artwork is split into small SVG files so every Kitchen step can
   stay crisp at phone size without bloating the main JavaScript. Cache each
   file independently: one optional art miss must never block app install. */
const FOOD_ART="applepie bakedsalmon burger chickenkatsu chickenwings chips chocolatebrownie chocolateeclair churros cinnamonroll cookie cornoncob croissant curryfishballs curryrice doughnut dumplings eggfriedrice eggsbenedict eggsoldiers eggwaffle fishchips hotdog jacketpotato lasagne maccheese muffin omelette padthai paella pancakes pasta pizza prawntempura pretzel quichelorraine ramen roastchicken sandwich shepherdspie siumai springrolls stuffedpepper sushi threetreasures tomatosoup vegetableskewers waffles".split(" ").map(id=>`./assets/food/${id}.svg`);
const KITCHEN_STEP_ART="benedict-ham benedict-poach benedict-sauce benedict-serve benedict-stack benedict-toast benedict-whisk brownie-bake brownie-fold brownie-melt brownie-oven brownie-serve brownie-sift brownie-whisk burger-cook burger-flip burger-heat burger-serve burger-shape burger-stack burger-toast chips-cook chips-cut chips-dry chips-rinse chips-season chips-serve chips-wash churros-fill churros-fry churros-heat churros-mix churros-pipe churros-serve churros-sugar coffee-brew coffee-finish coffee-grind coffee-measure coffee-serve coffee-steam coffee-tamp cookie-bake cookie-chocolate cookie-cream cookie-egg cookie-flour cookie-portion cookie-serve corn-bake corn-butter corn-foil corn-oven corn-serve corn-shuck corn-spread croissant-bake croissant-butter croissant-chill croissant-fold croissant-mix croissant-prove croissant-shape curry-chop curry-onions curry-rice curry-sauce curry-serve curry-simmer curry-spices donut-cut donut-fry donut-glaze donut-mix donut-proof donut-rise donut-roll dumpling-dough dumpling-fill dumpling-filling dumpling-rest dumpling-seal dumpling-steam dumpling-wrappers eclair-bake eclair-boil eclair-eggs eclair-fill eclair-flour eclair-glaze eclair-pipe eggwaffle-cook eggwaffle-dry eggwaffle-heat eggwaffle-mix eggwaffle-pour eggwaffle-rest eggwaffle-wet fishball-add fishball-aromatics fishball-boil fishball-prep fishball-sauce fishball-simmer fishball-skewer fishchips-batter fishchips-coat fishchips-crisp fishchips-first-fry fishchips-fry-fish fishchips-prepare fishchips-serve fizz-cool fizz-flavour fizz-ice fizz-serve fizz-soda fizz-squeeze fizz-syrup hotdog-assemble hotdog-cook hotdog-fry-onions hotdog-serve hotdog-slice hotdog-turn hotdog-warm icecream-chill icecream-churn icecream-freeze icecream-mix icecream-scoop icecream-serve icecream-top juice-chill juice-cut juice-pour juice-serve juice-squeeze juice-strain juice-wash katsu-cook katsu-egg katsu-flatten katsu-flour katsu-oil katsu-panko katsu-serve lasagne-bake lasagne-bechamel lasagne-beef lasagne-layer lasagne-ragu lasagne-serve lasagne-veg mac-bake mac-base mac-boil mac-cheese mac-drain mac-milk mac-mix muffin-bake muffin-cases muffin-combine muffin-dry muffin-filling muffin-serve muffin-wet omelette-cook omelette-crack omelette-fill omelette-fold omelette-heat omelette-pour omelette-whisk pad-aromatics pad-egg pad-noodles pad-prawns pad-sauce pad-serve pad-soak paella-rice paella-seafood paella-serve paella-simmer paella-stock paella-tomato paella-veg pancakes-combine pancakes-dry pancakes-flip pancakes-heat pancakes-pour pancakes-serve pancakes-wet pasta-boil pasta-chop pasta-cook-veg pasta-drain pasta-serve pasta-simmer pasta-tomatoes pepper-deseed pepper-fill pepper-mix pepper-oil pepper-oven pepper-prebake pepper-serve pie-apples pie-bake pie-fill pie-lattice pie-line pie-pastry pie-season pizza-bake pizza-knead pizza-mix pizza-prove pizza-serve pizza-shape pizza-top potato-bake potato-fill potato-heat potato-prick potato-rub potato-serve potato-wash pretzel-bake pretzel-dip pretzel-knead pretzel-mix pretzel-rise pretzel-salt pretzel-shape quiche-bacon quiche-bake quiche-blind quiche-chill quiche-custard quiche-fill quiche-pastry ramen-assemble ramen-broth ramen-egg ramen-noodles ramen-serve ramen-simmer ramen-toppings rice-add rice-cook rice-egg rice-prep rice-serve rice-veg rice-wok roast-cook roast-heat roast-rest roast-season roast-serve roast-tray roast-veg roll-bake roll-cut roll-fill roll-filling roll-fold roll-ice roll-log roll-mix roll-noodles roll-place roll-rise roll-seal roll-serve roll-veg salmon-bake salmon-dish salmon-dry salmon-oil salmon-oven salmon-season salmon-serve sandwich-close sandwich-fill sandwich-lettuce sandwich-serve sandwich-slice sandwich-spread sandwich-wash shepherd-assemble shepherd-bake shepherd-lamb shepherd-mash shepherd-potatoes shepherd-stock shepherd-veg siumai-mix siumai-prepare siumai-season siumai-steam siumai-top siumai-wrap siumai-wrappers skewer-brush skewer-chop skewer-glaze skewer-serve skewer-soak skewer-thread skewer-wash smoothie-blend smoothie-chop smoothie-ice smoothie-milk smoothie-serve smoothie-wash smoothie-yoghurt soldiers-boil soldiers-butter soldiers-cut soldiers-lower soldiers-serve soldiers-toast soldiers-water soup-blend soup-chop soup-serve soup-simmer soup-soften soup-stock soup-tomatoes sushi-cook sushi-cool sushi-fillings sushi-rinse sushi-roll sushi-season sushi-serve tea-add tea-finish tea-heat tea-pour tea-serve tea-steep tea-warm tempura-batter tempura-dip tempura-flour tempura-fry tempura-oil tempura-prep tempura-serve treasures-cut treasures-dust treasures-fry treasures-paste treasures-serve treasures-stuff treasures-turn waffles-combine waffles-cook waffles-dry waffles-grease waffles-heat waffles-serve waffles-wet wings-coat wings-cook wings-dry wings-mix wings-season wings-serve wings-turn".split(" ").map(id=>`./assets/kitchen-steps/${id}.svg`);
/* Batch S13: café artwork (character pack, pet pack, shop decoration).
   Optional like the food art: a miss never blocks install, and the café
   falls back to the previous drawing for anything not yet cached. */
const CAFE_CHAR_ART="adeyemi agnes alien amara arjun astronaut baller baxter beekeeper benji callum captain cartographer clive clockwinder contessa dave delacroix desmond detective devereux elowen explorer finn firefighter fox freya gardener gondolier gustav hana hero iris jiangshi king knight kofi leo librarian linebacker marchetti marcus marigold maya mei mummy ninja nora okafor okonkwo osei owl petra pharaoh pirate priyanka queen robot ruth scientist solomon steinberg striker tam tomek vampire viking wendy whitfield witch wizard yuki".split(" ").map(id=>`./art/chars/${id}.svg`);
const CAFE_PET_ART="aardvark badger bat capybara cat chicken corgi dachshund dodo dog duck ferret frog gorilla greatauk hippo hollandlop jumpingrat kinkajou koala lemur lion llama loris meerkat mongoose monkey ocelot otter owl2 panda parrot penguin pig pigeon pinemarten prairiedog pug pugclassic rabbit raccoon raccoondog redpanda sandcat seacow sloth snowleopard squirrel tiger warthog wombat zebra".split(" ").map(id=>`./art/pets/${id}.svg`);
const CAFE_DECOR_ART="aurora.svg bunting_rainbow.webp cakedome.webp clock_station.webp counter_marble.webp fairy-ornament.webp fairylights.webp floor_cocoa.webp floor_honey.webp floor_slate.webp flowerbox.webp fountain_gold.webp gumball.webp jukebox.webp lamp_brass.webp lamp_rose.webp lantern-ornament.webp lantern_paper.webp menu_chalk.webp mug_rack.webp mural_market.webp petbasket.webp petbed_cloud.webp plant_monstera.webp portrait_fox.webp poster_abc.webp poster_fruit.webp print_seaside.webp radio_retro.webp rug_ocean.webp rug_rose.webp rug_stripe.webp shelf_books.webp shelf_kegs.webp shelf_trophies.webp stars_paper.webp stool_cherry.webp stool_oak.webp stool_simple.webp stool_velvet.webp tiles_terra.webp wall_blush.webp wall_meadow.webp wall_sky.webp wall_sunny.webp window_awning.webp window_stained.webp".split(" ").map(f=>`./art/decor/${f}`);
const ART_ASSETS=[...FOOD_ART,...KITCHEN_STEP_ART,...CAFE_CHAR_ART,...CAFE_PET_ART,...CAFE_DECOR_ART,"./art/custom/parts.json"];

/* S11b (review WB-B03): an update only takes over once its whole required
   shell is cached. If any CORE_ASSETS file fails (network blip, full storage),
   the partial new cache is removed and the install fails, so the previous
   worker and its complete offline shell stay in charge; the browser simply
   tries the update again later. Artwork stays optional. The page itself
   never depends on this: online play works even when no worker installs. */
const SHELL_CACHE_PREFIX = "wordbar-shell-";
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE_VERSION);
    try {
      await cache.addAll(CORE_ASSETS);
    } catch (error) {
      await caches.delete(SHELL_CACHE_VERSION).catch(() => {});
      throw error;
    }
    await Promise.allSettled(ART_ASSETS.map((path) => cache.add(path)));
    await self.skipWaiting();
  })());
});

/* Remove only older WordBar shell caches, and only when this version's
   required shell is really present. Verified course caches, their metadata
   and any other cache on this origin are never touched. */
async function currentShellComplete(){
  const cache = await caches.open(SHELL_CACHE_VERSION);
  const found = await Promise.all(CORE_ASSETS.map((path) => cache.match(path)));
  return found.every(Boolean);
}
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (await currentShellComplete().catch(() => false)) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) =>
        name.startsWith(SHELL_CACHE_PREFIX) && name !== SHELL_CACHE_VERSION
      ).map((name) => caches.delete(name)));
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const req=event.request;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return; // fonts/CDNs use their normal browser cache

  /* Course manifests and masked packs are owned by data-loader.js. Network
     first lets it discover an immutable new version; CacheStorage fallback
     lets it re-verify the selected course offline. Never copy these bytes
     into the shell cache. */
  const isCourseData=/\/data\/(?:everyday\/v[^/]+\/)?(?:manifest\.json|wordbank-(?:easy|core|stretch)(?:\.raw)?\.wbdata)$/.test(url.pathname);
  if(isCourseData){
    /* Do not use global caches.match here: it could select the wrong retained
       version. A failed network request returns control to the loader, which
       resolves the active course/version from verified cache metadata. */
    event.respondWith(fetch(req));
    return;
  }

  /* Navigation is network-first so a Cloudflare deploy is visible as
     soon as it is online, with the cached shell as the offline fallback.
     Build 86g-phase9: a stalled navigation fetch never rejects, so without a
     bound the .catch() fallback below could never fire and the user would sit
     on a blank screen. Race it against a timer and fall back to the cached
     shell if the network has not answered in time. */
  if(req.mode==="navigate"){
    const NAV_TIMEOUT_MS=6000;
    const cachedShell=()=>caches.match("./index.html").then(r=>r||caches.match("./"));
    const network=fetch(req).then(res=>{
      if(res&&res.ok) caches.open(SHELL_CACHE_VERSION).then(c=>c.put("./index.html",res.clone())).catch(()=>{});
      return res;
    });
    const timeout=new Promise(resolve=>setTimeout(()=>resolve(null),NAV_TIMEOUT_MS));
    event.respondWith(
      Promise.race([network.catch(()=>null),timeout])
        .then(res=>res||cachedShell().then(cached=>cached||network))
    );
    return;
  }

  /* Versioned cache-first assets keep repeat play fast/offline. The
     cache name changes on every release, so old files cannot clash. */
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(res&&res.ok) caches.open(SHELL_CACHE_VERSION).then(c=>c.put(req,res.clone())).catch(()=>{});
    return res;
  })));
});
