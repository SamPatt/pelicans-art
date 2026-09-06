# Chat-driven skits and installation skill

Proposed September 5, 2026. The portable skill, CLI, GUI entry and local installation/render tests are now implemented; see AGENT-WORKFLOW.md. The Hermes rehearsal and public release have since completed; see CLI-VERIFICATION.md and RELEASE-REVIEW.md. This document records the design rationale.

## Product outcome

A person asks their agent to make a voiced animated skit. The agent writes SVG actors, backgrounds, props, and a JSON script directly; validates them; synthesizes dialogue locally; renders an MP4; and returns the video plus editable sources. OpenRouter and the GUI are optional ways to author the same project, not prerequisites. The agent uses its existing model connection; the theater makes no additional LLM requests in this workflow.

The skill should also handle installation, revisions, rendering existing projects, and opening the optional GUI. It should not install Hermes or OpenClaw: those are possible hosts of the agent using the skill, not dependencies of the theater.

## Skill packaging

Use one portable `skills/pelican-theater/SKILL.md`, with standard name/description frontmatter and a short workflow. Keep setup, authoring contract, and output troubleshooting in references loaded only when needed. Package supporting files together; don't assume every installed Hermes version fetches relative references from a single SKILL.md URL. Early private testing installed the skill directory from a checkout at a fixed revision. The public website now provides a versioned skill bundle and a copyable invocation.

Use host-native installation when available, otherwise copy the complete skill folder into the host's supported skill root. Check the installed host's help/version; don't assume current web docs match an older VPS release. Do not use symlinks that escape a host's permitted skill root. A generic file-and-shell agent can simply read the entrypoint and references.

Avoid prerequisite gates that hide the skill when Node, FFmpeg, or Python is missing: installation is one of its jobs. Core instructions must not depend on proprietary tool names, an OpenRouter key, another agent installation, or the author's machine paths.

## Runtime installation

1. Inspect the actual execution environment: OS/architecture, writable project directory, Node/npm, Python/uv, FFmpeg/ffprobe, Chromium availability, CPU/RAM/disk, existing speech endpoints and occupied ports. In a container, check inside that container, not just the gateway host. Record versions without collecting credentials.
2. Use the pinned tested repo revision. The repository is now public: fetch over HTTPS without credentials. Early private-repository testing used existing authenticated Git access. Keep tokens out of prompts, URLs, and skill files. Never change GitHub visibility as part of installation.
3. Install root and server npm lockfiles. Install only Chromium for capture. The Worker and SVG lab are not needed for making a video.
4. Reuse an existing speech service only after verifying its protocol and a short synthesis. Otherwise install a pinned Pocket TTS version in its own Python environment, using CPU PyTorch wheels on Linux. Reuse the model cache and keep the model loaded for a batch of lines. Start on a free loopback port and point the project config there. Do not upgrade an agent's own Python environment.
5. Default to scoped processes for a render job. Offer a generated user service for a persistent studio; don't copy the existing machine-specific `pocket-tts-server.service`. Repeated setup should preserve working endpoints and user configuration and report what changed.
6. Prove readiness: load the studio health endpoint, synthesize and decode a short WAV, render a tiny fixture with two distinct voices, and probe the resulting MP4. Missing voice support is an actionable failure when voiced video was requested, not silent success with captions.

Pocket TTS is the default because it already matches the theater's synthesis path and runs on CPU. Existing Piper, OpenAI-compatible, or agent-native speech can be accepted through adapters or audio files. Different wire formats must not be treated as interchangeable. Agent-native speech is useful only if its tool supplies a retrievable audio artifact for embedding.

## Small command-line interface

Wrap/refactor existing code rather than create a second player. Proposed commands (not implemented):

- `doctor --json`: executable versions, paths, speech probe status, missing requirements, actionable exit code.
- `init <project>`: a minimal editable project with an original actor, scene, and short script example.
- `validate <project>`: SVG safety and animation hooks, supported actions and cast/prop references, metadata, asset paths, voice assignments; errors include file/action locations.
- `build <project>`: compile a self-contained skit bundle, synthesize/cache only missing or changed lines, preserve explicitly supplied audio and record source/model metadata.
- `render <project>`: invoke the current player/capture pipeline and return MP4, cover, bundle, and manifest paths as JSON. A convenience render can run validation/build when necessary.

Keep generated projects under a user-selected workspace (default ignored `data/projects/`), not mixed into shipped examples. Support explicit input/output paths and port selection. Reuse the publisher asset bundling and capture code. Existing `scripts/publish-skit.js` contains hardcoded demos; it is not the generic public CLI.

The shared validation contract needs to match the current player. For example, the existing validator's action list must cover scene/background changes used by current published skits. The direct authoring reference should point to the actual supported contract and a minimal known-good SVG, not duplicate stale prompt prose.

A build manifest records project/repo versions, generated asset hashes, model attribution when known, speech engine/voice, dialogue-to-audio mapping, render duration, and output files. TTS cache keys include text, voice, engine/model and delivery settings. Changes to a pause or camera shot should not regenerate speech. Changes to one line should not regenerate the entire cast's audio.

## Agent creative workflow

For a new skit, propose format, character appearances/voices, setting, scene beats, and exact dialogue in chat. Revise with the creator and wait for approval before finished artwork, speech, or rendering. Reuse prior approval and honor an explicit request to skip review. No separate storyboard UI is required.

- Establish a readable setup, escalation, reveal, and final beat. Specify the audience's view at each scene, especially for motionless SVGs.
- Write SVGs directly using the agent's current model. Follow required eye, mouth, body and head hooks; validate references and safe markup before rendering. Do not silently route generation to a paid API.
- Record the actual authoring model when known, otherwise Unknown. Keep speech attribution separate; do not label all output Astra just because the example was Astra.
- Build and render. Check opening/reveal/final frames, audio completeness, dialogue timing, caption visibility, and the playback completion signal. Fix observed errors with bounded retries and retain diagnostics if blocked.
- Return the MP4 inline or as a native file attachment when the host supports it, plus editable source/bundle. A server-local path or localhost URL is not a usable link for somebody reading chat on their phone. Use existing authorized private preview access or transfer the output through the current conversation. Publishing to the Pouch or a public host is a separate user-requested action.

## GUI entry

Make "Create with your agent" the recommended first-run route, with Browser Studio/API setup available for visual editing and in-editor generation. Suggested copy:

> Prefer working in chat? Your agent can write the artwork and dialogue, generate local voices, and render a finished video. Open the result here whenever you want to edit it visually.

Offer Copy agent instructions, the versioned skill bundle, and Import project. The copied prompt identifies the real repository/revision and skill, asks for local setup if needed, and names a deliverable. Avoid suggesting that an API key is required for all creation. Browser AI remains available. GUI/agent round-tripping should preserve artwork, script, voice casting, and recorded audio.

## Hermes rehearsal

Do not operate the VPS until implementation is ready and the user proceeds with this test. Read the applicable VPS operations instructions then.

1. Inspect the VPS without changing the Hermes gateway, its environment, or existing voice service. Note whether the agent executes on the host or in a container.
2. Stage an isolated checkout at the tested commit and install the complete skill into the intended Hermes profile. Use a new session so skill discovery is tested.
3. Give Hermes only a realistic user prompt and the skill: "Install the theater here and make a 15-second voiced skit about a pelican trying to return a bicycle. Draw the SVGs yourself; don't use OpenRouter. Send me the video." Do not supply extra hidden manual installation steps.
4. Verify the delivered MP4 plays on the user's phone, not merely that a file exists on the VPS. Record resource use, install/render time, actions taken, and any intervention.
5. Request a single-line/pause revision, verify unchanged audio is reused, rerun setup to check idempotence, and import the resulting project into the GUI.
6. Separately test the default Pocket installation in a clean environment if the VPS already had usable TTS. A successful reuse path does not prove fresh installation works.
7. Fix demonstrated failures in commands or references, then repeat the failing scenario. The owner authorized publication and the repository became public on September 6, 2026.

## Research basis

- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices): short decision-relevant instructions, progressive detail, real task evaluation, and bundling repeated mechanics into tested scripts.
- [OpenClaw skills](https://docs.openclaw.ai/tools/skills): standard SKILL.md, local/workspace roots, environment gating and host-versus-sandbox dependencies; local installs expect SKILL.md at the source root.
- [Hermes skills guide](https://hermes-agent.nousresearch.com/docs/guides/work-with-skills): selective reference loading, installation into the active skill library, and session refresh behavior.
- [Pocket TTS](https://github.com/kyutai-labs/pocket-tts): CPU operation, Python environment requirements, local HTTP service, built-in voices, model reuse, and explicit CPU wheel installation on Linux.

These sources were checked September 5, 2026. Pin the dependency versions after the implementation smoke test, not by copying a floating install command into the final skill.
