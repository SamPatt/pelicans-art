# TODO

## Voice System Enhancements

### 1. Voice Controls in Say Action
Determine what voice parameters we can control (pitch, speed, volume, emotion, etc.) and add UI to the "Say" action modal to modify voice output. Research the TTS API capabilities and expose useful controls.

### 2. Voice Cloning Feature
Add voice cloning to voice settings:
- Allow users to upload a .wav file as a voice sample
- Preview the cloned voice with test text
- Name and save the voice if satisfied
- Add saved voice to the approved list of usable voices
- Store voice samples appropriately (local or server)

## Research & Architecture

### 3. Feature Gap Analysis
Research the highest-value missing features to make this a proper comedy skit creation / animation studio tool:
- Survey similar tools (Plotagon, Vyond, GoAnimate, etc.)
- Identify key workflows for comedy writers
- List priority features: sound effects, music, transitions, timing tools, etc.
- Consider collaboration features

### 4. Codebase Refactoring Investigation
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
- [x] Line interruption system
- [x] Fix voice settings display
- [x] Rework emotions system
