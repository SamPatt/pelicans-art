# Contributing to pelicans.art

Thanks for helping with the strange little theater.

## Start here

Follow [Local setup](docs/LOCAL-SETUP.md), then run:

```bash
npm test
```

Keep the local authoring server private. Do not commit API keys, provider tokens, voice recordings without permission, generated caches, or local `.env` files.

## Repository map

- `src/` contains the public static site, editor, player, and bundled creative assets.
- `server/` contains the trusted local authoring, publishing, and voice server.
- `worker/` contains the community Pouch Worker.
- `scripts/` contains capture and repository utilities.
- `tests/e2e/` contains Playwright coverage.

## Making a change

1. Preserve unrelated working-tree changes.
2. Add or update tests for behavior changes.
3. Run the smallest relevant tests while iterating.
4. Run `npm test` before proposing a release.
5. For visual changes, inspect desktop and phone layouts and check keyboard focus.
6. For skit or player changes, capture the affected skit and review the MP4 plus manifest.
7. After pushing a release, verify the GitHub **Test** workflow on each pushed branch and the Pages deployment. Local test success and deployment success do not establish CI test success.

## Creative assets

Characters must follow the SVG structure described in [Sprite guide](docs/SPRITE-GUIDE.md). Review [ASSET-LICENSE.md](ASSET-LICENSE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before adding reference-derived artwork, voices, dialogue, or scenery.

Do not add an asset unless its provenance and permitted use are documented.

## Agent CLI

The primary creation path is [agent chat and the CLI](docs/AGENT-WORKFLOW.md). Run `npm run test:agent` for speech caching, import revisions, failure recovery, and voiced/caption-only MP4 captures. These tests use loopback speech fixtures and require FFmpeg and Chromium; they do not call paid providers. Keep real speech smoke-test results separate from mock adapter checks.

## Browser and server behavior

The companion Editor at `/editor.html` works without a server connection. Test import/export, recording preservation, mobile layout, and optional Hermes chat. See [Editor](docs/EDITOR.md). The previous Studio remains at `/legacy-studio.html` for rollback; its browser/server compatibility tests remain separate.

## Publishing and capture

Published skits are self-contained JSON bundles. Capture output belongs under `artifacts/captures/` and should be reviewed for complete dialogue, correct final action timing, audio/video codecs, and clean opening/still frames.
