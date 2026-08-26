# Public release review

Reviewed: 2026-08-25

## Verdict

The live viewer, browser studio, bundled skits, and reproducible capture pipeline are functional. The project is ready for a private demo and for sharing a direct video with Simon Willison. Keep the repository private until the final history rewrite and post-rewrite secret scan are complete.

## Verified

- `https://pelicans.art/` returns successfully and the public homepage renders.
- The local authoring server binds to `127.0.0.1` and exposes a health check.
- All six bundled skits load in Chromium.
- A complete playback of every bundled skit was captured.
- All 75 expected dialogue lines were observed and muxed into the videos.
- Captures contain H.264 video and AAC audio at the intended landscape or portrait resolution.
- Capture audio is normalized to approximately -16 LUFS.
- Desktop and 390×844 homepage layouts pass automated checks.
- Current root and server production dependency audits report zero vulnerabilities.
- The exposed GitHub token has been revoked by the account owner.
- DOMPurify now sanitizes generated, imported, and community SVG before inline rendering; metadata and dialogue shown by the community gallery are HTML-escaped.
- The source code has an MIT license, with separate asset terms and third-party notices.
- A stable 32-second H.264/AAC render of The Box is linked directly from the homepage.
- The homepage and technical tour explain the model-to-SVG-to-JSON-to-video pipeline.

## Release blockers

1. **Purge the revoked GitHub token from history.** Rewrite every affected ref, remove historical `node_modules`, force-push the private remote, and verify the rewritten object database with a history-aware scan. Make a full Git bundle first and retain it privately.
2. **Audit already-stored community data.** New uploads receive stronger SVG URL checks and all browser rendering is sanitized, but existing R2 objects should still be scanned or re-uploaded before inviting broad community submissions.
3. **Keep the authoring server private.** It has powerful asset, voice, publishing, and deletion APIs without user authentication. The static GitHub Pages deployment is appropriate for public traffic; do not expose the Express server directly.

## High-priority improvements

- Consider a second pass on the 16-second Pelican Benchmark script after outside feedback; its concise model/tool joke now serves as the flagship.
- Refactor the 325 KB studio script and 121 KB player script into testable modules after the public demo; this is maintainability work, not a prerequisite for showing the concept.

## Skit review

| Skit | Duration | Review |
|---|---:|---|
| The Box | 31.6s | Best current flagship: original premise, clean staging, strongest structure, no third-party character dependency. |
| The Interview | 27.7s | Safe and compact, but visually sparse and the ending is softer. |
| Bats Don't Eat Lettuce | 54.7s | Strong visual identity and portrait format, but too long for the premise and uses Batman/Superman. |
| Lucky Charms | 35.8s | Clear escalation, but depends on Lucky Charms/General Mills branding. |
| The Finest Cuisine | 71.5s | Functional animation and prop work, but long, political, impersonation-heavy, and repetitive. |
| The Negotiation | 60.5s | Technically works, but should not be used for outreach because the robber depiction risks reading as a racial stereotype. |

## Suggested Simon outreach

> Your pelican-on-a-bicycle SVG test sent me down a rabbit hole: I built a browser studio where generated SVG characters become reusable actors with expressions, blocking, props, camera cuts, voices, and a constrained JSON timeline. It now has a reproducible exporter that turns a skit into a captioned H.264/AAC video. Here is a 32-second original example, plus the source and a short explanation of the SVG animation contract. I would love to know which part you think is the most interesting test of the models: drawing the actors, directing the timeline, or keeping the whole thing editable as SVG.

Lead with the video, then the public site, then the repository/technical write-up. Avoid asking for promotion; ask the concrete technical question.
