# SVG prompt study

A controlled, agent-authored experiment beside the original API-driven Prompt Lab. It never calls a paid provider or changes production prompts. Raw SVGs, prompt snapshots and failed candidates are retained. Model identity is hidden in the judging view until reveal.

Read `research.md` for sources and `protocol.md` for the test design. `prepare.mjs` freezes the briefs, methods, reference code and trial prompts; `evaluate.mjs` renders and validates submitted SVGs and builds the mobile judging gallery. Generation happens through authorized isolated agent contexts or explicitly labelled exploratory single-chat authoring, not through this harness.
