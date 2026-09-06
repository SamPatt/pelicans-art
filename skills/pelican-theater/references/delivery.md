# Rendering and delivery

`render` builds the project and starts an ephemeral loopback-only player server on a free port. It uses the existing Playwright/FFmpeg capture engine and closes that server afterward. Use `--port` for an explicit port and `--output` for an alternate capture directory. No public server or cloud deployment is involved.

Success JSON contains video, cover, manifest, and editable bundle paths. The capture manifest records expected dialogue count, captured audio count, codecs, resolution, timing, and diagnostics. For a voiced project, each dialogue line must be captured and muxed; capture failures return nonzero. Caption-only rendering is permitted only when configured explicitly with tts.engine=none.

Inspect opening, reveal, and final frames. FFmpeg can extract frames from the returned video; select meaningful moments from dialogueTiming in the capture manifest. Check that captions leave the scene visible and the final beat is not cut off. Listening is preferable when supported. The capture process may take roughly the playback duration plus encoding; wait for completion rather than returning an unfinished path.

Return the H.264/AAC MP4 in the current conversation using its native attachment or artifact tool, and include the editable bundle/source location. For a VPS user on a phone, a local filesystem path or localhost link does not deliver the result. Use supported chat file transfer or an already authorized private preview. Do not invent a URL, upload publicly, change network/firewall configuration, or publish to the Pouch to work around missing delivery permission. State the missing delivery capability and retain the completed files.

Keep the source project and speech cache for revisions. Do not delete user sources or shared model caches as cleanup. Processes you started for a one-off test may be stopped when finished; leave preexisting services alone.

## Delivery contents

Send the MP4 as a playable attachment and an editable ZIP with one project directory:

```text
<project>/
  DELIVERY-NOTES.md
  project.json
  skit.json
  assets/
  output/project.json
  output/build-manifest.json
  output/render/project/project.mp4
  output/render/project/manifest.json
  output/render/project/cover.png
  output/render/project/still.png
```

Use actual render-result filenames; if `--output` placed renders elsewhere, collect them under the delivery's `output/render/project/`. The capture manifest's media paths are relative to that manifest. The build manifest uses `pathBase: "project"`; its `output/project.json` path is relative to the source project's root. Absolute paths in immediate CLI output are for local attachment tools, not saved delivery metadata.

Include only project sources and outputs, excluding `.cache/`, `.runtime/`, `node_modules/`, `.git/`, credentials, and temporary capture files. Keep the original source and speech cache locally through successful delivery and for revisions. `output/project.json` embeds the dialogue recordings; the recipient can import it into a fresh CLI project or the companion Editor without generating unchanged lines again.

In DELIVERY-NOTES.md record the title, generation model, speech engine, runtime source/commit, what was checked, and how to import `output/project.json` or rerender the sources. Note that `project.json`'s speech endpoint may need changing on another machine. Record paths relative to the archive root. After making the ZIP, check that the listed files exist and that all referenced media resolve inside it. Packaging does not upload anything; use the current chat's delivery mechanism.
