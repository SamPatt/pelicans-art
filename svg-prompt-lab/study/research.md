# What to test, and why

Research reviewed 2026-09-06. These sources motivate hypotheses; they do not establish that the same technique will improve GPT-6 Astra or this theater's assets.

| Source | Actual approach | Adaptation for this study | Evidence limit |
|---|---|---|---|
| [Chat2SVG, CVPR 2025](https://arxiv.org/html/2411.16602v2), section 3.1 and appendix D | Expands a brief into objects, components, and spatial layout; provides SVG examples; renders and rectifies templates. | Separate layout-plan, reference-example, and visual-revision conditions. | Its full system also uses diffusion and geometry optimization. We are testing prompt/workflow adaptations, not reproducing its reported system or scores. |
| [IntroSVG, 2026](https://arxiv.org/html/2603.09312v1) | A trained generator/critic reviews rendered outputs and iteratively revises SVG. Includes blinded human comparisons. | Render before critique; identify observable defects; preserve drafts and compare revised results blindly. | Uses specialized training and preference optimization. A generic agent using the same workflow may behave differently. |
| [Render-in-the-Loop, 2026](https://arxiv.org/html/2604.20730v1) | Generates fragments conditioned on intermediate rasterizations; notes extra inference overhead. | Compare whole-draft visual revision now; keep incremental layer-by-layer rendering as a later experiment. | Fine-grained trained generation is not equivalent to asking an ordinary model to “think visually.” |
| [Building SVG Generation Skills for Claude Code, author account](https://0xdoublemoon.github.io/tools/2026/06/04/svg-skills.html) | Explicit palettes, safe margins, small-size legibility, named layers and self-contained SVGs. | Art-direction condition uses silhouette, palette, hierarchy and editability constraints. | A practitioner's recipe, not a controlled model comparison. Animation examples there are not adopted because our standalone SVG contract is static. |
| [PolyGlyph's own prompting guide](https://polyglyph.io/prompting-guide/) | Examples organize requests around subject, visual style and intended composition. | Treat explicit art direction as a candidate recipe rather than piling on adjectives. | Vendor guidance describes its own product; do not transfer success claims to this runtime. |
| [Is Feedback All You Need?, IUI companion 2026](https://doi.org/10.1145/3742414.3794725) | Publisher abstract describes comparing iterative feedback with generate-and-select under a fixed candidate budget. | A two-candidate comparison: draft plus revision versus two fresh drafts. | Full text was inaccessible during this review; no empirical outcome from the paper is asserted. |

## What the old lab tells us

The repository retains eight February experiment files, with 147 populated result records (two empty slots) and 110 rated records. Different models, prompts, references and user-selected ratings are mixed; these are useful historical examples, not controls for Astra today. No credentials or raw backend configuration are copied into this study.

The old sprite prompt is strongly prescriptive: a human-like head region, eye coordinates, a ban on necks, and a simple flat-cartoon style. Those choices might help animation compatibility while restricting bird anatomy and distinctive silhouettes. That is a hypothesis to test, not a reason to silently remove runtime requirements.

The current guide and browser prompt also differ about eye highlights. The study's shared runtime contract uses moving pupils without static highlights. The current-prompt condition remains a recorded recipe; we do not silently fix its aesthetic assumptions before comparing it.

## Practical hypotheses

1. More instructions can improve contract compliance while reducing visual distinctiveness.
2. A layout plan may help occlusion and complex silhouettes more than simple props.
3. A reference can help consistency but also encourage inappropriate copying of proportions.
4. Art direction may help aesthetics yet miss mandatory scene details.
5. Visual revision may fix visible defects or make a good draft worse. Compare actual before/after images and equal candidate budgets.
6. A valid, attractive still can fail when its eyes or mouth move. Technical checks and animation review must remain separate from aesthetic preference.
