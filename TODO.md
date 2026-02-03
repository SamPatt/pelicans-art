# TODO

## Sprite Editor Improvements

### 1. Deselect on empty click [DONE]
Allow deselecting elements - clicking on empty canvas area should deselect the currently selected element.

### 2. Collapsible sidebar sections [DONE]
Make sidebar sections collapsible/expandable. Currently only has Characters section, but will be adding Backgrounds and Skits. Each section should have a header that toggles collapse/expand.

### 3. Background management [DONE]
Add ability to view, generate, and edit Backgrounds in the editor. Should work similarly to character sprites:
- List backgrounds in sidebar
- Preview selected background
- Generate new backgrounds via AI command palette
- Edit existing backgrounds via AI commands

### 4. Skit management [DONE]
Add ability to work with skits from the command AI palette:
- Generate new skits via AI commands
- Display skit structure/script in editor
- Edit skits via AI commands
- View button that opens skit in the player page (skit-player-v3.html)

### 5. Voice selection for characters [DONE]
Add voice selection UI for characters, possibly in a new collapsible section below Animation Preview:
- List available voices
- Preview voice samples
- Assign voice to current character
- Save voice settings to sprite meta.json
