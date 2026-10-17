/* ============================================================
   WORLD DATA — customers, shop, themes, pets, curator lines.
   Personality-driven movement: each customer carries a
   `personality` tag (bouncy | shy | cool | brisk | formal |
   mysterious) that the stage animation reads to vary walk-in
   easing, idle fidget, and emote frequency — so the café feels
   populated by characters, not repeated sprites, reusing the
   one parametric animation system rather than hand-animating
   every individual customer.
   ============================================================ */

/* ============ Avatar customizer (2026) ============
   Basic, conflict-free building blocks. Every category is single-
   select (one skin, one hairstyle, one garment...), which is what
   structurally prevents nonsense combinations — nothing can stack.
   Hairstyles list ONLY the natural styles; costume headwear (crown,
   wizard hat, viking helm...) stays reserved for story characters. */
const CUSTOMIZER={
  /* S9e: more choices. Order matters only for display; saved values are
     the colour codes / ids, so older saves keep working. */
  skins:["#F6DDCC","#F2D3B3","#F0C9A0","#E8B88A","#D9A574","#C68A55","#B5793F","#8D5A3B","#744A30","#5C3A24"],
  hairs:[["#171310","Black"],["#2B1B12","Dark brown"],["#6B3A22","Chestnut"],["#8A6B3A","Brown"],["#A67B52","Light brown"],["#B5502A","Auburn"],["#C4622D","Copper"],["#D9955A","Strawberry blonde"],["#C9A227","Blonde"],["#E6DCC2","Platinum"],["#7A7A7A","Grey"],["#C9CCD1","Silver"]],
  hairstyles:["crop","flop","side","bob","curls","bun","plait","puffs","frizz","buzz","shortquiff","bald","ponytail","longwave","twinbraids",
    "afro","pixie","spacebuns","sidebraid","topknot","cornrows","locs","longstraight","curtains","spiky","waves","fauxhawk","hijab"],
  hijabColors:[["#2F3E66","Navy"],["#2A2530","Black"],["#8E2F4E","Berry"],["#2E7A78","Teal"],["#6FA3D2","Sky"],["#9A86C4","Lilac"],["#C9A96A","Sand"],["#D98FA3","Rose"]],
  facialHair:[["none","None"],["mustache","Moustache"],["beard_short","Short beard"],["beard_short_mustache","Short beard + moustache"],["beard_long","Long beard"],["beard_long_mustache","Long beard + moustache"]],
  /* S10d: 16 clothing colours (the first 5 are the originals, so saved looks keep their colour) */
  tops:[["#3E7CA6","Ocean"],["#B23A5F","Berry"],["#4E7A4A","Forest"],["#3E3A4A","Charcoal"],["#C9A96A","Sand"],
    ["#2F4B7C","Navy"],["#7FB3DE","Sky"],["#2E8A86","Teal"],["#8CCBA8","Mint"],["#E8C547","Sunshine"],
    ["#E8843A","Orange"],["#C9443A","Tomato"],["#EE9AB8","Bubblegum"],["#9A86C4","Lilac"],["#6A4C9C","Grape"],["#F3EEE3","Cream"]],
  garments:["tee","polo","shirt"],
  eyeShapes:[["round","Round"],["tall","Tall"],["almond","Almond"],["sleepy","Sleepy"],["wide","Wide sparkle"],["upturned","Upturned"]],
  eyeColors:[
    ["#4E6E8E","Blue"],
    ["#5E7892","Grey-blue"],
    ["#6E4A2E","Brown"],
    ["#3F2B20","Dark brown"],
    ["#A0672A","Amber"],
    ["#8E6B2E","Honey"],
    ["#7A6A3A","Hazel"],
    ["#4E7A55","Green"],
    ["#70777C","Grey"],
    ["#6A5A8E","Violet"]
  ],
  lashStyles:[["classic","Lashes"],["short","Short"],["long","Long"],["flick","Flicked"],["none","No lashes"]],
  brows:[["natural","Natural"],["thin","Thin"],["thick","Thick"],["arched","Arched"],["straight","Straight"]],
  cheeks:[["plain","Plain"],["rosy","Rosy"],["freckles","Freckles"]],
  accessories:[["none","No glasses"],["glasses","Round"],["glasses_square","Square"],["glasses_oval","Oval"],["glasses_cateye","Cat-eye"],["glasses_halfrim","Half-rim"],["glasses_biground","Big round"],["glasses_rect","Rectangle"]],
  glassesColors:[["#2E2440","Black"],["#7A4A2A","Tortoiseshell"],["#C0392B","Red"],["#3E6FB0","Blue"],["#D8547A","Pink"],["#C9A227","Gold"]],
};

const AVATARS = [
{id:"amara",name:"Amara",blurb:"Rollerblader & future vlogger",look:{skin:"#8D5A3B",hair:"#2B1B12",hairstyle:"puffs",top:"#D8547A",garment:{style:"tee"}}},
/* retired:true = kept for existing saves that picked her, but no longer
   offered to new baristas (her grid slot went to the Customizer). */
{id:"priya",name:"Priya",blurb:"Violinist & quiz-show superfan",retired:true,look:{skin:"#B5793F",hair:"#1E1410",hairstyle:"plait",top:"#7FA65A",garment:{style:"polo"}}},
{id:"leo",name:"Leo",blurb:"Skateboarder & comic collector",look:{skin:"#E8B88A",hair:"#14100D",hairstyle:"flop",top:"#5B8FB5",noLash:true,garment:{style:"tee"}}},

{id:"finn",name:"Finn",blurb:"Tin-whistler & dinosaur expert",look:{skin:"#F0C9A0",hair:"#B5502A",hairstyle:"curls",top:"#C25B2E",garment:{style:"shirt"}}},
{id:"tomek",name:"Tomek",blurb:"Lego architect & chess captain",look:{skin:"#EDC498",hair:"#8A6B3A",hairstyle:"crop",top:"#5C8140",garment:{style:"polo"}}},
{id:"hana",name:"Hana",blurb:"Origami wizard & shrine-festival fan",look:{skin:"#F2D3B3",hair:"#171310",hairstyle:"plait",top:"#D8547A",garment:{style:"shirt"}}},
{id:"mei",name:"Mei",blurb:"Table-tennis champ & panda superfan",look:{skin:"#F2D3B3",hair:"#20140C",hairstyle:"bun",top:"#C0392B",garment:{style:"tee"}}},
{id:"marcus",name:"Marcus",blurb:"Drummer & rocket-model builder",look:{skin:"#5C3A24",hair:"#171310",hairstyle:"crop",top:"#E8891D",noLash:true,garment:{style:"polo"}}},
{id:"arjun",name:"Arjun",blurb:"Cricket all-rounder & puzzle master",look:{skin:"#A96A3C",hair:"#171310",hairstyle:"side",top:"#3E5C8E",garment:{style:"shirt"}}},

];

const CUSTOMERS = [
/* ---- special guests: themed characters with their own outfits ---- */
{id:"vampire",name:"Count Lexis",tier:"secret",blurb:"A very polite vampire who only drinks juice",personality:"mysterious",
 look:{skin:"#EDE3E8",hair:"#191418",hairstyle:"widowspeak",top:"#2E2A36",accessory:"fangs"},
 usual:"Very Berry Red Juice",
 lines:{arrive:["Good eeevening. One berry juice — red as a sunset I shall never see.","I have risen from my nap for one thing only: wordss.","Do not be alarmed. I bite only into difficult vocabulary."],
 correct:["Fangs-tastic!","Ah! You have a sharp mind. I respect sharp things.","Vord perfect, as ve say in the old country.","I vould applaud, but my cape is in the way."],
 wrong:["A misss! But even I took centuries to learn spelling.","Do not despair. The night is young. I am not.","Hmm. That answer had no bite."],
 departGood:["Delicious! I shall haunt this bar forever. Politely.","You have earned my eternal — vell, lengthy — gratitude."],
 departOk:["Adequate. I have vaited 400 years; I can vait for better."]}},
{id:"witch",name:"Hazel the Witch",tier:"secret",blurb:"Brews potions; judges beverages professionally",personality:"mysterious",
 look:{skin:"#C68A5E",hair:"#5C3E2A",hairstyle:"witchhat",top:"#5C3E7A",accessory:"potion"},
 usual:"Bubbling Cauldron Tea",
 lines:{arrive:["Double, double, no toil, no trouble — just tea, dearie, and a good word puzzle.","My cauldron's on a break. Impress me instead.","I smell... vocabulary. Delicious."],
 correct:["Ooh, that answer sparkled like a fresh potion!","Correct! Are you SURE you're not magic?","My newt approves. High praise indeed.","Spell-binding. Literally."],
 wrong:["Croak! Wrong ingredient, dearie.","No matter — my first potion exploded twice.","The frogs got that one wrong too."],
 departGood:["A perfect brew! I couldn't have cauldroned it better myself.","I shall tell the whole coven about this place."],
 departOk:["Hmm. Three stars out of five newts. Keep stirring, dearie."]}},
{id:"robot",name:"R0-B3RT",tier:"vip",blurb:"A polite robot learning human words",personality:"cool",
 look:{skin:"#AEB6C2",hair:"#5C6B73",hairstyle:"antenna",top:"#5C6B73",accessory:"bolts"},
 usual:"Motor-Oil Berry Smoothie",
 lines:{arrive:["GREETINGS. ONE SMOOTHIE. BEEP. PLEASE.","SCANNING MENU... SCANNING... A WORD PUZZLE? EXCELLENT INPUT.","HELLO HUMAN. MY DICTIONARY REQUIRES UPDATING."],
 correct:["CORRECT. UPLOADING TO MEMORY BANKS. BEEP BOOP.","PROCESSING... RESULT: IMPRESSIVE.","YOU COMPUTE WELL, HUMAN.","ANSWER ACCEPTED. HAPPINESS LEVELS RISING."],
 wrong:["ERROR 404: ANSWER NOT FOUND. RETRYING IS ADVISED.","DOES NOT COMPUTE. BUT HUMANS LEARN FROM ERRORS. FASCINATING.","INCORRECT. INITIATING ENCOURAGEMENT PROTOCOL: YOU'VE GOT THIS."],
 departGood:["DRINK RATED 10/10. RECHARGING COMPLETE.","THIS ESTABLISHMENT IS NOW IN MY FAVOURITES FOLDER."],
 departOk:["DRINK ACCEPTABLE. SOFTWARE UPDATE RECOMMENDED. GOODBYE."]}},
{id:"scientist",name:"Dr. Nova",tier:"vip",blurb:"Fizzy-drinks researcher; everything is an experiment",personality:"brisk",
 look:{skin:"#8A5A3A",hair:"#EDE6E0",hairstyle:"frizz",top:"#F4F0E8",accessory:"flask"},
 usual:"Fizzing Formula No. 7",
 lines:{arrive:["Hypothesis: this bar serves the best drinks in town. Let's test it!","Quick — a Formula No. 7! The lab can wait; science cannot.","Fascinating aromas. I must take notes."],
 correct:["Eureka! The data supports you completely.","Correct! Peer-reviewed and approved.","Excellent result — reproducible, I hope?","My flask nearly bubbled over with excitement."],
 wrong:["Interesting! A negative result is still a result.","Back to the lab bench with that one.","Hmm — anomalous data. Let's re-run the experiment."],
 departGood:["Conclusion: outstanding. Publishing my findings immediately!","The experiment was a complete success!"],
 departOk:["Results inconclusive. Further visits required. For science."]}},
{id:"astronaut",name:"Major Stella",tier:"secret",blurb:"Just back from orbit; misses proper drinks",personality:"cool",
 look:{skin:"#6E4A2E",hair:"#26211E",hairstyle:"spacehelmet",top:"#EDE6E0",accessory:"flagpatch"},
 usual:"Freeze-Dried Star Smoothie",
 lines:{arrive:["Mission control, I've located refreshments. Requesting one smoothie.","You would not BELIEVE how bad space juice is. Help me out.","Touchdown! Six months of squeezy-tube food ends today."],
 correct:["That answer was out of this world!","Confirmed! T-minus zero doubts.","Houston, we have a genius.","Stellar work. And I know stellar."],
 wrong:["A little off-course — happens to every pilot.","Negative, but re-entry is always bumpy.","Missed the landing zone. Next orbit's yours."],
 departGood:["Best drink in the solar system. I checked most of it.","One small sip for me, one giant leap for this café!"],
 departOk:["Decent. Better than Tang, anyway. Back to the stars!"]}},
{id:"pirate",name:"Captain Marlow",tier:"vip",blurb:"Retired pirate; now hunts word treasure",personality:"cool",
 look:{skin:"#C68A5E",hair:"#3A2E22",hairstyle:"piratehat",top:"#7A3B3B",accessory:"eyepatch"},
 usual:"Sea-Salt Lime Fizz",
 lines:{arrive:["Ahoy! One lime fizz, and make it seaworthy.","I've sailed seven seas seekin' treasure. Turns out it be words.","Batten the hatches — the Captain be thirsty!"],
 correct:["YO HO HO! X marks the spot, and ye found it!","Shiver me timbers, that be right!","A treasure of an answer, matey!","Ye'd make a fine first mate o' words."],
 wrong:["Arr, that answer walked the plank.","Wrong heading, matey — adjust yer compass and sail on.","Even the best sailors hit a reef now and then."],
 departGood:["A drink worth more than doubloons! Arr!","I be markin' this bar on me treasure map."],
 departOk:["Passable grog. The search fer perfection continues. ARR."]}},
{id:"wizard",name:"Merlow the Wise",tier:"secret",blurb:"Ancient wizard, terrible with modern menus",personality:"formal",
 look:{skin:"#EFC7A2",hair:"#EDE6E0",hairstyle:"wizardhat",top:"#3E5C8E",accessory:"wand"},
 usual:"Elderflower Elixir",
 lines:{arrive:["Greetings, young word-keeper. An elixir, if you please.","I have studied a thousand scrolls. Show me what YOU know.","Ah, this establishment radiates... competence. Promising."],
 correct:["Marvellous! The old magic of language, alive and well.","Correct, as the ancient scrolls foretold.","You wield words like a wand. Splendid.","Even my owl would be impressed, and he's very hard to please."],
 wrong:["Alas! But wisdom grows from stumbles, young one.","A thousand years ago, I made that very mistake.","The scroll of knowledge has many pages left for you."],
 departGood:["An elixir worthy of the archives! Magnificent.","I shall enchant this cup so it never forgets this drink."],
 departOk:["Acceptable, young keeper. Practice, and greatness follows."]}},
{id:"knight",name:"Sir Reginald",tier:"vip",blurb:"Chivalrous knight on a noble snack quest",personality:"formal",
 look:{skin:"#EFC7A2",hair:"#C2622F",hairstyle:"knighthelm",top:"#AEB6C2",accessory:"shield"},
 usual:"Honour's Honey Tea",
 lines:{arrive:["Hail, good barkeep! Honey tea, for a knight's quest is thirsty work.","I have battled dragons. Word puzzles frighten me more.","By my shield — what a fine establishment!"],
 correct:["HUZZAH! A most noble answer!","Victory! I dub thee Word Knight.","Thou hast the wisdom of the Round Table!","A triumph worthy of a feast!"],
 wrong:["A glancing blow! Raise thy shield and try anew.","Even the bravest knight is unhorsed sometimes.","Fear not — quests are won by those who continue."],
 departGood:["A drink most worthy! I shall sing of it in the great hall.","Thou art the true hero of this tale!"],
 departOk:["A fair effort, squire. Our quest continues anon!"]}},
{id:"hero",name:"Captain Comet",tier:"vip",blurb:"Superhero on a smoothie break between rescues",personality:"bouncy",
 look:{skin:"#7A4A2E",hair:"#26211E",hairstyle:"crop",top:"#3E5C8E",accessory:"heromask"},
 usual:"Rocket-Fuel Smoothie",
 lines:{arrive:["Never fear — Captain Comet is HERE! ...for a smoothie, mostly.","Saved three cats from trees today. I've earned this.","Quick! My smoothie-sense is tingling!"],
 correct:["KAPOW! Right on target!","That answer just saved the day!","Super work, citizen! Truly super!","ZOOM! Straight to the top of the class!"],
 wrong:["WHOOPS! Even heroes trip on their capes.","A villainously tricky one! You'll get the next.","My origin story has worse mistakes, trust me."],
 departGood:["This smoothie gives me MORE power than the sun!","You're the real hero here. I mean it. KAPOW!"],
 departOk:["Thanks, citizen! Justice — and better blending — never rests!"]}},
{id:"alien",name:"Zib",tier:"secret",blurb:"Friendly visitor from Planet Zorp, loves Earth juice",personality:"bouncy",
 look:{skin:"#9CCB7A",hair:"#7FA65A",hairstyle:"antennae2",top:"#8E6BAE"},
 usual:"Cosmic Green Juice",
 lines:{arrive:["Greetings, Earth-friend! One green juice — it matches me!","On Planet Zorp we drink cloud jelly. Your menu is MUCH better.","Zib has travelled 90 zillion miles for this. No pressure."],
 correct:["ZORP-TASTIC! Zib is doing the happy antenna dance!","Correct! You would be famous on my planet.","Bleep-blorp-BRILLIANT!","Zib will report this genius to the mothership."],
 wrong:["Blorp! Wrong, but Zib still likes you.","On Zorp, mistakes are how we grow extra brains.","Zib got Earth words wrong for YEARS. You're doing great."],
 departGood:["Zib declares this the best juice in the galaxy! Officially!","Taking the recipe back to Zorp. They won't believe it."],
 departOk:["Pretty good for Earth! Zib will return in one moon-cycle."]}},
{id:"ninja",name:"Kiko the Ninja",tier:"vip",blurb:"Appears from nowhere; whispers her order",personality:"shy",
 look:{skin:"#EFC7A2",hair:"#26211E",hairstyle:"ninjahood",hijab:"#3E3A4A",top:"#3E3A4A",accessory:"ninjamask"},
 usual:"Silent Matcha Tea",
 lines:{arrive:["...you didn't see me come in. Nobody ever does.","A ninja needs stealth, patience... and tea.","*appears suddenly* One matcha. Quietly, please."],
 correct:["*silent approving nod* ...impressive.","Swift and precise. The way of the word-ninja.","You struck the answer before it saw you coming.","Sharp. Very sharp. *vanishes briefly out of respect*"],
 wrong:["A miss... but even ninjas trip on shadows sometimes.","*whispers* Try again. No one saw anything.","The word dodged you. Sneaky little sensei."],
 departGood:["This tea is worthy of the hidden village. Farewell. *poof*","You have earned a ninja's respect. That is... rare."],
 departOk:["Acceptable. I was never here. *smoke bomb*"]}},
{id:"king",name:"King Aldwin",tier:"vip",blurb:"A kindly king who left his castle for a proper drink",personality:"formal",
 look:{skin:"#C68A5E",hair:"#D8D3CC",hairstyle:"crown",top:"#7A3B3B",accessory:"sceptre"},
 usual:"Royal Ruby Juice",
 lines:{arrive:["A king may have a castle, but the castle has TERRIBLE juice.","Make way! ...actually, no need, everyone's very polite here.","One royal ruby juice. The crown is heavy and the throat is dry."],
 correct:["Splendid! I hereby knight this answer!","By royal decree: CORRECT!","The court scholars couldn't have said it better.","Magnificent! You'd make a fine royal wordkeeper."],
 wrong:["Incorrect — but I once mistook the moat for a bath, so no judgement.","A royal pardon for that one. Onward!","Even kings get things wrong. Usually about taxes."],
 departGood:["A drink fit for a coronation! Superb!","I shall commission a tapestry of this moment."],
 departOk:["Adequate for a Tuesday. The quest for perfection continues!"]}},
{id:"queen",name:"Queen Seraphina",tier:"vip",blurb:"Regal, gracious, and extremely fond of honey tea",personality:"formal",
 look:{skin:"#7A4A2E",hair:"#26211E",hairstyle:"queencrown",top:"#5C3E7A",accessory:"pearls"},
 usual:"Golden Honey Tea",
 lines:{arrive:["One golden honey tea — a queen must keep her voice sweet for decrees.","The palace is lovely, but this café has better chairs. Don't tell anyone.","Good day! The royal schedule says 'tea', and the schedule is law."],
 correct:["Exquisite! The whole realm shall hear of this.","Correct — as elegant an answer as I have ever heard.","You have the wisdom of my finest advisors. Perhaps finer.","Wonderful. I officially declare today a Good Word Day."],
 wrong:["Not quite — but a gracious ruler forgives instantly.","Incorrect, yet delivered with such spirit! Do try again.","Even my royal tutor got that one wrong once. Twice, actually."],
 departGood:["Tea worthy of the crown jewels! My compliments!","I shall return with the entire royal court. Prepare the chairs."],
 departOk:["A fair cup. The kingdom thanks you for your efforts."]}},
{id:"viking",name:"Bjorn the Viking",tier:"vip",blurb:"Mighty explorer, mightier appetite, softest heart",personality:"bouncy",
 look:{skin:"#EFC7A2",hair:"#C2622F",hairstyle:"vikinghelm",top:"#5C6B73",accessory:"shield"},
 usual:"Thunder Berry Smoothie",
 lines:{arrive:["BJORN HAS ARRIVED! One thunder smoothie for the mightiest thirst!","I have sailed nine seas and rowed the whole way. SMOOTHIE. PLEASE.","HAHA! This café is cosier than my longhouse! I love it!"],
 correct:["SKÅL! A mighty answer worthy of the sagas!","YES! Bjorn shall sing of this victory! Loudly! For hours!","By Thor's tiny teaspoon — CORRECT!","You fight words like a true berserker of books!"],
 wrong:["A miss! But Bjorn once rowed in a circle for three days. We continue!","WRONG — but with the heart of a warrior! Again!","The word won this battle. It will NOT win the war."],
 departGood:["MIGHTIEST SMOOTHIE IN ALL THE NORTH! Bjorn shall return!","This drink shall be legend! I name my next boat after it!"],
 departOk:["Good enough for a long voyage. Bjorn approves... quietly. For once."]}},
{id:"mummy",name:"Mumford the Mummy",tier:"secret",blurb:"4,000 years old and still can't start the day without tea",personality:"sleepy",
 look:{skin:"#D9CDB8",hair:"#CBC2B0",hairstyle:"mummywrap",top:"#C9BFAC",accessory:"mummyface"},
 usual:"Ancient Chamomile Tea",
 lines:{arrive:["Mmmnnh... tea... four thousand years is TOO long between cuppas.","*shuffles in slowly* ...I woke up for this. It had better be good.","The pyramid was cosy, but the room service was dreadful."],
 correct:["Ooh! You'd have made a fine royal scribe!","Correct! *a loose bandage waves in celebration*","Even the Sphinx couldn't have riddled that better.","Yes! I haven't been this pleased since 2000 BC."],
 wrong:["Wrong... but I once slept through an entire dynasty, so who am I to judge?","*slow disappointed shuffle* ...try again, young one.","Not quite. The hieroglyphs were tricky too."],
 departGood:["Worth every century of the wait! Magnificent!","I shall recommend this place to everyone in the tomb!"],
 departOk:["Acceptable. I've had worse — mostly sand."]}},
{id:"pharaoh",name:"Pharaoh Neferu",tier:"secret",blurb:"Ruler of the golden sands; connoisseur of golden honey",personality:"formal",
 look:{skin:"#B87A4B",hair:"#26211E",hairstyle:"nemes",top:"#EDE6E0",accessory:"ankh"},
 usual:"Golden Sun Smoothie",
 lines:{arrive:["The Pharaoh has crossed deserts for this smoothie. Do not disappoint.","Bow— actually, no need. Just the usual, please.","Even the pyramids took less planning than my morning drink order."],
 correct:["Excellent! I decree this answer worthy of a monument!","Correct — the wisdom of the ancients flows in you.","Magnificent! The royal scribes shall record this triumph.","By the golden sands — precisely right!"],
 wrong:["Incorrect. But Rome wasn't built in— wait, wrong empire.","A pharaoh forgives. Once. Per visit.","Not quite — even my greatest architects made the odd wobbly pyramid."],
 departGood:["A drink worthy of the treasury! Glorious!","I shall have this recipe carved in stone. Literally."],
 departOk:["Adequate. The desert teaches patience, and so does this café."]}},
{id:"baller",name:"Skye the Basketball Star",tier:"vip",blurb:"Point guard with a three-point smile",personality:"bouncy",
 look:{skin:"#7A4A2E",hair:"#26211E",hairstyle:"headband",top:"#E07B39",accessory:"basketball",hijab:"#E04B3A"},
 usual:"Slam-Dunk Smoothie",
 lines:{arrive:["Coach says hydration wins championships — one smoothie please!","*dribbles in* Quick order before practice — the usual!","Nothing but net, nothing but smoothies. Let's go!"],
 correct:["SWISH! Three points — nothing but net!","That's a slam dunk of an answer!","Fast break, clean finish — you've got game!","BUZZER BEATER! Absolutely nailed it!"],
 wrong:["Air ball! But hey, even the pros miss free throws.","Off the rim! Grab the rebound and go again.","Shot clock's reset — you've got this next one."],
 departGood:["MVP service! Most Valuable Pouring!","That's going straight on the highlight reel!"],
 departOk:["Solid assist. We'll run the play again tomorrow."]}},
{id:"striker",name:"Striker Sam",tier:"vip",blurb:"Never stops running; never misses a smoothie",personality:"bouncy",
 look:{skin:"#EFC7A2",hair:"#8A5A2E",hairstyle:"crop",top:"#3E5C8E",accessory:"football"},
 usual:"Golden Boot Banana Shake",
 lines:{arrive:["Ninety minutes of running works up a THIRST — usual please!","Just scored a screamer in training. Celebration shake time!","Quick one before kick-off — the golden boot special!"],
 correct:["GOOOAL! Top corner, no chance for the keeper!","What a strike! Absolute world-class answer!","One-nil to you! Brilliant finish!","That's going in from thirty yards — SCENES!"],
 wrong:["Just wide of the post! Shake it off and go again.","The keeper saved that one — but you'll score the rebound.","Offside! No worries, plenty of match left."],
 departGood:["Player of the Match goes to the barista! Incredible!","That shake deserves a trophy lift!"],
 departOk:["A solid nil-nil draw. We go again next match!"]}},
{id:"linebacker",name:"Touchdown Ty",tier:"vip",blurb:"Gentle giant of the gridiron with a mighty thirst",personality:"bouncy",
 look:{skin:"#5C3A24",hair:"#26211E",hairstyle:"nflhelm",top:"#3E5C8E",accessory:"amfootball",hijab:"#7A3B3B"},
 usual:"End-Zone Energy Smoothie",
 lines:{arrive:["Big game today — need my end-zone energy boost!","*jogs in* Coach gave me two minutes. Make them count!","Fourth quarter fuel, please — the usual!"],
 correct:["TOUCHDOWN! Six points, right up the middle!","Interception — you READ that question perfectly!","First down! Keep the drive alive!","That's a fifty-yard field goal — RIGHT through the posts!"],
 wrong:["Fumble! But we recover and run it again.","Flag on the play — no harm, next down.","Incomplete pass. Huddle up, go again."],
 departGood:["HALL OF FAME service! I'm telling the whole team!","Victory formation — this café WINS!"],
 departOk:["Good hustle out there. Same time next week!"]}},

{id:"jiangshi",special:true,name:"Master Hop",tier:"secret",blurb:"A hopping jiangshi who is spooky only in the silliest way",personality:"mysterious",
 look:{skin:"#E8D8C8",hair:"#1C1A22",hairstyle:"jiangshihat",top:"#315C72",garment:{style:"shirt"},accessory:"talisman"},
 usual:"Moonlight Plum Tea",
 timeGreeting:{morning:"Morning... hop, hop. The daylight is not so bad today.",afternoon:"Afternoon! I have hopped here with excellent manners.",night:"Night-time suits me best. One tea, if you please."},
 lines:{arrive:["Hop... hop... one plum tea, please.","Do not worry — I haunt only difficult vocabulary.","A tidy café! Excellent. Untidy places snag my sleeves."],
 correct:["Hop-tastic! Correct.","A most impressive answer. Even the talisman approves.","Excellent. That was eerily accurate.","Sharp work. You would survive any ghost quiz."],
 wrong:["A miss — but not a dreadful one.","Hop back and try again.","Even ancient spirits muddle words sometimes."],
 departGood:["A delicious tea and a nimble mind — a fine pairing.","I shall hop back another evening."],
 departOk:["Quite acceptable. I leave content... and slightly spooky."]}},
{id:"explorer",special:true,name:"Pippa Quest",tier:"vip",blurb:"Young explorer who treats every errand like an expedition",personality:"brisk",
 look:{skin:"#D9B08A",hair:"#6E4A2E",hairstyle:"explorerhat",top:"#8C6A42",garment:{style:"polo"},accessory:"satchel"},
 usual:"Trailblazer Lemonade",
 timeGreeting:{morning:"Morning! Best time to set out and discover something new.",afternoon:"Afternoon! I've already mapped three exciting puddles.",night:"Evening! Explorers do love a cosy final stop."},
 lines:{arrive:["Explorer Pippa reporting in for one lemonade!","I've crossed two parks and one muddy shortcut for this drink.","Every great expedition needs refreshments."],
 correct:["Discovery made! That answer is a treasure.","Brilliant! Marking that one on the map.","A fine result — expedition approved.","You found the right path at once!"],
 wrong:["Wrong turn, explorer. Recalculate!","No matter — every map has a scribble or two.","A little detour. Try the next route."],
 departGood:["A superb stop! This café deserves a star on my map.","Adventure fuel acquired. Onward!"],
 departOk:["Not bad at all. I'll revisit after my next expedition."]}},
{id:"firefighter",special:true,name:"Ember Jones",tier:"vip",blurb:"Brave firefighter with a calm voice and a quick smile",personality:"brisk",
 look:{skin:"#F0C9A0",hair:"#8A6B3A",hairstyle:"firehelmet",top:"#B23A2E",garment:{style:"tee"},accessory:"firehose"},
 usual:"Five-Alarm Orange Fizz",
 timeGreeting:{morning:"Morning! Quiet shift so far — fingers crossed.",afternoon:"Afternoon! Time for a quick recharge.",night:"Evening shift calls for a bright fizzy drink."},
 lines:{arrive:["One orange fizz, please — then I'm back on duty.","A quick drink before the next call-out, thank you.","Nothing beats a cool fizz after hauling hoses."],
 correct:["Nice one! Cool under pressure.","Correct — fast and steady, just how I like it.","That's top teamwork!","Brilliant answer — alarm bells for success!"],
 wrong:["Oops — missed it. Reset and go again.","No panic. We handle one step at a time.","A little smoke, not a full fire. Try again."],
 departGood:["Perfect! Refreshed and ready to roll.","Excellent service — hero material, honestly."],
 departOk:["Solid effort. I'll be back after the next shift."]}},
{id:"beekeeper",special:true,name:"Honey Fern",tier:"vip",blurb:"Gentle beekeeper who knows every buzz in the meadow",personality:"shy",
 look:{skin:"#E8B88A",hair:"#8A6B3A",hairstyle:"beeveil",top:"#EFE8DA",garment:{style:"shirt"},accessory:"beeframe"},
 usual:"Wildflower Honey Tea",
 timeGreeting:{morning:"Morning! The bees were up before I was.",afternoon:"Afternoon! My bees have had a very busy day.",night:"Evening. The hive is settling down now."},
 lines:{arrive:["Hello... one honey tea, please.","I've brought the smell of wildflowers with me again.","My bees insisted I stop for a treat."],
 correct:["Buzz-zilliant!","Lovely answer — sweet as clover honey.","The whole hive would approve of that.","Exactly right. A neat little nectar of a result."],
 wrong:["A tiny sting, but you'll recover.","No bother — even bees miss a bloom.","Let's try another flower on the next question."],
 departGood:["That was lovely. I'll tell the hive this café is blooming marvellous.","Sweet success — thank you kindly."],
 departOk:["Quite pleasant. I'll buzz by again soon."]}},
{id:"librarian",special:true,name:"Mabel Page",tier:"vip",blurb:"A kindly librarian who can match any mood to a book",personality:"formal",
 look:{skin:"#F2D3B3",hair:"#6E4A2E",hairstyle:"librarianbun",top:"#6C7A8C",garment:{style:"cardigan2"},accessory:"bookstack"},
 usual:"Quiet Corner Tea",
 timeGreeting:{morning:"Good morning. The library shelves were especially peaceful today.",afternoon:"Good afternoon. I've just re-shelved a mountain of books.",night:"Good evening. A calm tea is my favourite closing ritual."},
 lines:{arrive:["Good day. One quiet corner tea, please.","A book, a warm drink and a good word — bliss.","Libraries and cafés have much in common: both reward patience."],
 correct:["Excellent. Very well read of you.","Correct — tidy, precise and satisfying.","A splendid answer. I'd bookmark that one.","Lovely work. That deserves the best shelf."],
 wrong:["Not quite, but the next page is waiting.","A small slip. Kindly try once more.","Every reader revisits the difficult parts."],
 departGood:["Wonderful. This café is fit for the finest reading nook.","A truly comforting stop — thank you."],
 departOk:["Pleasant indeed. I shall return after my next chapter."]}},
{id:"detective",special:true,name:"Dot Marple",tier:"secret",blurb:"Sharp-eyed detective who notices crumbs, clues and synonyms",personality:"cool",
 look:{skin:"#F0C9A0",hair:"#6E4A2E",hairstyle:"deerstalker",top:"#8C6A42",garment:{style:"shirt"},accessory:"magnifier"},
 usual:"Clue-Catcher Chai",
 timeGreeting:{morning:"Morning. I have a strong hunch this tea will be excellent.",afternoon:"Afternoon. The case can wait five minutes for chai.",night:"Evening. The best clues often appear after dark."},
 lines:{arrive:["One chai, please. I can already smell a clue.","Every mystery improves with a warm drink.","I've followed a trail of biscuit crumbs to this very counter."],
 correct:["Aha! Case solved.","Elementary — and excellent.","You spotted the right answer at once.","Very good. I'd hire you on the case."],
 wrong:["Hmm. A false lead.","No matter — investigate the next one.","Even top detectives chase the wrong clue sometimes."],
 departGood:["Outstanding. Mystery solved, drink enjoyed.","A very satisfying stop. Consider yourself fully cleared."],
 departOk:["Interesting. I'll keep the case open and return later."]}},
{id:"gondolier",special:true,name:"Luca Rialto",tier:"vip",blurb:"Singing gondolier with a dramatic flourish and excellent manners",personality:"bouncy",
 look:{skin:"#F0C9A0",hair:"#3A2E22",hairstyle:"boater",top:"#2E4A6E",garment:{style:"gondolierstripe"},accessory:"oar"},
 usual:"Canal Citrus Spritz",
 timeGreeting:{morning:"Buongiorno! The canal shimmered beautifully this morning.",afternoon:"Afternoon! Perfect weather for singing on the water.",night:"Evening! Lantern light makes every canal feel magical."},
 lines:{arrive:["Ciao! One citrus spritz for a thirsty gondolier.","I have sung three love songs and require refreshment.","A smooth little drink, please — as smooth as my rowing."],
 correct:["Bellissimo!","A perfect answer — worthy of applause!","Bravo! You kept that one beautifully in balance.","Splendid! That answer glided in like a gondola."],
 wrong:["Ah — a small wobble in the canal.","Not this time, amico. Row once more.","Even gondolas bump the dock sometimes."],
 departGood:["Delightful! I shall sing the praises of this café.","A fine stop indeed — graceful and charming."],
 departOk:["Quite nice. I'll drift back another day."]}},
{id:"captain",special:true,name:"Captain Skye",tier:"vip",blurb:"Airline captain who is neat, calm and impressively punctual",personality:"formal",
 look:{skin:"#E8B88A",hair:"#2B1B12",hairstyle:"pilotcap",top:"#F4F5F7",garment:{style:"pilotstripes"},accessory:"bag"},
 usual:"Cloudline Latte",
 timeGreeting:{morning:"Morning. First departure completed right on schedule.",afternoon:"Afternoon. A smooth landing deserves a smooth latte.",night:"Evening. Final flight done — now for a proper drink."},
 lines:{arrive:["Captain Skye requesting one latte for turnaround.","Nothing like a reliable café between flights.","I appreciate efficiency — and good foam."],
 correct:["Excellent — cleared for take-off.","Right answer. Smooth as a perfect landing.","Very good. Your timing is impeccable.","You've navigated that question beautifully."],
 wrong:["A little turbulence there.","Off course briefly — please correct and continue.","No matter. Regain heading and try again."],
 departGood:["Outstanding. Service this smooth deserves five stars.","Perfect. Cabin mood: delighted."],
 departOk:["Quite satisfactory. I would gladly fly back in for another."]}},
{id:"gardener",special:true,name:"Sunny Bloom",tier:"vip",blurb:"Cheerful gardener who thinks in seeds, seasons and sunshine",personality:"bouncy",
 look:{skin:"#F2D3B3",hair:"#8A6B3A",hairstyle:"sunhat",top:"#6C8C5A",garment:{style:"dungarees"},accessory:"wateringcan"},
 usual:"Fresh Mint Cooler",
 timeGreeting:{morning:"Morning! The roses were stretching toward the sun.",afternoon:"Afternoon! I've been planting all day.",night:"Evening. Time to put down the trowel and relax."},
 lines:{arrive:["One mint cooler, please — gardening is thirsty work.","I've brought a bit of sunshine in with me.","A cool drink after all that digging sounds perfect."],
 correct:["Blooming lovely!","Spot on — that one grew beautifully.","Excellent work. You've green fingers for words.","A healthy answer, bright and strong."],
 wrong:["Oops — that one needs replanting.","No trouble. Give it another little water and try again.","Even the best gardens have the odd weed."],
 departGood:["Lovely! I feel fresh as a newly watered border.","A delightful stop — this café is in full bloom."],
 departOk:["Quite nice. I'll pop back after my next round in the garden."]}},
/* ---- everyday regulars ---- */
{id:"okafor",name:"Mrs. Okafor",tier:"regular",blurb:"Retired schoolteacher, endlessly encouraging",personality:"formal",
 look:{skin:"#7A4A2E",hair:"#D8D3CC",hairstyle:"bun",top:"#8E6BAE",accessory:"pearls",garment:{style:"tee"}},
 usual:"Ginger Fizz",
 lines:{arrive:["Hello, dear! My usual ginger fizz — and a little word to keep my mind sparkling.","Good day! Teacher's honour: I shall be very fair in my marking."],
 correct:["Gold star! I'd have put you top of the class.","Beautifully done, dear.","See? I always said you were a bright one.","That's the way — clear thinking!","Top marks. Simply top marks."],
 wrong:["Not quite, dear — but a wrong answer is just a step to a right one.","Nearly! We learn more from the tricky ones.","Chin up. Even teachers get things wrong — don't tell anyone."],
 departGood:["A perfect drink and a sharp mind. Marvellous!","I shall tell everyone about this little bar."],
 departOk:["Thank you, dear. Keep practising — I'll be back to check!"]}},
{id:"callum",name:"Callum",tier:"regular",blurb:"Postman, always rushing but friendly",personality:"brisk",
 look:{skin:"#EFC7A2",hair:"#C2622F",hairstyle:"cap",top:"#C0392B",accessory:"bag",garment:{style:"polo",palette:"ocean"}},
 usual:"Strong Mint Cooler",
 lines:{arrive:["Quick one, pal — mint cooler, strong as you like. Parcels won't deliver themselves!","Morning! On my round — hit me with the word of the day."],
 correct:["First class! Get it? Like the post!","Nice one, pal!","Delivered! Right through the letterbox.","Sharp as a new stamp, you are."],
 wrong:["Ach, wrong address on that one — try the next!","Nae bother, everyone misreads a label sometimes.","Return to sender! You'll get the next one."],
 departGood:["Cracking drink! That'll fuel a whole round.","Signed, sealed, delivered. Cheers!"],
 departOk:["Cheers anyway — see you on tomorrow's round!"]}},
{id:"yuki",name:"Yuki",tier:"regular",blurb:"Exchange student, curious about everything",personality:"bouncy",
 look:{skin:"#F2D3B0",hair:"#191418",hairstyle:"bob",top:"#5B8FB5",accessory:"camera"},
 usual:"Peach Dream",
 lines:{arrive:["Hello! What is today's special? And today's special word?","Konnichiwa! I am collecting new English words — please, test me too!"],
 correct:["Sugoi! Amazing!","I am writing that word in my notebook!","Perfect! English is full of treasure.","You explain so well!"],
 wrong:["Oh! Tricky word. I did not know it either.","Even my dictionary would pause on that one.","We learn together, yes?"],
 departGood:["Oishii! Delicious! Best bar in town.","I will bring my whole class here!"],
 departOk:["Thank you! Every visit I learn something."]}},
{id:"dave",name:"Big Dave",tier:"regular",blurb:"Removals driver, gruff outside, soft inside",personality:"cool",
 look:{skin:"#E2A87C",hair:"#4A3524",hairstyle:"beanie",top:"#5C6B73",accessory:"none"},
 usual:"Pink Lemonade",
 lines:{arrive:["Pink lemonade. Don't say a word about it.","Alright. The usual. And make the question quick, I've got a piano to move."],
 correct:["...Not bad. Not bad at all.","Huh. Sharper than my gaffer, you are.","Right answer. Solid.","Good. Heavy lifting, words. I respect it."],
 wrong:["Wrong'un. Happens to the best of us.","Missed the grip on that one. Go again next time.","Eh, I'd have got that wrong too."],
 departGood:["...Best pink lemonade in the borough. You heard nothing.","Proper job, that."],
 departOk:["Ta. See you after the next van load."]}},
{id:"agnes",name:"Sister Agnes",tier:"regular",blurb:"Elderly nun with very long stories",personality:"formal",
 look:{skin:"#EFD0AF",hair:"#FFFFFF",hairstyle:"veil",top:"#3E3A4A",accessory:"none"},
 usual:"Warm Honey Lemon",
 lines:{arrive:["Warm honey lemon, my dear — it reminds me of a story… but first, your little word game.","Bless you, child. One honey lemon, and let us exercise the mind."],
 correct:["Wisdom! As I always say — well, I say a great many things.","Splendid, child.","The right word at the right time is a small miracle.","Ah, wonderful. That reminds me of a story — for another day."],
 wrong:["No matter, child. Patience is itself a lesson.","We all stumble. The path continues.","A small slip. Onwards, gently."],
 departGood:["Perfect warmth, perfect words. Bless this little bar.","I shall mention you kindly in my stories."],
 departOk:["Thank you, dear. Do keep at your studies."]}},
{id:"kofi",name:"Kofi",tier:"regular",blurb:"Tailor, always immaculately dressed",personality:"formal",
 look:{skin:"#5E3A24",hair:"#171310",hairstyle:"crop",top:"#B8860B",accessory:"cravat"},
 usual:"something as elegant as I am",
 lines:{arrive:["Good day. Something as elegant as I am, please — and a word with proper tailoring.","Ah, my favourite establishment. Dress my glass beautifully."],
 correct:["Cut from fine cloth, that answer.","Immaculate. Like a well-pressed seam.","Precisely stitched. Bravo.","Elegant thinking. I approve."],
 wrong:["Hm — a loose thread. Easily re-stitched.","A crooked hem, nothing more. The next will hang beautifully.","Even the finest tailor unpicks a stitch now and then."],
 departGood:["A drink of impeccable taste. Like its maker — and its server.","Perfection. I shall recommend you to my clients."],
 departOk:["Thank you. Do keep refining your craft."]}},
{id:"elowen",name:"Elowen",tier:"regular",blurb:"Librarian, quiet, always mid-book",personality:"shy",
 look:{skin:"#F0C9A0",hair:"#6B4B33",hairstyle:"bun",top:"#7FA65A",accessory:"book"},
 usual:"Apple Zing",
 lines:{arrive:["(looks up from book) Oh — hello. An apple zing, please. Quietly, if you can.","Shhh… just at a good bit. Apple zing, and a word puzzle, please."],
 correct:["(quiet smile) Yes. Exactly right.","You'd be very useful in a library.","Correct. That word appears in the book I'm reading, actually.","Lovely. Words are the best furniture."],
 wrong:["(gently) Not that one. But close, on the same shelf.","A near miss — the right word was just one spine along.","No matter. Every reader re-reads a page sometimes."],
 departGood:["A perfect drink and perfect quiet. Bliss.","I got two whole chapters read. Wonderful."],
 departOk:["Thank you. Back to my book now."]}},
{id:"tam",name:"Old Tam",tier:"regular",blurb:"Retired fisherman with a gravelly laugh",personality:"cool",
 look:{skin:"#DFA778",hair:"#D9D9D9",hairstyle:"horseshoe_beard",top:"#2E5266",accessory:"none",garment:{style:"tee"}},
 usual:"whatever's strongest — non-alcoholic, mind",
 lines:{arrive:["Whatever's strongest, skipper — non-alcoholic, mind! And gie us the word o' the day.","Ahoy! Tide's oot and I'm parched."],
 correct:["Hooked it clean oot the water!","Aye, that's the catch of the day right there.","Sharp as a gull's eye, you are.","Reel it in! Well done."],
 wrong:["Ach, that one slipped the net. They do that.","The big ones always wriggle free first time.","Nae worries — cast again."],
 departGood:["Finest catch in the harbour, this place!","Stronger than a north wind, that. Braw!"],
 departOk:["Ta, skipper. The sea teaches patience — so do words."]}},
{id:"maya",name:"Maya",tier:"regular",blurb:"Sixth-former revising between shifts, terminally online",personality:"bouncy",
 look:{skin:"#C98A55",hair:"#2A2438",hairstyle:"curls",top:"#6BC5B8",accessory:"headphones"},
 usual:"Blue Raspberry Slush",
 lines:{arrive:["Heyy — blue raspberry slush, and can we make this word thing quick, I'm literally mid-revision.","Ok this place is actually so cute. One slush please!"],
 correct:["Wait that's actually so smart, no cap.","Ok you ATE that, ngl.","Yesss, correct! Big brain moment.","That's the one! Certified word nerd behaviour."],
 wrong:["Aw nooo, so close though.","Honestly relatable, that word is sneaky.","It's giving 'nearly' energy — go again!"],
 departGood:["This slush is unreal, thank you sm!","Ok I'm def telling my group chat about this place."],
 departOk:["Thanks anyway — back to my revision, wish me luck!"]}},
/* ------------- VIP ------------- */
{id:"contessa",name:"Contessa Rivera",tier:"vip",blurb:"Glamorous dance instructor — wants it perfecto",personality:"bouncy",
 look:{skin:"#C98A55",hair:"#1E1410",hairstyle:"bun",top:"#D8547A",accessory:"flower"},
 usual:"Passionfruit Twirl",
 lines:{arrive:["Dahling! One passionfruit twirl — perfecto, or not at all!","I have exactly four minutes between classes. Dazzle me!"],
 correct:["PERFECTO! You dance with words!","Magnífico! Such footwork of the mind!","Bravíssima! Encore, encore!","Yes! That is the rhythm!"],
 wrong:["Ay! A stumble — but a dancer rises with style.","No, no — but even I once fell in the tango. Once.","We repeat the step until it shines, sí?"],
 departGood:["A drink with FLAIR! I shall tell everyone at the studio.","Perfecto! You have earned your standing ovation."],
 departOk:["Hmph — passable. Next time, we dazzle, sí?"]}},
{id:"steinberg",name:"Mr. Steinberg",tier:"vip",blurb:"Sharp-suited engineer — precise, low tolerance for wobble",personality:"brisk",
 look:{skin:"#EFC7A2",hair:"#7A7A7A",hairstyle:"crop",top:"#3E3A4A",accessory:"glasses",garment:{style:"shirt",palette:"charcoal"}},
 usual:"Precision Press (apple, exactly chilled)",
 lines:{arrive:["One Precision Press. Apple. Four degrees. And your question — I will be checking your working.","Efficiency, please. I have a bridge to inspect at half past."],
 correct:["Correct. Within tolerance. Good.","Ja — structurally sound reasoning.","Precise. As it should be.","Zero defects. I am… quietly impressed."],
 wrong:["Incorrect. Recalibrate and proceed.","An error. Errors are data — use it.","Hm. The measurement was off. Next attempt."],
 departGood:["Flawless execution. This establishment meets specification.","Excellent tolerances. I shall return at the same time next week. Exactly."],
 departOk:["Adequate. There is room for optimisation."]}},
{id:"priyanka",name:"Priyanka Auntie",tier:"vip",blurb:"No-nonsense doctor on her lunch break",personality:"brisk",
 look:{skin:"#A96A3C",hair:"#1E1410",hairstyle:"bun",top:"#2E8B8B",accessory:"stethoscope"},
 usual:"Mango Rocket",
 lines:{arrive:["Mango rocket, beta, quick-quick — I have patients waiting and a word for you.","Twelve minutes of lunch. Impress me in two."],
 correct:["Correct diagnosis! Sharp mind.","Very good, beta. You would survive medical school.","Exactly right. No second opinion needed.","Shabash! Well done."],
 wrong:["Wrong prescription — but good doctors learn from every case.","Tch — close. Review and retest.","Not fatal. Learn it, then it's yours for ever."],
 departGood:["Excellent! Doctor's orders: keep this up.","Full marks. Now I can face the afternoon clinic."],
 departOk:["Acceptable. Take twice daily and improve, hm?"]}},
{id:"devereux",name:"Mr. Devereux",tier:"vip",blurb:"Retired headmaster — treats every order like an exam",personality:"formal",
 look:{skin:"#EFD0AF",hair:"#C9C9C9",hairstyle:"side",top:"#5C4033",accessory:"bowtie",garment:{style:"shirt",palette:"sand"}},
 usual:"Earl's Elderflower",
 lines:{arrive:["Ah. The Elderflower, please. You may consider this an unseen examination.","Good afternoon. Silence in the hall — your paper begins… now."],
 correct:["Full marks. See me after class — for a commendation.","Distinction-level work.","Precisely so. The examiners would be satisfied.","Correct. You may be sitting the scholarship paper yet."],
 wrong:["Not the answer on the mark scheme — but your working shows promise.","Incorrect. Read the question twice, answer once.","A dropped mark, not a dropped exam. Continue."],
 departGood:["An exemplary performance. This will be noted in the school record.","First in the year group. Dismissed — with honours."],
 departOk:["A solid effort. Revision, then resit. You'll get there."]}},
/* ------------- SECRET ------------- */
{id:"fox",name:"The Lexicon Fox",tier:"secret",blurb:"A mysterious fox in a waistcoat who speaks in riddles",personality:"mysterious",
 look:{fox:true,skin:"#D07B3A",hair:"#8A4A1E",hairstyle:"ears",top:"#5C4033",accessory:"pocketwatch"},
 usual:"the Riddler's Nectar",
 lines:{arrive:["Riddle me a drink and word me a riddle — the Fox is thirsty for both.","I walk in ink and dine on meaning. Pour me something clever."],
 correct:["Ahh — the riddle bows to you.","Clever cub! The word yields its secret.","So the lock turns, and the meaning steps out.","The Fox tips his hat. Rare praise indeed."],
 wrong:["The word keeps its secret… for now.","Even foxes lose the scent. Circle back — it will still be there.","A riddle unsolved is a riddle for tomorrow."],
 departGood:["Nectar and wit! The Fox shall whisper of this place in curious ears.","Until the moon is a comma in the sky — farewell."],
 departOk:["Adequate nectar. The riddles, however, await your return."]}},
{id:"adeyemi",name:"Professor Adeyemi",tier:"secret",blurb:"University linguist who tests words for fun",personality:"formal",
 look:{skin:"#6B4226",hair:"#111",hairstyle:"crop",top:"#8E6BAE",accessory:"glasses"},
 usual:"Etymology Elixir",
 lines:{arrive:["Ah, splendid — an Etymology Elixir, and let us take a word apart to see how it ticks.","Good day! I have been studying words for forty years and they still surprise me. Shall we?"],
 correct:["Outstanding! You'd enjoy my Tuesday seminar.","Precisely — and did you know that word travelled here through Latin? Marvellous journey.","Correct! Language rewards the curious.","Excellent. I may quote you in a footnote."],
 wrong:["A worthy attempt — that word fools my undergraduates too.","Not quite, but your reasoning had good bones.","Incorrect, yet instructive. That is how vocabulary grows."],
 departGood:["A first-class performance. The department would be proud.","Delicious — and intellectually nourishing. Rare combination."],
 departOk:["Thank you. Keep reading widely — it is the only trick there is."]}},
{id:"owl",name:"The Night Owl",tier:"secret",blurb:"A hooded figure who appears only after a perfect streak",personality:"mysterious",
 look:{skin:"#B9AEC6",hair:"#2A2438",hairstyle:"hood",top:"#2A2438",accessory:"none"},
 usual:"Midnight Velvet",
 lines:{arrive:["…You have been flawless. The Owl noticed.","(a quiet voice from the hood) One Midnight Velvet. Show me the streak was no accident."],
 correct:["…Yes.","(a slow, approving nod)","The Owl sees. The Owl approves.","…Flawless still."],
 wrong:["…Even so. The streak was real. Begin another.","(a soft hoot) …Again, when you are ready.","The night is long. There is time to master it."],
 departGood:["…Worthy. We will meet again at your next streak.","(the hood dips once) …Remarkable."],
 departOk:["…The Owl will watch for you."]}},
/* ------------- 20 NEW CUSTOMERS — bigger, busier queue ------------- */
{id:"nora",name:"Nora",tier:"regular",blurb:"Nursery-school teacher, endlessly patient with tiny humans",personality:"bouncy",
 look:{skin:"#EFC7A2",hair:"#8A6B3A",hairstyle:"bob",top:"#7FA65A",accessory:"none",garment:{style:"tee"}},
 usual:"Honeycomb Fizz",
 lines:{arrive:["Morning! Honeycomb fizz, please — I've got twenty three-year-olds waiting for storytime.","One of my usual, and let's see if you're as sharp as my top reader!"],
 correct:["Gold star! I'll tell the class about you.","Well done, you!","Lovely thinking!","That's exactly right — clever clogs!"],
 wrong:["Not quite, but lovely try!","Ooh, close! We'll get it next time.","No matter — even grown-ups get tricky ones wrong."],
 departGood:["Perfect! Now I can face the glitter and glue.","Best fizz in town, this."],
 departOk:["Thanks anyway — back to the chaos of nursery!"]}},
{id:"desmond",name:"Desmond",tier:"regular",blurb:"Retired bus driver, knows every street and every shortcut",personality:"cool",
 look:{skin:"#6B4226",hair:"#D9D9D9",hairstyle:"bald_beard",top:"#3E3A4A",accessory:"none",garment:{style:"shirt"}},
 usual:"Route 47 Cooler",
 lines:{arrive:["Alright. The usual — Route 47 Cooler. Question me while I catch my breath.","Forty years I drove that route. Now I just drink cooler and answer your quizzes."],
 correct:["Right on time, that answer.","Smooth journey, no diversions.","Correct — straight down the main road.","Good stop, that."],
 wrong:["Missed your stop there.","Wrong turning — happens to the best of us.","Ah well. Next bus along."],
 departGood:["Best cooler on my whole route, that.","Cheers, driver — I mean, barista."],
 departOk:["Ta. See you at the next stop."]}},
{id:"freya",name:"Freya",tier:"regular",blurb:"Vet nurse, always smells faintly of dog treats",personality:"bouncy",
 look:{skin:"#F0C9A0",hair:"#B5502A",hairstyle:"plait",top:"#5B8FB5",accessory:"none",garment:{style:"tee"}},
 usual:"Berry Paw-fect",
 lines:{arrive:["Hiya! Berry Paw-fect for me — just finished a very wriggly appointment.","One of the usual, please! Test me, I need a break from poorly puppies."],
 correct:["Yes! Good as gold, you are.","Nailed it — better bedside manner than some of my patients.","Spot on!","Excellent — no whimpering required."],
 wrong:["Aw, nearly! Like a nervous kitten on the scales.","Not quite — shake it off!","So close! Try again, champion."],
 departGood:["Perfect pick-me-up after a long shift!","Tell the animals I said hello — actually don't, they won't understand."],
 departOk:["Cheers! Back to the waiting room."]}},
{id:"clive",name:"Clive",tier:"regular",blurb:"Allotment gardener, always has soil under his fingernails",personality:"formal",
 look:{skin:"#DFA778",hair:"#8A6B3A",hairstyle:"flop",top:"#7FA65A",accessory:"none",garment:{style:"tee",palette:"forest"}},
 usual:"Rhubarb Ripple",
 lines:{arrive:["Good day. Rhubarb ripple, if you please — grown it myself, you know.","Ah, hello. Test me on a word while my hands are still muddy."],
 correct:["Splendid! Grows on you, that answer.","Well rooted, that one.","Blooming marvellous!","Correct — a fine harvest of an answer."],
 wrong:["Ah, a weed among the flowers, that guess.","Not quite ripe yet — try again next season.","No matter — even prize marrows have off years."],
 departGood:["Best ripple this side of the allotments.","I'll bring you a marrow next time — no arguing."],
 departOk:["Thank you kindly. Back to the cabbages."]}},
{id:"ruth",name:"Ruth",tier:"regular",blurb:"Choir director, speaks mostly in musical metaphors",personality:"formal",
 look:{skin:"#EFD0AF",hair:"#C9C9C9",hairstyle:"bun",top:"#8E6BAE",accessory:"pearls",garment:{style:"tee"}},
 usual:"Harmony Soda",
 lines:{arrive:["Good afternoon. A Harmony Soda, and let us see if your ear for words is as good as your ear for pitch.","Ah, lovely. One soda, please — and don't sing flat on this next word."],
 correct:["In perfect harmony! Beautifully done.","A well-pitched answer, that.","Bravo — right on the note.","Exactly in tune."],
 wrong:["A touch flat, that one. Try again, in tune this time.","Not quite — a bit off-key.","No matter, dear — even sopranos crack a note now and then."],
 departGood:["A soda worthy of an encore!","I shall put you in the front row next rehearsal."],
 departOk:["Thank you. Back to conducting the altos."]}},
{id:"baxter",name:"Baxter",tier:"regular",blurb:"Delivery cyclist, always slightly out of breath",personality:"brisk",
 look:{skin:"#C98A55",hair:"#171310",hairstyle:"cap",top:"#E8891D",accessory:"bag"},
 usual:"Electrolyte Zinger",
 lines:{arrive:["Quick — electrolyte zinger! Got twelve more drops before dark.","Hiya! Fastest question you've got, please, I'm on the clock."],
 correct:["Delivered on time! Nice one.","Straight to the door, that answer.","Zero missed drops there!","Correct — quicker than my bike, even."],
 wrong:["Wrong address on that one.","Missed the drop-off, that.","Ah well — reroute and try again."],
 departGood:["Best zinger on my whole route!","Cheers — back on the pedals."],
 departOk:["Ta. Gotta fly — literally."]}},
{id:"wendy",name:"Wendy",tier:"regular",blurb:"Charity shop volunteer, has a story for every donated item",personality:"shy",
 look:{skin:"#F2D3B0",hair:"#D8D3CC",hairstyle:"bob",top:"#C9899A",accessory:"none",garment:{style:"polo"}},
 usual:"Vintage Violet Fizz",
 lines:{arrive:["(quietly) Oh — hello. A violet fizz, please, if it's not too much trouble.","Just popping in before my shift at the shop. One usual, please."],
 correct:["(soft smile) Oh, well done, that's lovely.","Just right — like finding a treasure in the donation bags.","Very good, dear.","Quite right — gently done."],
 wrong:["(gently) Not quite, but a good go.","Oh, so close — no matter at all.","Never mind, dear. Some days the price tags fall off, too."],
 departGood:["What a treat. Thank you ever so much.","I'll think of this kindly all through my shift."],
 departOk:["Thank you. Best get back to sorting donations."]}},
{id:"gustav",name:"Gustav",tier:"regular",blurb:"Retired ship's captain, still talks like he's at the helm",personality:"formal",
 look:{skin:"#DFA778",hair:"#D9D9D9",hairstyle:"chops_beard",top:"#2E5266",accessory:"none",garment:{style:"shirt"}},
 usual:"Starboard Storm",
 lines:{arrive:["Ahoy. Starboard Storm, if she's ready — and steady on with the next word.","Good day. Chart me a course through this next puzzle, would you."],
 correct:["Full steam ahead! Well navigated.","Land ho — right on course.","Shipshape answer, that.","Correct! Smooth sailing."],
 wrong:["Ran aground on that one.","Off course — correct heading and try again.","No matter — even old captains misread the stars sometimes."],
 departGood:["Finest brew this side of the harbour!","Fair winds until my next visit."],
 departOk:["Much obliged. Back to dry land."]}},
{id:"petra",name:"Petra",tier:"regular",blurb:"Ceramics artist, always has clay dust somewhere",personality:"shy",
 look:{skin:"#A96A3C",hair:"#26211E",hairstyle:"crop",top:"#8A5A44",accessory:"none",garment:{style:"polo"}},
 usual:"Clay Cloud Latte",
 lines:{arrive:["(brushing dust off) Oh, hello — a clay cloud latte, please. Mid-firing, forgive the mess.","One usual, quietly, please. And a word, if you have one spare."],
 correct:["(small smile) Yes, that's beautifully shaped.","Perfectly formed, that answer.","Just right — no cracks in that reasoning.","Lovely. Fired and finished."],
 wrong:["(gently) Not quite — needs another pass on the wheel.","Oh, close — but it slipped a little.","No matter. Even the kiln has its failures."],
 departGood:["A perfect glaze on that drink, thank you.","I'll bring you a mug next time, promise."],
 departOk:["Thank you. Back to the wheel."]}},
{id:"solomon",name:"Solomon",tier:"regular",blurb:"University porter, knows every student's business",personality:"brisk",
 look:{skin:"#5E3A24",hair:"#171310",hairstyle:"crop",top:"#3E3A4A",accessory:"none",garment:{style:"polo"}},
 usual:"Quad Quencher",
 lines:{arrive:["Morning. Quad Quencher, same as always — and make it quick, gate duty in five.","One usual. Test me — I've heard enough big words from the professors to have a go myself."],
 correct:["Correct! You'd pass the porter's exam, that's for sure.","Right you are — cleared for entry.","Sharp as the new students, you.","Spot on."],
 wrong:["Wrong gate, that one.","Not quite — try the next entrance.","No bother — half the freshers get lost their first week too."],
 departGood:["Best quencher on the whole quad.","Right, back to my post. Ta."],
 departOk:["Cheers anyway. Gate's calling."]}},
{id:"iris",name:"Iris",tier:"regular",blurb:"Weather presenter, narrates her own life like a forecast",personality:"bouncy",
 look:{skin:"#EFC7A2",hair:"#C2622F",hairstyle:"curls",top:"#D8547A",accessory:"none",garment:{style:"tee"}},
 usual:"Sunshine Squall",
 lines:{arrive:["A Sunshine Squall for me — bright with a small chance of chaos, like my morning!","Here's today's forecast: one usual drink, and a word puzzle moving in from the east."],
 correct:["Clear skies! Beautifully correct.","High pressure, sunny outlook — well done!","Right on the money — no clouds in that answer.","Forecast confirmed: brilliant."],
 wrong:["A bit of a downpour on that one.","Unexpected shower — try again.","No matter, even forecasts miss sometimes."],
 departGood:["Sunny with a high chance of returning tomorrow!","Lovely drink — five stars, no rain expected."],
 departOk:["Thanks anyway — off to check the radar."]}},
{id:"benji",name:"Benji",tier:"regular",blurb:"Younger sibling tagging along, over-excited about everything",personality:"bouncy",
 look:{skin:"#E8B88A",hair:"#14100D",hairstyle:"flop",top:"#F2B33D",accessory:"none",garment:{style:"tee"}},
 usual:"Rainbow Splash",
 lines:{arrive:["Ooh can I have the rainbow one?! And can I try the word game too, please please?","Hi! My sister said this place is the best. I want the big drink!"],
 correct:["WOAH you got it right that's SO cool!","Yes yes yes! You're basically a genius!","That was amazing, do another one!","Correct! I'm gonna tell everyone at school!"],
 wrong:["Aww, so close! You'll get the next one, I bet!","Nooo — but that's okay, it was a hard one!","It's fine, everyone gets stuff wrong sometimes!"],
 departGood:["BEST DRINK EVER. Can I come back tomorrow?","Thank you thank you thank you!"],
 departOk:["Okay bye! I'll get it right next time, promise!"]}},
{id:"marigold",name:"Marigold",tier:"regular",blurb:"Beekeeper, always has a faint smell of honey and smoke",personality:"formal",
 look:{skin:"#EFC7A2",hair:"#D8D3CC",hairstyle:"veil",top:"#F2B33D",accessory:"none",garment:{style:"tee"}},
 usual:"Honeycomb Warmer",
 lines:{arrive:["Good day. A Honeycomb Warmer, please — the hives were busy this morning.","One usual. Test me on a word while the bees settle down."],
 correct:["Sweet as honey, that answer!","Well done — the whole hive would be proud.","Precisely right — a golden answer.","Correct! Busy as a bee, that mind of yours."],
 wrong:["A little sting in that one, I'm afraid.","Not quite — the honey hasn't set yet.","No matter, dear. Even bees miss a flower now and then."],
 departGood:["The sweetest drink in the village, this.","I'll bring you a jar of honey next visit."],
 departOk:["Thank you kindly. Back to the hives."]}},
{id:"osei",name:"Osei",tier:"regular",blurb:"Marathon runner, always mid-stretch or mid-snack",personality:"brisk",
 look:{skin:"#6B4226",hair:"#111",hairstyle:"crop",top:"#3BA55C",accessory:"none",garment:{style:"tee"}},
 usual:"Electrolyte Surge",
 lines:{arrive:["Quick one — need to refuel before my next training run!","One usual, please, and a fast question — clock's ticking on my split times."],
 correct:["Personal best! Brilliant answer.","Right on pace — nice one.","Smashed it, no cramping in that logic.","Correct! Straight through the finish line."],
 wrong:["Bit of a stitch on that one.","Missed a stride there — go again.","No bother, even marathoners hit the wall sometimes."],
 departGood:["Best refuel in town, honestly.","Right, back to training. Cheers!"],
 departOk:["Thanks anyway — gotta keep my pace up."]}},
/* ------------- VIP ------------- */
{id:"marchetti",name:"Signora Marchetti",tier:"vip",blurb:"Opera singer between rehearsals, dramatic about everything",personality:"bouncy",
 look:{skin:"#C98A55",hair:"#1E1410",hairstyle:"bun",top:"#B23A5F",accessory:"flower"},
 usual:"Aria Affogato",
 lines:{arrive:["Darling! An Aria Affogato, and make it dramatic — like my next performance!","I have eleven minutes between arias. Astonish me with a word!"],
 correct:["BRAVA! An answer worthy of the encore!","Magnifico! You sing in perfect vocabulary!","Splendido! The critics would weep with joy!","YES! Standing ovation for that answer!"],
 wrong:["Ay, a note flat — but the show must go on!","No, no — but even Callas cracked a note once!","We rehearse until it is perfetto, sì?"],
 departGood:["A drink worthy of the finale! Bravissima!","I shall dedicate my next performance to this café!"],
 departOk:["Hmph — passable. Next time, true drama, sì?"]}},
{id:"whitfield",name:"Lady Whitfield",tier:"vip",blurb:"Retired judge, treats every answer like a verdict",personality:"formal",
 look:{skin:"#EFD0AF",hair:"#C9C9C9",hairstyle:"side",top:"#463A54",accessory:"pearls"},
 usual:"The Chancellor's Chill",
 lines:{arrive:["Good day. The Chancellor's Chill, if you would — and present your case for this next word.","I shall require a swift and correct answer. The court is in session."],
 correct:["The court finds in your favour. Well argued.","Case closed — correctly, might I add.","A verdict of excellence.","Correct. No appeal necessary."],
 wrong:["Overruled. Present a better argument next time.","Case dismissed — try again with stronger evidence.","A minor error in judgment. We shall proceed."],
 departGood:["An exemplary ruling on this drink. Well done.","The court commends this establishment."],
 departOk:["Adequate. I expect improvement by my next visit."]}},
{id:"okonkwo",name:"Chief Okonkwo",tier:"vip",blurb:"Import-export magnate, negotiates even his tea order",personality:"brisk",
 look:{skin:"#5E3A24",hair:"#171310",hairstyle:"crop",top:"#D8A521",accessory:"pocketwatch"},
 usual:"The Merchant's Blend",
 lines:{arrive:["The Merchant's Blend, and let us negotiate this word swiftly — time is capital.","Good day. I trade in words as readily as goods. Show me your finest."],
 correct:["A fair deal, well struck!","Excellent terms on that answer.","Correct — the contract is signed.","Shrewd. Very shrewd indeed."],
 wrong:["A poor bargain, that guess.","The deal falls through — renegotiate.","No matter. Even empires lose a shipment now and then."],
 departGood:["A blend worthy of my finest boardroom!","I shall recommend this port of call to my associates."],
 departOk:["Acceptable margins. I shall return to inspect further."]}},
{id:"delacroix",name:"Madame Delacroix",tier:"vip",blurb:"Perfumer with an extraordinarily precise nose",personality:"formal",
 look:{skin:"#F2D3B0",hair:"#26211E",hairstyle:"bun",top:"#8E6BAE",accessory:"flower"},
 usual:"Bergamot Reverie",
 lines:{arrive:["Ah — a Bergamot Reverie, s'il vous plaît. And let us see if your mind is as precise as my nose.","Good day. I detect potential in you. Prove me correct."],
 correct:["Exquisite! A perfectly balanced answer.","Magnifique! Not a single note out of place.","Correct — as precise as top-note bergamot.","Superbe. My nose approves, and so does my mind."],
 wrong:["Hmm, a discordant note there.","Not quite — the balance is off.","No matter. Even master noses misjudge a blend sometimes."],
 departGood:["A drink as fine as my rarest scent. Magnifique!","I shall wear the memory of this visit like perfume."],
 departOk:["Passable. Refine your craft before I return."]}},
/* ------------- SECRET ------------- */
{id:"cartographer",name:"The Wandering Cartographer",tier:"secret",blurb:"A mapmaker who speaks only in directions and distances",personality:"mysterious",
 look:{skin:"#B9AEC6",hair:"#2A2438",hairstyle:"hood",top:"#5C4033",accessory:"pocketwatch"},
 usual:"the Meridian Mist",
 lines:{arrive:["I have walked many leagues for this word. Pour the Meridian Mist and let us begin.","Every word is a coordinate. Guide me to the right one."],
 correct:["The map is true. Well charted.","North, precisely north — correct.","The path was clear, and you found it.","Marked and mapped. Well done."],
 wrong:["A wrong turning on the map — but the road continues.","Lost, but not for ever. Recalculate.","Even the finest cartographer draws a coastline wrong sometimes."],
 departGood:["A journey worth every step. I shall mark this place on my map.","Until the compass points here again."],
 departOk:["The mist clears, slowly. I shall return."]}},
{id:"clockwinder",name:"The Clockwinder",tier:"secret",blurb:"An old figure who tends the town's clocks and speaks in ticks",personality:"mysterious",
 look:{skin:"#DFA778",hair:"#D9D9D9",hairstyle:"wisps_beard",top:"#274F84",accessory:"pocketwatch",noLash:true,garment:{style:"shirt"}},
 usual:"the Tick-Tock Toddy",
 lines:{arrive:["Tick. Tock. One Toddy, and mind the time on this next word.","Every clock in town keeps my time. Let us see if your mind does too."],
 correct:["Right on the hour. Precisely correct.","The gears align. Well done.","Not a second wasted — correct.","Wound perfectly. Bravo."],
 wrong:["A cog slipped there. Try again.","The clock stutters — but it still turns.","Even old clocks lose a minute now and then."],
 departGood:["Perfectly timed, this visit. I shall wind the church clock in your honour.","Until the hour strikes again."],
 departOk:["The clock ticks on. I shall return at the appointed time."]}}
];

/* Build 42: one optional local-time greeting for every customer.
   These stay separate from ordinary arrival lines so completeness can
   be validated and the contextual line can remain occasional rather
   than replacing a character's normal dialogue. */
const CUSTOMER_TIME_GREETINGS = {
  "vampire": {
    "morning": "I stayed up far too late. One berry juice before my coffin, please.",
    "afternoon": "The curtains are firmly closed, so I can enjoy a quiet drink.",
    "night": "Good eeevening. At last, a sensible hour for juice and words."
  },
  "witch": {
    "morning": "My cauldron has only just started bubbling. Tea first, spells later.",
    "afternoon": "A little potion break will keep the afternoon magic flowing.",
    "night": "The moon is up and the coven is busy. Time for a proper brew."
  },
  "robot": {
    "morning": "MORNING START-UP COMPLETE. REQUESTING FIRST SMOOTHIE OF THE DAY.",
    "afternoon": "MIDDAY POWER LEVELS: LOW. SMOOTHIE INPUT RECOMMENDED.",
    "night": "NIGHT MODE ACTIVATED. CAFÉ LIGHTS: PLEASING. BEEP."
  },
  "scientist": {
    "morning": "Fresh morning, fresh hypothesis. Let us begin with Formula No. 7.",
    "afternoon": "My afternoon data needs one more delicious sample.",
    "night": "The lab is quiet at last. Perfect conditions for a late experiment."
  },
  "astronaut": {
    "morning": "Sunrise from the ground is lovely too. One star smoothie, please.",
    "afternoon": "Mission break approved. I have time for one Earth drink.",
    "night": "The sky looks almost like home from here. Smoothie, please."
  },
  "pirate": {
    "morning": "Morning tide is turning, matey. A lime fizz for the voyage!",
    "afternoon": "The sun is high and me treasure map says refreshments be here.",
    "night": "Stars above, compass steady — and one seaworthy fizz, please."
  },
  "wizard": {
    "morning": "The first light is excellent for reading ancient scrolls.",
    "afternoon": "A wise wizard pauses before the next chapter. An elixir, please.",
    "night": "The stars are bright, and so is the promise of a good word."
  },
  "knight": {
    "morning": "A noble morning begins with honour, courage and honey tea.",
    "afternoon": "My quest has been long. A courteous refreshment would help.",
    "night": "The castle gates will wait. This warm light is most welcoming."
  },
  "hero": {
    "morning": "Morning patrol complete! Time to recharge my superpowers.",
    "afternoon": "The city is safe for six whole minutes. Smoothie time!",
    "night": "Night patrol starts soon, so make this one extra heroic!"
  },
  "alien": {
    "morning": "Earth mornings are shiny! Is this when humans drink green juice?",
    "afternoon": "Your daytime star is very warm. Zib requires a cool drink.",
    "night": "Earth night lights are tiny stars indoors. Zib likes this!"
  },
  "ninja": {
    "morning": "The streets are quiet. A silent matcha before training, please.",
    "afternoon": "A brief pause between missions. No one saw me enter.",
    "night": "Shadows are useful. So is a warm cup after a long mission."
  },
  "king": {
    "morning": "A fine morning to leave the throne room and visit my favourite bar.",
    "afternoon": "Royal duties may wait for one refreshing ruby juice.",
    "night": "The castle lamps are lit, but your café feels warmer still."
  },
  "queen": {
    "morning": "Good morning, dear. A gentle honey tea would be delightful.",
    "afternoon": "A gracious pause is just what this busy day requires.",
    "night": "These golden lights are quite lovely. My usual tea, please."
  },
  "viking": {
    "morning": "The dawn wind is mighty! I need a mighty smoothie to match.",
    "afternoon": "I have explored all day and conquered absolutely no snacks yet.",
    "night": "A warm café after a cold voyage — now that is true treasure!"
  },
  "mummy": {
    "morning": "Morning already? I have only been asleep for four thousand years.",
    "afternoon": "A quiet cup might help me unwrap this sleepy afternoon.",
    "night": "Ah, much better. The night and I are old friends."
  },
  "pharaoh": {
    "morning": "The sun rises over my kingdom. Bring forth the golden smoothie.",
    "afternoon": "Even a ruler of the sands requires a cool pause.",
    "night": "The desert stars are awake. Let the golden drink shine too."
  },
  "baller": {
    "morning": "Early practice is done. Time for a championship smoothie!",
    "afternoon": "Quick timeout! I need a three-point refreshment.",
    "night": "One last shot before I head home — make it a winner!"
  },
  "striker": {
    "morning": "First training session finished! I am ready for a banana shake.",
    "afternoon": "Half-time break, please — I have been running all day.",
    "night": "The floodlights are on. One final fuel-up before the whistle."
  },
  "linebacker": {
    "morning": "Morning workout complete. I have earned an end-zone smoothie.",
    "afternoon": "Time for a friendly huddle around something cold and tasty.",
    "night": "The stadium lights are bright, but this café feels cosier."
  },
  "okafor": {
    "morning": "Good morning, dear. Shall we wake our minds with a word?",
    "afternoon": "A little afternoon practice keeps every mind growing.",
    "night": "It is lovely to finish the day somewhere so cheerful."
  },
  "callum": {
    "morning": "Morning post is nearly sorted — just a quick cooler, please!",
    "afternoon": "Busy round today. I have exactly one minute for something minty.",
    "night": "Last letters delivered! Now I can finally slow down."
  },
  "yuki": {
    "morning": "Good morning! What do people usually order this early?",
    "afternoon": "I learned three new things today. Maybe this puzzle makes four!",
    "night": "The café looks different under the lights. I like it!"
  },
  "dave": {
    "morning": "Van is loaded, back is stretched — lemonade next.",
    "afternoon": "That sofa was heavier than it looked. I need a proper break.",
    "night": "Job done at last. Something pink and cold, cheers."
  },
  "agnes": {
    "morning": "A peaceful morning deserves warm honey and a little patience.",
    "afternoon": "I have just remembered another story. Tea will help me tell it.",
    "night": "The day has been kind. Let us end it with something warm."
  },
  "kofi": {
    "morning": "A crisp morning calls for a drink with equally fine tailoring.",
    "afternoon": "My stitches are precise, but even precision needs a pause.",
    "night": "The evening light suits this café beautifully. Very elegant."
  },
  "elowen": {
    "morning": "The library is quiet at this hour. I brought my book with me.",
    "afternoon": "I am between chapters and ready for a small apple break.",
    "night": "A cosy light, a good book and one Apple Zing. Perfect."
  },
  "tam": {
    "morning": "Sea was calm at dawn. Let us see if the drinks are stronger.",
    "afternoon": "Sun is high, nets are dry and I am thirsty, lass.",
    "night": "Reminds me of the harbour lights. Pour whatever has backbone."
  },
  "maya": {
    "morning": "I am awake, technically. Blue slush might make it official.",
    "afternoon": "Revision break! My brain has reached maximum tabs open.",
    "night": "One last study snack before I log off. Probably."
  },
  "contessa": {
    "morning": "A fresh day needs a fresh step — and a passionfruit twirl!",
    "afternoon": "The studio is dancing without me for five minutes. Make it count!",
    "night": "The music has slowed, but I still have one perfect turn left."
  },
  "steinberg": {
    "morning": "Morning calibration complete. Beverage temperature must be exact.",
    "afternoon": "A scheduled maintenance break. Three minutes, no wobble.",
    "night": "The workshop is closed. Precision, however, never sleeps."
  },
  "priyanka": {
    "morning": "Early clinic, long queue. Mango first, questions second.",
    "afternoon": "Lunch break, finally. Please make this one efficient.",
    "night": "Last patient seen. Now I can take one proper breath."
  },
  "devereux": {
    "morning": "Good morning. Let us begin today with a properly prepared answer.",
    "afternoon": "Consider this a brief midterm assessment — with elderflower.",
    "night": "The school bell is long silent. Your lesson may now begin."
  },
  "fox": {
    "morning": "When the sun finds the window, which word finds the tongue?",
    "afternoon": "Half the day has wandered by. Shall we chase a riddle?",
    "night": "The lamps glow, the shadows know, and the clever answer waits."
  },
  "adeyemi": {
    "morning": "The earliest words often have the clearest roots. Shall we test one?",
    "afternoon": "An afternoon pause is ideal for a small linguistic puzzle.",
    "night": "Language never sleeps; it merely changes its register."
  },
  "owl": {
    "morning": "…The night is ending. One final word before I disappear.",
    "afternoon": "…Unusual hours for an owl. Your streak summoned me anyway.",
    "night": "…The hour is right. Show me what the darkness taught you."
  },
  "nora": {
    "morning": "Good morning! I have already tied six tiny shoelaces today.",
    "afternoon": "Nap time is over for everyone except me, apparently.",
    "night": "The little ones are home, and the café is wonderfully calm."
  },
  "desmond": {
    "morning": "First bus used to leave at six sharp. I still wake up for it.",
    "afternoon": "Traffic is building, but I know a quiet route to this counter.",
    "night": "Last bus home soon. Plenty of time for a Route 47 Cooler."
  },
  "freya": {
    "morning": "The puppies were up before sunrise. I deserve a berry break.",
    "afternoon": "Busy surgery today — three paws, one wing and lots of cuddles.",
    "night": "All the animals are settled. Now it is my turn to relax."
  },
  "clive": {
    "morning": "Dew on the cabbages this morning. Lovely growing weather.",
    "afternoon": "The tomatoes can manage without me for one short drink.",
    "night": "Tools are put away and the allotment is quiet at last."
  },
  "ruth": {
    "morning": "Let us begin the day on a bright, clear note.",
    "afternoon": "The choir needs a rest between verses, and so do I.",
    "night": "The café lights give this moment a lovely closing chord."
  },
  "baxter": {
    "morning": "First delivery done! I am only slightly out of breath.",
    "afternoon": "The hills feel steeper after lunch. Zinger, please!",
    "night": "Bike locked, route finished, legs officially off duty."
  },
  "wendy": {
    "morning": "Someone donated a beautiful teapot before we even opened.",
    "afternoon": "The shop has been full of stories today. I brought one with me.",
    "night": "We closed up neatly. A violet fizz would be a lovely finish."
  },
  "gustav": {
    "morning": "Dawn watch complete. Steady course for the drinks counter.",
    "afternoon": "Sun over the yardarm — entirely suitable for a cool storm.",
    "night": "Harbour lights ahead. Bring her alongside for one last drink."
  },
  "petra": {
    "morning": "The clay is still cool and quiet. I like mornings like this.",
    "afternoon": "My hands need a break from shaping bowls. Latte, please.",
    "night": "The kiln is glowing and so are the café lights. Beautiful."
  },
  "solomon": {
    "morning": "First student already lost a key. A promising start to the day.",
    "afternoon": "The quad is busy, and I know exactly who skipped their lecture.",
    "night": "Campus is quiet now. Almost too quiet, if you ask me."
  },
  "iris": {
    "morning": "Forecast: bright start, rising chance of a delicious drink.",
    "afternoon": "Current conditions: busy, warm and in need of refreshment.",
    "night": "Tonight brings calm skies and a strong chance of café lights."
  },
  "benji": {
    "morning": "GOOD MORNING! I have been awake for ages and ages!",
    "afternoon": "I did so many things today! Want to hear all of them?",
    "night": "The lights are AWESOME. Can my drink sparkle too?"
  },
  "marigold": {
    "morning": "The hives were humming before breakfast. Busy little things.",
    "afternoon": "The bees are gathering the last of the warm-day nectar.",
    "night": "The hives are settled. A honey warmer sounds just right."
  },
  "osei": {
    "morning": "Early miles done. My legs are awake even if I am not.",
    "afternoon": "Long run, quick stop — I need to refuel and keep moving.",
    "night": "Training finished. Time to stretch, drink and slow the pace."
  },
  "marchetti": {
    "morning": "Buongiorno! Even my warm-up scales require dramatic refreshment!",
    "afternoon": "Intermission! Eleven minutes until the next magnificent aria.",
    "night": "The curtain has fallen, darling, but I still have an encore in me!"
  },
  "whitfield": {
    "morning": "Good morning. The court will begin after one chilled drink.",
    "afternoon": "Proceedings are briefly adjourned for refreshment.",
    "night": "The final verdict of the day may be delivered in comfort."
  },
  "okonkwo": {
    "morning": "The markets have opened. Let us make our first good decision.",
    "afternoon": "A brief pause between negotiations may improve the next deal.",
    "night": "Business is concluded. Now we may discuss flavour without haste."
  },
  "delacroix": {
    "morning": "The morning air has such delicate notes. Bergamot will suit it.",
    "afternoon": "The day has warmed; a precise, bright blend is required.",
    "night": "Warm lamps, cool air, and one elegant final fragrance."
  },
  "cartographer": {
    "morning": "Dawn lies east. My route lies directly toward the Meridian Mist.",
    "afternoon": "The sun marks the middle path. Let us chart one more word.",
    "night": "North by starlight, then three steps to this welcoming counter."
  },
  "clockwinder": {
    "morning": "Tick. Six o’clock passed cleanly. The day is properly wound.",
    "afternoon": "Tock. The long hand says it is time for a small pause.",
    "night": "Tick. Tock. The town grows quiet, but the clocks keep watch."
  }
};
for(const customer of CUSTOMERS){
  /* Build 49 startup hotfix: new themed customers already carry their
     three greetings inline. Prefer those authored lines, then fall back
     to the legacy central table used by the original customer roster. */
  const inlineGreetings=customer.timeGreeting;
  const inlineValid=inlineGreetings&&["morning","afternoon","night"].every(
    k=>typeof inlineGreetings[k]==="string"&&inlineGreetings[k].trim()
  );
  const greetings=inlineValid?inlineGreetings:CUSTOMER_TIME_GREETINGS[customer.id];
  if(!greetings||!["morning","afternoon","night"].every(k=>typeof greetings[k]==="string"&&greetings[k].trim())){
    throw new Error(`Missing time greeting for customer: ${customer.id}`);
  }
  customer.timeGreeting=Object.freeze({...greetings});
}

/* The Curator — narrator for milestones, not a customer. */
const CURATOR = {name:"The Curator",lines:{
 levelup:["A new chapter for the little bar. Beautifully earned.","The shelves remember every word you've mastered. So do I.","Another milestone, carefully made. Do go on."],
 unlock:["Something new for your collection. It suits the place.","The bar grows lovelier — as does your vocabulary."]}};

/* Pets — randomly paired per spawn; purely reactive, never affect
   scoring. Sounds are short synthesized cues (see AudioKit). Now
   tappable directly for their own little reaction — the "surprise"
   delight moment, independent of the question flow. */
const PETS = [
{id:"dog",species:"dog",name:"a friendly café dog",colors:["#C99252","#F4E3D0"]},
{id:"cat",species:"cat",name:"a curious café cat",colors:["#9A7B5A","#F2E6D0"]},
{id:"pug",species:"pug",name:"a snorty wrinkled pug",colors:["#D8B98C","#4A4038"]},
{id:"pugclassic",species:"pugclassic",name:"a round little pug",colors:["#D8B98C","#4A4038"]},
{id:"parrot",species:"parrot",name:"a chatty parrot",colors:["#3BA55C","#E04B3A"]},
{id:"rabbit",species:"rabbit",name:"a calm grey rabbit",colors:["#A8A2B0","#8C8494"]},
{id:"lion",species:"lion",name:"a cuddly little lion",colors:["#E3B23C","#B5793F"]},
{id:"pigeon",species:"pigeon",name:"a plump city pigeon",colors:["#8C93A8","#5C6B73"]},
{id:"chicken",species:"chicken",name:"a curious café chicken",colors:["#C97B4A","#E04B3A"]},
{id:"duck",species:"duck",name:"a waddling white duck",colors:["#F4F0E8","#F2B33D"]},
{id:"koala",species:"koala",name:"a sleepy grey koala",colors:["#B3ACB8","#8C8494"]},
{id:"redpanda",species:"redpanda",name:"a bright-eyed red panda",colors:["#C2622F","#F4E3D0"]},
{id:"panda",species:"panda",name:"a roly-poly panda cub",colors:["#F4F0E8","#2E2A36"]},
{id:"penguin",species:"penguin",name:"a dapper little penguin",colors:["#2E2A36","#F4F0E8"]},
{id:"raccoon",species:"raccoon",name:"a cheeky masked raccoon",colors:["#8C93A8","#3E3A4A"]},
{id:"pig",species:"pig",name:"a happy pink piglet",colors:["#F2B8C6","#E07A9B"]},
{id:"squirrel",species:"squirrel",name:"a zippy red squirrel",colors:["#C97B4A","#8A5A2E"]},
{id:"dachshund",species:"dachshund",name:"a long little dachshund",colors:["#8A5A2E","#5C3A1E"]},
{id:"tiger",species:"tiger",name:"a magnificent tiger cub",colors:["#E8891D","#2E2A36"]},
{id:"corgi",species:"corgi",name:"a cheerful little corgi",colors:["#D58A4A","#F4E3D0"]},
{id:"hollandlop",species:"hollandlop",name:"a floppy-eared holland lop",colors:["#C9A987","#F7F1E6"]},
{id:"meerkat",species:"meerkat",name:"a curious meerkat",colors:["#B98A58","#EBD5B8"]},
{id:"capybara",species:"capybara",name:"a relaxed capybara",colors:["#A8764A","#DDB890"]},
{id:"otter",species:"otter",name:"a playful river otter",colors:["#8C6038","#D9C0A2"]},
{id:"gorilla",species:"gorilla",name:"a gentle gorilla",colors:["#5A5260","#A9A3AE"]},
{id:"owl2",species:"owl",name:"a wise little owl",colors:["#8A6B4A","#EAD9BC"]},
{id:"zebra",species:"zebra",name:"a stripey zebra foal",colors:["#F4F0E8","#2E2A36"]},
{id:"monkey",species:"monkey",name:"a cheeky monkey",colors:["#8C5A32","#E0BD97"]},
{id:"hippo",species:"hippo",name:"a chubby baby hippo",colors:["#9A909E","#C8C0CA"]},
{id:"bat",species:"bat",name:"a tiny dusk bat",colors:["#5A4C62","#8B7D96"]},
{id:"frog",species:"frog",name:"a bouncy green frog",colors:["#78A84A","#D7F0A0"]},
{id:"prairiedog",species:"prairiedog",name:"a pop-up prairie dog",colors:["#B2875D","#E1C5A3"]},
{id:"warthog",species:"warthog",name:"a snuffly young warthog",colors:["#8E7A68","#D6C2A8"]},
{id:"aardvark",species:"aardvark",name:"a long-snouted aardvark",colors:["#B3A29A","#DCCBC3"]},
{id:"lemur",species:"lemur",name:"a ring-tailed lemur",colors:["#BFC0C8","#2E2A36"]},
{id:"loris",species:"loris",name:"a big-eyed loris",colors:["#C7A86A","#F0D9AF"]},
{id:"kinkajou",species:"kinkajou",name:"a honey-loving kinkajou",colors:["#C79654","#F0D19F"]},
{id:"mongoose",species:"mongoose",name:"a quick little mongoose",colors:["#B18860","#E0C19A"]},
{id:"ferret",species:"ferret",name:"a wriggly ferret",colors:["#E5D6BA","#8A5A32"]},
{id:"jumpingrat",species:"jumpingrat",name:"a hopping rat",colors:["#B49B84","#F2E6D0"]},
{id:"llama",species:"llama",name:"a fluffy llama",colors:["#D9C5B2","#8C6A52"]},
{id:"badger",species:"badger",name:"a sturdy little badger",colors:["#BFC2C8","#2E2A36"]},
{id:"pinemarten",species:"pinemarten",name:"a bright-eyed pine marten",colors:["#8A5A32","#E8C48A"]},
{id:"dodo",species:"dodo",name:"a cuddly little dodo",colors:["#B9B7C0","#D8C7A0"]},
{id:"greatauk",species:"greatauk",name:"a solemn great auk",colors:["#2E2A36","#F4F0E8"]},
{id:"seacow",species:"seacow",name:"a gentle sea cow",colors:["#9CA6A8","#C9D2D3"]},
{id:"wombat",species:"wombat",name:"a barrelly wombat",colors:["#8B786A","#D9C0A8"]},
{id:"raccoondog",species:"raccoondog",name:"a fluffy raccoon dog",colors:["#A28466","#E7D4BC"]},
{id:"sandcat",species:"sandcat",name:"a sandy desert cat",colors:["#D6B37C","#F0DEC0"]},
{id:"ocelot",species:"ocelot",name:"a spotted ocelot kitten",colors:["#D9A15A","#5A4028"]},
{id:"sloth",species:"sloth",name:"a sleepy sloth",colors:["#9B8A76","#D8C8B0"]},
{id:"snowleopard",species:"snowleopard",name:"a snowy leopard cub",colors:["#D6D9DE","#F0F2F5"]}
];
const PET_REACT = {
 dog:{good:"gives a happy bark and a furious tail-wag!",bad:"tilts its head with a soft, sympathetic whine.",tap:"bounds over for a scratch behind the ears!"},
 cat:{good:"purrs a pleased chirrup and gives a slow, approving blink.",bad:"flicks its tail and turns away, unimpressed. Cats.",tap:"headbutts your hand and starts purring loudly."},
 parrot:{good:"whistles two bright notes and bobs along its perch!",bad:"ruffles its feathers and mutters something.",tap:"does a little sideways dance and whistles!"},
 rabbit:{good:"does a joyful little binky hop!",bad:"thumps a foot softly and settles down.",tap:"does a happy binky-hop right on the spot!"},
 lion:{good:"lets out a tiny, extremely proud roar!",bad:"gives a small grumbly harrumph and flops down.",tap:"nuzzles you with its fluffy mane. Mighty AND soft."},
 pigeon:{good:"puffs up its chest and coos triumphantly!",bad:"pecks thoughtfully at the floor.",tap:"does a proud little strut in a circle. Coo!"},
 chicken:{good:"flaps up onto the counter with a delighted BUK-KAW!",bad:"scratches at the floor and clucks quietly.",tap:"tilts its head at you, then clucks approvingly."},
 duck:{good:"quacks twice and does a happy tail-waggle!",bad:"gives one flat, unimpressed quack.",tap:"waddles a joyful lap around your feet. Quack!"},
 koala:{good:"opens one eye and gives a slow, delighted blink!",bad:"yawns enormously and goes back to sleep.",tap:"hugs your arm like a eucalyptus branch. So soft."},
 redpanda:{good:"stands up tall with both paws in the air — victory pose!",bad:"hides its face behind its fluffy tail.",tap:"does its famous stand-up wobble. Adorable AND fearsome."},
 panda:{good:"does a celebratory roly-poly right across the counter!",bad:"flops over backwards dramatically.",tap:"rolls onto its back for tummy pats. Irresistible."},
 penguin:{good:"flaps its flippers and does a triumphant belly-slide!",bad:"stares at the floor with maximum dignity.",tap:"waddles a proud little circle and bows. Very formal."},
 raccoon:{good:"claps its clever little hands together with glee!",bad:"pretends it wasn't watching. It was definitely watching.",tap:"tries to wash your hand in an imaginary stream. Helpful!"},
 pig:{good:"oinks with delight and does a happy mud-free wiggle!",bad:"gives a long, world-weary snort.",tap:"leans against your leg and oinks contentedly."},
 squirrel:{good:"does three lightning-fast laps of the counter!",bad:"freezes dramatically mid-scamper.",tap:"stuffs an imaginary acorn in its cheek and winks."},
 pug:{good:"snorts with joy and does a full-body wiggle!",bad:"gives a long, dramatic snork of disappointment.",tap:"snuffles your hand and grumbles happily. Snork!"},
 classicpug:{good:"snorts proudly and wags its curly tail!",bad:"gives one tiny, puzzled snuffle.",tap:"rolls over for a tummy rub, then sneezes happily."},
 dachshund:{good:"zooms a lap of the counter, ears flying like flags!",bad:"lies down flat — the LONGEST sulk in the café.",tap:"trots over proudly, very long and very pleased about it."},
 tiger:{good:"lets out a proud little chuff and swishes its striped tail!",bad:"gives a grumpy rumble and licks a paw pointedly.",tap:"rubs its head against you like the world's biggest kitten."}};

/* Tap-only replies retained as flavour text auto-selected after
   an answer (no longer a tap-to-continue gate — the flow now
   auto-advances; see resolveAnswer). */
const PLAYER_REPLIES = {
 good:["Thanks so much!","All part of the service! 😊","Enjoy your drink! 🍹"],
 bad:["I'll get it right next time!","I'll keep practising! 🙏","One to practise — noted! 📝"]};

/* Permanent player-pet anchors. The values use the café SVG's
   360×200 coordinate system plus a percentage bottom for the live
   overlay. Each theme has its own entry so future scene art can be
   tuned without one-off CSS exceptions. */
const PET_CAFE_LAYOUTS = {
 /* Build 81: the live café pet moves into a companion lane at 27%,
    visibly beside the 11% barista and clear of the 48% serving lane.
    Menu previews retain the balanced 61% pet / right-hand barista
    composition. All six themes share the same horizontal anchors;
    Food Truck differs only in its grass-level vertical grounding. */
 sunny:{svgX:97,previewSvgX:218,stageBottom:8.4,previewBottom:12.5,scale:.92},
 spring:{svgX:97,previewSvgX:218,stageBottom:8.4,previewBottom:12.5,scale:.92},
 halloween:{svgX:97,previewSvgX:218,stageBottom:8.4,previewBottom:12.5,scale:.90},
 christmas:{svgX:97,previewSvgX:218,stageBottom:8.4,previewBottom:12.5,scale:.91},
 kyoto:{svgX:97,previewSvgX:218,stageBottom:8.4,previewBottom:12.5,scale:.90},
 foodtruck:{svgX:97,previewSvgX:218,stageBottom:7.8,previewBottom:12.0,scale:.86}
};


/* Drinks and visual tokens for the six café themes. Each additional
   theme now unlocks after another 2,000 lifetime tips: 0 / 2,000 /
   4,000 / 6,000 / 8,000 / 10,000. Previously revealed themes are
   grandfathered by the Settings UI so an upgrade never removes a
   café the child had already earned. `ambient` names a lightweight CSS particle
   effect used by the stage. Kyoto carries Japanese-influenced
   detail (lantern glow + drifting maple leaves), while Sunny keeps
   its own distinct free-theme identity. */
const THEMES = {
 sunny:{name:"Sunny Corner",unlock:0,wall:"#F6E3C2",floor:"#E5C89A",counter:"#C98A55",accent:"#D8547A",window:"day",ambient:"dust",lighting:{daySky:"#BEE3F0",nightSky:"#172640",nightWash:"#25324A",nightOpacity:.15,lamp:"#FFD58A"},
  drinks:["Sunrise Fizz","Berry Whirl","Mango Cloud","Minty Cooler","Lemon Sparkle","Peach Dream","Apple Zing","Coco Breeze"]},
 spring:{name:"Blossom Season",unlock:3000,wall:"#F9E8EE",floor:"#E8D3BC",counter:"#C9899A",accent:"#E07A9B",window:"blossom",ambient:"petals",lighting:{daySky:"#F9DCE6",nightSky:"#292442",nightWash:"#352847",nightOpacity:.14,lamp:"#FFD0A2"},
  drinks:["Blossom Lemonade","Strawberry Petal","Honey Dew Drop","Garden Mint Spritz","Rhubarb Ribbon"]},
 halloween:{name:"Pumpkin Nights",unlock:6000,wall:"#4A3B52",floor:"#6E5636",counter:"#8A4A1E",accent:"#E8891D",window:"night",ambient:"embers",lighting:{daySky:"#D9BCA0",nightSky:"#1F1930",nightWash:"#20172E",nightOpacity:.12,lamp:"#FFB347"},
  drinks:["Pumpkin-Spice Swirl","Ghostly Grape Fizz","Cauldron Cooler","Toffee-Apple Mist","Blackberry Bat Juice"]},
 christmas:{name:"Winter Lights",unlock:9000,wall:"#F0E8E0",floor:"#C9B8A0",counter:"#7A3B3B",accent:"#B23A3A",window:"snow",ambient:"snow",lighting:{daySky:"#DCE8F0",nightSky:"#1D2B46",nightWash:"#26354B",nightOpacity:.15,lamp:"#FFE4A3"},
  drinks:["Gingerbread Steamer","Peppermint Snow","Cranberry Twinkle","Spiced Orange Glow","Snowball Smoothie"]},
 kyoto:{name:"Kyoto Counter",unlock:12000,wall:"#EFE8D8",floor:"#B89B78",counter:"#6E5636",accent:"#C25B5B",window:"lantern",ambient:"maple",lighting:{daySky:"#F4D8A8",nightSky:"#202941",nightWash:"#2D2A3E",nightOpacity:.14,lamp:"#FFBF67"},
  drinks:["Matcha Cloud","Yuzu Sparkle","Sakura Cream","Plum Blossom Soda","Toasted Rice Cooler"]},
 foodtruck:{name:"Park Food Truck",unlock:15000,wall:"#F6EEDC",floor:"#9CBF7E",counter:"#E04B3A",accent:"#F2B33D",window:"day",ambient:"maple",lighting:{daySky:"#A9D8F2",nightSky:"#173052",nightWash:"#23344A",nightOpacity:.13,lamp:"#FFD56B"},
  drinks:["Vanilla Shake","Strawberry Shake","Park Lemonade","Rocket Slushie","Banana Split Float","Choc-Malt Shake"]}
};

/* ---- Drinks board ----
   It's a drinks bar, not just juice: every ticket now gets a drink
   KIND (coffee / tea / juice / smoothie / fizz) with its own cup
   shape and a randomly-picked colour from that kind's palette.
   Kinds are loosely paired to customer personality (a formal
   customer leans tea, a brisk one leans coffee...), and about half
   the time a customer simply orders their own stated "usual" —
   so drinks feel personal, varied and colourful. */
/* ---- Food menu ----
   Build 68 starts with three simple foods. Burger, Hot Dog and the
   other Kitchen recipes join the eligible pool only after the current
   profile unlocks them; the overall food-ticket probability stays at
   about 45% (75% in the Park Food Truck theme). ---- */
const FOOD_KINDS = {
 hotdog:{emoji:"🌭", names:["Classic Hot Dog","Cheesy Hot Dog","Crispy-Onion Hot Dog"], color:"#C97B4A"},
 chips:{emoji:"🍟", names:["Golden Chips","Salt & Vinegar Chips","Cheesy Chips"], color:"#F2B33D"},
 churros:{emoji:"🥨", names:["Cinnamon Churros","Chocolate-Dip Churros","Sugar-Dust Churros"], color:"#C9924E"},
 burger:{emoji:"🍔", names:["Mini Burger","Cheese Burger","Veggie Garden Burger"], color:"#B5793F"},
 icecream:{emoji:"🍦", flavors:[["Strawberry","#F2A3B8"],["Mint-Choc","#9CD6B8"],["Chocolate","#8A5A3A"],["Vanilla","#F7EFD8"],["Blueberry","#8E9CD6"],["Toffee Swirl","#D9A05B"]]},
 pizza:{emoji:"🍕",names:["Garden Pizza","Cheesy Pizza","Tomato Pizza"],color:"#D96C4A"},
 fishchips:{emoji:"🐟",names:["Fish and Chips","Crispy Fish and Chips"],color:"#E8C35A"},
 chickenwings:{emoji:"🍗",names:["Crispy Chicken Wings","Honey Chicken Wings"],color:"#C97B4A"},
 pasta:{emoji:"🍝",names:["Tomato Pasta","Creamy Garden Pasta"],color:"#D86D4C"},
 sandwich:{emoji:"🥪",names:["Garden Sandwich","Cheese and Tomato Sandwich"],color:"#D9B970"},
 croissant:{emoji:"🥐",names:["Butter Croissant","Honey Croissant"],color:"#D99A45"},
 muffin:{emoji:"🧁",names:["Blueberry Muffin","Chocolate Muffin"],color:"#B98A67"},
 cookie:{emoji:"🍪",names:["Chocolate Chip Cookie","Oat Cookie"],color:"#B97B45"},
 ramen:{emoji:"🍜",names:["Cosy Ramen","Veggie Ramen"],color:"#D8A23E"},
 sushi:{emoji:"🍣",names:["Sushi Plate","Salmon Sushi"],color:"#E48D75"},
 dumplings:{emoji:"🥟",names:["Steamed Dumplings","Veggie Dumplings"],color:"#EED6A8"},
 curryrice:{emoji:"🍛",names:["Curry Rice","Mild Vegetable Curry Rice"],color:"#D6A03A"},
 roastchicken:{emoji:"🍗",names:["Roast Chicken","Herb Roast Chicken"],color:"#B87343"},
 maccheese:{emoji:"🧀",names:["Macaroni Cheese","Golden Macaroni Cheese"],color:"#F0BD45"},
 jacketpotato:{emoji:"🥔",names:["Jacket Potato","Cheesy Jacket Potato"],color:"#A86B3C"},
 /* Build 86g-phase11 · Integration A café renderers. Colours are sampled
    from each dish's own finished.svg so the sprite tint matches its art. */
 omelette:{emoji:"🍳",names:["Cheese Omelette","Garden Omelette","Fluffy Omelette"],color:"#F2B33D"},
 pancakes:{emoji:"🥞",names:["Stack of Pancakes","Berry Pancakes","Honey Pancakes"],color:"#E9AA57"},
 waffles:{emoji:"🧇",names:["Golden Waffles","Berry Waffles","Honey Waffles"],color:"#E9AA57"},
 eggsoldiers:{emoji:"🥚",names:["Boiled Egg & Soldiers","Dippy Egg & Soldiers"],color:"#F2B33D"},
 eggsbenedict:{emoji:"🥚",names:["Eggs Benedict","Classic Eggs Benedict"],color:"#F6C96E"},
 cornoncob:{emoji:"🌽",names:["Corn on the Cob","Buttery Corn on the Cob","Herb Corn on the Cob"],color:"#F5C84B"},
 pretzel:{emoji:"🥨",names:["Salted Pretzel","Warm Pretzel","Soft Pretzel"],color:"#A9714C"},
 vegetableskewers:{emoji:"🍢",names:["Vegetable Skewers","Grilled Vegetable Skewers","Glazed Vegetable Skewers"],color:"#C94F45"},
 curryfishballs:{emoji:"🍢",names:["Curry Fish Balls","Hong Kong Curry Fish Balls"],color:"#D9941E"},
 eggwaffle:{emoji:"🧇",names:["Egg Waffle","Hong Kong Egg Waffle","Golden Egg Waffle"],color:"#FFD978"},
 siumai:{emoji:"🥟",names:["Siu Mai","Steamed Siu Mai"],color:"#D8A95B"},
 threetreasures:{emoji:"🍆",names:["Three Fried Stuffed Treasures","Stuffed Three Treasures"],color:"#69A35B"},
 /* Build 86g-phase12 · Integration B café renderers. */
 tomatosoup:{emoji:"🍲",names:["Tomato Soup","Creamy Tomato Soup","Garden Tomato Soup"],color:"#DB6255"},
 bakedsalmon:{emoji:"🐟",names:["Baked Salmon","Lemon Baked Salmon","Herb Baked Salmon"],color:"#C9783F"},
 stuffedpepper:{emoji:"🫑",names:["Stuffed Pepper","Rice & Bean Stuffed Pepper","Cheesy Stuffed Pepper"],color:"#C94F45"},
 lasagne:{emoji:"🍝",names:["Lasagne","Cheesy Lasagne","Garden Lasagne"],color:"#B86446"},
 shepherdspie:{emoji:"🥧",names:["Shepherd’s Pie","Golden Shepherd’s Pie"],color:"#D9A76C"},
 quichelorraine:{emoji:"🥧",names:["Quiche Lorraine","Slice of Quiche Lorraine"],color:"#D99C4C"},
 eggfriedrice:{emoji:"🍚",names:["Egg Fried Rice","Veggie Egg Fried Rice"],color:"#E4B45E"},
 padthai:{emoji:"🍜",names:["Pad Thai","Prawn Pad Thai","Veggie Pad Thai"],color:"#E8B660"},
 chickenkatsu:{emoji:"🍛",names:["Chicken Katsu","Crispy Chicken Katsu"],color:"#D99B3B"},
 prawntempura:{emoji:"🍤",names:["Prawn Tempura","Crispy Prawn Tempura"],color:"#F8D984"},
 springrolls:{emoji:"🥢",names:["Spring Rolls","Crispy Spring Rolls","Veggie Spring Rolls"],color:"#F0C775"},
 paella:{emoji:"🥘",names:["Paella","Seafood Paella","Garden Paella"],color:"#F5CF55"},
 applepie:{emoji:"🥧",names:["Apple Pie","Slice of Apple Pie","Warm Apple Pie"],color:"#E6B35E"},
 chocolatebrownie:{emoji:"🍫",names:["Chocolate Brownie","Warm Chocolate Brownie","Chocolate Chunk Brownie"],color:"#734838"},
 chocolateeclair:{emoji:"🍫",names:["Chocolate Éclair","Cream-Filled Éclair"],color:"#7A5140"},
 cinnamonroll:{emoji:"🥐",names:["Cinnamon Roll","Iced Cinnamon Roll","Warm Cinnamon Roll"],color:"#E6B35E"},
 doughnut:{emoji:"🍩",names:["Doughnut","Iced Doughnut","Pink Doughnut"],color:"#E98D9C"}
};

/* Kitchen collection data. Build 83 gives every one of the 25 food and
   drink families its own researched seven-step recipe. Coffee, Tea and
   Juice remain immediately available, but can now be prepared in Kitchen
   like the existing classic foods. The 19 unlock challenges are unchanged. */
const KITCHEN_TEMPLATES = Object.freeze({
 oven:{name:"Oven",steps:["🌾","🥣","🥄","🧂","🔥","✨","🔔"],labels:["Base","Mix","Shape","Season","Bake","Garnish","Reveal"]},
 fryer:{name:"Fryer",steps:["🥣","🧂","🧺","🔥","💧","✨","🔔"],labels:["Coat","Season","Basket","Cook","Drain","Garnish","Reveal"]},
 counter:{name:"Pan / counter",steps:["🥕","🔪","🧂","🍳","🥄","✨","🔔"],labels:["Prepare","Chop","Season","Cook","Stir","Plate","Reveal"]}
});
const KITCHEN_FOODS = Object.freeze([
 {id:"coffee",name:"Coffee",emoji:"☕",drinkKind:"coffee",classic:true,category:"drinks",template:"counter",tier:"easy",steps:["coffee-grind","coffee-measure","coffee-tamp","coffee-brew","coffee-steam","coffee-finish","coffee-serve"],labels:["Grind beans","Measure coffee","Tamp coffee","Brew espresso","Steam milk","Finish drink","Serve"]},
 {id:"tea",name:"Tea",emoji:"🍵",drinkKind:"tea",classic:true,category:"drinks",template:"counter",tier:"easy",steps:["tea-heat","tea-warm","tea-add","tea-pour","tea-steep","tea-finish","tea-serve"],labels:["Heat water","Warm cup","Add tea","Pour water","Let it steep","Add milk / lemon","Serve"]},
 {id:"juice",name:"Juice",emoji:"🧃",drinkKind:"juice",classic:true,category:"drinks",template:"counter",tier:"easy",steps:["juice-wash","juice-cut","juice-squeeze","juice-strain","juice-chill","juice-pour","juice-serve"],labels:["Wash fruit","Cut fruit","Squeeze / blend","Strain juice","Chill","Pour","Serve"]},
 {id:"hotdog",name:"Hot Dog",emoji:"🌭",category:"snacks",template:"counter",tier:"easy",steps:["hotdog-slice","hotdog-fry-onions","hotdog-cook","hotdog-turn","hotdog-warm","hotdog-assemble","hotdog-serve"],labels:["Slice onions","Fry onions","Cook sausage","Turn & cook","Warm bun","Assemble hot dog","Serve"]},
 {id:"chips",name:"Chips",emoji:"🍟",classic:true,category:"snacks",template:"fryer",tier:"easy",steps:["chips-wash","chips-cut","chips-rinse","chips-dry","chips-cook","chips-season","chips-serve"],labels:["Wash potatoes","Cut chips","Rinse chips","Dry chips","Fry or bake","Season","Serve"]},
 {id:"churros",name:"Churros",emoji:"🥨",classic:true,category:"sweets",template:"fryer",tier:"easy",steps:["churros-heat","churros-mix","churros-fill","churros-pipe","churros-fry","churros-sugar","churros-serve"],labels:["Heat water","Mix dough","Fill piping bag","Pipe churros","Fry","Coat with sugar","Serve"]},
 {id:"burger",name:"Burger",emoji:"🍔",category:"snacks",template:"counter",tier:"easy",steps:["burger-shape","burger-heat","burger-cook","burger-flip","burger-toast","burger-stack","burger-serve"],labels:["Shape patty","Heat pan","Cook patty","Flip & cook through","Toast bun","Stack burger","Serve"]},
 {id:"icecream",name:"Ice Cream",emoji:"🍦",classic:true,category:"sweets",template:"counter",tier:"easy",steps:["icecream-mix","icecream-chill","icecream-churn","icecream-freeze","icecream-scoop","icecream-top","icecream-serve"],labels:["Mix base","Chill mixture","Churn","Freeze","Scoop or swirl","Add topping","Serve"]},
 {id:"smoothie",name:"Smoothies",emoji:"🥤",drinkKind:"smoothie",category:"drinks",template:"counter",tier:"easy",steps:["smoothie-wash","smoothie-chop","smoothie-milk","smoothie-yoghurt","smoothie-ice","smoothie-blend","smoothie-serve"],labels:["Wash fruit","Chop fruit","Add milk","Add yoghurt","Add ice","Blend","Pour & serve"]},
 {id:"fizz",name:"Fizzy Drinks",emoji:"🫧",drinkKind:"fizz",category:"drinks",template:"counter",tier:"easy",steps:["fizz-squeeze","fizz-syrup","fizz-cool","fizz-ice","fizz-flavour","fizz-soda","fizz-serve"],labels:["Squeeze fruit","Make syrup","Cool syrup","Add ice","Add flavour","Top with soda","Serve"]},
 {id:"pizza",name:"Pizza",emoji:"🍕",category:"hot",template:"oven",tier:"easy",steps:["pizza-mix","pizza-knead","pizza-prove","pizza-shape","pizza-top","pizza-bake","pizza-serve"],labels:["Mix dough","Knead dough","Prove dough","Shape base","Add toppings","Bake","Serve"]},
 {id:"fishchips",name:"Fish and Chips",emoji:"🐟",category:"hot",template:"fryer",tier:"core",steps:["fishchips-prepare","fishchips-first-fry","fishchips-batter","fishchips-coat","fishchips-fry-fish","fishchips-crisp","fishchips-serve"],labels:["Prepare chips","First-fry chips","Mix batter","Coat fish","Fry fish","Crisp chips","Drain & serve"]},
 {id:"chickenwings",name:"Chicken Wings",emoji:"🍗",category:"hot",template:"fryer",tier:"core",steps:["wings-dry","wings-season","wings-mix","wings-coat","wings-cook","wings-turn","wings-serve"],labels:["Dry wings","Season wings","Mix coating","Coat wings","Cook wings","Turn & cook through","Glaze & serve"]},
 {id:"pasta",name:"Pasta",emoji:"🍝",category:"hot",template:"counter",tier:"core",steps:["pasta-chop","pasta-cook-veg","pasta-tomatoes","pasta-simmer","pasta-boil","pasta-drain","pasta-serve"],labels:["Chop vegetables","Cook vegetables","Add tomatoes","Simmer sauce","Boil pasta","Drain pasta","Toss & serve"]},
 {id:"sandwich",name:"Sandwich",emoji:"🥪",category:"snacks",template:"counter",tier:"easy",steps:["sandwich-wash","sandwich-slice","sandwich-spread","sandwich-lettuce","sandwich-fill","sandwich-close","sandwich-serve"],labels:["Wash fillings","Slice fillings","Spread bread","Add lettuce","Add cheese & tomato","Close & cut","Serve"]},
 {id:"roastchicken",name:"Roast Chicken",emoji:"🍗",category:"hot",template:"oven",tier:"stretch",steps:["roast-heat","roast-veg","roast-season","roast-tray","roast-cook","roast-rest","roast-serve"],labels:["Heat oven","Prepare vegetables","Season chicken","Arrange roasting tray","Roast through","Rest chicken","Carve & serve"]},
 {id:"maccheese",name:"Macaroni Cheese",emoji:"🧀",category:"hot",template:"oven",tier:"core",steps:["mac-boil","mac-drain","mac-base","mac-milk","mac-cheese","mac-mix","mac-bake"],labels:["Boil macaroni","Drain macaroni","Make butter-flour base","Whisk in milk","Melt in cheese","Mix with macaroni","Bake & serve"]},
 {id:"jacketpotato",name:"Jacket Potato",emoji:"🥔",category:"hot",template:"oven",tier:"core",steps:["potato-heat","potato-wash","potato-prick","potato-rub","potato-bake","potato-fill","potato-serve"],labels:["Heat oven","Wash & dry potato","Prick potato","Rub with oil & salt","Bake","Split & add filling","Serve"]},
 {id:"croissant",name:"Croissant",emoji:"🥐",category:"breakfast",template:"oven",tier:"easy",steps:["croissant-mix","croissant-chill","croissant-butter","croissant-fold","croissant-shape","croissant-prove","croissant-bake"],labels:["Mix dough","Chill dough","Add butter layers","Roll & fold","Cut & shape","Prove","Bake & serve"]},
 {id:"muffin",name:"Muffin",emoji:"🧁",category:"sweets",template:"oven",tier:"easy",steps:["muffin-dry","muffin-wet","muffin-combine","muffin-filling","muffin-cases","muffin-bake","muffin-serve"],labels:["Mix dry ingredients","Mix wet ingredients","Combine gently","Fold in filling","Fill cases","Bake","Cool & serve"]},
 {id:"cookie",name:"Cookie",emoji:"🍪",category:"sweets",template:"oven",tier:"easy",steps:["cookie-cream","cookie-egg","cookie-flour","cookie-chocolate","cookie-portion","cookie-bake","cookie-serve"],labels:["Cream butter & sugar","Add egg","Add flour","Fold in chocolate","Portion dough","Bake","Cool & serve"]},
 {id:"ramen",name:"Ramen",emoji:"🍜",category:"world",template:"counter",tier:"core",steps:["ramen-broth","ramen-simmer","ramen-egg","ramen-toppings","ramen-noodles","ramen-assemble","ramen-serve"],labels:["Prepare broth","Simmer broth","Cook egg","Prepare toppings","Cook noodles","Assemble bowl","Serve"]},
 {id:"sushi",name:"Sushi",emoji:"🍣",category:"world",template:"counter",tier:"stretch",steps:["sushi-rinse","sushi-cook","sushi-season","sushi-cool","sushi-fillings","sushi-roll","sushi-serve"],labels:["Rinse rice","Cook rice","Season rice","Cool rice","Prepare fillings","Roll sushi","Slice & serve"]},
 {id:"dumplings",name:"Dumplings",emoji:"🥟",category:"world",template:"counter",tier:"core",steps:["dumpling-dough","dumpling-rest","dumpling-filling","dumpling-wrappers","dumpling-fill","dumpling-seal","dumpling-steam"],labels:["Mix dough","Rest dough","Prepare filling","Roll wrappers","Fill dumplings","Fold & seal","Steam & serve"]},
 {id:"curryrice",name:"Curry Rice",emoji:"🍛",category:"world",template:"counter",tier:"stretch",steps:["curry-rice","curry-chop","curry-onions","curry-spices","curry-sauce","curry-simmer","curry-serve"],labels:["Start cooking rice","Chop vegetables","Fry onions","Toast spices","Add vegetables & sauce","Simmer curry","Plate & serve"]},
 /* Build 86g-phase11 · Integration A — Breakfast, Snacks and Hong Kong.
    Seven researched steps each, matching every existing recipe. */
 {id:"omelette",name:"Omelette",emoji:"🍳",category:"breakfast",template:"counter",tier:"core",steps:["omelette-crack","omelette-whisk","omelette-heat","omelette-pour","omelette-cook","omelette-fill","omelette-fold"],labels:["Crack eggs","Whisk & season","Heat butter","Pour eggs","Draw edges inward","Add filling","Fold & serve"]},
 {id:"pancakes",name:"Pancakes",emoji:"🥞",category:"breakfast",template:"counter",tier:"easy",steps:["pancakes-dry","pancakes-wet","pancakes-combine","pancakes-heat","pancakes-pour","pancakes-flip","pancakes-serve"],labels:["Mix dry ingredients","Whisk wet ingredients","Combine batter","Heat & grease pan","Pour batter rounds","Flip & cook","Stack & serve"]},
 {id:"waffles",name:"Waffles",emoji:"🧇",category:"breakfast",template:"counter",tier:"easy",steps:["waffles-heat","waffles-dry","waffles-wet","waffles-combine","waffles-grease","waffles-cook","waffles-serve"],labels:["Heat waffle iron","Mix dry ingredients","Whisk wet ingredients","Combine batter","Grease waffle iron","Pour, close & cook","Top & serve"]},
 {id:"eggsoldiers",name:"Boiled Egg & Soldiers",emoji:"🥚",category:"breakfast",template:"counter",tier:"easy",steps:["soldiers-water","soldiers-lower","soldiers-boil","soldiers-toast","soldiers-butter","soldiers-cut","soldiers-serve"],labels:["Bring water to boil","Lower in eggs","Soft-boil 5 minutes","Toast bread","Butter toast","Cut into soldiers","Place egg & serve"]},
 {id:"eggsbenedict",name:"Eggs Benedict",emoji:"🥚",category:"breakfast",template:"counter",tier:"stretch",steps:["benedict-whisk","benedict-sauce","benedict-ham","benedict-poach","benedict-toast","benedict-stack","benedict-serve"],labels:["Whisk yolks","Add butter & lemon","Warm ham","Poach eggs","Toast muffins","Stack muffin, ham & egg","Spoon sauce & serve"]},
 {id:"cornoncob",name:"Corn on the Cob",emoji:"🌽",category:"snacks",template:"oven",tier:"easy",steps:["corn-oven","corn-shuck","corn-butter","corn-foil","corn-spread","corn-bake","corn-serve"],labels:["Heat oven","Remove husk & silk","Mix herb butter","Place cob on foil","Spread with butter","Wrap & bake until tender","Unwrap & serve"]},
 {id:"pretzel",name:"Pretzel",emoji:"🥨",category:"snacks",template:"oven",tier:"core",steps:["pretzel-mix","pretzel-knead","pretzel-rise","pretzel-shape","pretzel-dip","pretzel-salt","pretzel-bake"],labels:["Mix the dough","Knead until smooth","Leave dough to rise","Shape the pretzel","Dip in soda water","Sprinkle with salt","Bake brown & serve"]},
 {id:"vegetableskewers",name:"Vegetable Skewers",emoji:"🍢",category:"snacks",template:"counter",tier:"easy",steps:["skewer-soak","skewer-wash","skewer-chop","skewer-glaze","skewer-thread","skewer-brush","skewer-serve"],labels:["Soak wooden skewers","Wash vegetables","Cut into chunks","Mix glaze","Thread vegetables","Brush with glaze","Grill, turn & serve"]},
 {id:"curryfishballs",name:"Curry Fish Balls",emoji:"🍢",category:"hongkong",template:"counter",tier:"easy",steps:["fishball-prep","fishball-aromatics","fishball-sauce","fishball-boil","fishball-add","fishball-simmer","fishball-skewer"],labels:["Prepare shallots & curry","Fry shallots & curry","Add stock & seasonings","Bring sauce to a simmer","Add the fish balls","Simmer until coated","Skewer & serve"]},
 {id:"eggwaffle",name:"Egg Waffle",emoji:"🧇",category:"hongkong",template:"counter",tier:"easy",steps:["eggwaffle-dry","eggwaffle-wet","eggwaffle-mix","eggwaffle-rest","eggwaffle-heat","eggwaffle-pour","eggwaffle-cook"],labels:["Measure dry ingredients","Whisk eggs & milk","Mix a smooth batter","Chill & rest batter","Heat & oil bubble iron","Pour, close & flip","Cook golden & serve"]},
 {id:"siumai",name:"Siu Mai",emoji:"🥟",category:"hongkong",template:"counter",tier:"core",steps:["siumai-prepare","siumai-season","siumai-mix","siumai-wrappers","siumai-wrap","siumai-top","siumai-steam"],labels:["Prepare pork & prawn","Add the seasonings","Mix until sticky","Lay out the wrappers","Fill open wrappers","Add carrot topping","Steam & serve"]},
 {id:"threetreasures",name:"Three Fried Stuffed Treasures",emoji:"🍆",category:"hongkong",template:"fryer",tier:"core",steps:["treasures-cut","treasures-paste","treasures-dust","treasures-stuff","treasures-fry","treasures-turn","treasures-serve"],labels:["Cut the three pieces","Prepare fish paste","Dust with cornflour","Stuff with fish paste","Fry paste-side down","Turn & cook through","Drizzle sauce & serve"]},
 /* Build 86g-phase12 · Integration B — Hot Meals, World Kitchen and
    Bakery & Sweets. Completes the 54-recipe catalogue. */
 {id:"tomatosoup",name:"Tomato Soup",emoji:"🍲",category:"hot",template:"counter",tier:"easy",steps:["soup-chop","soup-soften","soup-tomatoes","soup-stock","soup-simmer","soup-blend","soup-serve"],labels:["Wash & chop vegetables","Soften vegetables","Add tomatoes & purée","Pour in stock","Simmer gently","Blend smooth","Garnish & serve"]},
 {id:"bakedsalmon",name:"Baked Salmon",emoji:"🐟",category:"hot",template:"oven",tier:"core",steps:["salmon-oven","salmon-dry","salmon-oil","salmon-season","salmon-dish","salmon-bake","salmon-serve"],labels:["Heat oven","Pat salmon dry","Brush with oil","Add herbs & lemon","Place skin-side down","Bake until cooked","Add lemon & serve"]},
 {id:"stuffedpepper",name:"Stuffed Pepper",emoji:"🫑",category:"hot",template:"oven",tier:"core",steps:["pepper-oven","pepper-deseed","pepper-oil","pepper-prebake","pepper-mix","pepper-fill","pepper-serve"],labels:["Heat oven","Halve & deseed pepper","Brush with oil","Bake until tender","Mix rice & beans","Fill & top with cheese","Bake until hot & serve"]},
 {id:"lasagne",name:"Lasagne",emoji:"🍝",category:"hot",template:"oven",tier:"stretch",steps:["lasagne-veg","lasagne-beef","lasagne-ragu","lasagne-bechamel","lasagne-layer","lasagne-bake","lasagne-serve"],labels:["Prepare vegetables","Brown the beef","Simmer the ragù","Make béchamel","Layer pasta & sauces","Top with cheese & bake","Rest, slice & serve"]},
 {id:"shepherdspie",name:"Shepherd’s Pie",emoji:"🥧",category:"hot",template:"oven",tier:"core",steps:["shepherd-potatoes","shepherd-lamb","shepherd-veg","shepherd-stock","shepherd-mash","shepherd-assemble","shepherd-bake"],labels:["Boil the potatoes","Brown lamb mince","Soften vegetables","Add stock & simmer","Drain & mash","Fill dish & ridge mash","Bake golden & serve"]},
 {id:"quichelorraine",name:"Quiche Lorraine",emoji:"🥧",category:"hot",template:"oven",tier:"stretch",steps:["quiche-pastry","quiche-chill","quiche-blind","quiche-bacon","quiche-custard","quiche-fill","quiche-bake"],labels:["Make the pastry","Line tin & chill","Blind-bake the crust","Cook the bacon","Whisk the custard","Fill the pastry case","Bake, cool & serve"]},
 {id:"eggfriedrice",name:"Egg Fried Rice",emoji:"🍚",category:"world",template:"counter",tier:"core",steps:["rice-cook","rice-prep","rice-wok","rice-veg","rice-add","rice-egg","rice-serve"],labels:["Cook & steam-dry rice","Prepare vegetables","Heat wok","Stir-fry vegetables","Add & toast rice","Scramble egg in wok","Season, toss & serve"]},
 {id:"padthai",name:"Pad Thai",emoji:"🍜",category:"world",template:"counter",tier:"stretch",steps:["pad-soak","pad-sauce","pad-aromatics","pad-prawns","pad-noodles","pad-egg","pad-serve"],labels:["Soak & drain noodles","Mix tamarind sauce","Fry aromatics","Cook prawns until pink","Add noodles & sauce","Scramble egg & add sprouts","Add lime, peanuts & serve"]},
 {id:"chickenkatsu",name:"Chicken Katsu",emoji:"🍛",category:"world",template:"fryer",tier:"core",steps:["katsu-flatten","katsu-flour","katsu-egg","katsu-panko","katsu-oil","katsu-cook","katsu-serve"],labels:["Flatten chicken","Season & flour","Dip in beaten egg","Coat with panko","Heat the oil","Cook crisp & through","Slice, fan & serve"]},
 {id:"prawntempura",name:"Prawn Tempura",emoji:"🍤",category:"world",template:"fryer",tier:"stretch",steps:["tempura-prep","tempura-flour","tempura-batter","tempura-oil","tempura-dip","tempura-fry","tempura-serve"],labels:["Prepare & dry prawns","Dust lightly with flour","Mix ice-cold batter","Heat the oil","Dip prawns in batter","Fry until crisp","Drain & serve"]},
 {id:"springrolls",name:"Spring Rolls",emoji:"🥢",category:"world",template:"fryer",tier:"core",steps:["roll-noodles","roll-veg","roll-filling","roll-place","roll-fold","roll-seal","roll-serve"],labels:["Soften & cut noodles","Prepare vegetables","Mix the filling","Place filling on wrapper","Fold in the sides","Roll & seal","Fry, drain & serve"]},
 {id:"paella",name:"Paella",emoji:"🥘",category:"world",template:"counter",tier:"stretch",steps:["paella-stock","paella-veg","paella-tomato","paella-rice","paella-simmer","paella-seafood","paella-serve"],labels:["Warm saffron stock","Soften onion & pepper","Add tomato & spices","Coat & toast the rice","Add stock & simmer","Add prawns & peas","Add lemon & serve"]},
 {id:"applepie",name:"Apple Pie",emoji:"🥧",category:"sweets",template:"oven",tier:"stretch",steps:["pie-pastry","pie-apples","pie-season","pie-line","pie-fill","pie-lattice","pie-bake"],labels:["Make & chill pastry","Peel, core & slice apples","Add sugar & spices","Roll & line the dish","Add the apple filling","Weave & glaze lattice","Bake, cool & serve"]},
 {id:"chocolatebrownie",name:"Chocolate Brownie",emoji:"🍫",category:"sweets",template:"oven",tier:"easy",steps:["brownie-oven","brownie-melt","brownie-whisk","brownie-sift","brownie-fold","brownie-bake","brownie-serve"],labels:["Heat oven & line tin","Melt butter & chocolate","Whisk eggs & sugar","Sift flour & cocoa","Fold mixtures & chunks","Pour & bake","Cool, cut & serve"]},
 {id:"chocolateeclair",name:"Chocolate Éclair",emoji:"🍫",category:"sweets",template:"oven",tier:"stretch",steps:["eclair-boil","eclair-flour","eclair-eggs","eclair-pipe","eclair-bake","eclair-fill","eclair-glaze"],labels:["Boil water & butter","Stir in the flour","Beat in the eggs","Pipe long pastry logs","Bake & cool shells","Make cream & fill","Add chocolate glaze"]},
 {id:"cinnamonroll",name:"Cinnamon Roll",emoji:"🥐",category:"sweets",template:"oven",tier:"core",steps:["roll-mix","roll-rise","roll-fill","roll-log","roll-cut","roll-bake","roll-ice"],labels:["Mix & knead dough","Cover & let dough rise","Roll & spread filling","Roll into a log","Cut rolls & proof","Bake until golden","Ice & serve"]},
 {id:"doughnut",name:"Doughnut",emoji:"🍩",category:"sweets",template:"fryer",tier:"core",steps:["donut-mix","donut-rise","donut-roll","donut-cut","donut-proof","donut-fry","donut-glaze"],labels:["Mix & knead dough","Cover & let dough rise","Roll the dough","Cut out rings","Let rings proof","Fry, turn & drain","Glaze & serve"]}
]);
const LEGACY_CLASSIC_MENU_FOODS = Object.freeze(["hotdog","chips","churros","burger","icecream"]);
const KITCHEN_CLASSIC_FOODS = Object.freeze(KITCHEN_FOODS.filter(x=>x.classic).map(x=>x.id));
const KITCHEN_CHALLENGE_FOODS = Object.freeze(KITCHEN_FOODS.filter(x=>!x.classic));
const KITCHEN_FOOD_BY_ID = Object.freeze(Object.fromEntries(KITCHEN_FOODS.map(x=>[x.id,x])));
const KITCHEN_MENU_CATEGORIES = Object.freeze([
 {id:"drinks",name:"Drinks",emoji:"🍹"},
 {id:"breakfast",name:"Breakfast",emoji:"🍳"},
 {id:"snacks",name:"Snacks",emoji:"🍟"},
 {id:"hot",name:"Hot Meals",emoji:"🍲"},
 {id:"world",name:"World Kitchen",emoji:"🌍"},
 {id:"hongkong",name:"Hong Kong",emoji:"🥢"},
 {id:"sweets",name:"Bakery & Sweets",emoji:"🧁"}
]);

/* Build 86g-phase12: pickTicketFood() only falls back to the full eligible
   pool when a personality's preferred list is empty — which it never is. Any
   dish missing from EVERY list here can therefore never be ordered in the
   café, silently and without error. Every non-drink recipe must appear at
   least once below; the catalogue test asserts it. */
const PERSONALITY_FOODS = {
 formal:["churros","icecream","croissant","sushi","sandwich","eggsbenedict","quichelorraine","chocolateeclair","bakedsalmon"],
 brisk:["hotdog","chips","burger","fishchips","chickenwings","jacketpotato","cornoncob","pretzel","doughnut","eggfriedrice","shepherdspie"],
 bouncy:["icecream","churros","chips","pizza","muffin","cookie","pancakes","waffles","eggwaffle","doughnut","chocolatebrownie","applepie","lasagne"],
 shy:["icecream","chips","sandwich","dumplings","maccheese","eggsoldiers","siumai","tomatosoup","cinnamonroll","stuffedpepper"],
 cool:["burger","hotdog","chips","ramen","pasta","pizza","curryfishballs","omelette","padthai","chickenkatsu","lasagne"],
 mysterious:["churros","burger","icecream","curryrice","sushi","roastchicken","threetreasures","vegetableskewers","paella","prawntempura","springrolls","stuffedpepper"]
};

/* British weather small talk — the national sport. Customers open
   with one of these about a third of the time. */
const WEATHER_CHAT = [
 "Isn't it hot today? I nearly took my cardigan off. Nearly.",
 "Bit muggy out, isn't it? Still — mustn't grumble.",
 "Lovely weather... for ducks.",
 "A pigeon glared at me at the bus stop. I think it wanted my sandwich.",
 "I saw ONE cloud shaped like a dog. Best part of my whole morning.",
 "It's puddle season. My socks found out before I did.",
 "Four seasons in one day out there. I dressed for two of them.",
 "It's spitting again. I refuse to call it rain until it commits.",
 "Gorgeous morning! So naturally I brought my umbrella.",
 "They said sunshine on the forecast. They lie beautifully.",
 "This wind! My hair has had three different styles since breakfast.",
 "Ooh, it's close today, isn't it? Proper sticky.",
 "The sun's out! Quick, everyone panic and buy a barbecue.",
 "Drizzle again. The sky simply cannot commit to anything.",
 "Chilly enough to see your breath! Character-building, my gran called it."
];

/* Witty wrong-answer lines — funny but always kind. Mixed in with
   the customer's own lines so wrong answers stay light. */
const WITTY_WRONG = [
 "Wrong — but delivered with tremendous confidence. I respect that.",
 "Not quite! Even dictionaries have off days.",
 "That word tried to trick you. Sneaky little thing. Rematch?",
 "Incorrect — but your brain just grew a tiny bit. I heard it.",
 "A swing and a miss! Lovely swing, though.",
 "Not that one — but now you'll NEVER forget the right one.",
 "The word wins this round. Best of three?",
 "Almost! If answers were horseshoes, you'd have scored.",
 "Wrong answer, right attitude. Onwards!",
 "Ooh, so close the right answer felt a breeze go past."
];

const DRINK_KINDS = {
 coffee:{emoji:"☕", names:["Flat White","Caramel Latte","Mocha Swirl","Hazelnut Cappuccino","Toffee Espresso","Vanilla Macchiato"],
   colors:["#8A5A44","#6E4A2E","#A9713F","#5C4033","#B08050"]},
 tea:{emoji:"🍵", names:["Earl Grey","Jasmine Green Tea","Peppermint Steamer","Spiced Chai","Honey Camomile","Berry Hibiscus Tea"],
   colors:["#7FA65A","#C9A227","#B23A5F","#C25B2E","#5C8140"]},
 juice:{emoji:"🧃", names:null, /* uses the current theme's drink list */
   colors:["#E8891D","#D8547A","#F2B33D","#C25B2E","#7FA65A"]},
 smoothie:{emoji:"🥤", names:["Berry Blast Smoothie","Mango-Banana Smoothie","Peach Melba Smoothie","Choc-Oat Smoothie","Strawberry Swirl Smoothie"],
   colors:["#B23A5F","#E07A9B","#8E6BAE","#F2B33D","#D8547A"]},
 fizz:{emoji:"🫧", names:null, /* uses the current theme's drink list */
   colors:["#5B8FB5","#6BC5B8","#9CCBDB","#8E6BAE","#D8547A"]}
};
const PERSONALITY_DRINKS = {
 formal:["tea","tea","coffee"], brisk:["coffee","coffee","juice"],
 bouncy:["smoothie","fizz","juice"], shy:["tea","juice","smoothie"],
 cool:["coffee","fizz","juice"], mysterious:["tea","smoothie","coffee"]};
function inferDrinkKind(name){
  const n=(name||"").toLowerCase();
  if(/latte|coffee|espresso|mocha|cappuccino|affogato|press|blend|macchiato/.test(n)) return "coffee";
  if(/tea|chai|camomile|matcha|toddy|steamer|honey lemon|elderflower|reverie/.test(n)) return "tea";
  if(/smoothie|cloud|cream|dream|velvet|whirl|slush/.test(n)) return "smoothie";
  if(/fizz|sparkle|soda|zing|lemonade|cooler|twinkle|splash|squall|storm|surge|zinger|quencher|mist|nectar|elixir|rocket|paw-fect|ripple|drop|spritz|glow|snow|juice/.test(n)) return "fizz";
  return "juice";
}

/* Shop — every item is a fixed, visible price (no chance-based
   unlocks). dest: 'avatar', 'cafe', 'pet' or 'system'. slot = where it renders. */
const SHOP = [
// STARTER — prices increased approximately 40% in Build 52
{id:"apron_cherry",dest:"avatar",slot:"apron",layer:"Player style",tier:"Starter",price:70,name:"Cherry Apron",c:"#D8547A"},
{id:"clip_daisy",dest:"avatar",slot:"hat",layer:"Player style",tier:"Starter",price:85,name:"Daisy Hairclip",c:"#F2B33D"},
{id:"stool_simple",dest:"cafe",slot:"stool",layer:"Furniture",tier:"Starter",price:70,name:"Simple Stool",c:"#C98A55"},
{id:"menu_chalk",dest:"cafe",slot:"menu",layer:"Furniture",tier:"Starter",price:130,name:"Chalk Menu Board",c:"#3E3A4A"},
{id:"wall_sunny",dest:"cafe",slot:"wallpaper",layer:"Structural",tier:"Starter",price:85,name:"Buttercup Wallpaper",c:"#F9EBC8"},
{id:"wall_meadow",dest:"cafe",slot:"wallpaper",layer:"Café decor",tier:"Starter",price:170,name:"Meadow Wallpaper",c:"#A8C69A"},
{id:"wall_blush",dest:"cafe",slot:"wallpaper",layer:"Café decor",tier:"Starter",price:180,name:"Blush Wallpaper",c:"#F2C7D4"},
{id:"wall_sky",dest:"cafe",slot:"wallpaper",layer:"Café decor",tier:"Mid",price:360,name:"Sky Wallpaper",c:"#AFCBE8"},
{id:"floor_cocoa",dest:"cafe",slot:"floor",layer:"Café decor",tier:"Starter",price:200,name:"Cocoa Floorboards",c:"#8A5A3E"},
{id:"floor_slate",dest:"cafe",slot:"floor",layer:"Café decor",tier:"Mid",price:390,name:"Slate Tiles",c:"#7C8BA0"},
{id:"rug_rose",dest:"cafe",slot:"rug",layer:"Café decor",tier:"Starter",price:130,name:"Rose Rug",c:"#D8547A"},
{id:"rug_ocean",dest:"cafe",slot:"rug",layer:"Café decor",tier:"Mid",price:340,name:"Ocean Rug",c:"#5B8FB5"},
{id:"stool_cherry",dest:"cafe",slot:"stool",layer:"Café decor",tier:"Starter",price:150,name:"Cherry Stools",c:"#C0392B"},
{id:"stool_velvet",dest:"cafe",slot:"stool",layer:"Café decor",tier:"Premium",price:560,name:"Velvet Stools",c:"#8E6BAE"},
{id:"petbed_cloud",dest:"cafe",slot:"petbed",layer:"Pet care",tier:"Mid",price:450,name:"Cloud Pet Bed",c:"#EDE6E0",petItem:true,requiresPetLicence:true},
{id:"lamp_rose",dest:"cafe",slot:"lamp",layer:"Café decor",tier:"Mid",price:390,name:"Rose Reading Lamp",c:"#D8547A"},
{id:"plant_monstera",dest:"cafe",slot:"plant",layer:"Café decor",tier:"Mid",price:420,name:"Monstera Plant",c:"#4E7A46"},
{id:"poster_abc",dest:"cafe",slot:"wallart",layer:"Café decor",tier:"Mid",price:480,name:"Alphabet Poster",c:"#FDFBF5"},
{id:"clock_station",dest:"cafe",slot:"wallart",layer:"Café decor",tier:"Premium",price:570,name:"Station Clock",c:"#FDFBF5"},
{id:"gumball",dest:"cafe",slot:"display",layer:"Café decor",tier:"Premium",price:600,name:"Gumball Machine",c:"#C0392B"},
{id:"radio_retro",dest:"cafe",slot:"display",layer:"Café decor",tier:"Mid",price:530,name:"Retro Radio",c:"#6BC5B8"},
{id:"flowerbox",dest:"cafe",slot:"window",layer:"Café decor",tier:"Mid",price:500,name:"Window Flower Box",c:"#8A5A2E"},
{id:"shelf_trophies",dest:"cafe",slot:"shelf",layer:"Café decor",tier:"Mid",price:530,name:"Trophy Shelf",c:"#8A5A2E"},
{id:"floor_honey",dest:"cafe",slot:"floor",layer:"Structural",tier:"Starter",price:110,name:"Honey Floorboards",c:"#DDAE6B"},
{id:"poster_fruit",dest:"cafe",slot:"wallart",layer:"Wall details",tier:"Starter",price:85,name:"Fruit Poster",c:"#E8891D"},
{id:"rug_stripe",dest:"cafe",slot:"rug",layer:"Ambience",tier:"Starter",price:105,name:"Striped Rug",c:"#9CCBDB"},
{id:"mug_rack",dest:"cafe",slot:"display",layer:"Furniture",tier:"Starter",price:120,name:"Little Mug Rack",c:"#8A5A2E"},
// MID — prices increased approximately 40% in Build 52
{id:"waistcoat",dest:"avatar",slot:"apron",layer:"Player style",tier:"Mid",price:490,name:"Barista Waistcoat",c:"#5C4033"},
{id:"headset_pro",dest:"avatar",slot:"head_extra",layer:"Player style",tier:"Mid",price:450,name:"Barista Headset",c:"#3E3A4A"},
{id:"earrings_gold",dest:"avatar",slot:"ears",layer:"Player style",tier:"Mid",price:390,name:"Gold Hoop Earrings",c:"#F2B33D"},
{id:"watch_classic",dest:"avatar",slot:"wrist_l",layer:"Player style",tier:"Mid",price:420,name:"Classic Watch",c:"#8A5A2E"},
{id:"cap_scarlet",dest:"avatar",slot:"hat",layer:"Player style",tier:"Mid",price:420,name:"Scarlet Cap",c:"#C0392B"},
{id:"necklace_heart",dest:"avatar",slot:"neck",layer:"Player style",tier:"Mid",price:430,name:"Heart Necklace",c:"#D8547A"},
{id:"belt_buckle",dest:"avatar",slot:"waist",layer:"Player style",tier:"Mid",price:360,name:"Buckle Belt",c:"#5C4033"},
{id:"sunglasses_cool",dest:"avatar",slot:"eyes",layer:"Player style",tier:"Mid",price:480,name:"Cool Sunglasses",c:"#2E2A36"},
{id:"scarf_cosy",dest:"avatar",slot:"neck",layer:"Player style",tier:"Mid",price:410,name:"Cosy Scarf",c:"#7A3B3B"},
{id:"bracelet_beads",dest:"avatar",slot:"wrist_r",layer:"Player style",tier:"Mid",price:380,name:"Bead Bracelet",c:"#6BC5B8"},
{id:"bowtie_dapper",dest:"avatar",slot:"neck",layer:"Player style",tier:"Mid",price:420,name:"Dapper Bow Tie",c:"#3E5C8E"},
/* Retired from the visible shop in v27: kept in the registry so old
   saves that already bought/equipped it continue to render safely. */
{id:"glasses_round",dest:"avatar",slot:"glasses",layer:"Player style",tier:"Mid",price:280,name:"Round Glasses",c:"#463A54",retired:true},
{id:"stool_oak",dest:"cafe",slot:"stool",layer:"Furniture",tier:"Mid",price:360,name:"Oak Counter Stools",c:"#8A5A2E"},
{id:"cakedome",dest:"cafe",slot:"display",layer:"Furniture",tier:"Mid",price:530,name:"Display Cake Dome",c:"#9CCBDB"},
{id:"tiles_terra",dest:"cafe",slot:"floor",layer:"Structural",tier:"Mid",price:390,name:"Terracotta Tiles",c:"#C46B45"},
{id:"window_awning",dest:"cafe",slot:"window",layer:"Structural",tier:"Mid",price:450,name:"Striped Awning Window",c:"#D8547A"},
{id:"stars_paper",dest:"cafe",slot:"lights",layer:"Ambience",tier:"Mid",price:420,name:"String of Paper Stars",c:"#F2B33D"},
{id:"petbasket",dest:"cafe",slot:"petbed",layer:"Pet care",tier:"Mid",price:340,name:"Cosy Pet Basket",c:"#8E6BAE",petItem:true,requiresPetLicence:true},
{id:"print_seaside",dest:"cafe",slot:"wallart",layer:"Wall details",tier:"Mid",price:350,name:"Framed Seaside Print",c:"#5B8FB5"},
{id:"bunting_rainbow",dest:"cafe",slot:"bunting",layer:"Wall details",tier:"Mid",price:310,name:"Rainbow Bunting",c:"#D8547A"},
{id:"lamp_brass",dest:"cafe",slot:"lamp",layer:"Ambience",tier:"Mid",price:320,name:"Brass Reading Lamp",c:"#C9A227"},
{id:"shelf_books",dest:"cafe",slot:"shelf",layer:"Furniture",tier:"Mid",price:410,name:"Little Bookshelf",c:"#7A3B3B"},
// PREMIUM — prices increased approximately 40% in Build 52
{id:"badge_star",dest:"avatar",slot:"badge",layer:"Player style",tier:"Premium",price:650,name:"Star Barista Badge",c:"#F2B33D"},
{id:"counter_marble",dest:"cafe",slot:"counter",layer:"Structural",tier:"Premium",price:670,name:"Marble Counter",c:"#E8E4DC"},
{id:"window_stained",dest:"cafe",slot:"window",layer:"Structural",tier:"Premium",price:690,name:"Stained-Glass Window",c:"#8E6BAE"},
{id:"shelf_kegs",dest:"cafe",slot:"display",layer:"Furniture",tier:"Premium",price:710,name:"Juice Keg Shelf",c:"#8A5A2E"},
{id:"fairylights",dest:"cafe",slot:"lights",layer:"Ambience",tier:"Premium",price:730,name:"Twinkling Fairy Lights",c:"#F2B33D",anim:true},
{id:"mural_market",dest:"cafe",slot:"wallart",layer:"Wall details",tier:"Premium",price:740,name:"Chalk Mural: Fruit Market",c:"#3E3A4A"},
{id:"lantern_paper",dest:"cafe",slot:"lamp",layer:"Ambience",tier:"Premium",price:760,name:"Paper Lantern String",c:"#E8891D",anim:true},
// LEGENDARY — prices increased approximately 40% in Build 52
{id:"pet_license",dest:"system",slot:"petLicence",layer:"Pet care",tier:"Legendary",price:1120,name:"Pet Licence",c:"#F2B33D",petItem:true,permanent:true},
{id:"crown_lexicon",dest:"avatar",slot:"hat",layer:"Player style",tier:"Legendary",price:910,name:"Lexicon Crown",c:"#F2B33D",anim:true},
{id:"fountain_gold",dest:"cafe",slot:"counter",layer:"Structural",tier:"Legendary",price:980,name:"Golden Tap Fountain",c:"#D8A521",anim:true},
{id:"jukebox",dest:"cafe",slot:"display",layer:"Furniture",tier:"Legendary",price:1050,name:"Grand Jukebox",c:"#B23A5F",anim:true},
{id:"aurora",dest:"cafe",slot:"lights",layer:"Ambience",tier:"Legendary",price:1120,name:"Aurora Lantern",c:"#6BC5B8",anim:true},
{id:"portrait_fox",dest:"cafe",slot:"wallart",layer:"Wall details",tier:"Legendary",price:1190,name:"Portrait of the Lexicon Fox",c:"#D07B3A"},
/* ---- 2026 clothing system: 3 styles (mix with any dye) + 5 dyes ---- */
{id:"style_tee",dest:"avatar",slot:"garment_style",layer:"Player style",tier:"Mid",price:310,name:"Caf\u00e9 Tee",c:"#3E7CA6",gs:"tee"},
{id:"style_polo",dest:"avatar",slot:"garment_style",layer:"Player style",tier:"Mid",price:360,name:"Smart Polo",c:"#B23A5F",gs:"polo"},
{id:"style_shirt",dest:"avatar",slot:"garment_style",layer:"Player style",tier:"Mid",price:420,name:"Linen Shirt",c:"#3E3A4A",gs:"shirt"},
/* S10d: the 5 dyes are no longer sold (the same colours are free in Change look); owners keep them */
{id:"color_ocean",retired:true,dest:"avatar",slot:"garment_color",layer:"Player style",tier:"Starter",price:170,name:"Ocean Dye",c:"#3E7CA6"},
{id:"color_berry",retired:true,dest:"avatar",slot:"garment_color",layer:"Player style",tier:"Starter",price:170,name:"Berry Dye",c:"#B23A5F"},
{id:"color_forest",retired:true,dest:"avatar",slot:"garment_color",layer:"Player style",tier:"Starter",price:170,name:"Forest Dye",c:"#4E7A4A"},
{id:"color_charcoal",retired:true,dest:"avatar",slot:"garment_color",layer:"Player style",tier:"Starter",price:170,name:"Charcoal Dye",c:"#3E3A4A"},
{id:"color_sand",retired:true,dest:"avatar",slot:"garment_color",layer:"Player style",tier:"Starter",price:170,name:"Sand Dye",c:"#C9A96A"},
/* S9d: 12 new barista wearables. Slots: hat (one at a time), head_extra,
   eyes, neck, garment_style, and two new slots — clips (hair clips) and
   back (cape). Items that would overlap across slots are taken off
   automatically (WEAR_CONFLICTS in 06-ui.js). */
{id:"hat_bobble",dest:"avatar",slot:"hat",layer:"Player style",tier:"Mid",price:380,name:"Woolly Bobble Hat",c:"#4E8FCF"},
{id:"hat_chef",dest:"avatar",slot:"hat",layer:"Player style",tier:"Premium",price:620,name:"Chef\u2019s Hat",c:"#F4F0E6"},
{id:"headband_cat",dest:"avatar",slot:"hat",layer:"Player style",tier:"Starter",price:150,name:"Cat-Ear Headband",c:"#E77FA6"},
{id:"pencil_ear",dest:"avatar",slot:"head_extra",layer:"Player style",tier:"Starter",price:120,name:"Pencil Behind Ear",c:"#F2C94C"},
{id:"sunglasses_heart",dest:"avatar",slot:"eyes",layer:"Player style",tier:"Mid",price:450,name:"Heart Sunglasses",c:"#D63F76"},
{id:"style_hoodie",dest:"avatar",slot:"garment_style",layer:"Player style",tier:"Mid",price:380,name:"Cosy Hoodie",c:"#6B8FBF",gs:"hoodie"},
{id:"style_stripes",dest:"avatar",slot:"garment_style",layer:"Player style",tier:"Mid",price:340,name:"Striped Jumper",c:"#4E7A4A",gs:"stripes"},
{id:"cape_hero",dest:"avatar",slot:"back",layer:"Player style",tier:"Premium",price:700,name:"Superhero Cape",c:"#C0392B"},
{id:"crown_flowers",dest:"avatar",slot:"hat",layer:"Player style",tier:"Mid",price:400,name:"Flower Crown",c:"#F28DB2"},
{id:"clips_star",dest:"avatar",slot:"clips",layer:"Player style",tier:"Starter",price:140,name:"Star Hair Clips",c:"#F7D154"},
{id:"scarf_rainbow",dest:"avatar",slot:"neck",layer:"Player style",tier:"Mid",price:420,name:"Rainbow Scarf",c:"#E5484D"},
{id:"hat_pirate",dest:"avatar",slot:"hat",layer:"Player style",tier:"Premium",price:640,name:"Pirate Hat",c:"#2E2A36"},
/* ---- Build 76 pet wardrobe: accessories apply to the active cafe pet. ---- */
{id:"pet_shades_sunny",dest:"pet",slot:"eyes",layer:"Pet style",tier:"Starter",price:160,name:"Sunny Shades",c:"#2E2A36",petItem:true,requiresPetLicence:true},
{id:"pet_bowtie",dest:"pet",slot:"neck",layer:"Pet style",tier:"Starter",price:140,name:"Bow Tie",c:"#B23A5F",petItem:true,requiresPetLicence:true},
{id:"pet_bobble_hat",dest:"pet",slot:"hat",layer:"Pet style",tier:"Mid",price:360,name:"Bobble Hat",c:"#3E7CA6",petItem:true,requiresPetLicence:true},
{id:"pet_party_hat",dest:"pet",slot:"hat",layer:"Pet style",tier:"Mid",price:380,name:"Party Hat",c:"#D8547A",petItem:true,requiresPetLicence:true},
{id:"pet_flower_crown",dest:"pet",slot:"hat",layer:"Pet style",tier:"Mid",price:400,name:"Flower Crown",c:"#F2C7D4",petItem:true,requiresPetLicence:true},
{id:"pet_scarf_cosy",dest:"pet",slot:"neck",layer:"Pet style",tier:"Mid",price:370,name:"Cosy Scarf",c:"#7A3B3B",petItem:true,requiresPetLicence:true},
{id:"pet_pirate_bandana",dest:"pet",slot:"hat",layer:"Pet style",tier:"Premium",price:560,name:"Pirate Bandana",c:"#B23A5F",petItem:true,requiresPetLicence:true},
{id:"pet_tiny_crown",dest:"pet",slot:"hat",layer:"Pet style",tier:"Legendary",price:780,name:"Tiny Crown",c:"#F2B33D",petItem:true,requiresPetLicence:true},
];
