# SVG Prompt Lab

A standalone tool for testing SVG generation prompts across multiple AI models, comparing results visually, and tracking what works.

## Quick Start

```bash
cd svg-prompt-lab
npm install
npm run seed    # create initial prompt templates
npm run dev     # start server on http://localhost:3100
```

## Configuration

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | API key from [OpenRouter](https://openrouter.ai/keys) for multi-model access |
| `OPENCLAW_URL` | OpenClaw API endpoint (inherited from parent project `.env`) |
| `OPENCLAW_TOKEN` | OpenClaw auth token (inherited from parent project `.env`) |
| `OPENCLAW_AGENT_ID` | OpenClaw agent ID, defaults to `skitkit` |
| `SVG_LAB_PORT` | Server port, defaults to `3100` |

The server loads the parent project's `.env` as a fallback, so OpenClaw credentials are shared automatically.

## How It Works

1. **Pick a prompt template** - pre-seeded templates for sprites, backgrounds, and props, or create your own
2. **Define variables** - each template has variable placeholders (e.g. `{{description}}`), each with multiple test values
3. **Select models** - pick one or more models from OpenRouter and/or OpenClaw
4. **Run experiment** - the tool generates every combination (variables × models) concurrently and collects results
5. **Compare & rate** - view all generated SVGs in a gallery, validate structure, rate results, mark winners

## Architecture

```
svg-prompt-lab/
├── server.js              # Express server (port 3100)
├── config.js              # Environment config
├── seed-templates.js      # Creates initial templates from parent project prompts
├── services/
│   ├── backends.js        # OpenRouter + OpenClaw API clients
│   ├── templates.js       # Template CRUD (JSON files)
│   ├── experiments.js     # Experiment runner + storage
│   ├── ratings.js         # Rating/winner tracking
│   └── validation.js      # SVG validation (sprite/background/prop)
├── routes/
│   ├── templates.js       # Template CRUD endpoints
│   ├── experiments.js     # Run/list/get experiments + SSE progress
│   ├── ratings.js         # Rate results, get top results
│   ├── models.js          # List available models
│   └── references.js      # Serve reference SVGs from parent project
├── public/
│   ├── index.html         # SPA shell
│   ├── style.css          # Dark theme styles
│   └── app.js             # Frontend logic
└── data/
    ├── templates/         # Prompt template JSON files
    └── experiments/       # Experiment result JSON files
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/models` | List models from all configured backends |
| GET/POST/PUT/DELETE | `/api/templates[/:id]` | Template CRUD |
| GET | `/api/references/:type` | List reference SVGs from parent project (`sprites`, `backgrounds`, `props`) |
| POST | `/api/experiments` | Create and run an experiment |
| GET | `/api/experiments` | List experiments (summaries) |
| GET | `/api/experiments/:id` | Get full experiment with results |
| GET | `/api/experiments/:id/progress` | SSE stream of progress events |
| DELETE | `/api/experiments/:id` | Delete experiment |
| PUT | `/api/experiments/:id/results/:idx/rating` | Set rating on a result |
| GET | `/api/ratings/top` | Top-rated results across experiments |

## Backends

**OpenRouter** - Access to many models (Claude, GPT, Gemini, Llama, etc.) through a single API. Requires `OPENROUTER_API_KEY`. Model list is fetched and cached for 10 minutes.

**OpenClaw** - Access to the project's existing Opus 4.5 integration. Uses the same credentials as the parent project's server.

## SVG Validation

Generated SVGs are validated based on asset type:

- **Sprite**: viewBox `0 0 100 150`, required animation IDs (eyes, brows, mouth), required groups (body, head-top, head-bottom), pupil class check, mouth alignment check
- **Background**: viewBox `0 0 400 225` (landscape) or `0 0 225 400` (portrait)
- **Prop**: viewBox `0 0 100 100`

## Seed Templates

`npm run seed` creates three templates extracted from the parent project's system prompts:

- `sprite-default` - Character sprite generator with animation structure requirements
- `background-default` - Landscape scene background generator
- `prop-default` - Object/item prop generator
