# AI Improv Theater - Claude Instructions

## Deployment Status

This project is not currently deployed. Its former OpenClaw VPS deployment and Pocket TTS endpoint were retired when that server was rebuilt as Hermes.

- Do not assume any production service or remote project checkout exists.
- Do not deploy this project or its old TTS service to Hermes unless explicitly requested.
- Develop and test locally using the scripts and configuration present in this repository.
- Use git for repository synchronization; do not invent an ad hoc remote deployment workflow.

## File Structure

```
ai-improv-theater/
|-- src/                   # Frontend (HTML, JS, CSS)
|   |-- index.html         # Main page
|   |-- sprite-editor.html # Sprite/skit editor
|   |-- renderer.js        # Canvas-based skit renderer
|   |-- sprites/           # Character SVG sprites
|   |-- backgrounds/       # Background SVGs
|   `-- published/         # Pre-rendered skits with audio
|-- data/                  # Runtime data (API storage)
|   |-- skits/             # Editable skit JSON files
|   |-- published/         # Published skit data
|   `-- audio-cache/       # Cached TTS audio
|-- server/                # Backend API server
|-- voice-samples/         # Reference audio for voice cloning
|-- scripts/               # Utility scripts
`-- venv/                  # Python virtualenv (TTS dependencies)
```

## AI Generation Prompts

Sprite/character creation prompts exist in **three locations** that must be kept in sync:

| File | Mode | Output Format |
|------|------|---------------|
| `src/js/backend/prompts.js` | Browser mode | `{svg, meta}` JSON |
| `server/services/agent.js` | Server/installed mode | `{svg, meta}` JSON |
| `svg-prompt-lab/seed-templates.js` | Prompt lab tool | Raw SVG |

When modifying sprite generation prompts, update **all three files**.

**Style rules for sprite prompts:**
- Do not reference necks; the AI draws them poorly. Head-bottom should overlap/connect directly with the body group.
- Do not add eye highlight/reflection circles; they break pupil animation.
