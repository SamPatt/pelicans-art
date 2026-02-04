# TODO

## Voice System Enhancements

### 1. Voice Controls in Say Action
Determine what voice parameters we can control (pitch, speed, volume, emotion, etc.) and add UI to the "Say" action modal to modify voice output. Research the TTS API capabilities and expose useful controls.

### 2. Line Interruption System
Add the ability for characters to interrupt each other mid-speech. Currently lines always play to completion. Consider approaches:
- Overlap mode: Start new line before previous finishes
- Cut mode: Abruptly stop previous line
- Fade mode: Quick fade-out of interrupted line
- Timing controls: How much overlap/delay before interrupt

### 3. Fix Voice Settings Display
The voice settings UI in the editor is not working properly. Debug and fix the display issues.

### 4. Voice Cloning Feature
Add voice cloning to voice settings:
- Allow users to upload a .wav file as a voice sample
- Preview the cloned voice with test text
- Name and save the voice if satisfied
- Add saved voice to the approved list of usable voices
- Store voice samples appropriately (local or server)

## Animation & Visuals

### 5. Rework Emotions System
Rework the emotion system, specifically the "surprise" emotion which isn't displaying correctly. Review all emotion configs and ensure they work properly across different sprite types (human, creature, trump-v3, etc.).

## Research & Architecture

### 6. Feature Gap Analysis
Research the highest-value missing features to make this a proper comedy skit creation / animation studio tool:
- Survey similar tools (Plotagon, Vyond, GoAnimate, etc.)
- Identify key workflows for comedy writers
- List priority features: sound effects, music, transitions, timing tools, etc.
- Consider collaboration features

### 7. Codebase Refactoring Investigation
The main files (skit-player.html, sprite-editor.html, renderer.js) have grown very large. Investigate refactoring:
- Identify logical module boundaries
- Consider component-based architecture
- Evaluate build tools (Vite, esbuild, etc.)
- Plan migration path that doesn't break existing functionality
- Document current architecture first

---

## Completed (from previous TODO)

- [x] Deselect on empty click
- [x] Collapsible sidebar sections
- [x] Background management
- [x] Skit management
- [x] Voice selection for characters
- [x] Props system (spawn, hold, move, animate)
- [x] Enhanced look action (characters, props, positions, vertical movement)
