# WordBar Café with Pets — reference demo (15 Oct 2026)

Open `WordBar-Cafe-With-Pets.html` in Chrome. It is self-contained and works offline (only web fonts need a connection).
This is a design/motion mock-up for reference, not game code.

## What it shows
- Modern café at 32% of a 390×844 phone (café area 270 px tall), question + answers below.
- Everyone stands behind the counter. Glass sliding door on the right; customers enter there, queue,
  order, then leave to the LEFT behind the barista. Counter stops short at both ends (x 50–298) so
  people and pets are seen in full when entering and leaving.
- Customer pets (new 52-pet joint SVG pack) follow their owner along the owner's recorded path,
  jump onto the counter while the owner orders (tail wag, ear twitch), dance on a right answer,
  droop on a wrong one, jump down and follow the owner out.
- Barista Mei's corgi lives in its pet bed in front of the counter with an idle routine
  (wag, ear twitch, short stroll and return); jumps on right answers, droops on wrong ones.
- Serve effect from the game: barista wave, cup pops at the machine and slides 650 ms, ✨/🙂, burst,
  +15/+5 coins, customer hop.
- Real-time day/night (06:00–20:00 day, like the game) through window and door; Day/Night override.
- All old café decor items (drawn by the game's own code) moved into new slots; 3 preset sets,
  per-slot selector, "Show slots" overlay.

## Scene geometry (design units, 360 × 262; scale = 270/262)
- Back wall to y 196; floor below. Counter top 184–192, front face to 240, x 50–298.
- Lanes: queue lane feet y 228 (scale 1.0); back walkway feet y 214 (scale 0.9).
- Queue spots x 162 / 236 / 302. Door x 330 (enter). Exit x −48 (leave, behind barista at x 80).
- Pet box 70 units (≈45 px on phone). Pet on counter at owner x + 44, ground y 188.
- Barista pet bed at x 98, y 250.

## Layers (bottom → top)
background (wall, door, machine, window, wall decor) → back walkway actors/pets → queue-lane actors/pets
→ counter → on-counter items (cup, counter pet) → floor decor (rug, stools, pet bed, barista pet, plant)
→ night wash → slot guide → effects.

## Characters and pets used
- Customers/barista: 12 characters from WordBar-72-Updated-SVG-Review (Mei is the barista).
- Pets: pugclassic, lion, owl2, dog, rabbit, hollandlop, redpanda, koala, penguin, dachshund, parrot, corgi
  from WordBar-Pets-All52-Editable-SVG, animated only by rotating their own joints.

## source/
`template.html` (all CSS/JS) and `build.py`, which injects CAST (characters), PETS, DRINKS and DECOR JSON.
Inputs were built from the packs above and the game's `wb/04-world.js`, `05-engine.js`, `06-ui.js`.

## Known limits
- Pets walking behind the counter are mostly hidden (tall ears peek over).
- Exit is the left edge, no drawn back doorway.
- Large Set 3 display item (jukebox) covers the second queue spot.
- Motion defects in the art itself are listed in the separate pet and character review packs.
