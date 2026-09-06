# Storyboard prototype and portrait workflow check

This prototype does not change the released skill, install prompt, or render pipeline.

## Portrait verification

A fresh project was created with `node scripts/theater.mjs init data/projects/portrait-witness-protection`, authored with `stage.orientation: "portrait"` and a native 720×1280 background, validated without warnings, then rendered through the normal CLI. Local speech readiness was verified with `doctor --endpoint http://127.0.0.1:8001/tts --wait 120 --json` before synthesis.

The final output is H.264/AAC, 720×1280, 25.734 seconds. Capture recorded 8 expected, 8 captured, and 8 muxed speech lines. Opening, middle and final frames were inspected. A second render enlarged the actors for phones and reused all 8 cached recordings. Audio decoding/timing checks are not a listening review. There was no required runtime fix: portrait already works. Source files for reproducing the test are in `examples/portrait-witness-protection/`; copy that directory to a new project directory and render with a matching local speech endpoint. Generated output and speech cache stay outside the committed example.

## Try the prototype

Open `/storyboard.html` on the local theater server. It loads `src/prototypes/portrait-storyboard.json` on first use. The sample follows the portrait skit's plot, with proposed staging to review before production.

- Brief: title, premise, format, target length and tone/art direction.
- Cast: appearance notes, pinned voice IDs with listening descriptions, horizontal blocking positions.
- Scenes: rough diagrams, action/setting notes, wide or close-up framing, speaker/dialogue, and end pauses. Add, remove, or reorder scenes and dialogue.
- Review: approve a specific revision, then download the plan or copy a complete agent handoff. Any edit invalidates approval. Importing a file opens it as a draft. Browser-local drafts survive reload; downloads are the portable source of truth.

The diagrams are placeholders, not finished artwork or faithful runtime previews. There is no TTS, rendering, agent connection, or automatic conversion to a player project in this prototype. Approve only records approval; the user sends the resulting handoff to their agent. Existing voice auditions are linked separately. “Target length” is a planning estimate, not calculated speech duration.

## Agent exchange

The prototype accepts JSON with `kind: "pelican-storyboard"`, `schemaVersion: 1`; the checked-in example is the schema reference. IDs must be unique lowercase character IDs; dialogue and focus reference those IDs. Supported prototype limits: 1–6 characters, 1–20 scenes, 0–30 lines per scene, 5–180 target seconds, 0–10 seconds per scene-end pause. Imported text is rendered using DOM text/value properties; SVG/HTML execution is not supported.

Suggested agent workflow to evaluate:

1. Ask only for missing decisions, especially portrait versus landscape. Offer a default; do not make users complete a questionnaire for an already-specific request.
2. Draft the brief, character descriptions, and scene/dialogue plan in chat. Send a storyboard JSON to this prototype if visual review would help.
3. Refine the plan. Do not commission finished SVGs, speech, or renders while status is draft.
4. After review, create a normal CLI project from the approved plan. Confirm available voice IDs and offer short actual-line auditions, then generate the missing assets/speech and render. Preserve the agreed orientation.

The proposed install-prompt change should make the test skit’s chosen format explicit and let the user change it before generation. Do not silently alter the pinned release ZIP or receipt while experimenting. This prototype is a review artifact, not an enforced production authorization mechanism.

## Verification

`npx playwright test tests/e2e/storyboard.spec.js` covers mobile frame ratios, format persistence, editing, approval invalidation, copy/download/import, invalid import preservation, and confirms no non-GET generation requests occur. Screenshots reviewed on phone and desktop.
