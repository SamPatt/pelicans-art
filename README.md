# pelicans.art

An AI-assisted SVG animation studio for making odd little voiced comedy skits.

**Live site:** [pelicans.art](https://pelicans.art/)

The project grew out of [Simon Willison's pelican-on-a-bicycle LLM test](https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/): if a model can draw a recognizable SVG pelican riding a bicycle, what happens when generated SVG characters become reusable, expressive actors?

## Choose your entrance

| You want to… | Start here | Setup |
| --- | --- | --- |
| Watch a finished skit | [The Description](https://pelicans.art/watch/the-description/) | None |
| Create through an agent chat | [Agent workflow](docs/AGENT-WORKFLOW.md) and [portable skill](skills/pelican-theater/SKILL.md) | Local rendering and speech; no additional LLM API key |
| Remix or create | [Browser Studio](https://pelicans.art/sprite-editor.html?mode=browser) | None; an API key is optional |
| Develop, capture, or use custom voices | [Run locally](docs/LOCAL-SETUP.md) | Node.js and optional media tools |

Most people should use the Browser Studio. Running the local server is intended for contributors and power users, not as a prerequisite for trying the project.

## What works

- Generate and edit SVG characters, props, and backgrounds.
- Animate faces, eye direction, movement, camera shots, and prop interactions.
- Build sequential skits from a constrained JSON action format.
- Generate or attach voices and synchronize them with captions and mouth movement.
- Store browser projects locally in IndexedDB and export portable backups.
- Run a private local authoring server for filesystem assets and custom voice processing.
- Export published skits as self-contained JSON bundles.
- Capture complete skits as H.264/AAC MP4 videos with PNG artwork.

The deliberately simple visual style is part early web animation, part AI artifact. The goal is not photorealism; it is to make model-generated characters directable and funny.

## Browser Studio

Open [pelicans.art](https://pelicans.art/) and choose **Open Studio**. The first-run guide offers four paths:

- Remix the bundled pelican scene with no credentials.
- Create manually with no credentials.
- Import something from the community Pouch.
- Connect an AI provider and generate something new.

OpenAI, OpenRouter, and Anthropic are supported for AI generation. Voice playback defaults to **No Voices – Only Captions**; OpenAI, ElevenLabs, and configurable TTS servers are optional. Provider keys and TTS tokens can be kept for only the current browser session or remembered on the device.

See [Browser Studio guide](docs/BROWSER-STUDIO.md) for storage, keys, model choices, backups, and limitations.

## Run locally

Requirements for the basic local studio:

- Node.js 22+
- npm

```bash
git clone https://github.com/SamPatt/pelicans-art.git
cd pelicans-art
npm run setup
npm run dev
```

Then open `http://127.0.0.1:3000/editor`.

The basic local studio does not require OpenClaw, Pocket TTS, Playwright, FFmpeg, or the Cloudflare Worker. Those are optional depending on what you are doing. See [Local setup](docs/LOCAL-SETUP.md) for the complete feature matrix and configuration.

Keep the authoring server private. Its write APIs are designed for a trusted local environment, not direct exposure to the public internet.

## Test

Install the complete contributor toolchain and run the suite:

```bash
npm run setup:full
npm test
```

This runs server validation/security unit tests, Worker tests, and Playwright coverage for the editor, onboarding, every bundled skit, and the playback-completion contract used by capture tools.

## Capture a skit

FFmpeg and Playwright Chromium are required. With the local server running:

```bash
npm run capture -- --skit theBox
npm run capture -- --all
```

Each skit is written to `artifacts/captures/<skit>/` with:

- `<skit>.mp4` — H.264 video with synchronized AAC dialogue audio.
- `cover.png` — clean opening frame.
- `still.png` — captioned in-scene frame.
- `manifest.json` — duration, codec, dialogue completeness, and browser diagnostics.

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

Supported actions cover dialogue, pauses, emotions, looks, turns, entrances, exits, movement, camera shots, and prop spawning/holding/movement/animation. The short [How it works](https://pelicans.art/how-it-works.html) tour explains the design and capture pipeline.

## Architecture

- `src/` — static site, Browser Studio, player, SVG assets, and bundled skits.
- `server/` — private local Express authoring, publishing, and TTS server.
- `worker/` — community Pouch Cloudflare Worker.
- `svg-prompt-lab/` — standalone prompt comparison lab.
- `scripts/capture-skit.js` — reproducible screenshot and video capture.
- `tests/e2e/` — browser tests.

GitHub Pages deploys only `src/`. The local server and its secrets are not part of the public static deployment.

See [CONTRIBUTING.md](CONTRIBUTING.md) before changing code or creative assets.

## Project status

Working prototype. The viewer and Browser Studio are usable. The repository is being prepared for a public release; the local authoring server should remain private.

## License

The source code is available under the [MIT License](LICENSE). Creative assets and third-party references have separate terms described in [ASSET-LICENSE.md](ASSET-LICENSE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
