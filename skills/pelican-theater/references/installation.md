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

Choose **one** setup path after inspecting existing speech services:

- If a compatible speech service is already verified, or the user explicitly wants captions only, run `node scripts/theater.mjs setup`.
- If local Pocket is needed, run `node scripts/theater.mjs setup --tts --python python3.12` (select an installed compatible interpreter). This includes normal setup; do not run `setup` first.

Both install root/server npm lockfiles and Chromium. On Linux, install missing browser OS libraries with Playwright's `install-deps chromium` through the normal permission flow. Install FFmpeg through the OS package manager if absent. Worker dependencies are unnecessary for video creation. Setup reconciles this checkout's locked dependency tree, so run it only in the theater checkout.

`setup --tts` adds a dedicated `.runtime/pocket-tts` environment with Pocket 1.0.3 and CPU Torch 2.8.0 on Linux. First use downloads model/voice weights. It installs dependencies but starts no service. Output includes the actual isolated Python/version, `tts.executable`, `tts.serveCommand` as an argument array, the default endpoint, and `tts.readiness` with an executable and argument array.

Start and verify a scoped Pocket process:

1. Confirm the selected loopback port is free; choose another if occupied.
2. Launch `tts.executable` with the `tts.serveCommand` argument array, changing its port if needed. Use a process tool's executable/argv fields; do not interpolate an unquoted path into a shell command.
3. Run the emitted readiness executable and args, adjusting the endpoint if you selected another port. Equivalent command from the checkout:

   ```sh
   node scripts/theater.mjs doctor --endpoint http://127.0.0.1:8001/tts --wait 120 --json
   ```

4. Require `speech.ok: true`. This probe performs synthesis and decodes the response with ffprobe. It waits within one deadline for retryable connection failures; HTTP errors and invalid audio fail immediately. Read `kind`, `code`/`status`, `attempts`, and `elapsedMs` on failure. A timeout does not prove that a model is loading: inspect the service logs before retrying.
5. Set the project's complete `tts.endpoint`, including `/tts`, and keep the service alive through builds. Stop only the scoped process you started when the task no longer needs it. Do not stop preexisting speech services.

Without `--wait`, doctor performs one speech attempt. `--wait` is in seconds (0–300), not a per-attempt timeout. Its `pocketRuntime` reports the isolated interpreter separately from the system `checks.python3`. The default endpoint and readiness args emitted by setup are suggestions, not a claim that port 8001 is available or a server is running.

Create and render after readiness succeeds:

```sh
node scripts/theater.mjs init data/projects/smoke-test
node scripts/theater.mjs render data/projects/smoke-test
```

A persistent service is optional and requires a user request. Never replace Hermes's own TTS configuration or another service as an installation shortcut.

If the user requested voice, missing speech is a failure to fix, not permission to switch silently to captions. Explicit caption-only projects use `init ... --silent`.

Existing speech: `pocket` uses multipart text/voice_url; `openai-compatible` uses input/voice/model JSON; `piper` uses text/voice/rate/depth/format JSON. Piper is a specific relay format, not every Piper installation. Set an exact endpoint and verify an audio response. Credential config contains an environment variable name (`tokenEnv`), not its secret value. A chat agent's speech tool can instead supply local WAV/MP3/OGG files for individual lines.

The installer prefers an existing `uv` for isolated Python installation, with standard `venv`/pip as fallback. On Debian/Ubuntu without uv, install the matching `python3-venv` package if ensurepip is missing. Select another compatible interpreter with `setup --tts --python python3.12`.
