# End-to-end agent wallclock experiment

The previous CLI audit did not measure the user's wait for the agent. This run did: **6 minutes 3 seconds until the skit passed its delivery checks; the link was sent at about 6 minutes 15 seconds.** Only **37.6 seconds** were inside timed processes. The remaining **337.3 seconds** were outside those processes. That remainder includes agent work and tool orchestration; it cannot be labeled pure model inference.

## What was made

“Emotional Baggage”: a pelican checks an embarrassing memory at an airport. Two newly authored SVG characters, one newly authored 1280×720 airport background, nine dialogue lines, local Pocket voices paul/anna, a 25.858-second H.264/AAC video, self-contained project and editable ZIP. No redraw, dialogue revision, failed validation, or repeat full render was required. Opening/middle/end frames, mobile playback, media dimensions, all nine captured/muxed lines, and the private preview link passed. No listening review is claimed.

Reproducible source: [examples/emotional-baggage](../examples/emotional-baggage). Timestamped observations: [agent-wallclock-2026-09-06.json](benchmarks/agent-wallclock-2026-09-06.json). Generated video, speech cache, raw command outputs, and original detailed event log are retained in the local project/experiment directories, not publicly uploaded.

## Wallclock timeline

Baseline: **2026-09-06 23:05:24 UTC**, the first clock reading. The user's message arrival timestamp and the few seconds used for the opening response were not available to this timer. Link-delivery marker: **23:11:38.915 UTC**, immediately after sending the link in commentary. No time waiting for user approval or installation occurred.

| Wallclock window | Elapsed | What was happening |
| --- | ---: | --- |
| 23:05:24 → 23:06:19.254 | 55.3 sec | Choose premise, reread skill/authoring/delivery, explain experiment, compose timing helper |
| 23:06:19.254 → 23:06:20.402 | 1.1 sec | Initialize project and verify existing speech service |
| 23:06:20.402 → 23:09:01.629 | 161.2 sec | Agent composes two complete SVGs, background, dialogue and the file-writing tool request; files then reach disk |
| 23:09:01.629 → 23:09:07.291 | 5.7 sec | Validate and synthesize/build nine lines |
| 23:09:07.291 → 23:10:03.792 | 56.5 sec | Prepare bespoke preview helper, capture first stage image, view it, decide no artwork change needed, dispatch render |
| 23:10:03.792 → 23:10:32.790 | 29.0 sec | Full cached-speech render; agent also prepares delivery code during this window |
| 23:10:32.790 → 23:11:26.957 | 54.2 sec | Finish helper preparation, package output, extract/view three frames, write mobile-check helper, verify playback and private URL |
| 23:11:26.957 → 23:11:38.915 | 12.0 sec | Compose/send delivery link and record the delivery milestone |

Durations are contiguous wallclock partitions, rounded separately. They are not pure reasoning timers. Asset-writing marker names in the portable event log have been clarified: the shell's original `authoring_start` event occurred after the agent had already composed the SVG text, and therefore must not be mistaken for the start of model authoring.

### Actual process durations

| Process | Seconds |
| --- | ---: |
| Init | 0.042 |
| Doctor, including speech probe | 1.062 |
| Validate | 0.043 |
| Build, nine newly synthesized lines | 5.577 |
| Stage preview browser helper | 0.718 |
| Render, nine reused recordings | 28.998 |
| Packaging and frame extraction helper | 0.515 |
| Mobile playback helper | 0.666 |
| Private URL check | 0.020 |
| **Total** | **37.642** |

The writing/execution distinction matters: the preview script ran in less than a second, but preparing its code, moving through tool calls and inspecting the image occupied a 56.5-second interval. Packaging/check execution was also cheap, while that whole stage occupied another 54.2 seconds.

## What this changes about the recommendations

1. **Prioritize avoiding discarded agent-authored artwork.** The new-asset authoring window alone was 2:41, compared with 29 seconds for capture. Chat review is useful mainly because it can prevent a two-minute drawing being replaced after the creator rejects its concept. Approval does not magically make SVG writing faster.
2. **Reuse approved characters and settings when appropriate.** This trial intentionally made three new assets. A new script with existing artwork avoids much of this authoring window; it does not guarantee an exact 2:41 saving, since selection/adaptation still take time. Ask whether reuse fits rather than defaulting to redrawing everything. Preserve detailed SVG authoring for assets the user actually needs.
3. **Stop composing routine plumbing on each request.** I wrote fresh preview, packaging, frame-extraction, and playback-check helpers. Those should be reusable CLI operations with one structured result, not new miniature programs every time. A `preview` and `deliver`/`verify` path would reduce agent tokens and serial handoffs, even though the helper execution itself is already fast. This is the strongest new agent-side tooling finding.
4. **Avoid redundant instruction reads and unnecessary discovery.** I reread instructions already available in this long conversation. Reusing known contracts and the verified runtime can reduce the initial 55-second interval; some of that interval was necessary plot planning and some was measurement instrumentation, so do not count all 55 seconds as removable.
5. **Overlap independent routine work and batch tools.** Package planning happened partly while render ran. A reusable command can capture frames and package automatically after capture, then return the image paths, line counts and URLs in one response. Keep a real visual review, but reduce back-and-forth used just to locate artifacts. Do not ask the user to perform that plumbing.
6. **Capture optimization is secondary for this example.** Removing all 29 render seconds would save under 8% of this 6:15 run, assuming other work stayed unchanged. A quick preview still helps subsequent iteration, but it does not solve the largest first-generation cost. Tempo caching remains a valid smaller improvement from the previous audit.
7. **Benchmark model and parallelism choices separately.** A faster authoring model or authorized parallel asset workers might shorten the 2:41 window, but quality, context transfer and style consistency can offset gains. This run used no subagents; there is no measured comparison or promised speedup. The next controlled comparison should keep the same brief, artwork requirements, number of assets, and quality bar.

## Necessary checks versus avoidable work

Keep structural validation, voice compatibility, a stage visual check, final framing/audio coverage, and a usable delivery-link check. Their machine cost was tiny and they prevent broken results. Reduce repeated instruction reading, bespoke helper authoring, repeated artifact discovery, and unnecessary asset replacement. Do not remove safety/profile checks to optimize fractions of a second.

The build before render was deliberate: it enabled a visual stage check before capture. Render rebuilt from cache, costing only a small fraction of the overall time. The larger issue was how long the agent took to prepare that preview, not the duplicated cached build.

## Limits and observer overhead

This was a single skit in an established long conversation with an already installed x64 runtime and warm speech model, using GPT-6 Astra. Timing-helper setup, milestone logging and explaining the experiment add overhead. Their separate share was not instrumented, so the report does not subtract a guessed amount. The 337-second remainder includes reasoning/text composition, reviewing outputs/images, tool transport/approval/queue time, commentary and tiny untimed file operations. Without provider-level token/latency and tool-transport telemetry those cannot be split precisely. The result supports fixing the overall agent workflow, not a claim that all delay is model “thinking.”

Audit analysis, writing this report, preserving the source, and committing the evidence occurred **after** the video link was sent. They are not included in the 6:15 production/delivery figure; the event log records that boundary explicitly. No runtime optimization was implemented during the measured run.
