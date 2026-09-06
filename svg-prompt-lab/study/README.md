# SVG prompt study

A controlled, agent-authored experiment beside the original API-driven Prompt Lab. The harness makes no generation API calls and does not change production prompts. This pilot uses Codex subagents, not OpenRouter. Raw SVGs, prompt snapshots and failed candidates are retained. Recipe identity is hidden in the judging view until reveal.

Read `research.md` for sources and `protocol.md` for the test design. `prepare.mjs` freezes the briefs, methods, reference code and trial prompts; `evaluate.mjs` renders and validates submitted SVGs and builds the mobile judging gallery. Generation happens through authorized isolated agent contexts or explicitly labelled exploratory single-chat authoring, not through this harness.

## Isolated Astra pilot

48 planned candidates: six briefs × six first-pass recipes, plus an independent repeat and one visual revision of each current-agent control. Both current agent instructions and the older browser prompt are frozen controls. See protocol.md for the harmonization limits. No production guidance changes are inferred from unjudged images.

```sh
node svg-prompt-lab/study/evaluate.mjs astra-isolated
```

Serve `runs/astra-isolated/review/` through an existing private preview. Start with methods hidden, judge each brief, then export ratings. Preserve raw files and prompt snapshots. The review includes approximate mouth/gaze probes after reveal; these do not establish full player compatibility.

The committed prompt files are the executed inputs. Do not regenerate this matrix after changing the guides: start a new study ID/directory and preserve these snapshots. The dispatch seed controls scheduling only; inference seed and token usage are unavailable.

Generate the descriptive results with `node svg-prompt-lab/study/summarize.mjs astra-isolated` and the six contact sheets with `node svg-prompt-lab/study/contact-sheets.mjs astra-isolated`. To prepare a complete delivery copy, run `python3 svg-prompt-lab/study/package.py <existing-private-preview-directory>`. Python is used only for ZIP packaging; this starts no server and performs no network action. The delivered copy includes the source archive linked from its notes page. The source review directory alone does not include that ZIP.

See `runs/astra-isolated/findings.md` for completed observations and `assessment.md` for the decision framework.
