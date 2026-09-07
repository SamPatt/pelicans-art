# Asset-aware workflow timing trial — 6 September 2026

A returning-user trial using the normal chat review and skill 1.0.14 tools, on GPT-6 Astra with an existing Linux x64 runtime and warm pinned Pocket service. The user chose the second premise, approved the exact dialogue, and changed the proposed landscape format to portrait. The resulting **Name for the Order?** is 25.623 seconds, 720×1280, with 10/10 spoken lines captured and muxed. Decode, frame/contact-sheet and ZIP integrity checks passed. No listening review was performed.

## Measured result

| Measure | Time |
| --- | ---: |
| First clock reading to delivered private video link | 10m 38s |
| Two chat-review intervals | 2m 04s |
| Elapsed excluding review intervals | **8m 33s** |
| Production after final approval | 6m 56s |
| Earlier trial, start to delivered link | 6m 15s |

This trial was slower; it does not demonstrate an overall speed improvement. It also has additional chat planning, portrait adaptation and approval-review friction, so it is not a controlled comparison of the CLI implementation alone.

The review boundaries are tool timestamps before presenting questions and after receiving responses. They include some assistant/UI overhead and are not exact user think time. Both trials exclude the short opening response before the first clock reading. Audit/report/commit work after the delivery marker is excluded.

## Where elapsed time went

| Phase | Elapsed |
| --- | ---: |
| Discovery and chat planning, excluding review intervals | 1m 38s |
| Approval to source files written: contract reads, imports, voice lookup, art/staging composition, approval interruption and recovery | 4m 04s |
| Source files written to delivered link: preview, review, render, inspect, package, route verification and communication | 2m 52s |

The four instrumented CLI commands totaled **36.52 seconds**: preview including speech 5.20s; render 28.85s; inspect 2.28s; package 0.20s. The preview synthesized eight unique recordings and reused the repeated “Pelican” line twice. Final rendering reused all ten. Other command time, tool transport/approval, agent reasoning/composition and communication remain in phase totals; the remainder is not pure model inference.

## What the trial exposed

- Search surfaced empty local asset directories, which consume attention and result slots. Exclude assets without usable required files.
- “coffee” did not find every useful café asset; a focused follow-up search was needed. Accent normalization, synonyms and category-aware ranking would improve discovery.
- A suitable pelican from the previous project was not in the searchable library. Existing project assets need an explicit opt-in index or import path with descriptions/provenance. This trial benefited from conversation memory, so it is not a fresh-agent test.
- The café had no portrait variant. Reuse still required new composition, plus adding the pad/pencil and fish bucket. Track reuse, adaptation and new drawing separately rather than treating reused assets as zero work.
- I guessed `/voices` and received 404 before reading the wrapper and using `/health` `voicePresets`. The skill/tool should expose the catalog lookup directly.
- Automatic approval review rejected a command containing a private preview base URL as an unapproved upload. Local preview proceeded. Inspection later confirmed that `--base-url` only formats a link, and the existing Tailscale route proxies this same computer's loopback theater server. A read-only HEAD check then succeeded; no upload, public publishing or routing change occurred. The interruption and rewritten command were included, but not independently timed.
- Reusable preview/inspect/package commands did remove the need for custom delivery and FFmpeg helpers. They cannot by themselves remove agent art composition, repeated tool turns, or review overhead. This run still used a small timing harness; its authoring time is included.

## Next comparison

Use this exact approved script, orientation and finished asset set for a repeat run. That isolates project assembly, synthesis, preview and delivery from new art. Then compare a fresh agent session using only the published skill, without prior-project knowledge. Keep the chat review checkpoint, but do not add further review questions after approval unless a material creative choice changes.

Raw events: [JSON](benchmarks/asset-workflow-wallclock-2026-09-06.json). Editable source: [example](../examples/name-for-the-order/skit.json). Speech cache and complete delivery remain in the local project; no Pouch upload was performed.


## Finished-assets repeat after fixes — 7 September 2026

The follow-up used the exact approved portrait script and artwork, imported into a fresh project with no copied speech cache. The existing local Pocket service remained warm. The new project discovery found the portrait café; the new voice command verified alba and paul without guessing an HTTP route. Eight unique recordings were synthesized and the repeated line reused twice. The result is 25.626 seconds with 10/10 lines captured and muxed. Image review, decoding, private-link HEAD check, and independent ZIP integrity checks passed. No listening review was performed.

Ready to deliver: **98.17 seconds**. The video link was sent next. Its exact message timestamp was not captured; a later 151-second marker includes audit composition after delivery and is explicitly labeled as such in the [raw measurements](benchmarks/asset-workflow-retry-2026-09-07.json). Report-writing, skill packaging, deployment and commits are excluded.

The CLI render including synthesis took 32.84 seconds. Asset imports took about 1.67 seconds combined; discovery and voice catalog lookup took about 0.02 seconds. The rest of elapsed time includes agent/tool turns, screenshot inspection, approval latency and file delivery. The approved visuals did not need a separate pre-render preview.

This is a successful fast path for an approved script and reusable artwork, **not** a controlled measurement of a new skit or proof that code changes alone caused the reduction from the previous 6m 56s production phase. The earlier run also included 4m 04s of discovery, adaptation, authoring and interruption recovery before source files were written. A future fresh-agent creative test is still needed.

Implemented fixes: exclude empty assets; accent-insensitive search with café/coffee synonyms and relevance ordering; verified portrait filtering; explicit selected-project asset search/import without scanning other directories; pinned voice catalog lookup with descriptive notes; automatic command timestamps/durations; and skill guidance to reuse approved work and avoid redundant renders or custom helpers.

Regression validation: 53/54 tests passed on the concurrent full run; the single Chromium screenshot failure passed on the isolated five-test rerun. The 11 targeted discovery/voice tests passed, including project boundary and Pouch orientation checks. No behavior fix was inferred from the transient screenshot error.
