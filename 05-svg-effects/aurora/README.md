# Aurora Lantern — SVG effect prototype

Catalogue ID `aurora`. The uploaded game renders this purchase as ribbons of coloured light, despite its name. This revision preserves that behaviour instead of inventing a new physical lantern housing.

`aurora.svg` is transparent, scalable vector artwork with gradient mint/lilac/gold bands. CSS animates only transform/opacity with slow variation; there are no blur filters or JavaScript loops. Reduced-motion CSS provides a still state. These motion rules are implemented but not browser/iPhone tested here.

Use as a non-interactive ambient layer behind people, above the wall. Keep away from learning text. In inline use, set `--aurora-strength:.22` for daytime, `.8` for night, or `0` to hide it. A host can disable animation with an overriding animation:none rule. If embedding multiple copies inline in one document, namespace the IDs and animation names per instance, or use independent image elements. The SVG is not yet integrated into game settings or ownership logic.

`preview.html` shows the effect against a night wall, with a daytime-strength example. Scaling preserves the original aspect ratio; layout placement remains separate.

Validation: XML parsing and static rasterization at two widths. Live motion, reduced-motion execution, and iPhone performance remain unverified.
