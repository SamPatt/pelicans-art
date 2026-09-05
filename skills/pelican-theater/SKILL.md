---
name: pelican-theater
description: Install the pelicans.art theater and create, revise, or render voiced SVG comedy skits directly from agent chat. Use for finished animated videos, editable skit projects, or local theater setup; the GUI and OpenRouter are optional.
---

# Pelican theater

Turn a user's skit request into SVG artwork, a script, local dialogue audio, and an MP4. Write SVG and JSON directly with your current model. The theater does not need a second LLM connection. Honor a request for brainstorming without starting production; otherwise proceed with reasonable creative defaults.

## Find or install the runtime

Locate the user's existing `SamPatt/pelicans-art` checkout (`ai-improv-theater` may be its local directory name). It must contain `scripts/theater.mjs`. For a fresh installation, missing dependencies, or a different agent host, read [installation](references/installation.md). For a downloaded release, use the tested runtime commit in the accompanying receipt's `ref` field. Fetch the runtime yourself when it is missing; the user should not need to clone it first. Record the resolved Git commit in the output manifest. Never infer that installing this skill grants access to the private repository.

Run `node scripts/theater.mjs doctor --json` from the checkout. If speech is needed, include `--endpoint` with the actual Pocket-compatible endpoint, or test the chosen speech adapter through a short build. Success without a speech probe does not establish voice readiness.

## Create or revise

Read [authoring](references/authoring.md) before writing a new project. Use `init`, then edit its files. Default new projects to `data/projects/<name>` or the user's chosen directory, not shipped `src/` examples. Do not overwrite existing work. You do not need the GUI, an OpenRouter key, an OpenClaw gateway, or Hermes itself to run the theater.

1. Make the setup, escalation, and reveal readable from the audience's view. SVGs pose by default; write explicit scene/action changes to communicate movement. Give spoken lines and costume/reveal beats room to land.
2. Write the SVGs and supported skit actions. Attribute the actual model when known; otherwise use `Unknown`. Record speech engine separately. Reuse existing artwork when it serves the request.
3. Run `validate`, fix reported errors, then `render` (which builds missing speech first). Each command emits JSON and returns nonzero on failure. No paid LLM fallback is permitted unless the user asks for it. Existing user-authorized speech services are supported; use local Pocket by default.
4. Inspect the capture manifest and opening/reveal/end frames. Ensure every intended spoken line has audio and the video completes. Listen when audio tools are available; otherwise disclose that timing/decoding checks are not a listening review. Fix observed problems, then retry the affected step. After two identical failed retries, retain diagnostics and explain the missing prerequisite rather than claiming completion.

Speech is cached by text, voice, and speech configuration. Changing staging alone should reuse all lines. See [authoring](references/authoring.md) for imported or agent-supplied audio and GUI round-tripping.

## Deliver

Read [delivery](references/delivery.md) when rendering or returning results. Return the MP4 using the current chat's native artifact/attachment mechanism, with the editable `output/project.json` bundle and source folder. A VPS-local path or localhost URL is not a usable phone link. Use an existing authorized private preview or explain the missing delivery capability. Do not publish to the Pouch, open public ports, or change repository visibility just to make a link.
