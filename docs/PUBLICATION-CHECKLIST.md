# Public repository checklist

Use the [current release review](RELEASE-REVIEW.md) for evidence. The owner-authorized public release completed on September 6, 2026.

## Prepared

- MIT source license, separate asset terms, third-party notices, security policy and contributor instructions.
- Previously exposed token revoked and reachable history rewritten; retain pre-rewrite backups privately and never push old history back into this repository.
- Owner acceptance of the legacy parody demos recorded. No further content decision is required for those demos.
- Agent-first installation, standalone SVGs, voiced CLI creation/revision/rendering, companion Editor and immutable downloadable skill releases.
- Verified isolated Linux x64/ARM64 Pocket setup; documented platform limits and service/cleanup boundaries.
- Current art-direction guidance and a Pouch raw-SVG security fix, with regression coverage.

## Completed release

- Release `9e2c63d` merged into main; branch and main Test workflows passed.
- Worker security and upload controls deployed; real SVG headers and normal Pouch display verified.
- Pages deployed; live agent prompt, downloadable skill and receipt checksum verified.
- Repository made public with owner authorization; anonymous access verified.
- GitHub secret scanning, push protection, private vulnerability reporting and dependency alerts enabled.

For future releases, commit and test the candidate, deploy affected services, and verify live pages and immutable skill receipts. Never restore pre-rewrite history from an old clone or publish private backups.

## Community-service follow-up

Upload throttles, a byte limit, reporting/removal and reuse guidance are implemented. Follow [Pouch moderation](POUCH-MODERATION.md) to review reports and handle abuse; uploads are not premoderated and usernames do not prove ownership. Keep the authoring server behind loopback, a tunnel or authenticated private access.

## Recheck after changes

```bash
npm test
npm audit
npm --prefix server audit
npm --prefix worker audit
npm --prefix svg-prompt-lab audit
```

Use the release commit's CI results, not a prior green commit. Retain test logs and distinguish fixture checks from real speech and physical-device testing.
