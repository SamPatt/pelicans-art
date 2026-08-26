# Public repository checklist

The GitHub repository is intentionally still private. Complete this list immediately before changing visibility.

## Already complete

- Revoked the exposed HistorAI personal access token.
- Rewrote both remote branches to remove the token and historical `node_modules/` objects.
- Verified zero credential-pattern matches and zero `node_modules/` paths across reachable history.
- Stored and verified a complete private pre-rewrite Git bundle.
- Added MIT source licensing, separate creative-asset terms, third-party notices, a security policy, and contributor instructions.
- Added CI for browser, server, and community Worker tests; the rewritten `main` run passes.
- Sanitized inline SVG, escaped community metadata, and strengthened Worker-side SVG rejection.
- Added a technical tour, a captioned pelican bicycle skit, a second original example, and direct stable video URLs.
- Verified the public Pages deployment and HTTPS media responses.

## Decisions still required

- Remove third-party-character/brand/public-figure demos from the public tree, or explicitly accept their separate, uncertain status described in `ASSET-LICENSE.md`.
- Scan or replace existing community R2 objects before actively soliciting uploads.
- Decide whether community uploads should remain anonymous/open or gain moderation, rate limits, and takedown/reporting controls.
- Ask GitHub Support whether cached views need purging for the revoked credential; mention commit `a75ff2b2864383421fd16030ba687334e1bb29cd`, never the token itself.
- Enable GitHub secret scanning after visibility changes if it is unavailable for the private repository plan.
- Tell anyone with an older clone to discard it and clone again. Never merge or push an old clone into the rewritten repository.

## Final verification

```bash
npm ci
npm --prefix server ci
npm --prefix worker ci
npm test
npm audit
npm --prefix server audit
npm --prefix worker audit
```

Confirm the GitHub Actions **Test** and **Deploy to GitHub Pages** runs pass for the final `main` commit, then test the homepage, technical tour, interactive flagship, and both MP4 links on a phone before changing visibility.
