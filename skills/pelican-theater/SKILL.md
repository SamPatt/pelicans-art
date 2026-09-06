---
name: pelican-theater
description: Make SVG artwork or voiced skits directly from agent chat.
---

# Pelican theater

For standalone artwork, follow [SVG artwork](references/svg.md) and return a viewable PNG plus the editable SVG. Do not expand an artwork request into a skit.

Turn a user's skit request into SVG artwork, a script, local dialogue audio, and an MP4. Write SVG and JSON directly with your current model. The theater does not need a second LLM connection. Honor a request for brainstorming without starting production; otherwise proceed with reasonable creative defaults.

## When to use

Use for local theater installation, direct SVG character creation, skit authoring and revisions, or rendering an editable project into a voiced video. The GUI and a second LLM connection are optional.

## Find or install the runtime

Locate the user's existing `SamPatt/pelicans-art` checkout (`ai-improv-theater` may be its local directory name). It must contain `scripts/theater.mjs`. For a fresh installation, missing dependencies, or a different agent host, read [installation](references/installation.md). For a downloaded release, use the tested runtime commit in the accompanying receipt's `ref` field. Fetch the runtime yourself when it is missing; the user should not need to clone it first. Record the resolved Git commit in the output manifest. Never infer that installing this skill grants access to the private repository.

For a fresh voiced install, choose the setup branch in [installation](references/installation.md) first: `setup --check --tts --python python3.12` performs read-only preflight; `setup --tts` includes ordinary setup; do not run both. Reuse a verified compatible speech service when available, matching the project’s speech profile. New local projects use the pinned April Pocket presets; keep the complete profile emitted by `init`, and start the wrapper command emitted by setup. Run `doctor --json` to diagnose missing tools. After starting Pocket, run `doctor --endpoint <actual-url> --wait 120 --json`; success means actual synthesis returned decodable audio. For other adapters, verify through a short build. A port opening or doctor without speech does not establish voice readiness.

## Create or revise a skit

Read [authoring](references/authoring.md) before writing a new project. Use `init`, then edit its files. Default new projects to `data/projects/<name>` or the user's chosen directory, not shipped `src/` examples. Do not overwrite existing work. You do not need the GUI, an OpenRouter key, an OpenClaw gateway, or Hermes itself to run the theater.

1. Make the setup, escalation, and reveal readable from the audience's view. SVGs pose by default; write explicit scene/action changes to communicate movement. Give spoken lines and costume/reveal beats room to land.
2. Write the SVGs and supported skit actions. Attribute the actual model when known; otherwise use `Unknown`. Record speech engine separately. Reuse existing artwork when it serves the request.
3. Run `validate`, fix reported errors, then `render` (which builds missing speech first). Each command emits JSON and returns nonzero on failure. No paid LLM fallback is permitted unless the user asks for it. Existing user-authorized speech services are supported; use local Pocket by default. If local Pocket is blocked, report the cause and get the user’s choice before substituting network-backed speech. An agent’s configured cloud voice provider is not a local Pocket endpoint.
4. Inspect the capture manifest and opening/reveal/end frames. Ensure every intended spoken line has audio and the video completes. Listen when audio tools are available; otherwise disclose that timing/decoding checks are not a listening review. Fix observed problems, then retry the affected step. After two identical failed retries, retain diagnostics and explain the missing prerequisite rather than claiming completion.

Speech is cached by text, voice, and speech configuration. Changing staging alone should reuse all lines. See [authoring](references/authoring.md) for imported or agent-supplied audio and GUI round-tripping.

## Deliver

For standalone SVGs, follow the [SVG delivery path](references/svg.md). For skits, read [delivery](references/delivery.md). Return the MP4 using the current chat's native artifact/attachment mechanism, with the editable `output/project.json` bundle and source folder. A VPS-local path or localhost URL is not a usable phone link. Use an existing authorized private preview or explain the missing delivery capability. Do not publish to the Pouch, open public ports, or change repository visibility just to make a link.
