# AI Improv Theater 🎭

AIs perform absurdist comedy skits with crude 2D graphics and generated voices.

## Concept

"Scenes from a Hat" style comedy — AIs collaborate to write skit scripts, then a browser-based renderer plays them back with synchronized TTS audio. The janky aesthetic is intentional (early Flash/Newgrounds energy meets AI slop).

## How It Works

1. **Script Format:** JSON describes characters, props, backgrounds, and a timeline of actions (move, say, emote, spawn, etc.)
2. **Renderer:** Canvas-based playback with placeholder graphics and speech bubbles
3. **TTS:** Pocket TTS (Kyutai Labs) generates voices server-side, synced to the timeline
4. **Security:** AI outputs JSON data, not code. Renderer interprets a constrained vocabulary.

## Quick Start

### Requirements
- Python 3.10+
- Node.js (optional, for development)

### Install TTS
```bash
python3 -m venv venv
source venv/bin/activate
pip install pocket-tts
```

### Run TTS Server
```bash
pocket-tts serve --port 8001
```

### Serve Frontend
```bash
cd src
python3 -m http.server 8080
```

Visit `http://localhost:8080`

## Script Format

```json
{
  "meta": { "title": "Skit Name", "duration": 16 },
  "stage": { "background": "office", "width": 800, "height": 450 },
  "cast": {
    "bob": { "sprite": "man_suit", "startPos": [100, 320] }
  },
  "props": {
    "sword": { "sprite": "sword", "visible": false }
  },
  "script": [
    { "t": 0, "do": "enter", "who": "bob", "from": "left" },
    { "t": 2, "do": "say", "who": "bob", "line": "Hello world.", "duration": 2 },
    { "t": 5, "do": "emote", "who": "bob", "emotion": "happy" }
  ]
}
```

### Actions
| Action | Parameters | Description |
|--------|-----------|-------------|
| `move` | who, to [x,y], duration | Slide character |
| `say` | who, line, duration | Speech bubble + TTS |
| `emote` | who, emotion | Change expression |
| `spawn` | what, at [x,y] | Show prop |
| `despawn` | what | Hide prop |
| `enter` | who, from (left/right) | Walk on from offscreen |
| `exit` | who, to (left/right) | Walk off to offscreen |

### Emotions
`neutral`, `happy`, `sad`, `angry`, `shocked`, `confused`, `distressed`

## Voice Setup

Uses Pocket TTS with these voice assignments:
- `fantine` — female (boss)
- `jean` — male (employee) 
- `alba` — neutral (human)
- `cosette` — female (cat)

Available voices: alba, marius, javert, jean, fantine, cosette, eponine, azelma

## Project Status

**Prototype** — Validating the concept. Current features:
- [x] JSON script format
- [x] Canvas renderer with placeholder graphics
- [x] Timeline playback with controls
- [x] TTS audio generation and sync
- [x] Multiple test skits

**Next:**
- [ ] Real sprite assets
- [ ] More skits / AI generation
- [ ] Multi-agent collaboration
- [ ] Audience interaction

## License

TBD
