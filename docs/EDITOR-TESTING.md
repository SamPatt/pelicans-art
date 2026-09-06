# Companion Editor release verification

Verified on 2026-09-06:

- `npm test`: 43 browser, 24 server, 11 Worker, and 28 CLI tests passed.
- Chromium layouts at 1280, 390, and 320 pixels: no horizontal overflow; full-frame playback with controls beneath it.
- Real Hermes ACP on the existing private VPS: streamed a proposed title edit, required Apply, applied it in a phone-sized browser, and disconnected without browser errors. No VPS installation or service changes were needed.
- Editor export → fresh CLI import → render: eight supplied recordings retained, zero generated; H.264 1280×720 / AAC output. Reviewed opening and late-reveal frames and capture timing manifests.
- The Description capture: eight expected, captured, and muxed dialogue lines.
- Automated checks cover stale-recording removal, recording preservation through reorder, undo, contextual clipboard requests, invalid imports, private connection restrictions, explicit permissions, timeout, and rejection of proposals after intervening edits.

## Try it

1. Open `/editor.html`, choose **Try The Description**, and play it.
2. Change a character's position, undo it, shorten a pause, and export the project.
3. Rewrite a line: its recording should be marked for update while other lines retain audio.
4. Copy a request for your agent and attach the export in your normal chat.
5. On a private installation with Hermes enabled, connect and request a title or dialogue change. Review it and Apply. Export for new speech and final rendering.

Chromium mobile emulation does not replace a hands-on Safari/Android check. Public Editor chat intentionally requires a private installation. New recordings and MP4 rendering remain in the agent/CLI workflow. The old Studio is retained at `/legacy-studio.html` for rollback.
