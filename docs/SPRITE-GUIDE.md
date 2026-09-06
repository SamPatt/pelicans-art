# Sprite Creation Guide

Rules for creating character sprites for AI Improv Theater.

## Art direction

Use the [SVG art-direction prompt](../skills/pelican-theater/references/art-direction.md) for new artwork: a memorable silhouette, clear focal feature, restrained palette, expressive contours and readable separation between shapes. Keep a user-requested style or an existing character’s appearance when revising. This is visual guidance; the animation structure below remains required. Inspect the rendered result at normal and phone size.

## File Structure

Each character needs at minimum:
- `{name}-front.svg` — facing camera

Optionally:
- `{name}-back.svg` — back of head

## SVG Structure

```xml
<svg viewBox="0 0 100 150">
  <g id="body">
    <!-- Body, clothes, arms, etc. -->
  </g>
  <g id="head-top">
    <!-- Hair, face, eyes, eyebrows, nose -->
    <!-- Eyes MUST have these IDs: -->
    <ellipse id="eye-left-white" ... />
    <ellipse id="eye-right-white" ... />
    <circle id="eye-left-pupil" class="pupil" ... />
    <circle id="eye-right-pupil" class="pupil" ... />
    <circle id="eye-left-highlight" ... opacity="0"/>
    <circle id="eye-right-highlight" ... opacity="0"/>
    <!-- Eyebrows MUST have these IDs: -->
    <path id="brow-left" ... />
    <path id="brow-right" ... />
  </g>
  <g id="head-bottom">
    <!-- Mouth MUST have these IDs: -->
    <path id="mouth-closed" ... />
    <ellipse id="mouth-open" ... opacity="0"/>
  </g>
</svg>
```

## Critical: Mouth Alignment

**The `mouth-open` and `mouth-closed` elements MUST be at the same vertical position.**

The talking animation fades between these two states. If they're misaligned, the mouth will appear to jump when transitioning.

### Correct Example:
```xml
<path id="mouth-closed" d="M44 71 Q50 74 56 71" ... />  <!-- centered at y≈72 -->
<ellipse id="mouth-open" cx="50" cy="72" rx="5" ry="3" ... />  <!-- cy=72 -->
```

### Wrong Example:
```xml
<path id="mouth-closed" d="M44 60 Q50 63 56 60" ... />  <!-- centered at y≈61 -->
<ellipse id="mouth-open" cx="50" cy="72" rx="5" ry="3" ... />  <!-- cy=72 — WRONG! -->
```

## Eye Direction

Pupils use the `.pupil` class for CSS-driven eye direction. The player adds classes like `look-left`, `look-right` that shift pupils.

## Emotions

The emotion system modifies:
- Eyebrow paths (brow-left, brow-right)
- Eye highlights (for surprised/excited)
- Mouth-closed path shape

See `EMOTIONS` object in the player for the specific transforms.

## Scale

Characters can have a `scale` property (e.g., 0.6 for leprechaun). The transform uses `transform-origin: bottom center` so scaled characters stay grounded.

## Facing Direction

Characters at x > 50 are automatically flipped with `scaleX(-1)`. Design sprites facing right (toward positive X).

## Checklist

- [ ] File named `{name}-front.svg`
- [ ] ViewBox is `0 0 100 150`
- [ ] Has `id="body"`, `id="head-top"`, `id="head-bottom"` groups
- [ ] Eyes have proper IDs and `.pupil` class on pupils
- [ ] Eyebrows have `id="brow-left"` and `id="brow-right"`
- [ ] Mouth has `id="mouth-closed"` and `id="mouth-open"`
- [ ] **mouth-open and mouth-closed are vertically aligned**
- [ ] mouth-open has `opacity="0"` initially
- [ ] Eye highlights have `opacity="0"` initially
