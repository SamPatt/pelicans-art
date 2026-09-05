# Installation

Use a shell/file capable agent. First inspect OS, architecture, Node/npm, Python, FFmpeg/ffprobe, free disk/RAM, existing theater checkout, existing TTS, and free ports. For a sandboxed agent inspect its execution container, not only the host. Do not modify its gateway environment or disable its sandbox.

## Checkout and skill registration

The user can begin with the public skill ZIP and release receipt linked by https://pelicans.art/agent.html. Download and extract the complete folder in a fresh temporary directory, verifying the ZIP's SHA-256 against the receipt before using it. Read this skill directly for the current conversation; persistent skill registration is optional. Do not require the user to clone the runtime or restart their chat first.

Repository: `https://github.com/SamPatt/pelicans-art.git`. Fetch it yourself into a fresh user-writable directory if no suitable checkout exists. For a downloaded release, check out the exact tested commit in the receipt's `ref` field and verify `git rev-parse HEAD` matches. For a skill read directly from a repository checkout, keep that checkout's revision. Do not reset or pull over user changes.

While the repository is private, use existing Git authentication. If an SSH alias named `github-pelicans` is already configured for github.com, use `git@github-pelicans:SamPatt/pelicans-art.git`; it can select a repository-specific read-only deploy key. Otherwise use existing authenticated HTTPS or standard GitHub SSH access. Check access with `git ls-remote` before cloning. If neither works, explain that read access must be granted; do not ask the user to do a manual clone as the default workflow. Never put tokens in URLs or chat, change visibility, generate replacement keys, or modify SSH authentication as an installation shortcut.

The complete skill folder contains SKILL.md and references. Copy/install the folder, not just its entrypoint. Check the installed agent's help because versions differ:

- Hermes: active profile's skills directory (usually `~/.hermes/skills/pelican-theater/`); verify with its skills listing. Reading the extracted skill directly is sufficient for this task; future sessions can discover the registered copy. Respect a custom HERMES_HOME/profile.
- OpenClaw: `openclaw skills install ./skills/pelican-theater` from the checkout on versions supporting local installs, or copy the folder into the active workspace's `skills/pelican-theater/`. Do not change global gateway configuration. A binary requirement in skill metadata would hide an installer skill before dependencies exist, so this skill deliberately has none.
- Other agents: read SKILL.md directly, or install the full directory using their native skill mechanism. No other agent framework is a runtime dependency.

## Dependencies

Supported initial installation path: Linux and macOS, or Linux through WSL. Node 22+, Python 3.10–3.13 for the pinned Pocket stack, FFmpeg/ffprobe, and Playwright Chromium. Prefer Python 3.12 for a new isolated environment. Do not replace system Python or an agent's Python environment.

From the checkout:

```sh
node scripts/theater.mjs setup
```

This installs root/server npm lockfiles and Chromium. On Linux, install missing Chromium OS libraries with the installed Playwright's `install-deps chromium` command using the environment's normal permission flow. Install FFmpeg via the OS package manager if absent. Worker dependencies are not required for video creation. Use `doctor --json` for actionable missing requirements.

If no compatible local speech service exists:

```sh
node scripts/theater.mjs setup --tts
```

This uses a dedicated `.runtime/pocket-tts` virtual environment and pinned Pocket TTS 1.0.3. Linux installs Torch 2.8.0 from its CPU index before Pocket. First use downloads model/voice weights, so check disk/network and allow time. The command installs dependencies, not a running service. It preserves project configuration. Re-running npm setup reconciles the locked dependency tree; don't run it in another application's environment.

Start a scoped process using the absolute executable path reported by setup:

```sh
.runtime/pocket-tts/bin/pocket-tts serve --host 127.0.0.1 --port 8001
```

Check the port first; choose another free loopback port if occupied. Set `project.json`'s complete `tts.endpoint`, including `/tts`, accordingly. Keep this process alive while building lines so weights stay loaded. Reuse a healthy existing service. A persistent service is optional: if requested, generate a service for the actual user/path; do not copy the repository's old machine-specific service file. Never replace Hermes's own TTS configuration as an installation shortcut.

Verify:

```sh
node scripts/theater.mjs doctor --endpoint http://127.0.0.1:8001/tts --json
node scripts/theater.mjs init data/projects/smoke-test
node scripts/theater.mjs render data/projects/smoke-test
```

If the user requested voice, missing speech is a failure to fix, not permission to switch silently to captions. Explicit caption-only projects use `init ... --silent`.

Existing speech: `pocket` uses multipart text/voice_url; `openai-compatible` uses input/voice/model JSON; `piper` uses text/voice/rate/depth/format JSON. Piper is a specific relay format, not every Piper installation. Set an exact endpoint and verify an audio response. Credential config contains an environment variable name (`tokenEnv`), not its secret value. A chat agent's speech tool can instead supply local WAV/MP3/OGG files for individual lines.

The installer prefers an existing `uv` for isolated Python installation, with standard `venv`/pip as fallback. On Debian/Ubuntu without uv, install the matching `python3-venv` package if ensurepip is missing. Select another compatible interpreter with `setup --tts --python python3.12`.
