# Skit iteration audit — 6 September 2026

## Conclusion

Use chat to settle the idea, format, cast appearance, setting, scene beats, and dialogue before producing finished artwork or speech. The rejected storyboard UI has been removed. The updated skill and onboarding prompt describe this as an ordinary conversation, with creator approval before production; they do not require another app, file, or form. Explicit requests to skip review and prior approvals still count.

The biggest measured cost after artwork exists is real-time video capture, not speech or MP4 encoding. A fast build plus an accessible player preview is the most useful next implementation target. Keeping the same project/cache already makes line edits cheap. Tempo/pitch-only edits expose an avoidable speech-cache invalidation.

## Measurement scope

Fixture: `examples/portrait-witness-protection`, 8 spoken lines, native portrait 720×1280, delivered video 25.734 seconds. Linux x64; Node 22.23.1; pinned Pocket 2.1.0 April English CPU model with two inference threads. Reused the already-running speech service. Used a new temporary project for empty-cache and revision builds, leaving the delivered skit intact. Capture phase timings used a temporary Node module loader to bracket operations in `scripts/capture-skit.js`, not permanent source modifications.

These are single-run local measurements, not a statistical benchmark or a prediction for Hermes ARM64. Fresh installation, model startup, model authoring/thinking time, network upload, and chat delivery were not timed. Raw observations: [iteration-2026-09-06.json](benchmarks/iteration-2026-09-06.json).

| Operation | Seconds | What happened |
| --- | ---: | --- |
| SVG/script validation | 0.003 | Three local SVG assets validated |
| First speech build, service warm | 5.23 | Generated all 8 lines and built bundle |
| Unchanged build | 0.39 | Reused 8/8 lines |
| One line rewritten | 0.96 | Generated 1 line, reused 7 |
| Tempo-only change to both characters | 5.39 | Regenerated all 8 lines |
| Unchanged complete CLI render | 28.87 | Cached build plus complete capture/encode |

Separate instrumented capture:

| Capture stage | Seconds |
| --- | ---: |
| Player load and cover screenshot | 0.21 |
| Real-time playback | 24.75 |
| End hold and WebM finalization | 1.10 |
| Raw video probing and sync-marker scan | 0.47 |
| Audio extraction, mix, normalization and MP4 encode | 1.48 |
| Final probe, manifest and cleanup | 0.06 |

The stage table excludes parent CLI build and browser startup and is a different run from the 28.87-second wall-clock measurement. Do not add both tables as if they were independent costs.

## Pipeline, end to end

1. **Agent reads the skill and locates a runtime.** The portable ZIP is small; cloning a runtime and downloading dependencies are setup costs. `setup` currently reruns root/server `npm ci` and Chromium installation whenever invoked, even on an existing checkout. `setup --tts` includes all of that and verifies/installs the locked speech environment. Agents should reuse the existing verified runtime and avoid setup on ordinary revisions. Do not remove hash verification or isolation to save time.
2. **Speech starts if needed.** The Pocket wrapper verifies/downloads pinned model/tokenizer/26 embedding files, loads the model, and loads individual voice states on demand. A warm service avoids this startup. Startup calls `prepare()` again; avoiding redundant remote checks after a verified local receipt is a possible improvement, but would need careful invalidation. Cold startup was not benchmarked. Keep a service alive for the current work rather than restarting it for every line or revision.
3. **Agent plans and authors.** This is outside the CLI: model inference, repeated tool round trips, full SVG rewrites, and unapproved creative revisions can consume substantial time. The CLI does not call a second LLM/OpenRouter. We cannot assign a measured share of elapsed time to agent thinking from these CLI tests. Early chat review prevents discarded work; reuse fitting assets, keep the cast small, and edit targeted SVG/script sections after approval. Parallel asset authoring can help independent assets when authorized, but style and interface consistency still need review.
4. **Validation and bundle creation.** `loadProject()` reads, sanitizes/validates, hashes and embeds SVGs. It checks scene/action references. `render` already calls `buildProject`; a preceding explicit build is unnecessary unless its preview is being reviewed. A separate validate is useful before synthesis but very cheap here.
5. **Speech synthesis and cache.** `buildProject()` processes lines sequentially. Supplied recordings win when their bindings match. Otherwise it hashes text, voice, full speech configuration and optional tempo/pitch, probes cached MP3s, synthesizes missing lines, applies effects and MP3 encoding, then writes a self-contained bundle. One rewritten line correctly reuses seven. Cache is per source project; creating a new project loses that cache, while importing a built bundle retains embedded unchanged recordings. Endpoint/config changes also change keys even if the underlying voice model is identical.
6. **Render startup and browser playback.** The CLI starts a temporary loopback server and Chromium. The player loads all embedded audio, captures cover/still images and records a WebM while performing the whole skit in real time. This imposes a duration-sized floor on every full render. Shortening skits just to make tooling faster is not a creative solution; previewing without capture is.
7. **Synchronization and encoding.** FFmpeg scans the raw video for a visual start marker, then trims, combines line audio at observed offsets, normalizes loudness, and encodes H.264/AAC. The marker scan currently decodes the entire raw clip to find an early event; limiting the scan is a bounded improvement. Encoding was only 1.48 seconds here, including audio extraction/mix: changing `medium` to a faster preset or lowering resolution cannot remove the main real-time wait. Preserve synchronization and the final hold.
8. **Verification and delivery.** The pipeline probes the MP4, checks expected/captured/muxed line counts, writes manifests, and removes temporary capture files. Agent visual review, revisions, ZIP creation and file transfer happen afterward. Package/deliver final output once useful; don't rebuild just to attach a file. Keep checks that catch missing speech or framing mistakes.
9. **Editor variants.** Private Editor voice/render jobs create temporary workspaces and preserve embedded unchanged recordings. Their `.cache` is per job, so newly generated recordings not applied back to the project cannot be reused by a later job. A persistent scoped cache could help retries but needs ownership and cleanup rules. Plain text/layout edits and browser playback do not inherently require an MP4 job.

## Recommended next steps, in order

1. **Chat review — implemented in guidance.** Show a compact plan with an explicit format; ask only for consequential missing choices. Revise in chat, then produce after approval. This avoids expensive rework without any new UI or service.
2. **Fast player preview from the agent workflow.** Add a first-class CLI preview/delivery path for the built bundle using existing authorized access, so the agent can send a working preview after a 0.4-second cached build or roughly 1-second single-line rebuild on this fixture, instead of waiting ~29 seconds for an MP4. Browser open/network delivery costs would be additional. The player already supports bundles; missing pieces are ergonomic lifecycle and chat-accessible delivery. Do not expose a public port or require the user to edit in the browser.
3. **Two-layer speech cache.** Cache original synthesized audio by text, voice and verified synthesis identity; cache derived tempo/pitch/encoding separately. Then tempo/pitch changes transform cached audio without another Pocket request. Keep profile/hash validation and binding invalidation. Our tempo test demonstrates the current waste; no speedup has yet been implemented or benchmarked.
4. **Small verified auditions before full speech when needed.** Existing preset samples cost no synthesis. If delivery matters, generate one actual character line, get feedback, and reuse that recording in production. Make this optional; do not turn every skit into multiple mandatory checkpoints.
5. **More useful progress reporting and safe setup reuse.** Expose timings and stages in CLI progress (validation, speech N/M, playback, encode), and skip already-satisfied installation work only after comparing lock/runtime receipts. Better visibility distinguishes a long model response from a running render. This changes perceived waiting and diagnoses problems; it does not itself speed up capture.
6. **Targeted clip rendering for revisions.** A short audition or affected-scene MP4 can reduce both capture and review time when chat cannot display a live project preview. The current CLI always renders the full skit. A future scene-range mode must reconstruct prior character/background state and keep audio offsets correct; cropping an already completed MP4 would not save the capture wait.
7. **Later: faster-than-real-time/offline rendering.** This could remove the main capture floor, but requires a deterministic visual clock and offline audio timing covering speech, pauses, lip sync, camera movement and CSS animation. Simply speeding up browser audio would change acting/timing and is not an equivalent render. This is a renderer project, not a quick setting.

Do not parallelize requests to the current single Pocket instance expecting a free win: its inference lock serializes generation and protects shared random/state behavior. Multiple workers increase memory demand and require benchmarks on the actual VPS. Do not trade away safety validation or pinning to save fractions of a second.

## What changed in this task

Skill 1.0.13, the site prompt, README and workflow copy now describe chat-based review before production. The old prototype page/files were removed; the reproducible portrait skit remains. Runtime capture, synthesis, cache behavior and the tested runtime pin are unchanged. Earlier skill ZIPs remain immutable.
