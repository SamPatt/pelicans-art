# Implementation Plan for TODO Items

This document provides detailed implementation steps for each item in TODO.md.

---

## 1. Deselect on Empty Click

**Goal:** Clicking on empty canvas area should deselect the currently selected element.

**Estimated Complexity:** Low

### Files to Modify
- `/src/sprite-editor.html` (JavaScript section)

### Current Behavior
The canvas handles clicks for element selection but doesn't have explicit handling for clicks on empty areas.

### Implementation Steps

1. **Identify the canvas click handler**
   - Location: Inside the `<script>` section of `sprite-editor.html`
   - The canvas element is `#svg-canvas` with mouse event listeners

2. **Modify the canvas mousedown handler**
   - Add logic to detect when click target is the canvas background (not an SVG element)
   - Check if `event.target` is the canvas container, the SVG root, or a non-selectable element

3. **Add deselection logic**
   ```javascript
   // In the mousedown handler for #svg-canvas
   svgCanvas.addEventListener('mousedown', (e) => {
     // Check if clicking on background (SVG root or canvas container)
     const target = e.target;
     const svgRoot = svg.documentElement || svg;

     if (target === svgRoot || target === svgCanvas || target.tagName === 'svg') {
       // Deselect current element
       selectElement(null);
       return;
     }
     // ... existing selection logic
   });
   ```

4. **Update `selectElement()` to handle null**
   - Clear the selection box/handles
   - Clear the element tree selection highlight
   - Clear the properties panel or show default state

5. **Test cases**
   - Click on empty canvas area -> element deselects
   - Click on element -> element selects (unchanged)
   - Click on canvas after selection -> deselects
   - Keyboard shortcuts still work after deselect

---

## 2. Collapsible Sidebar Sections

**Goal:** Make sidebar sections collapsible/expandable with toggle headers.

**Estimated Complexity:** Medium

### Files to Modify
- `/src/sprite-editor.html` (HTML structure and JavaScript)
- Inline CSS in the HTML file

### Current Structure
```html
<div class="sidebar" id="left-panel">
  <h3>Characters</h3>
  <div class="sprite-list" id="sprite-list">
    <!-- sprite items -->
  </div>
</div>
```

### Implementation Steps

1. **Create collapsible section component pattern**
   ```html
   <div class="sidebar-section" data-section="characters">
     <div class="section-header" onclick="toggleSection('characters')">
       <span class="section-icon">&#9662;</span> <!-- Down arrow when expanded -->
       <span class="section-title">Characters</span>
       <span class="section-count">(12)</span>
     </div>
     <div class="section-content" id="characters-content">
       <div class="sprite-list" id="sprite-list">
         <!-- items -->
       </div>
     </div>
   </div>
   ```

2. **Add CSS for collapsible behavior**
   ```css
   .sidebar-section {
     border-bottom: 1px solid #3a3a3a;
   }

   .section-header {
     display: flex;
     align-items: center;
     padding: 10px 12px;
     cursor: pointer;
     user-select: none;
     background: #2a2a2a;
   }

   .section-header:hover {
     background: #333;
   }

   .section-icon {
     margin-right: 8px;
     transition: transform 0.2s;
     font-size: 10px;
   }

   .sidebar-section.collapsed .section-icon {
     transform: rotate(-90deg);
   }

   .sidebar-section.collapsed .section-content {
     display: none;
   }

   .section-count {
     margin-left: auto;
     color: #888;
     font-size: 12px;
   }
   ```

3. **Add toggle JavaScript function**
   ```javascript
   function toggleSection(sectionName) {
     const section = document.querySelector(`[data-section="${sectionName}"]`);
     section.classList.toggle('collapsed');

     // Save state to localStorage
     const collapsed = JSON.parse(localStorage.getItem('collapsedSections') || '{}');
     collapsed[sectionName] = section.classList.contains('collapsed');
     localStorage.setItem('collapsedSections', JSON.stringify(collapsed));
   }

   // Restore collapsed state on load
   function restoreCollapsedState() {
     const collapsed = JSON.parse(localStorage.getItem('collapsedSections') || '{}');
     Object.entries(collapsed).forEach(([section, isCollapsed]) => {
       if (isCollapsed) {
         document.querySelector(`[data-section="${section}"]`)?.classList.add('collapsed');
       }
     });
   }
   ```

4. **Create placeholder sections for future content**
   - Characters (existing)
   - Backgrounds (new - Item #3)
   - Skits (new - Item #4)

5. **Update item counts dynamically**
   - When sprites load, update `(12)` count
   - When backgrounds load, update count
   - When skits load, update count

---

## 3. Background Management

**Goal:** Add ability to view, generate, and edit backgrounds in the editor.

**Estimated Complexity:** High

### Files to Modify
- `/src/sprite-editor.html` - Add backgrounds section and preview
- `/server/routes/agent.js` - Ensure background generation works
- `/server/services/storage.js` - Background storage (already exists)
- `/server/routes/backgrounds.js` - Background routes (already exists)

### Current State
- Backgrounds stored as single SVG files in `/src/backgrounds/`
- API routes exist: `GET /api/backgrounds`, `GET /api/backgrounds/:name`
- Agent service supports `type: 'background'` generation

### Implementation Steps

1. **Add Backgrounds section to sidebar**
   ```html
   <div class="sidebar-section" data-section="backgrounds">
     <div class="section-header" onclick="toggleSection('backgrounds')">
       <span class="section-icon">&#9662;</span>
       <span class="section-title">Backgrounds</span>
       <span class="section-count" id="bg-count">(0)</span>
     </div>
     <div class="section-content" id="backgrounds-content">
       <div class="background-list" id="background-list">
         <!-- background items -->
       </div>
     </div>
   </div>
   ```

2. **Create background list item template**
   ```html
   <div class="background-item" data-name="park">
     <div class="bg-thumbnail">
       <!-- Small SVG preview or placeholder -->
     </div>
     <span class="bg-name">park</span>
   </div>
   ```

3. **Add CSS for background items**
   ```css
   .background-item {
     display: flex;
     align-items: center;
     padding: 8px 12px;
     cursor: pointer;
     border-bottom: 1px solid #333;
   }

   .background-item:hover {
     background: #3a3a3a;
   }

   .background-item.active {
     background: #2a4a2a;
   }

   .bg-thumbnail {
     width: 40px;
     height: 30px;
     margin-right: 10px;
     background: #222;
     border-radius: 3px;
     overflow: hidden;
   }

   .bg-thumbnail svg {
     width: 100%;
     height: 100%;
   }
   ```

4. **Load backgrounds on page init**
   ```javascript
   async function loadBackgrounds() {
     const response = await fetch('/api/backgrounds');
     const backgrounds = await response.json();

     const list = document.getElementById('background-list');
     list.innerHTML = backgrounds.map(bg => `
       <div class="background-item" data-name="${bg.name}" onclick="selectBackground('${bg.name}')">
         <div class="bg-thumbnail">
           <img src="/backgrounds/${bg.name}.svg" alt="${bg.name}">
         </div>
         <span class="bg-name">${bg.name}</span>
       </div>
     `).join('');

     document.getElementById('bg-count').textContent = `(${backgrounds.length})`;
   }
   ```

5. **Handle background selection**
   ```javascript
   let currentEditMode = 'sprite'; // 'sprite' | 'background' | 'skit'
   let currentBackground = null;

   async function selectBackground(name) {
     currentEditMode = 'background';
     currentBackground = name;

     // Update UI to show background editing mode
     document.querySelectorAll('.background-item').forEach(el => {
       el.classList.toggle('active', el.dataset.name === name);
     });

     // Clear sprite selection
     document.querySelectorAll('.sprite-item').forEach(el => {
       el.classList.remove('active');
     });

     // Load background into canvas
     const response = await fetch(`/api/backgrounds/${name}`);
     const data = await response.json();
     loadSvgIntoCanvas(data.svg);

     // Update command bar context
     updateCommandContext('background', name);
   }
   ```

6. **Update command bar context display**
   ```javascript
   function updateCommandContext(type, name) {
     const contextEl = document.getElementById('command-context');
     if (type === 'sprite') {
       contextEl.innerHTML = `Editing sprite: <strong>${name}</strong>`;
     } else if (type === 'background') {
       contextEl.innerHTML = `Editing background: <strong>${name}</strong>`;
     } else if (type === 'skit') {
       contextEl.innerHTML = `Editing skit: <strong>${name}</strong>`;
     } else {
       contextEl.innerHTML = 'No selection - describe what to create';
     }
   }
   ```

7. **Update AI command submission**
   - Modify the command submit handler to pass correct `type` based on `currentEditMode`
   - For create mode: detect if user says "background" in command
   ```javascript
   async function submitCommand(command) {
     let type = currentEditMode;
     let mode = currentEditMode !== 'none' ? 'edit' : 'create';

     // Auto-detect type for create mode
     if (mode === 'create') {
       if (command.toLowerCase().includes('background')) {
         type = 'background';
       } else if (command.toLowerCase().includes('skit')) {
         type = 'skit';
       } else {
         type = 'sprite';
       }
     }

     const payload = {
       type,
       mode,
       command,
       current: mode === 'edit' ? getCurrentSvg() : null
     };

     // ... submit to /api/agent/generate
   }
   ```

8. **Handle background save after AI edit**
   - The agent route already handles auto-save for sprites
   - Add similar handling for backgrounds
   ```javascript
   // In /server/routes/agent.js
   if (options.mode === 'edit' && options.type === 'background') {
     const bgName = options.currentName; // Pass from frontend
     await storage.saveBackground(bgName, result.svg);
     websocket.broadcast({ type: 'background:updated', name: bgName });
   }
   ```

9. **Add "New Background" button**
   - Similar to sprite creation flow
   - Clears canvas, sets mode to create

---

## 4. Skit Management

**Goal:** Add ability to work with skits from the command AI palette.

**Estimated Complexity:** High

### Files to Modify
- `/src/sprite-editor.html` - Add skits section, script display
- `/server/routes/skits.js` - Ensure full CRUD works
- `/server/services/storage.js` - Skit storage (already exists)
- `/server/routes/agent.js` - Skit generation handling

### Current State
- Skits stored as JSON in `/data/skits/`
- API routes exist for skits
- Agent service supports `type: 'skit'` generation
- Skit player exists at `skit-player-v3.html`

### Implementation Steps

1. **Add Skits section to sidebar**
   ```html
   <div class="sidebar-section" data-section="skits">
     <div class="section-header" onclick="toggleSection('skits')">
       <span class="section-icon">&#9662;</span>
       <span class="section-title">Skits</span>
       <span class="section-count" id="skit-count">(0)</span>
     </div>
     <div class="section-content" id="skits-content">
       <div class="skit-list" id="skit-list">
         <!-- skit items -->
       </div>
     </div>
   </div>
   ```

2. **Create skit list item template**
   ```html
   <div class="skit-item" data-id="skit-001">
     <span class="skit-icon">&#127917;</span> <!-- Theatre masks -->
     <span class="skit-title">Space Argument</span>
     <button class="skit-play-btn" onclick="openSkitPlayer('skit-001')" title="Play">&#9658;</button>
   </div>
   ```

3. **Load skits on page init**
   ```javascript
   async function loadSkits() {
     const response = await fetch('/api/skits');
     const skits = await response.json();

     const list = document.getElementById('skit-list');
     list.innerHTML = skits.map(skit => `
       <div class="skit-item" data-id="${skit.id}" onclick="selectSkit('${skit.id}')">
         <span class="skit-icon">&#127917;</span>
         <span class="skit-title">${skit.meta?.title || skit.id}</span>
         <button class="skit-play-btn" onclick="event.stopPropagation(); openSkitPlayer('${skit.id}')" title="Play">&#9658;</button>
       </div>
     `).join('');

     document.getElementById('skit-count').textContent = `(${skits.length})`;
   }
   ```

4. **Create skit script display panel**
   - Replace or augment the canvas area when in skit edit mode
   - Show structured view of the skit
   ```html
   <div id="skit-editor-panel" class="skit-editor-panel" style="display: none;">
     <div class="skit-meta">
       <h3 id="skit-title">Untitled Skit</h3>
       <p id="skit-description"></p>
     </div>

     <div class="skit-cast">
       <h4>Cast</h4>
       <div id="skit-cast-list"></div>
     </div>

     <div class="skit-script">
       <h4>Script</h4>
       <div id="skit-script-list"></div>
     </div>
   </div>
   ```

5. **Render skit structure**
   ```javascript
   function renderSkitStructure(skit) {
     // Meta
     document.getElementById('skit-title').textContent = skit.meta?.title || 'Untitled';
     document.getElementById('skit-description').textContent = skit.meta?.description || '';

     // Cast
     const castHtml = Object.entries(skit.cast || {}).map(([id, char]) => `
       <div class="cast-member">
         <span class="cast-id">${id}</span>
         <span class="cast-sprite">${char.sprite}</span>
       </div>
     `).join('');
     document.getElementById('skit-cast-list').innerHTML = castHtml;

     // Script
     const scriptHtml = (skit.script || []).map((action, i) => {
       let content = '';
       switch (action.do) {
         case 'say':
           content = `<strong>${action.who}:</strong> "${action.line}"`;
           break;
         case 'emote':
           content = `<em>${action.who} shows ${action.emotion}</em>`;
           break;
         case 'shot':
           content = `[Camera: ${action.type}]`;
           break;
         case 'enter':
           content = `<em>${action.who} enters from ${action.from}</em>`;
           break;
         case 'exit':
           content = `<em>${action.who} exits to ${action.to}</em>`;
           break;
         default:
           content = JSON.stringify(action);
       }
       return `<div class="script-line" data-index="${i}">${content}</div>`;
     }).join('');
     document.getElementById('skit-script-list').innerHTML = scriptHtml;
   }
   ```

6. **Handle skit selection**
   ```javascript
   let currentSkit = null;

   async function selectSkit(id) {
     currentEditMode = 'skit';
     currentSkit = id;

     // Update UI highlights
     document.querySelectorAll('.skit-item').forEach(el => {
       el.classList.toggle('active', el.dataset.id === id);
     });
     document.querySelectorAll('.sprite-item, .background-item').forEach(el => {
       el.classList.remove('active');
     });

     // Hide canvas, show skit editor
     document.getElementById('svg-canvas').style.display = 'none';
     document.getElementById('skit-editor-panel').style.display = 'block';

     // Load skit data
     const response = await fetch(`/api/skits/${id}`);
     const skit = await response.json();
     renderSkitStructure(skit);

     // Update command context
     updateCommandContext('skit', skit.meta?.title || id);
   }
   ```

7. **Add "View in Player" button**
   ```javascript
   function openSkitPlayer(id) {
     window.open(`/player?skit=${id}`, '_blank');
   }
   ```

8. **Update AI command for skit editing**
   - Pass current skit JSON to agent
   ```javascript
   async function submitCommand(command) {
     let current = null;

     if (currentEditMode === 'skit' && currentSkit) {
       const response = await fetch(`/api/skits/${currentSkit}`);
       current = await response.json();
     }

     const payload = {
       type: currentEditMode,
       mode: currentSkit ? 'edit' : 'create',
       command,
       current: currentEditMode === 'skit' ? JSON.stringify(current) : getCurrentSvg()
     };

     // Submit...
   }
   ```

9. **Handle skit save after AI generation/edit**
   - Parse returned JSON
   - Save via API
   - Refresh skit list
   ```javascript
   // In agent.js or frontend handler
   if (type === 'skit') {
     const skitData = JSON.parse(result);
     const skitId = mode === 'edit' ? options.currentSkitId : generateSkitId();
     await storage.saveSkit(skitId, skitData);
     websocket.broadcast({ type: 'skit:updated', id: skitId });
   }
   ```

10. **Add "New Skit" functionality**
    - Button to clear skit state and enter create mode
    - Command like "create a skit about two aliens arguing over pizza"

---

## 5. Voice Selection for Characters

**Goal:** Add voice selection UI for characters with preview and save to meta.json.

**Estimated Complexity:** Medium-High

### Files to Modify
- `/src/sprite-editor.html` - Add voice selection panel
- `/server/routes/sprites.js` - Ensure meta.json save handles voice
- Voice sample files may need to be organized

### Current State
- Sprite meta.json has voice field structure defined in schema
- Available voices: alba, marius, javert, jean, fantine, cosette, eponine, azelma
- TTS endpoint at `/api/tts` or external `http://100.76.176.67:8001/tts`
- Voice samples exist in `/voice-samples/` (currently just trump-sample.mp3)

### Implementation Steps

1. **Define voice configuration**
   ```javascript
   const AVAILABLE_VOICES = [
     { id: 'alba', name: 'Alba', description: 'Soft, measured female voice' },
     { id: 'marius', name: 'Marius', description: 'Young male voice' },
     { id: 'javert', name: 'Javert', description: 'Stern authoritative male' },
     { id: 'jean', name: 'Jean', description: 'Warm older male voice' },
     { id: 'fantine', name: 'Fantine', description: 'Gentle female voice' },
     { id: 'cosette', name: 'Cosette', description: 'Sweet young female' },
     { id: 'eponine', name: 'Eponine', description: 'Edgy young female' },
     { id: 'azelma', name: 'Azelma', description: 'Playful female voice' }
   ];
   ```

2. **Add Voice section to right panel (below Animation Preview)**
   ```html
   <div class="panel-section collapsible" id="voice-section">
     <div class="section-header" onclick="togglePanelSection('voice-section')">
       <span class="collapse-icon">&#9662;</span>
       Voice Settings
     </div>
     <div class="section-content">
       <div class="voice-selector">
         <label>Voice</label>
         <select id="voice-select" onchange="updateVoiceSelection()">
           <option value="">-- Select Voice --</option>
           <!-- Populated dynamically -->
         </select>
         <button onclick="previewVoice()" id="voice-preview-btn" disabled>
           &#9658; Preview
         </button>
       </div>

       <div class="voice-params">
         <div class="param-row">
           <label>Pitch</label>
           <input type="range" id="voice-pitch" min="-1" max="1" step="0.1" value="0">
           <span id="voice-pitch-val">0</span>
         </div>
         <div class="param-row">
           <label>Speed</label>
           <input type="range" id="voice-speed" min="0.5" max="2" step="0.1" value="1">
           <span id="voice-speed-val">1</span>
         </div>
         <div class="param-row">
           <label>Volume</label>
           <input type="range" id="voice-volume" min="0" max="2" step="0.1" value="1">
           <span id="voice-volume-val">1</span>
         </div>
       </div>

       <button onclick="saveVoiceSettings()" class="save-voice-btn">
         Save Voice Settings
       </button>
     </div>
   </div>
   ```

3. **Add CSS for voice section**
   ```css
   .voice-selector {
     display: flex;
     gap: 8px;
     align-items: center;
     margin-bottom: 12px;
   }

   .voice-selector select {
     flex: 1;
     padding: 6px;
     background: #2a2a2a;
     color: #fff;
     border: 1px solid #444;
     border-radius: 4px;
   }

   #voice-preview-btn {
     padding: 6px 12px;
     background: #4a4a4a;
     border: none;
     border-radius: 4px;
     cursor: pointer;
   }

   #voice-preview-btn:disabled {
     opacity: 0.5;
     cursor: not-allowed;
   }

   .voice-params {
     margin: 12px 0;
   }

   .param-row {
     display: flex;
     align-items: center;
     margin-bottom: 8px;
   }

   .param-row label {
     width: 60px;
     font-size: 12px;
   }

   .param-row input[type="range"] {
     flex: 1;
     margin: 0 8px;
   }

   .param-row span {
     width: 30px;
     text-align: right;
     font-size: 12px;
   }

   .save-voice-btn {
     width: 100%;
     padding: 8px;
     background: #2a6a2a;
     border: none;
     border-radius: 4px;
     color: #fff;
     cursor: pointer;
   }

   .save-voice-btn:hover {
     background: #3a8a3a;
   }
   ```

4. **Populate voice dropdown**
   ```javascript
   function populateVoiceSelector() {
     const select = document.getElementById('voice-select');
     select.innerHTML = '<option value="">-- Select Voice --</option>' +
       AVAILABLE_VOICES.map(v =>
         `<option value="${v.id}">${v.name} - ${v.description}</option>`
       ).join('');
   }
   ```

5. **Load voice settings when sprite selected**
   ```javascript
   function loadSpriteVoiceSettings(meta) {
     const voice = meta?.voice || {};

     document.getElementById('voice-select').value = voice.id || '';
     document.getElementById('voice-pitch').value = voice.pitch || 0;
     document.getElementById('voice-speed').value = voice.speed || 1;
     document.getElementById('voice-volume').value = voice.volume || 1;

     updateVoiceParamDisplays();
     document.getElementById('voice-preview-btn').disabled = !voice.id;
   }
   ```

6. **Voice preview functionality**
   ```javascript
   let currentAudioPreview = null;

   async function previewVoice() {
     const voiceId = document.getElementById('voice-select').value;
     if (!voiceId) return;

     const btn = document.getElementById('voice-preview-btn');
     btn.disabled = true;
     btn.textContent = '...';

     try {
       // Stop any existing preview
       if (currentAudioPreview) {
         currentAudioPreview.pause();
       }

       const testText = `Hello, I am ${currentSpriteName || 'a character'}.`;

       const formData = new FormData();
       formData.append('text', testText);
       formData.append('voice', voiceId);

       const response = await fetch('/api/tts', {
         method: 'POST',
         body: formData
       });

       if (!response.ok) throw new Error('TTS failed');

       const audioBlob = await response.blob();
       const audioUrl = URL.createObjectURL(audioBlob);

       currentAudioPreview = new Audio(audioUrl);
       currentAudioPreview.volume = parseFloat(document.getElementById('voice-volume').value);
       currentAudioPreview.playbackRate = parseFloat(document.getElementById('voice-speed').value);
       await currentAudioPreview.play();

     } catch (err) {
       console.error('Voice preview failed:', err);
       alert('Failed to preview voice');
     } finally {
       btn.disabled = false;
       btn.textContent = '▶ Preview';
     }
   }
   ```

7. **Save voice settings**
   ```javascript
   async function saveVoiceSettings() {
     if (!currentSpriteName) {
       alert('No sprite selected');
       return;
     }

     const voiceSettings = {
       id: document.getElementById('voice-select').value || undefined,
       pitch: parseFloat(document.getElementById('voice-pitch').value),
       speed: parseFloat(document.getElementById('voice-speed').value),
       volume: parseFloat(document.getElementById('voice-volume').value)
     };

     // Get current sprite meta
     const response = await fetch(`/api/sprites/${currentSpriteName}`);
     const sprite = await response.json();

     // Update meta with voice settings
     const updatedMeta = {
       ...sprite.meta,
       voice: voiceSettings
     };

     // Save sprite with updated meta
     const saveResponse = await fetch(`/api/sprites/${currentSpriteName}`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         svg: sprite.svg,
         meta: updatedMeta
       })
     });

     if (saveResponse.ok) {
       showStatus('Voice settings saved', 'success');
     } else {
       showStatus('Failed to save voice settings', 'error');
     }
   }
   ```

8. **Wire up parameter sliders**
   ```javascript
   function updateVoiceParamDisplays() {
     document.getElementById('voice-pitch-val').textContent =
       document.getElementById('voice-pitch').value;
     document.getElementById('voice-speed-val').textContent =
       document.getElementById('voice-speed').value;
     document.getElementById('voice-volume-val').textContent =
       document.getElementById('voice-volume').value;
   }

   // Add event listeners
   ['voice-pitch', 'voice-speed', 'voice-volume'].forEach(id => {
     document.getElementById(id).addEventListener('input', updateVoiceParamDisplays);
   });
   ```

9. **Ensure sprite save API preserves voice in meta**
   - Already handled if the PUT /api/sprites/:name accepts full meta object
   - Verify in `/server/routes/sprites.js`

---

## Implementation Order Recommendation

1. **Deselect on empty click** (Low complexity, quick win)
2. **Collapsible sidebar sections** (Foundation for #3 and #4)
3. **Background management** (Builds on #2)
4. **Skit management** (Builds on #2, most complex)
5. **Voice selection** (Independent, can be done in parallel)

---

## Testing Checklist

### Deselect on Empty Click
- [ ] Click empty canvas deselects element
- [ ] Selection box disappears
- [ ] Properties panel clears or shows default
- [ ] Element tree selection clears
- [ ] Clicking elements still works

### Collapsible Sidebar
- [ ] Click header toggles collapse/expand
- [ ] Arrow icon rotates appropriately
- [ ] State persists across page reload
- [ ] Multiple sections work independently
- [ ] Item counts update correctly

### Background Management
- [ ] Backgrounds list loads on page init
- [ ] Clicking background selects it
- [ ] Background displays in canvas
- [ ] AI commands work for background edit
- [ ] New background can be created
- [ ] Background saves correctly

### Skit Management
- [ ] Skits list loads on page init
- [ ] Clicking skit shows script display
- [ ] Play button opens player
- [ ] AI commands work for skit edit
- [ ] New skit can be created
- [ ] Skit saves correctly

### Voice Selection
- [ ] Voice dropdown populates
- [ ] Current sprite voice loads into UI
- [ ] Preview plays audio
- [ ] Parameters affect playback
- [ ] Save updates meta.json
- [ ] Voice persists on reload
