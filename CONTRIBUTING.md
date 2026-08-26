# Contributing

pelicans.art is still an experimental studio, but focused bug reports and small changes are welcome once the repository opens publicly.

## Local setup

Use Node.js 22 or newer, FFmpeg, and npm:

```bash
npm ci
npm --prefix server ci
npm --prefix worker ci
npx playwright install chromium
npm test
npm --prefix server start
```

The authoring server binds to `127.0.0.1` by default. Do not expose it directly to the public internet.

## Pull requests

- Keep each change focused and explain the user-visible effect.
- Add or update tests for behavior changes.
- Run `npm test` before submitting.
- Never commit credentials, `.env` files, generated `node_modules`, or private voice samples.
- Sanitize any SVG before inserting it into the DOM; do not add a raw `innerHTML` path for generated, imported, or community content.
- Only contribute scripts and media you have the right to share. See `ASSET-LICENSE.md`.

Large new features are easier to review after a short design issue describing the proposed workflow.
