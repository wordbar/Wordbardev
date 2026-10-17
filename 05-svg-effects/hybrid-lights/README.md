# WordBar hybrid lights — first working component

Two existing purchases: `fairylights` and `lantern_paper`. This is an isolated asset/demo package, not a modification of the deployed game.

Open `preview.html` directly. It is self-contained and works offline. Use its controls for string width, ornament count, sag, glow, day/night and motion. Individual animated SVG examples are included too; animation may be limited when an SVG is loaded as an image by some hosts. Inline SVG is the intended game integration route.

## Architecture

- PNG = illustrated ornament. Two newly generated isolated ornaments avoid cutting old cords out of the complete-string drawings. New artwork uses the built-in image generator; original source bytes are retained.
- SVG = cord and mounting points, ornament placement, gradient halo and light overlay.
- CSS = asynchronous opacity variation, steady-state option and OS reduced-motion support. No timers or animation loop in JavaScript.
- Warm ivory lantern and warm golden bulb are the initial implemented variants; the previous multicolour drawings remain visual references, not yet fully converted into separate colour sprites.
- PNG transparent margins are handled through SVG viewport bounds, without changing pixels. Geometry exposes width, count and sag separately; changing span does not stretch the ornaments. Dense strings automatically reduce ornament size to prevent overlap.
- Every renderer instance gets unique gradient/keyframe IDs. Self-contained SVG exports embed PNG data URIs, so there are no missing external assets.
- `render({kind, width, count, sag, night, animate, glow, sprite})` returns SVG markup. Insert it inside the designated non-interactive decoration layer. Keep the layer pointer-events disabled in game, and use appropriate accessible labelling/hiding at the host level.
- Glow scales with day/night. It is an artistic gradient, not dynamic room illumination or wall-shadow simulation. Brightness 0 removes dynamic glow; painted sprite highlights remain.

## Rules for future shopping art

| Item behaviour | Preferred construction |
|---|---|
| Static illustrated props, portraits, rugs | PNG |
| Lamps and luminous ornaments | PNG body + SVG glow |
| Hanging strings | Individual PNG ornaments + SVG cord/placement |
| Clock with real moving hands | PNG frame/dial + SVG hands |
| Fountain with flowing water | PNG structure + SVG water/glints |
| Adjustable frame/counter geometry | SVG or sliced sections, with PNG texture/detail where useful |
| Bunting/paper stars with adjustable span | PNG ornaments + SVG cord; no luminous effect by default |
| Wearables | Fit to approved rig; SVG for anchors, recolourable/moving parts, PNG where illustrated detail helps |

SVG is selected for a useful behaviour, not added automatically to every item. Motion must remain optional and subtle. Colours/ownership/economy are not changed here.

## Remaining production work

Check against final café layout and actual phone rendering; integrate theme/day-night settings and saved placements; create additional colour sprites if wanted; profile on the target iPhone. This package does not claim an in-game or iOS performance test.
