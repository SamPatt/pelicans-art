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

The verified local Pocket installer targets Linux x64 (including WSL) with glibc 2.28+ and Python 3.12. Other architectures, native Windows, and macOS local Pocket installation are not yet supported by the locked installer. Intel macOS lacks the pinned Torch wheels. macOS rendering with an existing compatible speech endpoint is possible but has not had a clean-machine rehearsal. Rendering requires Node 22+, FFmpeg/ffprobe, and Playwright Chromium. Select an already installed Python 3.12 for local Pocket. Do not replace system Python or an agent's Python environment.

Choose **one** setup path after inspecting existing speech services:

- If a compatible speech service is already verified, or the user explicitly wants captions only, run `node scripts/theater.mjs setup`.
- If local Pocket is needed, run `node scripts/theater.mjs setup --tts --python python3.12` (select an installed compatible interpreter). This includes normal setup; do not run `setup` first.

First run the selected setup command with `--check`. It checks tools, platform, free disk/RAM, installation directories, and existing venv isolation without installing anything. Setup repeats these checks before mutations. Inspect available space: the measured Python environment alone is about 1 GB; model files, Chromium and download caches need additional space. Do not treat this as a universal minimum.

Both setup paths install root/server npm lockfiles and Chromium. Setup refuses root execution. Missing FFmpeg, Python/venv support, or browser OS libraries require an explicit user opt-in to the specific host package changes before running an OS package manager or `playwright install-deps`. A request to make a skit alone does not authorize those changes. Explain the missing packages and proposed command; if permission is unavailable, stop with that prerequisite. Never replace system tools, use sudo for setup, or change an agent environment to bypass the check. Worker dependencies are unnecessary for video creation. Setup reconciles this checkout's locked dependency tree, so run it only in the theater checkout.

`setup --tts` adds a dedicated `.runtime/pocket-tts-2.1.0` environment with Pocket 2.1.0 and CPU Torch 2.8.0 on Linux. Setup downloads the exact non-voice-cloning April English model/tokenizer revision `d29db7978e464fb90cb3359ee0c69a273b9142cc` and voice-embedding revision `e041936c75475d350b405bc870bcf7c22da4e9e6`. It verifies the model SHA-256 against `scripts/theater/pocket-profile.json`. Use only the emitted Python wrapper command; bare `pocket-tts serve` does not enforce this profile. It installs dependencies but starts no service. Output includes the actual isolated Python/version, `tts.executable`, `tts.serveCommand` as an argument array, the default endpoint, and `tts.readiness` with an executable and argument array.

Start and verify a scoped Pocket process:

1. Confirm the selected loopback port is free; choose another if occupied.
2. Launch `tts.executable` with the `tts.serveCommand` argument array, changing its port if needed. Use a process tool's executable/argv fields; do not interpolate an unquoted path into a shell command.
3. Run the emitted readiness executable and args, adjusting the endpoint if you selected another port. Equivalent command from the checkout:

   ```sh
   node scripts/theater.mjs doctor --endpoint http://127.0.0.1:8001/tts --wait 120 --json
   ```

4. Require `speech.ok: true`. This probe performs synthesis and decodes the response with ffprobe. It waits within one deadline for retryable connection failures; HTTP errors and invalid audio fail immediately. Read `kind`, `code`/`status`, `attempts`, and `elapsedMs` on failure. A timeout does not prove that a model is loading: inspect the service logs before retrying.
5. Preferred audition voices are `marius`, `jean`, and `alba`. The pinned catalog also supports `javert` and the other shipped April presets; use the character’s selected voice. The service lists available names in `/health` under `voicePresets`; this profile does not support voice cloning. The wrapper uses CPU, no quantization, two threads, temperature 0.7, one decode step, EOS threshold -4.0, and seed 4711 reset for each request. Send original text without adding punctuation prefixes.
6. Set the project's complete `tts.endpoint`, including `/tts`, and keep the service alive through builds. Stop only the scoped process you started when the task no longer needs it. Do not stop preexisting speech services.

Without `--wait`, doctor performs one speech attempt. `--wait` is in seconds (0–300), not a per-attempt timeout. Its `pocketRuntime` reports the isolated interpreter separately from the system `checks.python3`. The default endpoint and readiness args emitted by setup are suggestions, not a claim that port 8001 is available or a server is running.

Create and render after readiness succeeds:

```sh
node scripts/theater.mjs init data/projects/smoke-test
node scripts/theater.mjs render data/projects/smoke-test
```

A persistent service is optional and requires a user request. Never replace Hermes's own TTS configuration or another service as an installation shortcut.

If the user requested voice, missing speech is a failure to fix, not permission to switch silently to captions. Explicit caption-only projects use `init ... --silent`.

Existing speech: `pocket` uses multipart text/voice_url; `openai-compatible` uses input/voice/model JSON; `piper` uses text/voice/rate/depth/format JSON. Piper is a specific relay format, not every Piper installation. Set an exact endpoint and verify an audio response. Credential config contains an environment variable name (`tokenEnv`), not its secret value. A chat agent's speech tool can instead supply local WAV/MP3/OGG files for individual lines.

Python packages and transitive dependencies are pinned with SHA-256 hashes in `scripts/theater/pocket-linux-py312.lock`; installation requires binary wheels and checks hashes. Re-resolving or loosening the lock is a maintainer task, not an installation workaround.

Each setup attempt writes `.runtime/install-<timestamp>.json` before installation, including planned new directories, reused directories, resource observations, and shared cache categories. A completed attempt also updates `.runtime/install-receipt.json`. A failed attempt may leave partial dependencies; retain the receipt when reporting it. For removal, preview only the recorded new directories and verify they still belong to this installation before removing them. Preserve user projects, reused directories, and shared npm/Playwright/pip/uv/Hugging Face caches. Setup starts no processes; separately record exact process IDs for services the agent starts and stop only those. Never use broad process-name kills or cache deletion as cleanup.

The installer prefers an existing `uv` for isolated Python installation, with standard `venv`/pip as fallback. On Debian/Ubuntu without uv, install the matching `python3-venv` package if ensurepip is missing. Select another compatible interpreter with `setup --tts --python python3.12`.
