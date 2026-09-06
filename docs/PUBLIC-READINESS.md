# Public-sharing review

Scope: homepage redesign, watch/share pages, current bundled/Pouch skits, Model attribution, and the Pouch upload boundary. This is a product/release review, not a comprehensive penetration test or legal review.

> Historical product review. See [current repository release review](RELEASE-REVIEW.md). The community abuse-control and asset-reuse decisions below remain separate from source-code publication.

## Sharing the finished skit

The Description is the homepage's featured MP4 and default interactive selection. The Astra disguise pose replaces the old mascot. Dedicated share pages supply titles and thumbnails without JavaScript. Existing skits remain available. All 11 reusable assets are already in Pouch and the finished skit retains its original URL and eight audio clips.

The homepage and share-page changes were subsequently published, through commit `8d5c320`. Before a broader announcement, verify a freshly pasted Signal link. Signal itself has not been tested through a signed-in client; HTML metadata and image availability are the automated checks, not a guarantee of the exact card layout.

For a personal share with Simon, use the dedicated skit page after deployment. The creative work and playback are ready for that review; the broader service concerns below are separate.

## Before inviting unrestricted community uploads

- **Abuse controls:** `worker/community-worker.js` accepts anonymous uploads. Update: per-network/shared rate limits and a streaming byte limit shipped on September 6, 2026. A typed username is not an identity check. There is a payload limit and SVG validation; deletion requires an admin key. Reporting and authenticated manual removal are now documented in [Pouch moderation](POUCH-MODERATION.md); maintainers still need to review reports. Do not present the Model label as verified provenance: it is supplied by the uploader.
- **Reuse policy:** the homepage invites remixing, while `ASSET-LICENSE.md` describes original assets as available for viewing/evaluation and asks permission for standalone redistribution or commercial use. Decide and clearly state what noncommercial remixing permits. Do not silently apply a new license to third-party community assets. Surface the policy in the upload/import flow.
- **Authoring verification:** the default is now direct agent authoring and the CLI. See [CLI verification](CLI-VERIFICATION.md) and [current release review](RELEASE-REVIEW.md) for installation, real Pocket speech, revision and capture evidence. Legacy paid-provider generation is not a prerequisite for this workflow.
- **Browser coverage:** automated checks run Chromium, including narrow phone widths. A physical iPhone/Safari audio/play/share check and a Signal preview check remain worthwhile before a broad launch.

## Checks completed

- Desktop and phone visual review at 1440, 390, and 320 pixels; no horizontal overflow or browser script errors.
- Both featured/default selections point to The Description; other selections remain usable.
- Mascot animation respects reduced motion; asset carousel has no automatic scrolling. Keyboard focus and a skip link are provided; selected skits expose their pressed state.
- Current release test suite covers skit loading, playback, phone captions, share-page metadata, model defaults, SVG sanitation, and upload-model persistence.
- All 12 Description records (finished skit plus 11 reusable assets) report GPT-6 Astra through the live API.
- See `REPOSITORY-READINESS.md` for the subsequent studio checkpoint, local experiment archive, and remaining repository publication decisions.

Private preview routing is installation-specific and is not part of the public deployment.
