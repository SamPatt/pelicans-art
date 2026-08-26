# pelicans.art

An AI-assisted SVG animation studio for making odd little voiced comedy skits.

**Live site:** [pelicans.art](https://pelicans.art/)

The project grew out of [Simon Willison's pelican-on-a-bicycle LLM test](https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/): if a model can draw a recognizable SVG pelican riding a bicycle, what happens when generated SVG characters become reusable, expressive actors?

## What works

- Generate and edit SVG characters, props, and backgrounds.
- Animate faces, eye direction, movement, camera shots, and prop interactions.
- Build sequential skits from a constrained JSON action format.
- Generate or attach voices and synchronize them with captions and mouth movement.
- Run entirely in the browser with local IndexedDB storage and your own provider key.
- Run a local server for custom voice processing, publishing, and live updates.
- Export published skits as self-contained JSON bundles.
- Capture complete skits as shareable H.264/AAC MP4 videos with PNG artwork.

The deliberately simple visual style is part early web animation, part AI artifact. The goal is not photorealism; it is to make model-generated characters directable and funny.

## Try it

Open [pelicans.art](https://pelicans.art/) and choose **Try in Browser**. Provider keys are stored in that browser's local storage and sent directly to the selected provider; the static site does not receive them.

Supported browser-mode providers currently include OpenRouter, OpenAI, and Anthropic for generation, plus OpenAI, ElevenLabs, or browser speech for voices.

## Develop locally

Requirements:

- Node.js 22+
- npm
- Chromium installed through Playwright for tests and captures
- FFmpeg for MP4 capture

```bash
npm ci
npm --prefix server ci
npm --prefix worker ci
npx playwright install chromium
npm --prefix server start
```

The local authoring server listens on `127.0.0.1:3000` by default:

- Studio: `http://127.0.0.1:3000/editor`
- Player: `http://127.0.0.1:3000/player`
- Health: `http://127.0.0.1:3000/api/health`

Copy `.env.example` to `.env` to configure Pocket TTS or the optional agent integration. Keep the authoring server private: its write APIs are intended for a trusted local environment, not direct exposure to the public internet.

## Test

```bash
npm test
```

This runs server validation/security unit tests and Playwright coverage for the editor, every bundled skit, and the playback-completion contract used by capture tools.

## Capture a skit

With the local server running:

```bash
npm run capture -- --skit theBox
npm run capture -- --all
```

Each skit is written to `artifacts/captures/<skit>/` with:

- `<skit>.mp4` — H.264 video with synchronized AAC dialogue audio
- `cover.png` — clean opening frame
- `still.png` — captioned in-scene frame
- `manifest.json` — duration, codec, dialogue completeness, and browser diagnostics

Use `npm run capture -- --help` for server, output, timeout, and caption options.

## Skit format

```json
{
  "meta": { "title": "The Interview" },
  "stage": { "background": "office", "orientation": "landscape" },
  "cast": {
    "candidate": { "sprite": "man-suit", "x": 30 },
    "cat": { "sprite": "cat", "x": 70 }
  },
  "props": {},
  "script": [
    { "do": "shot", "type": "wide" },
    { "do": "say", "who": "candidate", "line": "Thank you for meeting with me." },
    { "do": "emote", "who": "cat", "emotion": "angry" },
    { "do": "say", "who": "cat", "line": "Hiss." }
  ]
}
```

Supported actions cover dialogue, pauses, emotions, looks, turns, entrances, exits, movement, camera shots, and prop spawning/holding/movement/animation. See `docs/` and the editor UI for the complete authoring vocabulary. The short [How it works](https://pelicans.art/how-it-works.html) tour explains the design and capture pipeline.

## Architecture

- `src/` — static site, studio, player, SVG assets, and bundled skits
- `server/` — local Express authoring/publishing/TTS server
- `worker/` — community “Pouch” Cloudflare Worker
- `svg-prompt-lab/` — standalone prompt comparison lab
- `scripts/capture-skit.js` — reproducible screenshot and video capture
- `tests/e2e/` — browser tests

GitHub Pages deploys only `src/`. The local server and its secrets are not part of the public static deployment.

## Project status

Working prototype. The public viewer and browser studio are usable. The repository is being prepared for a later public release; the local authoring server should remain private.

## License

The source code is available under the [MIT License](LICENSE). Creative assets and third-party references have separate terms described in [ASSET-LICENSE.md](ASSET-LICENSE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
