# Sprite Emotion Reference

Guide for expressing emotions through eyes and eyebrows in SVG sprites.

## Core Principles

1. **Don't change eye color** for emotions — keep consistent
2. **Eyebrows are the primary emotion driver** — they do most of the heavy lifting
3. **Bottom border on eyebrows** (skin tone) helps them pop against hair
4. **Asymmetry creates complex emotions** — skeptical, confused, worried

## Emotion Reference

### Neutral
- **Eyes:** Normal size, centered pupils
- **Eyebrows:** Flat, horizontal

### Happy
- **Eyes:** Curved/squinting (can be closed curves instead of shapes), slightly raised
- **Eyebrows:** Arched upward, raised slightly
- **Mouth:** Smile curve

### Sad
- **Eyes:** Droopy, pupils looking down
- **Eyebrows:** Inner ends raised HIGH, outer ends lower (∩ shape) — the classic "sad brow"
- **Mouth:** Downturned frown

### Angry
- **Eyes:** Narrowed (smaller vertical size)
- **Eyebrows:** Angled DOWN into center — outer ends high, inner ends low pointing toward nose (V shape)
- **Mouth:** Grimace or flat line, optionally with teeth marks

### Surprised
- **Eyes:** Wide open (bigger), add highlight circles for "sparkle"
- **Eyebrows:** Raised high, arched
- **Mouth:** Open "O" shape

### Worried/Anxious
- **Eyes:** Slightly asymmetric sizes, pupils may be off-center
- **Eyebrows:** Asymmetric — one raised more than other, both angled up in center
- **Mouth:** Wavy/squiggle line

### Skeptical/Suspicious
- **Eyes:** One narrowed, one normal
- **Eyebrows:** One raised high, one flat or lowered
- **Mouth:** Slight smirk or flat

### Smug/Confident
- **Eyes:** Half-closed (narrow slits), relaxed
- **Eyebrows:** One cocked up higher than the other
- **Mouth:** Smirk (asymmetric smile)

### Confused
- **Eyes:** Different sizes, pupils may look in slightly different directions
- **Eyebrows:** Asymmetric angles
- **Mouth:** Squiggle or wavy line

### Tired/Exhausted
- **Eyes:** Droopy lids (very narrow), bags under eyes (subtle curved lines)
- **Eyebrows:** Flat, sagging slightly
- **Mouth:** Slight frown or neutral

### Excited
- **Eyes:** Big and wide with prominent highlights (white circles)
- **Eyebrows:** Very high, strongly arched
- **Mouth:** Big open smile

## Technical Tips

### Eyebrow Implementation (SVG)
```svg
<!-- Bottom skin border first (2px below brow) -->
<path d="M34 40 L46 40" stroke="#ffcc80" stroke-width="2"/>
<!-- Then the actual eyebrow -->
<path d="M34 38 L46 38" stroke="#5d4037" stroke-width="2"/>
```

### Eye Variations
- **Size:** Adjust `rx` and `ry` on ellipses
- **Shape:** Use paths for curved/closed eyes
- **Pupils:** Move `cx`/`cy` for look direction, adjust `r` for dilation
- **Highlights:** Add small white circles for sparkle

### Eyebrow Angles (for straight brows)
```
Sad:      M outer_x outer_y L inner_x (outer_y - 6)  ← inner end UP
Angry:    M outer_x outer_y L inner_x (outer_y + 6)  ← inner end DOWN
Neutral:  M outer_x y L inner_x y                    ← flat
```

### Eyebrow Angles (for curved brows)
```
Happy:    Q control_x (y - 4) end_x end_y  ← arch up
Sad:      Q control_x (y + 4) end_x end_y  ← sag in middle
```

## Viewing Reference

Live examples: `/skit/emotion-showcase.html`
- Alien emotions (Style A - geometric)
- Human emotions (Style A - geometric with hair)

## Character-Specific Notes

### Characters with Hair
- Eyebrows may blend into hair color
- Add skin-tone border BELOW the eyebrow line (not above)
- This creates visual separation without outline

### Characters without Visible Eyebrows (Alien, Robot)
- Use brow ridges, forehead markings, or antenna position
- Keep same emotional mapping (raised = surprised, angled = angry)
- Can be more subtle since other features compensate
