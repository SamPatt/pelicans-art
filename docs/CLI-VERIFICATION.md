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

## Readiness and delivery release follow-up

The post-Hermes reliability pass brings the suite to 86 passing tests: 35 browser, 14 server, 11 Worker, and 26 CLI. New coverage verifies delayed listeners, one overall readiness deadline, immediate HTTP/invalid-audio failures, connected-response timeouts, credential-safe diagnostics, separate isolated Pocket diagnostics, and build-manifest relocation.

A real startup test launched Pocket directly from setup's executable/argv output and immediately ran its emitted readiness command. Speech succeeded on attempt 4 after 4190 ms, followed by a complete three-line voiced MP4 with clean capture diagnostics. The setup report correctly identified the isolated Python as 3.12.8 while system Python was 3.12.3. Saved build metadata used `pathBase: "project"` and `bundle: "output/project.json"`; immediate CLI results retained absolute attachment paths. Local evidence: ignored `artifacts/agent-workflow/readiness-release.json`.

The new skill chooses one setup path, explicitly waits after starting Pocket, and defines delivery ZIP contents without caches. Fresh Hermes retesting remains user-operated. Use a new session, a new checkout/install directory, and a newly started scoped Pocket process; preserve the prior project, model cache, and Git credentials. This tests a fresh application install without requiring system-package removal or another cold model download.

## Installer isolation rehearsal — 2026-09-06

A fresh temporary checkout installed root/server dependencies, Chromium, and a new Python 3.12 Pocket environment using the 47-package SHA-256 lock. The emitted doctor command passed Chromium launch and real decodable speech on a separate loopback port. Existing download caches and host FFmpeg/browser libraries were reused: this is a fresh checkout/environment test, not a blank OS, fresh Hugging Face account, macOS, or new Hermes VPS test.

Boundary tests cover incompatible platforms, redirected dependency directories, isolated versus system-site venvs, normal interpreter symlinks, and mutation-free failed preflight. CI explicitly selects Python 3.12 for these tests. Setup starts no service, blocks root use, clears Python installer environment overrides, serializes setup attempts, and records partial/completed installation footprints. Cleanup instructions preserve shared caches and user projects. A skill is still agent guidance, not a sandbox.

The lock was compiled from the audition runtime's installed versions with uv, Python 3.12 and `x86_64-manylinux_2_28`, using PyPI and the official PyTorch CPU index. All packages and transitive dependencies are version-pinned and hashed; installation requires binary wheels. Other platforms are deliberately not claimed as supported by automatic local Pocket setup.

## Standalone SVG delivery — 2026-09-06

The `svg` command was tested with ordinary artwork and a theater character. Tests verify PNG dimensions, byte-for-byte SVG preservation, portable model/hash metadata, refusal to overwrite deliveries, and rejection of malformed/executable/external SVG content. SVG-only preflight checks no Python/FFmpeg tools. A fresh temporary checkout ran `setup --svg` and delivered the existing pelican emcee artwork without server dependencies or Pocket. Existing Chromium/download caches and host browser libraries were reused. The resulting 683×1024 PNG was visually inspected for complete framing. Native chat file transfer remains the responsibility of the calling agent; the CLI emits attachment paths and does not publish files.
