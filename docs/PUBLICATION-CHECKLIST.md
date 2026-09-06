# Public repository checklist

Use the [current release review](RELEASE-REVIEW.md) for evidence and remaining deployment steps. Repository visibility is a separate owner-authorized action.

## Prepared

- MIT source license, separate asset terms, third-party notices, security policy and contributor instructions.
- Previously exposed token revoked and reachable history rewritten; retain pre-rewrite backups privately and never push old history back into this repository.
- Owner acceptance of the legacy parody demos recorded. No further content decision is required for those demos.
- Agent-first installation, standalone SVGs, voiced CLI creation/revision/rendering, companion Editor and immutable downloadable skill releases.
- Verified isolated Linux x64/ARM64 Pocket setup; documented platform limits and service/cleanup boundaries.
- Current art-direction guidance and a Pouch raw-SVG security fix, with regression coverage.

## Final release sequence

1. Commit and push the release candidate; require the final branch Test workflow to pass.
2. Merge into main, deploy the Worker security patch, and verify real SVG response protections and normal Pouch display.
3. Confirm main Test and Pages deployment pass, and the live agent prompt downloads skill 1.0.11 with the matching receipt checksum.
4. On owner approval, change repository visibility. Check available GitHub secret-scanning and private-vulnerability-reporting settings afterward; do not infer their state from unavailable private-plan API metadata.
5. If needed, follow up with GitHub Support about cached views of the revoked credential. Never include the credential in a request or public issue.

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
