# Sprite Construction & Emotion Reference

Complete guide for building expressive SVG character sprites with the transform-based emotion system.

## Transform-Based Emotion System

The emotion system uses **relative transforms** to animate facial expressions. This means emotions work automatically on any sprite, regardless of face position or size. No special configuration needed!

### How It Works

- **Eye size**: Multiplied by a ratio (e.g., 0.7 = 70% of original height for squinting)
- **Eye position**: Shifted by delta pixels (e.g., -1 = move up 1px)
- **Brows**: Original path preserved, transformed via translate + rotate
- **Mouth**: Original path preserved, transformed via translate + scale

### Available Emotions

| Emotion | Eyes | Brows | Mouth |
|---------|------|-------|-------|
| neutral | Normal | Flat | Normal |
| happy | Squint (0.7x) | Raised (-2), outer up | Tall (1.3x) |
| sad | Slightly closed | Inner raised (+12°) | Compressed (0.7x) |
| angry | Squint (0.7x) | Lowered, furrowed (-15°/+15°) | Tight (0.5x) |
| surprised | Wide (1.4x) | Very high (-5) | Big O (1.8x height) |
| excited | Wide (1.3x) | High (-4) | Tall (1.5x) |
| worried | Slightly closed | Inner raised (+10°) | Compressed (0.8x) |
| smug | Squint (0.75x) | Asymmetric | Slight (1.1x) |
| tired | Very squint (0.5x) | Lowered (+2) | Flat (0.6x) |
| skeptical | Slight squint (0.8x) | One raised | Compressed (0.7x) |
| dead | Squint (0.7x) | Flat | Uses mouth-open |
| scared | Wide (1.3x) | Inner raised | Uses mouth-open |
| thinking | Slight squint (0.9x) | Asymmetric | Compressed (0.8x) |
| confused | Slightly wide (1.1x) | Very asymmetric | Compressed (0.9x) |

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

## Required Element IDs

The emotion system looks for these element IDs:

### Eyes (required for emotions)
```svg
<ellipse id="eye-left-white" cx="40" cy="42" rx="4" ry="3" fill="#fff"/>
<ellipse id="eye-right-white" cx="60" cy="42" rx="4" ry="3" fill="#fff"/>
<circle id="eye-left-pupil" cx="40" cy="42" r="2" fill="#000"/>
<circle id="eye-right-pupil" cx="60" cy="42" r="2" fill="#000"/>
```
Note: Pupils can use either `r` (circle) or `rx/ry` (ellipse).

### Eyebrows (optional, enhances expressions)
```svg
<path id="brow-left" d="M34 38 Q40 35 46 38" stroke="#5d4037" stroke-width="2" fill="none"/>
<path id="brow-right" d="M54 38 Q60 35 66 38" stroke="#5d4037" stroke-width="2" fill="none"/>
```

### Mouth (required for lip sync)
```svg
<!-- Closed mouth - visible by default -->
<path id="mouth-closed" d="M44 67 Q50 70 56 67" stroke="#5d4037" stroke-width="1.5" fill="none"/>
<!-- Open mouth - hidden by default, shown when speaking or for some emotions -->
<ellipse id="mouth-open" cx="50" cy="68" rx="5" ry="3" fill="#5d4037" opacity="0"/>
<!-- Optional: Smile mouth for happy emotion -->
<path id="mouth-smile" d="M42 54 Q50 62 58 54" stroke="#5d4037" stroke-width="2" fill="none" opacity="0"/>
```

### Eye Highlights (optional, shown for excited/surprised)
```svg
<circle id="eye-left-highlight" cx="38" cy="40" r="1.5" fill="#fff" opacity="0"/>
<circle id="eye-right-highlight" cx="58" cy="40" r="1.5" fill="#fff" opacity="0"/>
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
  character-name/
    front.svg
    back.svg
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

1. **emotion-test.html** - Compare emotion approaches across different sprites
2. **sprite-editor.html** - Load sprite, use emotion buttons to test all expressions
3. **skit-player.html** - Play a skit with emote actions to see emotions in action

### Quick Test
To verify your sprite works with emotions:
1. Open `sprite-editor.html`
2. Select your sprite
3. Click through all emotion buttons
4. Verify eyes, brows, and mouth all animate appropriately

## meta.json (Optional)

The `meta.json` file is optional and used primarily for voice settings:

```json
{
  "name": "Character Name",
  "description": "Brief description",
  "tags": ["human", "office"],
  "type": "human",
  "voice": {
    "id": "marius",
    "pitch": 0,
    "speed": 1,
    "volume": 1
  }
}
```

**Note:** The `type` field is for voice selection hints only. Emotions work universally regardless of type.
