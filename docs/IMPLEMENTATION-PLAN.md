# SkitKit Implementation Plan

Integration of AI Improv Theater with OpenClaw for agent-driven sprite and skit creation.

---

## Overview

**Goal:** Enable OpenClaw agents to create SVG character sprites, write comedy skits, preview them in real-time, and publish self-contained playable files.

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                         OpenClaw Instance                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      SkitKit Skill                             │  │
│  │  SKILL.md + bundled scripts                                    │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTP calls
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SkitKit Server (:3000)                            │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  REST API   │  │  WebSocket  │  │   Static    │  │   TTS     │  │
│  │  /api/*     │  │  /ws        │  │   Files     │  │   Proxy   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    File Storage                              │    │
│  │  /data/sprites/   /data/skits/   /data/published/            │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Pocket TTS (:8001)                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: API Server Foundation

### 1.1 Project Setup

**New directory structure:**
```
ai-improv-theater/
├── server/                    # NEW: Node.js server
│   ├── package.json
│   ├── index.js               # Main entry point
│   ├── routes/
│   │   ├── sprites.js         # Sprite CRUD
│   │   ├── skits.js           # Skit CRUD
│   │   ├── publish.js         # Publishing endpoint
│   │   └── tts.js             # TTS proxy
│   ├── services/
│   │   ├── storage.js         # File system operations
│   │   ├── publisher.js       # Skit bundling logic
│   │   └── websocket.js       # Real-time updates
│   └── middleware/
│       ├── validate.js        # Request validation
│       └── normalize.js       # Skill → API payload normalization
├── data/                      # NEW: Runtime data
│   ├── sprites/               # User-created sprites
│   ├── skits/                 # Work-in-progress skits
│   └── published/             # Published bundles
├── src/                       # Existing frontend (unchanged mostly)
│   ├── sprite-editor.html
│   ├── skit-player-v3.html
│   ├── sprites/               # Built-in sprites (read-only)
│   └── backgrounds/
├── skill/                     # NEW: OpenClaw skill definition
│   ├── SKILL.md
│   └── examples/
└── docs/
```

**Dependencies (server/package.json):**
```json
{
  "name": "skitkit-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.16.0",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.0",
    "form-data": "^4.0.0",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "vitest": "^1.2.0"
  }
}
```

**Server initialization (server/index.js skeleton):**
```javascript
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { ensureDataDirs } from './services/storage.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Ensure data directories exist on startup
await ensureDataDirs();

// ... routes and middleware ...

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SkitKit server running on :${PORT}`));
```

**Payload normalization middleware (server/middleware/normalize.js):**
```javascript
// Converts skill-friendly flat payloads to API-native nested format

export function normalizeSprite(req, res, next) {
  const body = req.body;

  // If already has meta object, pass through
  if (body.meta) return next();

  // Normalize flat skill payload to nested API format
  req.body = {
    name: body.name,
    svg: body.svg,
    meta: {
      description: body.description,
      tags: body.tags,
      voice: typeof body.voice === 'string' ? { id: body.voice } : body.voice,
      colors: body.colors
    }
  };

  next();
}

export function normalizeSkit(req, res, next) {
  const body = req.body;

  // If already has meta and stage objects, pass through
  if (body.meta && body.stage) return next();

  // Normalize flat skill payload to nested API format
  req.body = {
    meta: {
      title: body.title,
      description: body.description
    },
    stage: {
      background: body.background
    },
    cast: body.cast,
    script: body.script
  };

  next();
}
```

**Usage in routes:**
```javascript
import { normalizeSprite, normalizeSkit } from './middleware/normalize.js';

app.post('/api/sprites', normalizeSprite, createSpriteHandler);
app.post('/api/skits', normalizeSkit, createSkitHandler);
```

### 1.2 Core API Endpoints

#### Sprites API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sprites` | List all sprites (built-in + user) |
| GET | `/api/sprites/:name` | Get sprite details + SVG content |
| POST | `/api/sprites` | Create new sprite |
| PUT | `/api/sprites/:name` | Update sprite SVG or metadata |
| DELETE | `/api/sprites/:name` | Delete user sprite |
| POST | `/api/sprites/validate` | Validate sprite structure (no save) |

**Note:** User-created sprites are stored separately from built-ins. If a user sprite has the same name as a built-in, the user sprite takes precedence when loading, but built-ins cannot be overwritten or deleted.

**Sprite creation payload (API-native format):**
```json
{
  "name": "detective",
  "svg": "<svg viewBox=\"0 0 100 150\">...</svg>",
  "meta": {
    "description": "A noir detective with trench coat",
    "tags": ["human", "male", "detective"],
    "voice": {
      "id": "jean",
      "pitch": -2,
      "speed": 0.9
    },
    "colors": {
      "skin": "#e8c4a0",
      "primary": "#3a3a3a",
      "accent": "#8b4513"
    }
  }
}
```

**Skill-friendly format (also accepted, normalized by server):**
```json
{
  "name": "detective",
  "svg": "<svg viewBox=\"0 0 100 150\">...</svg>",
  "description": "A noir detective with trench coat",
  "tags": ["human", "male", "detective"],
  "voice": "jean"
}
```

The server normalizes skill-friendly payloads to API-native format:
- `description` → `meta.description`
- `tags` → `meta.tags`
- `voice` (string) → `meta.voice.id`

**Validation checks:**
- Required element IDs: `eye-left-white`, `eye-right-white`, `eye-left-pupil`, `eye-right-pupil`, `brow-left`, `brow-right`, `mouth-closed`, `mouth-open`
- ViewBox should be `0 0 100 150`
- Groups: `body`, `head-top`, `head-bottom`
- Mouth alignment (open/closed at same Y position)

#### Skits API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skits` | List all skits |
| GET | `/api/skits/:id` | Get skit details |
| POST | `/api/skits` | Create new skit |
| PUT | `/api/skits/:id` | Update skit |
| DELETE | `/api/skits/:id` | Delete skit |
| POST | `/api/skits/:id/validate` | Validate skit structure |
| GET | `/api/skits/:id/preview` | Get preview URL |

**Skit creation payload:**
```json
{
  "meta": {
    "title": "The Detective",
    "description": "A noir parody where the detective is too dramatic"
  },
  "stage": {
    "background": "office"
  },
  "cast": {
    "detective": {
      "sprite": "detective",
      "x": 30,
      "voice": "jean"
    },
    "client": {
      "sprite": "girl",
      "x": 70,
      "voice": "cosette"
    }
  },
  "script": [
    { "do": "shot", "type": "wide" },
    { "do": "say", "who": "detective", "line": "I've seen things..." },
    { "do": "emote", "who": "client", "emotion": "confused" },
    { "do": "say", "who": "client", "line": "Sir, I just lost my cat." }
  ]
}
```

**Skill-friendly format (also accepted, normalized by server):**
```json
{
  "title": "The Detective",
  "description": "A noir parody where the detective is too dramatic",
  "background": "office",
  "cast": { ... },
  "script": [ ... ]
}
```

The server normalizes skill-friendly payloads:
- `title` → `meta.title`
- `description` → `meta.description`
- `background` → `stage.background`

#### Backgrounds API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/backgrounds` | List available backgrounds |
| GET | `/api/backgrounds/:name` | Get background SVG |

#### Publishing API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/publish/:skitId` | Publish skit to self-contained JSON |
| GET | `/api/published` | List published skits |
| GET | `/api/published/:id` | Get published skit JSON |
| DELETE | `/api/published/:id` | Delete published skit |

**Publishing process:**
1. Load skit definition
2. For each sprite in cast: load SVG, base64 encode
3. Load background SVG, base64 encode
4. For each "say" action: call TTS, base64 encode audio
5. Bundle into single JSON
6. Save to `/data/published/{id}.json`
7. Return URL

#### TTS Proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tts` | Proxy to Pocket TTS |
| GET | `/api/tts/voices` | List available voices |

### 1.4 Static Routes

| Route | Maps To | Description |
|-------|---------|-------------|
| `/` | `src/index.html` | Landing page |
| `/editor` | `src/sprite-editor.html` | Sprite editor |
| `/player` | `src/skit-player-v3.html` | Skit player (supports `?id=` for API skits, `?skit=` for published) |
| `/sprites/*` | `src/sprites/*` | Built-in sprite assets |
| `/backgrounds/*` | `src/backgrounds/*` | Background assets |
| `/published/*` | `data/published/*` | Published skit JSON files |

### 1.5 WebSocket Protocol

**Connection:** `ws://` or `wss://` based on page protocol:
```javascript
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${location.host}/ws`);
```

**Message types:**

```typescript
// Client → Server
{ type: "subscribe", skitId: "abc123" }
{ type: "unsubscribe", skitId: "abc123" }

// Server → Client
{ type: "skit:updated", skitId: "abc123", skit: {...} }
{ type: "sprite:updated", name: "detective", sprite: {...} }
{ type: "publish:progress", skitId: "abc123", step: "audio", current: 3, total: 10, detail: "Line text..." }
{ type: "publish:complete", skitId: "abc123", url: "/published/abc123.json" }
```

**Use cases:**
- Agent updates skit → WebSocket notifies browser → live preview updates
- Publishing progress shown in real-time
- Multiple browser tabs stay in sync

---

## Phase 2: OpenClaw Skill Definition

### 2.1 SKILL.md Structure

**File: `skill/SKILL.md`**

```markdown
---
name: skitkit
description: Create animated comedy skits with SVG characters and TTS voices
version: 1.0.0
triggers:
  - "create a skit"
  - "make a character"
  - "sprite"
  - "comedy sketch"
  - "animate"
invocation: user  # User must explicitly invoke
context: fork     # Runs in isolated context
---

# SkitKit - AI Comedy Sketch Creator

You are an AI comedy writer and animator. You create short animated skits
with SVG character sprites and text-to-speech voices.

## Available Tools

### create_sprite
Create a new character sprite for use in skits.

**Parameters:**
- `name` (string, required): Unique identifier (lowercase, hyphens ok)
- `description` (string, required): Character description for reference
- `svg` (string, required): Complete SVG markup following sprite structure
- `voice` (string, optional): Voice ID (alba, marius, javert, jean, fantine, cosette, eponine, azelma)
- `tags` (array, optional): Searchable tags

**Example:**
\`\`\`json
{
  "name": "grumpy-chef",
  "description": "An irritable French chef with a tall hat",
  "svg": "<svg viewBox=\"0 0 100 150\">...</svg>",
  "voice": "javert",
  "tags": ["human", "chef", "angry"]
}
\`\`\`

### list_sprites
List all available character sprites.

**Returns:** Array of sprite names with descriptions.

### get_sprite
Get details of a specific sprite including SVG source.

**Parameters:**
- `name` (string, required): Sprite name

### create_skit
Create a new comedy skit.

**Parameters:**
- `title` (string, required): Skit title
- `description` (string, optional): What the skit is about
- `background` (string, required): Background name (office, restaurant, space, kitchen)
- `cast` (object, required): Character definitions
- `script` (array, required): Sequence of actions

**Example:**
\`\`\`json
{
  "title": "The Soup Complaint",
  "background": "restaurant",
  "cast": {
    "chef": { "sprite": "grumpy-chef", "x": 70 },
    "customer": { "sprite": "person", "x": 30 }
  },
  "script": [
    { "do": "shot", "type": "wide" },
    { "do": "say", "who": "customer", "line": "Excuse me, there's a fly in my soup." },
    { "do": "emote", "who": "chef", "emotion": "angry" },
    { "do": "say", "who": "chef", "line": "That is not a fly. That is a GARNISH." }
  ]
}
\`\`\`

### preview_skit
Get a URL to preview the skit in a browser.

**Parameters:**
- `skit_id` (string, required): The skit ID returned from create_skit

**Returns:** URL that can be opened in browser for preview.

### publish_skit
Publish a skit to a self-contained shareable format.

**Parameters:**
- `skit_id` (string, required): The skit ID to publish

**Returns:** URL to the published skit JSON.

### list_backgrounds
List available background scenes.

### list_voices
List available TTS voices with descriptions.

## Script Actions Reference

| Action | Parameters | Description |
|--------|------------|-------------|
| `shot` | type, who? | Camera shot (wide, two-shot, closeup, extreme-closeup, medium) |
| `say` | who, line | Character speaks (triggers TTS) |
| `emote` | who, emotion | Change expression (neutral, happy, sad, angry, surprised, worried, excited, smug, tired) |
| `pause` | duration | Wait N seconds |
| `enter` | who, from, to | Character enters from left/right to X position |
| `exit` | who, to | Character exits to left/right |
| `move` | who, to, duration? | Move character to X position |
| `look` | who, at | Eye direction (left, right, up, down, audience, other) |

## SVG Sprite Structure

Characters must follow this structure for emotions and lip-sync to work:

\`\`\`xml
<svg viewBox="0 0 100 150">
  <g id="body"><!-- torso, arms, legs --></g>
  <g id="head-top">
    <!-- Hair, forehead -->
    <ellipse id="eye-left-white" cx="40" cy="42" rx="5" ry="3"/>
    <ellipse id="eye-right-white" cx="60" cy="42" rx="5" ry="3"/>
    <circle id="eye-left-pupil" class="pupil" cx="40" cy="42" r="1.5"/>
    <circle id="eye-right-pupil" class="pupil" cx="60" cy="42" r="1.5"/>
    <path id="brow-left" d="M35 38 Q40 36 45 38"/>
    <path id="brow-right" d="M55 38 Q60 36 65 38"/>
  </g>
  <g id="head-bottom">
    <!-- Nose, jaw -->
    <path id="mouth-closed" d="M45 52 Q50 55 55 52"/>
    <ellipse id="mouth-open" cx="50" cy="53" rx="4" ry="2" opacity="0"/>
  </g>
</svg>
\`\`\`

**Critical:** `mouth-open` and `mouth-closed` must be at the same Y position.

## Comedy Guidelines

See COMEDY-GUIDE.md for detailed writing advice. Key points:
- Find the "game" (the central comic idea)
- Two POVs: one absurd, one normal/foil
- Escalate the same joke, don't add new ones
- End with a button (strong final laugh)
- Keep it under 90 seconds

## Example Workflow

1. **Brainstorm:** "What if a job interviewer was actually a cat?"
2. **Create sprites:** Make any custom characters needed
3. **Write skit:** Define cast and script
4. **Preview:** Check timing and pacing
5. **Iterate:** Adjust dialogue, emotions, camera
6. **Publish:** Generate shareable link
```

### 2.2 Tool Implementation Scripts

**File: `skill/tools/create_sprite.sh`**
```bash
#!/bin/bash
# Called by OpenClaw when agent uses create_sprite tool
# Expects JSON input on stdin

curl -X POST http://localhost:3000/api/sprites \
  -H "Content-Type: application/json" \
  -d @-
```

**File: `skill/tools/create_skit.sh`**
```bash
#!/bin/bash
curl -X POST http://localhost:3000/api/skits \
  -H "Content-Type: application/json" \
  -d @-
```

**File: `skill/tools/preview_skit.sh`**
```bash
#!/bin/bash
SKIT_ID=$1
# Use ?id= for API skits (work-in-progress), ?skit= for published
echo "{\"url\": \"http://localhost:3000/player?id=${SKIT_ID}\"}"
```

### 2.3 Alternative: Direct HTTP (No Scripts)

If OpenClaw supports HTTP tools natively:

```yaml
tools:
  - name: create_sprite
    type: http
    method: POST
    url: "{{SKITKIT_URL}}/api/sprites"
    headers:
      Content-Type: application/json
```

---

## Phase 3: Frontend Modifications

### 3.1 Player Enhancements

**Changes to `skit-player-v3.html`:**

1. **Add WebSocket connection for live updates:**
```javascript
// Connect to server for live preview updates (protocol-aware for HTTPS)
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${location.host}/ws`);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'skit:updated' && msg.skitId === currentSkitId) {
    // Reload skit without losing playback position
    reloadSkit(msg.skit);
  }
};

// Subscribe to current skit
function subscribeToSkit(skitId) {
  ws.send(JSON.stringify({ type: 'subscribe', skitId }));
}
```

2. **Add API-based skit loading:**
```javascript
async function loadSkitFromApi(skitId) {
  const res = await fetch(`/api/skits/${skitId}`);
  const skit = await res.json();
  currentSkitId = skitId;
  subscribeToSkit(skitId);
  await loadSkitData(skit);
}
```

3. **Add URL parameter handling:**
```javascript
// Support ?id=xxx for API skits (in addition to ?skit=xxx for published)
const params = new URLSearchParams(location.search);
if (params.get('id')) {
  loadSkitFromApi(params.get('id'));
} else if (params.get('skit')) {
  loadFromUrl(`published/${params.get('skit')}.json`);
}
```

4. **Add agent mode (minimal UI):**
```javascript
if (params.get('agent') === 'true') {
  document.body.classList.add('agent-mode');
  // Hide controls, auto-play, etc.
}
```

### 3.2 Editor Enhancements

**Changes to `sprite-editor.html`:**

1. **Save to API instead of download:**
```javascript
async function saveSprite() {
  const svg = serializeSvg();
  const meta = getMetadata();
  const name = currentSpriteName || prompt('Sprite name:');

  // POST for new sprites, PUT /api/sprites/:name for updates
  const url = currentSpriteName
    ? `/api/sprites/${encodeURIComponent(currentSpriteName)}`
    : '/api/sprites';
  const method = currentSpriteName ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, svg, meta })
  });

  if (res.ok) {
    currentSpriteName = name;
    showToast('Sprite saved!');
    refreshSpriteList();
  } else {
    const err = await res.json();
    showToast(`Error: ${err.message}`, 'error');
  }
}
```

2. **Load sprites from API:**
```javascript
async function loadSpriteList() {
  const res = await fetch('/api/sprites');
  const sprites = await res.json();
  renderSpriteList(sprites);
}
```

3. **Validation feedback:**
```javascript
async function validateCurrentSprite() {
  const svg = serializeSvg();
  const res = await fetch('/api/sprites/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ svg })
  });
  const result = await res.json();
  showValidationResults(result);
}
```

### 3.3 New: Skit Editor Page (Future)

**File: `src/skit-editor.html`**

A simple interface for editing skit JSON with:
- Cast management (add/remove characters, position them)
- Script timeline editor
- Live preview panel (embeds player)
- Publish button

This could be a later phase - agents can work with raw JSON initially.

---

## Phase 4: Storage & Data Management

### 4.1 File Structure

```
data/
├── sprites/
│   ├── detective/
│   │   ├── front.svg
│   │   ├── meta.json
│   │   └── variants/        # Optional alternate views
│   │       └── back.svg
│   └── grumpy-chef/
│       ├── front.svg
│       └── meta.json
├── skits/
│   ├── abc123.json          # Work-in-progress skits
│   └── def456.json
├── published/
│   ├── abc123.json          # Self-contained published skits
│   └── def456.json
└── audio-cache/             # Cached TTS audio (optional)
    └── {hash}.wav
```

### 4.2 Sprite Storage Service

**File: `server/services/storage.js`**

```javascript
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const BUILTIN_SPRITES_DIR = './src/sprites';
const BUILTIN_BACKGROUNDS_DIR = './src/backgrounds';

// --- Helper Functions ---

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listDirs(dirPath) {
  // List only directories, not files (filters out index.json, meta-schema.json, etc.)
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

// --- Initialization (call on server startup) ---

export async function ensureDataDirs() {
  await ensureDir(path.join(DATA_DIR, 'sprites'));
  await ensureDir(path.join(DATA_DIR, 'skits'));
  await ensureDir(path.join(DATA_DIR, 'published'));
  await ensureDir(path.join(DATA_DIR, 'audio-cache'));
}

// --- Sprite Storage ---

export async function listSprites() {
  const builtin = await listDirs(BUILTIN_SPRITES_DIR);
  const user = await listDirs(path.join(DATA_DIR, 'sprites'));

  // User sprites listed first (they take precedence), then built-ins not shadowed
  const userSet = new Set(user);
  return [
    ...user.map(name => ({ name, builtin: false })),
    ...builtin.filter(name => !userSet.has(name)).map(name => ({ name, builtin: true }))
  ];
}

export async function getSprite(name) {
  // Check user sprites first, then builtin
  const userPath = path.join(DATA_DIR, 'sprites', name);
  const builtinPath = path.join(BUILTIN_SPRITES_DIR, name);

  const spritePath = await exists(userPath) ? userPath : builtinPath;

  if (!await exists(spritePath)) {
    throw new Error(`Sprite not found: ${name}`);
  }

  const svg = await fs.readFile(path.join(spritePath, 'front.svg'), 'utf-8');
  const metaPath = path.join(spritePath, 'meta.json');
  const meta = await exists(metaPath)
    ? JSON.parse(await fs.readFile(metaPath, 'utf-8'))
    : {};

  return { name, svg, meta, builtin: spritePath === builtinPath };
}

export async function saveSprite(name, svg, meta) {
  const spritePath = path.join(DATA_DIR, 'sprites', name);
  await ensureDir(spritePath);
  await fs.writeFile(path.join(spritePath, 'front.svg'), svg);
  await fs.writeFile(path.join(spritePath, 'meta.json'), JSON.stringify(meta, null, 2));
}

export async function deleteSprite(name) {
  // Prevent deleting built-in sprites
  const builtinPath = path.join(BUILTIN_SPRITES_DIR, name);
  if (await exists(builtinPath)) {
    throw new Error(`Cannot delete built-in sprite: ${name}`);
  }

  const spritePath = path.join(DATA_DIR, 'sprites', name);
  await fs.rm(spritePath, { recursive: true });
}

// --- Background Storage ---

export async function listBackgrounds() {
  const files = await fs.readdir(BUILTIN_BACKGROUNDS_DIR);
  return files
    .filter(f => f.endsWith('.svg'))
    .map(f => f.replace('.svg', ''));
}

export async function getBackground(name) {
  const bgPath = path.join(BUILTIN_BACKGROUNDS_DIR, `${name}.svg`);
  return fs.readFile(bgPath, 'utf-8');
}
```

### 4.3 Skit Storage

```javascript
// --- Skit Storage (continued in storage.js) ---

export async function listSkits() {
  const skitsDir = path.join(DATA_DIR, 'skits');
  let files;
  try {
    files = await fs.readdir(skitsDir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  return Promise.all(
    files.filter(f => f.endsWith('.json')).map(async f => {
      const filePath = path.join(skitsDir, f);
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      const stat = await fs.stat(filePath);
      return {
        id: f.replace('.json', ''),
        title: content.meta?.title,
        updatedAt: stat.mtime
      };
    })
  );
}

export async function getSkit(id) {
  const content = await fs.readFile(path.join(DATA_DIR, 'skits', `${id}.json`), 'utf-8');
  return JSON.parse(content);
}

export async function saveSkit(id, skit) {
  await ensureDir(path.join(DATA_DIR, 'skits'));
  await fs.writeFile(
    path.join(DATA_DIR, 'skits', `${id}.json`),
    JSON.stringify(skit, null, 2)
  );
}

export async function deleteSkit(id) {
  await fs.unlink(path.join(DATA_DIR, 'skits', `${id}.json`));
}
```

---

## Phase 5: Publishing Pipeline

### 5.1 Publisher Service

**File: `server/services/publisher.js`**

```javascript
import { getSprite } from './storage.js';
import { generateTTS } from './tts.js';

export async function publishSkit(skitId, skit, onProgress) {
  const assets = {
    sprites: {},
    backgrounds: {},
    audio: {}
  };

  // 1. Bundle sprites
  const spriteNames = new Set(Object.values(skit.cast).map(c => c.sprite));
  let step = 0;
  const totalSteps = spriteNames.size + 1 + skit.script.filter(b => b.do === 'say').length;

  for (const spriteName of spriteNames) {
    onProgress?.({ step: 'sprites', current: ++step, total: totalSteps, detail: spriteName });
    const sprite = await getSprite(spriteName);
    assets.sprites[`${spriteName}-front`] = svgToDataUrl(sprite.svg);
  }

  // 2. Bundle background
  onProgress?.({ step: 'background', current: ++step, total: totalSteps });
  const bgSvg = await loadBackground(skit.stage.background);
  assets.backgrounds[skit.stage.background] = svgToDataUrl(bgSvg);

  // 3. Generate audio
  const sayActions = skit.script.filter(b => b.do === 'say');
  for (let i = 0; i < sayActions.length; i++) {
    const beat = sayActions[i];
    const char = skit.cast[beat.who];
    onProgress?.({ step: 'audio', current: ++step, total: totalSteps, detail: beat.line.slice(0, 30) });

    const audioBlob = await generateTTS(beat.line, char.voice);
    assets.audio[`line-${i}`] = await blobToDataUrl(audioBlob);
  }

  // 4. Bundle everything
  const published = {
    meta: skit.meta,
    stage: skit.stage,
    cast: skit.cast,
    script: skit.script,
    assets,
    publishedAt: new Date().toISOString()
  };

  // 5. Save
  const outputPath = path.join(DATA_DIR, 'published', `${skitId}.json`);
  await fs.writeFile(outputPath, JSON.stringify(published));

  return {
    id: skitId,
    url: `/published/${skitId}.json`,
    size: JSON.stringify(published).length
  };
}

function svgToDataUrl(svg) {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

async function blobToDataUrl(blob) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return `data:audio/wav;base64,${buffer.toString('base64')}`;
}
```

### 5.2 Progress via WebSocket

```javascript
// In publish route
app.post('/api/publish/:skitId', async (req, res) => {
  const { skitId } = req.params;
  const skit = await getSkit(skitId);

  const result = await publishSkit(skitId, skit, (progress) => {
    // Broadcast to all WebSocket clients watching this skit
    broadcast({
      type: 'publish:progress',
      skitId,
      ...progress
    });
  });

  broadcast({ type: 'publish:complete', skitId, url: result.url });
  res.json(result);
});
```

---

## Phase 6: Deployment

### 6.1 Systemd Service

**File: `skitkit-server.service`**

```ini
[Unit]
Description=SkitKit Server for AI Improv Theater
After=network.target pocket-tts.service

[Service]
Type=simple
User=openclaw
WorkingDirectory=/home/openclaw/.openclaw/workspace/projects/ai-improv-theater
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=TTS_URL=http://127.0.0.1:8001
Environment=DATA_DIR=/home/openclaw/.openclaw/workspace/projects/ai-improv-theater/data

[Install]
WantedBy=multi-user.target
```

### 6.2 Nginx Configuration (Optional)

If serving publicly via Tailscale Funnel or direct:

```nginx
server {
    listen 80;
    server_name skitkit.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 6.3 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `TTS_URL` | http://127.0.0.1:8001 | Pocket TTS endpoint |
| `DATA_DIR` | ./data | Where to store sprites/skits |
| `CORS_ORIGIN` | * | Allowed origins for CORS |

---

## Phase 7: Testing & Validation

### 7.1 API Tests

```javascript
// tests/api.test.js
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Helper to make API calls with base URL
async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return res;
}

// Test fixtures
const VALID_SVG = `<svg viewBox="0 0 100 150">
  <g id="body"></g>
  <g id="head-top">
    <ellipse id="eye-left-white" cx="40" cy="42" rx="5" ry="3"/>
    <ellipse id="eye-right-white" cx="60" cy="42" rx="5" ry="3"/>
    <circle id="eye-left-pupil" class="pupil" cx="40" cy="42" r="1.5"/>
    <circle id="eye-right-pupil" class="pupil" cx="60" cy="42" r="1.5"/>
    <path id="brow-left" d="M35 38 Q40 36 45 38"/>
    <path id="brow-right" d="M55 38 Q60 36 65 38"/>
  </g>
  <g id="head-bottom">
    <path id="mouth-closed" d="M45 52 Q50 55 55 52"/>
    <ellipse id="mouth-open" cx="50" cy="53" rx="4" ry="2" opacity="0"/>
  </g>
</svg>`;

const INVALID_SVG = `<svg viewBox="0 0 100 150"><g id="body"></g></svg>`;

describe('Sprites API', () => {
  test('POST /api/sprites creates sprite', async () => {
    const res = await api('/api/sprites', {
      method: 'POST',
      body: {
        name: 'test-sprite',
        svg: VALID_SVG,
        meta: { description: 'Test' }
      }
    });
    expect(res.status).toBe(201);
  });

  test('POST /api/sprites/validate catches missing elements', async () => {
    const res = await api('/api/sprites/validate', {
      method: 'POST',
      body: { svg: INVALID_SVG }
    });
    const result = await res.json();
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing element: mouth-open');
  });

  // Cleanup
  afterAll(async () => {
    await api('/api/sprites/test-sprite', { method: 'DELETE' });
  });
});
```

### 7.2 Integration Tests

```javascript
// tests/integration.test.js
import { describe, test, expect, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return res;
}

describe('Full workflow', () => {
  let skitId;

  test('Create sprite → Create skit → Publish', async () => {
    // 1. Create sprite
    const spriteRes = await api('/api/sprites', {
      method: 'POST',
      body: { name: 'integration-test', svg: VALID_SVG, description: 'Test sprite' }
    });
    expect(spriteRes.status).toBe(201);

    // 2. Create skit using sprite
    const skitRes = await api('/api/skits', {
      method: 'POST',
      body: {
        title: 'Integration Test',
        background: 'office',
        cast: { char: { sprite: 'integration-test', x: 50, voice: 'jean' } },
        script: [{ do: 'say', who: 'char', line: 'Hello' }]
      }
    });
    expect(skitRes.status).toBe(201);
    const skit = await skitRes.json();
    skitId = skit.id;

    // 3. Publish
    const publishRes = await api(`/api/publish/${skitId}`, { method: 'POST' });
    expect(publishRes.status).toBe(200);
    const published = await publishRes.json();

    // 4. Verify published JSON is self-contained
    const jsonRes = await fetch(`${BASE_URL}${published.url}`);
    const json = await jsonRes.json();
    expect(json.assets.sprites['integration-test-front']).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(json.assets.audio['line-0']).toMatch(/^data:audio\/wav;base64,/);

    // 5. Verify published JSON matches what skit-player expects
    expect(json.meta.title).toBe('Integration Test');
    expect(json.stage.background).toBe('office');
    expect(json.cast.char.sprite).toBe('integration-test');
    expect(json.script[0].do).toBe('say');
  });

  // Cleanup
  afterAll(async () => {
    if (skitId) {
      await api(`/api/skits/${skitId}`, { method: 'DELETE' });
      await api(`/api/published/${skitId}`, { method: 'DELETE' });
    }
    await api('/api/sprites/integration-test', { method: 'DELETE' });
  });
});
```

### 7.3 Sprite Validation Tests

```javascript
describe('Sprite validation', () => {
  test('Valid sprite passes', () => {
    expect(validateSprite(VALID_SPRITE_SVG).valid).toBe(true);
  });

  test('Missing mouth-open fails', () => {
    const result = validateSprite(SVG_WITHOUT_MOUTH_OPEN);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required element: mouth-open');
  });

  test('Misaligned mouth fails', () => {
    const result = validateSprite(SVG_WITH_MISALIGNED_MOUTH);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('mouth-open and mouth-closed Y positions differ by 15 units');
  });
});
```

---

## Implementation Order

### Week 1: Foundation
- [ ] Set up `server/` directory with Express
- [ ] Implement sprite CRUD endpoints
- [ ] Implement skit CRUD endpoints
- [ ] Basic file storage service
- [ ] TTS proxy endpoint

### Week 2: Publishing & Preview
- [ ] Implement publishing pipeline
- [ ] Add WebSocket server
- [ ] Real-time preview updates
- [ ] Progress reporting during publish

### Week 3: OpenClaw Integration
- [ ] Write SKILL.md
- [ ] Create tool wrapper scripts (or HTTP tool config)
- [ ] Test with OpenClaw agent
- [ ] Iterate on skill based on agent feedback

### Week 4: Polish & Deploy
- [ ] Frontend modifications (WebSocket, API loading)
- [ ] Sprite validation service
- [ ] Systemd service file
- [ ] Documentation updates
- [ ] End-to-end testing

---

## Design Decisions

Answers to questions that came up during review:

1. **Can user sprites override built-ins?**
   - User sprites are stored separately in `data/sprites/`
   - If a user sprite has the same name as a built-in, the user sprite takes precedence when loading
   - Built-in sprites cannot be deleted or overwritten directly
   - This allows users to customize built-ins while preserving the originals

2. **What is `/player`?**
   - `/player` is a route alias that serves `src/skit-player-v3.html`
   - Use `?id=xxx` for work-in-progress skits (fetched from API)
   - Use `?skit=xxx` for published skits (fetched from `/published/xxx.json`)

3. **Skill payloads vs API schema:**
   - The server accepts BOTH skill-friendly (flat) and API-native (nested) payloads
   - Normalization middleware converts flat → nested before route handlers
   - This keeps the skill simple for agents while maintaining a clean internal schema

---

## Future Enhancements

- **Skit Editor UI**: Visual timeline editor for non-technical users
- **Background Editor**: Create/edit backgrounds similar to sprite editor
- **Voice Cloning**: Support custom voice samples per character
- **Animation Presets**: Pre-built animation sequences (walk cycles, gestures)
- **Multi-agent Collaboration**: Writer + Artist + Director agents
- **Social Features**: Public gallery, likes, remixes
- **Export Formats**: MP4 video export, GIF export
