# Pelicans.art Design Document

## Brand Identity

**Pelicans.art** is a community platform where people create, watch, and share animated improv skits using cartoony SVG characters. The brand is playful, warm, and slightly absurd — like a pelican itself. The design should feel like a friendly seaside bulletin board, not a tech product.

**Tagline idea:** *"Stuff it in the pouch"* (referencing how pelicans scoop everything up — characters, backgrounds, props — into their skits)

---

## Color System

Derived directly from the pelican's natural palette, with a coastal water accent.

### Primary Palette

```
--pouch-orange:     #F5A623   /* Warm amber — the iconic throat pouch */
--pouch-light:      #FFCC80   /* Soft peach — pouch underside highlight */
--pouch-deep:       #E8871E   /* Darker amber — pouch shadow, hover states */

--plumage-white:    #F7F5F0   /* Off-white — pelican body, page backgrounds */
--plumage-cream:    #EDE8DF   /* Warm cream — card backgrounds, panels */

--wing-dark:        #2D2D2D   /* Near-black — primary text, dark accents */
--wing-gray:        #5A5A5A   /* Charcoal — secondary text */
--wing-tip:         #424242   /* Dark gray — like the wing tip feathers */

--ocean-blue:       #2D8EC4   /* Coastal blue — links, interactive elements */
--ocean-deep:       #1B6B96   /* Deeper blue — hover states, active tabs */
--ocean-shallow:    #B8DFF0   /* Pale blue — subtle highlights, badges */
--ocean-foam:       #E8F4F9   /* Near-white blue — hover backgrounds */
```

### Functional Colors

```
--bill-yellow:      #FFB300   /* Bright amber — warnings, stars, favorites */
--bill-ridge:       #FF8F00   /* Deep gold — emphasis, important badges */

--mouth-red:        #E05544   /* Warm red from the open mouth — errors, delete */
--mouth-pink:       #F48FB1   /* Soft pink — notifications badge */

--sand-warm:        #D4C5A9   /* Sandy beige — dividers, subtle borders */
--sand-pale:        #EDE6D6   /* Pale sand — alternate row backgrounds */

--sky-light:        #87CEEB   /* Sky blue — top gradients, decorative */
--water-dark:       #1A4A62   /* Dark teal — footer, dark sections */
```

### Dark Mode (for the Player)

The player experience uses a darker palette so the stage pops. This is the one place we go dark:

```
--player-bg:        #0F1923   /* Deep ocean night */
--player-surface:   #1A2A38   /* Slightly lighter panels */
--player-border:    #2A3A4A   /* Subtle borders */
--player-text:      #E8E4DF   /* Warm off-white text */
```

### Gradient Recipes

```css
/* Hero / header gradient — ocean horizon */
background: linear-gradient(180deg, #87CEEB 0%, #2D8EC4 40%, #1B6B96 100%);

/* Warm CTA button — pouch gradient */
background: linear-gradient(135deg, #F5A623 0%, #E8871E 100%);

/* Card hover glow — subtle warmth */
box-shadow: 0 4px 20px rgba(245, 166, 35, 0.15);

/* Player background — deep water at night */
background: linear-gradient(180deg, #1A2A38 0%, #0F1923 100%);
```

---

## Typography

Keep it simple and cartoony. Two fonts max.

```css
/* Display / headings — round, friendly */
--font-display: 'Fredoka', 'Nunito', system-ui, sans-serif;

/* Body / UI — clean and readable */
--font-body: 'Nunito Sans', 'Inter', system-ui, sans-serif;

/* Code / technical (editor only) */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

**Fredoka** has thick, bubbly letterforms that match the cartoony SVG style. **Nunito Sans** is its readable companion for body text. Both are free on Google Fonts.

### Type Scale

```
--text-xs:    12px    /* Timestamps, metadata */
--text-sm:    14px    /* Secondary text, captions */
--text-base:  16px    /* Body text */
--text-lg:    18px    /* Card titles, section headers */
--text-xl:    22px    /* Page subtitles */
--text-2xl:   28px    /* Page titles */
--text-3xl:   36px    /* Hero headline */
```

Headings are always **--wing-dark** (#2D2D2D). Body text is **--wing-gray** (#5A5A5A). Links are **--ocean-blue** (#2D8EC4).

---

## Border & Shape Language

Everything should feel rounded and soft — like a pelican's body is made of smooth curves.

```
--radius-sm:    6px     /* Small buttons, tags */
--radius-md:    12px    /* Cards, panels */
--radius-lg:    20px    /* Modals, hero sections */
--radius-full:  9999px  /* Pills, avatar circles */
```

No sharp corners anywhere. Even the stage viewport gets rounded corners.

### Borders

```
--border-subtle:   1px solid #EDE8DF   /* Panel edges on light bg */
--border-sand:     1px solid #D4C5A9   /* More visible dividers */
--border-ocean:    2px solid #2D8EC4   /* Active/focus states */
--border-pouch:    2px solid #F5A623   /* Selected/highlighted */
```

---

## Component Design

### Buttons

**Primary (Pouch Button)** — The main CTA. Warm and inviting.
```
Background:  gradient(#F5A623 → #E8871E)
Text:        #FFFFFF, bold
Border:      none
Radius:      --radius-full (pill shape)
Padding:     10px 24px
Shadow:      0 2px 8px rgba(245, 166, 35, 0.3)
Hover:       brighten 10%, shadow grows
Active:      darken 5%, shadow shrinks
```

**Secondary (Ocean Button)** — For less prominent actions.
```
Background:  transparent
Text:        #2D8EC4
Border:      2px solid #2D8EC4
Radius:      --radius-full
Padding:     10px 24px
Hover:       bg fills to #E8F4F9
Active:      bg fills to #B8DFF0
```

**Ghost Button** — Subtle, for toolbars.
```
Background:  transparent
Text:        #5A5A5A
Border:      none
Radius:      --radius-sm
Padding:     8px 12px
Hover:       bg #EDE8DF
```

### Cards

The main content container across all pages.

```
Background:  #FFFFFF
Border:      1px solid #EDE8DF
Radius:      --radius-md (12px)
Shadow:      0 1px 4px rgba(0, 0, 0, 0.06)
Padding:     16px

Hover state:
  Shadow:    0 4px 20px rgba(245, 166, 35, 0.12)
  Border:    1px solid #D4C5A9
  Transform: translateY(-2px)
  Transition: all 0.2s ease
```

### Tags / Badges

Small pill-shaped labels for categories and metadata.

```
Characters:   bg #E8F4F9, text #1B6B96, border #B8DFF0
Backgrounds:  bg #EDE6D6, text #8B7355, border #D4C5A9
Props:        bg #FFF3E0, text #E8871E, border #FFCC80
Skits:        bg #FCE4EC, text #C62828, border #F48FB1
New:          bg #F5A623, text #FFFFFF (solid pouch badge)
```

### Navigation

Top nav bar — clean, minimal, warm.

```
Background:    #FFFFFF
Border-bottom: 2px solid #EDE8DF
Height:        60px
Padding:       0 24px

Logo:          "pelicans" in Fredoka, --wing-dark
               ".art" in Fredoka, --pouch-orange

Nav links:     --wing-gray, 16px
Active link:   --ocean-blue, underline 2px --pouch-orange (offset 4px below)
Hover:         --wing-dark
```

The nav includes: **Create** | **Watch** | **Community** | [user avatar]

### Tooltips

Rounded, dark, with a slight pelican flair.

```
Background:  #2D2D2D
Text:        #F7F5F0
Radius:      --radius-sm
Padding:     6px 12px
Font-size:   --text-sm
Arrow:       CSS triangle, matches bg
```

---

## Page Designs

### 1. Landing / Home

The front door of pelicans.art. Warm, inviting, immediate.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  pelicans.art     Create  Watch  Community  │  ← Nav
├─────────────────────────────────────────────┤
│                                             │
│     🎭 Make silly cartoons talk.            │  ← Hero (ocean gradient bg)
│     AI-powered improv with cartoony         │     Fredoka heading, white text
│     characters you create.                  │     Decorative SVG pelican to the right
│                                             │
│     [ Start Creating ]  [ Watch Skits ]     │  ← Pouch button + Ocean button
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ▶ Featured Skits                           │  ← Auto-playing skit previews
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │     Cards with thumbnails
│  │ skit │ │ skit │ │ skit │ │ skit │      │     Horizontal scroll on mobile
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  How It Works                               │  ← 3-step illustration
│  1. Pick characters  2. Write a scene       │     Simple SVG icons in circles
│  3. Watch them perform                      │     Pouch-orange accent numbers
│                                             │
├─────────────────────────────────────────────┤
│  New Characters      Popular Backgrounds    │  ← Community highlight
│  ┌────┐ ┌────┐      ┌──────┐ ┌──────┐     │
│  │cat │ │bat │      │ park │ │beach │     │
│  └────┘ └────┘      └──────┘ └──────┘     │
├─────────────────────────────────────────────┤
│  pelicans.art · made with 🐦                │  ← Footer (--water-dark bg)
└─────────────────────────────────────────────┘
```

**Hero Section Details:**
- Background: ocean gradient (#87CEEB → #2D8EC4 → #1B6B96)
- A simple cartoony pelican SVG on the right, slightly tilted, mouth open
- White Fredoka text, big and friendly
- Two buttons: primary pouch CTA, secondary ocean outline
- Subtle wave SVG pattern along the bottom edge of the hero

### 2. Skit Player

Where people watch the animated skits. Dark mode — the stage is the star.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  pelicans.art     Create  Watch  Community  │  ← Nav (dark variant)
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │                                       │  │
│  │                                       │  │
│  │            THE STAGE                  │  │  ← Canvas/DOM viewport
│  │         (SVG characters               │  │     Dark bg, rounded corners
│  │          on background)               │  │     Subtle glow border on hover
│  │                                       │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  "Office Shenanigans" by @pelican_fan       │  ← Title + author
│                                             │
│  ◄◄  ▶  ►►   ━━━━━━●━━━━━━  1:23 / 3:45   │  ← Controls bar
│                                  🔊  ⛶     │     Pouch-orange progress fill
│                                             │
│  ┌─ Script ─────────────────────────────┐   │  ← Collapsible script panel
│  │ [Pelican]: "I ate a fish THIS big"   │   │     Light text on dark surface
│  │ [Cat]: "That's your foot."           │   │     Active line highlighted with
│  │ > [Pelican]: "...still counts"  ◄── │   │     a left border in pouch-orange
│  └──────────────────────────────────────┘   │
│                                             │
│  ♥ 42    💬 7    ↗ Share                    │  ← Social bar
│                                             │
├─────────────────────────────────────────────┤
│  More Skits ──────────                      │  ← Related skits
│  ┌──────┐ ┌──────┐ ┌──────┐               │
│  └──────┘ └──────┘ └──────┘               │
└─────────────────────────────────────────────┘
```

**Player-Specific Design:**
- Background: `--player-bg` (#0F1923) — deep ocean at night
- Stage viewport: rounded 12px corners, subtle `box-shadow: 0 0 30px rgba(45, 142, 196, 0.1)` blue glow
- Progress bar track: `--player-border`, fill: `--pouch-orange` gradient
- Play button: circle, `--pouch-orange` fill, white triangle icon
- Controls text: `--player-text`
- Active script line: left border 3px `--pouch-orange`, slightly brighter text
- The player is the ONE page that stays dark. It's a theater — the lights are down.

**Portrait Mode (Mobile/Shorts):**
- Stage goes full-width, 9:16 ratio
- Controls overlay at bottom with semi-transparent backdrop
- Script panel hidden by default, swipe-up to reveal

### 3. Skit Editor (Create)

The creative workspace. Light mode for long editing sessions — easier on the eyes.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  pelicans.art     [Save Draft] [Preview] [Publish]      │  ← Editor nav
├────────┬──────────────────────────────┬─────────────────┤
│        │                              │                 │
│ SCENE  │        STAGE PREVIEW         │   PROPERTIES    │
│ LIST   │                              │                 │
│        │  ┌──────────────────────┐    │   Character:    │
│ Sc 1 ◄─│  │                      │    │   [Pelican ▼]   │
│ Sc 2   │  │   Live preview of    │    │                 │
│ Sc 3   │  │   the current scene  │    │   Position:     │
│ + Add  │  │                      │    │   x [━━●━━━]    │
│        │  └──────────────────────┘    │   y [━━━━●━]    │
│        │                              │                 │
│ ───────│  TIMELINE                    │   Emotion:      │
│        │  ━━●━━━━━━━━━━━  0:03/0:15  │   😊 😠 😢 😱   │
│ ASSETS │                              │                 │
│        │  DIALOGUE                    │   Voice:        │
│ 🐦 Pel │  ┌──────────────────────┐    │   [Marius ▼]    │
│ 🐱 Cat │  │ Pelican: "I ate a    │    │   Pitch: [━●━]  │
│ 🏞 Park│  │ fish THIS big"       │    │   Speed: [━●━]  │
│ ☕ Mug │  │ + Add line           │    │                 │
│        │  └──────────────────────┘    │   Animation:    │
│        │                              │   [bounce ▼]    │
├────────┴──────────────────────────────┴─────────────────┤
│  Auto-saved 2s ago                    Ctrl+Z  Ctrl+S    │
└─────────────────────────────────────────────────────────┘
```

**Editor Design Details:**

- **Background:** `--plumage-cream` (#EDE8DF) for the workspace panels
- **Center stage preview:** white background card with subtle shadow, rounded corners
- **Left sidebar (scene list + assets):**
  - Background: `--plumage-white` (#F7F5F0)
  - Asset items show SVG thumbnail + name
  - Draggable onto stage
  - Active scene: left border 3px `--pouch-orange`
- **Right sidebar (properties):**
  - Background: `--plumage-white`
  - Sliders use `--pouch-orange` for the thumb and filled track
  - Emotion picker: grid of simple emoji-style buttons, selected one gets `--border-pouch` ring
- **Timeline bar:**
  - Track: `--sand-warm`, filled portion: `--ocean-blue`
  - Keyframe dots: `--pouch-orange` circles on the track
  - Playhead: vertical line in `--mouth-red`
- **Dialogue panel:**
  - Each line is a card with character avatar (tiny SVG), character name in `--ocean-blue`, and editable text
  - Add line button: dashed border, ghost style
- **Publish button:** Pouch gradient, prominent, top-right
- **Save Draft:** Ghost button, shows green check when saved

**Key Interactions:**
- Drag characters from asset sidebar onto stage
- Click a character on stage to select → properties panel updates
- Timeline scrubbing with visual keyframes
- Inline dialogue editing with character avatars

### 4. Community Page

A browsable gallery of shared assets and skits. Light, airy, lots of visual previews.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  pelicans.art     Create  Watch  Community  │  ← Nav
├─────────────────────────────────────────────┤
│                                             │
│  Community                                  │  ← Page title
│  Browse characters, backgrounds, and props  │
│  shared by the flock.                       │
│                                             │
│  [ Characters ][ Backgrounds ][ Props ]     │  ← Category tabs (pill shape)
│  [ Skits ]                                  │     Active: pouch-orange bg
│                                             │
│  Sort: [Newest ▼]    Search: [🔍        ]  │  ← Filters bar
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │          │ │          │ │          │   │
│  │  [SVG]   │ │  [SVG]   │ │  [SVG]   │   │  ← Asset cards
│  │          │ │          │ │          │   │     Square thumbnail area
│  ├──────────┤ ├──────────┤ ├──────────┤   │     White bg card
│  │ Pelican  │ │ Cat      │ │ Pirate   │   │     Name + author + use count
│  │ @author  │ │ @author  │ │ @author  │   │
│  │ ♥ 12  ↓5│ │ ♥ 34  ↓8│ │ ♥ 7  ↓23│   │
│  └──────────┘ └──────────┘ └──────────┘   │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │          │ │          │ │          │   │
│  │  [SVG]   │ │  [SVG]   │ │  [SVG]   │   │
│  │  ...     │ │  ...     │ │  ...     │   │
│  └──────────┘ └──────────┘ └──────────┘   │
│                                             │
│  [ Load More ]                              │  ← Ocean button, centered
│                                             │
└─────────────────────────────────────────────┘
```

**Community Design Details:**

- **Asset card thumbnail area:**
  - Background: `--ocean-foam` (#E8F4F9) for characters, `--sand-pale` for backgrounds
  - SVG rendered at display scale, centered
  - Hover: SVG does a tiny bounce animation (translateY(-4px) + return)
- **Category tabs:**
  - Pill-shaped (`--radius-full`)
  - Inactive: `--plumage-cream` bg, `--wing-gray` text
  - Active: `--pouch-orange` bg, white text
  - Count badge: small circle with count, `--ocean-shallow` bg
- **Search bar:**
  - Rounded pill shape
  - `--plumage-white` bg, `--sand-warm` border
  - Focus: `--border-ocean` with subtle blue glow
- **Card metadata:**
  - Heart icon in `--mouth-red` when favorited, `--wing-gray` otherwise
  - Download count with subtle arrow icon
  - Author name as link in `--ocean-blue`
- **Grid:** 3 columns desktop, 2 columns tablet, 1 column mobile. Gap: 20px.

**Skit Cards (when "Skits" tab active):**
- Wider aspect ratio (16:9 thumbnail)
- Shows a frozen frame from the skit as preview
- Play button overlay (semi-transparent circle with triangle)
- Duration badge in bottom-right corner
- Character avatars listed as small circles below title

---

## Iconography

Use simple, thick-stroked SVG icons that match the sprite art style:

- **Stroke width:** 2-2.5px
- **Corners:** Round linecap, round linejoin
- **Style:** Minimal, cartoony — like icons a pelican would draw with its bill
- **Color:** Inherit from context (usually `--wing-gray` or `--wing-dark`)

Common icons needed:
- Play / Pause / Stop / Skip (transport controls)
- Heart (favorite)
- Download (use in community)
- Share (arrow up-right)
- Search (magnifying glass)
- Plus (add)
- Pencil (edit)
- Trash (delete)
- Speaker (volume)
- Grid / List (view toggle)
- Character / Background / Prop (category icons — could be simple silhouettes)

---

## Motion & Animation

Keep animations bouncy and playful — like the character sprites themselves.

```css
/* Standard ease for UI transitions */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);

/* Bouncy ease for playful elements */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Quick for micro-interactions */
--duration-fast: 150ms;

/* Standard for state changes */
--duration-normal: 250ms;

/* Slow for page transitions */
--duration-slow: 400ms;
```

**Animation Patterns:**

| Element | Trigger | Animation |
|---------|---------|-----------|
| Cards | Hover | Float up 2px, shadow grows, 200ms bounce ease |
| Buttons | Hover | Brighten, subtle scale(1.02), 150ms |
| Buttons | Click | Scale(0.97) snap, 100ms |
| Tabs | Switch | Underline slides with 250ms ease |
| Asset thumbnail | Hover | Tiny bounce (up 4px + return), 300ms bounce ease |
| Modal | Open | Fade in + slide up 20px, 300ms |
| Toast notification | Appear | Slide in from right, 250ms |
| Sidebar panel | Expand | Slide out with 300ms ease |
| Loading state | Ongoing | Pelican SVG with bill opening/closing on loop |

**Loading Spinner:**
Instead of a generic spinner, use a tiny animated pelican: the bill opens and closes rhythmically, as if "gulping" the content being loaded. Simple 3-frame CSS animation using the existing mouth-open/mouth-closed toggle.

---

## Spacing System

```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
```

General rules:
- Card padding: `--space-4`
- Section gaps: `--space-8` to `--space-12`
- Inline element gaps: `--space-2` to `--space-3`
- Page max-width: 1200px (community/watch), full-width (editor)
- Page side padding: `--space-6` desktop, `--space-4` mobile

---

## Responsive Breakpoints

```
--bp-mobile:    480px    /* Small phones */
--bp-tablet:    768px    /* Tablets, large phones */
--bp-desktop:   1024px   /* Standard desktop */
--bp-wide:      1400px   /* Wide monitors */
```

**Responsive Behavior by Page:**

| Page | Mobile | Tablet | Desktop |
|------|--------|--------|---------|
| Home | Single column, stacked hero | Two-column grids | Full layout |
| Player | Full-width stage, overlay controls | Centered with side margins | Centered, max-width 900px |
| Editor | Tab-based (stage/assets/props panels as tabs) | Two-panel (stage + one sidebar) | Three-panel layout |
| Community | 1-col grid | 2-col grid | 3-col grid |

---

## Shadows

```
--shadow-sm:    0 1px 3px rgba(0, 0, 0, 0.06);
--shadow-md:    0 2px 8px rgba(0, 0, 0, 0.08);
--shadow-lg:    0 4px 20px rgba(0, 0, 0, 0.10);
--shadow-glow:  0 0 20px rgba(245, 166, 35, 0.15);    /* Pouch glow */
--shadow-ocean: 0 0 20px rgba(45, 142, 196, 0.12);     /* Ocean glow */
```

---

## Personality Details

Small touches that make pelicans.art feel uniquely "pelican":

1. **Wave divider** — Instead of flat `<hr>` dividers, use an SVG wave pattern in `--ocean-shallow`. Subtle, repeating, like gentle water lapping.

2. **Empty states** — When a list is empty (no skits, no search results), show the pelican SVG looking confused with a speech bubble: *"Nothing in the pouch yet!"*

3. **404 page** — Pelican looking at an empty fish bucket. *"This page swam away."*

4. **Favicons** — Simplified pelican head silhouette in `--pouch-orange` on white.

5. **Cursor** — Default cursor everywhere (don't get cute), but the loading cursor could be a tiny pelican bill.

6. **Success toast** — Green-tinted card with pelican giving a thumbs-up (wing-up). *"Saved!"*

7. **Footer** — Dark `--water-dark` background with subtle wave pattern at top edge. Centered pelicans.art logo, links, and a small tagline.

8. **Sound on/off toggle** — Instead of a generic speaker icon, use a pelican head: mouth open = sound on, mouth closed = sound off.

---

## Accessibility Notes

- All text meets WCAG AA contrast ratios against their backgrounds
- `--wing-dark` on `--plumage-white` = contrast ratio ~13:1
- `--ocean-blue` on `--plumage-white` = contrast ratio ~4.6:1 (passes AA)
- `--pouch-orange` on white = ~3:1 — use ONLY for large text or decorative; never for small body text. Pair with `--wing-dark` text when used as background.
- Focus rings: 2px `--ocean-blue` outline, 2px offset
- Keyboard navigation: all interactive elements reachable via tab
- Reduced motion: respect `prefers-reduced-motion` — disable bounces, use simple fades

---

## Summary: Before → After

| Aspect | Current | Pelicans.art |
|--------|---------|-------------|
| Background | Dark (#0a0a0f, #1a1a2e) | Light cream (#F7F5F0) — except player |
| Accent 1 | Hot pink (#e94560) | Pouch orange (#F5A623) |
| Accent 2 | Teal (#4ecca3) | Ocean blue (#2D8EC4) |
| Font (display) | Courier New (monospace) | Fredoka (rounded, bubbly) |
| Font (body) | System sans-serif | Nunito Sans |
| Corners | 4-8px mixed | Consistently round (6-20px) |
| Mood | Cyberpunk/techy | Coastal/playful/cartoony |
| Dark mode | Everywhere | Player only |
| Personality | Generic | Pelican-themed details throughout |
