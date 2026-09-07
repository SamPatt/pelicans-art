# Make skits through an agent

Copy the prompt at [Create with your agent](https://pelicans.art/agent.html) into a file-and-shell capable agent. It retrieves the public skill ZIP and receipt first, then fetches the tested runtime commit using existing Git access. You do not need to clone or install the skill manually. In an existing checkout, the agent can read `skills/pelican-theater/SKILL.md` directly. It writes SVGs and skit JSON directly, generates local voices, and renders with the same player as the GUI. No OpenRouter or other LLM API call is made by the CLI. Your agent's own model usage remains separate.

The downloadable skill pins a tested runtime commit in its release receipt. The repository is public. Agents can fetch `https://github.com/SamPatt/pelicans-art.git` over HTTPS without GitHub credentials, tokens, or a deploy key.

## Commands

Run from the repository root. `node scripts/theater.mjs help` describes options. Commands write JSON to stdout and return nonzero for failure.

```sh
# Choose ONE: setup with an existing speech service, or setup --tts for new local Pocket.
node scripts/theater.mjs setup --tts --python python3.12
# Start the executable reported by setup, bound to localhost.
# After the speech server is running:
node scripts/theater.mjs doctor --endpoint http://127.0.0.1:8001/tts --wait 120 --json
node scripts/theater.mjs init data/projects/my-skit
node scripts/theater.mjs validate data/projects/my-skit
node scripts/theater.mjs finish data/projects/my-skit
```

Install FFmpeg using your OS package manager. `setup` installs npm dependencies and Chromium; Linux browser OS libraries may need `npx playwright install-deps chromium`. `setup --tts` adds an isolated pinned Pocket 2.1.0 environment under `.runtime/`, with CPU Torch 2.8.0 on Linux. It does not alter the agent's environment or start services. Locked local Pocket setup supports Linux x64 and ARM64/WSL with glibc 2.28+ and Python 3.12; other platforms can use an existing compatible speech endpoint.

Edit `skit.json` and `assets/` in the created project. Set `meta.model` and asset metadata to the actual model or Unknown. `project.json` controls speech: Pocket, an OpenAI-compatible endpoint, a specific Piper JSON relay, or explicit caption-only mode (`init --silent`). The complete speech URL belongs in `tts.endpoint`. Authentication uses `tts.tokenEnv` plus optional `authHeader`/`authPrefix`, not a stored token.

`build` is available separately from `render`. Speech is cached by text, voice, engine/model and delivery configuration. Unchanged lines survive a camera/pause edit. Supplied audio files are accepted in `skit.json`'s `assets.audio`; the agent must replace/remove a supplied recording when editing its text.

`setup --tts` includes normal setup. Its JSON contains the actual isolated Python/Pocket versions, `tts.executable`, `tts.serveCommand` argv, endpoint, and `tts.readiness` executable/args. Doctor reports platform/architecture and `pocketRuntime` separately from system Python. `doctor --endpoint ... --wait 120` verifies real decodable speech within one overall wait deadline. Without `--wait` it makes one attempt. HTTP errors and invalid audio fail immediately; connection failures report cause codes. A timeout does not establish that a model is loading.

## Standalone SVGs

Ask your agent for a character, prop, background, or illustration without making a skit. The agent writes the SVG directly, then delivers the original and a PNG preview:

```sh
# Only if preview dependencies are missing; no TTS, Python or FFmpeg needed.
node scripts/theater.mjs setup --check --svg
node scripts/theater.mjs setup --svg
node scripts/theater.mjs svg data/artwork/pelican-v1 --source /path/to/pelican.svg --kind character --model "GPT-6 Astra" --title "Stage manager"
```

Use the actual model name or omit it for `Unknown`. `--kind artwork` is the default and accepts ordinary illustrations; `character` additionally checks the theater's required animation IDs. Each delivery directory must be new. The CLI returns `asset.svg`, a full-frame `preview.png`, and a portable metadata manifest with hashes. The agent should inspect and display the PNG inline, then attach the SVG through the chat's file tools. No server, skit, paid generation API, or public upload is involved. See the [standalone SVG reference](../skills/pelican-theater/references/svg.md).

## Outputs and editing

The render result identifies the MP4, thumbnail, capture manifest, and self-contained `output/project.json` bundle with absolute local paths for attachment tools. Saved build manifests use `pathBase: "project"` and paths relative to the source project root; capture media filenames are relative to the capture manifest. The manifest checks complete voiced dialogue and H.264/AAC output. Caption-only mode is explicit. Keep the source directory and cache for future edits.

The [companion Editor](EDITOR.md) opens built bundles with **Open project**. It preserves unchanged recordings, lets users edit layout/dialogue/pauses, and exports a revised bundle. Changed lines are previewed with captions and marked as needing audio; use the CLI to regenerate them. Copy requests include the selected scene or character. Optional private Hermes chat proposes edits for review.

To resume a downloaded GUI bundle in the CLI:

```sh
node scripts/theater.mjs import data/projects/revised --bundle /path/to/download.json
node scripts/theater.mjs finish data/projects/revised
```

CLI bundles preserve explicit caption-only mode when reimported. Unknown or misplaced command options return JSON errors before work begins.

The importer requires an empty directory and records which text/casting each supplied recording matches. If an imported line changes, it is synthesized again.

## Distribution and testing

`python3 scripts/package-agent-skill.py` produces the deterministic versioned ZIP and SHA-256 receipt under `src/downloads/`. The source folder works with Hermes, OpenClaw, and generic agents; see its installation reference for host-specific registration.

For local regression checks: `npm run test:agent` (FFmpeg required) and `npm test`. Tests use local mock speech endpoints; a real Pocket voice/render smoke test is separate. See `AGENT-WORKFLOW-PLAN.md` for the future fresh Hermes-session rehearsal. No VPS or gateway configuration is changed by installing this repository.

Deliver the MP4 through the current chat's artifact/file tool. A localhost link on a VPS is not a phone-accessible deliverable. The CLI does not publish to the Pouch or expose public services.

The installer prefers an existing `uv` for isolated Python installation, with standard `venv`/pip as fallback. On Debian/Ubuntu without uv, install the matching `python3-venv` package if ensurepip is missing. Select another compatible interpreter with `setup --tts --python python3.12`.

## Implementation verification — September 5, 2026

The subsequent [full CLI verification](CLI-VERIFICATION.md) now covers 86 passing tests, including 26 CLI tests, and verifies a fresh application installation with an empty speech-model cache. The earlier checks below record the initial implementation.

70 tests pass: 35 browser, 14 server, 11 Worker, and 10 CLI tests. CLI checks cover unsafe/missing assets, actual outside-file and symlink containment, malformed actions, interrupted speech recovery, corrupt-cache repair, edited imported dialogue and recasting, speech adapter requests and redirect handling, retryable imports, and actual caption-only and voiced MP4 capture. The voiced capture imports The Description with its props and costume variants and muxes all eight recorded lines as H.264/AAC. Browser tests cover real homepage-to-tour-to-agent clicks at five widths, the phone entry page, downloadable skill, import and recorded-audio export.

A fresh isolated Python runtime installed Pocket TTS 1.0.3 with Torch 2.8.0+cpu (CUDA disabled), started on a separate loopback port, passed actual speech synthesis, and rendered a three-line/two-voice skit. Repeating setup succeeded; repeating the real build generated zero lines and reused three. The host's existing model-download cache was available: this is not a clean-account model-download test. No LLM API was called.

The versioned skill archive matches its four source files and SHA-256 receipt; skill frontmatter validation passed. Opening/reveal frames and phone/desktop entry-page layouts were inspected. These checks do not substitute for the pending fresh Hermes-session and phone-delivery rehearsal. The Hermes VPS remains untouched. Site copy now recommends agent/CLI creation; Browser Studio remains an optional editor.

A further real Pocket rehearsal created three lines using Marius and Alba, changed one line, generated exactly one replacement while reusing two, and rendered all three lines with clean capture diagnostics. Local evidence is in ignored `artifacts/agent-workflow/revision-rehearsal.json`. This used the existing model cache and does not establish fresh Hermes installation or chat attachment delivery.

For the editable ZIP layout and exclusions, see the skill's [delivery reference](../skills/pelican-theater/references/delivery.md). Keep caches locally, but omit them from delivery.

## Pinned April preset speech

New projects and imports use the exact audition profile in `scripts/theater/pocket-profile.json`: Pocket 2.1.0, the non-voice-cloning April English checkpoint, independently pinned preset embeddings, CPU Torch 2.8.0, and seed 4711 reset per line. Setup downloads the pinned files and verifies the model SHA-256. Start the emitted Python wrapper, not bare `pocket-tts serve`. The service confirms its profile on each new synthesis request; the CLI rejects a mismatched or unconfirmed profile. All 26 pinned April presets are supported; Marius, Jean, and Alba are the audition defaults.

Existing supplied recordings remain untouched. Old project configurations retain their old speech settings and cache; to migrate new/revised dialogue, copy the full TTS configuration from a newly initialized project and adjust its endpoint. The cache includes the full profile, both revisions, and text-prefix setting. The new profile sends original text without the comma workaround; legacy unprofiled Pocket configurations keep their previous prefix behavior. Do not claim voice-cloning or emotional-delivery improvements from this preset audition. Loudness normalization and the bonus-round 1.15× tempo are not implicit generation defaults.

Local April-profile verification (2026-09-06): installed Pocket 2.1.0 into a separate environment with Torch 2.8.0+cpu; the supported `setup --tts` command succeeded. The model checksum matched, the service reported two threads, and all three presets synthesized real audio. Repeating a Marius line returned byte-identical WAV data. A four-line build reused all four lines on repetition; editing one line regenerated one and reused three. The MP4 contained all four expected recordings, H.264/AAC, and no capture diagnostics. Original-text and comma-prefixed comparison WAVs were generated; this is not a new blind listening verdict. Existing model-download caches were available. Fresh-account downloads, macOS, and a fresh Hermes installation remain unverified; Hermes was not modified.

### Installation boundaries

Run `node scripts/theater.mjs setup --check --tts --python python3.12` before installation. The locked local speech installer supports Linux x64 and ARM64 with glibc 2.28+ and Python 3.12. Other platforms should use an existing compatible endpoint until independently verified. Setup refuses root, redirected dependency directories, and non-isolated existing speech environments; no system packages or services are installed. Host package changes require explicit opt-in. Per-attempt receipts under `.runtime/install-*.json` document the footprint and shared caches. See the [installation reference](../skills/pelican-theater/references/installation.md) for removal and platform limits.

## Plan before production

The agent walks through format (portrait 9:16 or landscape 16:9), character appearances and voices, setting, scene beats, and exact dialogue in chat. It incorporates feedback and waits for approval before generating finished SVGs, speech, or video. No storyboard file or Editor is required. An already approved plan counts, and explicit requests to skip review are respected. Keep the same project and cache for revisions; review a built bundle through an accessible player when a new MP4 is unnecessary.

## Search assets and iterate without custom helper scripts

The portable skill now includes [asset discovery and workflow tools](../skills/pelican-theater/references/workflow-tools.md). Search before the chat proposal, inspect candidate previews, and agree which artwork to reuse, adapt, or create.

```sh
node scripts/theater.mjs assets search --query "coffee" --source all
node scripts/theater.mjs assets add data/projects/my-skit --source local --category props --id astra-coffee-cup --name coffee
node scripts/theater.mjs preview data/projects/my-skit --serve
node scripts/theater.mjs finish data/projects/my-skit
node scripts/theater.mjs inspect data/projects/my-skit
node scripts/theater.mjs package data/projects/my-skit
```

`preview` avoids MP4 capture and reuses cached speech. `inspect` checks the existing video and creates review images. `package` makes the source ZIP and returns attachment paths, MIME types, sizes, and hashes; it refuses stale renders. Local preview links require an existing authorized delivery route for mobile users.

New SVG deliveries emit `meta.json` with category, description, tags, and model. Keep that metadata with the artwork and include it when uploading to the Pouch. Pouch search results expose those fields for new uploads and tolerate incomplete legacy metadata. Imports preserve source attribution and metadata; generation and packaging do not upload automatically.

## Combined completion (skill 1.0.16)

Use `finish <project>` after authoring. It validates/builds, renders, checks decoding and speech coverage, makes a contact sheet, and creates an integrity-verified editable ZIP. Review the contact sheet once and listen where supported, then attach the returned files. JSON includes phase timings, report paths, and delivery hashes. Individual `render`, `inspect`, and `package` commands remain available for troubleshooting; do not repeat passed checks without a changed artifact or observed problem.

Closeups now target SVG face geometry and two-shots fit the painted cast. The capture synchronization marker is recorded outside the stage and cropped from the export, preserving the opening audio. See the portable skill's authoring reference for staging rules.
