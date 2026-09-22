# Mirrorly DeepAR hairstyle effects

Place exported DeepAR Studio effect files in this directory. The normal setup uses one shared base effect per style:

`<style-id>.deepar`

The effect must contain a visible `Hair` node whose PBR material exposes `u_diffuse`. Mirrorly changes that uniform when the user selects a color.

An exact style/color effect can override the shared effect when needed:

`<style-id>-<color-slug>.deepar`

Examples:

- `bob-natural-black.deepar`
- `feather-chestnut-brown.deepar`
- `skin-fade-golden-blonde.deepar`

Mirrorly activates DeepAR only when the currently selected look has a shared or exact matching effect. Missing looks safely use Mirrorly's existing local renderer, so a previous customer's effect cannot remain visible after a style change.

DeepAR's SDK package and license key provide tracking and rendering; they do not automatically convert Mirrorly PNG or GLB files into hairstyle effects. Author or export each hairstyle in DeepAR Studio before placing it here.
