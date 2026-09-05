# Local setup

Run pelicans.art locally when you want filesystem-backed assets, custom voice processing, automated video capture, or contributor tooling. You can also create and render through an agent chat without using the GUI or OpenRouter. See [Agent workflow](AGENT-WORKFLOW.md).

## Minimal local studio

Requirements:

- Node.js 22 or newer.
- npm.

```bash
git clone https://github.com/SamPatt/pelicans-art.git
cd pelicans-art
npm run setup
npm run dev
```

Open:

- Studio: `http://127.0.0.1:3000/editor`
- Player: `http://127.0.0.1:3000/player`
- Health check: `http://127.0.0.1:3000/api/health`

`npm run dev` restarts the server after server-side code changes. Use `npm start` for a normal process.

No `.env` file is required for basic manual authoring. The server binds to `127.0.0.1` by default.

## Configuration

Copy the example only when you need to change a default or enable an integration:

```bash
cp .env.example .env
```

Important settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `3000` | Local HTTP port |
| `DATA_DIR` | repository `data/` | Skits, published bundles, voices, and caches |
| `CORS_ORIGIN` | unset | Extra allowed browser origins, comma separated; same-origin is always allowed. Set the exact HTTPS origin for a private reverse proxy. Wildcards are ignored. |
| `OPENCLAW_URL` | `http://127.0.0.1:18789` | Optional server-side generation gateway |
| `OPENCLAW_TOKEN` | unset | Enables server-side AI generation |
| `OPENCLAW_AGENT_ID` | `skitkit` | Agent used for server-side generation |
| `TTS_URL` | `http://127.0.0.1:8001` | Optional Pocket TTS-compatible service |

The browser and local server have different AI paths. Browser Studio connects directly to user-selected providers. Server-mode generation uses the configured OpenClaw agent.

## Optional custom voices

The local server exposes voice import, analysis, processing, preview, and finalization routes. To synthesize with the built-in server workflow, run a compatible TTS service and set `TTS_URL`.

The editor hides voice-creation controls in Browser Studio and enables them automatically in local server mode.

Browser Studio's **Custom TTS** option is separate from the built-in voice-creation workflow. It distinguishes a TTS app on the same computer from a server hosted elsewhere and supports OpenAI-compatible, Hermes/Piper, JSON, and form-data speech endpoints. An optional voice-list URL is relayed through `POST /api/tts/proxy/voices`; speech uses `POST /api/tts/proxy`. These relays are intentionally available only on the trusted local authoring server, which can reach services available to the host.

A server-owned relay token is optional: configure `HERMES_TTS_URL`, `HERMES_TTS_TOKEN` (or a systemd `hermes_tts_token` credential), and optionally `HERMES_TTS_AUTH_HEADER`. The server sends that token only to the exact configured URL and does not follow redirects. The Hermes/Piper preset describes a specific JSON speech relay format, not a service automatically installed by Hermes or this project.

Character-level casting is available in both modes under a selected character's **Voice Settings** panel. The skit editor also displays the cast with per-role voice selection and testing. Server mode lists the built-in Pocket-compatible and imported voices. Browser Studio lists voices for its active source and stores source-scoped character defaults plus optional per-skit overrides.

## Complete contributor and capture setup

Automated tests and video capture additionally require:

- Playwright Chromium.
- FFmpeg available on `PATH`.
- Worker dependencies for Cloudflare Worker tests.

Install the repository-managed pieces with:

```bash
npm run setup:full
```

Verify FFmpeg separately:

```bash
ffmpeg -version
```

Run tests:

```bash
npm test
```

Capture one skit:

```bash
npm run capture -- --skit pelicanBenchmark
```

## Community Worker

The `worker/` package powers the public community Pouch. It is not required to run the local studio. Install and operate it only when working on that subsystem.

## Security

The local authoring API can create, change, and delete project data. Keep it bound to localhost or behind a private network you control. Do not expose it through a public tunnel without adding authentication, authorization, restrictive CORS, rate limits, and request-size controls.

## Troubleshooting

### The port is already in use

Set another localhost port in `.env`:

```dotenv
PORT=4173
HOST=127.0.0.1
```

### The editor opens in Browser Studio

Use `http://127.0.0.1:3000/editor?mode=server`. Check `http://127.0.0.1:3000/api/health` if server mode still does not load.

### AI generation is unavailable

Server-mode AI generation requires a reachable OpenClaw gateway and `OPENCLAW_TOKEN`. Browser Studio can instead call OpenAI, OpenRouter, or Anthropic directly with a user-supplied key.

### Voice preview fails

Confirm that the service configured by `TTS_URL` is running and reachable from the Node.js server.
