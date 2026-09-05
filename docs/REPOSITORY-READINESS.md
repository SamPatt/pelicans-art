# Repository preparation — September 5, 2026

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

1. **Legacy creative content:** existing tracked demos include recognizable branded characters and a `voice-samples/trump-sample.mp3` recording. Provenance/permission for that sample is not established by this audit. `ASSET-LICENSE.md` does not grant third-party rights. Resolve inclusion or remove these from a clean public distribution before changing visibility. Removing files from the latest commit does not remove prior Git history; a history rewrite or new sanitized repository needs a separate deliberate decision.
2. **Previously exposed credential:** the earlier release review records revocation and a history rewrite. The current reachable-history scan found no credential matches beyond a false positive in embedded audio. This is a pattern scan, not proof that no secret exists. Keep any pre-rewrite backup private and follow the earlier review's GitHub cache-removal guidance where applicable.
3. **Installation rehearsal:** test the future skill on the separate target device, including actual TTS installation and one generated/voiced/exported skit. Current tests use mocked provider responses and bundled audio; they do not prove a paid model or a newly installed VPS voice service works.
4. **Community launch:** upload abuse controls and asset reuse policy remain open in `PUBLIC-READINESS.md`. They are separate from distributing the private local studio for testing.

The installation skill is intentionally the next step, after this checkpoint, not part of this change.

## Model defaults

The OpenAI shortlist was checked against [official model documentation](https://developers.openai.com/api/docs/models) on September 5, 2026. A model ID is not a guarantee of account access or a measured quality claim for this application. Other provider choices remain configurable; no paid generation request was made during this audit.
