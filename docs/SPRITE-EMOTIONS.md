# Sprite Construction & Emotion Reference

Complete guide for building expressive SVG character sprites.

## Sprite Structure

### Coordinate System
All sprites use a `100x150` viewBox:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150" width="100" height="150">
```
- **Width:** 100 units
- **Height:** 150 units  
- **Center X:** 50
- **Head center Y:** ~45-55
- **Body center Y:** ~100-110

### Layer Order (bottom to top)
1. Body/clothing
2. Head (back/hair if applicable)
3. Face base
4. Eyes (whites, then pupils)
5. Eyebrows
6. Nose
7. Mouth

### Required Groups for Animation
```svg
<g id="body">...</g>
<g id="head-top">
  <!-- Hair, face shape, eyes, eyebrows, nose -->
</g>
<g id="head-bottom">
  <!-- Mouth area - separates for head tilt animation -->
  <!-- Must contain #mouth-closed and #mouth-open for lip sync -->
</g>
```

## Body Construction

### Simple Geometric (Style A)
```svg
<!-- Rectangle body -->
<rect x="35" y="70" width="30" height="50" fill="#37474f"/>
<!-- Optional: clothing detail -->
<rect x="40" y="75" width="20" height="8" fill="#fff"/>
```

### Round/Cute (Style B)
```svg
<!-- Ellipse body -->
<ellipse cx="50" cy="105" rx="22" ry="35" fill="#ff9800"/>
<!-- Chest/belly marking -->
<ellipse cx="50" cy="100" rx="15" ry="22" fill="#ffe0b2"/>
```

### With Tail (animals)
```svg
<!-- Curved tail using path -->
<path d="M75 110 Q95 90 90 70" stroke="#ff9800" stroke-width="10" fill="none" stroke-linecap="round"/>
```

## Head Construction

### Basic Round Head
```svg
<!-- Main head shape -->
<ellipse cx="50" cy="50" rx="20" ry="24" fill="#ffcc80"/>
```

### With Hair
```svg
<!-- Hair behind/above face -->
<ellipse cx="50" cy="32" rx="22" ry="16" fill="#5d4037"/>
<!-- Face on top -->
<ellipse cx="50" cy="50" rx="20" ry="24" fill="#ffcc80"/>
```

### Animal Ears
```svg
<!-- Triangle ears using polygon -->
<polygon points="28,45 35,20 45,45" fill="#ff9800"/>
<!-- Inner ear -->
<polygon points="32,42 36,28 42,42" fill="#ffcc80"/>
```

## Eye Construction

### Basic Eye Structure
```svg
<!-- Eye white -->
<ellipse cx="40" cy="42" rx="4" ry="3" fill="#fff"/>
<!-- Pupil -->
<circle cx="40" cy="42" r="2" fill="#000"/>
```

### Eye Sizing by Emotion
| Emotion | White rx/ry | Pupil r | Notes |
|---------|-------------|---------|-------|
| Neutral | 4/3 | 2 | Standard |
| Surprised | 5/5 | 2 | Rounder, bigger |
| Angry | 4/2.5 | 2 | Narrower vertically |
| Tired | 4/2 | 1.5 | Very narrow slit |
| Excited | 5/5 | 2.5 | Big with highlights |

### Pupil Position for Look Direction
```svg
<!-- Looking right: shift pupil cx +1.5 -->
<circle cx="41.5" cy="42" r="2" fill="#000"/>
<!-- Looking left: shift pupil cx -1.5 -->
<circle cx="38.5" cy="42" r="2" fill="#000"/>
<!-- Looking down: shift pupil cy +1.5 -->
<circle cx="40" cy="43.5" r="2" fill="#000"/>
```

### Eye Highlights (for excitement/surprise)
```svg
<!-- Small white circle in upper portion of eye -->
<circle cx="38" cy="40" r="1.5" fill="#fff"/>
```

### Closed/Happy Eyes (curved lines instead of shapes)
```svg
<!-- Replace eye shapes with curved paths -->
<path d="M36 42 Q40 38 44 42" stroke="#000" stroke-width="2" fill="none"/>
```

### Alien/Large Eyes
```svg
<!-- Larger ellipses, colored pupils -->
<ellipse cx="38" cy="40" rx="10" ry="14" fill="#000"/>
<ellipse cx="38" cy="40" rx="5" ry="7" fill="#e8f5e9"/>
```

## Eyebrow Construction

### Basic Flat Eyebrow
```svg
<path d="M34 38 L46 38" stroke="#5d4037" stroke-width="2"/>
```

### Curved Eyebrow
```svg
<path d="M34 38 Q40 35 46 38" stroke="#5d4037" stroke-width="2" fill="none"/>
```

### Bottom Border Technique (for visibility against hair)
Draw a skin-tone line 2px below the eyebrow:
```svg
<!-- Skin border first (below) -->
<path d="M34 40 L46 40" stroke="#ffcc80" stroke-width="2"/>
<!-- Eyebrow on top -->
<path d="M34 38 L46 38" stroke="#5d4037" stroke-width="2"/>
```

### Eyebrow Angles by Emotion

**Neutral** — Flat horizontal:
```svg
<path d="M34 38 L46 38" stroke="#5d4037" stroke-width="2"/>
```

**Happy** — Arched up:
```svg
<path d="M34 38 Q40 35 46 38" stroke="#5d4037" stroke-width="2" fill="none"/>
```

**Sad** — Inner ends HIGH, outer ends low (∩ shape):
```svg
<!-- Left brow: starts outer-low, ends inner-high -->
<path d="M34 40 L46 34" stroke="#5d4037" stroke-width="2"/>
<!-- Right brow: starts inner-high, ends outer-low -->
<path d="M54 34 L66 40" stroke="#5d4037" stroke-width="2"/>
```

**Angry** — Inner ends LOW, outer ends high (V shape pointing down):
```svg
<!-- Left brow: starts outer-high, ends inner-low -->
<path d="M34 36 L46 42" stroke="#5d4037" stroke-width="3"/>
<!-- Right brow: starts inner-low, ends outer-high -->
<path d="M54 42 L66 36" stroke="#5d4037" stroke-width="3"/>
```

**Surprised** — High and arched:
```svg
<path d="M34 34 Q40 30 46 34" stroke="#5d4037" stroke-width="2" fill="none"/>
```

**Skeptical** — One raised, one flat:
```svg
<!-- Left: normal -->
<path d="M34 38 Q40 36 46 38" stroke="#5d4037" stroke-width="2" fill="none"/>
<!-- Right: raised high -->
<path d="M54 36 Q60 32 66 36" stroke="#5d4037" stroke-width="2" fill="none"/>
```

## Nose Construction

### Simple Dot/Circle
```svg
<ellipse cx="50" cy="53" rx="2.5" ry="3" fill="#ffab91"/>
```

### Triangle (cat/animal)
```svg
<polygon points="50,62 46,58 54,58" fill="#ff7043"/>
```

### Subtle Bump
```svg
<ellipse cx="50" cy="53" rx="2" ry="1.5" fill="#ffb74d"/>
```

## Mouth Construction

### Required IDs for Lip Sync
The animation system requires these two elements:
```svg
<g id="head-bottom">
  <!-- Closed mouth - visible by default -->
  <path d="M44 67 Q50 70 56 67" stroke="#5d4037" stroke-width="1.5" fill="none" id="mouth-closed"/>
  <!-- Open mouth - hidden by default, shown when speaking -->
  <ellipse cx="50" cy="68" rx="5" ry="3" fill="#5d4037" opacity="0" id="mouth-open"/>
</g>
```

### Mouth Shapes by Emotion

**Neutral** — Slight curve or flat:
```svg
<path d="M44 55 Q50 58 56 55" stroke="#5d4037" stroke-width="2" fill="none"/>
```

**Happy/Smile** — Upward curve:
```svg
<path d="M42 54 Q50 62 58 54" stroke="#5d4037" stroke-width="2" fill="none"/>
```

**Sad/Frown** — Downward curve:
```svg
<path d="M42 58 Q50 52 58 58" stroke="#5d4037" stroke-width="2" fill="none"/>
```

**Surprised/O** — Open ellipse:
```svg
<ellipse cx="50" cy="56" rx="4" ry="5" fill="#5d4037"/>
```

**Angry/Grimace** — Flat line, optionally with teeth:
```svg
<path d="M42 56 L58 56" stroke="#5d4037" stroke-width="2"/>
<!-- Optional teeth marks -->
<path d="M46 58 L46 54" stroke="#5d4037" stroke-width="1"/>
<path d="M54 58 L54 54" stroke="#5d4037" stroke-width="1"/>
```

**Worried/Wavy** — Squiggle:
```svg
<path d="M42 56 Q46 54 50 56 Q54 58 58 56" stroke="#5d4037" stroke-width="2" fill="none"/>
```

**Smirk** — Asymmetric:
```svg
<path d="M44 55 Q54 60 60 54" stroke="#5d4037" stroke-width="2" fill="none"/>
```

## Complete Emotion Quick Reference

| Emotion | Eyes | Eyebrows | Mouth |
|---------|------|----------|-------|
| Neutral | Normal, centered | Flat | Slight curve |
| Happy | Curved/squint | Arched up | Smile |
| Sad | Droopy, pupils down | ∩ (inner high) | Frown |
| Angry | Narrow | V (inner low) | Grimace |
| Surprised | Wide + highlights | High arch | Open O |
| Worried | Asymmetric | Uneven ∩ | Wavy |
| Skeptical | One narrow | One raised | Smirk |
| Smug | Half-closed | One cocked | Smirk |
| Confused | Different sizes | Asymmetric | Squiggle |
| Tired | Droopy slits | Flat/sag | Slight frown |
| Excited | Big + sparkle | Very high | Big smile |

## Color Palettes

### Human Skin Tones
- Light: `#ffcc80` (face), `#ffb74d` (shadow/nose)
- Medium: `#deb887`, `#d2a679`
- Dark: `#8d6e63`, `#6d4c41`

### Hair Colors
- Brown: `#5d4037`, `#4e342e`
- Blonde: `#ffd54f`, `#ffca28`
- Black: `#212121`, `#000`
- Gray: `#9e9e9e`, `#757575`

### Common Accent Colors
- Blush: `#ffab91`
- Lips: `#e91e63` (if colored)
- Eye whites: `#fff` or `#f5f5f5`

## Animation Classes (CSS)

The player applies these classes for animation:
```css
.character.speaking  /* Triggers mouth open, head tilt */
.character.look-left /* Shifts pupils left */
.character.look-right
.character.look-up
.character.look-down
```

Pupils need class `.pupil` for look direction:
```svg
<circle class="pupil" cx="40" cy="42" r="2" fill="#000"/>
```

## Front vs Back Sprites

### Naming Convention
```
sprites/
  character-front.svg
  character-back.svg
```

### Back Sprite Simplifications
- No facial features needed
- Show back of hair/head
- Include hidden mouth elements for compatibility:
```svg
<g id="head-bottom">
  <ellipse id="mouth-closed" opacity="0" .../>
  <ellipse id="mouth-open" opacity="0" .../>
</g>
```

## Testing Sprites

View examples at:
- `/skit/sprite-showcase.html` — Style comparison
- `/skit/emotion-showcase.html` — Emotion reference
