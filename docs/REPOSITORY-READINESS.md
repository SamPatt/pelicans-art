# Repository preparation — September 5, 2026

> Historical checkpoint. See [current release review](RELEASE-REVIEW.md) for subsequent agent, Editor, installation and security verification.

## Status

Prepared on `codex/release-prep`. Repository visibility remains private. These changes are not a site deployment and do not change the repository name: the `ai-improv-theater` local directory points to `SamPatt/pelicans-art`, which includes both the studio server and public site.

## Included work

- Finish Browser Studio onboarding, provider selection, per-character/per-skit voice casting, custom speech relays, and caption-only playback.
- Add local setup and browser documentation, Node 22 requirements, and reusable local speech/asset refresh scripts.
- Remove a personal tailnet endpoint from the voice preset.
- Restrict server-owned TTS credentials to an exact administrator-configured URL and header; reject upstream redirects, bound responses and timeouts, and avoid reflecting upstream error bodies.
- Reject unrelated browser origins for HTTP and WebSocket authoring access. Allow explicit extra origins for a private reverse proxy. The server remains a private, single-operator tool.
- Patch audited dependencies in the authoring server and optional SVG prompt lab. The `qs` override supplies the patched version while Express 4 still pins an affected version.
- Preserve unfinished experimental media, generated debug captures, and planning drafts in ignored `private-archive/release-prep-2026-09-05/`, with a manifest of original paths. These are local-only files, not committed release assets. No external Pouch records were deleted.

## Publication decisions still required

1. **Legacy creative content — owner decision recorded:** on September 5, 2026, the owner chose to retain the legacy demos as parody and accepted their inclusion. This is no longer a publication blocker for this project. The separate code/asset licensing remains in place; this records the owner’s decision rather than an independent legal conclusion. Existing tracked demos are retained. The ignored local archive contains unfinished experiments, not a removal of those tracked demos.
2. **Previously exposed credential:** the earlier release review records revocation and a history rewrite. The current reachable-history scan found no credential matches beyond a false positive in embedded audio. This is a pattern scan, not proof that no secret exists. Keep any pre-rewrite backup private and follow the earlier review's GitHub cache-removal guidance where applicable.
3. **Installation rehearsal:** test the future skill on the separate target device, including actual TTS installation and one generated/voiced/exported skit. Current tests use mocked provider responses and bundled audio; they do not prove a paid model or a newly installed VPS voice service works.
4. **Community launch:** upload abuse controls and asset reuse policy remain open in `PUBLIC-READINESS.md`. They are separate from distributing the private local studio for testing.

The installation skill is intentionally the next step, after this checkpoint, not part of this change.

## Model defaults

The OpenAI shortlist was checked against [official model documentation](https://developers.openai.com/api/docs/models) on September 5, 2026. A model ID is not a guarantee of account access or a measured quality claim for this application. Other provider choices remain configurable; no paid generation request was made during this audit.

## Verification

- `npm run setup` and Worker `npm ci` succeed in a fresh local clone without `.env`, ignored experiments, or the original runtime data.
- Full suite: 28 browser tests, 14 server tests, and 11 Worker tests passed, including a fresh-checkout run on an isolated port.
- Full npm audits (including development dependencies) report zero known vulnerabilities across the root, server, Worker, and optional SVG lab. Multer was also upgraded to maintained 2.x despite the audit's zero result for its deprecated predecessor; a generated WAV upload/analysis succeeds with the upgrade.
- HTTP smoke checks: unrelated browser origin returns 403; missing audio returns 400; valid generated WAV returns 200. Credential destination/header tests pass.
- Current tracked/untracked release file scan found no known credential-pattern matches. Reachable Git history scan covered 1,080 text blobs; its only match was random text inside base64 audio, not a credential.
- Captured The Description from the clean checkout: 38.1 seconds of playback, all 8 dialogue lines and all 8 audio clips, no capture diagnostics; output H.264/AAC at 1280×720. Reviewed the reveal frame and manifest.
- Inspected onboarding at 390 and 1280 pixels. Fixed the phone command bar wrapping; the editor now has 390-pixel document width at a 390-pixel viewport.
- Live model generation, fresh TTS installation, physical Safari testing, and Signal's signed-in preview rendering were not performed in this audit.
