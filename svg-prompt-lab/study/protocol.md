# Assessment protocol

## Scope

One-model screening pilot, not a model leaderboard or proof of a universal best prompt. Six new briefs span two characters, two props and two backgrounds. Six first-pass recipes run on every brief (36 cells). A second current-agent-guide draft per brief supplies repeatability information and a two-candidate search baseline (6 cells). One rendered-feedback revision of each first current-agent-guide draft supplies the competing two-candidate workflow (6 cells). Total planned: 48 SVGs.

The six first-pass recipes are minimal contract, current browser prompt, current agent guide, art direction, scene/component/layout plan, and a same-category SVG example. Each receives the same asset brief and technical contract. Recipes are bundles of interventions; this does not isolate the causal effect of any single word. Prompt length and reference context are recorded, not secretly normalized away.

## Generation rules

- Freeze the matrix before looking at results. Use the same model and inherited reasoning configuration throughout. Record actual model/backend and unavailable settings as unavailable; never invent temperature or token counts.
- Preferred execution: one fresh, history-free authorized Astra context per trial. Each gets only its own prompt and authorized output path, not other candidates, research conclusions or judge scores. Randomize dispatch order with a recorded seed; this is not an inference seed. Agents share a filesystem, so the restriction to their own inputs is instruction-based, not an OS isolation boundary.
- If generation stays in the main chat, label it exploratory and context-contaminated; it cannot establish prompt superiority. Do not present hand-designed method variants as independent prompt samples.
- First pass: produce one SVG, with a short visible layout artifact only when requested by that method. No renderer, repairs, existing assets or external lookup except the explicitly supplied reference. Preserve the first output even if invalid.
- Revision: show the same draft, rendered PNG and original brief; identify at most three concrete visible defects and revise once. Preserve the critique, draft and result. Do not score your own work. Failed rendering is a recorded failure, not silently repaired and counted as first-pass success.
- Keep model, asset brief, common runtime contract and delivery renderer constant. Single-pass and two-candidate workflows are reported separately; generation count is only a rough budget proxy, not equal tokens or elapsed time.

## Judge before revealing method labels

For each brief, assess at normal size and phone/thumbnail size. Rate each axis from 1 to 5; 1 means unusable, 3 means usable with edits, 5 means strong as-is.

| Axis | What to ask |
|---|---|
| Brief fidelity | Are all required objects, relations and personality cues present? |
| Recognition | Is the main subject immediately legible, including at small size? |
| Visual appeal | Do silhouette, hierarchy, color and proportions feel intentional? |
| Distinctiveness | Does it have character instead of looking like a generic template? |
| Production usability | Can it be edited, staged, animated or held without major reconstruction? |

Also mark an overall favorite within each brief (ties allowed), confidence, and a short reason. Do not show numerical machine checks or method names during aesthetic scoring. Reveal those afterward. Ratings stay in the browser and can be exported as JSON; no scores are prefilled by the generating model.

Technical gates are separate: safe parse/render, viewBox, required IDs/types/group membership, duplicate IDs, pupils, closed/open-mouth placement, and clipping indicators. Geometry warnings are review flags, not proof that a drawing looks wrong. Character mouth-open and gaze contact sheets are approximations of runtime transformations; visually check them and perform a real player test before promoting a winning character recipe.

## Analysis and decisions

- Report pass/fail and missing outputs for every planned trial; never discard failures from denominators.
- Compare per-brief ranks and paired differences. Do not treat six briefs as a large statistical sample, average incomparable characters/props/backgrounds into a definitive winner, or turn subjective scores into calibrated measurements.
- Show second-draft variation separately. A method beating one lucky/unlucky baseline once is weak evidence.
- Compare the human-preferred result from draft plus revision to the human-preferred result from that same draft plus a fresh current-agent-guide draft, counting ties. Also report whether the revision itself improved or regressed relative to its parent. Human selection is an explicit part of both workflows, not a free automatic model capability. Both use two generation opportunities, but token costs are not matched.
- Separate user judgments from the author's qualitative observations. No synthetic human ratings or unexplained model-generated numeric scores.
- Promote only a recipe that wins on held-out briefs and passes production checks. Suggested next round: 3 new briefs per category × 3 independent repeats × finalists and current recipe, with two independent human raters if available. Keep that next round separate from this screening pilot.

The deliverable is a decision aid: evidence-backed proposed guide edits, category-specific recommendations where supported, and explicit uncertainties. Production prompts are unchanged by the study.

## Controls and scope of comparison

The browser control freezes the production system prompt. The agent control freezes references/svg.md plus docs/SPRITE-GUIDE.md for characters. Both retain the same brief and study contract as experimental recipes. These are harmonized first-pass controls, not exact reproductions of an unconstrained chat or complete GUI workflow: the shared contract fixes dimensions, output constraints and postpones rendering. The agent guide’s normal render-and-inspect delivery step is tested separately through its visual revision condition. No initialized example is supplied to this control; the same-category example is a separate condition. Report every experimental recipe against the current-agent control and retain the browser control as a historical comparison. These constraints must accompany conclusions.
