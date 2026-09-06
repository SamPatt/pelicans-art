# Public release review

Reviewed: 2026-09-06. Scope: source publication, agent/Editor onboarding, installation boundaries, dependency and reachable-history checks, and the Pouch SVG delivery boundary. This is a targeted review, not an exhaustive security or legal audit.

## Verdict

The source release candidate is prepared, with the requested art-direction guide and a fix for a Pouch SVG validation bypass. Keep repository visibility private until the candidate is merged and the Worker protection is deployed and verified. Public source availability and unrestricted community-upload promotion are separate decisions.

The primary workflow is direct SVG/JSON authoring through an agent and the CLI, with a companion Editor. No additional LLM API key is needed. The Description remains the flagship. The owner has already chosen to retain the legacy parody demos; that decision is not reopened here. Code and creative assets retain their separate existing terms.

## Included in this candidate

- A shared art-direction reference for new characters, props and backgrounds, linked from both agent artwork paths and the sprite guide. It adds silhouette, focal hierarchy, restrained palette, readable shape separation and a rendered inspection step while honoring user styles and existing artwork.
- Portable skill 1.0.11, preserving the published 1.0.10 ZIP/receipt. The new package includes the guide and uses a tested release-candidate runtime revision. The CLI, speech dependencies, model pins and private authoring server are unchanged from the previously verified runtime.
- Neutral repository-access copy that works before and after visibility changes, and removal of stale Browser Studio troubleshooting from the current Editor instructions.
- Worker rejection of namespace-prefixed active SVG content (including Unicode prefixes), unsafe namespace/declaration/base/CSS constructs, and unsafe animation mutations. These are conservative lexical checks, not a complete XML parser. Ordinary shipped SVGs remain supported.
- Sandboxed CSP and nosniff on raw SVG responses, including existing stored objects. This adds protection for direct SVG navigation that inline DOMPurify alone did not provide.
- Loopback binding in the retained legacy static-server service template.

## Verified locally

- Full suite: 47 browser, 26 server, 27 Worker and 42 agent/CLI tests passed (142 total).
- A local Chromium control/protected comparison confirmed that a harmless marker script executes without the new CSP and is blocked with it, while the SVG rectangle still renders. No live upload or exploit test was performed.
- All 77 shipped SVGs remain accepted by the tightened Worker validation. Regression tests cover upload rejection before storage and restrictive headers on previously stored unsafe SVGs.
- Four npm audits, including development dependencies, report zero known vulnerabilities: root, server, Worker and optional SVG lab.
- Targeted credential scan across 336 reachable commits / 1,688 blobs at audit start found no common credential/private-key signatures. No historical dependency environments, secret environment files or runtime caches were found. This does not cover inaccessible GitHub cached/dangling objects or establish that every possible secret format is absent.
- Existing skill 1.0.10 remains byte-for-byte unchanged. New skill contents match their source and the ZIP checksum matches its receipt. Skill frontmatter validation passes.
- The SVG prompting study retains 48 generated assets, both current controls, provenance and method-hidden review. It is supporting evidence, not a claim of a universally superior prompt.

## Installation evidence and limits

See [CLI verification](CLI-VERIFICATION.md) and [Editor testing](EDITOR-TESTING.md). Native ARM64 installation, real Pocket speech, dialogue revision and H.264/AAC rendering passed in GitHub [run 34042378085](https://github.com/SamPatt/pelicans-art/actions/runs/34042378085). The published main revision `38e97cc` also passed Test, ARM64 installation and Pages deployment. The installer/server/CLI and pinned speech inputs in this candidate are identical to that verified runtime; this review does not claim another fresh Hermes VPS installation.

Setup remains non-root, isolated, hash-locked and explicit about OS-level changes. Services bind privately; origin checks are not user authentication. Linux x64 and ARM64 are the verified local Pocket targets. macOS and physical Safari remain unverified beyond the documented scope.

## Before changing visibility

1. Push the completed release branch and require its final GitHub Test run to pass; merge the candidate into main. Do not restore pre-rewrite history from an old clone.
2. Deploy the Worker update and verify CSP/nosniff on a real SVG URL, plus ordinary Pouch rendering. No live exploit upload is needed. The local fix does not protect the live Worker until deployed; old browser/CDN responses may need revalidation.
3. Verify Pages publishes skill 1.0.11, its receipt/checksum and the updated agent prompt. Check final main Test and Pages results. Packaging locally is not a deployment.
4. Change repository visibility only on the owner's explicit instruction. Review GitHub secret scanning and private vulnerability reporting availability in the repository settings: the private-repository API did not expose their enabled state during this audit.

## Before unrestricted community promotion

The Pouch now has upload throttles, a strict streamed body limit, a public report form and authenticated manual removal, plus explicit reuse guidance that preserves existing rights. See [Pouch moderation](POUCH-MODERATION.md) for limits and incident handling. Uploads remain anonymous and are not premoderated; the maintainer must review reports. Limits are approximate and per Cloudflare location, not a global spending cap. Keep the powerful local authoring server private.
