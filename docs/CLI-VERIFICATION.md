# CLI verification — September 5, 2026

The local Linux CLI workflow passed installation, creation, revision, import, and video checks. This is preparation for the separate Hermes agent rehearsal, not a claim that every platform or speech service has been tested.

## Fresh installation and real speech

A fresh source export started without `node_modules` or `.runtime`. `setup --tts` installed locked Node dependencies, Chromium, and an isolated Pocket TTS 1.0.3 environment. `doctor --json` verified Node 22.23.1, npm 10.9.8, Python 3.12.3, FFmpeg/ffprobe 6.1.1, and an actual Chromium launch.

The new speech runtime used a new, empty `HF_HOME`. It downloaded its models anonymously and passed `doctor --endpoint` with real synthesis. Repeating `setup --tts` succeeded. System tools and browser OS libraries were already installed, and package/browser download caches could be reused. This was a clean application installation on an existing Linux host, not a blank OS installation.

The real workflow ran from outside the checkout, using project and output paths containing spaces:

| Exercise | Result |
| --- | --- |
| `init`, edit speech endpoint, `validate`, `build` | Three lines synthesized with Marius and Alba |
| Change a pause and build | Zero new lines; three cache hits |
| Recast the clerk as Jean | One new line; two cache hits |
| `import` the bundle, then build | Three supplied recordings; no synthesis |
| Edit one imported line and build | One new recording; two supplied recordings retained |
| `render --output` | Complete H.264/AAC MP4, all three lines muxed, no capture diagnostics |

An extracted video frame was visually inspected. Automated codec/completeness checks do not evaluate acting or pronunciation. Local machine-readable results are retained in ignored `artifacts/agent-workflow/full-cli-rehearsal.json`.

## Automated coverage

Run `npm run test:agent` for 19 CLI integration tests. FFmpeg and Chromium are required. These cover:

- Strict option parsing, JSON errors, missing option values, invalid ports, help, and protection against overwriting projects.
- Missing system-tool diagnostics and unavailable or invalid speech responses.
- Caption-only build/import round trips, including characters without voices.
- Portrait 720×1280 rendering, alternate output paths, execution outside the checkout, port release, and preserving an existing service on an occupied port.
- Full voiced rendering of The Description: eight recorded lines, props, and costume variants, with H.264/AAC output.
- Interrupted speech recovery, corrupt-cache repair, text and voice revisions, and speech-model cache invalidation.
- Supplied WAV files, stale-recording validation, retryable imports, malformed scripts, unsafe SVG, and real outside-file/symlink containment.
- OpenAI-compatible and Piper request contracts, credentials, and redirect refusal using local fixtures. These are not live-provider certification tests.

The full `npm test` suite also covers 35 browser, 14 server, and 11 Worker tests: 79 tests total.

## Issues found and fixed

1. Unknown or misplaced flags were accepted silently. Commands now validate their own options and reject malformed arguments before starting work.
2. Importing a captions-only bundle selected Pocket and could demand missing voices. CLI bundles now preserve explicit `captionOnly` intent through import.
3. A stale supplied recording incorrectly satisfied voice validation after dialogue changed. Validation now checks the recording's text/casting binding and requires a replacement voice or matching recording.
4. Help omitted the import syntax. It now documents import, validate, and build explicitly.

## Remaining verification

- Fresh Hermes session: installation through the skill, project creation without hidden manual steps, and actual video attachment delivery to a phone.
- macOS, Windows/WSL, and hosts missing browser OS libraries or FFmpeg.
- Real third-party Piper/OpenAI-compatible services and any host-specific authentication.

No LLM API was called. No VPS configuration was changed. Temporary test speech services were stopped after use.
